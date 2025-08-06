import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoleSelector } from "@/components/role-selector";
import { AddProjectForm } from "@/components/add-project-form";
import { TaskTable } from "@/components/task-table";
import { StatusLegend } from "@/components/status-legend";
import { UserManagement } from "@/components/user-management";
import { User, ROLE_MAPPINGS } from "@/lib/types";
import { Project } from "@shared/schema";
import { Camera, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [customUsers, setCustomUsers] = useState<User[]>([]);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  // Combine default users with custom users
  const allUsers = [
    ...Object.values(ROLE_MAPPINGS),
    ...customUsers
  ];

  const handleChangeRole = (roleValue: string) => {
    if (!roleValue) {
      setUser(null);
    } else {
      // First check custom users
      const customUser = customUsers.find(u => u.value === roleValue);
      if (customUser) {
        setUser(customUser);
        return;
      }
      
      // Then check default role mappings
      const roleMapping = ROLE_MAPPINGS[roleValue as keyof typeof ROLE_MAPPINGS];
      if (roleMapping) {
        setUser(roleMapping);
      }
    }
  };

  const handleAddUser = (newUser: User) => {
    setCustomUsers(prev => [...prev, newUser]);
  };

  const handleDeleteUser = (userId: string) => {
    setCustomUsers(prev => prev.filter(u => u.id !== userId));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Camera className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Photography Workflow</h1>
            </div>
            <div className="flex items-center space-x-4">
              <RoleSelector user={user} onChangeRole={handleChangeRole} allUsers={allUsers} />
              {user && (
                <div className="flex items-center space-x-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-900">{user.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user ? (
          <div className="text-center py-12">
            <Camera className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Please select a role to continue</h3>
            <p className="mt-1 text-sm text-gray-500">Choose your role from the dropdown above to access the workflow.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* User Management Panel - only for Admin */}
            {user && (
              <UserManagement 
                users={allUsers} 
                onAddUser={handleAddUser}
                onDeleteUser={handleDeleteUser}
                currentUser={user}
              />
            )}
            
            {/* Status Legend - only for Admin, LeadRetoucher, and DataWrangler */}
            <StatusLegend projects={projects} user={user} allUsers={allUsers} />
            
            {/* Show project creation form for roles that can add projects */}
            {user.role !== "Retoucher" && (
              <AddProjectForm onAddProject={() => {}} />
            )}
            
            {/* Show the task table for the visible projects */}
            <TaskTable projects={projects} user={user} allUsers={allUsers} />
          </div>
        )}
      </main>
    </div>
  );
}
