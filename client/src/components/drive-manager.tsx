import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { HardDrive, FolderPlus, RefreshCw, CheckCircle, AlertTriangle, ExternalLink, Cloud, Play, Square, Sparkles, Eye, Star, X, ImagePlus, Trash2, Camera } from "lucide-react";

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function DriveManager({ userRole, userId }: { userRole: string; userId: string }) {
  const { toast } = useToast();
  const [monitorRunning, setMonitorRunning] = useState(false);
  const [reviewingProjectId, setReviewingProjectId] = useState<string | null>(null);
  const [photoReview, setPhotoReview] = useState<any>(null);
  const [newRefUrl, setNewRefUrl] = useState("");

  const adminHeaders: Record<string, string> = {
    "x-usena-role": userRole,
    "x-usena-user-id": userId,
  };

  const adminFetch = async (url: string, method = "GET", body?: any) => {
    const headers: Record<string, string> = { ...adminHeaders };
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.json();
  };

  const { data: overview, isLoading: overviewLoading } = useQuery<any>({
    queryKey: ["/api/drive/overview", userRole, userId],
    queryFn: () => adminFetch("/api/drive/overview"),
  });

  const { data: connectionStatus, isLoading: connectionLoading } = useQuery<any>({
    queryKey: ["/api/drive/test", userRole, userId],
    queryFn: () => adminFetch("/api/drive/test"),
  });

  const scanMutation = useMutation({
    mutationFn: () => adminFetch("/api/drive/scan", "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive/overview", userRole, userId] });
      toast({ title: "Scan complete" });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const scanProjectMutation = useMutation({
    mutationFn: (projectId: string) => adminFetch(`/api/drive/scan/${projectId}`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive/overview", userRole, userId] });
      toast({ title: "Project scan complete" });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const startMonitorMutation = useMutation({
    mutationFn: () => adminFetch("/api/drive/monitor/start", "POST"),
    onSuccess: () => {
      setMonitorRunning(true);
      toast({ title: "Monitor started" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to start monitor", description: err.message, variant: "destructive" });
    },
  });

  const stopMonitorMutation = useMutation({
    mutationFn: () => adminFetch("/api/drive/monitor/stop", "POST"),
    onSuccess: () => {
      setMonitorRunning(false);
      toast({ title: "Monitor stopped" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to stop monitor", description: err.message, variant: "destructive" });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: (projectId: string) => adminFetch(`/api/drive/create-folder/${projectId}`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive/overview", userRole, userId] });
      toast({ title: "Folder created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create folder", description: err.message, variant: "destructive" });
    },
  });

  const createAllFoldersMutation = useMutation({
    mutationFn: (projectIds: string[]) =>
      adminFetch("/api/drive/create-folders-batch", "POST", { projectIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive/overview", userRole, userId] });
      toast({ title: "All folders created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create folders", description: err.message, variant: "destructive" });
    },
  });

  const reviewPhotosMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await adminFetch("/api/ai/review-photos", "POST", { projectId });
      return res;
    },
    onSuccess: (data) => {
      setPhotoReview(data);
      toast({ title: "Photo Review Complete", description: `Overall score: ${data.overallScore}/10` });
    },
    onError: (err: any) => {
      toast({ title: "Review Failed", description: err.message, variant: "destructive" });
    },
  });

  const isConnected = connectionStatus?.connected;
  const projects = overview?.projects || [];
  const projectsNeedingFolders = overview?.projectsNeedingFolders || [];
  const stats = overview?.stats || {};

  if (overviewLoading || connectionLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {isConnected ? (
                <Cloud className="h-5 w-5 text-green-500" />
              ) : (
                <Cloud className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm font-medium">Connection</span>
            </div>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            {connectionStatus?.email && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{connectionStatus.email}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">Drive Folders</span>
            </div>
            <p className="text-2xl font-bold">{stats.projectsWithFolders || 0}</p>
            <p className="text-xs text-muted-foreground">of {stats.totalProjects || 0} projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">Delivery Complete</span>
            </div>
            <p className="text-2xl font-bold">{stats.deliveryComplete || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium">Storage Used</span>
            </div>
            <p className="text-2xl font-bold">{formatBytes(stats.totalStorageUsed || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium">B&W Previews</span>
            </div>
            <p className="text-2xl font-bold">{stats.bwPreviewsSent || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${scanMutation.isPending ? "animate-spin" : ""}`} />
              {scanMutation.isPending ? "Scanning..." : "Scan All Folders"}
            </Button>

            {monitorRunning ? (
              <Button
                onClick={() => stopMonitorMutation.mutate()}
                disabled={stopMonitorMutation.isPending}
                variant="destructive"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Monitor
              </Button>
            ) : (
              <Button
                onClick={() => startMonitorMutation.mutate()}
                disabled={startMonitorMutation.isPending}
                variant="outline"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Monitor
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Projects with Drive Folders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No projects with Drive folders found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Client Name</th>
                    <th className="text-left py-2 px-3 font-medium">Photo Progress</th>
                    <th className="text-left py-2 px-3 font-medium">B&W Photos</th>
                    <th className="text-left py-2 px-3 font-medium">Storage</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Gallery</th>
                    <th className="text-left py-2 px-3 font-medium">Last Checked</th>
                    <th className="text-left py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project: any) => {
                    const driveCount = project.drivePhotoCount || 0;
                    const selectedCount = project.selectedCount || 0;
                    const progressPercent = selectedCount > 0 ? Math.min((driveCount / selectedCount) * 100, 100) : 0;
                    const isComplete = driveCount === selectedCount && selectedCount > 0;
                    const isOver = driveCount > selectedCount && selectedCount > 0;

                    let progressColor = "bg-yellow-500";
                    if (isComplete) progressColor = "bg-green-500";
                    if (isOver) progressColor = "bg-red-500";

                    return (
                      <tr key={project.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium">{project.clientName}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs whitespace-nowrap">
                              {driveCount} / {selectedCount}
                            </span>
                            <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${progressColor}`}
                                style={{ width: `${Math.min(progressPercent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3">{project.bwPhotoCount || 0}</td>
                        <td className="py-2 px-3">{formatBytes(project.storageUsed || 0)}</td>
                        <td className="py-2 px-3">
                          {isOver ? (
                            <Badge variant="destructive">Over</Badge>
                          ) : isComplete ? (
                            <Badge className="bg-green-500 hover:bg-green-600">Complete</Badge>
                          ) : (
                            <Badge variant="secondary">Incomplete</Badge>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {project.galleryLink ? (
                            <a
                              href={project.galleryLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {formatDate(project.lastChecked)}
                        </td>
                        <td className="py-2 px-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReviewingProjectId(project.id);
                              reviewPhotosMutation.mutate(project.id);
                            }}
                            disabled={reviewPhotosMutation.isPending}
                            title="AI Photo Review"
                          >
                            <Eye className={`h-3 w-3 ${reviewPhotosMutation.isPending && reviewingProjectId === project.id ? "animate-pulse" : ""}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => scanProjectMutation.mutate(project.id)}
                            disabled={scanProjectMutation.isPending}
                          >
                            <RefreshCw className={`h-3 w-3 ${scanProjectMutation.isPending ? "animate-spin" : ""}`} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {projectsNeedingFolders.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderPlus className="h-5 w-5" />
                Projects Needing Folders
              </CardTitle>
              <Button
                onClick={() =>
                  createAllFoldersMutation.mutate(
                    projectsNeedingFolders.map((p: any) => p.id)
                  )
                }
                disabled={createAllFoldersMutation.isPending}
                size="sm"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                {createAllFoldersMutation.isPending ? "Creating..." : "Create All Folders"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projectsNeedingFolders.map((project: any) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">{project.clientName}</p>
                    {project.shootDate && (
                      <p className="text-xs text-muted-foreground">
                        Shoot: {new Date(project.shootDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createFolderMutation.mutate(project.id)}
                    disabled={createFolderMutation.isPending}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Create Folder
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {photoReview && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Photo Review — {photoReview.projectName}
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-lg">{photoReview.overallScore}/10</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPhotoReview(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{photoReview.photosReviewed} photos reviewed</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">General Feedback</h4>
                <ul className="space-y-1">
                  {photoReview.feedback?.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 mt-2 rounded-full bg-purple-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {photoReview.details && photoReview.details.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Per-Photo Details</h4>
                  <div className="space-y-2">
                    {photoReview.details.map((d: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-1 min-w-[60px]">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-medium">{d.score}/10</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{d.photo}</p>
                          <p className="text-xs text-muted-foreground">{d.notes}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-right">
                Reviewed {new Date(photoReview.generatedAt).toLocaleTimeString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {userRole === "Admin" && <ReferenceImagesSection adminFetch={adminFetch} newRefUrl={newRefUrl} setNewRefUrl={setNewRefUrl} />}
    </div>
  );
}

function ReferenceImagesSection({ adminFetch, newRefUrl, setNewRefUrl }: { adminFetch: (url: string, method?: string, body?: any) => Promise<any>; newRefUrl: string; setNewRefUrl: (v: string) => void }) {
  const { toast } = useToast();

  const refImagesQuery = useQuery({
    queryKey: ["/api/quality-reference-images"],
    queryFn: async () => {
      const data = await adminFetch("/api/quality-reference-images");
      return data.images as string[];
    },
  });

  const addRefImage = useMutation({
    mutationFn: async (url: string) => {
      return adminFetch("/api/quality-reference-images/add", "POST", { url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quality-reference-images"] });
      setNewRefUrl("");
      toast({ title: "Reference image added" });
    },
  });

  const removeRefImage = useMutation({
    mutationFn: async (url: string) => {
      return adminFetch("/api/quality-reference-images", "DELETE", { url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quality-reference-images"] });
      toast({ title: "Reference image removed" });
    },
  });

  const images = refImagesQuery.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Camera className="h-5 w-5 text-pink-500" />
          Quality Reference Images
          <Badge variant="outline" className="ml-2">{images.length} images</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add Instagram or portfolio image URLs here. The AI Quality Gate will use these as the benchmark standard when reviewing project photos.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="Paste Instagram or image URL..."
            value={newRefUrl}
            onChange={(e) => setNewRefUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newRefUrl.trim()) {
                addRefImage.mutate(newRefUrl.trim());
              }
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              if (newRefUrl.trim()) {
                addRefImage.mutate(newRefUrl.trim());
              }
            }}
            disabled={!newRefUrl.trim() || addRefImage.isPending}
          >
            <ImagePlus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((url: string, i: number) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border">
                <img
                  src={url}
                  alt={`Reference ${i + 1}`}
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%23999' font-size='12'%3ENo preview%3C/text%3E%3C/svg%3E";
                  }}
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeRefImage.mutate(url)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                  <p className="text-xs text-white truncate">{url.split('/').pop()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {images.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No reference images yet</p>
            <p className="text-xs">Add your best Instagram photos as quality benchmarks</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
