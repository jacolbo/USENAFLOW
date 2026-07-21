import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { ProjectNotes } from "./project-notes";
import { InsposButton } from "./inspos-panel";
import { ErrorBoundary } from "./ErrorBoundary";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@shared/schema";
import { User, formatRetoucherAbbr, getRetoucherFullName } from "@/lib/types";
import { Calendar, Star, ChevronDown, ChevronRight, Copy, UserPlus, Search, X, Camera, Link, Send, CheckCircle, ExternalLink, Eye, Trash2, Image, Gift, Shield, ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner, FloatingAction, StaggeredList } from './LoadingStates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { ObjectUploader } from './ObjectUploader';
import { RiskBadge, RiskDot } from './risk-badge';
import type { UploadResult } from '@uppy/core';


interface TaskTableProps {
  projects: Project[];
  user: User;
  allUsers: User[];
  isPersonalView?: boolean;
  reverseSort?: boolean;
}

export function TaskTable({ projects, user, allUsers, isPersonalView = false, reverseSort = false }: TaskTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Helper function to check if user has retouching abilities
  const hasRetouchingAbilities = (userRole: string) => {
    return ['Admin', 'LeadRetoucher', 'Retoucher1', 'Retoucher2', 'Retoucher3', 'Retoucher'].includes(userRole);
  };
  
  // Fetch complaints for all projects to show report button status
  const { data: complaints = [] } = useQuery({
    queryKey: ['/api/complaints'],
    enabled: hasRetouchingAbilities(user.role),
  });
  
  // Helper function to get complaint status for a project
  const getProjectComplaintStatus = (projectId: string) => {
    if (!complaints || !Array.isArray(complaints) || complaints.length === 0) return 'none';
    
    const projectComplaints = complaints.filter((complaint: any) => complaint.projectId === projectId);
    if (projectComplaints.length === 0) return 'none';
    
    // Check if there are any resolved complaints
    const hasResolved = projectComplaints.some((complaint: any) => complaint.status === 'resolved');
    if (hasResolved) return 'resolved';
    
    // Check if there are any pending/in-progress complaints
    const hasPending = projectComplaints.some((complaint: any) => 
      complaint.status === 'pending' || complaint.status === 'in_progress'
    );
    if (hasPending) return 'reported';
    
    return 'none';
  };
  
  // Helper function to get report button styling based on complaint status
  const getReportButtonStyling = (projectId: string) => {
    const status = getProjectComplaintStatus(projectId);
    
    switch (status) {
      case 'resolved':
        return {
          className: "text-green-600 hover:text-green-700 border-green-300 hover:border-green-400 bg-green-50 hover:bg-green-100",
          text: "Issue Resolved"
        };
      case 'reported':
        return {
          className: "text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400 bg-orange-50 hover:bg-orange-100",
          text: "Issue Reported"
        };
      default:
        return {
          className: "text-gray-600 hover:text-gray-700 border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100",
          text: "Report Issue"
        };
    }
  };
  
  // State for corrections modal
  const [correctionsProject, setCorrectionsProject] = useState<Project | null>(null);
  const [correctionsNote, setCorrectionsNote] = useState("");
  
  // State for drag and drop
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [assignProject, setAssignProject] = useState<Project | null>(null);

  // Reschedule confirmation modal
  const [rescheduleModal, setRescheduleModal] = useState<{ project: Project; targetDate: Date } | null>(null);

  // Expanded calendar day pills (key = `${weekKey}-${dayIndex}`)
  const [expandedCalendarDays, setExpandedCalendarDays] = useState<Set<string>>(new Set());
  
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

  const canApplyBonusPhotos = ['Admin', 'Sales', 'DataWrangler'].includes(user.role);

  const uniqueClientEmails = useMemo(() => {
    const emails = new Set<string>();
    projects.forEach(p => { if (p.clientEmail) emails.add(p.clientEmail); });
    return Array.from(emails);
  }, [projects]);

  const { data: clientBonusMap = {} } = useQuery<Record<string, { bonusPhotos: number; bonusPhotosUsed: number; available: number }>>({
    queryKey: ['/api/client-bonus-batch'],
    queryFn: async () => {
      const result: Record<string, { bonusPhotos: number; bonusPhotosUsed: number; available: number }> = {};
      await Promise.all(
        uniqueClientEmails.map(async (email) => {
          try {
            const response = await fetch(`/api/client-bonus/${encodeURIComponent(email)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.available > 0) {
                result[email] = data;
              }
            }
          } catch {}
        })
      );
      return result;
    },
    enabled: uniqueClientEmails.length > 0,
  });

  const [bonusPhotoProject, setBonusPhotoProject] = useState<Project | null>(null);
  const [bonusPhotoCount, setBonusPhotoCount] = useState(1);

  const applyBonusPhotosMutation = useMutation({
    mutationFn: async ({ projectId, photos }: { projectId: string; photos: number }) => {
      const response = await fetch(`/api/projects/${projectId}/apply-bonus-photos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Usena-Role": user.role,
          "X-Usena-User-Id": String(user.id),
        },
        body: JSON.stringify({ photos }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to apply bonus photos");
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Bonus Photos Applied!",
        description: `${bonusPhotoCount} bonus photo(s) applied. ${result.remaining} remaining.`,
      });
      setBonusPhotoProject(null);
      setBonusPhotoCount(1);
      queryClient.invalidateQueries({ queryKey: ['/api/client-bonus-batch'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply bonus photos",
        variant: "destructive",
      });
    },
  });

  const getBonusIndicator = (project: any) => {
    if (!project.clientEmail || !clientBonusMap[project.clientEmail]) return null;
    const bonus = clientBonusMap[project.clientEmail];
    return bonus;
  };

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
  groups.sort((a, b) => {
    const diff = a.weekStart.getTime() - b.weekStart.getTime();
    return reverseSort ? -diff : diff;
  });

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

  const formatClientDisplay = (project: any) => {
    const name = project.isRolloverShadow ? `${project.clientName} (RO)` : project.clientName;
    const bonus = getBonusIndicator(project);
    const is2025DataIssue = project.dueDate &&
      new Date(project.dueDate).getFullYear() === 2025 &&
      project.status !== "Delivered" &&
      project.status !== "Done";
    
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        {name}
        {bonus && (
          <span
            className="inline-flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0 rounded-full text-[10px] font-semibold"
            title={`${bonus.available} bonus photo(s) available from referral rewards`}
          >
            <Gift className="h-3 w-3" />
            {bonus.available}
          </span>
        )}
        {is2025DataIssue && (
          <span
            className="inline-flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-1.5 py-0 rounded text-[10px] font-semibold"
            title="This 2025 project is still showing as undelivered — please check the data"
          >
            ⚠ 2025 — data issue
          </span>
        )}
      </span>
    );
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

  const reportIssueMutation = useMutation({
    mutationFn: async (data: { projectId: string; issueDescription: string; requestedDueDate: string; reportedBy: string; imageUrls?: string[] }) => {
      const response = await apiRequest("POST", "/api/complaints", data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate complaints query to update button status
      queryClient.invalidateQueries({ queryKey: ['/api/complaints'] });
      toast({
        title: "Issue Reported",
        description: "Your issue has been reported to Evans for resolution.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Report Failed",
        description: error.message || "Failed to report the issue. Please try again.",
        variant: "destructive",
      });
    }
  });

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

  const galleryLinkMutation = useMutation({
    mutationFn: async ({ projectId, galleryLink, addedBy }: { projectId: string; galleryLink: string; addedBy: string }) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/gallery-link`, { galleryLink, addedBy });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Gallery Link Added",
        description: "The gallery link has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save gallery link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const approveDeliveryMutation = useMutation({
    mutationFn: async ({ projectId, approvedBy }: { projectId: string; approvedBy: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/approve-delivery`, { approvedBy });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Delivery Approved!",
        description: "The gallery has been delivered and the client has been notified via email.",
      });
    },
    onError: (error: any) => {
      let qualityGateRequired = false;
      try {
        const msg = error?.message || "";
        const jsonPart = msg.substring(msg.indexOf("{"));
        if (jsonPart) {
          const parsed = JSON.parse(jsonPart);
          qualityGateRequired = parsed?.qualityGateRequired === true;
        }
      } catch {}
      if (qualityGateRequired) {
        toast({
          title: "Quality Gate Required",
          description: "Please run the AI quality review before approving delivery.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to approve delivery. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const qualityGateMutation = useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const response = await apiRequest("POST", "/api/ai/quality-gate", { projectId });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (data.passed) {
        toast({
          title: "Quality Gate Passed",
          description: `Score: ${data.overallScore}/10 - Ready for delivery!`,
        });
      } else {
        toast({
          title: "Quality Gate Failed",
          description: `Score: ${data.overallScore}/10 - Review needed before delivery.`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to run quality review. Ensure photos are in the Drive folder.",
        variant: "destructive",
      });
    },
  });

  const qualityGateOverrideMutation = useMutation({
    mutationFn: async ({ projectId, overrideBy }: { projectId: string; overrideBy: string }) => {
      const response = await apiRequest("POST", "/api/ai/quality-gate/override", { projectId, overrideBy });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Quality Gate Overridden",
        description: "Admin has approved delivery despite quality gate concerns.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to override quality gate.",
        variant: "destructive",
      });
    },
  });

  const handleSetRating = (projectId: string, rating: number) => {
    updateProjectMutation.mutate({
      id: projectId,
      endpoint: "rating",
      data: { rating },
    });
  };

  const handleReportIssue = (projectId: string, issueDescription: string, requestedDueDate: string, imageUrls: string[] = []) => {
    reportIssueMutation.mutate({
      projectId,
      issueDescription,
      requestedDueDate,
      reportedBy: user.name,
      imageUrls,
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
    onSuccess: (data: any) => {
      // Don't clear local state immediately - let the query update handle it
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (data?._driveRenameWarning) {
        toast({
          title: "Saved with a warning",
          description: data._driveRenameWarning,
        });
      } else {
        toast({
          title: "Project updated",
          description: "Project details updated successfully.",
        });
      }
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

  // Mutation for updating project assignment - uses dedicated assign endpoint which sends welcome email
  const assignProjectMutation = useMutation({
    mutationFn: async ({ projectId, assignedTo }: { projectId: string; assignedTo: string | null }) => {
      return await apiRequest("PATCH", `/api/projects/${projectId}/assign`, { assignedTo });
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

  // SAST-local date key — returns "YYYY-MM-DD" in Africa/Johannesburg timezone for safe same-day comparisons
  const toSASTDateKey = (date: Date): string => {
    const parts = new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
  };

  // Reschedule mutation — calls the dedicated endpoint that also logs + emails client
  // actorId is sent as user.id so the server can validate it against the users table
  const rescheduleConfirmMutation = useMutation({
    mutationFn: async ({ projectId, newDate }: { projectId: string; newDate: Date }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/reschedule`, {
        newDate: newDate.toISOString(),
        actorId: user.id,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Project rescheduled",
        description: data?.emailSent
          ? "Due date updated and client notified by email."
          : "Due date updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reschedule project.", variant: "destructive" });
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
      const draggedWeekStart = getWeekStart(new Date(draggedProject.dueDate));
      const targetWeekStart = getWeekStart(targetDate);

      if (draggedWeekStart.getTime() === targetWeekStart.getTime()) {
        const currentDate = new Date(draggedProject.dueDate);
        if (currentDate.toDateString() !== targetDate.toDateString()) {
          setRescheduleModal({ project: draggedProject, targetDate });
        }
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
  if (['Retoucher1', 'Retoucher2', 'Retoucher3', 'Retoucher'].includes(user.role)) {
    visibleProjects = projects.filter(p => 
      p.assignedTo && 
      p.assignedTo.toLowerCase() === user.name.toLowerCase() &&
      // Hide rollover shadow projects that are marked as Done (completed)
      !(p.isRolloverShadow && p.status === "Done")
      // Show all other assigned projects including delivered ones
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
    const projectDate = project.dueDate ? new Date(project.dueDate) : null;
    const isUnassigned = !project.assignedTo || project.assignedTo === "__UNASSIGN__";
    const isFromPastWeek = projectDate ? projectDate < previousWeekStart : true;
    
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
                            className="text-orange-600 font-semibold"
                            animate={{ scale: assignedPhotos > 0 ? [1, 1.1, 1] : 1 }}
                            transition={{ duration: 0.5, ease: "easeInOut", delay: 0.05 }}
                          >
                            {assignedPhotos}
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
                          {totalPhotos > 0 && (
                            <span className={`text-xs ml-2 px-2 py-1 rounded-full ${
                              completedPhotos === totalPhotos 
                                ? 'bg-green-100 text-green-700' 
                                : completedPhotos > totalPhotos * 0.5 
                                  ? 'bg-yellow-100 text-yellow-700' 
                                  : 'bg-red-100 text-red-700'
                            }`}>
                              {Math.round((completedPhotos / totalPhotos) * 100)}%
                            </span>
                          )}
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
                        
                        // Get projects due on this specific day using SAST-local date keys to avoid timezone day-shift
                        const dayKey_SAST = toSASTDateKey(dayDate);
                        const allDayProjects = group.projects.filter(project => {
                          return toSASTDateKey(new Date(project.dueDate)) === dayKey_SAST;
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

                        // Status-first color coding — uses SAST date keys to avoid timezone day-shift bugs
                        const getProjectColor = (project: Project) => {
                          const status = project.status;
                          if (status === "Delivered" || status === "Done") {
                            return 'bg-green-600 text-white';
                          }
                          const todayKey = toSASTDateKey(new Date());
                          const dueKey = toSASTDateKey(new Date(project.dueDate));
                          if (dueKey < todayKey) {
                            return 'bg-red-500 text-white';
                          }
                          if (dueKey === todayKey) {
                            return 'bg-amber-500 text-white';
                          }
                          return 'bg-blue-500 text-white';
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
                              {(() => {
                                const MAX_PILLS = 4;
                                const dayKey = `${weekKey}-${dayIndex}`;
                                const isExpanded = expandedCalendarDays.has(dayKey);
                                const visibleProjects = isExpanded ? dayProjects : dayProjects.slice(0, MAX_PILLS);
                                const hiddenCount = dayProjects.length - MAX_PILLS;
                                return (<>
                              {visibleProjects.map(project => {
                                const retoucherPrefix = getRetoucherPrefix(project.assignedTo);
                                const colorClass = getProjectColor(project);
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
                                          style={project.isRolloverShadow ? { opacity: 0.5 } : {}}
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
                                            className="inline-flex items-center gap-0.5"
                                          >
                                            {retoucherPrefix} {project.clientName}
                                            {getBonusIndicator(project) && (
                                              <Gift className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400 ml-0.5" />
                                            )}
                                          </motion.span>
                                        </Badge>
                                      </motion.div>
                                    </motion.div>
                                  </motion.div>
                                );
                              })}
                              {!isExpanded && hiddenCount > 0 && (
                                <button
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5 w-full text-left pl-1"
                                  onClick={() => {
                                    setExpandedCalendarDays(prev => {
                                      const next = new Set(prev);
                                      next.add(dayKey);
                                      return next;
                                    });
                                  }}
                                >
                                  +{hiddenCount} more
                                </button>
                              )}
                              {isExpanded && dayProjects.length > MAX_PILLS && (
                                <button
                                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline mt-0.5 w-full text-left pl-1"
                                  onClick={() => {
                                    setExpandedCalendarDays(prev => {
                                      const next = new Set(prev);
                                      next.delete(dayKey);
                                      return next;
                                    });
                                  }}
                                >
                                  Show less
                                </button>
                              )}
                              </>);
                              })()}
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
                    {/* Color legend */}
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Key:</span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm bg-green-600" />
                        Delivered
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
                        Overdue
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
                        Due today
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
                        Active
                      </span>
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
                      ) : user.role === 'DataWrangler' ? (
                        <>
                          <TableHead>Client</TableHead>
                          <TableHead>Pkg</TableHead>
                          <TableHead>Sel</TableHead>
                          <TableHead>To Edit</TableHead>
                          <TableHead>Done</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Retoucher</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
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
                                {project.status === 'Review' && project.galleryLink && !project.deliveryApproved && (
                                  <Button
                                    onClick={() => approveDeliveryMutation.mutate({ projectId: project.id, approvedBy: user.name })}
                                    variant="outline"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 border-green-300"
                                    disabled={approveDeliveryMutation.isPending}
                                  >
                                    {approveDeliveryMutation.isPending ? (
                                      <LoadingSpinner size={14} className="mr-2" />
                                    ) : (
                                      <Send className="h-4 w-4 mr-1" />
                                    )}
                                    Approve & Send
                                  </Button>
                                )}
                                {project.status === 'Review' && !project.galleryLink && (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Awaiting Gallery
                                  </Badge>
                                )}
                                {project.status === 'Review' && project.galleryLink && !project.deliveryApproved && (
                                  <a href={project.galleryLink} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600">
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Preview
                                    </Button>
                                  </a>
                                )}
                                {project.deliveryApproved && (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Delivered
                                    </Badge>
                                    {project.deliveryEmailSentAt && (
                                      <span className="text-xs text-gray-500" title={`Email sent ${new Date(project.deliveryEmailSentAt).toLocaleString()}`}>
                                        {new Date(project.deliveryEmailSentAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
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
                            {/* Photo amount is read-only for Sales — only Data Wrangler/Admin can edit it */}
                            <TableCell>
                              <span className="text-sm font-medium text-center block w-16">
                                {project.selectedCount}
                              </span>
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
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {getStatusBadge(project.status)}
                                {project.riskLevel && project.riskLevel !== 'SAFE' && (
                                  <RiskBadge level={project.riskLevel} size="sm" showIcon={true} />
                                )}
                              </div>
                            </TableCell>
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
                                    <form onSubmit={(e) => {
                                      e.preventDefault();
                                      const formData = new FormData(e.currentTarget);
                                      const note = formData.get('note') as string || '';
                                      handleRequestCorrections(project.id, note);
                                    }}>
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
                              <div className="flex items-center gap-1 flex-wrap">
                                <ErrorBoundary fallback={<div className="text-sm text-gray-500">Notes unavailable</div>}>
                                  <ProjectNotes 
                                    projectId={project.id} 
                                    userRole={user.role} 
                                    hasNotes={(allNotesQuery.data?.[project.id] || 0) > 0}
                                  />
                                </ErrorBoundary>
                                {['Admin', 'DataWrangler'].includes(user.role) && (
                                  <InsposButton projectId={project.id} projectName={project.clientName} userRole={user.role} userId={String(user.name || user.id || "")} />
                                )}
                              </div>
                            </TableCell>
                          </>
                        ) : user.role === 'DataWrangler' ? (
                          <>
                            {/* Data Wrangler specific cells with editable Pkg and Sel */}
                            {/* Client cell already rendered above */}
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
                            <TableCell>
                              <span className="text-sm font-medium text-purple-600">
                                {project.toEditRemaining || project.selectedCount}
                              </span>
                            </TableCell>
                            {/* Done photos column for DataWrangler (read-only) */}
                            <TableCell>
                              {project.status === "Rolled Over" ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-center">
                                    <span 
                                      className="text-sm font-medium text-amber-600 min-w-[30px] text-center px-2 py-1 bg-amber-50 rounded border border-amber-200"
                                      title={`${project.photosCompleted || 0} photos were completed on this project before rollover`}
                                    >
                                      {project.photosCompleted || 0}
                                    </span>
                                  </div>
                                  <div className="text-xs text-amber-600 text-center font-medium">
                                    Historical
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center">
                                  <span 
                                    className="text-sm font-medium text-green-600 min-w-[30px] text-center px-2 py-1 bg-green-50 rounded border border-green-200"
                                    title={`${project.photosCompleted || 0} of ${project.toEditRemaining || project.selectedCount || 0} photos completed`}
                                  >
                                    {project.photosCompleted || 0}
                                  </span>
                                </div>
                              )}
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
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {getStatusBadge(project.status)}
                                {project.riskLevel && project.riskLevel !== 'SAFE' && (
                                  <RiskBadge level={project.riskLevel} size="sm" showIcon={true} />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <ErrorBoundary fallback={<div className="text-sm text-gray-500">Notes unavailable</div>}>
                                  <ProjectNotes 
                                    projectId={project.id} 
                                    userRole={user.role} 
                                    hasNotes={(allNotesQuery.data?.[project.id] || 0) > 0}
                                  />
                                </ErrorBoundary>
                                {['Admin', 'DataWrangler'].includes(user.role) && (
                                  <InsposButton projectId={project.id} projectName={project.clientName} userRole={user.role} userId={String(user.name || user.id || "")} />
                                )}
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            {/* Standard cells for other roles */}
                            {/* Client cell already rendered above */}
                            {/* To Edit column for non-Sales — editable photo amount for Admin only */}
                            <TableCell>
                              {user.role === 'Admin' ? (
                                <input
                                  type="number"
                                  value={localInputValues[project.id]?.selectedCount ?? project.selectedCount}
                                  onChange={(e) => handleChangeSelectedCount(project.id, parseInt(e.target.value) || 0)}
                                  className="border rounded px-2 py-1 w-16 text-center bg-white dark:bg-gray-800"
                                  min="0"
                                  placeholder="0"
                                  title="Edit photo amount — updates the retoucher's target and renames the Drive folder"
                                  data-testid={`input-photo-amount-${project.id}`}
                                />
                              ) : (
                                <span className="text-sm font-medium text-purple-600">
                                  {project.toEditRemaining || project.selectedCount}
                                </span>
                              )}
                            </TableCell>
                            {/* Done photos column for non-Sales (read-only) */}
                            <TableCell>
                              {project.status === "Rolled Over" ? (
                                // Show historical completion data for rolled over projects
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-center">
                                    <span 
                                      className="text-sm font-medium text-amber-600 min-w-[30px] text-center px-2 py-1 bg-amber-50 rounded border border-amber-200"
                                      data-testid={`text-completed-historical-${project.id}`}
                                      title={`${project.photosCompleted || 0} photos were completed on this project before rollover`}
                                    >
                                      {project.photosCompleted || 0}
                                    </span>
                                  </div>
                                  <div className="text-xs text-amber-600 text-center font-medium">
                                    Historical
                                  </div>
                                </div>
                              ) : (
                                // Read-only completion display for active projects
                                <div className="flex items-center justify-center">
                                  <span 
                                    className="text-sm font-medium text-green-600 min-w-[30px] text-center px-2 py-1 bg-green-50 rounded border border-green-200"
                                    data-testid={`text-completed-count-${project.id}`}
                                    title={`${project.photosCompleted || 0} of ${project.toEditRemaining || project.selectedCount || 0} photos completed`}
                                  >
                                    {project.photosCompleted || 0}
                                  </span>
                                </div>
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
                              {allUsers.find(u => u.name === project.assignedTo && u.id)?.name || 
                               getRetoucherFullName(project.assignedTo)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {getStatusBadge(project.status)}
                                {project.riskLevel && project.riskLevel !== 'SAFE' && (
                                  <RiskBadge level={project.riskLevel} size="sm" showIcon={true} />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <ErrorBoundary fallback={<div className="text-sm text-gray-500">Notes unavailable</div>}>
                                  <ProjectNotes 
                                    projectId={project.id} 
                                    userRole={user.role} 
                                    hasNotes={(allNotesQuery.data?.[project.id] || 0) > 0}
                                  />
                                </ErrorBoundary>
                                {['Admin', 'DataWrangler'].includes(user.role) && (
                                  <InsposButton projectId={project.id} projectName={project.clientName} userRole={user.role} userId={String(user.name || user.id || "")} />
                                )}
                              </div>
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
                                      .filter(u => ['Retoucher1', 'Retoucher2', 'Retoucher3', 'Retoucher'].includes(u.role) || (u.role === "Admin" && u.name === "Anesu's Pops"))
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
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      {(() => {
                                        const buttonStyle = getReportButtonStyling(project.id);
                                        return (
                                          <Button 
                                            size="sm" 
                                            variant="outline"
                                            className={buttonStyle.className}
                                            data-testid={`button-report-${project.id}`}
                                          >
                                            {buttonStyle.text}
                                          </Button>
                                        );
                                      })()}
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Report Issue</DialogTitle>
                                        <DialogDescription>
                                          Report an issue with {formatClientDisplay(project)} to Evans for resolution.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <ReportIssueDialog 
                                        project={project} 
                                        onReport={handleReportIssue}
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
                              
                              {/* Gallery link for retouchers on Review projects */}
                              {hasRetouchingAbilities(user.role) && project.status === 'Review' && (
                                project.galleryLink ? (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                                      <Link className="h-3 w-3 mr-1" />
                                      Gallery Added
                                    </Badge>
                                    <a href={project.galleryLink} target="_blank" rel="noopener noreferrer">
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    </a>
                                  </div>
                                ) : (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400"
                                      >
                                        <Link className="h-4 w-4 mr-1" />
                                        Add Gallery Link
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Add Gallery Link</DialogTitle>
                                        <DialogDescription>
                                          Paste the Pixieset or Google Drive gallery link for {project.clientName}'s project.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <form onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        const galleryLink = formData.get('galleryLink') as string;
                                        if (galleryLink) {
                                          galleryLinkMutation.mutate({
                                            projectId: project.id,
                                            galleryLink,
                                            addedBy: user.name,
                                          });
                                        }
                                      }}>
                                        <div className="space-y-4">
                                          <div>
                                            <Label htmlFor="gallery-link-input">Gallery URL</Label>
                                            <Input
                                              id="gallery-link-input"
                                              name="galleryLink"
                                              type="url"
                                              placeholder="https://pixieset.com/... or https://drive.google.com/..."
                                              required
                                            />
                                          </div>
                                          <div className="flex justify-end gap-2">
                                            <DialogClose asChild>
                                              <Button type="button" variant="outline">Cancel</Button>
                                            </DialogClose>
                                            <Button 
                                              type="submit" 
                                              className="bg-blue-600 hover:bg-blue-700"
                                              disabled={galleryLinkMutation.isPending}
                                            >
                                              {galleryLinkMutation.isPending ? (
                                                <LoadingSpinner size={14} className="mr-2" />
                                              ) : (
                                                <Link className="h-4 w-4 mr-1" />
                                              )}
                                              Submit Gallery Link
                                            </Button>
                                          </div>
                                        </div>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
                                )
                              )}

                              <ProjectGalleryLink projectId={project.id} role={user.role} userId={user.id || ""} />

                              {hasRetouchingAbilities(user.role) && project.assignedTo === user.name && project.clientEmail && 
                               !['Delivered', 'Done'].includes(project.status) && (
                                <SneakPeekDialog project={project} user={user} />
                              )}

                              {/* Quality Gate Status & Controls */}
                              {(user.role === 'Admin' || user.role === 'LeadRetoucher') && project.status === 'Review' && project.driveFolderId && (
                                <div className="flex items-center gap-1">
                                  {project.qualityGatePassed === true ? (
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                                      <ShieldCheck className="h-3 w-3 mr-1" />
                                      QG {project.qualityGateScore}/10
                                    </Badge>
                                  ) : project.qualityGateOverride ? (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs">
                                      <ShieldAlert className="h-3 w-3 mr-1" />
                                      Override
                                    </Badge>
                                  ) : project.qualityGatePassed === false ? (
                                    <>
                                      <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs">
                                        <ShieldX className="h-3 w-3 mr-1" />
                                        QG {project.qualityGateScore}/10
                                      </Badge>
                                      {user.role === 'Admin' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => qualityGateOverrideMutation.mutate({ projectId: project.id, overrideBy: user.name })}
                                          disabled={qualityGateOverrideMutation.isPending}
                                          className="h-6 text-xs px-2 text-yellow-700 border-yellow-400 hover:bg-yellow-50"
                                        >
                                          Override
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => qualityGateMutation.mutate({ projectId: project.id })}
                                      disabled={qualityGateMutation.isPending}
                                      className="h-7 text-xs"
                                    >
                                      {qualityGateMutation.isPending ? (
                                        <LoadingSpinner size={12} className="mr-1" />
                                      ) : (
                                        <Shield className="h-3.5 w-3.5 mr-1" />
                                      )}
                                      Quality Check
                                    </Button>
                                  )}
                                </div>
                              )}

                              {/* Admin/Sales can approve delivery when in Review with gallery link */}
                              {(user.role === 'Admin' || user.role === 'Sales') && project.status === 'Review' && project.galleryLink && !project.deliveryApproved && (
                                <Button 
                                  size="sm" 
                                  onClick={() => approveDeliveryMutation.mutate({ projectId: project.id, approvedBy: user.name })}
                                  disabled={approveDeliveryMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {approveDeliveryMutation.isPending ? (
                                    <LoadingSpinner size={14} className="mr-2" />
                                  ) : (
                                    <Send className="h-4 w-4 mr-1" />
                                  )}
                                  Approve & Send
                                </Button>
                              )}
                              
                              {/* Admin can deliver when in Review (without gallery link) */}
                              {user.role === 'Admin' && project.status === 'Review' && !project.galleryLink && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleDeliver(project.id)}
                                  disabled={updateProjectMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Deliver
                                </Button>
                              )}

                              {/* Delivery tracking info */}
                              {project.deliveryApproved && project.status === 'Delivered' && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Delivered
                                  </Badge>
                                </div>
                              )}
                              
                              {/* Apply Bonus Photos button for Admin, Sales, DataWrangler */}
                              {canApplyBonusPhotos && project.clientEmail && getBonusIndicator(project) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setBonusPhotoProject(project);
                                    setBonusPhotoCount(1);
                                  }}
                                  className="text-amber-600 hover:text-amber-700 border-amber-300 hover:border-amber-400 bg-amber-50 hover:bg-amber-100"
                                >
                                  <Gift className="h-4 w-4 mr-1" />
                                  Apply Bonus
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
      
      {/* Reschedule Confirmation Dialog */}
      {rescheduleModal && (() => {
        const oldFmt = new Date(rescheduleModal.project.dueDate).toLocaleDateString('en-ZA', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          timeZone: 'Africa/Johannesburg',
        });
        const newFmt = rescheduleModal.targetDate.toLocaleDateString('en-ZA', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          timeZone: 'Africa/Johannesburg',
        });
        const firstName = rescheduleModal.project.clientName.split(' ')[0];
        const hasEmail = !!rescheduleModal.project.clientEmail;
        return (
          <Dialog open={!!rescheduleModal} onOpenChange={(open) => { if (!open) setRescheduleModal(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Confirm Reschedule</DialogTitle>
                <DialogDescription>
                  Moving <strong>{rescheduleModal.project.clientName}</strong>'s delivery date.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500 dark:text-gray-400">Current date</div>
                  <div className="line-through text-gray-400 dark:text-gray-500">{oldFmt}</div>
                  <div className="text-gray-500 dark:text-gray-400">New date</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{newFmt}</div>
                </div>
                {hasEmail && (
                  <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">Email preview — will be sent to client</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Subject: Update on your photo delivery, {firstName}</p>
                    <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1 border-t border-blue-200 dark:border-blue-700 pt-1.5">
                      <p>Hi {firstName},</p>
                      <p>We wanted to let you know that your photo delivery date has been updated.</p>
                      <p><span className="line-through text-gray-400">{oldFmt}</span> → <strong>{newFmt}</strong></p>
                      <p>We apologise for any inconvenience and appreciate your patience.</p>
                      <p className="text-gray-500 dark:text-gray-400">— Jepson Myles Studio</p>
                    </div>
                  </div>
                )}
                {!hasEmail && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">No client email on record — no notification will be sent.</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRescheduleModal(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={rescheduleConfirmMutation.isPending}
                  onClick={() => {
                    rescheduleConfirmMutation.mutate({
                      projectId: rescheduleModal.project.id,
                      newDate: rescheduleModal.targetDate,
                    });
                    setRescheduleModal(null);
                  }}
                >
                  {rescheduleConfirmMutation.isPending ? "Saving…" : "Confirm reschedule"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

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

      {/* Apply Bonus Photos Dialog */}
      <AnimatePresence>
        {bonusPhotoProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setBonusPhotoProject(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-1">Apply Bonus Photos</h3>
              <p className="text-sm text-gray-500 mb-4">
                Apply referral bonus photos to <strong>{bonusPhotoProject.clientName}</strong>'s project.
              </p>
              {(() => {
                const bonus = bonusPhotoProject.clientEmail ? clientBonusMap[bonusPhotoProject.clientEmail] : null;
                const available = bonus?.available || 0;
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <Gift className="h-5 w-5 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        {available} bonus photo(s) available
                      </span>
                    </div>
                    <div>
                      <Label htmlFor="bonus-count">Photos to apply</Label>
                      <Input
                        id="bonus-count"
                        type="number"
                        min={1}
                        max={available}
                        value={bonusPhotoCount}
                        onChange={(e) => setBonusPhotoCount(Math.min(Math.max(1, parseInt(e.target.value) || 1), available))}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setBonusPhotoProject(null)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => applyBonusPhotosMutation.mutate({ projectId: bonusPhotoProject.id, photos: bonusPhotoCount })}
                        disabled={applyBonusPhotosMutation.isPending || bonusPhotoCount < 1 || bonusPhotoCount > available}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {applyBonusPhotosMutation.isPending ? (
                          <LoadingSpinner size={14} className="mr-2" />
                        ) : (
                          <Gift className="h-4 w-4 mr-1" />
                        )}
                        Apply {bonusPhotoCount} Photo(s)
                      </Button>
                    </div>
                  </div>
                );
              })()}
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
  formatClientDisplay: (project: any) => React.ReactNode;
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

interface ReportIssueDialogProps {
  project: any;
  onReport: (projectId: string, issueDescription: string, requestedDueDate: string, imageUrls?: string[]) => void;
  formatClientDisplay: (project: any) => React.ReactNode;
}

function ReportIssueDialog({ project, onReport, formatClientDisplay }: ReportIssueDialogProps) {
  const [issueDescription, setIssueDescription] = useState("");
  const [requestedDueDate, setRequestedDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const { toast } = useToast();
  
  const handleSubmit = async () => {
    if (!issueDescription.trim() || !requestedDueDate) {
      return; // Validation handled by form state
    }
    
    setIsSubmitting(true);
    try {
      await onReport(project.id, issueDescription.trim(), requestedDueDate, uploadedImages);
      setIssueDescription(""); // Reset form
      setRequestedDueDate("");
      setUploadedImages([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGetUploadParameters = async () => {
    const response = await fetch('/api/objects/upload', { method: 'POST' });
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const newImageUrls = result.successful.map(file => file.uploadURL || '').filter(Boolean);
      const normalizedUrls = newImageUrls.map(url => {
        // Extract the path from the full URL to create the object path
        if (url.includes('storage.googleapis.com')) {
          try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            if (pathParts.length >= 3) {
              const bucketName = pathParts[1];
              const objectPath = pathParts.slice(2).join('/');
              // Check if this is in the private directory
              if (objectPath.includes('uploads/')) {
                const entityId = objectPath.split('uploads/')[1];
                return `/objects/uploads/${entityId}`;
              }
            }
          } catch (e) {
            console.error('Error parsing upload URL:', e);
          }
        }
        return url; // Fallback to original URL
      });
      
      setUploadedImages(prev => [...prev, ...normalizedUrls]);
      toast({
        title: "Photos uploaded",
        description: `${newImageUrls.length} photo(s) attached to your report.`,
      });
    }
  };
  
  // Get tomorrow's date as minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="issue-description">Issue Description</Label>
        <textarea
          id="issue-description"
          value={issueDescription}
          onChange={(e) => setIssueDescription(e.target.value)}
          placeholder="Describe the issue you're experiencing..."
          className="w-full min-h-[100px] p-2 border border-gray-300 rounded-md resize-vertical"
          rows={4}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="requested-due-date">Requested Resolution Date</Label>
        <Input
          id="requested-due-date"
          type="date"
          min={minDate}
          value={requestedDueDate}
          onChange={(e) => setRequestedDueDate(e.target.value)}
          className="w-full"
        />
        <p className="text-sm text-gray-600">
          When do you need this issue resolved?
        </p>
      </div>
      
      <div className="space-y-2">
        <Label>Attach Photos (Optional)</Label>
        <ObjectUploader
          maxNumberOfFiles={5}
          maxFileSize={10485760} // 10MB
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleUploadComplete}
          buttonClassName="w-full"
        >
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <span>Upload Photos</span>
          </div>
        </ObjectUploader>
        {uploadedImages.length > 0 && (
          <div className="text-sm text-green-600">
            {uploadedImages.length} photo(s) attached
          </div>
        )}
        <p className="text-sm text-gray-600">
          Upload photos to help explain the issue (max 5 photos, 10MB each)
        </p>
      </div>
      
      <div className="bg-gray-50 p-3 rounded-md">
        <p className="text-sm">
          <strong>Project:</strong> {formatClientDisplay(project)}
        </p>
        <p className="text-sm">
          <strong>Status:</strong> {project.status}
        </p>
        <p className="text-sm">
          <strong>Assigned to:</strong> {project.assignedTo || "Not assigned"}
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
            disabled={isSubmitting || !issueDescription.trim() || !requestedDueDate}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size={14} className="mr-2" />
                Reporting...
              </>
            ) : (
              'Report Issue'
            )}
          </Button>
        </DialogClose>
      </div>
    </div>
  );
}

interface SneakPeekDialogProps {
  project: Project;
  user: User;
}

function SneakPeekDialog({ project, user }: SneakPeekDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [open, setOpen] = useState(false);

  const { data: sneakPeeks = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/projects', project.id, 'sneak-peeks'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/sneak-peeks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${project.id}/sneak-peeks`, {
        imageUrl,
        caption: caption || null,
        sentBy: user.name,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sneak Peek Added", description: "Preview image saved. You can now send it to the client." });
      qc.invalidateQueries({ queryKey: ['/api/projects', project.id, 'sneak-peeks'] });
      setImageUrl("");
      setCaption("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (peekId: string) => {
      const res = await apiRequest("POST", `/api/projects/${project.id}/sneak-peeks/${peekId}/send`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sneak Peek Sent!", description: "The client has been emailed the preview photo." });
      qc.invalidateQueries({ queryKey: ['/api/projects', project.id, 'sneak-peeks'] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Send", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (peekId: string) => {
      await apiRequest("DELETE", `/api/projects/${project.id}/sneak-peeks/${peekId}`);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Sneak peek removed." });
      qc.invalidateQueries({ queryKey: ['/api/projects', project.id, 'sneak-peeks'] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const canAddMore = sneakPeeks.length < 3;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-pink-600 hover:text-pink-700 border-pink-300 hover:border-pink-400">
          <Eye className="h-4 w-4 mr-1" />
          Sneak Peek
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-pink-600" />
            Sneak Peek - {project.clientName}
          </DialogTitle>
          <DialogDescription>
            Send a preview photo to your client before the full set is ready. Max 3 per project.
          </DialogDescription>
        </DialogHeader>

        {canAddMore && (
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
            <div>
              <Label htmlFor="peek-image-url">Image URL</Label>
              <Input
                id="peek-image-url"
                type="url"
                placeholder="https://drive.google.com/... or Pixieset link"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="peek-caption">Caption (optional)</Label>
              <Textarea
                id="peek-caption"
                placeholder="A little sneak peek of your beautiful photos..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
              />
            </div>
            {imageUrl && (
              <div className="rounded-lg overflow-hidden border">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full max-h-48 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!imageUrl || createMutation.isPending}
              className="w-full bg-pink-600 hover:bg-pink-700"
            >
              {createMutation.isPending ? (
                <LoadingSpinner size={14} className="mr-2" />
              ) : (
                <Image className="h-4 w-4 mr-2" />
              )}
              Add Sneak Peek
            </Button>
          </div>
        )}

        {!canAddMore && (
          <div className="text-center py-3 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            Maximum of 3 sneak peeks reached for this project.
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size={24} />
          </div>
        ) : sneakPeeks.length > 0 ? (
          <div className="space-y-3 mt-2">
            <Label className="text-sm font-medium">Saved Previews ({sneakPeeks.length}/3)</Label>
            {sneakPeeks.map((peek: any) => (
              <div key={peek.id} className="border rounded-lg p-3 space-y-2">
                <div className="rounded overflow-hidden">
                  <img
                    src={peek.imageUrl}
                    alt="Sneak peek"
                    className="w-full max-h-32 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                {peek.caption && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{peek.caption}"</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {peek.sentAt ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Sent {new Date(peek.sentAt).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span>Added {new Date(peek.createdAt).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!peek.sentAt && (
                      <Button
                        size="sm"
                        onClick={() => sendMutation.mutate(peek.id)}
                        disabled={sendMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                      >
                        {sendMutation.isPending ? (
                          <LoadingSpinner size={12} className="mr-1" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Send to Client
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(peek.id)}
                      disabled={deleteMutation.isPending}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-gray-500">
            No sneak peeks yet. Add a preview image above to get started.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ProjectGalleryData {
  id: string;
  name: string;
  slug: string;
  status: string;
  photoCount?: number;
  favListCount?: number;
  publishedAt?: string | null;
}

function ProjectGalleryLink({ projectId, role, userId }: { projectId: string; role: string; userId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showPanel, setShowPanel] = useState(false);

  const { data: linkedGallery, isLoading: galleryLoading } = useQuery<ProjectGalleryData | null>({
    queryKey: ["/api/galleries/by-project", projectId],
    queryFn: async () => {
      const { getAdminHeaders } = await import("@/lib/adminAuth");
      const headers = getAdminHeaders(role, userId);
      const res = await fetch(`/api/galleries/by-project/${projectId}`, { headers });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const createGalleryMutation = useMutation({
    mutationFn: async () => {
      const { getAdminHeaders } = await import("@/lib/adminAuth");
      const headers = getAdminHeaders(role, userId);
      const res = await fetch("/api/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ name: `Gallery`, projectId }),
      });
      if (!res.ok) throw new Error("Failed to create gallery");
      return res.json();
    },
    onSuccess: (data: { id: string }) => {
      qc.invalidateQueries({ queryKey: ["/api/galleries/by-project", projectId] });
      toast({ title: "Gallery created", description: "Linked gallery has been created for this project" });
      window.location.href = `/galleries/${data.id}`;
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create gallery", variant: "destructive" });
    },
  });

  if (galleryLoading) return null;

  if (!linkedGallery) {
    return (
      <Badge
        variant="outline"
        className="cursor-pointer text-xs hover:bg-purple-50 dark:hover:bg-purple-900/20 border-dashed"
        onClick={(e) => { e.stopPropagation(); createGalleryMutation.mutate(); }}
      >
        <Image className="h-3 w-3 mr-1" />
        {createGalleryMutation.isPending ? "Creating..." : "+ Gallery"}
      </Badge>
    );
  }

  return (
    <div className="relative inline-block">
      <Badge
        variant="secondary"
        className={`cursor-pointer text-xs ${
          linkedGallery.status === "published"
            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        }`}
        onClick={(e) => { e.stopPropagation(); setShowPanel(!showPanel); }}
      >
        <Image className="h-3 w-3 mr-1" />
        Gallery{linkedGallery.status === "published" ? " Live" : ""}
      </Badge>
      {showPanel && (
        <div
          className="absolute z-50 top-full mt-1 right-0 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{linkedGallery.name}</span>
            <button onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              linkedGallery.status === "published" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}>
              {linkedGallery.status}
            </span>
            {linkedGallery.photoCount !== undefined && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {linkedGallery.photoCount} photos
              </span>
            )}
            {(linkedGallery.favListCount ?? 0) > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                {linkedGallery.favListCount} fav lists
              </span>
            )}
          </div>
          {linkedGallery.publishedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Published {new Date(linkedGallery.publishedAt).toLocaleDateString()}
            </p>
          )}
          <a
            href={`/galleries/${linkedGallery.id}`}
            className="block text-center text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium py-1 border-t border-gray-100 dark:border-gray-700 mt-2 pt-2"
          >
            Open Gallery Detail →
          </a>
        </div>
      )}
    </div>
  );
}
