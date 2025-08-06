import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, Plus } from "lucide-react";

interface AddProjectFormProps {
  onAddProject: () => void;
}

export function AddProjectForm({ onAddProject }: AddProjectFormProps) {
  const [clientName, setClientName] = useState("");
  const [packageCount, setPackageCount] = useState("");
  const [selectedCount, setSelectedCount] = useState("");
  const [turnaround, setTurnaround] = useState("3");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/projects", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setClientName("");
      setPackageCount("");
      setSelectedCount("");
      setTurnaround("3");
      onAddProject();
      toast({
        title: "Project created",
        description: "New project has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientName || !packageCount || !selectedCount) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    const pkgCount = parseInt(packageCount, 10);
    const selCount = parseInt(selectedCount, 10);

    if (isNaN(pkgCount) || isNaN(selCount)) {
      toast({
        title: "Validation Error",
        description: "Package and Selected counts must be numbers.",
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate({
      clientName,
      packageCount: pkgCount,
      selectedCount: selCount,
      turnaround: parseInt(turnaround, 10),
    });
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          Add New Project
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client Name</Label>
            <Input
              id="client"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="package">Package Photos</Label>
            <Input
              id="package"
              type="number"
              value={packageCount}
              onChange={(e) => setPackageCount(e.target.value)}
              placeholder="0"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="selected">Selected Photos</Label>
            <Input
              id="selected"
              type="number"
              value={selectedCount}
              onChange={(e) => setSelectedCount(e.target.value)}
              placeholder="0"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="turnaround">Turnaround</Label>
            <Select value={turnaround} onValueChange={setTurnaround}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Standard (3 weeks)</SelectItem>
                <SelectItem value="2">Fast-Track (2 weeks)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="md:col-span-2 lg:col-span-4">
            <Button 
              type="submit" 
              disabled={createProjectMutation.isPending}
              className="inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
