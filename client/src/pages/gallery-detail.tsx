import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getAdminHeaders } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Camera, Copy, Check, ExternalLink, Plus, Trash2,
  Upload, Loader2, Heart, Download, FileDown, Eye, EyeOff,
  Settings as SettingsIcon, Image, FolderOpen, ChevronDown,
} from "lucide-react";

interface GalleryDetail {
  id: string;
  name: string;
  slug: string;
  password: string | null;
  downloadPin: string | null;
  status: string;
  coverImageKey: string | null;
  settings: Record<string, boolean | string | number | null> | null;
  expiresAt: string | null;
  publishedAt: string | null;
  projectId: string | null;
  sets: Array<{ id: string; name: string; sortOrder: number; photoCount: number }>;
  totalPhotos: number;
}

interface GalleryPhoto {
  id: string;
  setId: string;
  filename: string;
  storageKey: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

interface FavList {
  id: string;
  clientEmail: string;
  name: string;
  isSubmitted: boolean;
  submittedAt: string | null;
  selectionCount: number;
  createdAt: string;
}

interface DownloadRecord {
  id: string;
  clientEmail: string;
  downloadType: string;
  downloadSize: string;
  createdAt: string;
}

export default function GalleryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("photos");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [showAddSet, setShowAddSet] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activitySubTab, setActivitySubTab] = useState<"favorites" | "downloads">("favorites");
  const [expandedFavList, setExpandedFavList] = useState<string | null>(null);

  const role = localStorage.getItem("usena_role") || "";
  const userId = localStorage.getItem("usena_user_id") || "";
  const headers = getAdminHeaders(role, userId);

  const { data: gallery, isLoading } = useQuery<GalleryDetail>({
    queryKey: ["/api/galleries", id],
    queryFn: async () => {
      const res = await fetch(`/api/galleries/${id}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch gallery");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: photos = [] } = useQuery<GalleryPhoto[]>({
    queryKey: ["/api/galleries", id, "photos"],
    queryFn: async () => {
      const res = await fetch(`/api/galleries/${id}/photos`, { headers });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: signedUrls = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/galleries", id, "signed-urls"],
    queryFn: async () => {
      const res = await fetch(`/api/galleries/${id}/photos/signed-urls`, { headers });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!id && photos.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  const { data: favLists = [] } = useQuery<FavList[]>({
    queryKey: ["/api/galleries", id, "activity", "favorites"],
    queryFn: async () => {
      const res = await fetch(`/api/galleries/${id}/activity/favorites`, { headers });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!id && activeTab === "activity",
  });

  const { data: downloads = [] } = useQuery<DownloadRecord[]>({
    queryKey: ["/api/galleries", id, "activity", "downloads"],
    queryFn: async () => {
      const res = await fetch(`/api/galleries/${id}/activity/downloads`, { headers });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!id && activeTab === "activity" && activitySubTab === "downloads",
  });

  const { data: favListDetail } = useQuery<{ selections: Array<{ selectionId: string; filename: string; setName: string; note: string | null }> }>({
    queryKey: ["/api/galleries", id, "activity", "favorites", expandedFavList],
    queryFn: async () => {
      const res = await fetch(`/api/galleries/${id}/activity/favorites/${expandedFavList}`, { headers });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!expandedFavList,
  });

  const publishMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const res = await fetch(`/api/galleries/${id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ publish }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/galleries", id] });
      toast({ title: "Gallery updated" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/galleries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/galleries", id] });
      toast({ title: "Settings saved" });
    },
  });

  const addSetMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/galleries/${id}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/galleries", id] });
      setShowAddSet(false);
      setNewSetName("");
      toast({ title: "Set added" });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetch(`/api/galleries/${id}/photos/${photoId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/galleries", id, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/galleries", id] });
    },
  });

  const handleUpload = async (files: FileList, setId: string) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const urlRes = await fetch(`/api/galleries/${id}/photos/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ count: files.length }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URLs");
      const { urls } = await urlRes.json();

      const photosToRegister: Array<{ setId: string; filename: string; storageKey: string; fileSize: number }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { uploadUrl, storageKey } = urls[i];

        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        photosToRegister.push({
          setId,
          filename: file.name,
          storageKey,
          fileSize: file.size,
        });
      }

      await fetch(`/api/galleries/${id}/photos/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ photos: photosToRegister }),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/galleries", id, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/galleries", id] });
      toast({ title: "Photos uploaded", description: `${files.length} photo(s) added` });
    } catch (e: unknown) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const exportCsv = async (listId: string) => {
    try {
      const res = await fetch(`/api/galleries/${id}/activity/favorites/${listId}/export`, { headers });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `favorites-${listId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "Could not download CSV", variant: "destructive" });
    }
  };

  if (isLoading || !gallery) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const currentSetId = selectedSetId || (gallery.sets.length > 0 ? gallery.sets[0].id : null);
  const filteredPhotos = currentSetId ? photos.filter((p) => p.setId === currentSetId) : photos;
  const galleryUrl = `${window.location.origin}/g/${gallery.slug}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/galleries")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Galleries
          </Button>
          <h1 className="text-xl font-bold text-gray-900">{gallery.name}</h1>
          <Badge variant="secondary" className={gallery.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
            {gallery.status}
          </Badge>
          {gallery.projectId && (
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              <FolderOpen className="h-3 w-3 mr-1" /> Linked Project
            </Badge>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">URL: </span>
                <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{galleryUrl}</code>
                <Button variant="ghost" size="sm" className="ml-1 h-6 w-6 p-0" onClick={() => copyToClipboard(galleryUrl, "url")}>
                  {copiedField === "url" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              {gallery.password && (
                <div>
                  <span className="text-gray-500">Password: </span>
                  <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{gallery.password}</code>
                  <Button variant="ghost" size="sm" className="ml-1 h-6 w-6 p-0" onClick={() => copyToClipboard(gallery.password!, "pw")}>
                    {copiedField === "pw" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              )}
              {gallery.downloadPin && (
                <div>
                  <span className="text-gray-500">PIN: </span>
                  <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{gallery.downloadPin}</code>
                  <Button variant="ghost" size="sm" className="ml-1 h-6 w-6 p-0" onClick={() => copyToClipboard(gallery.downloadPin!, "pin")}>
                    {copiedField === "pin" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{gallery.status === "published" ? "Published" : "Unpublished"}</span>
              <Switch
                checked={gallery.status === "published"}
                onCheckedChange={(checked) => publishMutation.mutate(checked)}
              />
              <Button variant="outline" size="sm" asChild>
                <a href={galleryUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview
                </a>
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="photos" className="flex items-center gap-1.5">
              <Camera className="h-4 w-4" /> Photos ({gallery.totalPhotos})
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5">
              <SettingsIcon className="h-4 w-4" /> Settings
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1.5">
              <Heart className="h-4 w-4" /> Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="mt-4">
            <div className="flex gap-6">
              <div className="w-48 flex-shrink-0 space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Sets</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowAddSet(true)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {gallery.sets.map((set) => (
                  <button
                    key={set.id}
                    className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                      currentSetId === set.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                    }`}
                    onClick={() => setSelectedSetId(set.id)}
                  >
                    <span className="truncate">{set.name}</span>
                    <span className="text-xs text-gray-400">{set.photoCount}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-700">
                    {gallery.sets.find((s) => s.id === currentSetId)?.name || "All Photos"} ({filteredPhotos.length})
                  </h3>
                  {currentSetId && (
                    <div>
                      <input
                        type="file"
                        id="photo-upload"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && currentSetId) handleUpload(e.target.files, currentSetId);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => document.getElementById("photo-upload")?.click()}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                        Add Media
                      </Button>
                    </div>
                  )}
                </div>

                {filteredPhotos.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No photos in this set yet.</p>
                    <p className="text-sm">Click "Add Media" to upload.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredPhotos.map((photo) => (
                      <div key={photo.id} className="group relative aspect-square bg-gray-100 rounded overflow-hidden">
                        <img
                          src={signedUrls[photo.id] || ""}
                          alt={photo.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (confirm("Delete this photo?")) deletePhotoMutation.mutate(photo.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs text-white truncate">{photo.filename}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <SettingsTab gallery={gallery} onSave={(data) => updateMutation.mutate(data)} saving={updateMutation.isPending} />
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <div className="flex gap-3 mb-4">
              <Button
                variant={activitySubTab === "favorites" ? "default" : "outline"}
                size="sm"
                onClick={() => setActivitySubTab("favorites")}
              >
                <Heart className="h-4 w-4 mr-1" /> Favourites
              </Button>
              <Button
                variant={activitySubTab === "downloads" ? "default" : "outline"}
                size="sm"
                onClick={() => setActivitySubTab("downloads")}
              >
                <Download className="h-4 w-4 mr-1" /> Downloads
              </Button>
            </div>

            {activitySubTab === "favorites" && (
              <div className="space-y-3">
                {favLists.length === 0 ? (
                  <p className="text-center py-8 text-gray-400">No favourite activity yet.</p>
                ) : (
                  favLists.map((list) => (
                    <div key={list.id} className="bg-white border rounded-lg">
                      <div
                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedFavList(expandedFavList === list.id ? null : list.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Heart className={`h-4 w-4 ${list.isSubmitted ? "text-pink-500 fill-pink-500" : "text-gray-400"}`} />
                          <div>
                            <span className="font-medium text-sm">{list.clientEmail}</span>
                            <span className="text-xs text-gray-500 ml-2">{list.selectionCount} selections</span>
                          </div>
                          {list.isSubmitted && <Badge className="bg-green-100 text-green-700 text-xs">Submitted</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); exportCsv(list.id); }}>
                            <FileDown className="h-4 w-4 mr-1" /> CSV
                          </Button>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedFavList === list.id ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                      {expandedFavList === list.id && favListDetail && (
                        <div className="border-t px-4 py-3">
                          <div className="space-y-1 max-h-60 overflow-y-auto">
                            {favListDetail.selections?.map((sel) => (
                              <div key={sel.selectionId} className="flex items-center justify-between text-sm py-1">
                                <div>
                                  <span className="font-mono text-xs">{sel.filename}</span>
                                  <span className="text-gray-400 ml-2 text-xs">{sel.setName}</span>
                                </div>
                                {sel.note && <span className="text-xs text-gray-500 italic">"{sel.note}"</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activitySubTab === "downloads" && (
              <div className="space-y-2">
                {downloads.length === 0 ? (
                  <p className="text-center py-8 text-gray-400">No downloads yet.</p>
                ) : (
                  <div className="bg-white rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Size</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {downloads.map((dl) => (
                          <tr key={dl.id} className="border-b last:border-0">
                            <td className="px-4 py-2">{dl.clientEmail}</td>
                            <td className="px-4 py-2">{dl.downloadType}</td>
                            <td className="px-4 py-2">{dl.downloadSize}</td>
                            <td className="px-4 py-2 text-gray-500">{new Date(dl.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddSet} onOpenChange={setShowAddSet}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Set</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Set Name</Label>
              <Input
                placeholder="e.g. Ceremony, Reception..."
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!newSetName.trim() || addSetMutation.isPending}
              onClick={() => addSetMutation.mutate(newSetName.trim())}
            >
              {addSetMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Set
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface GallerySettingsPayload {
  slug: string;
  password: string | null;
  downloadPin: string | null;
  expiresAt: string | null;
  settings: Record<string, boolean | string | number | string[] | null>;
}

const DOWNLOAD_SIZE_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "high", label: "High (3000px)" },
  { value: "medium", label: "Medium (1600px)" },
  { value: "low", label: "Low (800px)" },
  { value: "web", label: "Web (1200px)" },
] as const;

const SLIDESHOW_SPEED_OPTIONS = [
  { value: "slow", label: "Slow (6s)" },
  { value: "medium", label: "Medium (4s)" },
  { value: "fast", label: "Fast (2s)" },
] as const;

function SettingsTab({ gallery, onSave, saving }: { gallery: GalleryDetail; onSave: (data: GallerySettingsPayload) => void; saving: boolean }) {
  const settings = gallery.settings || {};
  const [slug, setSlug] = useState(gallery.slug);
  const [password, setPassword] = useState(gallery.password || "");
  const [downloadPin, setDownloadPin] = useState(gallery.downloadPin || "");
  const [downloadEnabled, setDownloadEnabled] = useState(settings.downloadEnabled ?? true);
  const [favoritesEnabled, setFavoritesEnabled] = useState(settings.favoritesEnabled ?? true);
  const [favoriteNotesEnabled, setFavoriteNotesEnabled] = useState(settings.favoriteNotesEnabled ?? true);
  const [filenameDisplay, setFilenameDisplay] = useState(settings.filenameDisplay ?? true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(settings.watermarkEnabled ?? true);
  const [gridStyle, setGridStyle] = useState((settings.gridStyle as string) || "vertical");
  const [selectionLimit, setSelectionLimit] = useState(settings.selectionLimit?.toString() || "");
  const [rightClickProtection, setRightClickProtection] = useState(settings.rightClickProtection ?? true);
  const [expiresAt, setExpiresAt] = useState(gallery.expiresAt ? gallery.expiresAt.split("T")[0] : "");
  const downloadSizesRaw = settings.downloadSizes;
  const initialDownloadSizes = Array.isArray(downloadSizesRaw) ? (downloadSizesRaw as string[]) : ["original"];
  const [downloadSizes, setDownloadSizes] = useState<string[]>(initialDownloadSizes);
  const [slideshowEnabled, setSlideshowEnabled] = useState(settings.slideshowEnabled ?? false);
  const [slideshowSpeed, setSlideshowSpeed] = useState((settings.slideshowSpeed as string) || "medium");
  const [displayTheme, setDisplayTheme] = useState((settings.displayTheme as string) || "light");

  const toggleDownloadSize = (size: string) => {
    setDownloadSizes((prev) => {
      if (prev.includes(size)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== size);
      }
      return [...prev, size];
    });
  };

  const handleSave = () => {
    onSave({
      slug,
      password: password || null,
      downloadPin: downloadPin || null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      settings: {
        ...settings,
        downloadEnabled,
        favoritesEnabled,
        favoriteNotesEnabled,
        filenameDisplay,
        watermarkEnabled,
        gridStyle,
        selectionLimit: selectionLimit ? parseInt(selectionLimit) : null,
        rightClickProtection,
        downloadSizes,
        slideshowEnabled,
        slideshowSpeed,
        displayTheme,
      },
    });
  };

  return (
    <div className="bg-white rounded-lg border p-6 space-y-6 max-w-2xl">
      <div>
        <Label>Gallery Slug</Label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        <p className="text-xs text-gray-400 mt-1">Used in the gallery URL: /g/{slug}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Password</Label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for no password" />
        </div>
        <div>
          <Label>Download PIN</Label>
          <Input value={downloadPin} onChange={(e) => setDownloadPin(e.target.value)} placeholder="4-digit PIN" />
        </div>
      </div>

      <div>
        <Label>Expiry Date</Label>
        <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </div>

      <div className="space-y-4 border-t pt-4">
        <h3 className="font-semibold text-sm text-gray-700">Downloads</h3>
        <div className="flex items-center justify-between">
          <Label>Enable Downloads</Label>
          <Switch checked={downloadEnabled as boolean} onCheckedChange={(v) => setDownloadEnabled(v)} />
        </div>
        {downloadEnabled && (
          <div>
            <Label>Download Sizes</Label>
            <p className="text-xs text-gray-400 mb-2">Select which sizes clients can download. At least one must be selected.</p>
            <div className="flex flex-wrap gap-2">
              {DOWNLOAD_SIZE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={downloadSizes.includes(opt.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDownloadSize(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t pt-4">
        <h3 className="font-semibold text-sm text-gray-700">Favourites</h3>
        <div className="flex items-center justify-between">
          <Label>Enable Favourites</Label>
          <Switch checked={favoritesEnabled as boolean} onCheckedChange={(v) => setFavoritesEnabled(v)} />
        </div>
        {favoritesEnabled && (
          <>
            <div className="flex items-center justify-between">
              <Label>Favourite Notes</Label>
              <Switch checked={favoriteNotesEnabled as boolean} onCheckedChange={(v) => setFavoriteNotesEnabled(v)} />
            </div>
            <div>
              <Label>Selection Limit</Label>
              <Input
                type="number"
                value={selectionLimit}
                onChange={(e) => setSelectionLimit(e.target.value)}
                placeholder="No limit"
                min="1"
              />
              <p className="text-xs text-gray-400 mt-1">Max number of photos a client can favourite. Leave empty for unlimited.</p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4 border-t pt-4">
        <h3 className="font-semibold text-sm text-gray-700">Display</h3>
        <div className="flex items-center justify-between">
          <Label>Show Filenames</Label>
          <Switch checked={filenameDisplay as boolean} onCheckedChange={(v) => setFilenameDisplay(v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Watermark</Label>
          <Switch checked={watermarkEnabled as boolean} onCheckedChange={(v) => setWatermarkEnabled(v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Right-Click Protection</Label>
          <Switch checked={rightClickProtection as boolean} onCheckedChange={(v) => setRightClickProtection(v)} />
        </div>
        <div>
          <Label>Display Theme</Label>
          <div className="flex gap-2 mt-1">
            {[{ v: "light", l: "Light" }, { v: "dark", l: "Dark" }, { v: "minimal", l: "Minimal" }].map(({ v, l }) => (
              <Button
                key={v}
                variant={displayTheme === v ? "default" : "outline"}
                size="sm"
                onClick={() => setDisplayTheme(v)}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label>Grid Style</Label>
          <div className="flex gap-2 mt-1">
            {["vertical", "horizontal", "square"].map((style) => (
              <Button
                key={style}
                variant={gridStyle === style ? "default" : "outline"}
                size="sm"
                onClick={() => setGridStyle(style)}
                className="capitalize"
              >
                {style}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <h3 className="font-semibold text-sm text-gray-700">Slideshow</h3>
        <div className="flex items-center justify-between">
          <Label>Enable Slideshow</Label>
          <Switch checked={slideshowEnabled as boolean} onCheckedChange={(v) => setSlideshowEnabled(v)} />
        </div>
        {slideshowEnabled && (
          <div>
            <Label>Slideshow Speed</Label>
            <div className="flex gap-2 mt-1">
              {SLIDESHOW_SPEED_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={slideshowSpeed === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSlideshowSpeed(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Save Settings
      </Button>
    </div>
  );
}
