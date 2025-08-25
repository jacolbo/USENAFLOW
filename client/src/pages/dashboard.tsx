import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoginForm } from "@/components/login-form";
import { RegisterForm } from "@/components/register-form";
import { SettingsPanel } from "@/components/settings-panel";
import { AddProjectForm } from "@/components/add-project-form";
import { TaskTable } from "@/components/task-table";
import { TeamAnalytics } from "@/components/team-analytics";
import { DailyQuote } from "@/components/daily-quote";
import { NotificationCenter } from "@/components/notification-center";
import { TradeOfferModal } from "@/components/TradeOfferModal";

import { WRUButton } from "@/components/WRUButton";
import { useSSE } from "@/hooks/use-sse";
import { User } from "@/lib/types";
import { Project } from "@shared/schema";
import { User as UserIcon, LogOut, Settings, Archive, ArrowRightLeft, DollarSign } from "lucide-react";
import logoImage from "@assets/USENA-FLOW_1754522507856.png";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface UserCredential {
  username: string;
  password: string;
  role: string;
  name: string;
  abbr: string;
  id?: string;
}

interface UserCredentials {
  id: string;
  username: string;
  password: string;
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
                    {new Date(project.createdAt).toLocaleDateString()} • {project.clientName}
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

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');
  const [showArchive, setShowArchive] = useState(false);
  const [showCommissions, setShowCommissions] = useState(false);
  const [showExtraPhotosSales, setShowExtraPhotosSales] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const [users, setUsers] = useState<User[]>([
    { id: "1", name: "Earl", role: "Retoucher", value: "Retoucher1", abbr: "EC" },
    { id: "2", name: "Dr Asa", role: "Retoucher", value: "Retoucher2", abbr: "ASA" },
    { id: "3", name: "Lucky", role: "Retoucher", value: "Retoucher3", abbr: "LM" },
    { id: "4", name: "Anesu's Pops", role: "Admin", value: "Admin", abbr: "AP" },
    // Default system users without IDs (cannot be edited/deleted)
    { name: "Admin", role: "Admin", value: "Admin" },
    { name: "Sales", role: "Sales", value: "Sales" },
    { name: "Workflow Manager", role: "LeadRetoucher", value: "LeadRetoucher" },
    { name: "Data Wrangler", role: "DataWrangler", value: "DataWrangler" },
  ]);

  // User credentials for login/register system
  const [userCredentials, setUserCredentials] = useState<UserCredentials[]>([
    { id: "admin", username: "admin", password: "admin720", role: "Admin", name: "Anesu's Pops", abbreviation: "AP" },
    { id: "sales", username: "sales", password: "sales420", role: "Sales", name: "Sales", abbreviation: "SAL" },
    { id: "workflow", username: "workflow", password: "Chabs360", role: "LeadRetoucher", name: "Workflow Manager", abbreviation: "WFM" },
    { id: "data", username: "data", password: "Data360", role: "DataWrangler", name: "Data Wrangler", abbreviation: "DW" },
    { id: "earl", username: "earl", password: "earl123", role: "Retoucher", name: "Earl", abbreviation: "EC" },
    { id: "asa", username: "asa", password: "asa123", role: "Retoucher", name: "Dr Asa", abbreviation: "ASA" },
    // Single working account for Lucky with all his projects
    { id: "lucky", username: "lucky", password: "lucky123", role: "Retoucher", name: "Lucky", abbreviation: "LM" },
  ]);

