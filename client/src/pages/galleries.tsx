import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdminHeaders } from "@/lib/adminAuth";
import { Image, Plus, Search, ArrowLeft, Camera, Heart, Eye, EyeOff, Loader2 } from "lucide-react";
import type { Project } from "@shared/schema";

interface GalleryListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  coverImageKey: string | null;
  photoCount: number;
  favListCount: number;
  createdAt: string;
  publishedAt: string | null;
  projectId: string | null;
}

export default function GalleriesPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const role = localStorage.getItem("usena_role") || "";
  const userId = localStorage.getItem("usena_user_id") || "";

  const { data: galleries = [], isLoading } = useQuery<GalleryListItem[]>({
    queryKey: ["/api/galleries"],
    queryFn: async () => {
      const res = await fetch("/api/galleries", { headers: getAdminHeaders(role, userId) });
      if (!res.ok) throw new Error("Failed to fetch galleries");
      return res.json();
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; projectId?: string }) => {
      const res = await fetch("/api/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders(role, userId) },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create gallery");
      return res.json();
    },
    onSuccess: (gallery) => {
      queryClient.invalidateQueries({ queryKey: ["/api/galleries"] });
      setShowNewDialog(false);
      setNewName("");
      setNewProjectId("");
      toast({ title: "Gallery created", description: `"${gallery.name}" is ready to set up.` });
      setLocation(`/galleries/${gallery.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create gallery", variant: "destructive" });
    },
  });

  const filtered = galleries.filter(
    (g) => g.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    published: "bg-green-100 text-green-700",
    hidden: "bg-yellow-100 text-yellow-700",
    expired: "bg-red-100 text-red-700",
  };

  if (role === "Finance") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">You do not have access to galleries.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Image className="h-6 w-6" /> Galleries
            </h1>
          </div>
          <Button onClick={() => setShowNewDialog(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Collection
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search galleries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No galleries yet</p>
            <p className="text-sm">Create your first collection to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((gallery) => (
              <div
                key={gallery.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setLocation(`/galleries/${gallery.id}`)}
              >
                <div className="aspect-[16/10] bg-gray-100 flex items-center justify-center">
                  {gallery.coverImageKey ? (
                    <img
                      src={`/api/galleries/${gallery.id}/cover`}
                      alt={gallery.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="h-10 w-10 text-gray-300" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{gallery.name}</h3>
                    <Badge variant="secondary" className={statusColors[gallery.status] || ""}>
                      {gallery.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Camera className="h-3.5 w-3.5" /> {gallery.photoCount} photos
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" /> {gallery.favListCount} lists
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Gallery Name</Label>
              <Input
                placeholder="e.g. Smith Wedding"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <Label>Link to Project (optional)</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name: newName.trim(),
                  projectId: newProjectId && newProjectId !== "none" ? newProjectId : undefined,
                })
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Gallery
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
