import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Plus, Trash2, Edit, Image as ImageIcon, FileText } from "lucide-react";
import { ObjectUploader } from "./ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { ProjectNote } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

interface ProjectNotesProps {
  projectId: string;
  userRole: string;
  hasNotes: boolean;
}

export function ProjectNotes({ projectId, userRole, hasNotes }: ProjectNotesProps) {
  // Check permissions first to avoid conditional hooks
  const canManageNotes = ["Admin", "Sales", "DataWrangler"].includes(userRole);
  const isRetoucher = ["Retoucher"].includes(userRole);
  
  // Always declare hooks, even if component returns early
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("text");
  const [newTextNote, setNewTextNote] = useState("");
  const [editingNote, setEditingNote] = useState<ProjectNote | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const { toast } = useToast();
  
  // Early return AFTER all hooks are declared
  if (isRetoucher && !hasNotes) {
    return null;
  }

  const notesQuery = useQuery({
    queryKey: ["/api/projects", projectId, "notes"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/notes`);
      return response.json() as Promise<ProjectNote[]>;
    },
    enabled: isDialogOpen,
  });

  const createNoteMutation = useMutation({
    mutationFn: async ({ noteType, content }: { noteType: string; content: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/notes`, {
        noteType,
        content,
        createdBy: userRole,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setNewTextNote("");
      toast({
        title: "Note added",
        description: "Project note has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/notes/${noteId}`, {
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "notes"] });
      setEditingNote(null);
      setEditingContent("");
      toast({
        title: "Note updated",
        description: "Project note has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest("DELETE", `/api/projects/${projectId}/notes/${noteId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Note deleted",
        description: "Project note has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/objects/upload", { method: "POST" });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleImageUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const imageURL = uploadedFile.uploadURL;
      
      // Normalize the image URL and create the note
      const response = await fetch("/api/note-images", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageURL }),
      });
      
      const data = await response.json();
      
      createNoteMutation.mutate({
        noteType: "image",
        content: data.objectPath,
      });
    }
  };

  const handleAddTextNote = () => {
    if (newTextNote.trim()) {
      createNoteMutation.mutate({
        noteType: "text",
        content: newTextNote.trim(),
      });
    }
  };

  const startEditing = (note: ProjectNote) => {
    setEditingNote(note);
    setEditingContent(note.content);
  };

  const handleUpdateNote = () => {
    if (editingNote && editingContent.trim()) {
      updateNoteMutation.mutate({
        noteId: editingNote.id,
        content: editingContent.trim(),
      });
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-1" />
          {canManageNotes ? "Manage Notes" : "View Notes"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Notes</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {canManageNotes && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">
                  <FileText className="h-4 w-4 mr-2" />
                  Add Text Note
                </TabsTrigger>
                <TabsTrigger value="image">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Add Image Note
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="text" className="space-y-3">
                <Textarea
                  placeholder="Enter your note here..."
                  value={newTextNote}
                  onChange={(e) => setNewTextNote(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleAddTextNote} disabled={!newTextNote.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Text Note
                </Button>
              </TabsContent>
              
              <TabsContent value="image">
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760} // 10MB
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleImageUploadComplete}
                  buttonClassName="w-full"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Upload Image Note
                </ObjectUploader>
              </TabsContent>
            </Tabs>
          )}
          
          {/* Display existing notes */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Existing Notes</h3>
            {notesQuery.isLoading && <p>Loading notes...</p>}
            {notesQuery.data && notesQuery.data.length === 0 && (
              <p className="text-muted-foreground">No notes yet.</p>
            )}
            {notesQuery.data?.map((note) => (
              <Card key={note.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={note.noteType === "text" ? "default" : "secondary"}>
                        {note.noteType === "text" ? (
                          <FileText className="h-3 w-3 mr-1" />
                        ) : (
                          <ImageIcon className="h-3 w-3 mr-1" />
                        )}
                        {note.noteType}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        by {note.createdBy} • {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {canManageNotes && (
                      <div className="flex gap-1">
                        {note.noteType === "text" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(note)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {editingNote?.id === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateNote}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingNote(null);
                            setEditingContent("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : note.noteType === "text" ? (
                    <p className="whitespace-pre-wrap">{note.content}</p>
                  ) : (
                    <img
                      src={note.content}
                      alt="Note attachment"
                      className="max-w-full h-auto rounded-lg"
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}