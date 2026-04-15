import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Camera, ChevronLeft, Image, Plus, Trash2, Upload, FileText, Sparkles, X, Save } from "lucide-react";
import type { Project, ShootBrief, ShootBriefImage } from "@shared/schema";

interface StoredUser {
  role: string;
  name: string;
  id?: string;
  value: string;
}

function getStoredUser(): StoredUser | null {
  try {
    const sessionStr = localStorage.getItem("usenaflow_session");
    if (!sessionStr) return null;
    const sessionData = JSON.parse(sessionStr);
    const currentTime = Date.now();
    if (currentTime - sessionData.timestamp > 2 * 60 * 60 * 1000) return null;
    return sessionData.user as StoredUser;
  } catch {
    return null;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type ShootProject = Project & { hasBrief: boolean };
type BriefWithImages = ShootBrief & { images: ShootBriefImage[] };

export default function ShootBriefsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const isAdmin = user?.role === "Admin";

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("projectId");
    if (pid) setSelectedProjectId(pid);
  }, []);

  const dateStr = toDateString(selectedDate);

  const { data: shoots = [], isLoading: shootsLoading } = useQuery<ShootProject[]>({
    queryKey: ["/api/shoots/today", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/shoots/today?date=${dateStr}`, {
        headers: { "X-Usena-Role": user?.role || "" },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const goDay = (dir: number) => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const goToday = () => setSelectedDate(new Date());

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Please log in to access Shoot Briefs.</p>
      </div>
    );
  }

  const briefReadRoles = ["Admin", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "DataWrangler"];
  if (!briefReadRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">You don't have access to Shoot Briefs.</p>
      </div>
    );
  }

  if (selectedProjectId) {
    return (
      <BriefEditor
        projectId={selectedProjectId}
        isAdmin={isAdmin}
        user={user}
        onBack={() => {
          setSelectedProjectId(null);
          window.history.replaceState(null, "", "/shoot-briefs");
        }}
      />
    );
  }

  const isToday = toDateString(selectedDate) === toDateString(new Date());

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shoot Briefs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Visual direction & notes for shoots</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => goDay(-1)} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {isToday ? "Today" : formatDate(selectedDate)}
            </p>
            {isToday && <p className="text-xs text-gray-500">{formatDate(selectedDate)}</p>}
            {!isToday && (
              <Button variant="link" size="sm" onClick={goToday} className="text-xs p-0 h-auto">
                Go to Today
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => goDay(1)} className="h-10 w-10">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {shootsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : shoots.length === 0 ? (
          <div className="text-center py-16">
            <Camera className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No shoots on this date</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try navigating to a different day</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shoots.map(shoot => (
              <button
                key={shoot.id}
                onClick={() => {
                  setSelectedProjectId(shoot.id);
                  window.history.replaceState(null, "", `/shoot-briefs?projectId=${shoot.id}`);
                }}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98] border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{shoot.clientName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{shoot.status}</Badge>
                      {shoot.assignedTo && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{shoot.assignedTo}</span>
                      )}
                    </div>
                  </div>
                  <div className={`h-3 w-3 rounded-full flex-shrink-0 ml-3 ${shoot.hasBrief ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BriefEditor({ projectId, isAdmin, user, onBack }: {
  projectId: string;
  isAdmin: boolean;
  user: StoredUser;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [notesChanged, setNotesChanged] = useState(false);

  const headers: Record<string, string> = {
    "X-Usena-Role": user.role,
    "X-Usena-User-Id": user.name || user.id || "",
  };

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const allProjects = await fetch("/api/projects").then(r => r.json());
      return allProjects.find((p: Project) => p.id === projectId);
    },
  });

  const { data: brief, isLoading: briefLoading } = useQuery<BriefWithImages>({
    queryKey: ["/api/shoot-briefs", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/shoot-briefs/${projectId}`, { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch brief");
      return res.json();
    },
  });

  useEffect(() => {
    if (brief?.notes !== undefined) {
      setNotes(brief.notes || "");
      setNotesChanged(false);
    }
  }, [brief?.notes]);

  const createBriefMutation = useMutation({
    mutationFn: async (data: { notes?: string }) => {
      const res = await fetch(`/api/shoot-briefs/${projectId}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create brief");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shoot-briefs", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects-with-briefs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shoots/today"] });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      if (!brief) {
        return createBriefMutation.mutateAsync({ notes: newNotes });
      }
      const res = await fetch(`/api/shoot-briefs/${projectId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: newNotes }),
      });
      if (!res.ok) throw new Error("Failed to update notes");
      return res.json();
    },
    onSuccess: () => {
      setNotesChanged(false);
      queryClient.invalidateQueries({ queryKey: ["/api/shoot-briefs", projectId] });
      toast({ title: "Notes saved" });
    },
    onError: () => {
      toast({ title: "Failed to save notes", variant: "destructive" });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ file, imageType }: { file: File; imageType: string }) => {
      const buffer = await file.arrayBuffer();
      const res = await fetch(
        `/api/shoot-briefs/${projectId}/images/upload?imageType=${imageType}`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": file.type || "application/octet-stream",
          },
          body: buffer,
        }
      );
      if (!res.ok) throw new Error("Failed to upload image");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shoot-briefs", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects-with-briefs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shoots/today"] });
      toast({ title: "Image uploaded" });
    },
    onError: () => {
      toast({ title: "Failed to upload image", variant: "destructive" });
    },
  });

  const updateCaptionMutation = useMutation({
    mutationFn: async ({ imageId, caption }: { imageId: string; caption: string }) => {
      const res = await fetch(`/api/shoot-brief-images/${imageId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      if (!res.ok) throw new Error("Failed to update caption");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shoot-briefs", projectId] });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const res = await fetch(`/api/shoot-brief-images/${imageId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed to delete image");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shoot-briefs", projectId] });
      toast({ title: "Image removed" });
    },
  });

  const handleFileUpload = useCallback((imageType: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      for (const file of Array.from(files)) {
        await uploadImageMutation.mutateAsync({ file, imageType });
      }
    };
    input.click();
  }, [uploadImageMutation]);

  const referenceImages = brief?.images?.filter(img => img.imageType === "reference") || [];
  const inspirationImages = brief?.images?.filter(img => img.imageType === "inspiration") || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {project?.clientName || "Loading..."}
            </h1>
            <div className="flex items-center gap-2">
              {project?.status && <Badge variant="secondary" className="text-xs">{project.status}</Badge>}
              {brief && (
                <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Brief Logged
                </Badge>
              )}
            </div>
          </div>
        </div>

        {briefLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse h-32" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <ImageSection
              title="Reference Images"
              subtitle="Photos from the shoot"
              icon={<Camera className="h-5 w-5 text-blue-500" />}
              images={referenceImages}
              imageType="reference"
              isAdmin={isAdmin}
              onUpload={() => handleFileUpload("reference")}
              onDeleteImage={(id) => deleteImageMutation.mutate(id)}
              onUpdateCaption={(imageId, caption) => updateCaptionMutation.mutate({ imageId, caption })}
              isUploading={uploadImageMutation.isPending}
            />

            <ImageSection
              title="Inspiration Images"
              subtitle="Mood board & references"
              icon={<Sparkles className="h-5 w-5 text-purple-500" />}
              images={inspirationImages}
              imageType="inspiration"
              isAdmin={isAdmin}
              onUpload={() => handleFileUpload("inspiration")}
              onDeleteImage={(id) => deleteImageMutation.mutate(id)}
              onUpdateCaption={(imageId, caption) => updateCaptionMutation.mutate({ imageId, caption })}
              isUploading={uploadImageMutation.isPending}
            />

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-base">Notes & Instructions</CardTitle>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Editing direction, style notes, special requests
                </p>
              </CardHeader>
              <CardContent>
                {isAdmin ? (
                  <div className="space-y-3">
                    <Textarea
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setNotesChanged(true);
                      }}
                      placeholder="e.g., warm skin tones, dreamy soft light, add balloons with AI, heavy skin retouch..."
                      className="min-h-[120px] text-base resize-none"
                    />
                    {notesChanged && (
                      <Button
                        onClick={() => updateNotesMutation.mutate(notes)}
                        disabled={updateNotesMutation.isPending}
                        className="w-full h-12 text-base"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 min-h-[80px]">
                    {brief?.notes ? (
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{brief.notes}</p>
                    ) : (
                      <p className="text-gray-400 dark:text-gray-500 italic">No notes added yet</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageSection({ title, subtitle, icon, images, imageType, isAdmin, onUpload, onDeleteImage, onUpdateCaption, isUploading }: {
  title: string;
  subtitle: string;
  icon: JSX.Element;
  images: ShootBriefImage[];
  imageType: string;
  isAdmin: boolean;
  onUpload: () => void;
  onDeleteImage: (id: string) => void;
  onUpdateCaption: (imageId: string, caption: string) => void;
  isUploading: boolean;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUpload}
              disabled={isUploading}
              className="h-9 px-3"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <Image className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {isAdmin ? "Tap 'Add' to upload images" : "No images added yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {images.map(img => (
              <BriefImageCard
                key={img.id}
                image={img}
                isAdmin={isAdmin}
                onDelete={() => onDeleteImage(img.id)}
                onUpdateCaption={(caption) => onUpdateCaption(img.id, caption)}
              />
            ))}
          </div>
        )}
        {isUploading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-500">
            <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Uploading...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BriefImageCard({ image, isAdmin, onDelete, onUpdateCaption }: {
  image: ShootBriefImage;
  isAdmin: boolean;
  onDelete: () => void;
  onUpdateCaption: (caption: string) => void;
}) {
  const [caption, setCaption] = useState(image.caption || "");
  const [captionEdited, setCaptionEdited] = useState(false);

  useEffect(() => {
    setCaption(image.caption || "");
    setCaptionEdited(false);
  }, [image.caption]);

  const imageUrl = image.storageKey;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
      <div className="relative">
        <img
          src={imageUrl}
          alt={image.caption || "Brief image"}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
        {isAdmin && (
          <button
            onClick={onDelete}
            className="absolute top-2 right-2 h-8 w-8 bg-red-500/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="p-3">
        {isAdmin ? (
          <div className="flex gap-2">
            <Input
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                setCaptionEdited(true);
              }}
              placeholder="Add a caption..."
              className="text-sm h-9 flex-1"
              onBlur={() => {
                if (captionEdited) {
                  onUpdateCaption(caption);
                  setCaptionEdited(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdateCaption(caption);
                  setCaptionEdited(false);
                }
              }}
            />
          </div>
        ) : (
          caption && <p className="text-sm text-gray-600 dark:text-gray-400">{caption}</p>
        )}
      </div>
    </div>
  );
}
