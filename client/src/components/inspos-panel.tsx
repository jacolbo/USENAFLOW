import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { queryClient } from "@/lib/queryClient";
import { getAdminHeaders } from "@/lib/adminAuth";
import { Pencil, Trash2, Loader2, Upload, Check, X, Plus, StickyNote } from "lucide-react";

export interface Inspo {
  id: string;
  projectId: string;
  kind: "photo" | "text";
  storageKey: string | null;
  caption: string | null;
  body: string | null;
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

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
}

const VIEW_ROLES = ["Admin", "DataWrangler", "Photographer", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "Evans"];

export function useInsposAllCounts(userRole: string, userId: string) {
  return useQuery<Record<string, number>>({
    queryKey: ["/api/inspos/all-counts"],
    queryFn: async () => {
      const r = await fetch(`/api/inspos/all-counts`, { headers: getAdminHeaders(userRole, userId) });
      if (!r.ok) return {};
      return r.json();
    },
    enabled: VIEW_ROLES.includes(userRole),
  });
}

export function InsposEditor({ projectId, userRole, userId, canEdit }: InsposEditorProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newText, setNewText] = useState("");
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

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "inspos"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "inspos-count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/inspos/all-counts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/today-shoots"] });
  };

  const { uploadFile } = useUpload({
    onError: (err) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const updateInspo = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<Inspo, "caption" | "body" | "sortOrder">> }) => {
      const r = await fetch(`/api/inspos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(updates),
      });
      if (!r.ok) throw new Error("Failed to update");
    },
    onSuccess: () => { setEditingId(null); invalidateAll(); },
  });

  const deleteInspo = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/inspos/${id}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: invalidateAll,
  });

  const addText = useMutation({
    mutationFn: async (body: string) => {
      const r = await fetch(`/api/projects/${projectId}/inspos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ kind: "text", body }),
      });
      if (!r.ok) throw new Error("Failed to add note");
    },
    onSuccess: () => { setNewText(""); invalidateAll(); },
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
      toast({ description: "Shoot plan saved" });
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const next: PendingFile[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      caption: "",
    }));
    setPending((prev) => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const updatePendingCaption = (id: string, caption: string) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
  };

  const submitPending = async () => {
    if (pending.length === 0) return;
    setSubmitting(true);
    let okCount = 0;
    for (const p of pending) {
      try {
        const resp = await uploadFile(p.file);
        if (!resp) throw new Error("Upload failed");
        const r = await fetch(`/api/projects/${projectId}/inspos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ kind: "photo", storageKey: resp.objectPath, caption: p.caption.trim() || null }),
        });
        if (!r.ok) throw new Error("Save failed");
        URL.revokeObjectURL(p.previewUrl);
        okCount++;
      } catch (err: any) {
        toast({ title: `Failed: ${p.file.name}`, description: err.message, variant: "destructive" });
      }
    }
    setPending((prev) => prev.slice(okCount));
    invalidateAll();
    if (okCount > 0) toast({ description: `Uploaded ${okCount} photo${okCount === 1 ? "" : "s"}` });
    setSubmitting(false);
  };

  if (dataQuery.isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const inspos = (dataQuery.data?.inspos || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      {/* Shoot Plan */}
      <div>
        <label className="text-sm font-medium mb-1 block">Shoot Plan / Overall Instructions</label>
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

      {/* Add controls (photos + quick text note) */}
      {canEdit && (
        <div className="border-2 border-dashed rounded-lg p-4 space-y-3 bg-muted/30">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFile}
            className="hidden"
            data-testid="input-inspo-file"
          />
          <div className="flex flex-wrap gap-2 items-start">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={submitting} data-testid="button-add-inspo-files">
              <Plus className="h-4 w-4 mr-2" />
              Add Photo(s)
            </Button>
            <div className="flex-1 min-w-[200px] flex gap-2">
              <Textarea
                placeholder="Add a quick note..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={1}
                className="min-h-[36px]"
                data-testid="textarea-inspo-new-note"
              />
              <Button onClick={() => newText.trim() && addText.mutate(newText.trim())} disabled={!newText.trim() || addText.isPending} data-testid="button-add-inspo-text">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map((p) => (
                <div key={p.id} className="flex gap-2 items-start border rounded-md p-2 bg-background" data-testid={`pending-inspo-${p.id}`}>
                  <img src={p.previewUrl} alt="" className="w-16 h-16 object-cover rounded" />
                  <Input
                    value={p.caption}
                    onChange={(e) => updatePendingCaption(p.id, e.target.value)}
                    placeholder="Caption for this photo (optional)"
                    className="flex-1"
                    data-testid={`input-pending-caption-${p.id}`}
                  />
                  <Button size="icon" variant="ghost" onClick={() => removePending(p.id)} disabled={submitting} aria-label="Remove">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-end">
                <Button onClick={submitPending} disabled={submitting} data-testid="button-upload-inspo">
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload {pending.length} Photo{pending.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unified mixed grid sorted by sortOrder */}
      {inspos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No inspos or notes yet</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="inspos-grid">
          {inspos.map((i) => (
            i.kind === "photo" ? (
              <div key={i.id} className="border rounded-lg overflow-hidden bg-card" data-testid={`inspo-${i.id}`}>
                <a href={i.storageKey || "#"} target="_blank" rel="noreferrer" className="block">
                  <img src={i.storageKey || ""} alt={i.caption || "Inspo"} className="w-full h-32 object-cover" />
                </a>
                <div className="p-2">
                  {editingId === i.id ? (
                    <div className="flex gap-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateInspo.mutate({ id: i.id, updates: { caption: editValue } })}>
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
                          <button onClick={() => { setEditingId(i.id); setEditValue(i.caption || ""); }} className="text-muted-foreground hover:text-foreground" data-testid={`button-edit-inspo-${i.id}`}>
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => { if (confirm("Delete this photo?")) deleteInspo.mutate(i.id); }} className="text-muted-foreground hover:text-destructive" data-testid={`button-delete-inspo-${i.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={i.id} className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 flex flex-col" data-testid={`inspo-text-${i.id}`}>
                {editingId === i.id ? (
                  <div className="space-y-2 flex-1">
                    <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={4} autoFocus />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => updateInspo.mutate({ id: i.id, updates: { body: editValue } })}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap flex-1">{i.body}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{i.uploadedBy}</span>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingId(i.id); setEditValue(i.body || ""); }} className="text-muted-foreground hover:text-foreground" data-testid={`button-edit-inspo-text-${i.id}`}>
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => { if (confirm("Delete this note?")) deleteInspo.mutate(i.id); }} className="text-muted-foreground hover:text-destructive" data-testid={`button-delete-inspo-text-${i.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
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
          <DialogTitle>Inspos & Notes{projectName ? ` — ${projectName}` : ""}</DialogTitle>
          <DialogDescription>Photos, notes, and the shoot plan for this project.</DialogDescription>
        </DialogHeader>
        <InsposEditor projectId={projectId} userRole={userRole} userId={userId} canEdit={!!canEdit} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact button with a count badge for use in row-style surfaces (task tables,
 * Shoot Tracker rows). Replaces the old WranglerNotesButton.
 */
export function InsposButton({ projectId, projectName, userRole, userId, count: countProp }: { projectId: string; projectName?: string; userRole: string; userId: string; count?: number }) {
  const [open, setOpen] = useState(false);
  const canEdit = ["Admin", "Photographer", "DataWrangler"].includes(userRole);
  const canView = VIEW_ROLES.includes(userRole);

  const allCountsQuery = useInsposAllCounts(userRole, userId);
  const count = countProp ?? allCountsQuery.data?.[projectId] ?? 0;

  if (!canView) return null;
  const has = count > 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`h-7 px-2 text-xs ${has ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700" : "text-gray-600 border-gray-300"}`}
        title={`Inspos & notes${has ? ` (${count})` : ""}`}
        data-testid={`button-inspos-${projectId}`}
      >
        <StickyNote className="h-3 w-3 mr-1" />
        Inspos / Notes
        {has && <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-green-600 text-white text-[10px]">{count}</span>}
      </Button>
      {open && (
        <InsposViewerDialog
          open={open}
          onOpenChange={setOpen}
          projectId={projectId}
          projectName={projectName}
          userRole={userRole}
          userId={userId}
          canEdit={canEdit}
        />
      )}
    </>
  );
}
