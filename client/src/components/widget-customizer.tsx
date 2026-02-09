import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AVAILABLE_WIDGETS, type WidgetConfig } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GripVertical, LayoutDashboard, Eye, EyeOff, Quote, User, Camera, BarChart3, Table, DollarSign, Package, Sparkles } from "lucide-react";

interface WidgetCustomizerProps {
  userId: string;
  userRole: string;
  onPreferencesChange: (order: string[], hidden: string[]) => void;
}

const iconMap: Record<string, any> = {
  Quote,
  User,
  Camera,
  BarChart3,
  Table,
  DollarSign,
  Package,
  Sparkles,
};

export function WidgetCustomizer({ userId, userRole, onPreferencesChange }: WidgetCustomizerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const availableForRole = AVAILABLE_WIDGETS.filter(w => w.roles.includes(userRole));

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/dashboard/preferences", userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/dashboard/preferences/${encodeURIComponent(userId)}`);
      return response.json();
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (preferences) {
      const savedOrder = (preferences.widgetOrder as string[]) || [];
      const savedHidden = (preferences.hiddenWidgets as string[]) || [];
      
      const validOrder = savedOrder.filter(id => availableForRole.some(w => w.id === id));
      const missingWidgets = availableForRole
        .filter(w => !validOrder.includes(w.id))
        .map(w => w.id);
      
      setWidgetOrder([...validOrder, ...missingWidgets]);
      setHiddenWidgets(savedHidden);
    } else if (!isLoading) {
      const defaultOrder = availableForRole.map(w => w.id);
      const defaultHidden = availableForRole.filter(w => !w.defaultEnabled).map(w => w.id);
      setWidgetOrder(defaultOrder);
      setHiddenWidgets(defaultHidden);
    }
  }, [preferences, isLoading, userRole]);

  const saveMutation = useMutation({
    mutationFn: async (data: { widgetOrder: string[]; hiddenWidgets: string[] }) => {
      const response = await apiRequest("PUT", `/api/dashboard/preferences/${encodeURIComponent(userId)}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/preferences", userId] });
    },
  });

  const handleToggleWidget = (widgetId: string) => {
    const newHidden = hiddenWidgets.includes(widgetId)
      ? hiddenWidgets.filter(id => id !== widgetId)
      : [...hiddenWidgets, widgetId];
    
    setHiddenWidgets(newHidden);
    onPreferencesChange(widgetOrder, newHidden);
    saveMutation.mutate({ widgetOrder, hiddenWidgets: newHidden });
  };

  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    setDraggedItem(widgetId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    const newOrder = [...widgetOrder];
    const draggedIndex = newOrder.indexOf(draggedItem);
    const targetIndex = newOrder.indexOf(targetId);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    setWidgetOrder(newOrder);
    setDraggedItem(null);
    onPreferencesChange(newOrder, hiddenWidgets);
    saveMutation.mutate({ widgetOrder: newOrder, hiddenWidgets });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const getWidgetIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || LayoutDashboard;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4" />
          Customize Dashboard
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Customize Your Dashboard
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          <p className="text-sm text-gray-600">
            Drag to reorder widgets. Toggle visibility to show or hide sections.
          </p>
          
          <div className="space-y-2">
            {widgetOrder.map((widgetId) => {
              const widget = availableForRole.find(w => w.id === widgetId);
              if (!widget) return null;
              
              const isHidden = hiddenWidgets.includes(widgetId);
              
              return (
                <Card
                  key={widgetId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, widgetId)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, widgetId)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-grab active:cursor-grabbing transition-all ${
                    draggedItem === widgetId ? "opacity-50 scale-95" : ""
                  } ${isHidden ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getWidgetIcon(widget.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{widget.name}</div>
                        <div className="text-xs text-gray-500 truncate">{widget.description}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Switch
                          checked={!isHidden}
                          onCheckedChange={() => handleToggleWidget(widgetId)}
                        />
                        {isHidden ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {saveMutation.isPending && (
            <div className="text-sm text-gray-500 text-center">Saving...</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface WidgetContainerProps {
  widgetId: string;
  widgetOrder: string[];
  hiddenWidgets: string[];
  children: React.ReactNode;
}

export function WidgetContainer({ widgetId, widgetOrder, hiddenWidgets, children }: WidgetContainerProps) {
  if (hiddenWidgets.includes(widgetId)) {
    return null;
  }
  
  return <>{children}</>;
}

export function useWidgetPreferences(userId: string, userRole: string) {
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);

  const availableForRole = AVAILABLE_WIDGETS.filter(w => w.roles.includes(userRole));

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/dashboard/preferences", userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/dashboard/preferences/${encodeURIComponent(userId)}`);
      return response.json();
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (preferences) {
      const savedOrder = (preferences.widgetOrder as string[]) || [];
      const savedHidden = (preferences.hiddenWidgets as string[]) || [];
      
      const validOrder = savedOrder.filter(id => availableForRole.some(w => w.id === id));
      const missingWidgets = availableForRole
        .filter(w => !validOrder.includes(w.id))
        .map(w => w.id);
      
      setWidgetOrder([...validOrder, ...missingWidgets]);
      setHiddenWidgets(savedHidden);
    } else if (!isLoading) {
      const defaultOrder = availableForRole.map(w => w.id);
      const defaultHidden = availableForRole.filter(w => !w.defaultEnabled).map(w => w.id);
      setWidgetOrder(defaultOrder);
      setHiddenWidgets(defaultHidden);
    }
  }, [preferences, isLoading, userRole]);

  const handlePreferencesChange = (order: string[], hidden: string[]) => {
    setWidgetOrder(order);
    setHiddenWidgets(hidden);
  };

  const isWidgetVisible = (widgetId: string) => {
    return !hiddenWidgets.includes(widgetId) && availableForRole.some(w => w.id === widgetId);
  };

  const getWidgetPosition = (widgetId: string) => {
    return widgetOrder.indexOf(widgetId);
  };

  return {
    widgetOrder,
    hiddenWidgets,
    isLoading,
    isWidgetVisible,
    getWidgetPosition,
    handlePreferencesChange,
    availableForRole,
  };
}
