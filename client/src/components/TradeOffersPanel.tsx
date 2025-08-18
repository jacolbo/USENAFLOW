import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowRightLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  User, 
  Calendar,
  MessageSquare,
  ArrowRight
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TradeOffer, Project } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TradeOffersPanelProps {
  currentUser: string;
  projects: Project[];
  isAdmin?: boolean;
}

export function TradeOffersPanel({ currentUser, projects, isAdmin = false }: TradeOffersPanelProps) {
  const [selectedOffer, setSelectedOffer] = useState<TradeOffer | null>(null);
  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [selectedProjectForTrade, setSelectedProjectForTrade] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch trade offers
  const { data: tradeOffers = [], isLoading } = useQuery({
    queryKey: isAdmin ? ["/api/admin/trade-offers"] : ["/api/trade-offers", currentUser],
    queryFn: () => {
      const endpoint = isAdmin ? "/api/admin/trade-offers" : `/api/trade-offers?username=${encodeURIComponent(currentUser)}`;
      return apiRequest("GET", endpoint);
    },
  }) as { data: TradeOffer[], isLoading: boolean };

  // Get user's available projects for trading
  const userProjects = projects.filter(project => 
    project.assignedTo === currentUser && 
    project.status !== "Delivered"
  );

  // Accept trade mutation
  const acceptTradeMutation = useMutation({
    mutationFn: async ({ offerId, acceptedProjectId }: { offerId: string; acceptedProjectId: string }) => {
      return apiRequest("POST", `/api/trade-offers/${offerId}/accept`, {
        acceptedBy: currentUser,
        acceptedProjectId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Trade Accepted",
        description: "Projects have been successfully swapped!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trade-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setAcceptingOffer(null);
      setSelectedProjectForTrade("");
      setSelectedOffer(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to accept trade offer. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Decline trade mutation
  const declineTradeMutation = useMutation({
    mutationFn: async (offerId: string) => {
      return apiRequest("POST", `/api/trade-offers/${offerId}/decline`, { declinedBy: currentUser });
    },
    onSuccess: () => {
      toast({
        title: "Trade Declined",
        description: "Trade offer has been declined.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trade-offers"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to decline trade offer.",
        variant: "destructive",
      });
    },
  });

  const getProjectDetails = (projectId: string) => {
    return projects.find(p => p.id === projectId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "accepted": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "declined": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "completed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4" />;
      case "accepted": 
      case "completed": return <CheckCircle className="h-4 w-4" />;
      case "declined": return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const canAcceptOffer = (offer: TradeOffer) => {
    return offer.status === "pending" && 
           offer.offeringUser !== currentUser &&
           (offer.targetUser === null || offer.targetUser === currentUser);
  };

  const handleAcceptOffer = (offer: TradeOffer) => {
    setAcceptingOffer(offer.id);
    setSelectedOffer(offer);
  };

  const handleConfirmAccept = () => {
    if (acceptingOffer && selectedProjectForTrade) {
      acceptTradeMutation.mutate({
        offerId: acceptingOffer,
        acceptedProjectId: selectedProjectForTrade,
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {isAdmin ? "All Trade Offers" : "Trade Offers"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="panel-trade-offers">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {isAdmin ? "All Trade Offers" : "Trade Offers"}
            {tradeOffers.length > 0 && (
              <Badge variant="secondary">{tradeOffers.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AnimatePresence>
            {tradeOffers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No trade offers at the moment</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tradeOffers.map((offer, index) => {
                  const offeringProject = getProjectDetails(offer.offeringProjectId);
                  const acceptedProject = offer.acceptedProjectId ? getProjectDetails(offer.acceptedProjectId) : null;

                  return (
                    <motion.div
                      key={offer.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{offer.offeringUser}</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {offer.targetUser || "Anyone"}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {new Date(offer.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <Badge className={getStatusColor(offer.status)}>
                          {getStatusIcon(offer.status)}
                          <span className="ml-1 capitalize">{offer.status}</span>
                        </Badge>
                      </div>

                      {offeringProject && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{offeringProject.clientName}</p>
                              <p className="text-sm text-muted-foreground">
                                {offeringProject.selectedCount} photos • Due: {new Date(offeringProject.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="outline">{offeringProject.status}</Badge>
                          </div>
                        </div>
                      )}

                      {offer.message && (
                        <div className="flex items-start gap-2 text-sm">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-muted-foreground italic">"{offer.message}"</p>
                        </div>
                      )}

                      {acceptedProject && (
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                            Traded with: {acceptedProject.clientName}
                          </p>
                          <div className="bg-green-50 dark:bg-green-950/20 rounded p-3">
                            <p className="font-medium">{acceptedProject.clientName}</p>
                            <p className="text-sm text-muted-foreground">
                              {acceptedProject.selectedCount} photos • Due: {new Date(acceptedProject.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )}

                      {canAcceptOffer(offer) && !isAdmin && (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleAcceptOffer(offer)}
                            data-testid={`button-accept-offer-${offer.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => declineTradeMutation.mutate(offer.id)}
                            data-testid={`button-decline-offer-${offer.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Accept Trade Modal */}
      <Dialog open={!!acceptingOffer} onOpenChange={(open) => !open && setAcceptingOffer(null)}>
        <DialogContent data-testid="modal-accept-trade">
          <DialogHeader>
            <DialogTitle>Accept Trade Offer</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select one of your projects to trade in exchange:
            </p>
            
            <Select value={selectedProjectForTrade} onValueChange={setSelectedProjectForTrade}>
              <SelectTrigger data-testid="select-project-exchange">
                <SelectValue placeholder="Select your project to trade..." />
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

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setAcceptingOffer(null)}
                className="flex-1"
                data-testid="button-cancel-accept"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmAccept}
                disabled={!selectedProjectForTrade || acceptTradeMutation.isPending}
                className="flex-1"
                data-testid="button-confirm-accept"
              >
                {acceptTradeMutation.isPending ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Confirm Trade
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}