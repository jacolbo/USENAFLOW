import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Project, projects } from "@shared/schema";
type ProjectStatus = typeof projects.$inferSelect.status;
import { User } from "@/lib/types";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProjectEditDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allUsers: User[];
  userRole: string;
}

export function ProjectEditDialog({ project, open, onOpenChange, allUsers, userRole }: ProjectEditDialogProps) {
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("awaiting_payment");
  const [assignedTo, setAssignedTo] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (project) {
      setDueDate(format(new Date(project.dueDate), "yyyy-MM-dd"));
      setStatus(project.status);
      setAssignedTo(project.assignedTo || "");
    }
  }, [project]);

  const updateProjectMutation = useMutation({
    mutationFn: async (updates: { dueDate?: string; status?: ProjectStatus; assignedTo?: string | null }) => {
      if (!project) throw new Error("No project selected");
      
      return apiRequest(`/api/projects/${project.id}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project updated",
        description: "Project details have been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    const updates: { dueDate?: string; status?: ProjectStatus; assignedTo?: string | null } = {};
    
    if (dueDate !== format(new Date(project.dueDate), "yyyy-MM-dd")) {
      updates.dueDate = dueDate;
    }
    
    if (status !== project.status) {
      updates.status = status as ProjectStatus;
    }
    
    if (assignedTo !== (project.assignedTo || "")) {
      updates.assignedTo = assignedTo || null;
    }

    if (Object.keys(updates).length > 0) {
      updateProjectMutation.mutate(updates);
    } else {
      onOpenChange(false);
    }
  };

  if (!project) return null;

  const canEditStatus = ['Admin', 'Sales', 'LeadRetoucher'].includes(userRole);
  const canEditAssignment = ['Admin', 'Sales', 'LeadRetoucher'].includes(userRole);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Project: {project.clientName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          {canEditStatus && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
                  <SelectItem value="ready_for_retouching">Ready for Retouching</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {canEditAssignment && (
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select retoucher..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
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
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateProjectMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}