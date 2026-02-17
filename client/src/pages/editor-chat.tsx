import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { queryClient } from "@/lib/queryClient";
import { getAdminHeaders } from "@/lib/adminAuth";
import { UserRoles, type Project } from "@shared/schema";
import { ArrowLeft, Send, MessageCircle, User, Clock, Loader2, Search, X, Paperclip, Mic, Video, Image, FileText, Play, Pause, Download, Bot, Wand2, Phone, Archive, ArchiveRestore } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { getOrCreateKey, storeKeyFromRemote, getExportedKey, encryptMessage, decryptMessage, isEncrypted } from "@/lib/e2ee";
import VoiceCall from "@/components/voice-call";

interface Message {
  id: string;
  projectId: string;
  senderType: "client" | "retoucher" | "system";
  senderEmail: string;
  message: string;
  channel?: string;
  isRead: boolean;
  createdAt: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "video" | "audio" | "file";
  attachmentName?: string;
}

interface ProjectWithUnread {
  project: Project;
  unreadCount: number;
  lastMessageAt: string | null;
  lastSenderType: string | null;
}

const ALLOWED_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER, UserRoles.RETOUCHER_1, UserRoles.RETOUCHER_2, UserRoles.RETOUCHER_3, UserRoles.EVANS];

function AttachmentPreview({ url, type, name }: { url: string; type: string; name?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAudioToggle = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <img src={url} alt={name || "Image"} className="max-w-full rounded-lg max-h-48 object-cover" />
      </a>
    );
  }

  if (type === "video") {
    return (
      <video controls className="max-w-full rounded-lg mt-2 max-h-48">
        <source src={url} />
        Your browser does not support video playback.
      </video>
    );
  }

  if (type === "audio") {
    return (
      <div className="flex items-center gap-2 mt-2 bg-background/50 rounded-full px-3 py-2">
        <audio ref={audioRef} src={url} onEnded={() => setIsPlaying(false)} className="hidden" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={handleAudioToggle}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <span className="text-sm">{name || "Voice note"}</span>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-2 bg-background/50 rounded-lg px-3 py-2 hover:bg-background/70 transition-colors"
    >
      <FileText className="h-4 w-4" />
      <span className="text-sm truncate">{name || "File"}</span>
      <Download className="h-4 w-4 ml-auto" />
    </a>
  );
}

