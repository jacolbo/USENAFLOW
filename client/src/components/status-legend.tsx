import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { Project } from "@shared/schema";
import { User, formatRetoucherAbbr } from "@/lib/types";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProjectEditDialog } from "./project-edit-dialog";

interface StatusLegendProps {
  projects: Project[];
  user: User;
  allUsers: User[];
}

export function StatusLegend({ projects, user, allUsers }: StatusLegendProps) {
  // Only show for Admin, Sales, LeadRetoucher, and DataWrangler
  if (!['Admin', 'Sales', 'LeadRetoucher', 'DataWrangler'].includes(user.role)) {
    return null;
  }

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dialog state for editing projects
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Drag and drop state
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);

  const getWeekStart = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const currentWeekProjects = useMemo(() => {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

    // Filter projects due in current week
    const weekProjects = projects.filter(project => {
      const dueDate = new Date(project.dueDate);
      return dueDate >= currentWeekStart && dueDate <= currentWeekEnd;
    });

    // Group by day of week
    const dayGroups: { [key: number]: Project[] } = {};
    for (let i = 0; i < 7; i++) {
      dayGroups[i] = [];
    }

    weekProjects.forEach(project => {
      const dueDate = new Date(project.dueDate);
      const dayOfWeek = dueDate.getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday(0) to 6, Monday(1) to 0, etc.
      dayGroups[adjustedDay].push(project);
    });

    return dayGroups;
  }, [projects]);

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

  // Mutation for updating project due dates
  const updateProjectDueDateMutation = useMutation({
    mutationFn: async ({ projectId, newDueDate }: { projectId: string; newDueDate: string }) => {
      return apiRequest("PATCH", `/api/projects/${projectId}`, { dueDate: newDueDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Due date updated",
        description: "Project due date has been updated successfully.",
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

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const weekStart = getWeekStart(now);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5" />
          Current Week Status Legend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {dayNames.map((dayName, index) => {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + index);
            const dayProjects = currentWeekProjects[index] || [];
            const isToday = dayDate.toDateString() === now.toDateString();

            return (
              <div
                key={index}
                className={`border rounded-lg p-2 min-h-[100px] border-2 border-dashed transition-colors ${
                  isToday 
                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600' 
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, dayDate)}
              >
                <div className="text-center mb-2">
                  <div className={`text-sm font-medium ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                    {dayName}
                  </div>
                  <div className={`text-xs ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                    {dayDate.getDate()}
                  </div>
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
                          {retoucherPrefix ? `${retoucherPrefix} ` : ''}
                          {project.clientName}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                
                {dayProjects.length === 0 && (
                  <div className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
                    Drop here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      
      {/* Project Edit Dialog */}
      <ProjectEditDialog
        project={editingProject}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        allUsers={allUsers}
        userRole={user.role}
      />
    </Card>
  );
}