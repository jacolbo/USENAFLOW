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
import { Pencil, Trash2, Loader2, Upload, Check, X, Plus, MessageSquare, Image as ImageIcon } from "lucide-react";

export interface WranglerNote {
  id: string;
  projectId: string;
  kind: "photo" | "text";
  storageKey: string | null;
  caption: string | null;
  body: string | null;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  userRole: string;
  userId: string;
  canEdit: boolean;
}

const VIEW_ROLES = ["Admin", "DataWrangler", "Photographer", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "Evans"];

export function useWranglerNotesAllCounts(userRole: string, userId: string) {
  return useQuery<Record<string, number>>({
    queryKey: ["/api/wrangler-notes/all-counts"],
    queryFn: async () => {
      const r = await fetch(`/api/wrangler-notes/all-counts`, { headers: getAdminHeaders(userRole, userId) });
      if (!r.ok) return {};
      return r.json();
    },
    enabled: VIEW_ROLES.includes(userRole),
  });
}

export function WranglerNotesDialog({ open, onOpenChange, projectId, projectName, userRole, userId, canEdit }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingCaption, setPendingCaption] = useState("");
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const headers = getAdminHeaders(userRole, userId);

  const notesQuery = useQuery<WranglerNote[]>({
    queryKey: ["/api/projects", projectId, "wrangler-notes"],
    queryFn: async () => {
      const r = await fetch(`/api/projects/${projectId}/wrangler-notes`, { headers });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    enabled: open,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "wrangler-notes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "wrangler-notes-count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wrangler-notes/all-counts"] });
  };

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (resp) => {
      try {
        const r = await fetch(`/api/projects/${projectId}/wrangler-notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ kind: "photo", storageKey: resp.objectPath, caption: pendingCaption || null }),
        });
        if (!r.ok) throw new Error("Failed to save photo note");
        setPendingCaption("");
        invalidateAll();
        toast({ description: "Photo note added" });
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
    onError: (err) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const addText = useMutation({
    mutationFn: async (body: string) => {
      const r = await fetch(`/api/projects/${projectId}/wrangler-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ kind: "text", body }),
      });
      if (!r.ok) throw new Error("Failed to add note");
    },
    onSuccess: () => {
      setNewText("");
      invalidateAll();
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<WranglerNote, "caption" | "body" | "sortOrder">> }) => {
      const r = await fetch(`/api/wrangler-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(updates),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => { setEditingId(null); invalidateAll(); },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/wrangler-notes/${id}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: invalidateAll,
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) await uploadFile(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const notes = notesQuery.data || [];
  const photos = notes.filter(n => n.kind === "photo");
  const texts = notes.filter(n => n.kind === "text");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-wrangler-notes">
        <DialogHeader>
          <DialogTitle>Wrangler Notes{projectName ? ` — ${projectName}` : ""}</DialogTitle>
          <DialogDescription>Selection-time photos and notes from the Data Wrangler.</DialogDescription>
        </DialogHeader>

        {notesQuery.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {/* Photos section */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Photos ({photos.length})
              </h3>
              {canEdit && (
                <div className="border-2 border-dashed rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
                  <Input
                    placeholder="Caption for next photo (optional)"
                    value={pendingCaption}
                    onChange={(e) => setPendingCaption(e.target.value)}
                    data-testid="input-wn-caption"
                  />
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} className="hidden" />
                  <Button size="sm" onClick={() => fileRef.current?.click()} disabled={isUploading} data-testid="button-wn-upload">
                    {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Upload Photo(s)
                  </Button>
                </div>
              )}
              {photos.length === 0 ? (
                <p className="text-xs text-muted-foreground">No photo notes yet.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {photos.map(p => (
                    <div key={p.id} className="border rounded-lg overflow-hidden bg-card" data-testid={`wn-photo-${p.id}`}>
                      <a href={p.storageKey || "#"} target="_blank" rel="noreferrer">
                        <img src={p.storageKey || ""} alt={p.caption || ""} className="w-full h-28 object-cover" />
                      </a>
                      <div className="p-2">
                        {editingId === p.id ? (
                          <div className="flex gap-1">
                            <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 text-xs" autoFocus />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateNote.mutate({ id: p.id, updates: { caption: editValue } })}>
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1">
                            <p className="text-xs text-muted-foreground flex-1 break-words">{p.caption || <span className="italic">no caption</span>}</p>
                            {canEdit && (
                              <>
                                <button onClick={() => { setEditingId(p.id); setEditValue(p.caption || ""); }} className="text-muted-foreground hover:text-foreground">
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button onClick={() => { if (confirm("Delete this photo note?")) deleteNote.mutate(p.id); }} className="text-muted-foreground hover:text-destructive">
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
            </section>

            {/* Text notes section */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Text Notes ({texts.length})
              </h3>
              {canEdit && (
                <div className="flex gap-2 mb-3">
                  <Textarea
                    placeholder="What did the client say during selection?"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    rows={2}
                    data-testid="textarea-wn-new"
                  />
                  <Button onClick={() => newText.trim() && addText.mutate(newText.trim())} disabled={!newText.trim() || addText.isPending} data-testid="button-wn-add-text">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {texts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No text notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {texts.map(t => (
                    <div key={t.id} className="border rounded-lg p-3 bg-muted/30" data-testid={`wn-text-${t.id}`}>
                      {editingId === t.id ? (
                        <div className="space-y-2">
                          <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} autoFocus />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button size="sm" onClick={() => updateNote.mutate({ id: t.id, updates: { body: editValue } })}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{t.body}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-muted-foreground">{t.createdBy} · {new Date(t.createdAt).toLocaleString()}</span>
                            {canEdit && (
                              <div className="flex gap-1">
                                <button onClick={() => { setEditingId(t.id); setEditValue(t.body || ""); }} className="text-muted-foreground hover:text-foreground">
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button onClick={() => { if (confirm("Delete this note?")) deleteNote.mutate(t.id); }} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WranglerNotesButton({ projectId, projectName, userRole, userId, count: countProp }: { projectId: string; projectName?: string; userRole: string; userId: string; count?: number }) {
  const [open, setOpen] = useState(false);
  const canEdit = ["Admin", "DataWrangler"].includes(userRole);
  const canView = VIEW_ROLES.includes(userRole);

  // Use a shared batched query so 50+ rows don't fire 50 requests.
  const allCountsQuery = useWranglerNotesAllCounts(userRole, userId);
  const count = countProp ?? allCountsQuery.data?.[projectId] ?? 0;

  if (!canView) return null;
  const hasNotes = count > 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`h-7 px-2 text-xs ${hasNotes ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700" : "text-gray-600 border-gray-300"}`}
        title={`Wrangler notes${hasNotes ? ` (${count})` : ""}`}
        data-testid={`button-wrangler-notes-${projectId}`}
      >
        <MessageSquare className="h-3 w-3 mr-1" />
        Notes
        {hasNotes && <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-green-600 text-white text-[10px]">{count}</span>}
      </Button>
      {open && (
        <WranglerNotesDialog
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
