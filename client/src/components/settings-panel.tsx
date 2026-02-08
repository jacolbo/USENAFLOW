import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "@/lib/types";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserCredentials {
  id: string;
  username: string;
  name: string;
  role: string;
  abbreviation: string;
}

import { UserPlus, Users, Trash2, Edit, Eye, EyeOff, Key, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const addUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  name: z.string().min(1, "Full name is required"),
  role: z.string().min(1, "Role is required"),
  abbreviation: z.string().min(1, "Abbreviation is required").max(3, "Abbreviation should be 3 characters or less"),
});

const editUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  name: z.string().min(1, "Full name is required"),
  role: z.string().min(1, "Role is required"),
  abbreviation: z.string().min(1, "Abbreviation is required").max(3, "Abbreviation should be 3 characters or less"),
});

type AddUserFormData = z.infer<typeof addUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

interface SettingsPanelProps {
  currentUser: User;
}

export function SettingsPanel({ 
  currentUser 
}: SettingsPanelProps) {
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<UserCredentials | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});

  const { data: userCredentials = [] } = useQuery<UserCredentials[]>({
    queryKey: ["/api/users"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: AddUserFormData) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      resetAdd();
      toast({
        title: "Success",
        description: "User has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user.",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EditUserFormData> }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      resetEdit();
      toast({
        title: "Success",
        description: "User has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user.",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, { password });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "Password updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update password.",
        variant: "destructive",
      });
    },
  });

  const {
    register: registerAdd,
    handleSubmit: handleSubmitAdd,
    reset: resetAdd,
    setValue: setValueAdd,
    watch: watchAdd,
    formState: { errors: errorsAdd }
  } = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema)
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setValueEdit,
    watch: watchEdit,
    formState: { errors: errorsEdit }
  } = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema)
  });

  const selectedRole = watchAdd("role");
  const selectedEditRole = watchEdit("role");

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const onSubmitAdd = (data: AddUserFormData) => {
    createUserMutation.mutate(data);
  };

  const onSubmitEdit = (data: EditUserFormData) => {
    if (!editingUser) return;
    const updates: Partial<EditUserFormData> = {
      username: data.username,
      name: data.name,
      role: data.role,
      abbreviation: data.abbreviation,
    };
    if (data.password && data.password.trim().length > 0) {
      updates.password = data.password;
    }
    updateUserMutation.mutate({
      id: editingUser.id,
      updates,
    });
  };

  const startEditUser = (cred: UserCredentials) => {
    setEditingUser(cred);
    setValueEdit("username", cred.username);
    setValueEdit("password", "");
    setValueEdit("name", cred.name);
    setValueEdit("role", cred.role);
    setValueEdit("abbreviation", cred.abbreviation);
  };

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin": return "bg-red-100 text-red-800 hover:bg-red-200";
      case "LeadRetoucher": return "bg-purple-100 text-purple-800 hover:bg-purple-200";
      case "DataWrangler": return "bg-green-100 text-green-800 hover:bg-green-200";
      case "Sales": return "bg-blue-100 text-blue-800 hover:bg-blue-200";
      case "Retoucher": return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
      default: return "bg-gray-100 text-gray-800 hover:bg-gray-200";
    }
  };

  const getDisplayRole = (role: string) => {
    return role === "LeadRetoucher" ? "Workflow Manager" : role;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-600">Manage team members, roles, and account settings</p>
        </div>
      </div>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Management
          </TabsTrigger>
          <TabsTrigger value="passwords" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Password Management
          </TabsTrigger>
          <TabsTrigger value="add-user" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add New User
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Abbreviation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userCredentials.map((cred) => (
                      <TableRow key={cred.id}>
                        <TableCell className="font-medium">{cred.name}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(cred.role)}>
                            {getDisplayRole(cred.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{cred.abbreviation}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditUser(cred)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUser(cred.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passwords" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Password Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userCredentials.map((cred) => (
                      <TableRow key={cred.id}>
                        <TableCell className="font-medium">{cred.username}</TableCell>
                        <TableCell>{cred.name}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(cred.role)}>
                            {getDisplayRole(cred.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reset Password for {cred.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor={`new-password-${cred.id}`}>New Password</Label>
                                  <Input
                                    id={`new-password-${cred.id}`}
                                    type="text"
                                    placeholder="Enter new password"
                                    value={passwordInputs[cred.id] || ""}
                                    onChange={(e) => {
                                      setPasswordInputs(prev => ({ ...prev, [cred.id]: e.target.value }));
                                    }}
                                  />
                                </div>
                                <Button
                                  onClick={() => {
                                    const newPassword = passwordInputs[cred.id];
                                    if (newPassword && newPassword.trim().length > 0) {
                                      updatePasswordMutation.mutate({ id: cred.id, password: newPassword.trim() });
                                      setPasswordInputs(prev => ({ ...prev, [cred.id]: "" }));
                                    }
                                  }}
                                  disabled={!passwordInputs[cred.id]?.trim() || updatePasswordMutation.isPending}
                                >
                                  {updatePasswordMutation.isPending ? "Saving..." : "Save Password"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add-user" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitAdd(onSubmitAdd)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      {...registerAdd("username")}
                      placeholder="Enter username"
                    />
                    {errorsAdd.username && (
                      <p className="text-sm text-red-600 mt-1">{errorsAdd.username.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="text"
                      {...registerAdd("password")}
                      placeholder="Enter password"
                    />
                    {errorsAdd.password && (
                      <p className="text-sm text-red-600 mt-1">{errorsAdd.password.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      {...registerAdd("name")}
                      placeholder="Enter full name"
                    />
                    {errorsAdd.name && (
                      <p className="text-sm text-red-600 mt-1">{errorsAdd.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="abbreviation">Abbreviation</Label>
                    <Input
                      id="abbreviation"
                      {...registerAdd("abbreviation")}
                      placeholder="e.g., JD"
                      maxLength={3}
                    />
                    {errorsAdd.abbreviation && (
                      <p className="text-sm text-red-600 mt-1">{errorsAdd.abbreviation.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select onValueChange={(value) => setValueAdd("role", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="LeadRetoucher">Workflow Manager</SelectItem>
                      <SelectItem value="DataWrangler">Data Wrangler</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Retoucher">Retoucher</SelectItem>
                    </SelectContent>
                  </Select>
                  {errorsAdd.role && (
                    <p className="text-sm text-red-600 mt-1">{errorsAdd.role.message}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {createUserMutation.isPending ? "Adding..." : "Add User"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetAdd()}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  {...registerEdit("username")}
                  placeholder="Enter username"
                />
                {errorsEdit.username && (
                  <p className="text-sm text-red-600 mt-1">{errorsEdit.username.message}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="edit-password">Password</Label>
                <Input
                  id="edit-password"
                  type="text"
                  {...registerEdit("password")}
                  placeholder="Enter password (leave blank to keep current)"
                />
                {errorsEdit.password && (
                  <p className="text-sm text-red-600 mt-1">{errorsEdit.password.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  {...registerEdit("name")}
                  placeholder="Enter full name"
                />
                {errorsEdit.name && (
                  <p className="text-sm text-red-600 mt-1">{errorsEdit.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="edit-abbreviation">Abbreviation</Label>
                <Input
                  id="edit-abbreviation"
                  {...registerEdit("abbreviation")}
                  placeholder="e.g., JD"
                  maxLength={3}
                />
                {errorsEdit.abbreviation && (
                  <p className="text-sm text-red-600 mt-1">{errorsEdit.abbreviation.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select 
                onValueChange={(value) => setValueEdit("role", value)}
                defaultValue={selectedEditRole}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="LeadRetoucher">Workflow Manager</SelectItem>
                  <SelectItem value="DataWrangler">Data Wrangler</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Retoucher">Retoucher</SelectItem>
                </SelectContent>
              </Select>
              {errorsEdit.role && (
                <p className="text-sm text-red-600 mt-1">{errorsEdit.role.message}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetEdit();
                  setEditingUser(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
