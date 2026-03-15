import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useUpload } from "@/hooks/use-upload";
import { Send, Loader2, MessageCircle, User, Camera, AlertCircle, Paperclip, Mic, FileText, Play, Pause, Download, X, Image, Video, Clock, CheckCheck, Bell, Phone, Lock, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getOrCreateKey, storeKeyFromRemote, getExportedKey, encryptMessage, decryptMessage, isEncrypted } from "@/lib/e2ee";
import VoiceCall from "@/components/voice-call";

interface Message {
  id: string;
  projectId: string;
  senderType: 'client' | 'retoucher' | 'system';
  senderEmail: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
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

function PwaInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('pwa-install-dismissed') === 'true'; } catch { return false; }
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(iosDevice);

    if (!iosDevice) {
      const handler = (e: any) => {
        e.preventDefault();
        setInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  if (isInstalled || dismissed) return null;
  if (!isIos && !installPrompt) return null;

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem('pwa-install-dismissed', 'true'); } catch {}
  };

  if (isIos) {
    return (
      <div className="bg-green-50 border-b border-green-200 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">Add to Home Screen</p>
            <p className="text-xs text-green-600 mt-1">
              Tap the <span className="inline-flex items-center"><svg className="inline h-3.5 w-3.5 mx-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share</span> button below, then select <strong>"Add to Home Screen"</strong>
            </p>
          </div>
          <button onClick={handleDismiss} className="text-green-400 hover:text-green-600 p-1 -mt-1 -mr-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border-b border-green-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-800">Add to home screen for quick access</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleDismiss} className="text-xs">
          Not now
        </Button>
        <Button size="sm" onClick={handleInstall} className="bg-green-600 hover:bg-green-700 text-white text-xs">
          Install
        </Button>
      </div>
    </div>
  );
}

