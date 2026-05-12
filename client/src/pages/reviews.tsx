import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, ArrowLeft, Download, Check, X, Mail, Search, Loader2, MessageSquare } from "lucide-react";

type SurveyRow = {
  id: string;
  projectId: string;
  clientEmail: string;
  clientName: string;
  rating: number | null;
  feedback: string | null;
  wouldRecommend: boolean | null;
  surveyToken: string;
  completedAt: string | null;
  createdAt: string;
  googlePromptSentAt: string | null;
  googleClickedAt: string | null;
  copyClickedAt: string | null;
  googlePromptRemindersSent: number;
  lastReminderSentAt: string | null;
  projectName: string;
  projectAssignedTo: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getFirstName(full: string): string {
  if (!full) return "";
  return full.replace(/\([^)]*\)/g, "").trim().split(/\s+/)[0] || full;
}

function StarRow({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-gray-400">No rating</span>;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [tab, setTab] = useState("completed");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("usena_role") || "");
    setUserId(localStorage.getItem("usena_user_id") || "");
  }, []);

  const { data: surveys, isLoading, error } = useQuery<SurveyRow[]>({
    queryKey: ["/api/admin/surveys"],
    enabled: !!role,
    queryFn: async () => {
      const res = await fetch("/api/admin/surveys", {
        headers: { "x-usena-role": role, "x-usena-user-id": userId },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const allowed = ["Admin", "Sales", "LeadRetoucher"].includes(role);

  const completed = useMemo(() => (surveys || []).filter((s) => !!s.completedAt), [surveys]);
  const pending = useMemo(() => (surveys || []).filter((s) => !s.completedAt), [surveys]);

  const filteredCompleted = useMemo(() => {
    return completed.filter((s) => {
      if (ratingFilter !== "all" && String(s.rating) !== ratingFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.clientName.toLowerCase().includes(q) && !(s.feedback || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [completed, ratingFilter, search]);

  const stats = useMemo(() => {
    const total = completed.length;
    const avg = total ? completed.reduce((sum, s) => sum + (s.rating || 0), 0) / total : 0;
    const recommend = completed.filter((s) => s.wouldRecommend === true).length;
    const recommendPct = total ? Math.round((recommend / total) * 100) : 0;
    const fiveStar = completed.filter((s) => s.rating === 5).length;
    const googleClicked = completed.filter((s) => !!s.googleClickedAt).length;
    return { total, avg, recommendPct, fiveStar, googleClicked };
  }, [completed]);

  const exportCsv = () => {
    const rows = [
      ["Client", "Email", "Project", "Rating", "Recommend", "Feedback", "Completed", "Copy clicked", "Google clicked", "Reminders sent"],
      ...filteredCompleted.map((s) => [
        s.clientName,
        s.clientEmail,
        s.projectName,
        s.rating ?? "",
        s.wouldRecommend === true ? "Yes" : s.wouldRecommend === false ? "No" : "",
        (s.feedback || "").replace(/"/g, '""'),
        s.completedAt ? new Date(s.completedAt).toISOString() : "",
        s.copyClickedAt ? "Yes" : "No",
        s.googleClickedAt ? "Yes" : "No",
        s.googlePromptRemindersSent,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c)}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reviews_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <p>Please log in to view reviews.</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">You don't have permission to view this page.</p>
            <Button className="mt-4" onClick={() => setLocation("/")}>Back to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")}> 
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Reviews</h1>
          </div>
          <Button onClick={exportCsv} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card><CardContent className="pt-5 pb-4 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500">Reviews</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500">Avg rating</p>
            <p className="text-2xl font-bold mt-1">{stats.avg.toFixed(1)} <Star className="inline h-4 w-4 fill-yellow-400 text-yellow-400 -mt-1" /></p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500">Would recommend</p>
            <p className="text-2xl font-bold mt-1">{stats.recommendPct}%</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500">5★ reviews</p>
            <p className="text-2xl font-bold mt-1">{stats.fiveStar}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500">Clicked Google</p>
            <p className="text-2xl font-bold mt-1">{stats.googleClicked}</p>
          </CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="completed" className="space-y-3 mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input className="pl-9" placeholder="Search by name or feedback…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ratings</SelectItem>
                  <SelectItem value="5">5 stars</SelectItem>
                  <SelectItem value="4">4 stars</SelectItem>
                  <SelectItem value="3">3 stars</SelectItem>
                  <SelectItem value="2">2 stars</SelectItem>
                  <SelectItem value="1">1 star</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading && (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            )}
            {error && <p className="text-red-500 text-sm">Failed to load reviews.</p>}

            {!isLoading && filteredCompleted.length === 0 && (
              <Card><CardContent className="pt-8 pb-8 text-center text-gray-500">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                No reviews match your filters.
              </CardContent></Card>
            )}

            {filteredCompleted.map((s) => {
              const showTracking = s.rating === 5;
              return (
                <Card key={s.id}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{getFirstName(s.clientName)}</h3>
                          <span className="text-xs text-gray-500">{s.clientName}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{s.clientEmail} · Project: {s.projectName}{s.projectAssignedTo ? ` · ${s.projectAssignedTo}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StarRow rating={s.rating} />
                        <span className="text-xs text-gray-500">{fmtDate(s.completedAt)}</span>
                      </div>
                    </div>
                    {s.feedback && (
                      <div className="mt-3 bg-[#faf7f0] rounded-lg p-3 border-l-4 border-[#c9a961]">
                        <p className="text-sm text-gray-700 italic leading-relaxed">"{s.feedback}"</p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {s.wouldRecommend === true && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Would recommend</Badge>}
                      {s.wouldRecommend === false && <Badge variant="secondary">Would not recommend</Badge>}
                      {showTracking && (
                        <>
                          <Badge variant="outline" className="gap-1">
                            {s.copyClickedAt ? <Check className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-gray-400" />}
                            Copied
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            {s.googleClickedAt ? <Check className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-gray-400" />}
                            Clicked Google
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Mail className="h-3 w-3" /> Reminders: {s.googlePromptRemindersSent}/3
                          </Badge>
                          {s.googlePromptSentAt && !s.googleClickedAt && s.googlePromptRemindersSent < 3 && (
                            <span className="text-xs text-gray-500">Prompt sent {fmtDate(s.googlePromptSentAt)}</span>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {isLoading && (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            )}
            {!isLoading && pending.length === 0 && (
              <Card><CardContent className="pt-8 pb-8 text-center text-gray-500">No pending surveys.</CardContent></Card>
            )}
            {pending.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-5 pb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{s.clientName}</h3>
                    <p className="text-xs text-gray-500">{s.clientEmail} · Project: {s.projectName}</p>
                  </div>
                  <div className="text-xs text-gray-500">Sent {fmtDate(s.createdAt)}</div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
