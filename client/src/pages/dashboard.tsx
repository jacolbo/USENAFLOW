import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoginForm } from "@/components/login-form";
import { RegisterForm } from "@/components/register-form";
import { AdminUserManager } from "@/components/admin-user-manager";
import { AddProjectForm } from "@/components/add-project-form";
import { TaskTable } from "@/components/task-table";
import { StatusLegend } from "@/components/status-legend";
import { UserManagement } from "@/components/user-management";
import { User } from "@/lib/types";
import { Project } from "@shared/schema";
import { Camera, User as UserIcon, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface UserCredential {
  username: string;
  password: string;
  role: string;
  name: string;
  abbr: string;
  id?: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');
  const [users, setUsers] = useState<User[]>([
    { id: "1", name: "Earl", role: "Retoucher", value: "Retoucher1", abbr: "EC" },
    { id: "2", name: "Dr Asa", role: "Retoucher", value: "Retoucher2", abbr: "ASA" },
    { id: "3", name: "Lucky", role: "Retoucher", value: "Retoucher3", abbr: "LM" },
    // Default system users without IDs (cannot be edited/deleted)
    { name: "Sales/Admin", role: "Admin", value: "Admin" },
    { name: "Workflow Manager", role: "LeadRetoucher", value: "LeadRetoucher" },
    { name: "Data Wrangler", role: "DataWrangler", value: "DataWrangler" },
  ]);

  // User credentials for login/register system
  const [userCredentials, setUserCredentials] = useState<UserCredential[]>([
    { username: "admin", password: "admin123", role: "Admin", name: "admin", abbr: "ADM" },
    { username: "lucky", password: "lm123", role: "Retoucher", name: "lucky", abbr: "LM" },
    { username: "asa", password: "asa123", role: "Retoucher", name: "asa", abbr: "ASA" },
  ]);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('login');
    // Sync with users array for consistency
    const existingUserIndex = users.findIndex(u => u.name === loggedInUser.name);
    if (existingUserIndex === -1) {
      setUsers(prev => [...prev, loggedInUser]);
    }
  };

  const handleRegister = (newUserCredential: UserCredential) => {
    // Add to credentials array
    setUserCredentials(prev => [...prev, newUserCredential]);
    
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
  };

  const handleUpdateUserCredentials = (credentials: UserCredential[]) => {
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
                <Camera className="text-primary text-2xl mr-3" />
                <h1 className="text-xl font-semibold text-gray-900">UNESA FLOW by Jepson Myles Studio</h1>
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
          {/* Admin User Management Panel - only for Admin */}
          {user && (
            <AdminUserManager 
              users={userCredentials}
              onUpdateUsers={handleUpdateUserCredentials}
              currentUser={user}
            />
          )}

          {/* Team Management Panel - only for Admin */}
          {user && (
            <UserManagement 
              users={users} 
              onAddUser={handleAddUser}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              currentUser={user}
            />
          )}
          
          {/* Status Legend - only for Admin, LeadRetoucher, and DataWrangler */}
          <StatusLegend projects={projects} user={user} allUsers={users} />
          
          {/* Show project creation form for roles that can add projects */}
          {user.role !== "Retoucher" && (
            <AddProjectForm onAddProject={() => {}} />
          )}
          
          {/* Show the task table for the visible projects */}
          <TaskTable projects={projects} user={user} allUsers={users} />
        </div>
      </div>
    </div>
  );
}
