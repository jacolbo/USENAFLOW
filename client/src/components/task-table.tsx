import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { ProjectNotes } from "./project-notes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@shared/schema";
import { User, formatRetoucherAbbr, getRetoucherFullName } from "@/lib/types";
import { Calendar, Star, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useState, useMemo, useCallback, useRef } from "react";
import { DailyQuote } from "./daily-quote";
import { ProjectEditDialog } from "./project-edit-dialog";

interface TaskTableProps {
  projects: Project[];
  user: User;
  allUsers: User[];
}

export function TaskTable({ projects, user, allUsers }: TaskTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Local state for input values to ensure smooth typing
  const [localInputValues, setLocalInputValues] = useState<Record<string, {
    packageCount?: number;
    selectedCount?: number;
    extras?: number;
  }>>({});
  
  // Debounce timeouts
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Dialog state for editing projects
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Drag and drop state
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);

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

  // Helper function to get week start
  const getWeekStart = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    // Ensure valid year range
    if (d.getFullYear() < 2024) {
      d.setFullYear(2024);
    }
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = day === 0 ? -6 : 1 - day; // adjust Sunday to previous Monday
    d.setDate(d.getDate() + diff);
    return d;
  };

  // State for collapsed weeks
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
    
    return initialState;
  });

  const toggleWeek = (weekKey: string) => {
    setCollapsedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  const formatWeekRange = (weekStart: Date) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };



  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, endpoint, data }: { id: string; endpoint: string; data?: any }) => {
      const response = await apiRequest("PATCH", `/api/projects/${id}/${endpoint}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: () => {
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
      "Delivered": { variant: "secondary" as const, className: "bg-green-500 text-white hover:bg-green-600" },
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
      data: { assignedTo: retoucherName },
    });
  };

  const handleMarkPaid = (projectId: string) => {
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

  const handleRequestRevision = (projectId: string) => {
    updateProjectMutation.mutate({
      id: projectId,
      endpoint: "request-revision",
    });
  };

  const handleDeliver = (projectId: string) => {
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
      
      // Clear local state after successful update
      setLocalInputValues(prev => {
        const updated = { ...prev };
        if (updated[projectId]) {
          delete updated[projectId].selectedCount;
          if (Object.keys(updated[projectId]).length === 0) {
            delete updated[projectId];
          }
        }
        return updated;
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
      
      // Clear local state after successful update
      setLocalInputValues(prev => {
        const updated = { ...prev };
        if (updated[projectId]) {
          delete updated[projectId].packageCount;
          if (Object.keys(updated[projectId]).length === 0) {
            delete updated[projectId];
          }
        }
        return updated;
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
      
      // Clear local state after successful update
      setLocalInputValues(prev => {
        const updated = { ...prev };
        if (updated[projectId]) {
          delete updated[projectId].extras;
          if (Object.keys(updated[projectId]).length === 0) {
            delete updated[projectId];
          }
        }
        return updated;
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

  // Mutation for updating project due dates
  const updateProjectDueDateMutation = useMutation({
    mutationFn: async ({ projectId, newDueDate }: { projectId: string; newDueDate: string }) => {
      console.log("Updating project due date:", { projectId, newDueDate });
      const response = await apiRequest("PATCH", `/api/projects/${projectId}`, { dueDate: newDueDate });
      return response;
    },
    onSuccess: (data) => {
      console.log("Due date update successful:", data);
      // Force a refetch of projects
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.refetchQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Due date updated",
        description: "Project moved to new date successfully.",
      });
    },
    onError: (error) => {
      console.error("Due date update failed:", error);
      toast({
        title: "Error",
        description: "Failed to update due date. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Double-click handler for editing projects
  const handleProjectDoubleClick = (project: Project) => {
    setEditingProject(project);
    setIsEditDialogOpen(true);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, project: Project) => {
    setDraggedProject(project);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", project.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    if (draggedProject) {
      const newDueDate = targetDate.toISOString().split('T')[0];
      updateProjectDueDateMutation.mutate({
        projectId: draggedProject.id,
        newDueDate,
      });
      setDraggedProject(null);
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

  // Re-group the filtered projects
  const visibleGroups: { key: number; weekStart: Date; projects: Project[] }[] = [];
  visibleProjects.forEach(project => {
    const weekStart = getWeekStart(new Date(project.dueDate));
    const key = weekStart.getTime();
    let group = visibleGroups.find(g => g.key === key);
    if (!group) {
      group = { key: key, weekStart: weekStart, projects: [] };
      visibleGroups.push(group);
    }
    group.projects.push(project);
  });

  visibleGroups.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  return (
    <div className="space-y-8">
      {/* Daily Quote */}
      <DailyQuote userId={user.name} className="mb-6" />
      
      {visibleGroups.map(group => {
        const monday = group.weekStart;
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const weekLabel = formatWeekRange(monday);
        const weekKey = monday.toISOString().split('T')[0];
        const isCollapsed = collapsedWeeks[weekKey];
        
        // Sort projects in each week by due date, then by ID for stability
        group.projects.sort((a, b) => {
          const dateComparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          if (dateComparison !== 0) return dateComparison;
          return a.id.localeCompare(b.id); // Secondary sort by ID for stability
        });
        
        return (
          <Card key={group.key}>
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => toggleWeek(weekKey)}
            >
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-600" />
                  )}
                  <Calendar className="h-5 w-5 text-gray-600" />
                  Week of {weekLabel}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>📅 ({group.projects.length} projects)</span>
                </div>
              </CardTitle>
            </CardHeader>
            {!isCollapsed && (
              <CardContent>
                {/* Mini Weekly Calendar - only for Admin, LeadRetoucher, and DataWrangler */}
                {['Admin', 'LeadRetoucher', 'DataWrangler'].includes(user.role) && (
                  <div className="mb-6 border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 7 }).map((_, dayIndex) => {
                        const dayDate = new Date(monday);
                        dayDate.setDate(monday.getDate() + dayIndex);
                        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                        const dayNumber = dayDate.getDate();
                        
                        // Get projects due on this specific day
                        const dayProjects = group.projects.filter(project => {
                          const projectDate = new Date(project.dueDate);
                          return projectDate.toDateString() === dayDate.toDateString();
                        });

                        const getRetoucherPrefix = (assignedTo: string | null) => {
                          // Check if it's a custom user first
                          const customUser = allUsers.find(u => u.name === assignedTo && u.abbr);
                          if (customUser && customUser.abbr) {
                            return customUser.abbr;
                          }
                          // Fall back to default abbreviations
                          return formatRetoucherAbbr(assignedTo);
                        };

                        const getRetoucherColor = (prefix: string) => {
                          switch (prefix) {
                            case 'EC': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
                            case 'ASA': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
                            case 'LM': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
                            case 'E.M': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
                            default: return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'; // Custom users get indigo
                          }
                        };

                        return (
                          <div 
                            key={dayIndex} 
                            className="text-center min-h-[120px] p-2 border-2 border-dashed border-transparent hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, dayDate)}
                          >
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {dayName}
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              {dayNumber}
                            </div>
                            <div className="space-y-1">
                              {dayProjects.map(project => {
                                const retoucherPrefix = getRetoucherPrefix(project.assignedTo);
                                const colorClass = getRetoucherColor(retoucherPrefix);
                                
                                return (
                                  <div key={project.id} className="text-xs">
                                    <Badge 
                                      variant="secondary" 
                                      className={`${colorClass} px-1 py-0 text-xs font-medium w-full justify-start cursor-pointer hover:opacity-80 transition-opacity`}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, project)}
                                      onDoubleClick={() => handleProjectDoubleClick(project)}
                                      title="Double-click to edit or drag to move"
                                    >
                                      {retoucherPrefix} {project.clientName}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                            {dayProjects.length === 0 && (
                              <div className="text-xs text-gray-400 dark:text-gray-600 opacity-50 mt-4">
                                Drop here
                              </div>
                            )}
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
                      <TableHead>Client</TableHead>
                      <TableHead>Pkg</TableHead>
                      <TableHead>Sel</TableHead>
                      <TableHead>Extra</TableHead>

                      <TableHead>Due</TableHead>
                      <TableHead>Retoucher</TableHead>
                      <TableHead>Status</TableHead>
                      {(user.role === 'Admin' || user.role === 'Sales') && <TableHead>Rating</TableHead>}
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.projects.map(project => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.clientName}</TableCell>
                        <TableCell>
                          {['Admin', 'Sales', 'DataWrangler', 'LeadRetoucher'].includes(user.role) ? (
                            <input
                              type="number"
                              value={localInputValues[project.id]?.packageCount ?? project.packageCount}
                              onChange={(e) => handleChangePackageCount(project.id, parseInt(e.target.value) || 0)}
                              className="border rounded px-2 py-1 w-16 text-center bg-white dark:bg-gray-800"
                              min="0"
                              placeholder="0"
                            />
                          ) : (
                            project.packageCount
                          )}
                        </TableCell>
                        <TableCell>
                          {['Admin', 'Sales', 'DataWrangler', 'LeadRetoucher'].includes(user.role) ? (
                            <input
                              type="number"
                              value={localInputValues[project.id]?.selectedCount ?? project.selectedCount}
                              onChange={(e) => handleChangeSelectedCount(project.id, parseInt(e.target.value) || 0)}
                              className="border rounded px-2 py-1 w-16 text-center bg-white dark:bg-gray-800"
                              min="0"
                              placeholder="0"
                            />
                          ) : (
                            project.selectedCount
                          )}
                        </TableCell>
                        <TableCell>
                          {['Admin', 'Sales', 'DataWrangler', 'LeadRetoucher'].includes(user.role) ? (
                            <input
                              type="number"
                              value={localInputValues[project.id]?.extras ?? project.extras}
                              onChange={(e) => handleChangeExtras(project.id, parseInt(e.target.value) || 0)}
                              className="border rounded px-2 py-1 w-16 text-center bg-white dark:bg-gray-800"
                              min="0"
                              placeholder="0"
                            />
                          ) : (
                            project.extras
                          )}
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
                          {/* Check if it's a custom user, otherwise use the helper function */}
                          {allUsers.find(u => u.name === project.assignedTo && u.id)?.name || 
                           getRetoucherFullName(project.assignedTo)}
                        </TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        {(user.role === 'Admin' || user.role === 'Sales') && (
                          <TableCell>
                            {project.status === "Delivered" ? (
                              <div className="flex items-center gap-2">
                                {project.rating && (
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    <span>{project.rating}</span>
                                  </div>
                                )}
                                <Select
                                  value={project.rating?.toString() || ""}
                                  onValueChange={(value) => handleSetRating(project.id, parseInt(value, 10))}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue placeholder="Rate..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1 – Poor</SelectItem>
                                    <SelectItem value="2">2 – Fair</SelectItem>
                                    <SelectItem value="3">3 – Good</SelectItem>
                                    <SelectItem value="4">4 – Very Good</SelectItem>
                                    <SelectItem value="5">5 – Excellent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              project.rating || "-"
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <ProjectNotes 
                            projectId={project.id} 
                            userRole={user.role} 
                            hasNotes={(allNotesQuery.data?.[project.id] || 0) > 0}
                          />
                        </TableCell>
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
                                  {/* All retouchers + Admin as retoucher */}
                                  {allUsers
                                    .filter(u => u.role === "Retoucher" || (u.role === "Admin" && u.name === "Evans Abreation E.M"))
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
                            {(user.role === 'Admin' || user.role === 'Sales') && project.status === 'Awaiting Payment' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleMarkPaid(project.id)}
                                disabled={updateProjectMutation.isPending}
                              >
                                Mark Paid
                              </Button>
                            )}
                            
                            {/* Retoucher can mark done on their assigned task */}
                            {user.role === 'Retoucher' && 
                             project.assignedTo && 
                             project.assignedTo.toLowerCase() === user.name.toLowerCase() && 
                             project.status === 'Assigned' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleMarkDone(project.id)}
                                disabled={updateProjectMutation.isPending}
                              >
                                Mark Done
                              </Button>
                            )}
                            
                            {/* Admin or Sales can deliver or request revision when in Review */}
                            {(user.role === 'Admin' || user.role === 'Sales') && project.status === 'Review' && (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleDeliver(project.id)}
                                  disabled={updateProjectMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Deliver
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleRequestRevision(project.id)}
                                  disabled={updateProjectMutation.isPending}
                                >
                                  Revision
                                </Button>
                              </>
                            )}
                            
                            {/* Duplicate button for Admin, Sales, Data Wrangler */}
                            {['Admin', 'Sales', 'DataWrangler'].includes(user.role) && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDuplicateProject(project.id)}
                                disabled={duplicateProjectMutation.isPending}
                                className="ml-2"
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Duplicate
                              </Button>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Project Edit Dialog */}
      <ProjectEditDialog
        project={editingProject}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        allUsers={allUsers}
        userRole={user.role}
      />
    </div>
  );
}
