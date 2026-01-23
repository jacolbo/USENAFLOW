import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useUpload } from "@/hooks/use-upload";
import { Send, Loader2, MessageCircle, User, Camera, AlertCircle, Paperclip, Mic, FileText, Play, Pause, Download, X, Image, Video } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  projectId: string;
  senderType: 'client' | 'retoucher';
  senderEmail: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'audio' | 'file';
  attachmentName?: string;
}

interface ProjectInfo {
  id: string;
  clientName: string;
  assignedTo: string;
  clientEmail: string;
}

function AttachmentPreview({ url, type, name, isClient }: { url: string; type: string; name?: string; isClient: boolean }) {
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
      <div className={`flex items-center gap-2 mt-2 rounded-full px-3 py-2 ${isClient ? 'bg-green-700' : 'bg-gray-100'}`}>
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
      className={`flex items-center gap-2 mt-2 rounded-lg px-3 py-2 transition-colors ${
        isClient ? 'bg-green-700 hover:bg-green-800' : 'bg-gray-100 hover:bg-gray-200'
      }`}
    >
      <FileText className="h-4 w-4" />
      <span className="text-sm truncate">{name || "File"}</span>
      <Download className="h-4 w-4 ml-auto" />
    </a>
  );
}

export default function ClientChat() {
  const { token } = useParams();
  const [message, setMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    url: string;
    type: "image" | "video" | "audio" | "file";
    name: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const queryClient = useQueryClient();

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
    },
    onError: (error) => {
      console.error("Upload failed:", error);
    },
  });

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
    mutationFn: async ({ 
      messageText,
      attachmentUrl,
      attachmentType,
      attachmentName,
    }: { 
      messageText: string;
      attachmentUrl?: string;
      attachmentType?: string;
      attachmentName?: string;
    }) => {
      const response = await fetch(`/api/client-chat/${token}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageText, 
          email,
          attachmentUrl,
          attachmentType,
          attachmentName,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
      return response.json();
    },
    onSuccess: () => {
      setMessage("");
      setPendingAttachment(null);
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
    if ((!message.trim() && !pendingAttachment)) return;
    
    sendMessageMutation.mutate({ 
      messageText: message.trim() || (pendingAttachment ? `Sent ${pendingAttachment.type}` : ""),
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
      console.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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
                  {msg.message && <p className="text-sm">{msg.message}</p>}
                  {msg.attachmentUrl && msg.attachmentType && (
                    <AttachmentPreview 
                      url={msg.attachmentUrl} 
                      type={msg.attachmentType} 
                      name={msg.attachmentName}
                      isClient={msg.senderType === 'client'}
                    />
                  )}
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
        <div className="max-w-2xl mx-auto">
          {pendingAttachment && (
            <div className="mb-3 p-2 bg-gray-100 rounded-lg flex items-center justify-between">
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
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Uploading... {progress}%</p>
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

            <Input
              type="text"
              placeholder={isRecording ? "Recording..." : "Type a message..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1"
              disabled={sendMessageMutation.isPending || isRecording}
            />
            
            <Button 
              type="submit" 
              className="bg-green-600 hover:bg-green-700"
              disabled={sendMessageMutation.isPending || isRecording || (!message.trim() && !pendingAttachment)}
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </footer>
    </div>
  );
}
