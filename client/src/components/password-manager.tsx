import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "@/lib/types";
import { Key, Edit, UserPlus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const passwordSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Full name is required"),
  role: z.string().min(1, "Role is required"),
  abbr: z.string().min(1, "Abbreviation is required").max(3, "Abbreviation should be 3 characters or less"),
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface UserCredential {
  username: string;
  password: string;
  role: string;
  name: string;
  abbr: string;
  id?: string;
}

interface PasswordManagerProps {
  userCredentials: UserCredential[];
  onUpdateCredentials: (credentials: UserCredential[]) => void;
  currentUser: User;
}

export function PasswordManager({ userCredentials, onUpdateCredentials, currentUser }: PasswordManagerProps) {
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
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema)
  });

  const handleAddUser = (data: PasswordFormData) => {
    const newCredential: UserCredential = {
      username: data.username,
      password: data.password,
      name: data.name,
      role: data.role,
      abbr: data.abbr,
      id: Date.now().toString()
    };

    const updatedCredentials = [...userCredentials, newCredential];
    onUpdateCredentials(updatedCredentials);
    reset();
    setIsAddingUser(false);

    toast({
      title: "User Added",
      description: `${data.name} has been added to the system`,
    });
  };

  const handleEditUser = (data: PasswordFormData) => {
    if (!editingUser) return;

    const updatedCredentials = userCredentials.map(cred =>
      cred.username === editingUser.username
        ? {
            ...cred,
            username: data.username,
            password: data.password,
            name: data.name,
            role: data.role,
            abbr: data.abbr
          }
        : cred
    );

    onUpdateCredentials(updatedCredentials);
    reset();
    setEditingUser(null);

    toast({
      title: "User Updated",
      description: `${data.name}'s credentials have been updated`,
    });
  };

  const handleDeleteUser = (username: string) => {
    if (window.confirm(`Are you sure you want to delete the user "${username}"?`)) {
      const updatedCredentials = userCredentials.filter(cred => cred.username !== username);
      onUpdateCredentials(updatedCredentials);

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
      name: user.name,
      role: user.role,
      abbr: user.abbr
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
          <Key className="h-5 w-5" />
          Password & User Management
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="name">Full Name</Label>
                    <Input {...register("name")} placeholder="e.g. Thandi Mthembu" />
                    {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="abbr">Abbreviation</Label>
                    <Input {...register("abbr")} placeholder="e.g. TM" maxLength={3} />
                    {errors.abbr && <p className="text-sm text-red-600 mt-1">{errors.abbr.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="role">Role</Label>
                    <select 
                      {...register("role")} 
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select role</option>
                      <option value="Admin">Admin</option>
                      <option value="Sales">Sales</option>
                      <option value="LeadRetoucher">Workflow Manager</option>
                      <option value="DataWrangler">Data Wrangler</option>
                      <option value="Retoucher">Retoucher</option>
                    </select>
                    {errors.role && <p className="text-sm text-red-600 mt-1">{errors.role.message}</p>}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input {...register("name")} placeholder="e.g. Thandi Mthembu" />
                    {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="edit-abbr">Abbreviation</Label>
                    <Input {...register("abbr")} placeholder="e.g. TM" maxLength={3} />
                    {errors.abbr && <p className="text-sm text-red-600 mt-1">{errors.abbr.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="edit-role">Role</Label>
                    <select 
                      {...register("role")} 
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select role</option>
                      <option value="Admin">Admin</option>
                      <option value="Sales">Sales</option>
                      <option value="LeadRetoucher">Workflow Manager</option>
                      <option value="DataWrangler">Data Wrangler</option>
                      <option value="Retoucher">Retoucher</option>
                    </select>
                    {errors.role && <p className="text-sm text-red-600 mt-1">{errors.role.message}</p>}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                  <Button type="submit">Update User</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* User Credentials Table */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Current Users & Credentials</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Abbreviation</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userCredentials.map((user) => (
                  <TableRow key={user.username}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="font-mono">
                      {showPasswords ? user.password : "••••••••"}
                    </TableCell>
                    <TableCell>{user.name}</TableCell>
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
                        {user.id && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteUser(user.username)}
                            className="flex items-center gap-1"
                          >
                            Delete
                          </Button>
                        )}
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