export default function EditorChat() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestedText, setSuggestedText] = useState("");
  const [showCall, setShowCall] = useState(false);
  const [incomingCallOffer, setIncomingCallOffer] = useState<any>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    url: string;
    type: "image" | "video" | "audio" | "file";
    name: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const prevTotalUnreadRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const storedRole = localStorage.getItem("usena_role") as string;
  const storedUserId = localStorage.getItem("usena_user_id") as string;
  const userRole = storedRole || UserRoles.RETOUCHER_1;
  const userId = storedUserId || "";

  const isAllowed = ALLOWED_ROLES.includes(userRole as any);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (response) => {
      const fileName = response.metadata.name;
      const contentType = response.metadata.contentType;
      let attachmentType: "image" | "video" | "audio" | "file" = "file";
      
      if (contentType.startsWith("image/")) attachmentType = "image";
      else if (contentType.startsWith("video/")) attachmentType = "video";
      else if (contentType.startsWith("audio/")) attachmentType = "audio";

      setPendingAttachment({
        url: response.objectPath,
        type: attachmentType,
        name: fileName,
      });
      toast({ title: "File ready", description: "Click send to share the attachment" });
    },
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const projectsQuery = useQuery<ProjectWithUnread[]>({
    queryKey: ["/api/admin/chat/projects", { archived: showArchived }],
    queryFn: async () => {
      const headers = getAdminHeaders(userRole, userId);
      const response = await fetch(`/api/admin/chat/projects?archived=${showArchived}&_t=${Date.now()}`, { 
        headers,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
    enabled: isAllowed,
    refetchInterval: 3000,
  });

  const messagesQuery = useQuery<Message[]>({
    queryKey: ["/api/admin/chat/project", selectedProjectId, "messages"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const headers = getAdminHeaders(userRole, userId);
      const response = await fetch(`/api/admin/chat/project/${selectedProjectId}/messages?_t=${Date.now()}`, { 
        headers,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: isAllowed && !!selectedProjectId,
    refetchInterval: 2000,
  });

  const playNotificationSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  useEffect(() => {
    if (!projectsQuery.data) return;
    const currentTotal = projectsQuery.data.reduce((sum, p) => sum + p.unreadCount, 0);
    if (prevTotalUnreadRef.current > 0 || currentTotal > 0) {
      if (currentTotal > prevTotalUnreadRef.current) {
        playNotificationSound();
      }
    }
    prevTotalUnreadRef.current = currentTotal;
  }, [projectsQuery.data]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ 
      projectId, 
      message,
      attachmentUrl,
      attachmentType,
      attachmentName,
    }: { 
      projectId: string; 
      message: string;
      attachmentUrl?: string;
      attachmentType?: string;
      attachmentName?: string;
    }) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/chat/project/${projectId}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          message,
          attachmentUrl,
          attachmentType,
          attachmentName,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }
      return response.json();
    },
    onSuccess: () => {
      setMessageText("");
      setPendingAttachment(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/project", selectedProjectId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/projects"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const suggestReplyMutation = useMutation({
    mutationFn: async () => {
      const selectedProject = projectsQuery.data?.find((p: ProjectWithUnread) => p.project.id === selectedProjectId);
      if (!selectedProject) throw new Error("No project selected");
      
      const messages = (messagesQuery.data || []).slice(-5).map((m: Message) => ({
        sender: m.senderType === "client" ? selectedProject.project.clientName : "Studio",
        message: m.message,
      }));

      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch("/api/ai/suggest-reply", {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientName: selectedProject.project.clientName,
          projectName: selectedProject.project.clientName,
          recentMessages: messages,
          draftMessage: messageText.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error("Failed to get suggestion");
      return response.json();
    },
    onSuccess: (data) => {
      setSuggestedText(data.suggestion);
      setShowSuggestion(true);
    },
    onError: (error: any) => {
      toast({ title: "AI Suggestion Failed", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/chat/project/${projectId}/archive`, {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to archive chat");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Chat archived" });
      setSelectedProjectId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/projects"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/chat/project/${projectId}/unarchive`, {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to unarchive chat");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Chat unarchived" });
      setSelectedProjectId(null);
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

  useEffect(() => {
    if (!selectedProjectId) {
      setEncryptionKey(null);
      return;
    }

    async function initE2EE() {
      if (!window.crypto?.subtle) return;
      try {
        const res = await fetch(`/api/chat/encryption-key/${selectedProjectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.encryptionKey) {
            const key = await storeKeyFromRemote(selectedProjectId!, 'retoucher', data.encryptionKey);
            setEncryptionKey(key);
            return;
          }
        }
        const key = await getOrCreateKey(selectedProjectId!, 'retoucher');
        const exported = await getExportedKey(selectedProjectId!, 'retoucher');
        if (exported) {
          await fetch(`/api/chat/encryption-key/${selectedProjectId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptionKey: exported, createdBy: 'retoucher' }),
          });
        }
        setEncryptionKey(key);
      } catch (err) {
        console.error('E2EE init failed:', err);
      }
    }

    initE2EE();
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !encryptionKey) return;
    const msgs = messagesQuery.data;
    if (!msgs || msgs.length === 0) return;

    async function decryptAll() {
      if (!encryptionKey) return;
      const newMap = new Map<string, string>();
      for (const msg of msgs!) {
        if (isEncrypted(msg.message)) {
          try {
            const decrypted = await decryptMessage(msg.message, encryptionKey);
            newMap.set(msg.id, decrypted);
          } catch {
            newMap.set(msg.id, '[Unable to decrypt]');
          }
        }
      }
      setDecryptedMessages(newMap);
    }

    decryptAll();
  }, [messagesQuery.data, selectedProjectId, encryptionKey]);

  useEffect(() => {
    if (!selectedProjectId || showCall) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/call/status/${selectedProjectId}`);
        const data = await res.json();
        if (data.active && data.status === 'ringing' && data.callerType !== 'retoucher') {
          setIncomingCallOffer(data.offer);
          setShowCall(true);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedProjectId, showCall]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && !pendingAttachment) || !selectedProjectId) return;
    
    let msgContent = messageText.trim() || (pendingAttachment ? `Sent ${pendingAttachment.type}` : "");
    if (encryptionKey && msgContent) {
      try {
        msgContent = await encryptMessage(msgContent, encryptionKey);
      } catch (err) {
        console.error('Encryption failed, sending unencrypted:', err);
      }
    }
    
    sendMessageMutation.mutate({ 
      projectId: selectedProjectId, 
      message: msgContent,
      attachmentUrl: pendingAttachment?.url,
      attachmentType: pendingAttachment?.type,
      attachmentName: pendingAttachment?.name,
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        await uploadFile(audioFile);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({ 
        title: "Microphone access denied", 
        description: "Please allow microphone access to record voice notes",
        variant: "destructive" 
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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
          <div className="p-3 border-b space-y-2">
            <div className="flex rounded-lg bg-muted p-0.5">
              <button
                onClick={() => { setShowArchived(false); setSelectedProjectId(null); }}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                  !showArchived ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => { setShowArchived(true); setSelectedProjectId(null); }}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors flex items-center justify-center gap-1 ${
                  showArchived ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Archive className="h-3.5 w-3.5" />
                Archived
              </button>
            </div>
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
                {filteredProjects.map(({ project, unreadCount, lastMessageAt, lastSenderType }) => {
                  const nameColor = unreadCount > 0
                    ? "text-green-500 font-semibold"
                    : lastSenderType === "client"
                      ? "text-blue-500 font-medium"
                      : "font-medium";
                  return (
                  <div
                    key={project.id}
                    className={`w-full p-3 text-left hover:bg-accent/50 transition-colors flex items-start gap-2 cursor-pointer ${
                      selectedProjectId === project.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${nameColor}`}>{project.clientName}</div>
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
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="rounded-full h-5 min-w-[20px] flex items-center justify-center">
                          {unreadCount}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showArchived) {
                            unarchiveMutation.mutate(project.id);
                          } else {
                            archiveMutation.mutate(project.id);
                          }
                        }}
                        disabled={archiveMutation.isPending || unarchiveMutation.isPending}
                        title={showArchived ? "Unarchive chat" : "Archive chat"}
                      >
                        {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  );
                })}
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
                  <div className="flex-1">
                    <div className="font-medium">{selectedProject.project.clientName}</div>
                    <div className="text-sm text-muted-foreground">{selectedProject.project.clientEmail}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (showArchived) {
                        unarchiveMutation.mutate(selectedProject.project.id);
                      } else {
                        archiveMutation.mutate(selectedProject.project.id);
                      }
                    }}
                    disabled={archiveMutation.isPending || unarchiveMutation.isPending}
                    title={showArchived ? "Unarchive chat" : "Archive chat"}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showArchived ? <ArchiveRestore className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setIncomingCallOffer(null); setShowCall(true); }}
                    title="Voice call"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Phone className="h-5 w-5" />
                  </Button>
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
                    {messagesQuery.data?.map((msg, idx, arr) => {
                      const msgDate = new Date(msg.createdAt);
                      const dateStr = format(msgDate, "EEEE, MMM d, yyyy");
                      const prevMsg = idx > 0 ? arr[idx - 1] : null;
                      const showDateSeparator = !prevMsg || format(new Date(prevMsg.createdAt), "yyyy-MM-dd") !== format(msgDate, "yyyy-MM-dd");
                      const timeLabel = format(msgDate, "MMM d, h:mm a");

                      if (msg.senderType === "system") {
                        return (
                          <div key={msg.id}>
                            {showDateSeparator && (
                              <div className="flex items-center gap-2 my-3">
                                <div className="flex-1 border-t" />
                                <span className="text-xs text-muted-foreground px-2">{dateStr}</span>
                                <div className="flex-1 border-t" />
                              </div>
                            )}
                            <div className="flex justify-center my-1">
                              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-1.5 max-w-[80%]">
                                <div className="flex items-center gap-1.5">
                                  <Bot className="h-3 w-3 text-blue-500" />
                                  <span className="text-xs text-blue-600 dark:text-blue-400">{decryptedMessages.get(msg.id) || msg.message}</span>
                                </div>
                                <p className="text-[10px] text-blue-400 mt-0.5">
                                  {timeLabel}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id}>
                          {showDateSeparator && (
                            <div className="flex items-center gap-2 my-3">
                              <div className="flex-1 border-t" />
                              <span className="text-xs text-muted-foreground px-2">{dateStr}</span>
                              <div className="flex-1 border-t" />
                            </div>
                          )}
                          <div
                            className={`flex ${msg.senderType === "retoucher" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                                msg.senderType === "retoucher"
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-muted rounded-bl-md"
                              }`}
                            >
                              {msg.message && <p className="text-sm whitespace-pre-wrap">{decryptedMessages.get(msg.id) || msg.message}</p>}
                              {msg.attachmentUrl && msg.attachmentType && (
                                <AttachmentPreview 
                                  url={msg.attachmentUrl} 
                                  type={msg.attachmentType} 
                                  name={msg.attachmentName}
                                />
                              )}
                              <div className={`text-xs mt-1 flex items-center gap-1 ${
                                msg.senderType === "retoucher" ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}>
                                {timeLabel}
                                {msg.channel && msg.channel !== "web" && (
                                  <span className="ml-1">via {msg.channel}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t bg-card">
                {pendingAttachment && (
                  <div className="mb-3 p-2 bg-muted rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pendingAttachment.type === "image" && <Image className="h-4 w-4" />}
                      {pendingAttachment.type === "video" && <Video className="h-4 w-4" />}
                      {pendingAttachment.type === "audio" && <Mic className="h-4 w-4" />}
                      {pendingAttachment.type === "file" && <FileText className="h-4 w-4" />}
                      <span className="text-sm truncate max-w-[200px]">{pendingAttachment.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setPendingAttachment(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {isUploading && (
                  <div className="mb-3">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Uploading... {progress}%</p>
                  </div>
                )}

                {showSuggestion && suggestedText && (
                  <div className="mb-2 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <Wand2 className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-purple-900 dark:text-purple-100">{suggestedText}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-purple-600"
                          onClick={() => {
                            setMessageText(suggestedText);
                            setShowSuggestion(false);
                            setSuggestedText("");
                          }}
                        >
                          Use this
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            setShowSuggestion(false);
                            setSuggestedText("");
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  />
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || sendMessageMutation.isPending}
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isUploading || sendMessageMutation.isPending}
                    className={isRecording ? "text-red-500 animate-pulse" : ""}
                  >
                    <Mic className="h-5 w-5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => suggestReplyMutation.mutate()}
                    disabled={suggestReplyMutation.isPending || !selectedProjectId}
                    title={messageText.trim() ? "Polish this message with AI" : "Suggest a reply with AI"}
                    className="text-purple-500 hover:text-purple-700"
                  >
                    {suggestReplyMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Wand2 className="h-5 w-5" />
                    )}
                  </Button>

                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={isRecording ? "Recording..." : "Type a message..."}
                    className="flex-1"
                    disabled={sendMessageMutation.isPending || isRecording}
                  />
                  
                  <Button 
                    type="submit" 
                    disabled={(!messageText.trim() && !pendingAttachment) || sendMessageMutation.isPending || isRecording}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
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
      {showCall && selectedProjectId && (
        <VoiceCall
          projectId={selectedProjectId}
          callerType="retoucher"
          onClose={() => { setShowCall(false); setIncomingCallOffer(null); }}
          incomingOffer={incomingCallOffer}
        />
      )}
    </div>
  );
}
