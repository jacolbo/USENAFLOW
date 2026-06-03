import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { getAdminHeaders } from "@/lib/adminAuth";
import { UserRoles } from "@shared/schema";

const TEAM_ROLES: string[] = [
  UserRoles.ADMIN,
  UserRoles.LEAD_RETOUCHER,
  UserRoles.RETOUCHER_1,
  UserRoles.RETOUCHER_2,
  UserRoles.RETOUCHER_3,
  UserRoles.EVANS,
  UserRoles.DATA_WRANGLER,
  UserRoles.PHOTOGRAPHER,
];

// Public/client-facing routes where the team FAB should never appear.
const PUBLIC_ROUTE_PREFIXES = [
  "/client-chat",
  "/approve-extras",
  "/survey",
  "/refer",
  "/unsubscribe",
  "/g/",
];

interface ProjectUnread {
  unreadCount: number;
}

export default function ClientMessagesFab() {
  const [location, navigate] = useLocation();
  const role = localStorage.getItem("usena_role") || "";
  const userId = localStorage.getItem("usena_user_id") || "";
  const isTeamMember = !!userId && TEAM_ROLES.includes(role);

  const audioContextRef = useRef<AudioContext | null>(null);
  const prevTotalRef = useRef<number | null>(null);

  const onPublicRoute = PUBLIC_ROUTE_PREFIXES.some((p) => location.startsWith(p));
  const enabled = isTeamMember && !onPublicRoute;

  const { data } = useQuery<ProjectUnread[]>({
    queryKey: ["/api/admin/chat/projects", { archived: false, postReviewOnly: false }],
    queryFn: async () => {
      const headers = getAdminHeaders(role, userId);
      const response = await fetch(
        `/api/admin/chat/projects?archived=false&postReviewOnly=false&_t=${Date.now()}`,
        { headers, cache: "no-store" }
      );
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
    enabled,
    refetchInterval: 3000,
  });

  // Unlock/resume the audio context on the first user interaction so the
  // notification beep can play even before the user opens the messages page.
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume();
        }
      } catch {}
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled]);

  const playNotificationSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
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

  // When polling is disabled (public route / logged out), drop the baseline so
  // that re-enabling establishes a fresh one and never beeps for a stale jump.
  useEffect(() => {
    if (!enabled) prevTotalRef.current = null;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !data) return;
    const total = data.reduce((sum, p) => sum + (p.unreadCount || 0), 0);
    // Skip the very first reading so we don't beep for messages that were
    // already unread when the app loaded (or just after re-enabling).
    if (prevTotalRef.current !== null && total > prevTotalRef.current) {
      playNotificationSound();
    }
    prevTotalRef.current = total;
  }, [data, enabled]);

  if (!enabled) return null;

  const totalUnread = (data || []).reduce((sum, p) => sum + (p.unreadCount || 0), 0);
  const onMessagesPage = location.startsWith("/editor-chat");

  // On the messages page itself the button is redundant — keep the poller
  // running for the sound, but hide the visible button.
  if (onMessagesPage) return null;

  return (
    <button
      onClick={() => navigate("/editor-chat")}
      title="Client messages"
      aria-label="Client messages"
      data-testid="button-client-messages-fab"
      className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center z-50"
    >
      <MessageCircle className="h-6 w-6" />
      {totalUnread > 0 && (
        <span
          data-testid="badge-client-messages-unread"
          className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1 animate-pulse"
        >
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      )}
    </button>
  );
}
