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

interface UserCredentials {
  id: string;
  username: string;
  password: string;
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

type AddUserFormData = z.infer<typeof addUserSchema>;

interface SettingsPanelProps {
  users: User[];
  userCredentials: UserCredentials[];
  onAddUser: (user: User) => void;
  onEditUser: (userId: string, updatedUser: Partial<User>) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateUserCredentials: (credentials: UserCredentials[]) => void;
  currentUser: User;
}

export function SettingsPanel({ 
  users, 
  userCredentials,
  onAddUser, 
  onEditUser, 
  onDeleteUser, 
  onUpdateUserCredentials,
  currentUser 
}: SettingsPanelProps) {
  const { toast } = useToast();
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCredentials, setEditingCredentials] = useState<UserCredentials | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

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
  } = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema)
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
    // Add to team users
    const newUser: User = {
      id: Date.now().toString(),
      name: data.name,
      role: data.role,
      value: data.role === "Retoucher" ? `${data.name}_${Date.now()}` : `${data.role}_${Date.now()}`,
      abbr: data.abbreviation
    };

    // Add to user credentials
    const newCredentials: UserCredentials = {
      id: newUser.id || Date.now().toString(),
      username: data.username,
      password: data.password,
      name: data.name,
      role: data.role,
      abbreviation: data.abbreviation
    };

    onAddUser(newUser);
    onUpdateUserCredentials([...userCredentials, newCredentials]);
    
    resetAdd();
    setIsAddingUser(false);
    
    toast({
      title: "Success",
      description: `User ${data.name} has been created successfully.`,
    });
  };

  const onSubmitEdit = (data: AddUserFormData) => {
    if (!editingUser) return;

    // Update team user
    onEditUser(editingUser.id || "", {
      name: data.name,
      role: data.role,
      abbr: data.abbreviation
    });

    // Update credentials if editing credentials
    if (editingCredentials) {
      const updatedCredentials = userCredentials.map(cred => 
        cred.id === editingCredentials.id 
          ? { ...cred, username: data.username, password: data.password, name: data.name, role: data.role, abbreviation: data.abbreviation }
          : cred
      );
      onUpdateUserCredentials(updatedCredentials);
    }

    resetEdit();
    setEditingUser(null);
    setEditingCredentials(null);
    
    toast({
      title: "Success",
      description: `User ${data.name} has been updated successfully.`,
    });
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    const credentials = userCredentials.find(cred => cred.id === user.id);
    setEditingCredentials(credentials || null);
    
    setValueEdit("username", credentials?.username || "");
    setValueEdit("password", credentials?.password || "");
    setValueEdit("name", user.name);
    setValueEdit("role", user.role);
    setValueEdit("abbreviation", user.abbr || "");
  };

  const handleDeleteUser = (userId: string) => {
    onDeleteUser(userId);
    // Also remove from credentials
    const updatedCredentials = userCredentials.filter(cred => cred.id !== userId);
    onUpdateUserCredentials(updatedCredentials);
    
    toast({
      title: "Success",
      description: "User has been deleted successfully.",
    });
  };

  const updatePassword = (credId: string, newPassword: string) => {
    const updatedCredentials = userCredentials.map(cred => 
      cred.id === credId ? { ...cred, password: newPassword } : cred
    );
    onUpdateUserCredentials(updatedCredentials);
    
    toast({
      title: "Success",
      description: "Password updated successfully.",
    });
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
                    {users.map((user) => (
                      <TableRow key={user.id || user.name}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {getDisplayRole(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.abbr}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id || "")}
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
                      <TableHead>Password</TableHead>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {showPasswords[cred.id] ? cred.password : '••••••••'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePasswordVisibility(cred.id)}
                            >
                              {showPasswords[cred.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
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
                                <DialogTitle>Reset Password</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="new-password">New Password</Label>
                                  <Input
                                    id="new-password"
                                    type="text"
                                    defaultValue={cred.password}
                                    onChange={(e) => {
                                      const newPassword = e.target.value;
                                      if (newPassword) {
                                        updatePassword(cred.id, newPassword);
                                      }
                                    }}
                                  />
                                </div>
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
                  <Button type="submit">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetAdd();
                      setIsAddingUser(false);
                    }}
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
            {editingCredentials && (
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
                    placeholder="Enter password"
                  />
                  {errorsEdit.password && (
                    <p className="text-sm text-red-600 mt-1">{errorsEdit.password.message}</p>
                  )}
                </div>
              </div>
            )}

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
              <Button type="submit">Update User</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetEdit();
                  setEditingUser(null);
                  setEditingCredentials(null);
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