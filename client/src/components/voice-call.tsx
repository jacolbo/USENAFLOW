import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceCallProps {
  projectId: string;
  callerType: 'client' | 'retoucher';
  onClose: () => void;
  incomingOffer?: any;
}

type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export default function VoiceCall({ projectId, callerType, onClose, incomingOffer }: VoiceCallProps) {
  const [callState, setCallState] = useState<CallState>(incomingOffer ? 'ringing' : 'idle');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const lastIceCountRef = useRef(0);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        fetch(`/api/chat/call/ice/${projectId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate: event.candidate.toJSON(), from: callerType }),
        }).catch(console.error);
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(console.error);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handleEndCall();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [projectId, callerType]);

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const pending = pendingIceCandidatesRef.current.splice(0);
    for (const candidate of pending) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    }
  }, []);

  const startPollingForICE = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const iceRes = await fetch(`/api/chat/call/ice/${projectId}/${callerType}`);
        const iceData = await iceRes.json();
        if (iceData.candidates && iceData.candidates.length > lastIceCountRef.current) {
          const newCandidates = iceData.candidates.slice(lastIceCountRef.current);
          lastIceCountRef.current = iceData.candidates.length;
          for (const candidate of newCandidates) {
            if (pcRef.current && pcRef.current.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            } else {
              pendingIceCandidatesRef.current.push(candidate);
            }
          }
        }
      } catch {}
    }, 2000);
  }, [projectId, callerType]);

  const initiateCall = useCallback(async () => {
    try {
      setCallState('calling');
      setError(null);
      lastIceCountRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(`/api/chat/call/initiate/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerType, offer: pc.localDescription }),
      });
      if (!res.ok) throw new Error('Failed to initiate call');

      startPollingForICE();

      const answerPoll = setInterval(async () => {
        try {
          if (pcRef.current && !pcRef.current.remoteDescription) {
            const ansRes = await fetch(`/api/chat/call/answer/${projectId}`);
            const ansData = await ansRes.json();
            if (ansData.answered && ansData.answer) {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(ansData.answer));
              await flushPendingCandidates();
            }
          }
          const statusRes = await fetch(`/api/chat/call/status/${projectId}`);
          const statusData = await statusRes.json();
          if (!statusData.active || statusData.status === 'ended') {
            clearInterval(answerPoll);
            handleEndCall();
          }
        } catch {}
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to start call');
      setCallState('idle');
      cleanup();
    }
  }, [projectId, callerType, createPeerConnection, startPollingForICE, flushPendingCandidates, cleanup]);

  const answerCall = useCallback(async () => {
    if (!incomingOffer) return;
    try {
      setCallState('connected');
      setError(null);
      lastIceCountRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch(`/api/chat/call/answer/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: pc.localDescription }),
      });

      startPollingForICE();

      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to answer call');
      setCallState('idle');
      cleanup();
    }
  }, [incomingOffer, projectId, createPeerConnection, startPollingForICE, cleanup]);

  const handleEndCall = useCallback(async () => {
    try {
      await fetch(`/api/chat/call/end/${projectId}`, { method: 'POST' });
    } catch {}
    cleanup();
    setCallState('ended');
    setTimeout(onClose, 1000);
  }, [projectId, cleanup, onClose]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, []);

  useEffect(() => {
    if (!incomingOffer && callState === 'idle') {
      initiateCall();
    }
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-green-600 text-white px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="h-8 w-8" />
          </div>

          {callState === 'calling' && (
            <>
              <h3 className="text-lg font-semibold">Calling...</h3>
              <p className="text-green-100 text-sm mt-1">Waiting for {callerType === 'client' ? 'retoucher' : 'client'} to answer</p>
              <div className="flex justify-center gap-1 mt-3">
                <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </>
          )}

          {callState === 'ringing' && (
            <>
              <h3 className="text-lg font-semibold">Incoming Call</h3>
              <p className="text-green-100 text-sm mt-1">
                {callerType === 'client' ? 'Retoucher' : 'Client'} is calling...
              </p>
            </>
          )}

          {callState === 'connected' && (
            <>
              <h3 className="text-lg font-semibold">Connected</h3>
              <p className="text-3xl font-mono mt-2">{formatDuration(callDuration)}</p>
            </>
          )}

          {callState === 'ended' && (
            <>
              <h3 className="text-lg font-semibold">Call Ended</h3>
              <p className="text-green-100 text-sm mt-1">Duration: {formatDuration(callDuration)}</p>
            </>
          )}

          {error && (
            <p className="text-red-200 text-sm mt-2">{error}</p>
          )}
        </div>

        <div className="px-6 py-6 flex justify-center gap-4">
          {callState === 'ringing' && (
            <>
              <Button
                onClick={answerCall}
                className="rounded-full w-14 h-14 bg-green-500 hover:bg-green-600 text-white"
                size="icon"
              >
                <Phone className="h-6 w-6" />
              </Button>
              <Button
                onClick={handleEndCall}
                className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-600 text-white"
                size="icon"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </>
          )}

          {callState === 'calling' && (
            <Button
              onClick={handleEndCall}
              className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-600 text-white"
              size="icon"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          )}

          {callState === 'connected' && (
            <>
              <Button
                onClick={toggleMute}
                className={`rounded-full w-14 h-14 ${isMuted ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'} text-white`}
                size="icon"
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
              <Button
                onClick={handleEndCall}
                className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-600 text-white"
                size="icon"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </>
          )}

          {callState === 'ended' && (
            <Button
              onClick={onClose}
              variant="outline"
              className="rounded-full"
            >
              <X className="h-4 w-4 mr-2" /> Close
            </Button>
          )}
        </div>
      </div>
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}
