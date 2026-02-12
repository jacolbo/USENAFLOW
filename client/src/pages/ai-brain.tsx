import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Brain, Plus, Trash2, Edit2, Save, X, BookOpen, MessageSquare, Eye, Sparkles, AlertTriangle, Shield, Target, Users, Clock, RefreshCw } from "lucide-react";

const INSTRUCTION_CATEGORIES = [
  { value: "general", label: "General", icon: BookOpen, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "quality", label: "Quality Standards", icon: Eye, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "deadlines", label: "Deadlines & Speed", icon: Clock, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "individual", label: "Individual Team Member", icon: Target, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "communication", label: "Communication Style", icon: MessageSquare, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
  { value: "code_of_conduct", label: "Code of Conduct", icon: Shield, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
];

const MEMORY_CATEGORIES = [
  { value: "all", label: "All Memories" },
  { value: "insights", label: "Smart Insights" },
  { value: "retoucher_coach", label: "Retoucher Coach" },
  { value: "team_chat", label: "Team Chat" },
  { value: "quality_gate", label: "Quality Gate" },
  { value: "workload", label: "Workload Forecast" },
  { value: "risk", label: "Risk Alerts" },
  { value: "project_history", label: "Project History" },
  { value: "client_feedback", label: "Client Feedback" },
  { value: "client_chat", label: "Client Chat" },
  { value: "retoucher_behavior", label: "Retoucher Behavior" },
];

function getAuthHeaders(): Record<string, string> {
  const role = localStorage.getItem("usena_role") || "";
  const userStr = localStorage.getItem("usena_user");
  const userId = userStr ? JSON.parse(userStr)?.id?.toString() || "" : "";
  return { "x-usena-role": role, "x-usena-user-id": userId };
}

export default function AiBrainPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("instructions");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newInstruction, setNewInstruction] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newTarget, setNewTarget] = useState("");
  const [newPriority, setNewPriority] = useState(5);
  const [memoryFilter, setMemoryFilter] = useState("all");

  const { data: instructionsData, isLoading: loadingInstructions } = useQuery<{ instructions: any[] }>({
    queryKey: ["/api/ai/admin-instructions"],
    queryFn: () => fetch("/api/ai/admin-instructions", { headers: getAuthHeaders() }).then(r => r.json()),
  });

  const { data: memoryData, isLoading: loadingMemories } = useQuery<{ memories: any[]; total: number }>({
    queryKey: ["/api/ai/memory", memoryFilter],
    queryFn: () => fetch(`/api/ai/memory${memoryFilter !== "all" ? `?category=${memoryFilter}` : ""}`, { headers: getAuthHeaders() }).then(r => r.json()),
  });

  const addInstructionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/ai/admin-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/admin-instructions"] });
      setShowAddForm(false);
      setNewInstruction("");
      setNewCategory("general");
      setNewTarget("");
      setNewPriority(5);
      toast({ title: "Instruction added", description: "The AI will now follow this directive." });
    },
    onError: () => toast({ title: "Error", description: "Failed to add instruction", variant: "destructive" }),
  });

  const updateInstructionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/ai/admin-instructions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/admin-instructions"] });
      setEditingId(null);
      toast({ title: "Instruction updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const deleteInstructionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/admin-instructions/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/admin-instructions"] });
      toast({ title: "Instruction removed" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/memory/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/memory", memoryFilter] });
      toast({ title: "Memory removed" });
    },
  });

  const clearMemoriesMutation = useMutation({
    mutationFn: async (category?: string) => {
      const res = await fetch(`/api/ai/memory${category ? `?category=${category}` : ""}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/memory", memoryFilter] });
      toast({ title: "Memories cleared" });
    },
  });

  const pruneMemoriesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/memory/prune", { method: "POST", headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/memory", memoryFilter] });
      toast({ title: "Old memories pruned" });
    },
  });

  const dataScanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/data-scan", { method: "POST", headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/memory", memoryFilter] });
      const r = data.results;
      toast({
        title: "Data scan complete",
        description: `Learned ${r.total} new patterns: ${r.projectHistory} from projects, ${r.clientSurveys} from surveys, ${r.clientChats} from chats, ${r.retoucherBehavior} from retoucher behavior, ${r.referralPatterns} from referrals`,
      });
    },
    onError: () => toast({ title: "Error", description: "Data scan failed", variant: "destructive" }),
  });

  const instructions = instructionsData?.instructions || [];
  const memories = memoryData?.memories || [];

  const handleSubmitInstruction = () => {
    if (!newInstruction.trim()) return;
    addInstructionMutation.mutate({
      instruction: newInstruction.trim(),
      category: newCategory,
      targetRetoucher: newTarget || null,
      priority: newPriority,
      createdBy: "Admin",
    });
  };

  const toggleInstruction = (id: string, currentActive: boolean) => {
    updateInstructionMutation.mutate({ id, updates: { isActive: !currentActive } });
  };

  const getCategoryInfo = (cat: string) =>
    INSTRUCTION_CATEGORIES.find(c => c.value === cat) || INSTRUCTION_CATEGORIES[0];

  const getMemoryTypeColor = (type: string) => {
    switch (type) {
      case "observation": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "pattern": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "feedback": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "performance_trend": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
      case "preference": return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Brain</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Teach the AI how to manage your team and review what it has learned</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{instructions.filter((i: any) => i.isActive).length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Directives</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{memoryData?.total || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Memories Stored</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Set(memories.filter((m: any) => m.retoucherName).map((m: any) => m.retoucherName)).size}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Team Members Tracked</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="instructions" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin Directives
            </TabsTrigger>
            <TabsTrigger value="memories" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Memory
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instructions" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Team Management Directives</CardTitle>
                    <CardDescription>
                      Tell the AI how to handle your team. These instructions are followed across all AI features — insights, coaching, risk alerts, and team chat.
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Directive
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAddForm && (
                  <Card className="border-2 border-purple-200 dark:border-purple-800">
                    <CardContent className="p-4 space-y-3">
                      <Textarea
                        placeholder='e.g., "Be stricter about deadlines — if a retoucher is consistently late, flag it prominently" or "John is new, be patient and give extra guidance"'
                        value={newInstruction}
                        onChange={(e) => setNewInstruction(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs mb-1 block">Category</Label>
                          <Select value={newCategory} onValueChange={setNewCategory}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INSTRUCTION_CATEGORIES.map(cat => (
                                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Specific Team Member (optional)</Label>
                          <Input
                            placeholder="Leave empty for all"
                            value={newTarget}
                            onChange={(e) => setNewTarget(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Priority (1-10)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={newPriority}
                            onChange={(e) => setNewPriority(parseInt(e.target.value) || 5)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSubmitInstruction} disabled={!newInstruction.trim() || addInstructionMutation.isPending} size="sm">
                          <Save className="h-4 w-4 mr-1" />
                          Save Directive
                        </Button>
                        <Button variant="ghost" onClick={() => setShowAddForm(false)} size="sm">
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {loadingInstructions ? (
                  <div className="text-center py-8 text-gray-500">Loading directives...</div>
                ) : instructions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No directives yet</p>
                    <p className="text-sm">Add instructions to tell the AI how to manage your team</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {instructions.map((inst: any) => {
                      const catInfo = getCategoryInfo(inst.category);
                      const CatIcon = catInfo.icon;
                      return (
                        <div
                          key={inst.id}
                          className={`p-4 rounded-lg border ${inst.isActive ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-900/50 opacity-60"} transition-opacity`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={catInfo.color} variant="secondary">
                                  <CatIcon className="h-3 w-3 mr-1" />
                                  {catInfo.label}
                                </Badge>
                                {inst.targetRetoucher && (
                                  <Badge variant="outline">
                                    <Target className="h-3 w-3 mr-1" />
                                    {inst.targetRetoucher}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  Priority: {inst.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-800 dark:text-gray-200">{inst.instruction}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                Added by {inst.createdBy} on {new Date(inst.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={inst.isActive}
                                onCheckedChange={() => toggleInstruction(inst.id, inst.isActive)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700"
                                onClick={() => deleteInstructionMutation.mutate(inst.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-medium mb-1">How directives work</p>
                    <ul className="space-y-1 text-amber-700 dark:text-amber-400">
                      <li>Directives are injected into every AI interaction — insights, coaching, chat, quality reviews, and forecasts.</li>
                      <li>The AI will follow your instructions when generating responses for the team.</li>
                      <li>Target a specific team member for personalized instructions, or leave it blank for team-wide directives.</li>
                      <li>Use the toggle to temporarily disable a directive without deleting it.</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memories" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg">AI Memory Bank</CardTitle>
                    <CardDescription>
                      What the AI has learned from past interactions. It uses these memories to give more informed, context-aware responses.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => dataScanMutation.mutate()}
                      disabled={dataScanMutation.isPending}
                    >
                      <Sparkles className={`h-4 w-4 mr-1 ${dataScanMutation.isPending ? "animate-spin" : ""}`} />
                      {dataScanMutation.isPending ? "Scanning..." : "Learn from All Data"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pruneMemoriesMutation.mutate()}
                      disabled={pruneMemoriesMutation.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${pruneMemoriesMutation.isPending ? "animate-spin" : ""}`} />
                      Prune Old
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        if (confirm("Clear all AI memories? The AI will start fresh.")) {
                          clearMemoriesMutation.mutate(memoryFilter !== "all" ? memoryFilter : undefined);
                        }
                      }}
                      disabled={clearMemoriesMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear {memoryFilter !== "all" ? memoryFilter : "All"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {MEMORY_CATEGORIES.map(cat => (
                    <Button
                      key={cat.value}
                      variant={memoryFilter === cat.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMemoryFilter(cat.value)}
                      className="text-xs"
                    >
                      {cat.label}
                    </Button>
                  ))}
                </div>

                {loadingMemories ? (
                  <div className="text-center py-8 text-gray-500">Loading memories...</div>
                ) : memories.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No memories yet</p>
                    <p className="text-sm">The AI will start building memories as it interacts with your team and data</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {memories.map((mem: any) => (
                      <div
                        key={mem.id}
                        className="p-3 rounded-lg border bg-white dark:bg-gray-900 hover:border-purple-200 dark:hover:border-purple-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={getMemoryTypeColor(mem.type)} variant="secondary">
                                {mem.type}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{mem.category}</Badge>
                              {mem.retoucherName && (
                                <Badge variant="outline" className="text-xs">
                                  <Users className="h-3 w-3 mr-1" />
                                  {mem.retoucherName}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-400">
                                Importance: {mem.importance}/10
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{mem.content}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(mem.createdAt).toLocaleDateString()} at {new Date(mem.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-red-500 shrink-0"
                            onClick={() => deleteMemoryMutation.mutate(mem.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-purple-800 dark:text-purple-300">
                    <p className="font-medium mb-1">How AI Memory works</p>
                    <ul className="space-y-1 text-purple-700 dark:text-purple-400">
                      <li>After each AI interaction, the system automatically extracts and stores key observations.</li>
                      <li>Before generating new responses, the AI reviews relevant past memories to provide informed advice.</li>
                      <li>Memories are scored by importance (1-10). Low-importance memories are automatically pruned when storage exceeds limits.</li>
                      <li>You can delete individual memories or clear entire categories if the AI has learned something incorrect.</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
