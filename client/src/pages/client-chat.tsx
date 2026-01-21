import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageCircle, User, Camera, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  projectId: string;
  senderType: 'client' | 'retoucher';
  senderEmail: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface ProjectInfo {
  id: string;
  clientName: string;
  assignedTo: string;
  clientEmail: string;
}

export default function ClientChat() {
  const { token } = useParams();
  const [message, setMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: authData, isLoading: authLoading } = useQuery<{
    valid: boolean;
    email: string;
    projectId: string;
    project: ProjectInfo;
  }>({
    queryKey: ['/api/client-chat/verify', token],
    enabled: !!token && !isAuthenticated,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/client-chat/messages', token],
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const response = await fetch(`/api/client-chat/${token}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, email }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
      return response.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/client-chat/messages', token] });
    },
  });

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    
    if (!email.trim()) {
      setAuthError("Please enter your email address");
      return;
    }
    
    if (authData?.email.toLowerCase() !== email.toLowerCase()) {
      setAuthError("This email does not match our records for this project");
      return;
    }
    
    setIsAuthenticated(true);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (!authData?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Invalid Chat Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600">
              This chat link is invalid or has expired. Please contact Jepson Myles Studio for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-gray-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Chat with Your Retoucher</CardTitle>
            <p className="text-gray-600 mt-2">
              Verify your email to start chatting about your photo project
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-600">
                  <strong>Project:</strong> {authData.project.clientName}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Retoucher:</strong> {authData.project.assignedTo}
                </p>
              </div>
              
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
              
              {authError && (
                <p className="text-sm text-red-600 text-center">{authError}</p>
              )}
              
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                Start Chatting
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-gray-100 flex flex-col">
      <header className="bg-green-600 text-white p-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold">{authData.project.clientName}</h1>
            <p className="text-sm text-green-100">
              Chatting with {authData.project.assignedTo}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 overflow-y-auto">
        <div className="space-y-3">
          {messagesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-green-500" />
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === 'client' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.senderType === 'client'
                      ? 'bg-green-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-xs mt-1 ${
                    msg.senderType === 'client' ? 'text-green-100' : 'text-gray-400'
                  }`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500">No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-white border-t p-4">
        <form onSubmit={handleSendMessage} className="max-w-2xl mx-auto flex gap-2">
          <Input
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1"
            disabled={sendMessageMutation.isPending}
          />
          <Button 
            type="submit" 
            className="bg-green-600 hover:bg-green-700"
            disabled={sendMessageMutation.isPending || !message.trim()}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </footer>
    </div>
  );
}
