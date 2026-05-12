import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { queryClient } from "@/lib/queryClient";
import { getAdminHeaders } from "@/lib/adminAuth";
import { Camera, Pencil, Trash2, Loader2, Upload, Check, X } from "lucide-react";

export interface Inspo {
  id: string;
  projectId: string;
  storageKey: string;
  caption: string | null;
  sortOrder: number;
  uploadedBy: string;
  createdAt: string;
}

interface InsposEditorProps {
  projectId: string;
  userRole: string;
  userId: string;
  canEdit: boolean;
}

export function InsposEditor({ projectId, userRole, userId, canEdit }: InsposEditorProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingCaption, setPendingCaption] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState("");
  const [instructions, setInstructions] = useState<string>("");
  const [instructionsLoaded, setInstructionsLoaded] = useState(false);

  const headers = getAdminHeaders(userRole, userId);

  const dataQuery = useQuery<{ inspos: Inspo[]; overallInstructions: string }>({
    queryKey: ["/api/projects", projectId, "inspos"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/inspos`, { headers });
      if (!res.ok) throw new Error("Failed to load inspos");
      const data = await res.json();
      if (!instructionsLoaded) {
        setInstructions(data.overallInstructions || "");
        setInstructionsLoaded(true);
      }
      return data;
    },
  });

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (resp) => {
      try {
        const r = await fetch(`/api/projects/${projectId}/inspos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ storageKey: resp.objectPath, caption: pendingCaption || null }),
        });
        if (!r.ok) throw new Error("Failed to save inspo");
        setPendingCaption("");
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "inspos"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "inspos-count"] });
        queryClient.invalidateQueries({ queryKey: ["/api/today-shoots"] });
        toast({ description: "Inspo uploaded" });
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
    onError: (err) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const updateCaption = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const r = await fetch(`/api/inspos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ caption }),
      });
      if (!r.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "inspos"] });
    },
  });

  const deleteInspo = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/inspos/${id}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "inspos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "inspos-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/today-shoots"] });
    },
  });

  const saveInstructions = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch(`/api/projects/${projectId}/inspo-meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ overallInstructions: text }),
      });
      if (!r.ok) throw new Error("Failed to save instructions");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "inspos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "inspos-count"] });
      toast({ description: "Instructions saved" });
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      await uploadFile(f);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  if (dataQuery.isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const inspos = dataQuery.data?.inspos || [];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Overall Instructions</label>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onBlur={() => {
            if (canEdit && instructions !== (dataQuery.data?.overallInstructions || "")) {
              saveInstructions.mutate(instructions);
            }
          }}
          placeholder="Notes for the whole shoot..."
          disabled={!canEdit}
          rows={3}
          data-testid="textarea-overall-instructions"
        />
      </div>

      {canEdit && (
        <div className="border-2 border-dashed rounded-lg p-4 space-y-3 bg-muted/30">
          <Input
            placeholder="Caption for next upload (optional)"
            value={pendingCaption}
            onChange={(e) => setPendingCaption(e.target.value)}
            data-testid="input-pending-caption"
          />
          <div className="flex justify-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFile}
              className="hidden"
              data-testid="input-inspo-file"
            />
            <Button onClick={() => fileRef.current?.click()} disabled={isUploading} data-testid="button-upload-inspo">
              {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Inspo Photo(s)
            </Button>
          </div>
        </div>
      )}

      {inspos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Camera className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No inspos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {inspos.map((i) => (
            <div key={i.id} className="border rounded-lg overflow-hidden bg-card" data-testid={`inspo-${i.id}`}>
              <a href={i.storageKey} target="_blank" rel="noreferrer" className="block">
                <img src={i.storageKey} alt={i.caption || "Inspo"} className="w-full h-32 object-cover" />
              </a>
              <div className="p-2 space-y-1">
                {editingId === i.id ? (
                  <div className="flex gap-1">
                    <Input
                      value={editingCaption}
                      onChange={(e) => setEditingCaption(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateCaption.mutate({ id: i.id, caption: editingCaption })}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <p className="text-xs text-muted-foreground flex-1 break-words">{i.caption || <span className="italic">no caption</span>}</p>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => { setEditingId(i.id); setEditingCaption(i.caption || ""); }}
                          className="text-muted-foreground hover:text-foreground"
                          data-testid={`button-edit-inspo-${i.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this inspo?")) deleteInspo.mutate(i.id); }}
                          className="text-muted-foreground hover:text-destructive"
                          data-testid={`button-delete-inspo-${i.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface InsposViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  userRole: string;
  userId: string;
  canEdit?: boolean;
}

export function InsposViewerDialog({ open, onOpenChange, projectId, projectName, userRole, userId, canEdit }: InsposViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-inspos">
        <DialogHeader>
          <DialogTitle>Photographer Inspos{projectName ? ` — ${projectName}` : ""}</DialogTitle>
          <DialogDescription>Visual references and instructions from the photographer.</DialogDescription>
        </DialogHeader>
        <InsposEditor projectId={projectId} userRole={userRole} userId={userId} canEdit={!!canEdit} />
      </DialogContent>
    </Dialog>
  );
}
