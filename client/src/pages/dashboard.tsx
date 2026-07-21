import { useState, useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { LoginForm } from "@/components/login-form";
import { SettingsPanel } from "@/components/settings-panel";
import { AddProjectForm } from "@/components/add-project-form";
import { TaskTable } from "@/components/task-table";
import { TeamAnalytics } from "@/components/team-analytics";
import { ShootTrackerWidget } from "@/components/shoot-tracker-widget";
import { DailyQuote } from "@/components/daily-quote";
import { NotificationCenter } from "@/components/notification-center";
import { TradeOfferModal } from "@/components/TradeOfferModal";
import { ComplaintsCalendar } from "@/components/complaints-calendar";
import { DriveManager } from "@/components/drive-manager";

import { WRUButton } from "@/components/WRUButton";
import { useSSE } from "@/hooks/use-sse";
import { User } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { Project } from "@shared/schema";
import { User as UserIcon, LogOut, Settings, Archive, ArrowRightLeft, DollarSign, AlertTriangle, Calendar, CalendarDays, MessageCircle, LayoutDashboard, Gift, Crown, RefreshCw, Mail, MoreHorizontal, Wrench, Trophy, Star, HardDrive, Sparkles, Brain, Bot, Zap, Image, Camera, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import logoImage from "@assets/USENA-FLOW_1754522507856.png";
import { WidgetCustomizer, useWidgetPreferences } from "@/components/widget-customizer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { getAdminHeaders } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ApiUser {
  id: string;
  username: string;
  name: string;
  role: string;
  abbreviation: string;
}

function RetoucherCoachWidget({ retoucherName }: { retoucherName: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{ advice: string[]; encouragement: string; generatedAt: string }>({
    queryKey: ["/api/ai/retoucher-advice", retoucherName],
    queryFn: async () => {
      const res = await fetch(`/api/ai/retoucher-advice/${encodeURIComponent(retoucherName)}`);
      if (!res.ok) throw new Error("Failed to fetch advice");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Coach</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">Your personal performance tips</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-2 h-2 mt-2 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {data?.encouragement && (
              <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border border-blue-100 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{data.encouragement}</p>
              </div>
            )}
            {data?.advice && data.advice.length > 0 ? (
              <ul className="space-y-3">
                {data.advice.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-purple-500 flex-shrink-0" />
                    <p className="text-sm text-gray-700 dark:text-gray-300">{tip}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No advice available yet. Check back soon for personalized tips.
              </p>
            )}
          </>
        )}
        {data?.generatedAt && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-right">
            Generated {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

// Extra Photos Sales View Component
function AIInsightsWidget() {
  const { data, isLoading, refetch, isFetching } = useQuery<{ insights: string[]; generatedAt: string }>({
    queryKey: ["/api/ai/insights"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Insights</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">Smart project analysis</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-2 h-2 mt-2 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.insights && data.insights.length > 0 ? (
          <ul className="space-y-3">
            {data.insights.map((insight, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-purple-500 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">{insight}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No insights available yet. Add some projects to see AI analysis.
          </p>
        )}
        {data?.generatedAt && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-right">
            Generated {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

interface ForecastWeek {
  weekStart: string;
  projectedLoad: number;
  capacity: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
}

function WorkloadForecastWidget({ userRole, userId }: { userRole: string; userId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    weeks: ForecastWeek[];
    recommendations: string[];
    summary: string;
    generatedAt: string;
  }>({
    queryKey: ["/api/ai/workload-forecast"],
    queryFn: async () => {
      const res = await fetch("/api/ai/workload-forecast", { headers: getAdminHeaders(userRole, userId) });
      if (!res.ok) throw new Error("Failed to fetch forecast");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const riskColors: Record<string, string> = {
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const riskBarColors: Record<string, string> = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Workload Forecast</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">AI capacity planning</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-600 rounded" />
            ))}
          </div>
        ) : data?.weeks && data.weeks.length > 0 ? (
          <div className="space-y-4">
            {data.summary && (
              <p className="text-sm text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded">
                {data.summary}
              </p>
            )}
            <div className="space-y-3">
              {data.weeks.map((week, idx) => {
                const pct = week.capacity > 0 ? Math.min((week.projectedLoad / week.capacity) * 100, 150) : 0;
                const weekDate = new Date(week.weekStart);
                const label = weekDate.toLocaleDateString("en-ZA", { month: "short", day: "numeric" });
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">Week of {label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">{week.projectedLoad}/{week.capacity} projects</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColors[week.riskLevel]}`}>
                          {week.riskLevel}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${riskBarColors[week.riskLevel]}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    {week.warnings.length > 0 && (
                      <div className="flex items-start gap-1.5 mt-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">{week.warnings.join(". ")}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {data.recommendations && data.recommendations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Recommendations</h3>
                <ul className="space-y-2">
                  {data.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">{rec}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.generatedAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-right">
                Generated {new Date(data.generatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No forecast data available. Sync your calendar to see capacity planning.
          </p>
        )}
      </div>
    </div>
  );
}

interface RiskAlert {
  projectId: string;
  clientName: string;
  riskScore: number;
  riskFactors: string[];
  predictedDaysLate: number;
  recommendation: string;
}

function PredictiveRiskWidget({ userRole, userId }: { userRole: string; userId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    alerts: RiskAlert[];
    summary: string;
    generatedAt: string;
  }>({
    queryKey: ["/api/ai/predictive-risk"],
    queryFn: async () => {
      const res = await fetch("/api/ai/predictive-risk", { headers: getAdminHeaders(userRole, userId) });
      if (!res.ok) throw new Error("Failed to fetch risk alerts");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-red-600 dark:text-red-400";
    if (score >= 60) return "text-orange-600 dark:text-orange-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  const getRiskBg = (score: number) => {
    if (score >= 80) return "bg-red-100 dark:bg-red-900/30";
    if (score >= 60) return "bg-orange-100 dark:bg-orange-900/30";
    return "bg-yellow-100 dark:bg-yellow-900/30";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Predictive Risk Alerts</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">AI early warnings</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-sm text-amber-600 hover:text-amber-800 dark:text-amber-400 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-600 rounded" />
            ))}
          </div>
        ) : data?.alerts && data.alerts.length > 0 ? (
          <div className="space-y-4">
            {data.summary && (
              <p className="text-sm text-gray-700 dark:text-gray-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded">
                {data.summary}
              </p>
            )}
            <div className="space-y-3">
              {data.alerts.slice(0, 8).map((alert, idx) => (
                <div key={idx} className={`p-3 rounded-lg ${getRiskBg(alert.riskScore)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{alert.clientName}</span>
                    <div className="flex items-center gap-2">
                      {alert.predictedDaysLate > 0 && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          ~{alert.predictedDaysLate}d late
                        </span>
                      )}
                      <span className={`text-sm font-bold ${getRiskColor(alert.riskScore)}`}>
                        {alert.riskScore}%
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {alert.riskFactors.slice(0, 3).map((factor, fi) => (
                      <span key={fi} className="text-xs px-1.5 py-0.5 bg-white/50 dark:bg-gray-800/50 rounded text-gray-700 dark:text-gray-300">
                        {factor}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{alert.recommendation}</p>
                </div>
              ))}
            </div>
            {data.generatedAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-right">
                Generated {new Date(data.generatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
              <Star className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">All Clear</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No projects are predicted to go overdue</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleReviewFunnelWidget({ userRole, userId }: { userRole: string; userId: string }) {
  const [windowDays, setWindowDays] = useState<number>(30);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { data, isLoading } = useQuery<{
    windowDays: number;
    promptsSent: number;
    remindersSent: number;
    copyClicks: number;
    googleClicks: number;
    clickThroughRate: number;
    suppressedTotal: number;
    suppressedAuto: number;
    suppressedManual: number;
  }>({
    queryKey: ["/api/google-review/stats", windowDays],
    queryFn: async () => {
      const res = await fetch(`/api/google-review/stats?windowDays=${windowDays}`, {
        headers: getAdminHeaders(userRole, userId),
      });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  type BreakdownRow = { label: string; promptsSent: number; googleClicks: number; clickThroughRate: number };
  const { data: breakdown, isLoading: isBreakdownLoading } = useQuery<{
    windowDays: number;
    byRetoucher: BreakdownRow[];
    byTier: BreakdownRow[];
  }>({
    queryKey: ["/api/google-review/breakdown", windowDays],
    queryFn: async () => {
      const res = await fetch(`/api/google-review/breakdown?windowDays=${windowDays}`, {
        headers: getAdminHeaders(userRole, userId),
      });
      if (!res.ok) throw new Error("Failed to load breakdown");
      return res.json();
    },
    enabled: showBreakdown,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  type RepeatTierRow = { label: string; reviewers: number; reviewersWithRepeat: number; conversionRate: number };
  const { data: repeatStats } = useQuery<{
    windowDays: number;
    reviewersTotal: number;
    reviewersWithRepeat: number;
    conversionRate: number;
    byTier: RepeatTierRow[];
  }>({
    queryKey: ["/api/google-review/repeat-bookings", windowDays],
    queryFn: async () => {
      const res = await fetch(`/api/google-review/repeat-bookings?windowDays=${windowDays}`, {
        headers: getAdminHeaders(userRole, userId),
      });
      if (!res.ok) throw new Error("Failed to load repeat-booking stats");
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const ctrPct = data ? (data.clickThroughRate * 100).toFixed(1) : "0.0";

  const renderBreakdownTable = (title: string, rows: BreakdownRow[] | undefined, nameHeader: string) => (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      {!rows || rows.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-3">No prompts sent in this window.</div>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left px-3 py-2 font-medium">{nameHeader}</th>
                <th className="text-right px-3 py-2 font-medium">Prompts</th>
                <th className="text-right px-3 py-2 font-medium">Google clicks</th>
                <th className="text-right px-3 py-2 font-medium">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((r, idx) => (
                <tr key={`${title}-${r.label}-${idx}`} className="text-gray-800 dark:text-gray-200">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right">{r.promptsSent}</td>
                  <td className="px-3 py-2 text-right">{r.googleClicks}</td>
                  <td className="px-3 py-2 text-right font-medium text-yellow-700 dark:text-yellow-300">
                    {(r.clickThroughRate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Google Review Funnel</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">Last {windowDays} days</span>
          </div>
          <div className="flex items-center gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                className={`text-xs px-2 py-1 rounded ${
                  windowDays === d
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-600 rounded" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Prompts sent</div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data?.promptsSent ?? 0}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Reminders sent</div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data?.remindersSent ?? 0}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Copy-helper opens</div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data?.copyClicks ?? 0}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">Google clicks</div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data?.googleClicks ?? 0}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1">
              <div
                className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 flex items-center justify-between cursor-help"
                title={`Auto-detected: ${data?.suppressedAuto ?? 0}\nMarked manually: ${data?.suppressedManual ?? 0}`}
                data-testid="tile-google-review-suppressed"
              >
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Suppressed (already reviewed)</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Clients we skipped because they already left a Google review
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data?.suppressedTotal ?? 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {data?.suppressedAuto ?? 0} auto · {data?.suppressedManual ?? 0} manual
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/40 rounded-lg px-4 py-3">
              <div className="text-sm text-gray-700 dark:text-gray-300">Click-through rate</div>
              <div className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                {ctrPct}%
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg px-4 py-3">
              <div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Reviewers who booked again
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {repeatStats?.reviewersWithRepeat ?? 0} of {repeatStats?.reviewersTotal ?? 0} clients who clicked the Google link came back for another booking
                </div>
              </div>
              <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {repeatStats ? (repeatStats.conversionRate * 100).toFixed(1) : "0.0"}%
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setShowBreakdown(true)}
                className="text-xs px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                data-testid="button-google-review-breakdown"
              >
                View breakdown by retoucher & tier
              </button>
            </div>
          </>
        )}
      </div>

      <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Google review funnel breakdown
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                Last {windowDays} days
              </span>
            </DialogTitle>
          </DialogHeader>
          {isBreakdownLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ) : (
            <div className="space-y-6">
              {renderBreakdownTable("By retoucher", breakdown?.byRetoucher, "Retoucher")}
              {renderBreakdownTable("By client tier", breakdown?.byTier, "Tier")}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Repeat bookings by tier
                </h3>
                {!repeatStats?.byTier || repeatStats.byTier.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 py-3">No reviewers in this window.</div>
                ) : (
                  <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Tier</th>
                          <th className="text-right px-3 py-2 font-medium">Reviewers</th>
                          <th className="text-right px-3 py-2 font-medium">Re-booked</th>
                          <th className="text-right px-3 py-2 font-medium">Conversion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {repeatStats.byTier.map((r, idx) => (
                          <tr key={`repeat-${r.label}-${idx}`} className="text-gray-800 dark:text-gray-200">
                            <td className="px-3 py-2">{r.label}</td>
                            <td className="px-3 py-2 text-right">{r.reviewers}</td>
                            <td className="px-3 py-2 text-right">{r.reviewersWithRepeat}</td>
                            <td className="px-3 py-2 text-right font-medium text-emerald-700 dark:text-emerald-300">
                              {(r.conversionRate * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GooglePlaceReviewsWidget({ userRole, userId }: { userRole: string; userId: string }) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery<{
    placeName: string;
    rating: number;
    totalRatings: number;
    url?: string;
    fetchedAt: number;
    reviews: Array<{
      authorName: string;
      authorPhotoUrl?: string;
      rating: number;
      text: string;
      relativeTime: string;
      time: number;
    }>;
  }>({
    queryKey: ["/api/google-places/summary"],
    queryFn: async ({ meta }) => {
      const force = (meta as any)?.force ? "?refresh=1" : "";
      const res = await fetch(`/api/google-places/summary${force}`, {
        headers: getAdminHeaders(userRole, userId),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to load Google reviews");
      }
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const renderStars = (rating: number) => {
    const full = Math.round(rating);
    return (
      <span className="text-yellow-500" aria-label={`${rating} out of 5`}>
        {"★".repeat(full)}
        <span className="text-gray-300 dark:text-gray-600">{"★".repeat(Math.max(0, 5 - full))}</span>
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Live Google Reviews</h2>
            {data && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{data.placeName}</span>
            )}
          </div>
          <button
            onClick={async () => {
              const res = await fetch("/api/google-places/summary?refresh=1", {
                headers: getAdminHeaders(userRole, userId),
              });
              if (res.ok) {
                const json = await res.json();
                queryClient.setQueryData(["/api/google-places/summary"], json);
              } else {
                refetch();
              }
            }}
            disabled={isRefetching}
            className="text-xs px-2 py-1 rounded text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {isRefetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
            <div className="h-16 bg-gray-200 dark:bg-gray-600 rounded" />
            <div className="h-16 bg-gray-200 dark:bg-gray-600 rounded" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400">
            Couldn't load Google reviews: {(error as Error).message}.
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Check that the Places API is enabled and that GOOGLE_PLACE_ID matches your business.
            </div>
          </div>
        ) : !data ? null : (
          <>
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    {data.rating.toFixed(1)}
                  </span>
                  <span className="text-lg">{renderStars(data.rating)}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.totalRatings.toLocaleString()} total reviews
                </div>
              </div>
              {data.url && (
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View on Google →
                </a>
              )}
            </div>

            {data.reviews.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">No reviews yet.</div>
            ) : (
              <div className="space-y-3">
                {data.reviews.map((rev, i) => (
                  <div key={`${rev.authorName}-${rev.time}-${i}`} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      {rev.authorPhotoUrl ? (
                        <img
                          src={rev.authorPhotoUrl}
                          alt={rev.authorName}
                          className="w-9 h-9 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center">
                          {(rev.authorName || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                            {rev.authorName}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 ml-2 shrink-0">
                            {rev.relativeTime}
                          </div>
                        </div>
                        <div className="text-sm">{renderStars(rev.rating)}</div>
                        {rev.text && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-line">
                            {rev.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 text-right">
              Updated {new Date(data.fetchedAt).toLocaleTimeString()} · Google shows the 5 most recent reviews
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GalleryActivityWidget({ userRole, userId }: { userRole: string; userId: string }) {
  const [, setLocation] = useLocation();
  const { data: galleries = [], isLoading } = useQuery<Array<{ id: string; name: string; status: string; photoCount: number; favListCount: number }>>({
    queryKey: ["/api/galleries"],
    queryFn: async () => {
      const res = await fetch("/api/galleries", {
        headers: { "X-Usena-Role": userRole, "X-Usena-User-Id": userId },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const recentGalleries = galleries.slice(0, 5);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Gallery Activity</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">Client selections & downloads</span>
          </div>
          <button
            onClick={() => setLocation('/galleries')}
            className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400"
          >
            View All
          </button>
        </div>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-200 dark:bg-gray-600 rounded" />
            ))}
          </div>
        ) : recentGalleries.length === 0 ? (
          <div className="text-center py-6">
            <Image className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No galleries yet</p>
            <button
              onClick={() => setLocation('/galleries')}
              className="text-sm text-purple-600 hover:text-purple-800 mt-1"
            >
              Create your first gallery
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentGalleries.map((gallery) => (
              <div
                key={gallery.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => setLocation(`/galleries/${gallery.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Camera className="h-4 w-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{gallery.name}</p>
                    <p className="text-xs text-gray-500">{gallery.photoCount} photos • {gallery.favListCount} fav lists</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  gallery.status === 'published' ? 'bg-green-100 text-green-700' :
                  gallery.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {gallery.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExtraPhotosSalesView({ projects }: { projects: Project[] }) {
  const currentWeek = new Date();
  const startOfWeek = new Date(currentWeek);
  startOfWeek.setDate(currentWeek.getDate() - currentWeek.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const currentMonth = new Date();
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  // Filter projects for current week
  const weeklyProjects = projects.filter(project => {
    const projectDate = new Date(project.createdAt);
    return projectDate >= startOfWeek && projectDate <= endOfWeek && project.extras > 0;
  });

  // Filter projects for current month  
  const monthlyProjects = projects.filter(project => {
    const projectDate = new Date(project.createdAt);
    return projectDate >= startOfMonth && projectDate <= endOfMonth && project.extras > 0;
  });

  // Calculate totals
  const weeklyExtras = weeklyProjects.reduce((sum, project) => sum + (project.extras || 0), 0);
  const weeklyRevenue = weeklyProjects.reduce((sum, project) => sum + ((project.extraPhotoPrice || 0) * (project.extras || 0)), 0);
  
  const monthlyExtras = monthlyProjects.reduce((sum, project) => sum + (project.extras || 0), 0);
  const monthlyRevenue = monthlyProjects.reduce((sum, project) => sum + ((project.extraPhotoPrice || 0) * (project.extras || 0)), 0);

  const weekName = `Week of ${startOfWeek.toLocaleDateString()}`;
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Sales Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Extra Photos Sales</h2>
              <p className="text-sm text-gray-600">Weekly and monthly extra photo statistics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly and Monthly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <h3 className="text-lg font-semibold text-gray-900">This Week</h3>
          </div>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">{weekName}</div>
            <div className="text-3xl font-bold text-blue-600">{weeklyExtras}</div>
            <div className="text-sm text-gray-500">Extra photos sold</div>
            <div className="text-xl font-semibold text-green-600">
              R{(weeklyRevenue / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Revenue from extras</div>
            <div className="text-sm text-gray-600">
              {weeklyProjects.length} projects with extras
            </div>
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-4 rounded-full bg-purple-500"></div>
            <h3 className="text-lg font-semibold text-gray-900">This Month</h3>
          </div>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">{monthName}</div>
            <div className="text-3xl font-bold text-purple-600">{monthlyExtras}</div>
            <div className="text-sm text-gray-500">Extra photos sold</div>
            <div className="text-xl font-semibold text-green-600">
              R{(monthlyRevenue / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Revenue from extras</div>
            <div className="text-sm text-gray-600">
              {monthlyProjects.length} projects with extras
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects with Extras */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Projects with Extra Photos</h3>
          <p className="text-sm text-gray-600">Latest projects that included extra photo charges</p>
        </div>
        <div className="divide-y divide-gray-200">
          {monthlyProjects.slice(0, 10).map((project, index) => (
            <div key={project.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {project.clientName}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-purple-600">
                    +{project.extras} extra photos
                  </div>
                  <div className="text-xs text-green-600">
                    R{((project.extraPhotoPrice || 0) * (project.extras || 0) / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {monthlyProjects.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No extra photos sold this month
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Commission View Component
function CommissionView({ user }: { user: User }) {
  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  
  // Query commission data for the current user
  const { data: commissions, isLoading } = useQuery({
    queryKey: ["/api/commissions", user.name],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/commissions/${encodeURIComponent(user.name)}`);
      return response.json();
    },
    enabled: user.role === "DataWrangler"
  });

  // Calculate current month totals
  const currentMonthCommissions = commissions?.filter((commission: any) => {
    const commissionDate = new Date(commission.createdAt);
    const now = new Date();
    return commissionDate.getMonth() === now.getMonth() && 
           commissionDate.getFullYear() === now.getFullYear();
  }) || [];

  const totalCommissionAmount = currentMonthCommissions.reduce((sum: number, commission: any) => 
    sum + (commission.commissionAmount || 0), 0);
  
  const totalExtraRevenue = currentMonthCommissions.reduce((sum: number, commission: any) => 
    sum + (commission.totalAmount || 0), 0);

  const commissionPercentage = 3; // 3% commission rate

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">Loading commission data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Commission Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Commissions - {currentMonth}</h2>
              <p className="text-sm text-gray-600">Your {commissionPercentage}% commission on extra photo charges</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              R{(totalCommissionAmount / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">
              {commissionPercentage}% of R{(totalExtraRevenue / 100).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Commission Breakdown */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Commission Breakdown</h3>
          <p className="text-sm text-gray-600">{currentMonthCommissions.length} projects with extra charges this month</p>
        </div>
        <div className="divide-y divide-gray-200">
          {currentMonthCommissions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No commissions recorded for {currentMonth}
            </div>
          ) : (
            currentMonthCommissions.map((commission: any, index: number) => (
              <div key={index} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      Project ID: {commission.projectId?.slice(0, 8)}...
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {commission.extraCount} extra photos @ R{(commission.extraPhotoPrice / 100).toFixed(2)} each
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600">
                      +R{(commission.commissionAmount / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {commissionPercentage}% of R{(commission.totalAmount / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Complaints View Component for Evans
function ComplaintsView() {
  const { data: complaints = [], isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/complaints"],
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateComplaintMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/complaints/${id}`, { 
        status,
        resolvedBy: status === "completed" ? "Evans" : null,
        resolvedAt: status === "completed" ? new Date() : null
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      toast({
        title: "Complaint Updated",
        description: "The complaint status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update complaint. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteComplaintMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/complaints/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      toast({
        title: "Complaint Deleted",
        description: "The complaint has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete complaint. Please try again.",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-900 mb-2">Loading complaints...</div>
          <div className="text-gray-500">Please wait while we fetch the latest issues</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <div className="text-lg font-medium text-red-600 mb-2">Error loading complaints</div>
          <div className="text-gray-500">Unable to fetch complaints at this time</div>
        </div>
      </div>
    );
  }

  const pendingComplaints = complaints.filter((c) => c.status === "pending");
  const inProgressComplaints = complaints.filter((c) => c.status === "in_progress");
  const completedComplaints = complaints.filter((c) => c.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-900">Complaints Dashboard</h2>
            <span className="text-sm text-gray-500">Issues reported by retouchers</span>
          </div>
          <div className="text-sm text-gray-600">
            {complaints?.length || 0} total complaint{(complaints?.length || 0) !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Pending Issues */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <h3 className="text-lg font-semibold text-gray-900">Pending Issues</h3>
              <span className="text-sm text-gray-500">New complaints requiring attention</span>
            </div>
            <div className="text-sm text-gray-600">
              {pendingComplaints.length} issue{pendingComplaints.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          {pendingComplaints.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending complaints - great job team! 🎉
            </div>
          ) : (
            <div className="space-y-4">
              {pendingComplaints.map((complaint: any) => (
                <ComplaintCard 
                  key={complaint.id} 
                  complaint={complaint} 
                  onUpdateStatus={(status) => updateComplaintMutation.mutate({ id: complaint.id, status })}
                  onDelete={() => deleteComplaintMutation.mutate(complaint.id)}
                  isPending={updateComplaintMutation.isPending || deleteComplaintMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In Progress Issues */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <h3 className="text-lg font-semibold text-gray-900">In Progress</h3>
              <span className="text-sm text-gray-500">Currently being worked on</span>
            </div>
            <div className="text-sm text-gray-600">
              {inProgressComplaints.length} issue{inProgressComplaints.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          {inProgressComplaints.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No issues currently in progress
            </div>
          ) : (
            <div className="space-y-4">
              {inProgressComplaints.map((complaint: any) => (
                <ComplaintCard 
                  key={complaint.id} 
                  complaint={complaint} 
                  onUpdateStatus={(status) => updateComplaintMutation.mutate({ id: complaint.id, status })}
                  onDelete={() => deleteComplaintMutation.mutate(complaint.id)}
                  isPending={updateComplaintMutation.isPending || deleteComplaintMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Completed Issues */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <h3 className="text-lg font-semibold text-gray-900">Completed</h3>
              <span className="text-sm text-gray-500">Resolved issues</span>
            </div>
            <div className="text-sm text-gray-600">
              {completedComplaints.length} issue{completedComplaints.length !== 1 ? 's' : ''} resolved
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          {completedComplaints.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No completed complaints
            </div>
          ) : (
            <div className="space-y-4">
              {completedComplaints.slice(0, 5).map((complaint: any) => (
                <ComplaintCard 
                  key={complaint.id} 
                  complaint={complaint} 
                  onUpdateStatus={(status) => updateComplaintMutation.mutate({ id: complaint.id, status })}
                  onDelete={() => deleteComplaintMutation.mutate(complaint.id)}
                  isPending={updateComplaintMutation.isPending || deleteComplaintMutation.isPending}
                  isCompleted={true}
                />
              ))}
              {completedComplaints.length > 5 && (
                <div className="text-center text-sm text-gray-500 pt-2">
                  Showing 5 most recent. {completedComplaints.length - 5} more completed issues.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Individual Complaint Card Component
function ComplaintCard({ complaint, onUpdateStatus, onDelete, isPending, isCompleted = false }: {
  complaint: any;
  onUpdateStatus: (status: string) => void;
  onDelete: () => void;
  isPending: boolean;
  isCompleted?: boolean;
}) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-red-100 text-red-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-900">Project ID:</span>
            <span className="text-sm text-gray-600">{complaint.projectId?.slice(0, 8)}...</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
              {complaint.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-800 mb-2">{complaint.issueDescription}</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Reported by: {complaint.reportedBy}</span>
            <span>Created: {formatDate(complaint.createdAt)}</span>
            <span>Due: {formatDate(complaint.requestedDueDate)}</span>
            {complaint.resolvedAt && <span>Resolved: {formatDate(complaint.resolvedAt)}</span>}
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          {!isCompleted && (
            <>
              {complaint.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => onUpdateStatus("in_progress")}
                  disabled={isPending}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Start Work
                </Button>
              )}
              {complaint.status === "in_progress" && (
                <Button
                  size="sm"
                  onClick={() => onUpdateStatus("completed")}
                  disabled={isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Mark Complete
                </Button>
              )}
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={isPending}
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReferralDashboard({ userRole }: { userRole: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: referralsList = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/referrals"],
    queryFn: async () => {
      const res = await fetch("/api/referrals", {
        headers: { "x-usena-role": userRole },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/referrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-usena-role": userRole },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      toast({ title: "Referral updated" });
    },
  });

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    submitted: "bg-orange-100 text-orange-800",
    completed: "bg-blue-100 text-blue-800",
    rewarded: "bg-green-100 text-green-800",
  };

  const statusLabels: Record<string, string> = {
    pending: "Waiting for sign-up",
    submitted: "Signed up — awaiting booking",
    completed: "Booked — reward due",
    rewarded: "Rewarded",
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="h-6 w-6 text-pink-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Referral Dashboard</h2>
            <p className="text-sm text-gray-600">Track and manage client referrals</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading referrals...</div>
        ) : referralsList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No referrals yet. Referral codes are automatically created when projects are delivered.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Referrer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Code</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Referred Client</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {referralsList.map((ref: any) => (
                  <tr key={ref.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{ref.referrerName}</div>
                      <div className="text-xs text-gray-500">{ref.referrerEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{ref.referralCode}</code>
                    </td>
                    <td className="py-3 px-4">
                      {ref.referredName ? (
                        <div>
                          <div className="font-medium text-gray-900">{ref.referredName}</div>
                          <div className="text-xs text-gray-500">{ref.referredEmail}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No referral yet</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColors[ref.status] || "bg-gray-100 text-gray-800"}`}>
                        {statusLabels[ref.status] || ref.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {ref.status === "submitted" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateMutation.mutate({ id: ref.id, status: "completed" })}
                            disabled={updateMutation.isPending}
                            className="text-xs"
                          >
                            Confirm Booked
                          </Button>
                        )}
                        {ref.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateMutation.mutate({ id: ref.id, status: "rewarded" })}
                            disabled={updateMutation.isPending}
                            className="text-xs bg-green-50 text-green-700"
                          >
                            Mark Rewarded
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Rewards Dashboard Component
function RewardsDashboard({ userRole }: { userRole: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: rewardClients = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/rewards/clients"],
    queryFn: async () => {
      const res = await fetch("/api/rewards/clients", {
        headers: { "x-usena-role": userRole },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/rewards/summary"],
    queryFn: async () => {
      const res = await fetch("/api/rewards/summary", {
        headers: { "x-usena-role": userRole },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/rewards/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-usena-role": userRole },
        body: JSON.stringify({ yearsBack: 2 }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to sync");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/summary"] });
      toast({ title: "Rewards Synced", description: `${data.synced} clients updated from calendar history` });
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async (payload: { tier?: string; subject: string; message: string; clientEmails?: string[] }) => {
      const res = await fetch("/api/rewards/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-usena-role": userRole },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Emails Sent", description: `${data.sent} emails sent successfully${data.failed > 0 ? `, ${data.failed} failed` : ''}` });
      setShowEmailDialog(false);
      setEmailSubject("");
      setEmailMessage("");
    },
    onError: (error: any) => {
      toast({ title: "Send Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      await Promise.all(emails.map(email =>
        fetch(`/api/rewards/clients/${encodeURIComponent(email)}`, {
          method: "DELETE",
          headers: { "x-usena-role": userRole },
        }).then(r => { if (!r.ok) throw new Error(`Failed to delete ${email}`); })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/summary"] });
      const count = selectedClients.size;
      setSelectedClients(new Set());
      setShowDeleteConfirm(false);
      toast({ title: "Clients Removed", description: `${count} client${count !== 1 ? 's' : ''} removed from rewards.` });
    },
    onError: (error: any) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });

  const rewardTierColors: Record<string, string> = {
    Bronze: "bg-orange-100 text-orange-800 border-orange-300",
    Silver: "bg-gray-200 text-gray-800 border-gray-400",
    Gold: "bg-amber-100 text-amber-800 border-amber-400",
    Platinum: "bg-purple-100 text-purple-800 border-purple-400",
    Diamond: "bg-cyan-100 text-cyan-800 border-cyan-400",
  };

  const rewardTierHoverColors: Record<string, string> = {
    Bronze: "hover:bg-orange-200 hover:border-orange-400 cursor-pointer",
    Silver: "hover:bg-gray-300 hover:border-gray-500 cursor-pointer",
    Gold: "hover:bg-amber-200 hover:border-amber-500 cursor-pointer",
    Platinum: "hover:bg-purple-200 hover:border-purple-500 cursor-pointer",
    Diamond: "hover:bg-cyan-200 hover:border-cyan-500 cursor-pointer",
  };

  const rewardTierIcons: Record<string, string> = {
    Bronze: "🥉",
    Silver: "🥈",
    Gold: "🥇",
    Platinum: "💎",
    Diamond: "👑",
  };

  const tierDescriptions: Record<string, string> = {
    Bronze: "1 booking",
    Silver: "2 bookings",
    Gold: "3-5 bookings",
    Platinum: "6-8 bookings",
    Diamond: "9+ bookings",
  };

  const tierClients = selectedTier
    ? rewardClients.filter((c: any) => c.rewardTier === selectedTier)
    : [];

  const tierEmailCount = tierClients.filter((c: any) => c.clientEmail && !c.clientEmail.includes('@unknown.pending')).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-emerald-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Client Rewards</h2>
              <p className="text-sm text-gray-600">Tier levels based on number of bookings from the last 2 years</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-700"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Syncing Calendar..." : "Sync Rewards"}
          </Button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
          <div className="font-medium mb-1">Tier Levels (click a tier to view clients):</div>
          <div className="flex flex-wrap gap-3">
            <span>🥉 Bronze: 1 booking</span>
            <span>🥈 Silver: 2 bookings</span>
            <span>🥇 Gold: 3-5 bookings</span>
            <span>💎 Platinum: 6-8 bookings</span>
            <span>👑 Diamond: 9+ bookings</span>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {["Bronze", "Silver", "Gold", "Platinum", "Diamond"].map(tier => (
              <div
                key={tier}
                onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}
                className={`rounded-lg p-4 text-center border-2 transition-all ${rewardTierColors[tier]} ${rewardTierHoverColors[tier]} ${selectedTier === tier ? 'ring-2 ring-offset-2 ring-gray-400 scale-105' : ''}`}
              >
                <div className="text-3xl mb-1">{rewardTierIcons[tier]}</div>
                <div className="text-2xl font-bold">{summary.tierBreakdown?.[tier] || 0}</div>
                <div className="text-sm font-semibold">{tier}</div>
                <div className="text-xs mt-1 opacity-75">{tierDescriptions[tier]}</div>
              </div>
            ))}
          </div>
        )}

        {selectedTier && (
          <div className="border rounded-lg overflow-hidden mb-4">
            <div className={`p-4 flex items-center justify-between ${rewardTierColors[selectedTier]}`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{rewardTierIcons[selectedTier]}</span>
                <div>
                  <h3 className="font-bold text-lg">{selectedTier} Tier Clients</h3>
                  <p className="text-xs opacity-75">{tierDescriptions[selectedTier]} | {tierClients.length} client{tierClients.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {tierEmailCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowEmailDialog(true); }}
                    className="flex items-center gap-1 bg-white/80 hover:bg-white"
                  >
                    <Mail className="h-4 w-4" />
                    Email {tierEmailCount} Client{tierEmailCount !== 1 ? 's' : ''}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedTier(null)}
                  className="hover:bg-white/50"
                >
                  Close
                </Button>
              </div>
            </div>

            {tierClients.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No clients in this tier yet</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Client</th>
                      <th className="text-center py-2 px-4 font-medium text-gray-600">Bookings</th>
                      <th className="text-center py-2 px-4 font-medium text-gray-600">Referrals</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">First Visit</th>
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Last Visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierClients.map((client: any) => (
                      <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-4">
                          <div className="font-medium text-gray-900">{client.clientName}</div>
                          <div className="text-xs text-gray-500">
                            {client.clientEmail && !client.clientEmail.includes('@unknown.pending') ? client.clientEmail : 'No email on file'}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium">
                            <Calendar className="h-3 w-3" /> {client.totalBookings}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-pink-700 bg-pink-50 px-2 py-1 rounded-full text-xs font-medium">
                            <Gift className="h-3 w-3" /> {client.referralMatchCount}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-xs text-gray-500">
                            {client.firstProjectAt ? new Date(client.firstProjectAt).toLocaleDateString() : '-'}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-xs text-gray-500">
                            {client.lastProjectAt ? new Date(client.lastProjectAt).toLocaleDateString() : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!selectedTier && (
          <>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading rewards data...</div>
            ) : rewardClients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No reward data yet. Click "Sync Rewards" to pull booking history from Google Calendar.
              </div>
            ) : (
              <div>
                {selectedClients.size > 0 && (
                  <div className="flex items-center justify-between mb-3 px-2 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-sm text-red-700 font-medium">
                      {selectedClients.size} client{selectedClients.size !== 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedClients(new Set())}
                        className="text-gray-500 hover:text-gray-700 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Selected
                      </Button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-3 px-3 w-8">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 cursor-pointer"
                            checked={selectedClients.size === rewardClients.length && rewardClients.length > 0}
                            ref={el => { if (el) el.indeterminate = selectedClients.size > 0 && selectedClients.size < rewardClients.length; }}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedClients(new Set(rewardClients.map((c: any) => c.clientEmail)));
                              } else {
                                setSelectedClients(new Set());
                              }
                            }}
                          />
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Client</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Tier</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Bookings</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Referrals</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">First Visit</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Last Visit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rewardClients.map((client: any) => {
                        const isSelected = selectedClients.has(client.clientEmail);
                        return (
                          <tr
                            key={client.id}
                            className={`border-b border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-red-50' : ''}`}
                          >
                            <td className="py-3 px-3 w-8">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 cursor-pointer"
                                checked={isSelected}
                                onChange={e => {
                                  const next = new Set(selectedClients);
                                  if (e.target.checked) next.add(client.clientEmail);
                                  else next.delete(client.clientEmail);
                                  setSelectedClients(next);
                                }}
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{client.clientName}</div>
                              <div className="text-xs text-gray-500">
                                {client.clientEmail && !client.clientEmail.includes('@unknown.pending') ? client.clientEmail : 'No email on file'}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${rewardTierColors[client.rewardTier] || rewardTierColors.Bronze}`}>
                                {rewardTierIcons[client.rewardTier] || "🥉"} {client.rewardTier}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium">
                                <Calendar className="h-3 w-3" /> {client.totalBookings}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 text-pink-700 bg-pink-50 px-2 py-1 rounded-full text-xs font-medium">
                                <Gift className="h-3 w-3" /> {client.referralMatchCount}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs text-gray-500">
                                {client.firstProjectAt ? new Date(client.firstProjectAt).toLocaleDateString() : '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs text-gray-500">
                                {client.lastProjectAt ? new Date(client.lastProjectAt).toLocaleDateString() : '-'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email to {selectedTier} Tier
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              This will send an email to <strong>{tierEmailCount}</strong> client{tierEmailCount !== 1 ? 's' : ''} with valid email addresses in the {selectedTier} tier.
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Subject</label>
              <Input
                placeholder="e.g., Special offer just for you!"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Message</label>
              <textarea
                className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
                placeholder="Write your message here..."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
              <Button
                onClick={() => emailMutation.mutate({ tier: selectedTier!, subject: emailSubject, message: emailMessage })}
                disabled={!emailSubject.trim() || !emailMessage.trim() || emailMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {emailMutation.isPending ? "Sending..." : `Send to ${tierEmailCount} Client${tierEmailCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              Remove {selectedClients.size} Client{selectedClients.size !== 1 ? 's' : ''}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-600">
              This will permanently remove {selectedClients.size === 1 ? 'this client' : `these ${selectedClients.size} clients`} from the rewards system. Their booking history won't be affected, but their reward profile and tier will be deleted.
            </p>
            <p className="text-xs text-gray-500">You can re-add them by running <strong>Sync Rewards</strong> again.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(Array.from(selectedClients))}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {deleteMutation.isPending ? "Removing..." : `Remove ${selectedClients.size} Client${selectedClients.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// VIP Client Management Component
function VipClientDashboard({ userRole }: { userRole: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const { data: clients = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/clients"],
    queryFn: async () => {
      const res = await fetch("/api/admin/clients", {
        headers: { "x-usena-role": userRole },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const [reviewWindowDays, setReviewWindowDays] = useState<number>(30);
  const { data: reviewBreakdown, isLoading: isLoadingReviewBreakdown } = useQuery<{
    windowDays: number;
    byTier: { label: string; promptsSent: number; googleClicks: number; clickThroughRate: number }[];
  }>({
    queryKey: ["/api/google-review/breakdown", reviewWindowDays],
    queryFn: async () => {
      const res = await fetch(`/api/google-review/breakdown?windowDays=${reviewWindowDays}`, {
        headers: { "x-usena-role": userRole },
      });
      if (!res.ok) throw new Error("Failed to fetch review breakdown");
      return res.json();
    },
    enabled: userRole === "Admin",
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-usena-role": userRole },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      toast({ title: "Client profile updated" });
      setEditingNotes(null);
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/clients/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-usena-role": userRole },
      });
      if (!res.ok) throw new Error("Failed to recalculate");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      toast({ title: "VIP Tiers Recalculated", description: `${data.recalculated} client profiles updated` });
    },
  });

  const tierColors: Record<string, string> = {
    Standard: "bg-gray-100 text-gray-700 border-gray-300",
    Silver: "bg-gray-200 text-gray-800 border-gray-400",
    Gold: "bg-amber-100 text-amber-800 border-amber-400",
    Platinum: "bg-purple-100 text-purple-800 border-purple-400",
  };

  const tierIcons: Record<string, string> = {
    Standard: "",
    Silver: "🥈",
    Gold: "🥇",
    Platinum: "💎",
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-amber-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">VIP Client Management</h2>
              <p className="text-sm text-gray-600">Track client tiers, bonus photos, and priority status</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700"
          >
            <RefreshCw className={`h-4 w-4 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
            Recalculate Tiers
          </Button>
        </div>

        {userRole === "Admin" && (
          <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-amber-50/40 to-white">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-600" /> Google Review Conversion by Tier
                </h3>
                <p className="text-xs text-gray-500">
                  Prompts sent, clicks, and CTR per tier in the last {reviewBreakdown?.windowDays ?? reviewWindowDays} days
                </p>
              </div>
              <select
                value={reviewWindowDays}
                onChange={(e) => setReviewWindowDays(parseInt(e.target.value, 10))}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                data-testid="select-vip-review-window"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
            {isLoadingReviewBreakdown ? (
              <div className="text-xs text-gray-500 py-4 text-center">Loading review conversion…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(["Platinum", "Gold", "Silver", "Standard"] as const).map((tier) => {
                  const row = reviewBreakdown?.byTier.find((r) => r.label === tier);
                  const prompts = row?.promptsSent ?? 0;
                  const clicks = row?.googleClicks ?? 0;
                  const ctr = row?.clickThroughRate ?? 0;
                  return (
                    <div
                      key={tier}
                      className={`rounded-lg border p-3 ${tierColors[tier] || tierColors.Standard}`}
                      data-testid={`card-vip-tier-${tier.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold flex items-center gap-1">
                          {tierIcons[tier]} {tier}
                        </span>
                        <span className="text-xs font-bold" data-testid={`text-vip-tier-${tier.toLowerCase()}-ctr`}>
                          {prompts > 0 ? `${(ctr * 100).toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <div>
                          <div className="font-semibold" data-testid={`text-vip-tier-${tier.toLowerCase()}-prompts`}>{prompts}</div>
                          <div className="opacity-70">prompts sent</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold" data-testid={`text-vip-tier-${tier.toLowerCase()}-clicks`}>{clicks}</div>
                          <div className="opacity-70">Google clicks</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading client profiles...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No client profiles yet. Profiles are automatically created when projects are delivered.
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={() => recalculateMutation.mutate()} disabled={recalculateMutation.isPending}>
                Scan Existing Projects
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Client</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">VIP Tier</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Projects</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Bonus Photos</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Priority</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client: any) => (
                  <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{client.clientName}</div>
                      <div className="text-xs text-gray-500">{client.clientEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${tierColors[client.vipTier] || tierColors.Standard}`}>
                        {tierIcons[client.vipTier]} {client.vipTier}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-900 font-medium">{client.totalDelivered}</div>
                      <div className="text-xs text-gray-500">delivered</div>
                    </td>
                    <td className="py-3 px-4">
                      {client.bonusPhotos > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
                          +{client.bonusPhotos} bonus
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {client.priorityTurnaround ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                          ⚡ Priority
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      {editingNotes === client.id ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            className="text-xs border rounded px-2 py-1 w-full"
                            placeholder="Add notes..."
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => updateMutation.mutate({ id: client.id, updates: { notes: notesValue } })}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7"
                            onClick={() => setEditingNotes(null)}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 truncate"
                          onClick={() => { setEditingNotes(client.id); setNotesValue(client.notes || ""); }}
                          title={client.notes || "Click to add notes"}
                        >
                          {client.notes || <span className="italic text-gray-400">Click to add notes...</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-full bg-gray-300`}></span> Standard (0-2 projects)</div>
            <div className="flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-full bg-gray-400`}></span> Silver (3-5 projects)</div>
            <div className="flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-full bg-amber-400`}></span> Gold (6-9 projects)</div>
            <div className="flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-full bg-purple-400`}></span> Platinum (10+ projects)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Data Wrangler Delay Alert Component
function DelayAlertBanner({ projects, user }: { projects: Project[]; user: User }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [targetWeekStart, setTargetWeekStart] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const overdueProjects = projects.filter(p => {
    if (!p.dueDate || !p.clientEmail) return false;
    const due = new Date(p.dueDate);
    const isPastOrThisWeek = due <= endOfWeek;
    const isNotDelivered = p.status !== "Delivered" && p.status !== "Review";
    const isNotAssigned = !p.assignedTo;
    return isPastOrThisWeek && isNotDelivered && isNotAssigned;
  });

  const sendDelayMutation = useMutation({
    mutationFn: async ({ projectId, targetWeekStart, sentBy }: { projectId: string; targetWeekStart: string; sentBy: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/send-delay-notice`, {
        targetWeekStart,
        sentBy,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Delay notice sent", description: "The client has been notified about the delay." });
      setDialogOpen(false);
      setSelectedProject(null);
      setTargetWeekStart("");
    },
    onError: () => {
      toast({ title: "Failed to send", description: "Could not send the delay notice.", variant: "destructive" });
    },
  });

  if (overdueProjects.length === 0) return null;

  const getNextMonday = () => {
    const d = new Date();
    d.setDate(d.getDate() + (8 - d.getDay()) % 7);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const formatWeekRange = (startStr: string) => {
    if (!startStr) return "";
    const start = new Date(startStr + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <h3 className="font-semibold text-orange-800">Delay Alert - Unassigned Projects Due</h3>
          <span className="ml-auto text-sm text-orange-600 font-medium">{overdueProjects.length} project{overdueProjects.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="space-y-2">
          {overdueProjects.map(project => (
            <div key={project.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-100">
              <div>
                <div className="font-medium text-gray-900">{project.clientName}</div>
                <div className="text-xs text-gray-500">
                  {project.clientEmail} • Due: {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "N/A"} • Status: {project.status}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="bg-orange-50 hover:bg-orange-100 border-orange-300 text-orange-700"
                onClick={() => {
                  setSelectedProject(project);
                  setTargetWeekStart(getNextMonday());
                  setDialogOpen(true);
                }}
              >
                <Mail className="h-3 w-3 mr-1" />
                Send Delay Notice
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Delay Notice</DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Client Name</label>
                  <div className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">{selectedProject.clientName}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Client Email</label>
                  <div className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">{selectedProject.clientEmail}</div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Target Delivery Week (Monday start)</label>
                <input
                  type="date"
                  value={targetWeekStart}
                  onChange={(e) => setTargetWeekStart(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                />
                {targetWeekStart && (
                  <div className="text-xs text-gray-500 mt-1">
                    Week of {formatWeekRange(targetWeekStart)}
                  </div>
                )}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="text-xs font-medium text-amber-700 mb-2">Email Preview:</div>
                <div className="text-sm text-gray-700">
                  <p className="mb-2">Dear {selectedProject.clientName},</p>
                  <p className="mb-2">We wanted to let you know that your photos are taking a bit longer than expected. We sincerely apologize for any inconvenience.</p>
                  {targetWeekStart && (
                    <p className="mb-2 font-medium">Your photos are now scheduled for delivery during the week of {formatWeekRange(targetWeekStart)}.</p>
                  )}
                  <p>Thank you for your patience and understanding.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => sendDelayMutation.mutate({
                    projectId: selectedProject.id,
                    targetWeekStart,
                    sentBy: user.name,
                  })}
                  disabled={!targetWeekStart || sendDelayMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {sendDelayMutation.isPending ? "Sending..." : "Send Notification"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmailTemplatesEditor({ currentUser }: { currentUser: User }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const adminHeaders = getAdminHeaders(currentUser.role, currentUser.id || "");
  const adminJsonHeaders = { "Content-Type": "application/json", ...adminHeaders };
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { headers: adminHeaders });
      return res.json();
    },
  });
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of allUsers) {
      if (u.id) map.set(u.id, u.name);
    }
    return map;
  }, [allUsers]);
  const formatEditor = (id: string | null | undefined) => {
    if (!id) return null;
    return userNameById.get(id) || id;
  };
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setImageUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch("/api/admin/upload-email-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Usena-Role": "Admin" },
          body: JSON.stringify({ imageData: base64, fileName: file.name, contentType: file.type }),
        });
        const data = await res.json();
        if (data.success && editorRef.current) {
          editorRef.current.focus();
          restoreSelection();
          const img = document.createElement("img");
          img.src = data.url;
          img.alt = file.name;
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          img.style.display = "block";
          img.style.margin = "10px auto";
          img.style.cursor = "pointer";
          img.setAttribute("data-email-image", "true");
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.setStartAfter(img);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            editorRef.current.appendChild(img);
          }
          toast({ title: "Image inserted" });
        } else {
          toast({ title: "Upload failed", description: data.error, variant: "destructive" });
        }
        setImageUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
      setImageUploading(false);
    }
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (editorRef.current) {
      editorRef.current.querySelectorAll("img").forEach((img: HTMLImageElement) => {
        img.style.outline = "none";
      });
    }
    if (target.tagName === "IMG") {
      const img = target as HTMLImageElement;
      img.style.outline = "2px solid #3b82f6";
      setSelectedImage(img);
    } else {
      setSelectedImage(null);
    }
  };

  const resizeSelectedImage = (width: string) => {
    if (selectedImage) {
      selectedImage.style.maxWidth = width;
      selectedImage.style.width = width;
      selectedImage.style.height = "auto";
    }
  };

  const alignSelectedImage = (align: string) => {
    if (selectedImage) {
      if (align === "center") {
        selectedImage.style.display = "block";
        selectedImage.style.margin = "10px auto";
        selectedImage.style.float = "none";
      } else if (align === "left") {
        selectedImage.style.display = "block";
        selectedImage.style.margin = "10px 10px 10px 0";
        selectedImage.style.float = "left";
      } else if (align === "right") {
        selectedImage.style.display = "block";
        selectedImage.style.margin = "10px 0 10px 10px";
        selectedImage.style.float = "right";
      }
    }
  };

  const removeSelectedImage = () => {
    if (selectedImage) {
      selectedImage.remove();
      setSelectedImage(null);
    }
  };

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email-templates", {
        headers: adminHeaders,
      });
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, subject, htmlBody }: { key: string; subject: string; htmlBody: string }) => {
      const res = await fetch(`/api/admin/email-templates/${key}`, {
        method: "PUT",
        headers: adminJsonHeaders,
        body: JSON.stringify({ subject, htmlBody }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: "Template saved successfully" });
      setEditingTemplate(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/admin/email-templates/${key}/reset`, {
        method: "POST",
        headers: adminHeaders,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: "Template reset to default" });
      setEditingTemplate(null);
    },
  });

  const openEditor = (template: any) => {
    setEditingTemplate(template);
    setEditSubject(template.subject);
    setEditBody(template.htmlBody);
    setEditorMode("visual");
    setShowPreview(false);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = DOMPurify.sanitize(template.htmlBody);
      }
    }, 0);
  };

  const getPreviewHtml = () => {
    const sampleVars: Record<string, string> = {
      clientName: "Jane",
      firstName: "Jane",
      feedback: "The team was wonderful and the photos turned out beautifully. Highly recommend!",
      copyUrl: "#",
      googleUrl: "#",
      shootDate: "Saturday, January 15, 2026",
      deliveryWeek: "Week of February 2, 2026",
      packageCount: "50",
      selectedCount: "65",
      extras: "15",
      retoucherName: "Alex Editor",
      chatUrl: "#",
      surveyUrl: "#",
      galleryLink: "#",
      weekStartText: "February 2, 2026",
      weekEndText: "February 6, 2026",
      clientEmail: "jane@example.com",
      newMessage: "Hi Jane, your photos are looking amazing!",
      emailHeader: '<div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #1a1a1a; margin: 0; font-size: 28px;">Jepson Myles Studio</h1></div>',
      extrasSection: '<div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px 20px; margin: 25px 0;"><h3 style="color: #e65100; margin: 0 0 10px 0;">Additional Photos Selected!</h3><p style="color: #333; font-size: 14px; margin: 0;">You have selected <strong>15 extra photos</strong> beyond your package.</p></div>',
      referralSection: '<div style="background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;"><p style="color: #c2185b; font-size: 18px; font-weight: bold;">Share the Love</p></div>',
      threadHtml: "",
      sneakPeekHtml: '<div style="text-align: center; margin: 25px 0;"><p style="color: #666;">Preview photos would appear here</p></div>',
    };
    let preview = editorMode === "visual" ? getEditorHtml() : editBody;
    preview = preview.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
      return sampleVars[key] !== undefined ? sampleVars[key] : match;
    });
    return preview;
  };

  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        try { sel.addRange(savedRangeRef.current); } catch (_) {}
      }
    }
  };

  const getEditorHtml = () => {
    if (!editorRef.current) return editBody;
    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("img").forEach((img: HTMLImageElement) => {
      img.style.outline = "none";
      img.style.cursor = "";
    });
    return clone.innerHTML;
  };

  const execFormat = (command: string, value?: string) => {
    if (editorRef.current) editorRef.current.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
  };

  const insertVariable = (variable: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      restoreSelection();
      document.execCommand("insertText", false, `{{${variable}}}`);
      saveSelection();
    }
  };

  if (editingTemplate) {
    const variables = (editingTemplate.availableVariables as string[]) || [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit: {editingTemplate.name}</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? "Back to Editor" : "Preview with Sample Data"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditingTemplate(null)}>Back to List</Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Subject Line</label>
          <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Email subject..." />
        </div>

        {variables.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-700 mb-2">Insert variable (click to add at cursor):</p>
            <div className="flex flex-wrap gap-1">
              {variables.map((v: string) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 font-mono"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {showPreview ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b">
              <p className="text-sm font-medium text-gray-600">Subject: {editSubject.replace(/\{\{(\w+)\}\}/g, (_, k: string) => k === "clientName" ? "Jane" : k === "retoucherName" ? "Alex Editor" : `[${k}]`)}</p>
            </div>
            <div className="p-4 bg-white" dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
          </div>
        ) : editorMode === "visual" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Email Body</label>
              <button
                onClick={() => {
                  const html = getEditorHtml();
                  setEditBody(html);
                  setEditorMode("code");
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Switch to code view
              </button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b px-2 py-1.5 flex flex-wrap gap-1">
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("bold"); }} className="p-1.5 rounded hover:bg-gray-200 text-sm font-bold" title="Bold">B</button>
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("italic"); }} className="p-1.5 rounded hover:bg-gray-200 text-sm italic" title="Italic">I</button>
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("underline"); }} className="p-1.5 rounded hover:bg-gray-200 text-sm underline" title="Underline">U</button>
                <span className="w-px bg-gray-300 mx-1" />
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("fontSize", "5"); }} className="p-1.5 rounded hover:bg-gray-200 text-sm" title="Large Text">A+</button>
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("fontSize", "3"); }} className="p-1.5 rounded hover:bg-gray-200 text-xs" title="Normal Text">A</button>
                <span className="w-px bg-gray-300 mx-1" />
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("justifyLeft"); }} className="p-1.5 rounded hover:bg-gray-200 text-sm" title="Align Left">⫷</button>
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("justifyCenter"); }} className="p-1.5 rounded hover:bg-gray-200 text-sm" title="Align Center">⫸</button>
                <span className="w-px bg-gray-300 mx-1" />
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("foreColor", "#c2185b"); }} className="p-1.5 rounded hover:bg-gray-200 text-sm" title="Pink Text" style={{ color: "#c2185b" }}>A</button>
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("foreColor", "#1565c0"); }} className="p-1.5 rounded hover:bg-gray-200 text-sm" title="Blue Text" style={{ color: "#1565c0" }}>A</button>
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("foreColor", "#333333"); }} className="p-1.5 rounded hover:bg-gray-200 text-sm" title="Dark Text" style={{ color: "#333" }}>A</button>
                <span className="w-px bg-gray-300 mx-1" />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const url = prompt("Enter link URL:");
                    if (url) execFormat("createLink", url);
                  }}
                  className="p-1.5 rounded hover:bg-gray-200 text-sm text-blue-600"
                  title="Add Link"
                >🔗</button>
                <span className="w-px bg-gray-300 mx-1" />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    saveSelection();
                    imageInputRef.current?.click();
                  }}
                  className="p-1.5 rounded hover:bg-gray-200 text-sm"
                  title="Insert Image"
                  disabled={imageUploading}
                >{imageUploading ? "⏳" : "🖼️"}</button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                    e.target.value = "";
                  }}
                />
                <button onMouseDown={(e) => { e.preventDefault(); execFormat("removeFormat"); }} className="p-1.5 rounded hover:bg-gray-200 text-xs text-gray-500" title="Clear Formatting">✕</button>
              </div>
              {selectedImage && (
                <div className="bg-blue-50 border-b px-3 py-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-blue-700">Image:</span>
                  <div className="flex gap-1">
                    <button onClick={() => resizeSelectedImage("100%")} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100">Full</button>
                    <button onClick={() => resizeSelectedImage("75%")} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100">75%</button>
                    <button onClick={() => resizeSelectedImage("50%")} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100">50%</button>
                    <button onClick={() => resizeSelectedImage("200px")} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100">Small</button>
                    <button onClick={() => resizeSelectedImage("300px")} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100">Medium</button>
                  </div>
                  <span className="w-px h-4 bg-blue-200" />
                  <div className="flex gap-1">
                    <button onClick={() => alignSelectedImage("left")} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100">Left</button>
                    <button onClick={() => alignSelectedImage("center")} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100">Center</button>
                    <button onClick={() => alignSelectedImage("right")} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100">Right</button>
                  </div>
                  <span className="w-px h-4 bg-blue-200" />
                  <button onClick={removeSelectedImage} className="text-xs bg-white border border-red-200 text-red-600 px-2 py-0.5 rounded hover:bg-red-50">Remove</button>
                </div>
              )}
              <div
                ref={editorRef}
                contentEditable
                className="p-4 min-h-[400px] max-h-[500px] overflow-y-auto focus:outline-none text-sm"
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onClick={handleEditorClick}
                suppressContentEditableWarning
                style={{ wordBreak: "break-word" }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">HTML Code</label>
              <button
                onClick={() => {
                  setEditorMode("visual");
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.innerHTML = DOMPurify.sanitize(editBody);
                    }
                  }, 0);
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Switch to visual editor
              </button>
            </div>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full h-96 p-3 border rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="HTML email body..."
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Reset this template to its default? Your customizations will be lost.")) {
                resetMutation.mutate(editingTemplate.templateKey);
              }
            }}
            disabled={resetMutation.isPending}
            className="text-red-600 hover:text-red-700"
          >
            Reset to Default
          </Button>
          <Button
            onClick={() => {
              const html = editorMode === "visual" ? getEditorHtml() : editBody;
              saveMutation.mutate({ key: editingTemplate.templateKey, subject: editSubject, htmlBody: html });
            }}
            disabled={saveMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saveMutation.isPending ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">Customize the emails sent to your clients. Click any template to edit it.</p>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading templates...</div>
      ) : (
        <div className="grid gap-3">
          {templates.map((tmpl: any) => (
            <div
              key={tmpl.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => openEditor(tmpl)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{tmpl.name}</span>
                  {tmpl.isCustomized && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Customized</span>
                  )}
                  {tmpl.updatedAt && (
                    <span className="text-xs text-gray-500" data-testid={`text-template-last-edited-${tmpl.templateKey}`}>
                      Edited {formatDistanceToNow(new Date(tmpl.updatedAt), { addSuffix: true })}
                      {formatEditor(tmpl.lastEditedBy) ? ` by ${formatEditor(tmpl.lastEditedBy)}` : ""}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1 truncate max-w-lg">{tmpl.subject}</p>
              </div>
              <Button variant="outline" size="sm">Edit</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'login'>('login');
  const [showArchive, setShowArchive] = useState(false);
  const [showCommissions, setShowCommissions] = useState(false);
  const [showExtraPhotosSales, setShowExtraPhotosSales] = useState(false);
  const [showComplaints, setShowComplaints] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showVipClients, setShowVipClients] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [showEmailTemplates, setShowEmailTemplates] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDriveManager, setShowDriveManager] = useState(false);
  const [projectListTab, setProjectListTab] = useState<"active" | "delivered">("active");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Widget customization state - use user.id for stable per-user persistence
  // user.id is set during login from userCredentials.id (e.g., "earl", "admin", "lucky")
  const widgetUserId = user?.id || "";

  // Photographer's default landing is /today, but they can navigate back
  // to the dashboard manually to read the project list / chats. Only
  // redirect on first mount (when role becomes available) so that manual
  // navigation isn't blocked.
  const photographerLandedRef = useRef(false);
  useEffect(() => {
    if (user?.role === "Photographer" && !photographerLandedRef.current) {
      photographerLandedRef.current = true;
      setLocation("/today");
    }
  }, [user?.role, setLocation]);
  const { 
    widgetOrder, 
    hiddenWidgets, 
    isWidgetVisible, 
    handlePreferencesChange 
  } = useWidgetPreferences(widgetUserId, user?.role || "");

  // Initialize SSE for live sync and notifications
  const {
    isConnected,
    notifications,
    markNotificationAsRead,
    clearAllNotifications,
    unreadCount
  } = useSSE(user ? { id: user.role, username: user.name } : null);

  const prevNotifCountRef = useRef(0);
  useEffect(() => {
    if (notifications.length > prevNotifCountRef.current) {
      const newest = notifications[0];
      if (newest && newest.title === 'Gallery Selections Received') {
        toast({
          title: newest.title,
          description: newest.message,
        });
      }
    }
    prevNotifCountRef.current = notifications.length;
  }, [notifications]);
  
  // Session timeout duration (2 hours in milliseconds)
  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
  const { data: apiUsers = [] } = useQuery<ApiUser[]>({
    queryKey: ["/api/users"],
  });

  const users: User[] = useMemo(() => {
    return apiUsers.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      value: u.role,
      abbr: u.abbreviation,
    }));
  }, [apiUsers]);

  const { data: allProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  // Query complaints for Evans
  const { data: complaints = [] } = useQuery<any[]>({
    queryKey: ["/api/complaints"],
    enabled: !!user && user.role === "Evans",
  });

  const chatRoles = ['Admin', 'LeadRetoucher', 'Retoucher1', 'Retoucher2', 'Retoucher3', 'Evans', 'DataWrangler', 'Photographer'];
  const { data: chatProjects = [] } = useQuery<{ project: any; unreadCount: number }[]>({
    queryKey: ["/api/admin/chat/projects"],
    queryFn: async () => {
      if (!user) return [];
      const res = await fetch(`/api/admin/chat/projects?_t=${Date.now()}`, {
        headers: getAdminHeaders(user.role, user.name || user.id || ''),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && chatRoles.includes(user.role),
    refetchInterval: 30000,
  });
  const totalUnreadMessages = chatProjects.reduce((sum, p) => sum + (p.unreadCount || 0), 0);

  // Filter projects based on user role for shadow project visibility
  const visibleProjects = useMemo(() => {
    // For Sales users, only show original projects (not shadows)
    if (user?.role === 'Sales') {
      return allProjects.filter(project => !project.isRolloverShadow);
    }
    
    // For Admin and other workflow roles, show all projects including shadows
    return allProjects;
  }, [allProjects, user?.role]);

  // Filter projects based on archive view with Sunday-start weeks and unassigned rollover
  const getFilteredProjects = () => {
    const today = new Date();
    
    // Get start of current week (Sunday)
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    
    const minFutureEnd = new Date(currentWeekStart);
    minFutureEnd.setDate(currentWeekStart.getDate() + 12 * 7 - 1);
    minFutureEnd.setHours(23, 59, 59, 999);

    let maxDueDate = minFutureEnd;
    for (const project of visibleProjects) {
      if (project.dueDate) {
        const d = new Date(project.dueDate);
        if (d > maxDueDate) maxDueDate = d;
      }
    }
    const futureWindowEnd = new Date(maxDueDate);
    futureWindowEnd.setDate(futureWindowEnd.getDate() + (6 - futureWindowEnd.getDay()));
    futureWindowEnd.setHours(23, 59, 59, 999);

    // Archive cutoff: 2 weeks before current week
    const archiveCutoff = new Date(currentWeekStart);
    archiveCutoff.setDate(currentWeekStart.getDate() - 14);

    let filteredProjects = [];

    if (showArchive) {
      filteredProjects = visibleProjects.filter(project => {
        if (!project.dueDate) return false;
        const projectDate = new Date(project.dueDate);
        return projectDate < archiveCutoff;
      });
    } else {
      filteredProjects = visibleProjects.filter(project => {
        if (!project.dueDate) return false;
        const projectDate = new Date(project.dueDate);
        return projectDate >= previousWeekStart && projectDate <= futureWindowEnd;
      });
    }

    return filteredProjects;
  };

  const projects = getFilteredProjects();
  
  // Get counts for both current and archive for the button display (Sunday-start)
  const getCurrentProjectCount = () => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    
    const inCurrentRange = visibleProjects.filter(project => {
      if (!project.dueDate) return false;
      const projectDate = new Date(project.dueDate);
      return projectDate >= previousWeekStart;
    }).length;

    return inCurrentRange;
  };
  
  const getArchiveProjectCount = () => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const archiveCutoff = new Date(currentWeekStart);
    archiveCutoff.setDate(currentWeekStart.getDate() - 14);
    
    return visibleProjects.filter(project => {
      if (!project.dueDate) return false;
      const projectDate = new Date(project.dueDate);
      return projectDate < archiveCutoff;
    }).length;
  };

  // Valid roles that should have access to different features
  const VALID_RETOUCHER_ROLES = ['Retoucher1', 'Retoucher2', 'Retoucher3'];
  const VALID_ROLES = ['Admin', 'LeadRetoucher', 'Sales', 'DataWrangler', 'Evans', ...VALID_RETOUCHER_ROLES];

  // Check for existing session on component mount and periodically
  useEffect(() => {
    const storedUser = getStoredSession();
    if (storedUser && !user) {
      // Validate that the stored role is still valid - clear stale sessions with outdated roles
      if (!VALID_ROLES.includes(storedUser.role)) {
        console.log('Clearing stale session with invalid role:', storedUser.role);
        clearSession();
        return;
      }
      
      setUser(storedUser);
    }

    // Set up interval to check session expiry every minute
    const sessionCheckInterval = setInterval(() => {
      if (user) {
        const storedUser = getStoredSession();
        if (!storedUser) {
          // Session expired, log out user
          setUser(null);
          setCurrentView('login');
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(sessionCheckInterval);
  }, [user]); // Dependencies: user state and users array

  // Session management functions
  const saveSession = (user: User) => {
    const sessionData = {
      user,
      timestamp: Date.now()
    };
    localStorage.setItem('usenaflow_session', JSON.stringify(sessionData));
    // Also store role and user name separately for editor chat authentication
    // Use user.name because project assignments use names, not IDs
    localStorage.setItem('usena_role', user.role);
    localStorage.setItem('usena_user_id', user.name || user.id || '');
  };

  const getStoredSession = () => {
    try {
      const sessionStr = localStorage.getItem('usenaflow_session');
      if (!sessionStr) return null;
      
      const sessionData = JSON.parse(sessionStr);
      const currentTime = Date.now();
      
      // Check if session is expired (older than 2 hours)
      if (currentTime - sessionData.timestamp > SESSION_TIMEOUT) {
        localStorage.removeItem('usenaflow_session');
        localStorage.removeItem('usena_role');
        localStorage.removeItem('usena_user_id');
        return null;
      }
      
      // Ensure chat auth keys are set (for backward compatibility)
      // Use name because project assignments use names, not IDs
      const storedUser = sessionData.user;
      if (storedUser) {
        localStorage.setItem('usena_role', storedUser.role);
        localStorage.setItem('usena_user_id', storedUser.name || storedUser.id || '');
      }
      
      return storedUser;
    } catch (error) {
      localStorage.removeItem('usenaflow_session');
      localStorage.removeItem('usena_role');
      localStorage.removeItem('usena_user_id');
      return null;
    }
  };

  const clearSession = () => {
    localStorage.removeItem('usenaflow_session');
    localStorage.removeItem('usena_role');
    localStorage.removeItem('usena_user_id');
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('login');
    saveSession(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('login');
    clearSession();
  };

  // Manual rollover mutation
  const manualRolloverMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rollover");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rollover Complete",
        description: "Unassigned projects from past weeks have been moved to this week.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      console.error("Manual rollover error:", error);
      toast({
        title: "Rollover Failed",
        description: "Failed to rollover projects. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Manual rollback mutation
  const manualRollbackMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rollback-from-next-week");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rollback Complete",
        description: "Unassigned projects have been moved back to current week.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      console.error("Manual rollback error:", error);
      toast({
        title: "Rollback Failed",
        description: "Failed to rollback projects. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleManualRollover = () => {
    if (window.confirm("Are you sure you want to move all unassigned projects from past weeks to this week?")) {
      manualRolloverMutation.mutate();
    }
  };

  const handleManualRollback = () => {
    if (window.confirm("Are you sure you want to move all unassigned projects from next Sunday back to this Sunday?")) {
      manualRollbackMutation.mutate();
    }
  };

  if (!user) {
    return (
      <LoginForm 
        onLogin={handleLogin}
        onShowRegister={() => {}}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-lg">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src={logoImage} 
                  alt="USENA FLOW" 
                  className="h-12 mr-2"
                />
                <span className="text-sm text-gray-600">by Jepson Myles Studio</span>
              </div>
              <div className="flex items-center space-x-4">
                {user && (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.name}</span>
                        <span className="text-xs text-gray-500">
                          {user.role === "LeadRetoucher" ? "Workflow Manager" : user.role}
                        </span>
                      </div>
                    </div>
                    
                    {/* Notification Center */}
                    <NotificationCenter
                      notifications={notifications}
                      unreadCount={unreadCount}
                      isConnected={isConnected}
                      onMarkAsRead={markNotificationAsRead}
                      onClearAll={clearAllNotifications}
                    />

                    {/* Archive Button - always visible */}
                    <Button 
                      variant={showArchive ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setShowArchive(!showArchive);
                        setShowCommissions(false);
                        setShowExtraPhotosSales(false);
                        setShowReferrals(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      {showArchive ? `Current (${getCurrentProjectCount()})` : `Archive (${getArchiveProjectCount()})`}
                    </Button>

                    {/* Client Messages Button - for messaging roles */}
                    {chatRoles.includes(user.role) && (
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation('/editor-chat')}
                        className="relative flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Messages
                        {totalUnreadMessages > 0 && (
                          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                            {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                          </span>
                        )}
                      </Button>
                    )}

                    {/* Galleries - hidden for Finance */}
                    {user.role !== "Finance" && (
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation('/galleries')}
                        className="flex items-center gap-2"
                      >
                        <Image className="h-4 w-4" />
                        Galleries
                      </Button>
                    )}

                    {/* Tools Dropdown - groups operational tools */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <Wrench className="h-4 w-4" />
                          Tools
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {/* Trade Project - Retouchers and Admin */}
                        {(['Retoucher1', 'Retoucher2', 'Retoucher3', 'Retoucher'].includes(user.role) || user.role === "Admin") && (
                          <DropdownMenuItem
                            onClick={() => setShowTradeModal(true)}
                            data-testid="button-open-trade-modal"
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Trade Project
                          </DropdownMenuItem>
                        )}

                        {/* ShootTracker - Admin, LeadRetoucher, DataWrangler */}
                        {['Admin', 'LeadRetoucher', 'DataWrangler'].includes(user.role) && (
                          <DropdownMenuItem onClick={() => setLocation('/shoottracker')}>
                            <Calendar className="h-4 w-4 mr-2" />
                            ShootTracker
                          </DropdownMenuItem>
                        )}

                        {/* Noël Campaign - Cockpit for Admin/Lead/DataWrangler, Workspace for Retouchers */}
                        {['Admin', 'LeadRetoucher', 'DataWrangler'].includes(user.role) && (
                          <DropdownMenuItem onClick={() => setLocation('/christmas')}>
                            <Gift className="h-4 w-4 mr-2" />
                            Noël Campaign
                          </DropdownMenuItem>
                        )}
                        {['Retoucher1', 'Retoucher2', 'Retoucher3'].includes(user.role) && (
                          <DropdownMenuItem onClick={() => setLocation('/christmas/workspace')}>
                            <Gift className="h-4 w-4 mr-2" />
                            Noël Campaign
                          </DropdownMenuItem>
                        )}

                        {/* Today's Shoots - Photographer + Admin/LeadRetoucher/DataWrangler */}
                        {['Admin', 'LeadRetoucher', 'DataWrangler', 'Photographer'].includes(user.role) && (
                          <DropdownMenuItem onClick={() => setLocation('/today')} data-testid="menu-today-shoots">
                            <Camera className="h-4 w-4 mr-2" />
                            Today's Shoots
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem onClick={() => setLocation('/leave')}>
                          <CalendarDays className="h-4 w-4 mr-2" />
                          Leave Management
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => setLocation('/ai-chat')}>
                          <Bot className="h-4 w-4 mr-2" />
                          AI Team Chat
                        </DropdownMenuItem>

                        {['Admin', 'LeadRetoucher'].includes(user.role) && (
                          <DropdownMenuItem onClick={() => setLocation('/automations')}>
                            <Zap className="h-4 w-4 mr-2" />
                            Automation Hub
                          </DropdownMenuItem>
                        )}

                        {['Admin', 'Sales', 'LeadRetoucher'].includes(user.role) && (
                          <DropdownMenuItem onClick={() => setLocation('/reviews')}>
                            <Star className="h-4 w-4 mr-2" />
                            Reviews
                          </DropdownMenuItem>
                        )}

                        {user.role === 'Admin' && (
                          <DropdownMenuItem onClick={() => setLocation('/ai-brain')}>
                            <Brain className="h-4 w-4 mr-2" />
                            AI Brain
                          </DropdownMenuItem>
                        )}

                        {/* Commissions - DataWrangler */}
                        {user.role === "DataWrangler" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setShowCommissions(!showCommissions);
                              setShowArchive(false);
                              setShowExtraPhotosSales(false);
                              setShowComplaints(false);
                              setShowReferrals(false);
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Commissions
                            {showCommissions && <span className="ml-auto text-xs text-green-600">Active</span>}
                          </DropdownMenuItem>
                        )}

                        {/* Extra Photos Sales - Sales */}
                        {user.role === "Sales" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setShowExtraPhotosSales(!showExtraPhotosSales);
                              setShowArchive(false);
                              setShowCommissions(false);
                              setShowComplaints(false);
                              setShowReferrals(false);
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Extra Photos Sales
                            {showExtraPhotosSales && <span className="ml-auto text-xs text-purple-600">Active</span>}
                          </DropdownMenuItem>
                        )}

                        {/* Complaints - Evans */}
                        {user.role === "Evans" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setShowComplaints(!showComplaints);
                              setShowArchive(false);
                              setShowCommissions(false);
                              setShowExtraPhotosSales(false);
                              setShowReferrals(false);
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Complaints
                            {showComplaints && <span className="ml-auto text-xs text-yellow-600">Active</span>}
                          </DropdownMenuItem>
                        )}

                        {/* Referrals - Admin and Sales */}
                        {["Admin", "Sales"].includes(user.role) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-gray-500">Client Programs</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setShowReferrals(!showReferrals);
                                setShowArchive(false);
                                setShowCommissions(false);
                                setShowExtraPhotosSales(false);
                                setShowComplaints(false);
                                setShowVipClients(false);
                                setShowEmailTemplates(false);
                              }}
                            >
                              <Gift className="h-4 w-4 mr-2" />
                              Referrals
                              {showReferrals && <span className="ml-auto text-xs text-pink-600">Active</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setShowVipClients(!showVipClients);
                                setShowArchive(false);
                                setShowCommissions(false);
                                setShowExtraPhotosSales(false);
                                setShowComplaints(false);
                                setShowReferrals(false);
                                setShowRewards(false);
                                setShowEmailTemplates(false);
                              }}
                            >
                              <Crown className="h-4 w-4 mr-2" />
                              VIP Clients
                              {showVipClients && <span className="ml-auto text-xs text-amber-600">Active</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setShowRewards(!showRewards);
                                setShowArchive(false);
                                setShowCommissions(false);
                                setShowExtraPhotosSales(false);
                                setShowComplaints(false);
                                setShowReferrals(false);
                                setShowVipClients(false);
                                setShowEmailTemplates(false);
                              }}
                            >
                              <Trophy className="h-4 w-4 mr-2" />
                              Rewards
                              {showRewards && <span className="ml-auto text-xs text-emerald-600">Active</span>}
                            </DropdownMenuItem>
                          </>
                        )}

                        {/* Admin Tools Section */}
                        {user.role === "Admin" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-gray-500">Admin</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setShowDriveManager(!showDriveManager);
                                setShowArchive(false);
                                setShowCommissions(false);
                                setShowExtraPhotosSales(false);
                                setShowComplaints(false);
                                setShowReferrals(false);
                                setShowVipClients(false);
                                setShowRewards(false);
                                setShowEmailTemplates(false);
                              }}
                            >
                              <HardDrive className="h-4 w-4 mr-2" />
                              Drive Manager
                              {showDriveManager && <span className="ml-auto text-xs text-blue-600">Active</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setShowSettingsDialog(true)}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setShowEmailTemplates(true);
                              }}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Email Templates
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={handleManualRollover}
                              data-testid="button-manual-rollover"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2" />
                              Roll Forward
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={handleManualRollback}
                              data-testid="button-manual-rollback"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2 rotate-180" />
                              Roll Back
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* WRU Button for Admin */}
                    <WRUButton 
                      projects={projects} 
                      currentUser={user.name} 
                      isAdmin={user.role === "Admin"} 
                    />

                    {/* Dashboard Customizer */}
                    <WidgetCustomizer
                      userId={widgetUserId}
                      userRole={user.role}
                      onPreferencesChange={handlePreferencesChange}
                    />

                    {/* Settings Dialog (controlled by state, opened from dropdown) */}
                    {user.role === "Admin" && (
                      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Settings</DialogTitle>
                          </DialogHeader>
                          <SettingsPanel
                            currentUser={user}
                          />
                        </DialogContent>
                      </Dialog>
                    )}

                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleLogout}
                      className="flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">  
          {/* Widgets rendered in user's preferred order */}
          {widgetOrder.map((widgetId) => {
            // Daily Quote Widget
            if (widgetId === "daily_quote" && isWidgetVisible("daily_quote") && !showRewards && !showReferrals && !showVipClients && !showDriveManager) {
              return <DailyQuote key={widgetId} userId={user.value} />;
            }
            
            // My Tasks Widget - for Admin and retouchers
            if (widgetId === "my_tasks" && isWidgetVisible("my_tasks") && !showArchive && 
                !showRewards && !showReferrals && !showVipClients && !showDriveManager &&
                (user.role === "Admin" || ["Retoucher1", "Retoucher2", "Retoucher3"].includes(user.role))) {
              const myTasks = projects.filter(p => 
                p.assignedTo && 
                p.assignedTo.toLowerCase() === user.name.toLowerCase() && 
                p.status !== "Delivered"
              );
              
              return (
                <div key={widgetId} className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UserIcon className="h-5 w-5 text-orange-600" />
                        <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
                        <span className="text-sm text-gray-500">
                          Projects assigned to me
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {myTasks.length} active task{myTasks.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {myTasks.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No tasks currently assigned to you
                      </div>
                    ) : (
                      <TaskTable 
                        projects={myTasks} 
                        user={user} 
                        allUsers={users} 
                        isPersonalView={true}
                      />
                    )}
                  </div>
                </div>
              );
            }
            
            // ShootTracker Widget
            if (widgetId === "shoottracker" && isWidgetVisible("shoottracker") && !showArchive && 
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager) {
              return (
                <div key={widgetId} className="mb-6">
                  <ShootTrackerWidget />
                </div>
              );
            }
            
            // Team Analytics Widget
            if (widgetId === "team_analytics" && isWidgetVisible("team_analytics") && !showArchive && 
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager) {
              return <TeamAnalytics key={widgetId} user={user} />;
            }
            
            // Project Table Widget
            if (widgetId === "project_table" && isWidgetVisible("project_table") && 
                user.role !== "Sales" && user.role !== "Evans" && 
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager) {
              const DELIVERED_STATUSES = ["Delivered", "Done"];
              const activeProjects = visibleProjects
                .filter(p => p.dueDate && !DELIVERED_STATUSES.includes(p.status))
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
              const deliveredProjects = visibleProjects
                .filter(p => p.dueDate && DELIVERED_STATUSES.includes(p.status))
                .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
              const tableProjects = projectListTab === "active" ? activeProjects : deliveredProjects;

              return (
                <div key={widgetId}>
                  {/* Active / Delivered tabs */}
                  {!showArchive && (
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => setProjectListTab("active")}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          projectListTab === "active"
                            ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                        }`}
                      >
                        Active
                        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                          projectListTab === "active"
                            ? "bg-white/20 dark:bg-black/20"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        }`}>
                          {activeProjects.length}
                        </span>
                      </button>
                      <button
                        onClick={() => setProjectListTab("delivered")}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          projectListTab === "delivered"
                            ? "bg-green-600 text-white"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                        }`}
                      >
                        Delivered
                        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                          projectListTab === "delivered"
                            ? "bg-white/20"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        }`}>
                          {deliveredProjects.length}
                        </span>
                      </button>
                    </div>
                  )}
                  <TaskTable
                    projects={showArchive ? projects : tableProjects}
                    user={user}
                    allUsers={users}
                    reverseSort={!showArchive && projectListTab === "delivered"}
                  />
                </div>
              );
            }
            
            // Pending Payments Widget (Sales only)
            if (widgetId === "pending_payments" && isWidgetVisible("pending_payments") && 
                user.role === "Sales" && !showExtraPhotosSales && !showRewards && !showReferrals && !showVipClients) {
              const pendingPaymentProjects = projects.filter(p => p.status === "Awaiting Payment");
              return (
                <div key={widgetId} className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <h2 className="text-lg font-semibold text-gray-900">Pending Payments</h2>
                        <span className="text-sm text-gray-500">Awaiting client payment</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {pendingPaymentProjects.length} project{pendingPaymentProjects.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <TaskTable 
                      projects={pendingPaymentProjects} 
                      user={user} 
                      allUsers={users} 
                      isPersonalView={true}
                    />
                  </div>
                </div>
              );
            }
            
            // Ready for Delivery Widget (Sales only)
            if (widgetId === "ready_delivery" && isWidgetVisible("ready_delivery") && 
                user.role === "Sales" && !showExtraPhotosSales && !showRewards && !showReferrals && !showVipClients) {
              const reviewProjects = projects.filter(p => p.status === "Review");
              const readyForDelivery = reviewProjects.filter(p => p.galleryLink && !p.deliveryApproved);
              const awaitingGallery = reviewProjects.filter(p => !p.galleryLink);
              return (
                <div key={widgetId} className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <h2 className="text-lg font-semibold text-gray-900">Ready for Delivery</h2>
                        <span className="text-sm text-gray-500">Completed by retouchers</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {readyForDelivery.length > 0 && (
                          <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {readyForDelivery.length} ready to send
                          </span>
                        )}
                        {awaitingGallery.length > 0 && (
                          <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            {awaitingGallery.length} awaiting gallery
                          </span>
                        )}
                        <div className="text-sm text-gray-600">
                          {reviewProjects.length} project{reviewProjects.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <TaskTable 
                      projects={reviewProjects} 
                      user={user} 
                      allUsers={users} 
                      isPersonalView={true}
                    />
                  </div>
                </div>
              );
            }
            
            if (widgetId === "ai_insights" && isWidgetVisible("ai_insights") && !showArchive && 
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager) {
              return <AIInsightsWidget key={widgetId} />;
            }

            if (widgetId === "retoucher_coach" && isWidgetVisible("retoucher_coach") && !showArchive && 
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager &&
                ["Retoucher1", "Retoucher2", "Retoucher3"].includes(user.role)) {
              return <RetoucherCoachWidget key={widgetId} retoucherName={user.name} />;
            }

            if (widgetId === "workload_forecast" && isWidgetVisible("workload_forecast") && !showArchive && 
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager &&
                ["Admin", "LeadRetoucher"].includes(user.role)) {
              return <WorkloadForecastWidget key={widgetId} userRole={user.role} userId={user.name || user.id || ''} />;
            }

            if (widgetId === "predictive_risk" && isWidgetVisible("predictive_risk") && !showArchive && 
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager &&
                ["Admin", "LeadRetoucher"].includes(user.role)) {
              return <PredictiveRiskWidget key={widgetId} userRole={user.role} userId={user.name || user.id || ''} />;
            }

            if (widgetId === "gallery_activity" && isWidgetVisible("gallery_activity") && !showArchive && 
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager) {
              return <GalleryActivityWidget key={widgetId} userRole={user.role} userId={user.name || user.id || ''} />;
            }

            if (widgetId === "google_review_funnel" && isWidgetVisible("google_review_funnel") && !showArchive &&
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager &&
                user.role === "Admin") {
              return <GoogleReviewFunnelWidget key={widgetId} userRole={user.role} userId={user.name || user.id || ''} />;
            }

            if (widgetId === "google_place_reviews" && isWidgetVisible("google_place_reviews") && !showArchive &&
                !showCommissions && !showExtraPhotosSales && !showComplaints && !showRewards && !showReferrals && !showVipClients && !showDriveManager &&
                ["Admin", "Sales", "LeadRetoucher"].includes(user.role)) {
              return <GooglePlaceReviewsWidget key={widgetId} userRole={user.role} userId={user.name || user.id || ''} />;
            }

            return null;
          })}

          {/* Evans Complaints Calendar - Only content for Evans */}
          {user.role === "Evans" && (
            <ComplaintsCalendar 
              complaints={complaints} 
              user={{
                id: user.id || user.name || 'evans',
                name: user.name,
                role: user.role,
                value: user.value,
                abbr: user.abbr
              }} 
              onUpdateComplaint={async (complaintId, status) => {
                try {
                  await apiRequest("PATCH", `/api/complaints/${complaintId}`, { status });
                  queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
                  toast({
                    title: "Complaint updated",
                    description: `Status changed to ${status}`,
                  });
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to update complaint status",
                    variant: "destructive",
                  });
                }
              }}
            />
          )}
          
          {/* Extra Photos Sales View for Sales */}
          {user.role === "Sales" && showExtraPhotosSales && (
            <ExtraPhotosSalesView projects={allProjects || []} />
          )}
          
          {/* Referral Dashboard for Admin/Sales */}
          {["Admin", "Sales"].includes(user.role) && showReferrals && (
            <ReferralDashboard userRole={user.role} />
          )}

          {/* VIP Client Dashboard for Admin/Sales */}
          {["Admin", "Sales"].includes(user.role) && showVipClients && (
            <VipClientDashboard userRole={user.role} />
          )}

          {/* Rewards Dashboard for Admin/Sales */}
          {["Admin", "Sales"].includes(user.role) && showRewards && (
            <RewardsDashboard userRole={user.role} />
          )}

          {/* Drive Manager for Admin */}
          {user.role === "Admin" && showDriveManager && (
            <DriveManager userRole={user.role} userId={user.id || ""} />
          )}

          {/* Email Templates Editor Dialog for Admin */}
          {user.role === "Admin" && (
            <Dialog open={showEmailTemplates} onOpenChange={setShowEmailTemplates}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Email Templates</DialogTitle>
                </DialogHeader>
                <EmailTemplatesEditor currentUser={user} />
              </DialogContent>
            </Dialog>
          )}

          {/* Delay Alert Banner for DataWrangler */}
          {user.role === "DataWrangler" && !showCommissions && (
            <DelayAlertBanner projects={projects} user={user} />
          )}
          
          {/* Commission View for DataWrangler */}
          {showCommissions && user.role === "DataWrangler" && (
            <CommissionView user={user} />
          )}
          
          {/* Archive Status Header and Add Project Form for non-Sales, non-Evans roles */}
          {user.role !== "Sales" && user.role !== "Evans" && !showCommissions && !showRewards && !showReferrals && !showVipClients && !showDriveManager && (
            <>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-gray-600" />
                    <h2 className="text-lg font-semibold">
                      {user.role === "Admin" && user.name === "Anesu's Pops" && !showArchive ? 
                        "All Projects" : 
                        showArchive ? "Archive Projects" : "Current Projects"
                      }
                    </h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      {projects.length} project{projects.length !== 1 ? 's' : ''} {showArchive ? 'archived' : 'current'}
                    </div>
                    {!showArchive && (
                      <div className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        📸 {projects.reduce((total, p) => total + (p.selectedCount || 0), 0)} photos total
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Show project creation form for non-Sales roles that can add projects - only in current view */}
              {!showArchive && !['Retoucher1', 'Retoucher2', 'Retoucher3', 'Retoucher'].includes(user.role) && (
                <AddProjectForm onAddProject={() => {}} user={user} />
              )}
            </>
          )}



        </div>
      </div>

      {/* Trade Offer Modal */}
      <TradeOfferModal
        open={showTradeModal}
        onOpenChange={setShowTradeModal}
        currentUser={user.name}
        projects={projects}
      />
    </div>
  );
}
