import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowRightLeft, Send, X, Clock, User, Calendar } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, TradeOffer, InsertTradeOffer } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TradeOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: string;
  projects: Project[];
}

export function TradeOfferModal({ open, onOpenChange, currentUser, projects }: TradeOfferModalProps) {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [targetUser, setTargetUser] = useState<string>("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user's assigned projects only
  const userProjects = projects.filter(project => 
    project.assignedTo === currentUser && 
    project.status !== "Delivered"
  );

  // Get all unique assignees for target user selection
  const allAssignees = Array.from(new Set(projects
    .filter(p => p.assignedTo && p.assignedTo !== currentUser && p.status !== "Delivered")
    .map(p => p.assignedTo)
  )).filter(Boolean) as string[];

  const createTradeMutation = useMutation({
    mutationFn: async (data: InsertTradeOffer) => {
      return apiRequest("/api/trade-offers", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Trade Offer Created",
        description: "Your trade offer has been sent successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trade-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create trade offer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedProject("");
    setTargetUser("");
    setMessage("");
  };

  const handleSubmit = () => {
    if (!selectedProject) {
      toast({
        title: "Missing Information",
        description: "Please select a project to offer for trade.",
        variant: "destructive",
      });
      return;
    }

    const tradeData: InsertTradeOffer = {
      offeringUser: currentUser,
      offeringProjectId: selectedProject,
      targetUser: targetUser === "__ANYONE__" ? null : (targetUser || null),
      requestedProjectId: null,
      message: message || null,
      status: "pending",
      acceptedBy: null,
      acceptedProjectId: null,
    };

    createTradeMutation.mutate(tradeData);
  };

  const selectedProjectData = userProjects.find(p => p.id === selectedProject);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="modal-trade-offer">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ArrowRightLeft className="h-5 w-5 text-blue-500" />
            Create Trade Offer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Selection */}
          <div className="space-y-3">
            <Label htmlFor="project-select">Your Project to Trade</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger data-testid="select-project-offer">
                <SelectValue placeholder="Select one of your projects..." />
              </SelectTrigger>
              <SelectContent>
                {userProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {project.status}
                      </Badge>
                      <span>{project.clientName}</span>
                      <span className="text-muted-foreground">
                        ({project.selectedCount} photos)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedProjectData && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{selectedProjectData.clientName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedProjectData.selectedCount} photos • Due: {new Date(selectedProjectData.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary">{selectedProjectData.status}</Badge>
                </div>
              </motion.div>
            )}
          </div>

          <Separator />

          {/* Target User Selection */}
          <div className="space-y-3">
            <Label htmlFor="target-user">Target User (Optional)</Label>
            <Select value={targetUser} onValueChange={setTargetUser}>
              <SelectTrigger data-testid="select-target-user">
                <SelectValue placeholder="Anyone can accept (leave empty) or select specific user..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ANYONE__">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Open to Anyone</span>
                  </div>
                </SelectItem>
                {allAssignees.map((assignee) => (
                  <SelectItem key={assignee} value={assignee}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{assignee}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional Message */}
          <div className="space-y-3">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              data-testid="input-trade-message"
              placeholder="Add a message to explain why you want to trade this project..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              data-testid="button-cancel-trade"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedProject || createTradeMutation.isPending}
              className="flex-1"
              data-testid="button-submit-trade"
            >
              {createTradeMutation.isPending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Trade Offer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}