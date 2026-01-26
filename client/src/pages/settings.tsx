import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLayout, PageHeader } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { getAdminHeaders } from "@/lib/adminAuth";
import { User, Bell, Palette, Shield, Mail } from "lucide-react";

const ALLOWED_ROLES = ["Admin", "LeadRetoucher"];

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const role = localStorage.getItem("usena_role") || "";
    const id = localStorage.getItem("usena_user_id") || "";
    const name = localStorage.getItem("usena_name") || "";
    setUserRole(role);
    setUserId(id);
    setUserName(name);
  }, []);

  const hasAccess = ALLOWED_ROLES.includes(userRole);

  const chatRoles = ["Admin", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "Evans"];
  const { data: chatProjects = [] } = useQuery<Array<{ project: any; unreadCount: number }>>({
    queryKey: ["/api/admin/chat/projects"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/chat/projects`, {
        headers: getAdminHeaders(userRole, userId),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: hasAccess && chatRoles.includes(userRole),
    refetchInterval: 30000,
  });
  const totalChatUnread = chatProjects.reduce((sum, p) => sum + p.unreadCount, 0);

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
            <Button onClick={() => navigate("/")} className="mt-4">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentUserData = userName ? {
    name: userName,
    role: userRole
  } : null;

  return (
    <AppLayout currentUser={currentUserData} unreadChatCount={totalChatUnread}>
      <PageHeader 
        title="Settings"
        description="Manage your account and application preferences"
      />
      <div className="p-6 max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={userName} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={userRole} disabled className="bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Configure how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Browser notifications</p>
                <p className="text-sm text-muted-foreground">Receive push notifications in your browser</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sound alerts</p>
                <p className="text-sm text-muted-foreground">Play a sound when you receive notifications</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Preferences
            </CardTitle>
            <CardDescription>Manage email notification settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Project updates</p>
                <p className="text-sm text-muted-foreground">Receive emails about project status changes</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly digest</p>
                <p className="text-sm text-muted-foreground">Receive a weekly summary of activity</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Manage your security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-factor authentication</p>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
              </div>
              <Button variant="outline" size="sm">Enable</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Change password</p>
                <p className="text-sm text-muted-foreground">Update your account password</p>
              </div>
              <Button variant="outline" size="sm">Update</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
