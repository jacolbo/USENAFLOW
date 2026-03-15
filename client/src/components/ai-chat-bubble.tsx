import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAdminHeaders } from "@/lib/adminAuth";
import { Bot, Send, X, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export default function AiChatBubble() {
  const role = localStorage.getItem("usena_role") || "";
  const userId = localStorage.getItem("usena_user_id") || "";
  const userName = localStorage.getItem("usena_name") || "";
  const isLoggedIn = !!userId && !!role;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const headers = getAdminHeaders(role, userId);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/ai-chat/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/ai-chat/unread-count", { headers });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30000,
    enabled: isLoggedIn,
  });

  const unreadCount = unreadData?.count || 0;

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/ai-chat/messages"],
    queryFn: async () => {
      const res = await fetch("/api/ai-chat/messages?limit=30", { headers });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isOpen && isLoggedIn,
  });

  const markSeen = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai-chat/mark-seen", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to mark seen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/unread-count"] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("/api/ai-chat/message", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/unread-count"] });
    },
  });

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages, sendMessage.isPending]);

  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markSeen.mutate();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isLoggedIn) return null;

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

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-[360px] max-h-[500px] bg-background border rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Studio Manager AI</h3>
              <p className="text-[10px] opacity-80">Updates & team communication</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 max-h-[360px] p-3">
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10">
                  <Bot className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isAi = getSenderType(msg) === "ai";
                  const timestamp = getTimestamp(msg);
                  return (
                    <div key={msg.id} className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
                      <div className={`flex gap-1.5 max-w-[85%] ${isAi ? "flex-row" : "flex-row-reverse"}`}>
                        {isAi && (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bot className="h-3 w-3 text-primary" />
                          </div>
                        )}
                        <div
                          className={`rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                            isAi
                              ? "bg-muted text-foreground rounded-tl-sm"
                              : "bg-primary text-primary-foreground rounded-tr-sm"
                          }`}
                        >
                          {msg.message}
                          {timestamp && (
                            <div className={`text-[9px] mt-0.5 ${isAi ? "text-muted-foreground" : "text-primary-foreground/60"}`}>
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
                  <div className="flex gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                    <div className="rounded-xl rounded-tl-sm px-3 py-2 bg-muted">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-2">
            <div className="flex gap-1.5">
              <Input
                ref={inputRef}
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sendMessage.isPending}
                className="flex-1 h-8 text-xs"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sendMessage.isPending}
                size="icon"
                className="h-8 w-8"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            markSeen.mutate();
          }
        }}
        className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center z-50"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1 animate-pulse">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
