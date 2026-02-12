import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Search,
  Zap,
  Clock,
  Activity,
  Eye,
  GitBranch,
  ChevronRight,
  Layers,
  Bot,
  MessageSquare,
  Calculator,
  Users,
  Settings,
  HardDrive,
  MousePointer,
  LayoutGrid,
  Gift,
  Filter,
  RefreshCw,
} from "lucide-react";

interface AutomationEntry {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  trigger: string;
  actions: string[];
  connectsTo: string[];
  enabled: boolean;
  lastFired?: string;
  fireCount: number;
  apiRoute?: string;
  roles?: string[];
}

interface ActivityLogEntry {
  automationId: string;
  timestamp: string;
  details: string;
}

interface Stats {
  total: number;
  enabled: number;
  disabled: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  recentActivity: ActivityLogEntry[];
}

const typeIcons: Record<string, typeof Zap> = {
  background: Clock,
  drive_monitor: HardDrive,
  ai_powered: Bot,
  communication: MessageSquare,
  data_triggered: Calculator,
  user_action: MousePointer,
  ui_action: LayoutGrid,
};

const typeColors: Record<string, string> = {
  background: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  drive_monitor: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  ai_powered: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  communication: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  data_triggered: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  user_action: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  ui_action: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
};

const typeLabels: Record<string, string> = {
  background: "Background",
  drive_monitor: "Drive Monitor",
  ai_powered: "AI Powered",
  communication: "Communication",
  data_triggered: "Data Triggered",
  user_action: "User Action",
  ui_action: "UI Action",
};

const categoryIcons: Record<string, typeof Zap> = {
  "Scheduled Processes": Clock,
  "Drive Monitor": HardDrive,
  "AI Features": Bot,
  "Communication": MessageSquare,
  "Data & Calculation": Calculator,
  "Project Management": Layers,
  "Delivery & Gallery": Gift,
  "Team Management": Users,
  "Dashboard & Settings": Settings,
  "Client-Facing": Eye,
  "Chat & Messaging": MessageSquare,
  "Rewards & Referrals": Gift,
};

