import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, ArrowRightLeft, TrendingUp } from "lucide-react";
import { TradeOffersPanel } from "./TradeOffersPanel";
import type { Project } from "@shared/schema";

interface WRUButtonProps {
  projects: Project[];
  currentUser: string;
  isAdmin: boolean;
}

export function WRUButton({ projects, currentUser, isAdmin }: WRUButtonProps) {
  const [showWRUModal, setShowWRUModal] = useState(false);

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={() => setShowWRUModal(true)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
          data-testid="button-wru"
        >
          <Eye className="h-4 w-4 mr-2" />
          WRU
          <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
            Admin
          </Badge>
        </Button>
      </motion.div>

      <Dialog open={showWRUModal} onOpenChange={setShowWRUModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="modal-wru">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <TrendingUp className="h-6 w-6 text-purple-500" />
              WRU - Admin Overview
              <Badge variant="outline" className="ml-auto">
                Real-time Monitoring
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Trade Offers Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                Active Trade Offers
              </h3>
              <TradeOffersPanel 
                currentUser={currentUser} 
                projects={projects} 
                isAdmin={true}
              />
            </div>

            {/* Additional Admin Analytics can be added here in the future */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-5 w-5 text-purple-500" />
                <h4 className="font-medium text-purple-900 dark:text-purple-100">
                  Admin Visibility Features
                </h4>
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                <p>• Monitor all trade offers across the team</p>
                <p>• Track project swaps and assignments in real-time</p>
                <p>• Maintain transparency in workflow management</p>
                <p>• Ensure fair distribution of workload</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setShowWRUModal(false)}
              data-testid="button-close-wru"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}