  const { data: allProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  // Filter projects based on archive view with Sunday-start weeks and unassigned rollover
  const getFilteredProjects = () => {
    const today = new Date();
    
    // Get start of current week (Sunday)
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
    currentWeekStart.setHours(0, 0, 0, 0);
    
    // Calculate week boundaries
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    
    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(currentWeekStart.getDate() + 7);
    
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
    nextWeekEnd.setHours(23, 59, 59, 999);
    
    // Archive cutoff: 2 weeks before current week
    const archiveCutoff = new Date(currentWeekStart);
    archiveCutoff.setDate(currentWeekStart.getDate() - 14);



    let filteredProjects = [];

    if (showArchive) {
      // Archive: Projects from weeks that are 2+ weeks old
      filteredProjects = allProjects.filter(project => {
        const projectDate = new Date(project.dueDate || project.createdAt);
        return projectDate < archiveCutoff;
      });
    } else {
      // Current: Previous week, current week, and next week
      filteredProjects = allProjects.filter(project => {
        const projectDate = new Date(project.dueDate || project.createdAt);
        return projectDate >= previousWeekStart && projectDate <= nextWeekEnd;
      });

      // Handle unassigned project rollover for current view
      const unassignedFromPastWeeks = allProjects.filter(project => {
        const projectDate = new Date(project.dueDate || project.createdAt);
        return projectDate < previousWeekStart && (!project.assignedTo || project.assignedTo === "__UNASSIGN__");
      });

      // Merge and sort: unassigned projects first (by creation date), then regular projects
      const sortedUnassigned = unassignedFromPastWeeks.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      filteredProjects = [...sortedUnassigned, ...filteredProjects];
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
    
    // Include projects in 3-week window plus unassigned rollover
    const inCurrentRange = allProjects.filter(project => {
      const projectDate = new Date(project.dueDate || project.createdAt);
      return projectDate >= previousWeekStart && projectDate <= nextWeekEnd;
    }).length;

    const unassignedRollover = allProjects.filter(project => {
      const projectDate = new Date(project.dueDate || project.createdAt);
      return projectDate < previousWeekStart && (!project.assignedTo || project.assignedTo === "__UNASSIGN__");
    }).length;

    return inCurrentRange + unassignedRollover;
  };
  
  const getArchiveProjectCount = () => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const archiveCutoff = new Date(currentWeekStart);
    archiveCutoff.setDate(currentWeekStart.getDate() - 14);
    
    return allProjects.filter(project => {
      const projectDate = new Date(project.dueDate || project.createdAt);
      return projectDate < archiveCutoff;
    }).length;
  };

  // Check for existing session on component mount and periodically
  useEffect(() => {
    const storedUser = getStoredSession();
    if (storedUser && !user) {
      setUser(storedUser);
      // Sync with users array for consistency
      const existingUserIndex = users.findIndex(u => u.name === storedUser.name);
      if (existingUserIndex === -1) {
        setUsers(prev => [...prev, storedUser]);
      }
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
        return null;
      }
      
      return sessionData.user;
    } catch (error) {
      localStorage.removeItem('usenaflow_session');
      return null;
    }
  };

  const clearSession = () => {
    localStorage.removeItem('usenaflow_session');
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('login');
    saveSession(loggedInUser);
    
    // Sync with users array for consistency
    const existingUserIndex = users.findIndex(u => u.name === loggedInUser.name);
    if (existingUserIndex === -1) {
      setUsers(prev => [...prev, loggedInUser]);
    }
  };

  const handleRegister = (newUserCredential: UserCredential) => {
    // Convert to UserCredentials format and add to credentials array
    const newCredentials: UserCredentials = {
      id: newUserCredential.id || Date.now().toString(),
      username: newUserCredential.username,
      password: newUserCredential.password,
      name: newUserCredential.name,
      role: newUserCredential.role,
      abbreviation: newUserCredential.abbr
    };
    setUserCredentials(prev => [...prev, newCredentials]);
    
    // Create User object for immediate login
    const newUser: User = {
      id: newUserCredential.id,
      name: newUserCredential.name,
      role: newUserCredential.role,
      value: newUserCredential.role === "Retoucher" ? `${newUserCredential.name}_${Date.now()}` : newUserCredential.role,
      abbr: newUserCredential.abbr
    };
    
    // Auto-login after registration
    handleLogin(newUser);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('login');
    clearSession();
  };

  const handleUpdateUserCredentials = (credentials: UserCredentials[]) => {
    setUserCredentials(credentials);
  };

  const handleAddUser = (newUser: User) => {
    setUsers(prev => [...prev, newUser]);
  };

  const handleEditUser = (userId: string, updatedUser: Partial<User>) => {
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, ...updatedUser } : u
    ));
    
    // If editing the current user, update the user state
    if (user && user.id === userId) {
      setUser(prev => prev ? { ...prev, ...updatedUser } : null);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    
    // If deleting the current user, reset to null
    if (user && user.id === userId) {
      setUser(null);
    }
  };

  // Manual rollover mutation
  const manualRolloverMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rollover-next-week");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rollover Complete",
        description: "Unassigned projects have been moved to next week.",
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
    if (window.confirm("Are you sure you want to move all unassigned projects from this Sunday to next Sunday?")) {
      manualRolloverMutation.mutate();
    }
  };

  const handleManualRollback = () => {
    if (window.confirm("Are you sure you want to move all unassigned projects from next Sunday back to this Sunday?")) {
      manualRollbackMutation.mutate();
    }
  };

  // Show login/register form if user is not logged in
  if (!user) {
    if (currentView === 'register') {
      return (
        <RegisterForm 
          onRegister={handleRegister}
          onBackToLogin={() => setCurrentView('login')}
          existingUsers={userCredentials}
        />
      );
    }
    
    return (
      <LoginForm 
        onLogin={handleLogin}
        onShowRegister={() => {}} // No longer used, kept for compatibility
        userCredentials={userCredentials}
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

                    {/* Trade Offer Button for Retouchers and Admin */}
                    {(user.role === "Retoucher" || user.role === "Admin") && (
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTradeModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-blue-200"
                        data-testid="button-open-trade-modal"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        Trade Project
                      </Button>
                    )}

                    {/* WRU Button for Admin */}
                    <WRUButton 
                      projects={projects} 
                      currentUser={user.name} 
                      isAdmin={user.role === "Admin"} 
                    />

                    {/* Archive Button */}
                    <Button 
                      variant={showArchive ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setShowArchive(!showArchive);
                        setShowCommissions(false);
                        setShowExtraPhotosSales(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      {showArchive ? `Current (${getCurrentProjectCount()})` : `Archive (${getArchiveProjectCount()})`}
                    </Button>

                    {/* Commissions Button - Only for DataWrangler */}
                    {user.role === "DataWrangler" && (
                      <Button 
                        variant={showCommissions ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setShowCommissions(!showCommissions);
                          setShowArchive(false);
                          setShowExtraPhotosSales(false);
                        }}
                        className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                      >
                        <DollarSign className="h-4 w-4" />
                        Commissions
                      </Button>
                    )}

                    {/* Extra Photos Sales Button - Only for Sales */}
                    {user.role === "Sales" && (
                      <Button 
                        variant={showExtraPhotosSales ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setShowExtraPhotosSales(!showExtraPhotosSales);
                          setShowArchive(false);
                          setShowCommissions(false);
                        }}
                        className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
                      >
                        <DollarSign className="h-4 w-4" />
                        Extra Photos Sales
                      </Button>
                    )}

                    {/* Manual Rollover Buttons for Admin */}
                    {user.role === "Admin" && (
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={handleManualRollover}
                          className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
                          data-testid="button-manual-rollover"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          Roll Forward
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={handleManualRollback}
                          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                          data-testid="button-manual-rollback"
                        >
                          <ArrowRightLeft className="h-4 w-4 rotate-180" />
                          Roll Back
                        </Button>
                      </div>
                    )}

                    {/* Settings Icon - Only visible to Admin users */}
                    {user.role === "Admin" && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Settings className="h-4 w-4" />
                            Settings
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Settings</DialogTitle>
                          </DialogHeader>
                          <SettingsPanel
                            users={users}
                            userCredentials={userCredentials}
                            onAddUser={handleAddUser}
                            onEditUser={handleEditUser}
                            onDeleteUser={handleDeleteUser}
                            onUpdateUserCredentials={handleUpdateUserCredentials}
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
          {/* Daily Quote */}
          <DailyQuote userId={user.value} />
          
          {/* Admin Personal Dashboard - Show assigned tasks for Anesu's Pops */}
          {user.role === "Admin" && user.name === "Anesu's Pops" && !showArchive && (
            <div className="bg-white rounded-lg shadow-sm">
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
                    {projects.filter(p => 
                      p.assignedTo && 
                      p.assignedTo.toLowerCase() === user.name.toLowerCase() && 
                      p.status !== "Delivered"
                    ).length} active task{projects.filter(p => 
                      p.assignedTo && 
                      p.assignedTo.toLowerCase() === user.name.toLowerCase() && 
                      p.status !== "Delivered"
                    ).length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                {(() => {
                  const myTasks = projects.filter(p => 
                    p.assignedTo && 
                    p.assignedTo.toLowerCase() === user.name.toLowerCase() && 
                    p.status !== "Delivered"
                  );
                  
                  if (myTasks.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        No tasks currently assigned to you
                      </div>
                    );
                  }

                  return (
                    <TaskTable 
                      projects={myTasks} 
                      user={user} 
                      allUsers={users} 
                      isPersonalView={true}
                    />
                  );
                })()}
              </div>
            </div>
          )}
          
          {/* Sales Dashboard - Payment & Delivery Management */}
          {user.role === "Sales" ? (
            <>
              {/* Extra Photos Sales View for Sales */}
              {showExtraPhotosSales ? (
                <ExtraPhotosSalesView projects={allProjects || []} />
              ) : (
            <div className="space-y-6">
              {/* Pending Payments Section */}
              <div className="bg-white rounded-lg shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <h2 className="text-lg font-semibold text-gray-900">Pending Payments</h2>
                      <span className="text-sm text-gray-500">Awaiting client payment</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {projects.filter(p => p.status === "Awaiting Payment").length} project{projects.filter(p => p.status === "Awaiting Payment").length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <TaskTable 
                    projects={projects.filter(p => p.status === "Awaiting Payment")} 
                    user={user} 
                    allUsers={users} 
                    isPersonalView={true}
                  />
                </div>
              </div>

              {/* Ready for Delivery Section */}
              <div className="bg-white rounded-lg shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <h2 className="text-lg font-semibold text-gray-900">Ready for Delivery</h2>
                      <span className="text-sm text-gray-500">Completed by retouchers</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {projects.filter(p => p.status === "Review").length} project{projects.filter(p => p.status === "Review").length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <TaskTable 
                    projects={projects.filter(p => p.status === "Review")} 
                    user={user} 
                    allUsers={users} 
                    isPersonalView={true}
                  />
                </div>
              </div>
            </div>
              )}
            </>
          ) : (
            <>
              {/* Commission View for DataWrangler */}
              {showCommissions && user.role === "DataWrangler" ? (
                <CommissionView user={user} />
              ) : (
                <>
                  {/* Archive Status Header for non-Sales roles */}
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
                        <span className="text-sm text-gray-500">
                          {showArchive ? "(2+ weeks old)" : "(Previous, current & next week + unassigned rollover)"}
                        </span>
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
                  {!showArchive && user.role !== "Retoucher" && user.role !== "Sales" && (
                    <AddProjectForm onAddProject={() => {}} user={user} />
                  )}
                </>
              )}

            </>
          )}
          
          {/* Show the task table for the visible projects - only for non-Sales roles and not in commission view */}
          {user.role !== "Sales" && !showCommissions && !showExtraPhotosSales && (
            <TaskTable projects={projects} user={user} allUsers={users} />
          )}

          {/* Team Progress Analytics - only in current view and not in commission view */}
          {!showArchive && !showCommissions && !showExtraPhotosSales && (
            <TeamAnalytics user={user} />
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
