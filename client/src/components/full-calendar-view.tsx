import { useState, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectEditDialog } from "./project-edit-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Project } from "@shared/schema";
import { User } from "@/lib/types";

interface FullCalendarViewProps {
  projects: Project[];
  user: User;
  allUsers: User[];
}

export function FullCalendarView({ projects, user, allUsers }: FullCalendarViewProps) {
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user can drag/drop projects
  const canDragDrop = ['Admin', 'Sales', 'LeadRetoucher', 'DataWrangler'].includes(user.role);

  // Filter projects for retouchers
  const visibleProjects = useMemo(() => {
    if (user.role === "Retoucher") {
      return projects.filter(p => 
        p.assignedTo && 
        p.assignedTo.toLowerCase() === user.name.toLowerCase()
      );
    }
    return projects;
  }, [projects, user]);

  // Mutation for updating project due dates
  const updateProjectDueDateMutation = useMutation({
    mutationFn: async ({ projectId, newDueDate }: { projectId: string; newDueDate: string }) => {
      console.log("Calendar: Updating project due date:", { projectId, newDueDate });
      return apiRequest("PATCH", `/api/projects/${projectId}`, { dueDate: newDueDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.refetchQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Due date updated",
        description: "Project due date has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Calendar: Due date update failed:", error);
      toast({
        title: "Error",
        description: "Failed to update due date. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get project status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "awaiting_payment":
        return "#ef4444"; // red
      case "ready_for_retouching":
        return "#f59e0b"; // amber
      case "assigned":
        return "#3b82f6"; // blue
      case "review":
        return "#8b5cf6"; // violet
      case "delivered":
        return "#10b981"; // emerald
      default:
        return "#6b7280"; // gray
    }
  };

  // Get retoucher abbreviation
  const getRetoucherAbbr = (assignedTo: string | null) => {
    if (!assignedTo) return "";
    
    // Check custom users first
    const customUser = allUsers.find(u => u.name === assignedTo && u.abbr);
    if (customUser && customUser.abbr) {
      return customUser.abbr;
    }
    
    // Default abbreviations
    const name = assignedTo.toLowerCase();
    if (name.includes("earl")) return "EC";
    if (name.includes("asa") || name.includes("dr asa")) return "ASA";
    if (name.includes("lucky")) return "LM";
    if (name.includes("evans") || name.includes("abreation")) return "E.M";
    
    // Fallback to first two letters
    return assignedTo.substring(0, 2).toUpperCase();
  };

  // Convert projects to FullCalendar events
  const calendarEvents = useMemo(() => {
    return visibleProjects.map(project => {
      const retoucherAbbr = getRetoucherAbbr(project.assignedTo);
      const statusColor = getStatusColor(project.status);
      
      return {
        id: project.id,
        title: `${retoucherAbbr ? `${retoucherAbbr} ` : ""}${project.clientName}`,
        start: project.dueDate,
        backgroundColor: statusColor,
        borderColor: statusColor,
        textColor: "#ffffff",
        extendedProps: {
          project: project,
          packageCount: project.packageCount,
          selectedCount: project.selectedCount,
          extras: project.extras,
          status: project.status,
          assignedTo: project.assignedTo,
          rating: project.rating,
        }
      };
    });
  }, [visibleProjects, allUsers]);

  // Check if date is weekend
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  };

  // Handle event drop (drag and drop)
  const handleEventDrop = (info: any) => {
    if (!canDragDrop) {
      info.revert();
      toast({
        title: "Permission denied",
        description: "You don't have permission to move projects.",
        variant: "destructive",
      });
      return;
    }

    const newDate = info.event.start;
    const projectId = info.event.id;
    
    // Check if dropped on weekend
    if (isWeekend(newDate)) {
      const confirmMove = window.confirm(
        "You're moving this project to a weekend. Are you sure you want to continue?"
      );
      
      if (!confirmMove) {
        info.revert();
        return;
      }
    }

    // Update the project due date
    const newDueDate = newDate.toISOString().split('T')[0];
    updateProjectDueDateMutation.mutate({
      projectId,
      newDueDate,
    });
  };

  // Handle event click (double-click to edit)
  const handleEventClick = (info: any) => {
    const project = info.event.extendedProps.project;
    setEditingProject(project);
    setIsEditDialogOpen(true);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📅 Calendar View
          <Badge variant="outline" className="text-xs">
            Week View
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[600px]">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={calendarEvents}
            editable={canDragDrop}
            droppable={canDragDrop}
            eventDrop={handleEventDrop}
            eventClick={handleEventClick}
            height="100%"
            slotMinTime="06:00:00"
            slotMaxTime="20:00:00"
            weekends={true}
            allDaySlot={false}
            nowIndicator={true}
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5], // Monday - Friday
              startTime: '08:00',
              endTime: '17:00',
            }}
            eventConstraint={{
              daysOfWeek: [1, 2, 3, 4, 5, 6, 0] // Allow all days but warn on weekends
            }}
            eventDisplay="block"
            eventTextColor="#ffffff"
            dayMaxEvents={3}
            moreLinkClick="day"
            eventDidMount={(info) => {
              // Add tooltip with project details
              const project = info.event.extendedProps.project;
              info.el.title = `${project.clientName}\nStatus: ${project.status}\nPackage: ${project.packageCount}\nSelected: ${project.selectedCount}\nExtras: ${project.extras}\nClick to edit`;
            }}
          />
        </div>

        {/* Project Edit Dialog */}
        <ProjectEditDialog
          project={editingProject}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          allUsers={allUsers}
          userRole={user.role}
        />
      </CardContent>
    </Card>
  );
}