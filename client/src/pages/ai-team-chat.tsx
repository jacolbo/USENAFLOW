import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAdminHeaders } from "@/lib/adminAuth";
import { Bot, Send, ArrowLeft, MessageSquare, Loader2, FileText } from "lucide-react";

interface ChatMessage {
  id: string;
  username: string;
  role: string;
  sender_type: string;
  senderType?: string;
  message: string;
  metadata?: any;
  created_at: string;
  createdAt?: string;
}

export default function AiTeamChat() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const role = localStorage.getItem("usena_role") || "";
  const userId = localStorage.getItem("usena_user_id") || "";
  const isAdmin = role === "Admin" || role === "LeadRetoucher";

  const headers = getAdminHeaders(role, userId);

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/ai-chat/messages"],
    queryFn: async () => {
      const res = await fetch("/api/ai-chat/messages?limit=50", { headers });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: false,
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("/api/ai-chat/message", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/messages"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  const getSummary = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai-chat/admin/summary", { headers });
      if (!res.ok) throw new Error("Failed to get summary");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Daily Summary", description: "Summary loaded into chat" });
      sendMessage.mutate(`[Daily Summary Request]\n\nHere is the daily summary:\n${data.summary}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate summary", variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;
    setInput("");
    sendMessage.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSenderType = (msg: ChatMessage) => msg.sender_type || msg.senderType || "user";
  const getTimestamp = (msg: ChatMessage) => {
    const ts = msg.created_at || msg.createdAt || "";
    if (ts && !ts.endsWith("Z") && !ts.includes("+")) return ts + "Z";
    return ts;
  };

  if (!userId || !role) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Card className="p-6">
          <p className="text-muted-foreground">Please log in to access AI Team Chat.</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>Go to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">AI Studio Assistant</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Ask about team performance" : "Chat about projects & delays"}
            </p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => getSummary.mutate()}
              disabled={getSummary.isPending}
            >
              {getSummary.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1" />
              )}
              Daily Summary
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Start a Conversation</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {isAdmin
                  ? "Ask about team performance, overdue projects, or retoucher stats."
                  : "Explain delays, ask for guidance, or discuss project concerns."}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAi = getSenderType(msg) === "ai";
              const timestamp = getTimestamp(msg);
              return (
                <div
                  key={msg.id}
                  className={`flex ${isAi ? "justify-start" : "justify-end"}`}
                >
                  <div className={`flex gap-2 max-w-[80%] ${isAi ? "flex-row" : "flex-row-reverse"}`}>
                    {isAi && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                        isAi
                          ? "bg-card border text-card-foreground rounded-tl-sm"
                          : "bg-primary text-primary-foreground rounded-tr-sm"
                      }`}
                    >
                      {msg.message}
                      {timestamp && (
                        <div className={`text-[10px] mt-1 ${isAi ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {sendMessage.isPending && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card border">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t bg-card p-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            ref={inputRef}
            placeholder={isAdmin ? "Ask about team performance..." : "Type your message..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sendMessage.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
