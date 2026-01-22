import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getAdminHeaders } from "@/lib/adminAuth";
import { UserRoles, type Project } from "@shared/schema";
import { ArrowLeft, Send, MessageCircle, User, Clock, Loader2, Search, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  projectId: string;
  senderType: "client" | "retoucher";
  senderEmail: string;
  message: string;
  channel?: string;
  isRead: boolean;
  createdAt: string;
}

interface ProjectWithUnread {
  project: Project;
  unreadCount: number;
  lastMessageAt: string | null;
}

const ALLOWED_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER, UserRoles.RETOUCHER_1, UserRoles.RETOUCHER_2, UserRoles.RETOUCHER_3, UserRoles.EVANS];

export default function EditorChat() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const storedRole = localStorage.getItem("usena_role") as string;
  const storedUserId = localStorage.getItem("usena_user_id") as string;
  const userRole = storedRole || UserRoles.RETOUCHER_1;
  const userId = storedUserId || "";

  const isAllowed = ALLOWED_ROLES.includes(userRole as any);

  const projectsQuery = useQuery<ProjectWithUnread[]>({
    queryKey: ["/api/admin/chat/projects"],
    queryFn: async () => {
      const headers = getAdminHeaders(userRole, userId);
      const response = await fetch("/api/admin/chat/projects", { headers });
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
    enabled: isAllowed,
    refetchInterval: 5000,
  });

  const messagesQuery = useQuery<Message[]>({
    queryKey: ["/api/admin/chat/project", selectedProjectId, "messages"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const headers = getAdminHeaders(userRole, userId);
      const response = await fetch(`/api/admin/chat/project/${selectedProjectId}/messages`, { headers });
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: isAllowed && !!selectedProjectId,
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ projectId, message }: { projectId: string; message: string }) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/chat/project/${projectId}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }
      return response.json();
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/project", selectedProjectId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/projects"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesQuery.data]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedProjectId) return;
    sendMessageMutation.mutate({ projectId: selectedProjectId, message: messageText.trim() });
  };

  const selectedProject = projectsQuery.data?.find(p => p.project.id === selectedProjectId);
  
  const filteredProjects = projectsQuery.data?.filter(p => 
    p.project.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.project.clientEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const totalUnread = projectsQuery.data?.reduce((sum, p) => sum + p.unreadCount, 0) || 0;

  if (!isAllowed) {
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

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="border-b px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-lg">Client Messages</h1>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="ml-1">{totalUnread}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r flex flex-col bg-card">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            {projectsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground px-4">
                {searchQuery ? "No clients match your search" : "No projects with client emails"}
              </div>
            ) : (
              <div className="divide-y">
                {filteredProjects.map(({ project, unreadCount, lastMessageAt }) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`w-full p-3 text-left hover:bg-accent/50 transition-colors ${
                      selectedProjectId === project.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{project.clientName}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {project.clientEmail}
                        </div>
                        {lastMessageAt && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(lastMessageAt), { addSuffix: true })}
                          </div>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="rounded-full h-5 min-w-[20px] flex items-center justify-center">
                          {unreadCount}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedProjectId && selectedProject ? (
            <>
              <div className="p-4 border-b bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{selectedProject.project.clientName}</div>
                    <div className="text-sm text-muted-foreground">{selectedProject.project.clientEmail}</div>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                {messagesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messagesQuery.data?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No messages yet</p>
                    <p className="text-sm mt-1">Start the conversation by sending a message</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messagesQuery.data?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.senderType === "retoucher" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            msg.senderType === "retoucher"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <div className={`text-xs mt-1 flex items-center gap-1 ${
                            msg.senderType === "retoucher" ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}>
                            {format(new Date(msg.createdAt), "h:mm a")}
                            {msg.channel && msg.channel !== "web" && (
                              <span className="ml-1">via {msg.channel}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <form onSubmit={handleSendMessage} className="p-4 border-t bg-card">
                <div className="flex gap-2">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button type="submit" disabled={!messageText.trim() || sendMessageMutation.isPending}>
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a client from the list to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
