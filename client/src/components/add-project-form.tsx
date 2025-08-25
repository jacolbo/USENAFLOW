import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, Plus, DollarSign } from "lucide-react";

interface AddProjectFormProps {
  onAddProject: () => void;
  user?: any; // Current user context
}

// Helper function to get Monday of the current week
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
  const today = new Date();
  // Ensure we're working with a date that has a proper year (minimum 2024)
  if (today.getFullYear() < 2024) {
    today.setFullYear(2024);
  }
  const currentWeekStart = getWeekStart(today);
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

export function AddProjectForm({ onAddProject, user }: AddProjectFormProps) {
  const [clientName, setClientName] = useState("");
  const [packageCount, setPackageCount] = useState("");
  const [selectedCount, setSelectedCount] = useState("");
  const [dueWeek, setDueWeek] = useState("");
  const [extraPhotoPrice, setExtraPhotoPrice] = useState("");
  
  // Calculate extras in real-time
  const calculateExtras = () => {
    const pkgCount = parseInt(packageCount, 10) || 0;
    const selCount = parseInt(selectedCount, 10) || 0;
    return Math.max(0, selCount - pkgCount);
  };

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
      setDueWeek("");
      setExtraPhotoPrice("");
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
    
    if (!clientName || !packageCount || !selectedCount || !dueWeek) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate extra photo price if user is DataWrangler and there are extras
    const extras = calculateExtras();
    if (user?.role === "DataWrangler" && extras > 0 && !extraPhotoPrice) {
      toast({
        title: "Validation Error",
        description: "Please enter the extra photo price.",
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
      dueDate: dueWeek,
      extraPhotoPrice: extraPhotoPrice ? parseFloat(extraPhotoPrice) * 100 : undefined, // Convert to cents
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
            {packageCount && selectedCount && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Extras: {calculateExtras()} photos
              </div>
            )}
          </div>

          {/* Extra Photo Price - Only for DataWrangler when there are extras */}
          {user?.role === "DataWrangler" && calculateExtras() > 0 && (
            <div className="space-y-2">
              <Label htmlFor="extraPrice" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Price per Extra Photo (R)
              </Label>
              <Input
                id="extraPrice"
                type="number"
                step="0.01"
                min="0"
                value={extraPhotoPrice}
                onChange={(e) => setExtraPhotoPrice(e.target.value)}
                placeholder="25.00"
                required
              />
              <div className="text-xs text-gray-500">
                Total: R{extraPhotoPrice ? (parseFloat(extraPhotoPrice) * calculateExtras()).toFixed(2) : '0.00'} ({calculateExtras()} extras)
              </div>
            </div>
          )}
          
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
          
          <div className="md:col-span-2 lg:col-span-4">
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
