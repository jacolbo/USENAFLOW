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

// Helper function to get Monday of the current week
const getWeekStart = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = day === 0 ? -6 : 1 - day; // adjust Sunday to previous Monday
  d.setDate(d.getDate() + diff);
  return d;
};

// Helper function to format date range for display
const formatWeekRange = (monday: Date) => {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${formatDate(monday)} – ${formatDate(sunday)}`;
};

// Generate week options (current week + 4 weeks ahead)
const generateWeekOptions = () => {
  const currentWeekStart = getWeekStart(new Date());
  const options = [];
  
  for (let i = 0; i < 5; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() + (i * 7));
    
    options.push({
      value: weekStart.toISOString(),
      label: `Week of ${formatWeekRange(weekStart)}`
    });
  }
  
  return options;
};

export function AddProjectForm({ onAddProject }: AddProjectFormProps) {
  const [clientName, setClientName] = useState("");
  const [packageCount, setPackageCount] = useState("");
  const [selectedCount, setSelectedCount] = useState("");
  const [totalPhotos, setTotalPhotos] = useState("");
  const [dueWeek, setDueWeek] = useState("");

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
      setTotalPhotos("");
      setDueWeek("");
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
    
    if (!clientName || !packageCount || !selectedCount || !totalPhotos || !dueWeek) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    const pkgCount = parseInt(packageCount, 10);
    const selCount = parseInt(selectedCount, 10);
    const totalCount = parseInt(totalPhotos, 10);

    if (isNaN(pkgCount) || isNaN(selCount) || isNaN(totalCount)) {
      toast({
        title: "Validation Error",
        description: "Package, Selected, and Total counts must be numbers.",
        variant: "destructive",
      });
      return;
    }

    if (selCount > totalCount) {
      toast({
        title: "Validation Error",
        description: "Selected count cannot be greater than total photos.",
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate({
      clientName,
      packageCount: pkgCount,
      selectedCount: selCount,
      totalPhotos: totalCount,
      dueDate: dueWeek,
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <Label htmlFor="total">Total Photos</Label>
            <Input
              id="total"
              type="number"
              value={totalPhotos}
              onChange={(e) => setTotalPhotos(e.target.value)}
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
            <Label htmlFor="dueWeek">Slot into Week</Label>
            <Select value={dueWeek} onValueChange={setDueWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {generateWeekOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="md:col-span-2 lg:col-span-5">
            <Button 
              type="submit" 
              disabled={createProjectMutation.isPending}
              className="inline-flex items-center gap-2 bg-black hover:bg-gray-800 text-white"
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
