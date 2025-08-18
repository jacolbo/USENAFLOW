import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { SecureLoginForm } from "@/components/SecureLoginForm";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
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
import { Project, User as DbUser } from "@shared/schema";
import { User as UserIcon, LogOut, Settings, Archive, ArrowRightLeft } from "lucide-react";
import logoImage from "@assets/USENA-FLOW_1754522507856.png";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";



export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Initialize SSE for live sync and notifications
  const {
    isConnected,
    notifications,
    markNotificationAsRead,
    clearAllNotifications,
    unreadCount
  } = useSSE(user ? { id: user.role, username: user.name } : null);
  

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

  // Load saved session on component mount
  useEffect(() => {
    const token = localStorage.getItem('usenaflow_token');
    if (token) {
      // Verify token with server and get user data
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          // Token is invalid, clear it
          localStorage.removeItem('usenaflow_token');
          throw new Error('Invalid token');
        }
      })
      .then(userData => {
        // Convert database user to local User type
        const localUser: User = {
          id: userData.id,
          name: userData.name,
          role: userData.role,
          value: userData.role,
          abbr: userData.abbreviation
        };
        
        setUser(localUser);
        
        // Show password change modal if required
        if (userData.mustChangePassword) {
          setShowChangePassword(true);
        }
      })
      .catch(() => {
        localStorage.removeItem('usenaflow_token');
      });
    }
  }, []);



  const handleSecureLogin = (loggedInUser: DbUser, token: string) => {
    // Convert database user to local User type
    const localUser: User = {
      id: loggedInUser.id,
      name: loggedInUser.name,
      role: loggedInUser.role,
      value: loggedInUser.role,
      abbr: loggedInUser.abbreviation
    };
    
    setUser(localUser);
    
    // Show password change modal if required
    if (loggedInUser.mustChangePassword) {
      setShowChangePassword(true);
    }
  };



  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('usenaflow_token');
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

  // Show secure login form if user is not logged in
  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <SecureLoginForm onLogin={handleSecureLogin} />
      </motion.div>
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
                            onAddUser={handleAddUser}
                            onEditUser={handleEditUser}
                            onDeleteUser={handleDeleteUser}
                            currentUser={user}
                          />
                        </DialogContent>
                      </Dialog>
                    )}

                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowChangePassword(true)}
                      className="flex items-center gap-2"
                      data-testid="button-change-password"
                    >
                      <UserIcon className="h-4 w-4" />
                      Change Password
                    </Button>

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


        </div>
      </div>

      {/* Trade Offer Modal */}
      <TradeOfferModal
        open={showTradeModal}
        onOpenChange={setShowTradeModal}
        currentUser={user.name}
        projects={projects}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        onPasswordChanged={() => {
          setShowChangePassword(false);
          setUser(prev => prev ? { ...prev, mustChangePassword: false } : null);
        }}
      />
    </div>
  );
}
