import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@shared/schema";
import { User } from "@/lib/types";
import { Plus, Calendar, User as UserIcon, FileText, AlertCircle } from "lucide-react";

interface TaskCreationFormProps {
  projects: Project[];
  user: User;
  allUsers: User[];
}

export function TaskCreationForm({ projects, user, allUsers }: TaskCreationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: {
      projectId: string;
      title: string;
      note?: string;
      assignedTo: string;
      assignedBy: string;
      dueDate: string;
    }) => {
      const response = await apiRequest("POST", "/api/tasks", taskData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Task Created",
        description: "Task has been assigned successfully.",
      });
      setIsOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedProject("");
    setTaskTitle("");
    setTaskNote("");
    setAssignedTo("");
    setDueDate("");
    setDueTime("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProject || !taskTitle || !assignedTo || !dueDate || !dueTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const dueDatetime = new Date(`${dueDate}T${dueTime}`);
    
    createTaskMutation.mutate({
      projectId: selectedProject,
      title: taskTitle,
      note: taskNote || undefined,
      assignedTo,
      assignedBy: user.name,
      dueDate: dueDatetime.toISOString(),
    });
  };

  const getRetoucherUsers = () => {
    return allUsers.filter(u => u.role === "Retoucher" || u.role === "Admin");
  };

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          data-testid="button-create-task"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create New Task
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Project *
            </Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger data-testid="select-project">
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.clientName} - {project.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProjectData && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-blue-800">
                  {selectedProjectData.clientName}
                </CardTitle>
                <CardDescription className="text-xs text-blue-600">
                  Status: {selectedProjectData.status} | 
                  Due: {new Date(selectedProjectData.dueDate).toLocaleDateString()} |
                  {selectedProjectData.assignedTo ? ` Assigned to: ${selectedProjectData.assignedTo}` : ' Unassigned'}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Task Title *
            </Label>
            <Input
              id="title"
              data-testid="input-task-title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g., Review and approve final images"
              required
            />
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <Label htmlFor="note">
              Additional Note (Optional)
            </Label>
            <Textarea
              id="note"
              data-testid="textarea-task-note"
              value={taskNote}
              onChange={(e) => setTaskNote(e.target.value)}
              placeholder="Add any additional details or instructions..."
              rows={3}
            />
          </div>

          {/* Assign To */}
          <div className="space-y-2">
            <Label htmlFor="assignedTo" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Assign To *
            </Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger data-testid="select-assigned-to">
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {getRetoucherUsers().map((member) => (
                  <SelectItem key={member.id} value={member.name}>
                    {member.name} ({member.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Due Date *
              </Label>
              <Input
                id="dueDate"
                data-testid="input-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueTime">Due Time *</Label>
              <Input
                id="dueTime"
                data-testid="input-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              data-testid="button-cancel-task"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createTaskMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-submit-task"
            >
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}