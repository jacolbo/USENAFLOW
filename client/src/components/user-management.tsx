import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "@/lib/types";
import { UserPlus, Users, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const addUserSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  role: z.string().min(1, "Role is required"),
  abbreviation: z.string().min(1, "Abbreviation is required").max(3, "Abbreviation should be 3 characters or less"),
});

type AddUserFormData = z.infer<typeof addUserSchema>;

interface UserManagementProps {
  users: User[];
  onAddUser: (user: User) => void;
  onEditUser: (userId: string, updatedUser: Partial<User>) => void;
  onDeleteUser: (userId: string) => void;
  currentUser: User;
}

export function UserManagement({ users, onAddUser, onEditUser, onDeleteUser, currentUser }: UserManagementProps) {
  const { toast } = useToast();
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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

  const onSubmitAdd = (data: AddUserFormData) => {
    const newUser: User = {
      id: Date.now().toString(),
      name: data.name,
      role: data.role,
      value: data.role === "Retoucher" ? `${data.name}_${Date.now()}` : `${data.role}_${Date.now()}`,
      abbr: data.abbreviation
    };

    onAddUser(newUser);
    resetAdd();
    setIsAddingUser(false);
    
    toast({
      title: "Team Member Added",
      description: `${data.name} has been added as ${data.role}`,
    });
  };

  const onSubmitEdit = (data: AddUserFormData) => {
    if (!editingUser) return;

    const updatedUser: Partial<User> = {
      name: data.name,
      role: data.role,
      abbr: data.abbreviation,
      // Update value if role changed
      value: data.role === editingUser.role ? editingUser.value : 
             data.role === "Retoucher" ? `${data.name}_${Date.now()}` : `${data.role}_${Date.now()}`
    };

    onEditUser(editingUser.id!, updatedUser);
    resetEdit();
    setEditingUser(null);
    
    toast({
      title: "Team Member Updated",
      description: `${data.name} has been updated`,
    });
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    resetEdit({
      name: user.name,
      role: user.role,
      abbreviation: user.abbr || ""
    });
  };

  const handleDeleteUser = (user: User) => {
    if (user.id && window.confirm(`Are you sure you want to delete ${user.name}?`)) {
      onDeleteUser(user.id);
      toast({
        title: "Team Member Deleted",
        description: `${user.name} has been removed`,
        variant: "destructive",
      });
    }
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
    switch (role) {
      case "LeadRetoucher": return "Workflow Manager";
      default: return role;
    }
  };

  // Only show for Admin users
  if (currentUser.role !== "Admin") {
    return null;
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Add User Button */}
          {!isAddingUser ? (
            <Button 
              onClick={() => setIsAddingUser(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add New Team Member
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add New Team Member</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitAdd(onSubmitAdd)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        {...registerAdd("name")}
                        placeholder="e.g. Thandi"
                      />
                      {errorsAdd.name && (
                        <p className="text-sm text-red-600 mt-1">{errorsAdd.name.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select onValueChange={(value) => setValueAdd("role", value)}>
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
                      {errorsAdd.role && (
                        <p className="text-sm text-red-600 mt-1">{errorsAdd.role.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="abbreviation">Abbreviation</Label>
                      <Input
                        id="abbreviation"
                        {...registerAdd("abbreviation")}
                        placeholder="e.g. TM"
                        maxLength={3}
                      />
                      {errorsAdd.abbreviation && (
                        <p className="text-sm text-red-600 mt-1">{errorsAdd.abbreviation.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button type="submit">Add Member</Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsAddingUser(false);
                        resetAdd();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Current Team Members */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Current Team Members</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Abbreviation</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.value}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getDisplayRoleName(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.abbr || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {user.id && (
                          <>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditUser(user)}
                                  className="flex items-center gap-1"
                                >
                                  <Edit className="h-3 w-3" />
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Team Member</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="space-y-4">
                                  <div className="grid grid-cols-1 gap-4">
                                    <div>
                                      <Label htmlFor="edit-name">Full Name</Label>
                                      <Input
                                        id="edit-name"
                                        {...registerEdit("name")}
                                        placeholder="e.g. Thandi"
                                      />
                                      {errorsEdit.name && (
                                        <p className="text-sm text-red-600 mt-1">{errorsEdit.name.message}</p>
                                      )}
                                    </div>
                                    
                                    <div>
                                      <Label htmlFor="edit-role">Role</Label>
                                      <Select onValueChange={(value) => setValueEdit("role", value)} defaultValue={editingUser?.role}>
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
                                      {errorsEdit.role && (
                                        <p className="text-sm text-red-600 mt-1">{errorsEdit.role.message}</p>
                                      )}
                                    </div>
                                    
                                    <div>
                                      <Label htmlFor="edit-abbreviation">Abbreviation</Label>
                                      <Input
                                        id="edit-abbreviation"
                                        {...registerEdit("abbreviation")}
                                        placeholder="e.g. TM"
                                        maxLength={3}
                                      />
                                      {errorsEdit.abbreviation && (
                                        <p className="text-sm text-red-600 mt-1">{errorsEdit.abbreviation.message}</p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <Button type="submit">Update Member</Button>
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      onClick={() => {
                                        setEditingUser(null);
                                        resetEdit();
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </form>
                              </DialogContent>
                            </Dialog>
                            
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteUser(user)}
                              className="flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </>
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