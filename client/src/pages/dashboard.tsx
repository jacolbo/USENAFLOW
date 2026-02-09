import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { LoginForm } from "@/components/login-form";
import { SettingsPanel } from "@/components/settings-panel";
import { AddProjectForm } from "@/components/add-project-form";
import { TaskTable } from "@/components/task-table";
import { TeamAnalytics } from "@/components/team-analytics";
import { ShootTrackerWidget } from "@/components/shoot-tracker-widget";
import { DailyQuote } from "@/components/daily-quote";
import { NotificationCenter } from "@/components/notification-center";
import { TradeOfferModal } from "@/components/TradeOfferModal";
import { ComplaintsCalendar } from "@/components/complaints-calendar";

import { WRUButton } from "@/components/WRUButton";
import { useSSE } from "@/hooks/use-sse";
import { User } from "@/lib/types";
import { Project } from "@shared/schema";
import { User as UserIcon, LogOut, Settings, Archive, ArrowRightLeft, DollarSign, AlertTriangle, Calendar, MessageCircle, LayoutDashboard, Gift, Crown, RefreshCw, Mail, MoreHorizontal, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import logoImage from "@assets/USENA-FLOW_1754522507856.png";
import { WidgetCustomizer, useWidgetPreferences } from "@/components/widget-customizer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ApiUser {
  id: string;
  username: string;
  name: string;
  role: string;
  abbreviation: string;
}

