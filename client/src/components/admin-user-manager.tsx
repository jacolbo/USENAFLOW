import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "@/lib/types";
import { Settings, Edit, Trash2, UserPlus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().min(1, "Role is required"),
  abbreviation: z.string().min(1, "Abbreviation is required").max(4, "Abbreviation should be 4 characters or less"),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserCredential {
  username: string;
  password: string;
  role: string;
  name: string;
  abbr: string;
  id?: string;
}

interface AdminUserManagerProps {
  users: UserCredential[];
  onUpdateUsers: (users: UserCredential[]) => void;
  currentUser: User;
}

export function AdminUserManager({ users, onUpdateUsers, currentUser }: AdminUserManagerProps) {
  const { toast } = useToast();
  const [showPasswords, setShowPasswords] = useState(false);
  const [editingUser, setEditingUser] = useState<UserCredential | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema)
  });

  const handleAddUser = (data: UserFormData) => {
    // Check if username already exists
    const existingUser = users.find(u => u.username === data.username);
    if (existingUser) {
      toast({
        title: "Error",
        description: "Username already exists",
        variant: "destructive",
      });
      return;
    }

    const newUser: UserCredential = {
      username: data.username,
      password: data.password,
      name: data.username, // Use username as name
      role: data.role,
      abbr: data.abbreviation,
      id: Date.now().toString()
    };

    const updatedUsers = [...users, newUser];
    onUpdateUsers(updatedUsers);
    reset();
    setIsAddingUser(false);

    toast({
      title: "User Added",
      description: `${data.username} has been added to the system`,
    });
  };

  const handleEditUser = (data: UserFormData) => {
    if (!editingUser) return;

    // Check if username already exists (excluding current user)
    const existingUser = users.find(u => u.username === data.username && u.username !== editingUser.username);
    if (existingUser) {
      toast({
        title: "Error",
        description: "Username already exists",
        variant: "destructive",
      });
      return;
    }

    const updatedUsers = users.map(user =>
      user.username === editingUser.username
        ? {
            ...user,
            username: data.username,
            password: data.password,
            name: data.username,
            role: data.role,
            abbr: data.abbreviation
          }
        : user
    );

    onUpdateUsers(updatedUsers);
    reset();
    setEditingUser(null);

    toast({
      title: "User Updated",
      description: `${data.username} has been updated`,
    });
  };

  const handleDeleteUser = (username: string) => {
    if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      const updatedUsers = users.filter(user => user.username !== username);
      onUpdateUsers(updatedUsers);

      toast({
        title: "User Deleted",
        description: `User "${username}" has been removed`,
        variant: "destructive",
      });
    }
  };

  const startEdit = (user: UserCredential) => {
    setEditingUser(user);
    reset({
      username: user.username,
      password: user.password,
      role: user.role,
      abbreviation: user.abbr
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "LeadRetoucher": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "DataWrangler": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Retoucher": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "Sales": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getDisplayRoleName = (role: string) => {
    return role === "LeadRetoucher" ? "Workflow Manager" : role;
  };

  // Only show for Admin users
  if (currentUser.role !== "Admin") {
    return null;
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          User Management (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Button
              onClick={() => setIsAddingUser(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add New User
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPasswords(!showPasswords)}
              className="flex items-center gap-2"
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPasswords ? "Hide Passwords" : "Show Passwords"}
            </Button>
          </div>

          {/* Add User Dialog */}
          <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleAddUser)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input {...register("username")} placeholder="e.g. thandi" />
                    {errors.username && <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input {...register("password")} type="password" placeholder="Minimum 6 characters" />
                    {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select onValueChange={(value) => setValue("role", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="LeadRetoucher">Workflow Manager</SelectItem>
                        <SelectItem value="DataWrangler">Data Wrangler</SelectItem>
                        <SelectItem value="Retoucher">Retoucher</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.role && <p className="text-sm text-red-600 mt-1">{errors.role.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="abbreviation">Abbreviation</Label>
                    <Input {...register("abbreviation")} placeholder="e.g. TM" maxLength={4} />
                    {errors.abbreviation && <p className="text-sm text-red-600 mt-1">{errors.abbreviation.message}</p>}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsAddingUser(false)}>Cancel</Button>
                  <Button type="submit">Add User</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleEditUser)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="edit-username">Username</Label>
                    <Input {...register("username")} placeholder="e.g. thandi" />
                    {errors.username && <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="edit-password">Password</Label>
                    <Input {...register("password")} type="password" placeholder="Minimum 6 characters" />
                    {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="edit-role">Role</Label>
                    <Select onValueChange={(value) => setValue("role", value)} defaultValue={editingUser?.role}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="LeadRetoucher">Workflow Manager</SelectItem>
                        <SelectItem value="DataWrangler">Data Wrangler</SelectItem>
                        <SelectItem value="Retoucher">Retoucher</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.role && <p className="text-sm text-red-600 mt-1">{errors.role.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="edit-abbreviation">Abbreviation</Label>
                    <Input {...register("abbreviation")} placeholder="e.g. TM" maxLength={4} />
                    {errors.abbreviation && <p className="text-sm text-red-600 mt-1">{errors.abbreviation.message}</p>}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                  <Button type="submit">Update User</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* User Table */}
          <div>
            <h3 className="text-lg font-semibold mb-4">All System Users</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Abbreviation</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={`${user.username}_${user.id || 'default'}`}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="font-mono">
                      {showPasswords ? user.password : "••••••••"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getDisplayRoleName(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.abbr}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(user)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteUser(user.username)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}