export default function ClientChat() {
  const { token } = useParams();
  const [message, setMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [incomingCallOffer, setIncomingCallOffer] = useState<any>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [pendingAttachment, setPendingAttachment] = useState<{
    url: string;
    type: "image" | "video" | "audio" | "file";
    name: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
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

  const { data: authData, isLoading: authLoading, isError: authIsError } = useQuery<{
    valid: boolean;
    reason?: string;
    email: string;
    projectId: string;
    project: ProjectInfo;
  }>({
    queryKey: ['/api/client-chat/verify', token],
    enabled: !!token && !isAuthenticated,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !pendingAttachment)) return;
    
    let messageText = message.trim() || (pendingAttachment ? `Sent ${pendingAttachment.type}` : "");
    if (encryptionKey && messageText) {
      try {
        messageText = await encryptMessage(messageText, encryptionKey);
      } catch (err) {
        console.error('Encryption failed, sending unencrypted:', err);
      }
    }
    
    sendMessageMutation.mutate({ 
      messageText,
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
    if (!isAuthenticated || !authData?.projectId) return;
    const projectId = authData.projectId;

    async function initE2EE() {
      if (!window.crypto?.subtle) return;
      try {
        const res = await fetch(`/api/chat/encryption-key/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.encryptionKey) {
            const key = await storeKeyFromRemote(projectId, 'client', data.encryptionKey);
            setEncryptionKey(key);
            return;
          }
        }
        const key = await getOrCreateKey(projectId, 'client');
        const exported = await getExportedKey(projectId, 'client');
        if (exported) {
          await fetch(`/api/chat/encryption-key/${projectId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptionKey: exported, createdBy: 'client' }),
          });
        }
        setEncryptionKey(key);
      } catch (err) {
        console.error('E2EE init failed:', err);
      }
    }

    initE2EE();
  }, [isAuthenticated, authData?.projectId]);

  useEffect(() => {
    if (!isAuthenticated || !authData?.projectId || !encryptionKey) return;
    if (!messages || messages.length === 0) return;

    async function decryptAll() {
      if (!encryptionKey) return;
      const newMap = new Map<string, string>();
      for (const msg of messages!) {
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
  }, [messages, isAuthenticated, authData?.projectId, encryptionKey]);

  useEffect(() => {
    if (!isAuthenticated || !authData?.projectId || showCall) return;
    const projectId = authData.projectId;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/call/status/${projectId}`);
        const data = await res.json();
        if (data.active && data.status === 'ringing' && data.callerType !== 'client') {
          setIncomingCallOffer(data.offer);
          setShowCall(true);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [isAuthenticated, authData?.projectId, showCall]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    
    async function registerPushNotifications() {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        
        const existingSub = await registration.pushManager.getSubscription();
        let subscription = existingSub;
        
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey,
          });
        }
        
        const subJson = subscription.toJSON();
        await fetch(`/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          }),
        });
      } catch (err) {
        console.error('Push notification registration failed:', err);
      }
    }
    
    registerPushNotifications();
  }, [isAuthenticated, token]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Verifying your chat link...</p>
        </div>
      </div>
    );
  }

  if (authIsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle className="text-yellow-700">Connection Issue</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              We couldn't connect to the server. Please check your internet connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!authData?.valid) {
    const reason = authData?.reason;
    const isExpired = reason === "expired";
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600">
              {isExpired ? "Chat Link Expired" : "Invalid Chat Link"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600">
              {isExpired
                ? "This chat link has expired. Please contact Jepson Myles Studio for a new link."
                : "This chat link is invalid. Please contact Jepson Myles Studio for a new link."}
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
      <PwaInstallBanner />
      <header className="bg-green-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Camera className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-sm truncate">
                {authData.project.clientName.split('(')[0].trim()}
              </h1>
              <p className="text-xs text-green-100">
                Chatting with {authData.project.assignedTo}
              </p>
            </div>
            <button
              onClick={() => { setIncomingCallOffer(null); setShowCall(true); }}
              className="p-2 rounded-full hover:bg-green-700 transition-colors flex-shrink-0"
              title="Voice call"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button 
              onClick={async () => {
                if ('Notification' in window && Notification.permission === 'default') {
                  await Notification.requestPermission();
                }
              }}
              className="p-2 rounded-full hover:bg-green-700 transition-colors flex-shrink-0"
              title="Enable notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
              <Clock className="h-3 w-3 text-green-200" />
              <span className="text-xs text-green-200">Usually replies within 30 min</span>
            </div>
            <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1">
              <Lock className="h-3 w-3 text-green-200" />
              <span className="text-xs text-green-200">Encrypted</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 overflow-y-auto">
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-green-800 font-medium">
              Welcome to your project chat! This is your direct line to the team editor for faster response.
            </p>
            <p className="text-xs text-green-600 mt-1">Monday to Friday 9AM–4PM</p>
          </div>

          {messagesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-green-500" />
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg, index) => {
              if (msg.senderType === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 max-w-[85%]">
                      <p className="text-sm text-blue-800">{decryptedMessages.get(msg.id) || msg.message}</p>
                      <p className="text-xs text-blue-400 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              }

              const isLastClientMsg = msg.senderType === 'client' && 
                !messages.slice(index + 1).some(m => m.senderType === 'client');

              return (
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
                    {msg.message && <p className="text-sm">{decryptedMessages.get(msg.id) || msg.message}</p>}
                    {msg.attachmentUrl && msg.attachmentType && (
                      <AttachmentPreview 
                        url={msg.attachmentUrl} 
                        type={msg.attachmentType} 
                        name={msg.attachmentName}
                        isClient={msg.senderType === 'client'}
                      />
                    )}
                    <div className={`flex items-center gap-1 mt-1 ${
                      msg.senderType === 'client' ? 'justify-end' : ''
                    }`}>
                      <p className={`text-xs ${
                        msg.senderType === 'client' ? 'text-green-100' : 'text-gray-400'
                      }`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {msg.senderType === 'client' && msg.isRead && isLastClientMsg && (
                        <span className="flex items-center gap-0.5 text-green-200">
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span className="text-[10px]">Seen</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
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
      {showCall && authData?.projectId && (
        <VoiceCall
          projectId={authData.projectId}
          callerType="client"
          onClose={() => { setShowCall(false); setIncomingCallOffer(null); }}
          incomingOffer={incomingCallOffer}
        />
      )}
    </div>
  );
}