// Extra Photos Sales View Component
function ExtraPhotosSalesView({ projects }: { projects: Project[] }) {
  const currentWeek = new Date();
  const startOfWeek = new Date(currentWeek);
  startOfWeek.setDate(currentWeek.getDate() - currentWeek.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const currentMonth = new Date();
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  // Filter projects for current week
  const weeklyProjects = projects.filter(project => {
    const projectDate = new Date(project.createdAt);
    return projectDate >= startOfWeek && projectDate <= endOfWeek && project.extras > 0;
  });

  // Filter projects for current month  
  const monthlyProjects = projects.filter(project => {
    const projectDate = new Date(project.createdAt);
    return projectDate >= startOfMonth && projectDate <= endOfMonth && project.extras > 0;
  });

  // Calculate totals
  const weeklyExtras = weeklyProjects.reduce((sum, project) => sum + (project.extras || 0), 0);
  const weeklyRevenue = weeklyProjects.reduce((sum, project) => sum + ((project.extraPhotoPrice || 0) * (project.extras || 0)), 0);
  
  const monthlyExtras = monthlyProjects.reduce((sum, project) => sum + (project.extras || 0), 0);
  const monthlyRevenue = monthlyProjects.reduce((sum, project) => sum + ((project.extraPhotoPrice || 0) * (project.extras || 0)), 0);

  const weekName = `Week of ${startOfWeek.toLocaleDateString()}`;
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Sales Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Extra Photos Sales</h2>
              <p className="text-sm text-gray-600">Weekly and monthly extra photo statistics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly and Monthly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <h3 className="text-lg font-semibold text-gray-900">This Week</h3>
          </div>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">{weekName}</div>
            <div className="text-3xl font-bold text-blue-600">{weeklyExtras}</div>
            <div className="text-sm text-gray-500">Extra photos sold</div>
            <div className="text-xl font-semibold text-green-600">
              R{(weeklyRevenue / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Revenue from extras</div>
            <div className="text-sm text-gray-600">
              {weeklyProjects.length} projects with extras
            </div>
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-4 rounded-full bg-purple-500"></div>
            <h3 className="text-lg font-semibold text-gray-900">This Month</h3>
          </div>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">{monthName}</div>
            <div className="text-3xl font-bold text-purple-600">{monthlyExtras}</div>
            <div className="text-sm text-gray-500">Extra photos sold</div>
            <div className="text-xl font-semibold text-green-600">
              R{(monthlyRevenue / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Revenue from extras</div>
            <div className="text-sm text-gray-600">
              {monthlyProjects.length} projects with extras
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects with Extras */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Projects with Extra Photos</h3>
          <p className="text-sm text-gray-600">Latest projects that included extra photo charges</p>
        </div>
        <div className="divide-y divide-gray-200">
          {monthlyProjects.slice(0, 10).map((project, index) => (
            <div key={project.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {project.clientName}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-purple-600">
                    +{project.extras} extra photos
                  </div>
                  <div className="text-xs text-green-600">
                    R{((project.extraPhotoPrice || 0) * (project.extras || 0) / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {monthlyProjects.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No extra photos sold this month
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Commission View Component
function CommissionView({ user }: { user: User }) {
  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  
  // Query commission data for the current user
  const { data: commissions, isLoading } = useQuery({
    queryKey: ["/api/commissions", user.name],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/commissions/${encodeURIComponent(user.name)}`);
      return response.json();
    },
    enabled: user.role === "DataWrangler"
  });

  // Calculate current month totals
  const currentMonthCommissions = commissions?.filter((commission: any) => {
    const commissionDate = new Date(commission.createdAt);
    const now = new Date();
    return commissionDate.getMonth() === now.getMonth() && 
           commissionDate.getFullYear() === now.getFullYear();
  }) || [];

  const totalCommissionAmount = currentMonthCommissions.reduce((sum: number, commission: any) => 
    sum + (commission.commissionAmount || 0), 0);
  
  const totalExtraRevenue = currentMonthCommissions.reduce((sum: number, commission: any) => 
    sum + (commission.totalAmount || 0), 0);

  const commissionPercentage = 3; // 3% commission rate

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">Loading commission data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Commission Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Commissions - {currentMonth}</h2>
              <p className="text-sm text-gray-600">Your {commissionPercentage}% commission on extra photo charges</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              R{(totalCommissionAmount / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">
              {commissionPercentage}% of R{(totalExtraRevenue / 100).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Commission Breakdown */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Commission Breakdown</h3>
          <p className="text-sm text-gray-600">{currentMonthCommissions.length} projects with extra charges this month</p>
        </div>
        <div className="divide-y divide-gray-200">
          {currentMonthCommissions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No commissions recorded for {currentMonth}
            </div>
          ) : (
            currentMonthCommissions.map((commission: any, index: number) => (
              <div key={index} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      Project ID: {commission.projectId?.slice(0, 8)}...
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {commission.extraCount} extra photos @ R{(commission.extraPhotoPrice / 100).toFixed(2)} each
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600">
                      +R{(commission.commissionAmount / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {commissionPercentage}% of R{(commission.totalAmount / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Complaints View Component for Evans
function ComplaintsView() {
  const { data: complaints = [], isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/complaints"],
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateComplaintMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/complaints/${id}`, { 
        status,
        resolvedBy: status === "completed" ? "Evans" : null,
        resolvedAt: status === "completed" ? new Date() : null
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      toast({
        title: "Complaint Updated",
        description: "The complaint status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update complaint. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteComplaintMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/complaints/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      toast({
        title: "Complaint Deleted",
        description: "The complaint has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete complaint. Please try again.",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-900 mb-2">Loading complaints...</div>
          <div className="text-gray-500">Please wait while we fetch the latest issues</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <div className="text-lg font-medium text-red-600 mb-2">Error loading complaints</div>
          <div className="text-gray-500">Unable to fetch complaints at this time</div>
        </div>
      </div>
    );
  }

  const pendingComplaints = complaints.filter((c) => c.status === "pending");
  const inProgressComplaints = complaints.filter((c) => c.status === "in_progress");
  const completedComplaints = complaints.filter((c) => c.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-900">Complaints Dashboard</h2>
            <span className="text-sm text-gray-500">Issues reported by retouchers</span>
          </div>
          <div className="text-sm text-gray-600">
            {complaints?.length || 0} total complaint{(complaints?.length || 0) !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Pending Issues */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <h3 className="text-lg font-semibold text-gray-900">Pending Issues</h3>
              <span className="text-sm text-gray-500">New complaints requiring attention</span>
            </div>
            <div className="text-sm text-gray-600">
              {pendingComplaints.length} issue{pendingComplaints.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          {pendingComplaints.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending complaints - great job team! 🎉
            </div>
          ) : (
            <div className="space-y-4">
              {pendingComplaints.map((complaint: any) => (
                <ComplaintCard 
                  key={complaint.id} 
                  complaint={complaint} 
                  onUpdateStatus={(status) => updateComplaintMutation.mutate({ id: complaint.id, status })}
                  onDelete={() => deleteComplaintMutation.mutate(complaint.id)}
                  isPending={updateComplaintMutation.isPending || deleteComplaintMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In Progress Issues */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <h3 className="text-lg font-semibold text-gray-900">In Progress</h3>
              <span className="text-sm text-gray-500">Currently being worked on</span>
            </div>
            <div className="text-sm text-gray-600">
              {inProgressComplaints.length} issue{inProgressComplaints.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          {inProgressComplaints.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No issues currently in progress
            </div>
          ) : (
            <div className="space-y-4">
              {inProgressComplaints.map((complaint: any) => (
                <ComplaintCard 
                  key={complaint.id} 
                  complaint={complaint} 
                  onUpdateStatus={(status) => updateComplaintMutation.mutate({ id: complaint.id, status })}
                  onDelete={() => deleteComplaintMutation.mutate(complaint.id)}
                  isPending={updateComplaintMutation.isPending || deleteComplaintMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Completed Issues */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <h3 className="text-lg font-semibold text-gray-900">Completed</h3>
              <span className="text-sm text-gray-500">Resolved issues</span>
            </div>
            <div className="text-sm text-gray-600">
              {completedComplaints.length} issue{completedComplaints.length !== 1 ? 's' : ''} resolved
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          {completedComplaints.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No completed complaints
            </div>
          ) : (
            <div className="space-y-4">
              {completedComplaints.slice(0, 5).map((complaint: any) => (
                <ComplaintCard 
                  key={complaint.id} 
                  complaint={complaint} 
                  onUpdateStatus={(status) => updateComplaintMutation.mutate({ id: complaint.id, status })}
                  onDelete={() => deleteComplaintMutation.mutate(complaint.id)}
                  isPending={updateComplaintMutation.isPending || deleteComplaintMutation.isPending}
                  isCompleted={true}
                />
              ))}
              {completedComplaints.length > 5 && (
                <div className="text-center text-sm text-gray-500 pt-2">
                  Showing 5 most recent. {completedComplaints.length - 5} more completed issues.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Individual Complaint Card Component
function ComplaintCard({ complaint, onUpdateStatus, onDelete, isPending, isCompleted = false }: {
  complaint: any;
  onUpdateStatus: (status: string) => void;
  onDelete: () => void;
  isPending: boolean;
  isCompleted?: boolean;
}) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-red-100 text-red-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-900">Project ID:</span>
            <span className="text-sm text-gray-600">{complaint.projectId?.slice(0, 8)}...</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
              {complaint.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-800 mb-2">{complaint.issueDescription}</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Reported by: {complaint.reportedBy}</span>
            <span>Created: {formatDate(complaint.createdAt)}</span>
            <span>Due: {formatDate(complaint.requestedDueDate)}</span>
            {complaint.resolvedAt && <span>Resolved: {formatDate(complaint.resolvedAt)}</span>}
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          {!isCompleted && (
            <>
              {complaint.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => onUpdateStatus("in_progress")}
                  disabled={isPending}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Start Work
                </Button>
              )}
              {complaint.status === "in_progress" && (
                <Button
                  size="sm"
                  onClick={() => onUpdateStatus("completed")}
                  disabled={isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Mark Complete
                </Button>
              )}
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={isPending}
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReferralDashboard({ userRole }: { userRole: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: referralsList = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/referrals"],
    queryFn: async () => {
      const res = await fetch("/api/referrals", {
        headers: { "x-usena-role": userRole },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/referrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-usena-role": userRole },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      toast({ title: "Referral updated" });
    },
  });

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    submitted: "bg-orange-100 text-orange-800",
    completed: "bg-blue-100 text-blue-800",
    rewarded: "bg-green-100 text-green-800",
  };

  const statusLabels: Record<string, string> = {
    pending: "Waiting for sign-up",
    submitted: "Signed up — awaiting booking",
    completed: "Booked — reward due",
    rewarded: "Rewarded",
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="h-6 w-6 text-pink-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Referral Dashboard</h2>
            <p className="text-sm text-gray-600">Track and manage client referrals</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading referrals...</div>
        ) : referralsList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No referrals yet. Referral codes are automatically created when projects are delivered.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Referrer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Code</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Referred Client</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {referralsList.map((ref: any) => (
                  <tr key={ref.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{ref.referrerName}</div>
                      <div className="text-xs text-gray-500">{ref.referrerEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{ref.referralCode}</code>
                    </td>
                    <td className="py-3 px-4">
                      {ref.referredName ? (
                        <div>
                          <div className="font-medium text-gray-900">{ref.referredName}</div>
                          <div className="text-xs text-gray-500">{ref.referredEmail}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No referral yet</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColors[ref.status] || "bg-gray-100 text-gray-800"}`}>
                        {statusLabels[ref.status] || ref.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {ref.status === "submitted" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateMutation.mutate({ id: ref.id, status: "completed" })}
                            disabled={updateMutation.isPending}
                            className="text-xs"
                          >
                            Confirm Booked
                          </Button>
                        )}
                        {ref.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateMutation.mutate({ id: ref.id, status: "rewarded" })}
                            disabled={updateMutation.isPending}
                            className="text-xs bg-green-50 text-green-700"
                          >
                            Mark Rewarded
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// VIP Client Management Component
function VipClientDashboard({ userRole }: { userRole: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const { data: clients = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/clients"],
    queryFn: async () => {
      const res = await fetch("/api/admin/clients", {
        headers: { "x-usena-role": userRole },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-usena-role": userRole },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      toast({ title: "Client profile updated" });
      setEditingNotes(null);
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/clients/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-usena-role": userRole },
      });
      if (!res.ok) throw new Error("Failed to recalculate");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      toast({ title: "VIP Tiers Recalculated", description: `${data.recalculated} client profiles updated` });
    },
  });

  const tierColors: Record<string, string> = {
    Standard: "bg-gray-100 text-gray-700 border-gray-300",
    Silver: "bg-gray-200 text-gray-800 border-gray-400",
    Gold: "bg-amber-100 text-amber-800 border-amber-400",
    Platinum: "bg-purple-100 text-purple-800 border-purple-400",
  };

  const tierIcons: Record<string, string> = {
    Standard: "",
    Silver: "🥈",
    Gold: "🥇",
    Platinum: "💎",
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-amber-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">VIP Client Management</h2>
              <p className="text-sm text-gray-600">Track client tiers, bonus photos, and priority status</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700"
          >
            <RefreshCw className={`h-4 w-4 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
            Recalculate Tiers
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading client profiles...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No client profiles yet. Profiles are automatically created when projects are delivered.
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={() => recalculateMutation.mutate()} disabled={recalculateMutation.isPending}>
                Scan Existing Projects
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Client</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">VIP Tier</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Projects</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Bonus Photos</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Priority</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client: any) => (
                  <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{client.clientName}</div>
                      <div className="text-xs text-gray-500">{client.clientEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${tierColors[client.vipTier] || tierColors.Standard}`}>
                        {tierIcons[client.vipTier]} {client.vipTier}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-900 font-medium">{client.totalDelivered}</div>
                      <div className="text-xs text-gray-500">delivered</div>
                    </td>
                    <td className="py-3 px-4">
                      {client.bonusPhotos > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
                          +{client.bonusPhotos} bonus
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {client.priorityTurnaround ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                          ⚡ Priority
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      {editingNotes === client.id ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            className="text-xs border rounded px-2 py-1 w-full"
                            placeholder="Add notes..."
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => updateMutation.mutate({ id: client.id, updates: { notes: notesValue } })}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7"
                            onClick={() => setEditingNotes(null)}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 truncate"
                          onClick={() => { setEditingNotes(client.id); setNotesValue(client.notes || ""); }}
                          title={client.notes || "Click to add notes"}
                        >
                          {client.notes || <span className="italic text-gray-400">Click to add notes...</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-full bg-gray-300`}></span> Standard (0-2 projects)</div>
            <div className="flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-full bg-gray-400`}></span> Silver (3-5 projects)</div>
            <div className="flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-full bg-amber-400`}></span> Gold (6-9 projects)</div>
            <div className="flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-full bg-purple-400`}></span> Platinum (10+ projects)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Data Wrangler Delay Alert Component
function DelayAlertBanner({ projects, user }: { projects: Project[]; user: User }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [targetWeekStart, setTargetWeekStart] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const overdueProjects = projects.filter(p => {
    if (!p.dueDate || !p.clientEmail) return false;
    const due = new Date(p.dueDate);
    const isPastOrThisWeek = due <= endOfWeek;
    const isNotDelivered = p.status !== "Delivered" && p.status !== "Review";
    const isNotAssigned = !p.assignedTo;
    return isPastOrThisWeek && isNotDelivered && isNotAssigned;
  });

  const sendDelayMutation = useMutation({
    mutationFn: async ({ projectId, targetWeekStart, sentBy }: { projectId: string; targetWeekStart: string; sentBy: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/send-delay-notice`, {
        targetWeekStart,
        sentBy,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Delay notice sent", description: "The client has been notified about the delay." });
      setDialogOpen(false);
      setSelectedProject(null);
      setTargetWeekStart("");
    },
    onError: () => {
      toast({ title: "Failed to send", description: "Could not send the delay notice.", variant: "destructive" });
    },
  });

  if (overdueProjects.length === 0) return null;

  const getNextMonday = () => {
    const d = new Date();
    d.setDate(d.getDate() + (8 - d.getDay()) % 7);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const formatWeekRange = (startStr: string) => {
    if (!startStr) return "";
    const start = new Date(startStr + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <h3 className="font-semibold text-orange-800">Delay Alert - Unassigned Projects Due</h3>
          <span className="ml-auto text-sm text-orange-600 font-medium">{overdueProjects.length} project{overdueProjects.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="space-y-2">
          {overdueProjects.map(project => (
            <div key={project.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-100">
              <div>
                <div className="font-medium text-gray-900">{project.clientName}</div>
                <div className="text-xs text-gray-500">
                  {project.clientEmail} • Due: {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "N/A"} • Status: {project.status}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="bg-orange-50 hover:bg-orange-100 border-orange-300 text-orange-700"
                onClick={() => {
                  setSelectedProject(project);
                  setTargetWeekStart(getNextMonday());
                  setDialogOpen(true);
                }}
              >
                <Mail className="h-3 w-3 mr-1" />
                Send Delay Notice
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Delay Notice</DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Client Name</label>
                  <div className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">{selectedProject.clientName}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Client Email</label>
                  <div className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">{selectedProject.clientEmail}</div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Target Delivery Week (Monday start)</label>
                <input
                  type="date"
                  value={targetWeekStart}
                  onChange={(e) => setTargetWeekStart(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                />
                {targetWeekStart && (
                  <div className="text-xs text-gray-500 mt-1">
                    Week of {formatWeekRange(targetWeekStart)}
                  </div>
                )}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="text-xs font-medium text-amber-700 mb-2">Email Preview:</div>
                <div className="text-sm text-gray-700">
                  <p className="mb-2">Dear {selectedProject.clientName},</p>
                  <p className="mb-2">We wanted to let you know that your photos are taking a bit longer than expected. We sincerely apologize for any inconvenience.</p>
                  {targetWeekStart && (
                    <p className="mb-2 font-medium">Your photos are now scheduled for delivery during the week of {formatWeekRange(targetWeekStart)}.</p>
                  )}
                  <p>Thank you for your patience and understanding.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => sendDelayMutation.mutate({
                    projectId: selectedProject.id,
                    targetWeekStart,
                    sentBy: user.name,
                  })}
                  disabled={!targetWeekStart || sendDelayMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {sendDelayMutation.isPending ? "Sending..." : "Send Notification"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmailTemplatesEditor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email-templates", {
        headers: { "X-Usena-Role": "Admin" },
      });
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, subject, htmlBody }: { key: string; subject: string; htmlBody: string }) => {
      const res = await fetch(`/api/admin/email-templates/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Usena-Role": "Admin" },
        body: JSON.stringify({ subject, htmlBody }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: "Template saved successfully" });
      setEditingTemplate(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/admin/email-templates/${key}/reset`, {
        method: "POST",
        headers: { "X-Usena-Role": "Admin" },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: "Template reset to default" });
      setEditingTemplate(null);
    },
  });

  const openEditor = (template: any) => {
    setEditingTemplate(template);
    setEditSubject(template.subject);
    setEditBody(template.htmlBody);
    setShowPreview(false);
  };

  const getPreviewHtml = () => {
    const sampleVars: Record<string, string> = {
      clientName: "Jane Smith",
      shootDate: "Saturday, January 15, 2026",
      deliveryWeek: "Week of February 2, 2026",
      packageCount: "50",
      selectedCount: "65",
      extras: "15",
      retoucherName: "Alex Editor",
      chatUrl: "#",
      surveyUrl: "#",
      galleryLink: "#",
      weekStartText: "February 2, 2026",
      weekEndText: "February 6, 2026",
      clientEmail: "jane@example.com",
      newMessage: "Hi Jane, your photos are looking amazing!",
      emailHeader: '<div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #1a1a1a; margin: 0; font-size: 28px;">Jepson Myles Studio</h1></div>',
      extrasSection: '<div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px 20px; margin: 25px 0;"><h3 style="color: #e65100; margin: 0 0 10px 0;">Additional Photos Selected!</h3><p style="color: #333; font-size: 14px; margin: 0;">You have selected <strong>15 extra photos</strong> beyond your package.</p></div>',
      referralSection: '<div style="background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;"><p style="color: #c2185b; font-size: 18px; font-weight: bold;">Share the Love</p></div>',
      threadHtml: "",
      sneakPeekHtml: '<div style="text-align: center; margin: 25px 0;"><p style="color: #666;">Preview photos would appear here</p></div>',
    };
    let preview = editBody;
    preview = preview.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
      return sampleVars[key] !== undefined ? sampleVars[key] : match;
    });
    return preview;
  };

  if (editingTemplate) {
    const variables = (editingTemplate.availableVariables as string[]) || [];
    return (
      <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit: {editingTemplate.name}</h2>
            <p className="text-sm text-gray-500 mt-1">Template key: {editingTemplate.templateKey}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? "Edit" : "Preview"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditingTemplate(null)}>Cancel</Button>
          </div>
        </div>

        {variables.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-700 mb-2">Available variables (click to copy):</p>
            <div className="flex flex-wrap gap-1">
              {variables.map((v: string) => (
                <button
                  key={v}
                  onClick={() => {
                    navigator.clipboard.writeText(`{{${v}}}`);
                    toast({ title: `Copied {{${v}}}` });
                  }}
                  className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 font-mono"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {showPreview ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b">
              <p className="text-sm font-medium text-gray-600">Subject: {editSubject.replace(/\{\{(\w+)\}\}/g, (_, k: string) => k === "clientName" ? "Jane Smith" : k === "retoucherName" ? "Alex Editor" : `[${k}]`)}</p>
            </div>
            <div className="p-4 bg-white" dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Subject Line</label>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Email subject..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">HTML Body</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full h-96 p-3 border rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="HTML email body..."
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Reset this template to its default? Your customizations will be lost.")) {
                resetMutation.mutate(editingTemplate.templateKey);
              }
            }}
            disabled={resetMutation.isPending}
            className="text-red-600 hover:text-red-700"
          >
            Reset to Default
          </Button>
          <Button
            onClick={() => saveMutation.mutate({ key: editingTemplate.templateKey, subject: editSubject, htmlBody: editBody })}
            disabled={saveMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saveMutation.isPending ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Mail className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Email Templates</h2>
          <p className="text-sm text-gray-600">Customize the emails sent to your clients</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading templates...</div>
      ) : (
        <div className="grid gap-3">
          {templates.map((tmpl: any) => (
            <div
              key={tmpl.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => openEditor(tmpl)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{tmpl.name}</span>
                  {tmpl.isCustomized && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Customized</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1 truncate max-w-lg">{tmpl.subject}</p>
              </div>
              <Button variant="outline" size="sm">Edit</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'login'>('login');
  const [showArchive, setShowArchive] = useState(false);
  const [showCommissions, setShowCommissions] = useState(false);
  const [showExtraPhotosSales, setShowExtraPhotosSales] = useState(false);
  const [showComplaints, setShowComplaints] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showVipClients, setShowVipClients] = useState(false);
  const [showEmailTemplates, setShowEmailTemplates] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Widget customization state - use user.id for stable per-user persistence
  // user.id is set during login from userCredentials.id (e.g., "earl", "admin", "lucky")
  const widgetUserId = user?.id || "";
  const { 
    widgetOrder, 
    hiddenWidgets, 
    isWidgetVisible, 
    handlePreferencesChange 
  } = useWidgetPreferences(widgetUserId, user?.role || "");

  // Initialize SSE for live sync and notifications
  const {
    isConnected,
    notifications,
    markNotificationAsRead,
    clearAllNotifications,
    unreadCount
  } = useSSE(user ? { id: user.role, username: user.name } : null);
  
  // Session timeout duration (2 hours in milliseconds)
  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
  const { data: apiUsers = [] } = useQuery<ApiUser[]>({
    queryKey: ["/api/users"],
  });

  const users: User[] = useMemo(() => {
    return apiUsers.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      value: u.role,
      abbr: u.abbreviation,
    }));
  }, [apiUsers]);

  const { data: allProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  // Query complaints for Evans
  const { data: complaints = [] } = useQuery<any[]>({
    queryKey: ["/api/complaints"],
    enabled: !!user && user.role === "Evans",
  });

  // Filter projects based on user role for shadow project visibility
  const visibleProjects = useMemo(() => {
    // For Sales users, only show original projects (not shadows)
    if (user?.role === 'Sales') {
      return allProjects.filter(project => !project.isRolloverShadow);
    }
    
    // For Admin and other workflow roles, show all projects including shadows
    return allProjects;
  }, [allProjects, user?.role]);

  // Filter projects based on archive view with Sunday-start weeks and unassigned rollover
  const getFilteredProjects = () => {
    const today = new Date();
    
    // Get start of current week (Sunday)
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
    currentWeekStart.setHours(0, 0, 0, 0);
    
    // Calculate week boundaries for 4 weeks: previous, current, next, next-of-next
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    
    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(currentWeekStart.getDate() + 7);
    
    const nextOfNextWeekStart = new Date(currentWeekStart);
    nextOfNextWeekStart.setDate(currentWeekStart.getDate() + 14);
    
    const nextOfNextWeekEnd = new Date(nextOfNextWeekStart);
    nextOfNextWeekEnd.setDate(nextOfNextWeekStart.getDate() + 6);
    nextOfNextWeekEnd.setHours(23, 59, 59, 999);
    
    // Archive cutoff: 2 weeks before current week
    const archiveCutoff = new Date(currentWeekStart);
    archiveCutoff.setDate(currentWeekStart.getDate() - 14);



    let filteredProjects = [];

    if (showArchive) {
      // Archive: Projects from weeks that are 2+ weeks old
      filteredProjects = visibleProjects.filter(project => {
        const projectDate = new Date(project.dueDate || project.createdAt);
        return projectDate < archiveCutoff;
      });
    } else {
      // Current: Previous week, current week, next week, and next-of-next week
      filteredProjects = visibleProjects.filter(project => {
        const projectDate = new Date(project.dueDate || project.createdAt);
        return projectDate >= previousWeekStart && projectDate <= nextOfNextWeekEnd;
      });
    }

    return filteredProjects;
  };

  const projects = getFilteredProjects();
  
  // Get counts for both current and archive for the button display (Sunday-start)
  const getCurrentProjectCount = () => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    
    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(currentWeekStart.getDate() + 7);
    
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
    nextWeekEnd.setHours(23, 59, 59, 999);
    
    // Include projects in 3-week window
    const inCurrentRange = visibleProjects.filter(project => {
      const projectDate = new Date(project.dueDate || project.createdAt);
      return projectDate >= previousWeekStart && projectDate <= nextWeekEnd;
    }).length;

    return inCurrentRange;
  };
  
  const getArchiveProjectCount = () => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const archiveCutoff = new Date(currentWeekStart);
    archiveCutoff.setDate(currentWeekStart.getDate() - 14);
    
    return visibleProjects.filter(project => {
      const projectDate = new Date(project.dueDate || project.createdAt);
      return projectDate < archiveCutoff;
    }).length;
  };

  // Valid roles that should have access to different features
  const VALID_RETOUCHER_ROLES = ['Retoucher1', 'Retoucher2', 'Retoucher3'];
  const VALID_ROLES = ['Admin', 'LeadRetoucher', 'Sales', 'DataWrangler', 'Evans', ...VALID_RETOUCHER_ROLES];

  // Check for existing session on component mount and periodically
  useEffect(() => {
    const storedUser = getStoredSession();
    if (storedUser && !user) {
      // Validate that the stored role is still valid - clear stale sessions with outdated roles
      if (!VALID_ROLES.includes(storedUser.role)) {
        console.log('Clearing stale session with invalid role:', storedUser.role);
        clearSession();
        return;
      }
      
      setUser(storedUser);
    }

    // Set up interval to check session expiry every minute
    const sessionCheckInterval = setInterval(() => {
      if (user) {
        const storedUser = getStoredSession();
        if (!storedUser) {
          // Session expired, log out user
          setUser(null);
          setCurrentView('login');
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(sessionCheckInterval);
  }, [user]); // Dependencies: user state and users array

  // Session management functions
  const saveSession = (user: User) => {
    const sessionData = {
      user,
      timestamp: Date.now()
    };
    localStorage.setItem('usenaflow_session', JSON.stringify(sessionData));
    // Also store role and user name separately for editor chat authentication
    // Use user.name because project assignments use names, not IDs
    localStorage.setItem('usena_role', user.role);
    localStorage.setItem('usena_user_id', user.name || user.id || '');
  };

  const getStoredSession = () => {
    try {
      const sessionStr = localStorage.getItem('usenaflow_session');
      if (!sessionStr) return null;
      
      const sessionData = JSON.parse(sessionStr);
      const currentTime = Date.now();
      
      // Check if session is expired (older than 2 hours)
      if (currentTime - sessionData.timestamp > SESSION_TIMEOUT) {
        localStorage.removeItem('usenaflow_session');
        localStorage.removeItem('usena_role');
        localStorage.removeItem('usena_user_id');
        return null;
      }
      
      // Ensure chat auth keys are set (for backward compatibility)
      // Use name because project assignments use names, not IDs
      const storedUser = sessionData.user;
      if (storedUser) {
        localStorage.setItem('usena_role', storedUser.role);
        localStorage.setItem('usena_user_id', storedUser.name || storedUser.id || '');
      }
      
      return storedUser;
    } catch (error) {
      localStorage.removeItem('usenaflow_session');
      localStorage.removeItem('usena_role');
      localStorage.removeItem('usena_user_id');
      return null;
    }
  };

  const clearSession = () => {
    localStorage.removeItem('usenaflow_session');
    localStorage.removeItem('usena_role');
    localStorage.removeItem('usena_user_id');
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('login');
    saveSession(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('login');
    clearSession();
  };

  // Manual rollover mutation
  const manualRolloverMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rollover");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rollover Complete",
        description: "Unassigned projects from past weeks have been moved to this week.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      console.error("Manual rollover error:", error);
      toast({
        title: "Rollover Failed",
        description: "Failed to rollover projects. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Manual rollback mutation
  const manualRollbackMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rollback-from-next-week");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rollback Complete",
        description: "Unassigned projects have been moved back to current week.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      console.error("Manual rollback error:", error);
      toast({
        title: "Rollback Failed",
        description: "Failed to rollback projects. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleManualRollover = () => {
    if (window.confirm("Are you sure you want to move all unassigned projects from past weeks to this week?")) {
      manualRolloverMutation.mutate();
    }
  };

  const handleManualRollback = () => {
    if (window.confirm("Are you sure you want to move all unassigned projects from next Sunday back to this Sunday?")) {
      manualRollbackMutation.mutate();
    }
  };

  if (!user) {
    return (
      <LoginForm 
        onLogin={handleLogin}
        onShowRegister={() => {}}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-lg">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src={logoImage} 
                  alt="USENA FLOW" 
                  className="h-12 mr-2"
                />
                <span className="text-sm text-gray-600">by Jepson Myles Studio</span>
              </div>
              <div className="flex items-center space-x-4">
                {user && (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.name}</span>
                        <span className="text-xs text-gray-500">
                          {user.role === "LeadRetoucher" ? "Workflow Manager" : user.role}
                        </span>
                      </div>
                    </div>
                    
                    {/* Notification Center */}
                    <NotificationCenter
                      notifications={notifications}
                      unreadCount={unreadCount}
                      isConnected={isConnected}
                      onMarkAsRead={markNotificationAsRead}
                      onClearAll={clearAllNotifications}
                    />

                    {/* Archive Button - always visible */}
                    <Button 
                      variant={showArchive ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setShowArchive(!showArchive);
                        setShowCommissions(false);
                        setShowExtraPhotosSales(false);
                        setShowReferrals(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      {showArchive ? `Current (${getCurrentProjectCount()})` : `Archive (${getArchiveProjectCount()})`}
                    </Button>

                    {/* Client Messages Button - for messaging roles */}
                    {['Admin', 'LeadRetoucher', 'Retoucher1', 'Retoucher2', 'Retoucher3', 'Evans'].includes(user.role) && (
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation('/editor-chat')}
                        className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Messages
                      </Button>
                    )}

                    {/* Tools Dropdown - groups operational tools */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <Wrench className="h-4 w-4" />
                          Tools
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {/* Trade Project - Retouchers and Admin */}
                        {(['Retoucher1', 'Retoucher2', 'Retoucher3', 'Retoucher'].includes(user.role) || user.role === "Admin") && (
                          <DropdownMenuItem
                            onClick={() => setShowTradeModal(true)}
                            data-testid="button-open-trade-modal"
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Trade Project
                          </DropdownMenuItem>
                        )}

                        {/* ShootTracker - Admin, LeadRetoucher, DataWrangler */}
                        {['Admin', 'LeadRetoucher', 'DataWrangler'].includes(user.role) && (
                          <DropdownMenuItem onClick={() => setLocation('/shoottracker')}>
                            <Calendar className="h-4 w-4 mr-2" />
                            ShootTracker
                          </DropdownMenuItem>
                        )}

                        {/* Commissions - DataWrangler */}
                        {user.role === "DataWrangler" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setShowCommissions(!showCommissions);
                              setShowArchive(false);
                              setShowExtraPhotosSales(false);
                              setShowComplaints(false);
                              setShowReferrals(false);
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Commissions
                            {showCommissions && <span className="ml-auto text-xs text-green-600">Active</span>}
                          </DropdownMenuItem>
                        )}

                        {/* Extra Photos Sales - Sales */}
                        {user.role === "Sales" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setShowExtraPhotosSales(!showExtraPhotosSales);
                              setShowArchive(false);
                              setShowCommissions(false);
                              setShowComplaints(false);
                              setShowReferrals(false);
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Extra Photos Sales
                            {showExtraPhotosSales && <span className="ml-auto text-xs text-purple-600">Active</span>}
                          </DropdownMenuItem>
                        )}

                        {/* Complaints - Evans */}
                        {user.role === "Evans" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setShowComplaints(!showComplaints);
                              setShowArchive(false);
                              setShowCommissions(false);
                              setShowExtraPhotosSales(false);
                              setShowReferrals(false);
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Complaints
                            {showComplaints && <span className="ml-auto text-xs text-yellow-600">Active</span>}
                          </DropdownMenuItem>
                        )}

                        {/* Referrals - Admin and Sales */}
                        {["Admin", "Sales"].includes(user.role) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-gray-500">Client Programs</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setShowReferrals(!showReferrals);
                                setShowArchive(false);
                                setShowCommissions(false);
                                setShowExtraPhotosSales(false);
                                setShowComplaints(false);
                                setShowVipClients(false);
                                setShowEmailTemplates(false);
                              }}
                            >
                              <Gift className="h-4 w-4 mr-2" />
                              Referrals
                              {showReferrals && <span className="ml-auto text-xs text-pink-600">Active</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setShowVipClients(!showVipClients);
                                setShowArchive(false);
                                setShowCommissions(false);
                                setShowExtraPhotosSales(false);
                                setShowComplaints(false);
                                setShowReferrals(false);
                                setShowEmailTemplates(false);
                              }}
                            >
                              <Crown className="h-4 w-4 mr-2" />
                              VIP Clients
                              {showVipClients && <span className="ml-auto text-xs text-amber-600">Active</span>}
                            </DropdownMenuItem>
                          </>
                        )}

                        {/* Admin Tools Section */}
                        {user.role === "Admin" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-gray-500">Admin</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => setShowSettingsDialog(true)}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setShowEmailTemplates(!showEmailTemplates);
                                setShowArchive(false);
                                setShowCommissions(false);
                                setShowExtraPhotosSales(false);
                                setShowComplaints(false);
                                setShowReferrals(false);
                                setShowVipClients(false);
                              }}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Email Templates
                              {showEmailTemplates && <span className="ml-auto text-xs text-blue-600">Active</span>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={handleManualRollover}
                              data-testid="button-manual-rollover"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2" />
                              Roll Forward
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={handleManualRollback}
                              data-testid="button-manual-rollback"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2 rotate-180" />
                              Roll Back
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* WRU Button for Admin */}
                    <WRUButton 
                      projects={projects} 
                      currentUser={user.name} 
                      isAdmin={user.role === "Admin"} 
                    />

                    {/* Dashboard Customizer */}
                    <WidgetCustomizer
                      userId={widgetUserId}
                      userRole={user.role}
                      onPreferencesChange={handlePreferencesChange}
                    />

                    {/* Settings Dialog (controlled by state, opened from dropdown) */}
                    {user.role === "Admin" && (
                      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Settings</DialogTitle>
                          </DialogHeader>
                          <SettingsPanel
                            currentUser={user}
                          />
                        </DialogContent>
                      </Dialog>
                    )}

                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleLogout}
                      className="flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">  
          {/* Widgets rendered in user's preferred order */}
          {widgetOrder.map((widgetId) => {
            // Daily Quote Widget
            if (widgetId === "daily_quote" && isWidgetVisible("daily_quote")) {
              return <DailyQuote key={widgetId} userId={user.value} />;
            }
            
            // My Tasks Widget - for Admin and retouchers
            if (widgetId === "my_tasks" && isWidgetVisible("my_tasks") && !showArchive && 
                (user.role === "Admin" || ["Retoucher1", "Retoucher2", "Retoucher3"].includes(user.role))) {
              const myTasks = projects.filter(p => 
                p.assignedTo && 
                p.assignedTo.toLowerCase() === user.name.toLowerCase() && 
                p.status !== "Delivered"
              );
              
              return (
                <div key={widgetId} className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UserIcon className="h-5 w-5 text-orange-600" />
                        <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
                        <span className="text-sm text-gray-500">
                          Projects assigned to me
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {myTasks.length} active task{myTasks.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {myTasks.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No tasks currently assigned to you
                      </div>
                    ) : (
                      <TaskTable 
                        projects={myTasks} 
                        user={user} 
                        allUsers={users} 
                        isPersonalView={true}
                      />
                    )}
                  </div>
                </div>
              );
            }
            
            // ShootTracker Widget
            if (widgetId === "shoottracker" && isWidgetVisible("shoottracker") && !showArchive && 
                !showCommissions && !showExtraPhotosSales && !showComplaints) {
              return (
                <div key={widgetId} className="mb-6">
                  <ShootTrackerWidget />
                </div>
              );
            }
            
            // Team Analytics Widget
            if (widgetId === "team_analytics" && isWidgetVisible("team_analytics") && !showArchive && 
                !showCommissions && !showExtraPhotosSales && !showComplaints) {
              return <TeamAnalytics key={widgetId} user={user} />;
            }
            
            // Project Table Widget
            if (widgetId === "project_table" && isWidgetVisible("project_table") && 
                user.role !== "Sales" && user.role !== "Evans" && 
                !showCommissions && !showExtraPhotosSales && !showComplaints) {
              return <TaskTable key={widgetId} projects={projects} user={user} allUsers={users} />;
            }
            
            // Pending Payments Widget (Sales only)
            if (widgetId === "pending_payments" && isWidgetVisible("pending_payments") && 
                user.role === "Sales" && !showExtraPhotosSales) {
              const pendingPaymentProjects = projects.filter(p => p.status === "Awaiting Payment");
              return (
                <div key={widgetId} className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <h2 className="text-lg font-semibold text-gray-900">Pending Payments</h2>
                        <span className="text-sm text-gray-500">Awaiting client payment</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {pendingPaymentProjects.length} project{pendingPaymentProjects.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <TaskTable 
                      projects={pendingPaymentProjects} 
                      user={user} 
                      allUsers={users} 
                      isPersonalView={true}
                    />
                  </div>
                </div>
              );
            }
            
            // Ready for Delivery Widget (Sales only)
            if (widgetId === "ready_delivery" && isWidgetVisible("ready_delivery") && 
                user.role === "Sales" && !showExtraPhotosSales) {
              const reviewProjects = projects.filter(p => p.status === "Review");
              const readyForDelivery = reviewProjects.filter(p => p.galleryLink && !p.deliveryApproved);
              const awaitingGallery = reviewProjects.filter(p => !p.galleryLink);
              return (
                <div key={widgetId} className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <h2 className="text-lg font-semibold text-gray-900">Ready for Delivery</h2>
                        <span className="text-sm text-gray-500">Completed by retouchers</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {readyForDelivery.length > 0 && (
                          <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {readyForDelivery.length} ready to send
                          </span>
                        )}
                        {awaitingGallery.length > 0 && (
                          <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            {awaitingGallery.length} awaiting gallery
                          </span>
                        )}
                        <div className="text-sm text-gray-600">
                          {reviewProjects.length} project{reviewProjects.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <TaskTable 
                      projects={reviewProjects} 
                      user={user} 
                      allUsers={users} 
                      isPersonalView={true}
                    />
                  </div>
                </div>
              );
            }
            
            return null;
          })}

          {/* Evans Complaints Calendar - Only content for Evans */}
          {user.role === "Evans" && (
            <ComplaintsCalendar 
              complaints={complaints} 
              user={{
                id: user.id || user.name || 'evans',
                name: user.name,
                role: user.role,
                value: user.value,
                abbr: user.abbr
              }} 
              onUpdateComplaint={async (complaintId, status) => {
                try {
                  await apiRequest("PATCH", `/api/complaints/${complaintId}`, { status });
                  queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
                  toast({
                    title: "Complaint updated",
                    description: `Status changed to ${status}`,
                  });
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to update complaint status",
                    variant: "destructive",
                  });
                }
              }}
            />
          )}
          
          {/* Extra Photos Sales View for Sales */}
          {user.role === "Sales" && showExtraPhotosSales && (
            <ExtraPhotosSalesView projects={allProjects || []} />
          )}
          
          {/* Referral Dashboard for Admin/Sales */}
          {["Admin", "Sales"].includes(user.role) && showReferrals && (
            <ReferralDashboard userRole={user.role} />
          )}

          {/* VIP Client Dashboard for Admin/Sales */}
          {["Admin", "Sales"].includes(user.role) && showVipClients && (
            <VipClientDashboard userRole={user.role} />
          )}

          {/* Email Templates Editor for Admin */}
          {user.role === "Admin" && showEmailTemplates && (
            <EmailTemplatesEditor />
          )}

          {/* Delay Alert Banner for DataWrangler */}
          {user.role === "DataWrangler" && !showCommissions && (
            <DelayAlertBanner projects={projects} user={user} />
          )}
          
          {/* Commission View for DataWrangler */}
          {showCommissions && user.role === "DataWrangler" && (
            <CommissionView user={user} />
          )}
          
          {/* Archive Status Header and Add Project Form for non-Sales, non-Evans roles */}
          {user.role !== "Sales" && user.role !== "Evans" && !showCommissions && (
            <>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-gray-600" />
                    <h2 className="text-lg font-semibold">
                      {user.role === "Admin" && user.name === "Anesu's Pops" && !showArchive ? 
                        "All Projects" : 
                        showArchive ? "Archive Projects" : "Current Projects"
                      }
                    </h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      {projects.length} project{projects.length !== 1 ? 's' : ''} {showArchive ? 'archived' : 'current'}
                    </div>
                    {!showArchive && (
                      <div className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        📸 {projects.reduce((total, p) => total + (p.selectedCount || 0), 0)} photos total
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Show project creation form for non-Sales roles that can add projects - only in current view */}
              {!showArchive && !['Retoucher1', 'Retoucher2', 'Retoucher3', 'Retoucher'].includes(user.role) && (
                <AddProjectForm onAddProject={() => {}} user={user} />
              )}
            </>
          )}



        </div>
      </div>

      {/* Trade Offer Modal */}
      <TradeOfferModal
        open={showTradeModal}
        onOpenChange={setShowTradeModal}
        currentUser={user.name}
        projects={projects}
      />
    </div>
  );
}
