import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { ProjectNotes } from "./project-notes";
import { ErrorBoundary } from "./ErrorBoundary";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@shared/schema";
import { User, formatRetoucherAbbr, getRetoucherFullName } from "@/lib/types";
import { Calendar, Star, ChevronDown, ChevronRight, Copy, UserPlus, Search, X } from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner, FloatingAction, StaggeredList } from './LoadingStates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, RefreshCw } from "lucide-react";


interface TaskTableProps {
  projects: Project[];
  user: User;
  allUsers: User[];
  isPersonalView?: boolean;
}

export function TaskTable({ projects, user, allUsers, isPersonalView = false }: TaskTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Helper function to check if user has retouching abilities
  const hasRetouchingAbilities = (userRole: string) => {
    return ['Admin', 'LeadRetoucher', 'Retoucher'].includes(userRole);
  };
  
  // State for corrections modal
  const [correctionsProject, setCorrectionsProject] = useState<Project | null>(null);
  const [correctionsNote, setCorrectionsNote] = useState("");
  
  // State for drag and drop
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [assignProject, setAssignProject] = useState<Project | null>(null);
  
  // Loading states for different operations
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  
  // Local state for input values to ensure smooth typing
  const [localInputValues, setLocalInputValues] = useState<Record<string, {
    packageCount?: number;
    selectedCount?: number;
    extras?: number;
  }>>({});
  
  // Debounce timeouts
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Clear local input values when server data changes (to prevent stale state)
  useEffect(() => {
    setLocalInputValues(prev => {
      const updated = { ...prev };
      let hasChanges = false;
      
      // Remove local values that match server values (no longer being edited)
      Object.keys(updated).forEach(projectId => {
        const project = projects.find(p => p.id === projectId);
        if (project && updated[projectId]) {
          const localData = updated[projectId];
          
          // Clear local state if it matches server state (indicating update completed)
          if (localData.selectedCount !== undefined && localData.selectedCount === project.selectedCount) {
            delete updated[projectId].selectedCount;
            hasChanges = true;
          }
          if (localData.packageCount !== undefined && localData.packageCount === project.packageCount) {
            delete updated[projectId].packageCount;
            hasChanges = true;
          }
          if (localData.extras !== undefined && localData.extras === project.extras) {
            delete updated[projectId].extras;
            hasChanges = true;
          }
          
          // Remove empty project entries
          if (Object.keys(updated[projectId]).length === 0) {
            delete updated[projectId];
            hasChanges = true;
          }
        }
      });
      
      return hasChanges ? updated : prev;
    });
  }, [projects]);

  // Query to get all notes for all projects to determine which have notes
  const allNotesQuery = useQuery({
    queryKey: ["/api/projects/notes/all"],
    queryFn: async () => {
      const notesData: Record<string, number> = {};
      // Fetch notes count for each project
      await Promise.all(
        projects.map(async (project) => {
          try {
            const response = await fetch(`/api/projects/${project.id}/notes`);
            const notes = await response.json();
            notesData[project.id] = notes.length;
          } catch {
            notesData[project.id] = 0;
          }
        })
      );
      return notesData;
    },
  });

  // Helper function to get week start (Sunday-based)
  const getWeekStart = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    // Ensure valid year range
    if (d.getFullYear() < 2024) {
      d.setFullYear(2024);
    }
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    d.setDate(d.getDate() - day); // Go back to Sunday
    return d;
  };

  // State for collapsed weeks (Sunday-start)
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>(() => {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const currentWeekKey = currentWeekStart.toISOString().split('T')[0];
    
    // Initialize with all weeks collapsed except current week
    const initialState: Record<string, boolean> = {};
    const projectWeeks = new Set(projects.map(p => getWeekStart(new Date(p.dueDate)).toISOString().split('T')[0]));
    
    projectWeeks.forEach(weekKey => {
      // Only expand current week by default
      initialState[weekKey] = weekKey !== currentWeekKey;
    });
    
    // Keep rollover section expanded by default
    initialState["rollover"] = false;
    
    return initialState;
  });

  const toggleWeek = (weekKey: string) => {
    setCollapsedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  // State for client search per week
  const [weekSearchTerms, setWeekSearchTerms] = useState<Record<string, string>>({});

  // Function to filter projects based on search term for a specific week
  const filterProjectsBySearch = (projects: Project[], weekKey: string) => {
    const searchTerm = weekSearchTerms[weekKey]?.toLowerCase().trim();
    if (!searchTerm) return projects;
    
    return projects.filter(project => 
      project.clientName?.toLowerCase().includes(searchTerm) ||
      project.assignedTo?.toLowerCase().includes(searchTerm)
    );
  };

  const formatWeekRange = (weekStart: Date) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const sunday = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const saturday = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Week of ${sunday} – ${saturday}`;
  };



  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, endpoint, data }: { id: string; endpoint: string; data?: any }) => {
      setLoadingStates(prev => ({ ...prev, [id + endpoint]: true }));
      const response = await apiRequest("PATCH", `/api/projects/${id}/${endpoint}`, data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Clear all loading states for this project
      setLoadingStates(prev => {
        const newStates = { ...prev };
        delete newStates[variables.id + variables.endpoint];
        delete newStates[variables.id + 'mark-paid'];
        delete newStates[variables.id + 'deliver'];
        delete newStates[variables.id + 'assign'];
        return newStates;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        description: "Project updated successfully!",
      });
    },
    onError: (_, variables) => {
      // Clear all loading states for this project
      setLoadingStates(prev => {
        const newStates = { ...prev };
        delete newStates[variables.id + variables.endpoint];
        delete newStates[variables.id + 'mark-paid'];
        delete newStates[variables.id + 'deliver'];
        delete newStates[variables.id + 'assign'];
        return newStates;
      });
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Helper: format date as "Mon DD, YYYY"
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Group projects by week (Monday start date)
  const groups: { key: number; weekStart: Date; projects: Project[] }[] = [];
  projects.forEach(project => {
    const weekStart = getWeekStart(new Date(project.dueDate));
    const key = weekStart.getTime();
    let group = groups.find(g => g.key === key);
    if (!group) {
      group = { key: key, weekStart: weekStart, projects: [] };
      groups.push(group);
    }
    group.projects.push(project);
  });

  // Sort groups by weekStart date
  groups.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      "Awaiting Payment": { variant: "secondary" as const, className: "bg-orange-500 text-white hover:bg-orange-600" },
      "Ready for Retouching": { variant: "secondary" as const, className: "bg-blue-500 text-white hover:bg-blue-600" },
      "Assigned": { variant: "secondary" as const, className: "bg-purple-500 text-white hover:bg-purple-600" },
      "Review": { variant: "secondary" as const, className: "bg-red-500 text-white hover:bg-red-600" },
      "Corrections": { variant: "secondary" as const, className: "bg-orange-600 text-white hover:bg-orange-700" },
      "Delivered": { variant: "secondary" as const, className: "bg-green-500 text-white hover:bg-green-600" },
      "Done": { variant: "secondary" as const, className: "bg-gray-500 text-white hover:bg-gray-600" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "secondary" as const, className: "" };
    return (
      <Badge variant={config.variant} className={config.className}>
        {status}
      </Badge>
    );
  };

  const handleAssign = (projectId: string, retoucherName: string) => {
    updateProjectMutation.mutate({
      id: projectId,
      endpoint: "assign",
      data: { assignedTo: retoucherName === "__UNASSIGN__" ? null : retoucherName },
    });
  };

  const handleMarkPaid = (projectId: string) => {
    setLoadingStates(prev => ({ ...prev, [projectId + 'mark-paid']: true }));
    updateProjectMutation.mutate({
      id: projectId,
      endpoint: "mark-paid",
    });
  };

  const handleMarkDone = (projectId: string) => {
    updateProjectMutation.mutate({
      id: projectId,
      endpoint: "mark-done",
    });
  };

  // Helper function to format client display based on rollover shadow status
  const formatClientDisplay = (project: any) => {
    // For shadow projects, always show (RO) suffix
    if (project.isRolloverShadow) {
      return `${project.clientName} (RO)`;
    }
    
    // For original projects that have been rolled over, show without suffix since the shadow shows (RO)
    return project.clientName;
  };

  // Handle rollover action with useMutation
  const rolloverMutation = useMutation({
    mutationFn: async ({ projectId, photosCompleted }: { projectId: string; photosCompleted: number }) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/rollover`, { photosCompleted });
      return response.json();
    },
    onSuccess: (result) => {
      if (result.allComplete) {
        toast({
          title: "All Photos Complete!",
          description: result.message,
        });
      } else {
        toast({
          title: "Project Rolled Over",
          description: result.message,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to rollover project",
        variant: "destructive",
      });
    },
  });

  const handleRollover = (projectId: string, photosCompleted: number) => {
    rolloverMutation.mutate({ projectId, photosCompleted });
  };

  // Handle rollback action - restore original project from "Rolled Over" status
  const rollbackMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/rollback`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Project Rolled Back",
        description: "Project has been restored to its original status.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to rollback project",
        variant: "destructive",
      });
    },
  });

  const handleRollback = (projectId: string) => {
    rollbackMutation.mutate(projectId);
  };

  const handleRequestRevision = (projectId: string) => {
    updateProjectMutation.mutate({
      id: projectId,
      endpoint: "request-revision",
    });
  };

  const handleRequestCorrections = async (projectId: string, note: string) => {
    try {
      // First, add the corrections note if provided
      if (note.trim()) {
        await fetch(`/api/projects/${projectId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteType: 'text',
            content: `🔄 CORRECTIONS REQUESTED: ${note}`,
            createdBy: user.name,
          }),
        });
      } else {
        // Add a default note if none provided
        await fetch(`/api/projects/${projectId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteType: 'text',
            content: `🔄 CORRECTIONS REQUESTED by ${user.name}`,
            createdBy: user.name,
          }),
        });
      }
      
      // Then update project status to Corrections
      updateProjectMutation.mutate({
        id: projectId,
        endpoint: "request-corrections",
      });
      
      setCorrectionsProject(null);
      setCorrectionsNote("");
      
      toast({
        title: "Corrections Requested",
        description: `Project sent back for corrections.`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'notes'] });
    } catch (error) {
      console.error('Error requesting corrections:', error);
      toast({
        title: "Error",
        description: "Failed to request corrections",
        variant: "destructive",
      });
    }
  };

  const handleDeliver = (projectId: string) => {
    setLoadingStates(prev => ({ ...prev, [projectId + 'deliver']: true }));
    updateProjectMutation.mutate({
      id: projectId,
      endpoint: "deliver",
    });
  };

  const handleSetRating = (projectId: string, rating: number) => {
    updateProjectMutation.mutate({
      id: projectId,
      endpoint: "rating",
      data: { rating },
    });
  };

  const updatePhotosCompleted = (projectId: string, photosCompleted: number) => {
    updateProjectMutation.mutate({
      id: projectId,
      endpoint: "photos-completed",
      data: { photosCompleted },
    });
  };

  const changeDueDateMutation = useMutation({
    mutationFn: async ({ id, dueDate }: { id: string; dueDate: string }) => {
      const response = await apiRequest("PATCH", `/api/projects/${id}`, { dueDate });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Due date updated",
        description: "Project due date has been changed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update due date. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleChangeDueDate = (projectId: string, newDate: Date) => {
    changeDueDateMutation.mutate({
      id: projectId,
      dueDate: newDate.toISOString(),
    });
  };

  const changeSelectedCountMutation = useMutation({
    mutationFn: async ({ 
      id, 
      selectedCount, 
      packageCount,
      extras 
    }: { 
      id: string; 
      selectedCount?: number; 
      packageCount?: number;
      extras: number; 
    }) => {
      const updateData: any = { extras };
      if (selectedCount !== undefined) updateData.selectedCount = selectedCount;
      if (packageCount !== undefined) updateData.packageCount = packageCount;
      
      const response = await apiRequest("PATCH", `/api/projects/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      // Don't clear local state immediately - let the query update handle it
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project updated",
        description: "Project details updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleChangeSelectedCount = useCallback((projectId: string, selectedCount: number) => {
    // Update local state immediately for smooth input
    setLocalInputValues(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], selectedCount }
    }));
    
    // Clear existing timeout
    if (timeoutRefs.current[projectId]) {
      clearTimeout(timeoutRefs.current[projectId]);
    }
    
    // Set new timeout for API call
    timeoutRefs.current[projectId] = setTimeout(() => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      
      // Get current package count (from local state or project)
      const currentPackageCount = localInputValues[projectId]?.packageCount ?? project.packageCount;
      const extras = Math.max(0, selectedCount - currentPackageCount);
      
      changeSelectedCountMutation.mutate({
        id: projectId,
        selectedCount,
        extras,
      });
    }, 500);
  }, [projects, localInputValues, changeSelectedCountMutation]);

  const handleChangePackageCount = useCallback((projectId: string, packageCount: number) => {
    // Update local state immediately for smooth input
    setLocalInputValues(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], packageCount }
    }));
    
    // Clear existing timeout
    if (timeoutRefs.current[`pkg_${projectId}`]) {
      clearTimeout(timeoutRefs.current[`pkg_${projectId}`]);
    }
    
    // Set new timeout for API call
    timeoutRefs.current[`pkg_${projectId}`] = setTimeout(() => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      
      // Get current selected count (from local state or project)
      const currentSelectedCount = localInputValues[projectId]?.selectedCount ?? project.selectedCount;
      const extras = Math.max(0, currentSelectedCount - packageCount);
      
      changeSelectedCountMutation.mutate({
        id: projectId,
        packageCount,
        extras,
      });
    }, 500);
  }, [projects, localInputValues, changeSelectedCountMutation]);

  const handleChangeExtras = useCallback((projectId: string, extras: number) => {
    // Update local state immediately for smooth input
    setLocalInputValues(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], extras }
    }));
    
    // Clear existing timeout
    if (timeoutRefs.current[`ext_${projectId}`]) {
      clearTimeout(timeoutRefs.current[`ext_${projectId}`]);
    }
    
    // Set new timeout for API call
    timeoutRefs.current[`ext_${projectId}`] = setTimeout(() => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      
      // Get current package count (from local state or project)
      const currentPackageCount = localInputValues[projectId]?.packageCount ?? project.packageCount;
      const newSelectedCount = currentPackageCount + extras;
      
      changeSelectedCountMutation.mutate({
        id: projectId,
        selectedCount: newSelectedCount,
        extras,
      });
    }, 500);
  }, [projects, localInputValues, changeSelectedCountMutation]);

  const duplicateProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/duplicate`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project duplicated",
        description: "Project has been duplicated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to duplicate project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDuplicateProject = (projectId: string) => {
    duplicateProjectMutation.mutate(projectId);
  };

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest("DELETE", `/api/projects/${projectId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "Project has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  // Mutation for updating project assignment
  const assignProjectMutation = useMutation({
    mutationFn: async ({ projectId, assignedTo }: { projectId: string; assignedTo: string | null }) => {
      return await apiRequest("PATCH", `/api/projects/${projectId}`, { assignedTo });
    },
    onMutate: async ({ projectId, assignedTo }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/projects'] });

      // Snapshot the previous value
      const previousProjects = queryClient.getQueryData(['/api/projects']);

      // Optimistically update to the new value
      queryClient.setQueryData(['/api/projects'], (old: Project[] | undefined) => {
        if (!old) return old;
        return old.map(project => 
          project.id === projectId 
            ? { ...project, assignedTo }
            : project
        );
      });

      // Return a context object with the snapshotted value
      return { previousProjects };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousProjects) {
        queryClient.setQueryData(['/api/projects'], context.previousProjects);
      }
      toast({
        title: "Error",
        description: "Failed to assign project. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Project assigned",
        description: "Project has been assigned successfully.",
      });
      // Clear assignment modal immediately to prevent lag
      setAssignProject(null);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });

  // Mutation for updating project due date (drag & drop)
  const updateProjectDateMutation = useMutation({
    mutationFn: async ({ projectId, dueDate }: { projectId: string; dueDate: Date }) => {
      return await apiRequest("PATCH", `/api/projects/${projectId}`, { dueDate: dueDate.toISOString() });
    },
    onMutate: async ({ projectId, dueDate }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/projects'] });

      // Snapshot the previous value
      const previousProjects = queryClient.getQueryData(['/api/projects']);

      // Optimistically update to the new value
      queryClient.setQueryData(['/api/projects'], (old: Project[] | undefined) => {
        if (!old) return old;
        return old.map(project => 
          project.id === projectId 
            ? { ...project, dueDate: dueDate.toISOString() }
            : project
        );
      });

      // Return a context object with the snapshotted value
      return { previousProjects };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousProjects) {
        queryClient.setQueryData(['/api/projects'], context.previousProjects);
      }
      toast({
        title: "Error",
        description: "Failed to move project. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Project moved",
        description: "Project due date has been updated.",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, project: Project) => {
    setDraggedProject(project);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    if (draggedProject) {
      console.log('Dropping project:', draggedProject.clientName, 'to date:', targetDate.toDateString());
      
      // Only allow moving within the same week
      const draggedWeekStart = getWeekStart(new Date(draggedProject.dueDate));
      const targetWeekStart = getWeekStart(targetDate);
      
      if (draggedWeekStart.getTime() === targetWeekStart.getTime()) {
        updateProjectDateMutation.mutate({
          projectId: draggedProject.id,
          dueDate: targetDate,
        });
      } else {
        toast({
          title: "Cannot move project",
          description: "Projects can only be moved within the same week.",
          variant: "destructive",
        });
      }
    }
    setDraggedProject(null);
  };

  const handleDragEnd = () => {
    setDraggedProject(null);
  };

  // Double-click handler for assignment
  const handleDoubleClick = (project: Project) => {
    console.log('Double-clicked project:', project.clientName);
    setAssignProject(project);
  };

  const handleAssignProject = (assignedTo: string | null) => {
    if (assignProject) {
      console.log('Assigning project', assignProject.clientName, 'to', assignedTo);
      setLoadingStates(prev => ({ ...prev, [assignProject.id + 'assign']: true }));
      
      assignProjectMutation.mutate({
        projectId: assignProject.id,
        assignedTo,
      });
      
      // Clear loading state after a brief delay
      setTimeout(() => {
        setLoadingStates(prev => {
          const updated = { ...prev };
          delete updated[assignProject.id + 'assign'];
          return updated;
        });
      }, 1000);
    }
  };



  // Filter projects for retouchers
  let visibleProjects = projects;
  if (user.role === "Retoucher") {
    visibleProjects = projects.filter(p => 
      p.assignedTo && 
      p.assignedTo.toLowerCase() === user.name.toLowerCase() && 
      p.status !== "Delivered"
    );
  }
  
  // For personal view (admin's personal dashboard), projects are already filtered

  // Re-group the filtered projects with unassigned rollover handling
  const today = new Date();
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay()); // Go back to Sunday
  currentWeekStart.setHours(0, 0, 0, 0);
  
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(currentWeekStart.getDate() - 7);

  // Separate unassigned rollover projects from regular projects
  const unassignedRollover: Project[] = [];
  const regularProjects: Project[] = [];
  
  visibleProjects.forEach(project => {
    const projectDate = new Date(project.dueDate || project.createdAt);
    const isUnassigned = !project.assignedTo || project.assignedTo === "__UNASSIGN__";
    const isFromPastWeek = projectDate < previousWeekStart;
    
    if (isUnassigned && isFromPastWeek) {
      unassignedRollover.push(project);
    } else {
      regularProjects.push(project);
    }
  });

  // Group regular projects by weeks
  const visibleGroups: { key: number; weekStart: Date; projects: Project[]; isRollover?: boolean }[] = [];
  
  // Add unassigned rollover group at the top if there are any
  if (unassignedRollover.length > 0) {
    // Sort unassigned by creation date (oldest first)
    unassignedRollover.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    visibleGroups.push({
      key: -1, // Special key to ensure it appears first
      weekStart: new Date(0), // Dummy date for rollover
      projects: unassignedRollover,
      isRollover: true
    });
  }

  // Group regular projects by week
  regularProjects.forEach(project => {
    const weekStart = getWeekStart(new Date(project.dueDate));
    const key = weekStart.getTime();
    let group = visibleGroups.find(g => g.key === key);
    if (!group) {
      group = { key: key, weekStart: weekStart, projects: [] };
      visibleGroups.push(group);
    }
    group.projects.push(project);
  });

  // Sort groups: rollover first, then by week start date
  visibleGroups.sort((a, b) => {
    if (a.isRollover) return -1; // Rollover always first
    if (b.isRollover) return 1;
    return a.weekStart.getTime() - b.weekStart.getTime();
  });

  return (
    <div className="space-y-8">
      {visibleGroups.map(group => {
        const isRollover = group.isRollover;
        const monday = isRollover ? new Date() : group.weekStart; // Use today for rollover
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const weekLabel = isRollover ? "🔄 Unassigned Rollover" : formatWeekRange(monday);
        const weekKey = isRollover ? "rollover" : monday.toISOString().split('T')[0];
        const isCollapsed = collapsedWeeks[weekKey];
        
        // Sort projects: rollover by creation date (oldest first), regular by due date
        if (isRollover) {
          // Already sorted by creation date in the grouping logic
        } else {
          group.projects.sort((a, b) => {
            const dateComparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            if (dateComparison !== 0) return dateComparison;
            return a.id.localeCompare(b.id); // Secondary sort by ID for stability
          });
        }
        
        return (
          <motion.div
            key={group.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            layout
          >
            <Card>
              <motion.div
                whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.02)" }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader 
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleWeek(weekKey)}
                >
                  <CardTitle className="flex items-center justify-between">
                <motion.div 
                  className="flex items-center gap-2"
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <motion.div
                    animate={{ rotate: isCollapsed ? 0 : 90 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  </motion.div>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.05, 1],
                      rotate: [0, -2, 2, 0]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Calendar className="h-5 w-5 text-gray-600" />
                  </motion.div>
                  <span>Week of {weekLabel}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center gap-2 text-sm text-gray-500"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {(() => {
                    const totalProjects = group.projects.length;
                    const assignedProjects = group.projects.filter(p => p.assignedTo && p.assignedTo !== "__UNASSIGN__").length;
                    const totalPhotos = group.projects.reduce((sum, p) => sum + (p.toEditRemaining || p.selectedCount || 0), 0);
                    const completedPhotos = group.projects.reduce((sum, p) => sum + (p.photosCompleted || 0), 0);
                    const assignedPhotos = group.projects
                      .filter(p => p.assignedTo && p.assignedTo !== "__UNASSIGN__")
                      .reduce((sum, p) => sum + (p.toEditRemaining || p.selectedCount || 0), 0);
                    
                    return (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <motion.span
                            animate={{ 
                              scale: [1, 1.2, 1],
                              rotate: [0, -10, 10, 0]
                            }}
                            transition={{ 
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          >
                            📅
                          </motion.span>
                          <motion.span 
                            className="text-green-600 dark:text-green-400 font-semibold"
                            animate={{ scale: assignedProjects > 0 ? [1, 1.1, 1] : 1 }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                          >
                            {assignedProjects}
                          </motion.span>
                          <span>/</span>
                          <motion.span 
                            className="text-red-600 dark:text-red-400 font-semibold"
                            animate={{ scale: totalProjects > 0 ? [1, 1.05, 1] : 1 }}
                            transition={{ duration: 0.5, ease: "easeInOut", delay: 0.1 }}
                          >
                            {totalProjects}
                          </motion.span>
                          <span className="text-gray-400">projects</span>
                        </div>
                        
                        <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full">
                          <motion.span
                            animate={{ 
                              scale: [1, 1.1, 1]
                            }}
                            transition={{ 
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          >
                            📸
                          </motion.span>
                          <motion.span 
                            className="text-green-600 font-semibold"
                            animate={{ scale: completedPhotos > 0 ? [1, 1.1, 1] : 1 }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                          >
                            {completedPhotos}
                          </motion.span>
                          <span>/</span>
                          <motion.span 
                            className="text-blue-800 font-semibold"
                            animate={{ scale: totalPhotos > 0 ? [1, 1.05, 1] : 1 }}
                            transition={{ duration: 0.5, ease: "easeInOut", delay: 0.1 }}
                          >
                            {totalPhotos}
                          </motion.span>
                          <span className="text-blue-600 text-xs">photos</span>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
                  </CardTitle>
                </CardHeader>
              </motion.div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ 
                      duration: 0.3, 
                      ease: "easeInOut",
                      opacity: { duration: 0.2 }
                    }}
                  >
                    <CardContent>
                {/* Client Search Input */}
                <div className="mb-4 flex items-center gap-2">
                  <motion.div 
                    className="relative flex-1"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <motion.div
                      animate={{ 
                        scale: weekSearchTerms[weekKey] ? 1.1 : 1,
                        color: weekSearchTerms[weekKey] ? "#3b82f6" : "#9ca3af"
                      }}
                      transition={{ duration: 0.2 }}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                    >
                      <Search className="h-4 w-4" />
                    </motion.div>
                    <Input
                      placeholder="Search clients or retouchers in this week..."
                      value={weekSearchTerms[weekKey] || ''}
                      onChange={(e) => setWeekSearchTerms(prev => ({
                        ...prev,
                        [weekKey]: e.target.value
                      }))}
                      className="pl-10 pr-10 transition-all duration-200 focus:shadow-lg"
                      data-testid={`search-week-${weekKey}`}
                    />
                    <AnimatePresence>
                      {weekSearchTerms[weekKey] && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 transition-colors duration-200"
                            onClick={() => setWeekSearchTerms(prev => ({
                              ...prev,
                              [weekKey]: ''
                            }))}
                            data-testid={`clear-search-${weekKey}`}
                          >
                            <motion.div
                              whileHover={{ rotate: 90 }}
                              transition={{ duration: 0.2 }}
                            >
                              <X className="h-3 w-3" />
                            </motion.div>
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
                
                {/* Mini Weekly Calendar - only for Admin, LeadRetoucher, and DataWrangler */}
                {['Admin', 'LeadRetoucher', 'DataWrangler'].includes(user.role) && (
                  <div className="mb-6 border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 7 }).map((_, dayIndex) => {
                        const dayDate = new Date(monday);
                        dayDate.setDate(monday.getDate() + dayIndex);
                        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                        const dayNumber = dayDate.getDate();
                        
                        // Get projects due on this specific day and apply search filter
                        const allDayProjects = group.projects.filter(project => {
                          const projectDate = new Date(project.dueDate);
                          return projectDate.toDateString() === dayDate.toDateString();
                        });
                        const dayProjects = filterProjectsBySearch(allDayProjects, weekKey);

                        const getRetoucherPrefix = (assignedTo: string | null) => {
                          // Check if it's a custom user first
                          const customUser = allUsers.find(u => u.name === assignedTo && u.abbr);
                          if (customUser && customUser.abbr) {
                            return customUser.abbr;
                          }
                          // Fall back to default abbreviations
                          return formatRetoucherAbbr(assignedTo);
                        };

                        const getProjectColor = (project: Project, prefix: string) => {
                          // Project type colors (highest priority - override rollover colors)
                          switch (prefix) {
                            case 'EC': return 'bg-black text-white dark:bg-black dark:text-white';
                            case 'ASA': return 'bg-purple-600 text-white dark:bg-purple-600 dark:text-white';
                            case 'LM': return 'bg-blue-600 text-white dark:bg-blue-600 dark:text-white';
                            case 'AP': return 'bg-pink-600 text-white dark:bg-pink-600 dark:text-white';
                            default: break; // Continue to rollover logic for other types
                          }
                          
                          // Rollover colors (if not overridden by project type)
                          const now = new Date();
                          const currentWeek = getWeekStart(now);
                          const previousWeek = new Date(currentWeek);
                          previousWeek.setDate(previousWeek.getDate() - 7);
                          const twoWeeksAgo = new Date(currentWeek);
                          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                          
                          const projectCreatedDate = new Date(project.createdAt);
                          const projectWeek = getWeekStart(projectCreatedDate);
                          
                          // Projects rolled over from two weeks ago or older (rolled over twice) → Red
                          if (projectWeek <= twoWeeksAgo) {
                            return 'bg-red-600 text-white dark:bg-red-600 dark:text-white';
                          }
                          // Projects rolled over from previous week (rolled over once) → Green
                          else if (projectWeek.getTime() === previousWeek.getTime()) {
                            return 'bg-green-600 text-white dark:bg-green-600 dark:text-white';
                          }
                          // Projects added by wrangler for current week (new projects) → Green
                          else if (projectWeek.getTime() === currentWeek.getTime()) {
                            return 'bg-green-600 text-white dark:bg-green-600 dark:text-white';
                          }
                          
                          // Default color for other cases
                          return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
                        };

                        return (
                          <div 
                            key={dayIndex} 
                            className="text-center"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, dayDate)}
                          >
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {dayName}
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              {dayNumber}
                            </div>
                            <div className="space-y-1 min-h-[60px] p-1 rounded transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                              {dayProjects.map(project => {
                                const retoucherPrefix = getRetoucherPrefix(project.assignedTo);
                                const colorClass = getProjectColor(project, retoucherPrefix);
                                const isDragging = draggedProject?.id === project.id;
                        const isLoading = loadingStates[project.id + 'assign'] || loadingStates[project.id + 'move'];
                                
                                return (
                                  <motion.div 
                                    key={project.id} 
                                    className="text-xs"
                                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ 
                                      duration: 0.2, 
                                      delay: project.id.slice(-2).charCodeAt(0) * 0.01,
                                      ease: "easeOut" 
                                    }}
                                    layout
                                  >
                                    <motion.div
                                      draggable
                                      onDragStart={(e) => handleDragStart(e as any, project)}
                                      onDragEnd={handleDragEnd}
                                      onDoubleClick={() => handleDoubleClick(project)}
                                      className="cursor-move relative"
                                      data-testid={`project-badge-${project.id}`}
                                      title="Drag to move to another day, double-click to assign"
                                      whileHover={{ 
                                        scale: 1.02,
                                        y: -2,
                                        transition: { type: "spring", stiffness: 400, damping: 30 }
                                      }}
                                      whileTap={{ scale: 0.98 }}
                                      animate={{ 
                                        opacity: isDragging ? 0.6 : 1,
                                        scale: isDragging ? 0.95 : 1,
                                        rotate: isDragging ? 5 : 0
                                      }}
                                      transition={{ duration: 0.2, ease: "easeInOut" }}
                                    >
                                      <motion.div
                                        animate={isLoading ? {
                                          scale: [1, 1.05, 1],
                                          opacity: [1, 0.8, 1]
                                        } : {}}
                                        transition={{
                                          duration: 1.5,
                                          repeat: isLoading ? Infinity : 0,
                                          ease: "easeInOut"
                                        }}
                                      >
                                        <Badge 
                                          variant="secondary" 
                                          className={`${colorClass} px-1 py-0 text-xs font-medium w-full justify-start hover:shadow-lg transition-all select-none pointer-events-none overflow-hidden relative`}
                                        >
                                          <AnimatePresence>
                                            {isLoading && (
                                              <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                className="mr-1"
                                              >
                                                <LoadingSpinner size={12} />
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                          <motion.span
                                            initial={{ x: isLoading ? 20 : 0 }}
                                            animate={{ x: 0 }}
                                            transition={{ duration: 0.2 }}
                                          >
                                            {retoucherPrefix} {project.clientName}
                                          </motion.span>
                                        </Badge>
                                      </motion.div>
                                    </motion.div>
                                  </motion.div>
                                );
                              })}
                            </div>
                            <AnimatePresence>
                              {dayProjects.length === 0 && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className={`text-xs text-gray-400 dark:text-gray-600 opacity-50 h-[60px] flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 relative overflow-hidden ${
                                    draggedProject ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-inner' : ''
                                  }`}
                                  whileHover={{ 
                                    borderColor: "#3b82f6", 
                                    backgroundColor: "rgba(59, 130, 246, 0.05)",
                                    scale: 1.02
                                  }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <AnimatePresence>
                                    {draggedProject && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ 
                                          opacity: 1, 
                                          y: 0,
                                          rotate: [0, -5, 5, 0]
                                        }}
                                        exit={{ opacity: 0, y: 10 }}
                                        transition={{ 
                                          duration: 0.3,
                                          rotate: { repeat: Infinity, duration: 2, ease: "easeInOut" }
                                        }}
                                        className="text-blue-500 mr-2 text-lg"
                                      >
                                        ⭳
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                  <motion.span
                                    animate={draggedProject ? { 
                                      scale: [1, 1.05, 1],
                                      color: "#3b82f6"
                                    } : {}}
                                    transition={{ 
                                      duration: 1.5, 
                                      repeat: draggedProject ? Infinity : 0,
                                      ease: "easeInOut"
                                    }}
                                  >
                                    Drop here
                                  </motion.span>
                                  {/* Animated background effect when dragging */}
                                  {draggedProject && (
                                    <motion.div
                                      className="absolute inset-0 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 opacity-30"
                                      animate={{
                                        backgroundPosition: ["0% 0%", "100% 100%"],
                                      }}
                                      transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        repeatType: "reverse",
                                        ease: "linear"
                                      }}
                                    />
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {user.role === 'Sales' ? (
                        <>
                          <TableHead>Pkg</TableHead>
                          <TableHead>Actions</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Sel</TableHead>
                          <TableHead>To Edit</TableHead>
                          <TableHead>Extra</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Retoucher</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Notes</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Client</TableHead>
                          <TableHead>To Edit</TableHead>
                          <TableHead>Done</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Retoucher</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterProjectsBySearch(group.projects, weekKey).map(project => (
                      <TableRow key={project.id} className={project.isRolloverShadow ? 'opacity-50' : ''} style={project.isRolloverShadow ? { opacity: 0.5 } : {}}>
                        {user.role === 'Sales' ? (
                          <>
                            {/* Pkg column first for Sales */}
                            <TableCell>
                              <input
                                type="number"
                                value={localInputValues[project.id]?.packageCount ?? project.packageCount}
                                onChange={(e) => handleChangePackageCount(project.id, parseInt(e.target.value) || 0)}
                                className="border rounded px-2 py-1 w-16 text-center bg-white dark:bg-gray-800"
                                min="0"
                                placeholder="0"
                              />
                            </TableCell>
                            {/* Actions column second for Sales */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {/* Status-specific actions for Sales */}
                                {project.status === 'Awaiting Payment' && (
                                  <Button
                                    onClick={() => handleMarkPaid(project.id)}
                                    variant="outline"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700"
                                    data-testid={`button-mark-paid-${project.id}`}
                                    disabled={loadingStates[project.id + 'mark-paid']}
                                  >
                                    {loadingStates[project.id + 'mark-paid'] ? (
                                      <LoadingSpinner size={14} className="mr-2" />
                                    ) : null}
                                    Mark Paid
                                  </Button>
                                )}
                                {project.status === 'Review' && (
                                  <Button
                                    onClick={() => handleDeliver(project.id)}
                                    variant="outline"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-700"
                                    data-testid={`button-deliver-${project.id}`}
                                    disabled={loadingStates[project.id + 'deliver']}
                                  >
                                    {loadingStates[project.id + 'deliver'] ? (
                                      <LoadingSpinner size={14} className="mr-2" />
                                    ) : null}
                                    Deliver
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            {/* Client column third for Sales */}
                            <TableCell className="font-medium">{formatClientDisplay(project)}</TableCell>
                          </>
                        ) : (
                          <>
                            {/* Standard order for other roles */}
                            <TableCell className="font-medium">{formatClientDisplay(project)}</TableCell>
                          </>
                        )}
                        {/* Continue Sales role cells */}
                        {user.role === 'Sales' ? (
                          <>
                            {/* Sel, Extra, Due, Retoucher, Status, Rating, Notes for Sales */}
                            <TableCell>
                              <input
                                type="number"
                                value={localInputValues[project.id]?.selectedCount ?? project.selectedCount}
                                onChange={(e) => handleChangeSelectedCount(project.id, parseInt(e.target.value) || 0)}
                                className="border rounded px-2 py-1 w-16 text-center bg-white dark:bg-gray-800"
                                min="0"
                                placeholder="0"
                              />
                            </TableCell>
                            {/* To Edit column for Sales */}
                            <TableCell>
                              <span className="text-sm font-medium text-purple-600">
                                {project.toEditRemaining || project.selectedCount}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <input
                                  type="number"
                                  value={localInputValues[project.id]?.extras ?? project.extras}
                                  onChange={(e) => handleChangeExtras(project.id, parseInt(e.target.value) || 0)}
                                  className="border rounded px-2 py-1 w-16 text-center bg-white dark:bg-gray-800"
                                  min="0"
                                  placeholder="0"
                                />
                                {project.extraPhotoPrice && project.extras > 0 && (
                                  <div className="text-xs text-green-600 font-medium">
                                    R{((project.extraPhotoPrice / 100) * project.extras).toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <input
                                type="date"
                                value={new Date(project.dueDate).toISOString().slice(0, 10)}
                                onChange={(e) => handleChangeDueDate(project.id, new Date(e.target.value))}
                                className="border rounded px-2 py-1"
                                min="2024-01-01"
                                max="2030-12-31"
                              />
                            </TableCell>
                            <TableCell>
                              {allUsers.find(u => u.name === project.assignedTo && u.id)?.name || 
                               getRetoucherFullName(project.assignedTo)}
                            </TableCell>
                            <TableCell>{getStatusBadge(project.status)}</TableCell>
                            <TableCell>
                              {project.status === 'Review' ? (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
                                      data-testid={`button-request-corrections-${project.id}`}
                                    >
                                      <AlertTriangle className="h-4 w-4 mr-1" />
                                      Request Corrections
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Request Corrections</DialogTitle>
                                      <DialogDescription>
                                        Request corrections for {project.clientName}'s project. Describe what needs to be fixed.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={(e) => handleRequestCorrections(e, project.id)}>
                                      <div className="space-y-4">
                                        <div>
                                          <label htmlFor="corrections-note" className="block text-sm font-medium mb-2">
                                            Corrections needed (optional)
                                          </label>
                                          <Textarea
                                            id="corrections-note"
                                            placeholder="Describe what needs to be corrected..."
                                            className="min-h-[100px]"
                                            name="note"
                                          />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                          <DialogClose asChild>
                                            <Button type="button" variant="outline">Cancel</Button>
                                          </DialogClose>
                                          <Button 
                                            type="submit" 
                                            className="bg-orange-600 hover:bg-orange-700"
                                            disabled={loadingStates[project.id + 'corrections']}
                                          >
                                            {loadingStates[project.id + 'corrections'] ? (
                                              <LoadingSpinner size={14} className="mr-2" />
                                            ) : null}
                                            Request Corrections
                                          </Button>
                                        </div>
                                      </div>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                              ) : project.status === 'Corrections' ? (
                                <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  In Corrections
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <ErrorBoundary fallback={<div className="text-sm text-gray-500">Notes unavailable</div>}>
                                <ProjectNotes 
                                  projectId={project.id} 
                                  userRole={user.role} 
                                  hasNotes={(allNotesQuery.data?.[project.id] || 0) > 0}
                                />
                              </ErrorBoundary>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            {/* Standard cells for other roles */}
                            {/* To Edit column for non-Sales */}
                            <TableCell>
                              <span className="text-sm font-medium text-purple-600">
                                {project.toEditRemaining || project.selectedCount}
                              </span>
                            </TableCell>
                            {/* Done photos column for non-Sales */}
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => updatePhotosCompleted(project.id, Math.max(0, (project.photosCompleted || 0) - 1))}
                                  className="text-red-500 hover:text-red-700 text-xs px-1"
                                  disabled={!project.photosCompleted}
                                  data-testid={`button-decrease-completed-${project.id}`}
                                >
                                  -
                                </button>
                                <span 
                                  className="text-sm font-medium text-green-600 min-w-[20px] text-center cursor-pointer"
                                  onClick={() => updatePhotosCompleted(project.id, (project.photosCompleted || 0) + 1)}
                                  data-testid={`text-completed-count-${project.id}`}
                                >
                                  {project.photosCompleted || 0}
                                </span>
                                <button
                                  onClick={() => updatePhotosCompleted(project.id, (project.photosCompleted || 0) + 1)}
                                  className="text-green-500 hover:text-green-700 text-xs px-1"
                                  data-testid={`button-increase-completed-${project.id}`}
                                >
                                  +
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(user.role === 'Retoucher' || ['Retoucher1', 'Retoucher2', 'Retoucher3'].includes(user.role)) ? (
                                <span 
                                  style={{
                                    backgroundColor: '#cce5ff',
                                    color: '#004085',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontWeight: 'bold',
                                    display: 'inline-block'
                                  }}
                                >
                                  {new Intl.DateTimeFormat('en-ZA', { 
                                    weekday: 'long', 
                                    day: 'numeric', 
                                    month: 'long', 
                                    year: 'numeric' 
                                  }).format(new Date(project.dueDate))}
                                </span>
                              ) : (user.role === 'Admin' || user.role === 'Sales' || user.role === 'DataWrangler' || user.role === 'LeadRetoucher') ? (
                                <input
                                  type="date"
                                  value={new Date(project.dueDate).toISOString().slice(0, 10)}
                                  onChange={(e) => handleChangeDueDate(project.id, new Date(e.target.value))}
                                  className="border rounded px-2 py-1"
                                  min="2024-01-01"
                                  max="2030-12-31"
                                />
                              ) : (
                                formatDate(new Date(project.dueDate))
                              )}
                            </TableCell>
                            <TableCell>
                              {allUsers.find(u => u.name === project.assignedTo && u.id)?.name || 
                               getRetoucherFullName(project.assignedTo)}
                            </TableCell>
                            <TableCell>{getStatusBadge(project.status)}</TableCell>
                            <TableCell>
                              <ErrorBoundary fallback={<div className="text-sm text-gray-500">Notes unavailable</div>}>
                                <ProjectNotes 
                                  projectId={project.id} 
                                  userRole={user.role} 
                                  hasNotes={(allNotesQuery.data?.[project.id] || 0) > 0}
                                />
                              </ErrorBoundary>
                            </TableCell>
                          </>
                        )}
                        {/* Actions column - only for non-Sales roles */}
                        {user.role !== 'Sales' && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {/* Lead Retoucher, Admin, or Sales can assign tasks */}
                              {(user.role === 'LeadRetoucher' || user.role === 'Admin' || user.role === 'Sales') 
                                && (project.status === 'Ready for Retouching' || project.status === 'Assigned') && (
                                <Select
                                  value={project.assignedTo || ""}
                                  onValueChange={(value) => handleAssign(project.id, value)}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue placeholder={project.assignedTo ? "Reassign to..." : "Assign to..."} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {/* Unassign option */}
                                    <SelectItem value="__UNASSIGN__">Unassign</SelectItem>
                                    {/* All retouchers + Admin as retoucher */}
                                    {allUsers
                                      .filter(u => u.role === "Retoucher" || (u.role === "Admin" && u.name === "Anesu's Pops"))
                                      .map(retoucher => (
                                        <SelectItem key={retoucher.value || retoucher.name} value={retoucher.name}>
                                          {retoucher.name}
                                        </SelectItem>
                                      ))
                                    }
                                  </SelectContent>
                                </Select>
                              )}
                              
                              {/* Admin or Sales can mark invoice paid */}
                              {(user.role === 'Admin' || user.role === 'Sales' || user.name === 'Sales') && project.status === 'Awaiting Payment' && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleMarkPaid(project.id)}
                                  disabled={updateProjectMutation.isPending}
                                >
                                  Mark Paid
                                </Button>
                              )}
                              
                              {/* All users with retouching abilities can mark done on projects ready for retouching, assigned, or corrections */}
                              {hasRetouchingAbilities(user.role) && 
                               (project.status === 'Assigned' || project.status === 'Ready for Retouching' || project.status === 'Corrections') && (
                                <>
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleMarkDone(project.id)}
                                    disabled={updateProjectMutation.isPending}
                                    data-testid={`button-mark-done-${project.id}`}
                                    className="bg-gray-600 hover:bg-gray-700 text-white"
                                  >
                                    Mark Done
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
                                        data-testid={`button-rollover-${project.id}`}
                                      >
                                        Rollover
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Rollover Project</DialogTitle>
                                        <DialogDescription>
                                          Enter the number of photos you completed today for {formatClientDisplay(project)}.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <RolloverDialog 
                                        project={project} 
                                        onRollover={handleRollover}
                                        formatClientDisplay={formatClientDisplay}
                                      />
                                    </DialogContent>
                                  </Dialog>
                                </>
                              )}

                              {/* Rollback button for projects with "Rolled Over" status */}
                              {hasRetouchingAbilities(user.role) && project.status === 'Rolled Over' && (
                                <Button 
                                  size="sm" 
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => handleRollback(project.id)}
                                  disabled={rollbackMutation.isPending}
                                  data-testid={`button-rollback-${project.id}`}
                                >
                                  {rollbackMutation.isPending ? 'Rolling Back...' : 'ROLL BACK'}
                                </Button>
                              )}
                              
                              {/* Admin can deliver when in Review */}
                              {user.role === 'Admin' && project.status === 'Review' && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleDeliver(project.id)}
                                  disabled={updateProjectMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Deliver
                                </Button>
                              )}
                              
                              {/* Duplicate button for Admin, Sales, Data Wrangler, and Lead Retoucher (Manager) */}
                              {(['Admin', 'Sales', 'DataWrangler', 'LeadRetoucher'].includes(user.role) || user.name === 'Sales') && (
                                <motion.div
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleDuplicateProject(project.id)}
                                    disabled={duplicateProjectMutation.isPending}
                                    className="ml-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                                  >
                                    <motion.div
                                      animate={{ rotate: duplicateProjectMutation.isPending ? 360 : 0 }}
                                      transition={{ duration: 1, repeat: duplicateProjectMutation.isPending ? Infinity : 0, ease: "linear" }}
                                    >
                                      <Copy className="h-4 w-4 mr-1" />
                                    </motion.div>
                                    {duplicateProjectMutation.isPending ? "Duplicating..." : "Duplicate"}
                                  </Button>
                                </motion.div>
                              )}

                              {/* Delete button for Admin and Lead Retoucher */}
                              {['Admin', 'LeadRetoucher'].includes(user.role) && (
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleDeleteProject(project.id)}
                                  disabled={updateProjectMutation.isPending || deleteProjectMutation.isPending}
                                  className="ml-2"
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        );
      })}
      
      {/* Assignment Modal */}
      <AnimatePresence>
        {assignProject && (
          <motion.div 
            className="fixed inset-0 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div 
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAssignProject(null)}
            />
            
            {/* Modal */}
            <motion.div 
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 min-w-[250px] border border-gray-200 dark:border-gray-600"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <motion.h3 
                className="font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  👤
                </motion.span>
                Assign Project: {assignProject.clientName}
                <AnimatePresence>
                  {loadingStates[assignProject.id + 'assign'] && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <LoadingSpinner size={16} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.h3>
              
              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <FloatingAction className="w-full">
                  <Button
                    variant="outline"
                    className="w-full justify-start group transition-all duration-200 hover:shadow-md hover:border-blue-300"
                    onClick={() => handleAssignProject(null)}
                    data-testid="assign-unassigned"
                    disabled={loadingStates[assignProject.id + 'assign']}
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <UserPlus className="w-4 h-4 mr-2 group-hover:text-blue-500" />
                    </motion.div>
                    Unassigned
                  </Button>
                </FloatingAction>
                
                <StaggeredList>
                  {allUsers
                    .filter(u => hasRetouchingAbilities(u.role))
                    .map((retoucher, index) => (
                      <FloatingAction key={`retoucher-${retoucher.id}-${index}`} className="w-full">
                        <Button
                          variant="outline"
                          className="w-full justify-start group transition-all duration-200 hover:shadow-md hover:border-green-300"
                          onClick={() => handleAssignProject(retoucher.name)}
                          data-testid={`assign-${retoucher.name}`}
                          disabled={loadingStates[assignProject.id + 'assign']}
                        >
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            transition={{ duration: 0.2 }}
                          >
                            <UserPlus className="w-4 h-4 mr-2 group-hover:text-green-500" />
                          </motion.div>
                          {getRetoucherFullName(retoucher.name)}
                        </Button>
                      </FloatingAction>
                    ))
                  }
                </StaggeredList>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="pt-3 border-t border-gray-200 dark:border-gray-700"
                >
                  <FloatingAction>
                    <Button
                      variant="ghost"
                      className="w-full hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
                      onClick={() => setAssignProject(null)}
                      disabled={loadingStates[assignProject.id + 'assign']}
                    >
                      Cancel
                    </Button>
                  </FloatingAction>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Corrections Modal */}
      <AnimatePresence>
        {correctionsProject && (
          <motion.div 
            className="fixed inset-0 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div 
              className="absolute inset-0 bg-black/20 dark:bg-black/40"
              onClick={() => setCorrectionsProject(null)}
            />
            
            {/* Modal */}
            <motion.div
              className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.h3 
                className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Request Corrections
              </motion.h3>
              
              <motion.p 
                className="text-gray-600 dark:text-gray-400 mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                Request corrections for <strong>{correctionsProject.clientName}</strong>
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Corrections Note (Optional)
                </label>
                <textarea
                  value={correctionsNote}
                  onChange={(e) => setCorrectionsNote(e.target.value)}
                  placeholder="Describe what needs to be corrected..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={4}
                  data-testid="corrections-note-input"
                />
              </motion.div>
              
              <motion.div
                className="flex justify-end gap-3 mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                <Button
                  variant="outline"
                  onClick={() => {
                    setCorrectionsProject(null);
                    setCorrectionsNote("");
                  }}
                  disabled={updateProjectMutation.isPending}
                  data-testid="cancel-corrections"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleRequestCorrections(correctionsProject.id, correctionsNote)}
                  disabled={updateProjectMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700"
                  data-testid="confirm-corrections"
                >
                  {updateProjectMutation.isPending ? "Requesting..." : "Request Corrections"}
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// RolloverDialog component for handling rollover input
interface RolloverDialogProps {
  project: any;
  onRollover: (projectId: string, photosCompleted: number) => void;
  formatClientDisplay: (project: any) => string;
}

function RolloverDialog({ project, onRollover, formatClientDisplay }: RolloverDialogProps) {
  const [photosCompleted, setPhotosCompleted] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const currentRemaining = project.toEditRemaining || project.selectedCount;
  
  const handleSubmit = async () => {
    if (photosCompleted < 0) {
      return; // Validation already handled by input
    }
    
    if (photosCompleted > currentRemaining) {
      return; // Validation already handled by input
    }
    
    setIsSubmitting(true);
    try {
      await onRollover(project.id, photosCompleted);
      setPhotosCompleted(0); // Reset form
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="photos-completed">Photos completed today</Label>
        <Input
          id="photos-completed"
          type="number"
          min="0"
          max={currentRemaining}
          value={photosCompleted}
          onChange={(e) => setPhotosCompleted(parseInt(e.target.value) || 0)}
          placeholder="Enter number of photos completed"
          className="w-full"
        />
        <p className="text-sm text-gray-600">
          Maximum: {currentRemaining} photos remaining to edit
        </p>
      </div>
      
      <div className="bg-gray-50 p-3 rounded-md">
        <p className="text-sm">
          <strong>Project:</strong> {formatClientDisplay(project)}
        </p>
        <p className="text-sm">
          <strong>Package photos:</strong> {project.packageCount}
        </p>
        <p className="text-sm">
          <strong>Selected photos:</strong> {project.selectedCount}
        </p>
        <p className="text-sm">
          <strong>To edit remaining:</strong> {currentRemaining}
        </p>
      </div>
      
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button variant="outline" disabled={isSubmitting}>
            Cancel
          </Button>
        </DialogClose>
        <DialogClose asChild>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || photosCompleted <= 0 || photosCompleted > currentRemaining}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size={14} className="mr-2" />
                Rolling over...
              </>
            ) : (
              'Rollover'
            )}
          </Button>
        </DialogClose>
      </div>
    </div>
  );
}