function AutomationCard({
  automation,
  allAutomations,
  onToggle,
  onSelect,
}: {
  automation: AutomationEntry;
  allAutomations: AutomationEntry[];
  onToggle: (id: string, enabled: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const Icon = typeIcons[automation.type] || Zap;
  const colorClass = typeColors[automation.type] || typeColors.background;

  const connectedNames = automation.connectsTo
    .map((id) => allAutomations.find((a) => a.id === id)?.name)
    .filter(Boolean);

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all border ${
        !automation.enabled ? "opacity-50" : ""
      }`}
      onClick={() => onSelect(automation.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg border ${colorClass} shrink-0`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{automation.name}</h3>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colorClass}`}>
                  {typeLabels[automation.type]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {automation.description}
              </p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                <Zap className="h-3 w-3" />
                <span className="truncate">{automation.trigger}</span>
              </div>
              {connectedNames.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  <span className="truncate">
                    Connects to: {connectedNames.slice(0, 2).join(", ")}
                    {connectedNames.length > 2 && ` +${connectedNames.length - 2}`}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 mt-2">
                {automation.fireCount > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {automation.fireCount}x fired
                  </span>
                )}
                {automation.lastFired && (
                  <span className="text-[10px] text-muted-foreground">
                    Last: {new Date(automation.lastFired).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Switch
            checked={automation.enabled}
            onCheckedChange={(checked) => {
              onToggle(automation.id, checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AutomationDetail({
  automation,
  allAutomations,
  onClose,
  onToggle,
}: {
  automation: AutomationEntry;
  allAutomations: AutomationEntry[];
  onClose: () => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const { data: activity } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/automations/activity", automation.id],
    queryFn: async () => {
      const res = await fetch(`/api/automations/activity?automationId=${automation.id}&limit=20`);
      return res.json();
    },
  });

  const Icon = typeIcons[automation.type] || Zap;
  const colorClass = typeColors[automation.type] || typeColors.background;

  const connectedAutomations = automation.connectsTo
    .map((id) => allAutomations.find((a) => a.id === id))
    .filter(Boolean) as AutomationEntry[];

  const incomingConnections = allAutomations.filter((a) =>
    a.connectsTo.includes(automation.id)
  );

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onClose} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to all automations
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-3 rounded-lg border ${colorClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{automation.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={colorClass}>
                    {typeLabels[automation.type]}
                  </Badge>
                  <Badge variant="outline">{automation.category}</Badge>
                  {automation.enabled ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Disabled</Badge>
                  )}
                </div>
              </div>
            </div>
            <Switch
              checked={automation.enabled}
              onCheckedChange={(checked) => onToggle(automation.id, checked)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{automation.description}</p>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" /> Trigger
            </h4>
            <div className="bg-muted/50 rounded-lg p-3 text-sm">{automation.trigger}</div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ChevronRight className="h-4 w-4" /> Actions ({automation.actions.length})
            </h4>
            <div className="space-y-1">
              {automation.actions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm bg-muted/30 rounded px-3 py-1.5"
                >
                  <span className="text-muted-foreground text-xs w-5">{i + 1}.</span>
                  {action}
                </div>
              ))}
            </div>
          </div>

          {automation.apiRoute && (
            <div>
              <h4 className="text-sm font-semibold mb-1">API Route</h4>
              <code className="text-xs bg-muted px-2 py-1 rounded">{automation.apiRoute}</code>
            </div>
          )}

          {automation.roles && automation.roles.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Roles</h4>
              <div className="flex gap-1 flex-wrap">
                {automation.roles.map((role) => (
                  <Badge key={role} variant="outline" className="text-xs">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-4 w-4" /> Fired {automation.fireCount} times
            </span>
            {automation.lastFired && (
              <span>Last: {new Date(automation.lastFired).toLocaleString()}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {(connectedAutomations.length > 0 || incomingConnections.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {incomingConnections.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Triggered by:</h4>
                <div className="space-y-1">
                  {incomingConnections.map((a) => {
                    const AIcon = typeIcons[a.type] || Zap;
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 rounded px-3 py-2"
                      >
                        <AIcon className="h-3.5 w-3.5 text-blue-500" />
                        <span>{a.name}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
                        <span className="text-muted-foreground text-xs">this</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {connectedAutomations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Triggers:</h4>
                <div className="space-y-1">
                  {connectedAutomations.map((a) => {
                    const AIcon = typeIcons[a.type] || Zap;
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950/30 rounded px-3 py-2"
                      >
                        <span className="text-muted-foreground text-xs">this</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <AIcon className="h-3.5 w-3.5 text-green-500" />
                        <span>{a.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activity && activity.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {activity.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm border-b last:border-0 pb-2"
                  >
                    <span>{entry.details}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConnectionFlowView({ automations }: { automations: AutomationEntry[] }) {
  const chains = useMemo(() => {
    const roots = automations.filter(
      (a) => !automations.some((other) => other.connectsTo.includes(a.id))
    );

    function buildChain(auto: AutomationEntry, visited: Set<string> = new Set()): any {
      if (visited.has(auto.id)) return { ...auto, children: [] };
      visited.add(auto.id);
      const children = auto.connectsTo
        .map((id) => automations.find((a) => a.id === id))
        .filter(Boolean)
        .map((child) => buildChain(child!, new Set(visited)));
      return { ...auto, children };
    }

    return roots.filter((r) => r.connectsTo.length > 0).map((r) => buildChain(r));
  }, [automations]);

  function renderNode(node: any, depth = 0) {
    const Icon = typeIcons[node.type] || Zap;
    const colorClass = typeColors[node.type] || typeColors.background;
    return (
      <div key={node.id} style={{ marginLeft: depth * 24 }} className="mb-1">
        <div className="flex items-center gap-2">
          {depth > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <div className="w-4 border-t border-muted-foreground/30" />
              <ChevronRight className="h-3 w-3" />
            </div>
          )}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${colorClass} ${
              !node.enabled ? "opacity-50" : ""
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="font-medium">{node.name}</span>
          </div>
        </div>
        {node.children?.map((child: any) => renderNode(child, depth + 1))}
      </div>
    );
  }

  if (chains.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No connected automation chains found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {chains.map((chain: any) => (
        <Card key={chain.id}>
          <CardContent className="p-4">{renderNode(chain)}</CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AutomationsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [filterType, setFilterType] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ automations: AutomationEntry[]; stats: Stats }>({
    queryKey: ["/api/automations"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/automations/${id}/toggle`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle automation", variant: "destructive" });
    },
  });

  const automations = data?.automations || [];
  const stats = data?.stats;

  const filtered = useMemo(() => {
    let result = automations;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.trigger.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      );
    }
    if (filterType) {
      result = result.filter((a) => a.type === filterType);
    }
    return result;
  }, [automations, search, filterType]);

  const categories = useMemo(() => {
    const cats: Record<string, AutomationEntry[]> = {};
    filtered.forEach((a) => {
      if (!cats[a.category]) cats[a.category] = [];
      cats[a.category].push(a);
    });
    return cats;
  }, [filtered]);

  const handleToggle = (id: string, enabled: boolean) => {
    toggleMutation.mutate({ id, enabled });
  };

  const selectedAutomation = automations.find((a) => a.id === selectedId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              Automation Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All {stats?.total || 0} automations in USENA FLOW
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/automations"] })}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <a href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
              </Button>
            </a>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(typeLabels).map(([type, label]) => {
              const count = stats.byType[type] || 0;
              const Icon = typeIcons[type] || Zap;
              const color = typeColors[type];
              const isActive = filterType === type;
              return (
                <Card
                  key={type}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isActive ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setFilterType(isActive ? null : type)}
                >
                  <CardContent className="p-3 text-center">
                    <div className={`inline-flex p-2 rounded-lg border ${color} mb-1`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {selectedAutomation ? (
          <AutomationDetail
            automation={selectedAutomation}
            allAutomations={automations}
            onClose={() => setSelectedId(null)}
            onToggle={handleToggle}
          />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search automations by name, description, or trigger..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {filterType && (
                <Button variant="ghost" size="sm" onClick={() => setFilterType(null)}>
                  <Filter className="h-4 w-4 mr-1" /> Clear filter
                </Button>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">
                  All ({filtered.length})
                </TabsTrigger>
                <TabsTrigger value="categories">By Category</TabsTrigger>
                <TabsTrigger value="connections">Connection Flow</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((automation) => (
                    <AutomationCard
                      key={automation.id}
                      automation={automation}
                      allAutomations={automations}
                      onToggle={handleToggle}
                      onSelect={setSelectedId}
                    />
                  ))}
                </div>
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No automations match your search.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="categories" className="mt-4">
                <div className="space-y-6">
                  {Object.entries(categories).map(([category, items]) => {
                    const CatIcon = categoryIcons[category] || Layers;
                    return (
                      <div key={category}>
                        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                          <CatIcon className="h-5 w-5 text-primary" />
                          {category}
                          <Badge variant="outline" className="ml-1">
                            {items.length}
                          </Badge>
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {items.map((automation) => (
                            <AutomationCard
                              key={automation.id}
                              automation={automation}
                              allAutomations={automations}
                              onToggle={handleToggle}
                              onSelect={setSelectedId}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="connections" className="mt-4">
                <ConnectionFlowView automations={filtered} />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <ActivityLogView />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function ActivityLogView() {
  const { data: activity, isLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/automations/activity"],
    queryFn: async () => {
      const res = await fetch("/api/automations/activity?limit=100");
      return res.json();
    },
  });

  const { data: automationsData } = useQuery<{ automations: AutomationEntry[] }>({
    queryKey: ["/api/automations"],
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading activity...</div>;
  }

  if (!activity || activity.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No activity recorded yet. Automations will log their activity here as they fire.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {activity.map((entry, i) => {
              const automation = automationsData?.automations.find(
                (a) => a.id === entry.automationId
              );
              const Icon = automation ? typeIcons[automation.type] || Zap : Zap;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm border-b last:border-0 pb-2"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate min-w-0">
                    {automation?.name || entry.automationId}
                  </span>
                  <span className="text-muted-foreground truncate flex-1">{entry.details}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
