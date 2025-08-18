import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { LoginForm } from "@/components/login-form";
import { RegisterForm } from "@/components/register-form";
import { SettingsPanel } from "@/components/settings-panel";
import { AddProjectForm } from "@/components/add-project-form";
import { TaskTable } from "@/components/task-table";
import { TeamAnalytics } from "@/components/team-analytics";
import { DailyQuote } from "@/components/daily-quote";
import { NotificationCenter } from "@/components/notification-center";
import { TradeOfferModal } from "@/components/TradeOfferModal";
import { TradeOffersPanel } from "@/components/TradeOffersPanel";
import { WRUButton } from "@/components/WRUButton";
import { useSSE } from "@/hooks/use-sse";
import { User } from "@/lib/types";
import { Project } from "@shared/schema";
import { User as UserIcon, LogOut, Settings, Archive, ArrowRightLeft } from "lucide-react";
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

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');
  const [showArchive, setShowArchive] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);

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
    { id: "admin", username: "admin", password: "admin123", role: "Admin", name: "Anesu's Pops", abbreviation: "AP" },
    { id: "sales", username: "sales", password: "sales123", role: "Sales", name: "sales", abbreviation: "SAL" },
    { id: "workflow", username: "workflow", password: "workflow123", role: "LeadRetoucher", name: "Workflow Manager", abbreviation: "WFM" },
    { id: "data", username: "data", password: "data123", role: "DataWrangler", name: "Data Wrangler", abbreviation: "DW" },
    { id: "earl", username: "earl", password: "earl123", role: "Retoucher", name: "Earl", abbreviation: "EC" },
    { id: "asa", username: "asa", password: "asa123", role: "Retoucher", name: "Dr Asa", abbreviation: "ASA" },
    { id: "lucky", username: "lucky", password: "lm123", role: "Retoucher", name: "Lucky", abbreviation: "LM" },
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

                    {/* Trade Offer Button for Retouchers */}
                    {user.role === "Retoucher" && (
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
                      onClick={() => setShowArchive(!showArchive)}
                      className="flex items-center gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      {showArchive ? `Current (${getCurrentProjectCount()})` : `Archive (${getArchiveProjectCount()})`}
                    </Button>

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
                  <div className="text-sm text-gray-600">
                    {projects.length} project{projects.length !== 1 ? 's' : ''} {showArchive ? 'archived' : 'current'}
                  </div>
                </div>
              </div>

              {/* Show project creation form for non-Sales roles that can add projects - only in current view */}
              {!showArchive && user.role !== "Retoucher" && user.role !== "Sales" && (
                <AddProjectForm onAddProject={() => {}} />
              )}
            </>
          )}
          
          {/* Show the task table for the visible projects - only for non-Sales roles */}
          {user.role !== "Sales" && (
            <TaskTable projects={projects} user={user} allUsers={users} />
          )}

          {/* Team Progress Analytics - only in current view */}
          {!showArchive && (
            <TeamAnalytics user={user} />
          )}

          {/* Trade Offers Panel - Show for retouchers and admin when not in archive view */}
          {!showArchive && (user.role === "Retoucher" || user.role === "Admin") && (
            <TradeOffersPanel 
              currentUser={user.name} 
              projects={projects} 
              isAdmin={user.role === "Admin"}
            />
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
