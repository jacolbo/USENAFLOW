import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Lock, Heart, X, ChevronLeft, ChevronRight, Download, Send,
  Loader2, Mail, Camera, Check, ArrowLeft, Eye,
} from "lucide-react";

interface GalleryInfo {
  id: string;
  name: string;
  slug: string;
  hasPassword: boolean;
  coverImageKey: string | null;
  settings: Record<string, boolean | string | number | null> | null;
}

interface GallerySet {
  id: string;
  name: string;
  sortOrder: number;
}

interface Photo {
  id: string;
  setId: string;
  filename: string;
  storageKey: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

interface FavListData {
  id: string;
  name: string;
  selectedPhotoIds: string[];
  selectionCount: number;
  isSubmitted: boolean;
}

export default function ClientGalleryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const [galleryInfo, setGalleryInfo] = useState<GalleryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`gallery_token_${slug}`) || null;
    }
    return null;
  });
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);

  const [sets, setSets] = useState<GallerySet[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [favEmail, setFavEmail] = useState("");
  const [showFavSignIn, setShowFavSignIn] = useState(false);
  const [favSignedIn, setFavSignedIn] = useState(false);
  const [favLists, setFavLists] = useState<FavListData[]>([]);
  const [activeFavListId, setActiveFavListId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFavDashboard, setShowFavDashboard] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");

  const [showCover, setShowCover] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [showDownloadGate, setShowDownloadGate] = useState(false);
  const [downloadPin, setDownloadPin] = useState("");
  const [downloadVerified, setDownloadVerified] = useState(false);
  const [downloadEmail, setDownloadEmail] = useState("");

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    fetchGalleryInfo();
  }, [slug]);

  const fetchGalleryInfo = async () => {
    try {
      const res = await fetch(`/api/g/${slug}`);
      if (res.status === 404) { setError("Gallery not found"); setLoading(false); return; }
      if (res.status === 410) { setError("This gallery has expired"); setLoading(false); return; }
      if (!res.ok) throw new Error("Failed to load gallery");
      const data = await res.json();
      setGalleryInfo(data);

      const savedToken = localStorage.getItem(`gallery_token_${slug}`);
      if (savedToken) {
        const testRes = await fetch(`/api/g/${slug}/photos`, {
          headers: { "X-Gallery-Token": savedToken },
        });
        if (testRes.ok) {
          const photosData = await testRes.json();
          setToken(savedToken);
          setSets(photosData.sets || []);
          setPhotos(photosData.photos || []);
          if (photosData.sets?.length > 0) setActiveSetId(photosData.sets[0].id);
          setLoading(false);
          return;
        }
        localStorage.removeItem(`gallery_token_${slug}`);
        setToken(null);
      }

      if (!data.hasPassword) {
        await authenticate("");
      }
    } catch {
      setError("Failed to load gallery");
    } finally {
      setLoading(false);
    }
  };

  const authenticate = async (pw: string) => {
    setAuthenticating(true);
    setAuthError("");
    try {
      const res = await fetch(`/api/g/${slug}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAuthError(data.error || "Incorrect password");
        setAuthenticating(false);
        return;
      }
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem(`gallery_token_${slug}`, data.token);
      await loadPhotos(data.token);
    } catch {
      setAuthError("Authentication failed");
    } finally {
      setAuthenticating(false);
    }
  };

  const loadPhotos = async (authToken: string) => {
    try {
      const res = await fetch(`/api/g/${slug}/photos`, {
        headers: { "X-Gallery-Token": authToken },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSets(data.sets || []);
      setPhotos(data.photos || []);
      if (data.sets?.length > 0) setActiveSetId(data.sets[0].id);
    } catch {
      toast({ title: "Error", description: "Failed to load photos", variant: "destructive" });
    }
  };

  const activeFavList = favLists.find((l) => l.id === activeFavListId) || null;

  const loadFavorites = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/g/${slug}/favorites`, {
        headers: { "X-Gallery-Token": token },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.signedIn && data.lists?.length > 0) {
        setFavSignedIn(true);
        setFavLists(data.lists);
        const active = data.lists.find((l: FavListData) => l.id === activeFavListId) || data.lists[0];
        setActiveFavListId(active.id);
        setSelectedIds(new Set(active.selectedPhotoIds || []));
        setFavEmail(data.email || "");
      }
    } catch {}
  };

  useEffect(() => {
    if (token) loadFavorites();
  }, [token]);

  const handleFavSignIn = async () => {
    if (!token || !favEmail.trim()) return;
    try {
      const res = await fetch(`/api/g/${slug}/favorites/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gallery-Token": token },
        body: JSON.stringify({ email: favEmail.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setFavSignedIn(true);
      setFavLists([data.favList]);
      setActiveFavListId(data.favList.id);
      setSelectedIds(new Set(data.favList.selectedPhotoIds || []));
      setShowFavSignIn(false);
      toast({ title: "Signed in", description: "You can now select your favourites" });
      await loadFavorites();
    } catch {
      toast({ title: "Error", description: "Failed to sign in", variant: "destructive" });
    }
  };

  const handleCreateList = async () => {
    if (!token || !newListName.trim()) return;
    try {
      const res = await fetch(`/api/g/${slug}/favorites/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gallery-Token": token },
        body: JSON.stringify({ email: favEmail.trim(), listName: newListName.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setFavLists((prev) => [...prev, data.favList]);
      setActiveFavListId(data.favList.id);
      setSelectedIds(new Set(data.favList.selectedPhotoIds || []));
      setShowCreateList(false);
      setNewListName("");
      toast({ title: "List created", description: `"${data.favList.name}" is now active` });
    } catch {
      toast({ title: "Error", description: "Failed to create list", variant: "destructive" });
    }
  };

  const switchFavList = (listId: string) => {
    const list = favLists.find((l) => l.id === listId);
    if (list) {
      setActiveFavListId(list.id);
      setSelectedIds(new Set(list.selectedPhotoIds || []));
    }
  };

  const toggleFavorite = async (photoId: string) => {
    if (!token || !activeFavList) return;
    try {
      const res = await fetch(`/api/g/${slug}/favorites/${activeFavList.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gallery-Token": token },
        body: JSON.stringify({ photoId }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Limit reached", description: data.error, variant: "destructive" });
        return;
      }
      const data = await res.json();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (data.action === "added") next.add(photoId);
        else next.delete(photoId);
        return next;
      });
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    }
  };

  const handleSubmitSelections = async () => {
    if (!token || !activeFavList) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/g/${slug}/favorites/${activeFavList.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gallery-Token": token },
        body: JSON.stringify({ message: submitMessage }),
      });
      if (!res.ok) throw new Error("Failed");
      setFavLists((prev) => prev.map((l) => l.id === activeFavList.id ? { ...l, isSubmitted: true } : l));
      setShowSubmitModal(false);
      toast({ title: "Selections sent!", description: "Your photographer has been notified." });
    } catch {
      toast({ title: "Error", description: "Failed to submit", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPhoto = async (photoId: string) => {
    if (!token || !downloadVerified) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/g/${slug}/image/${photoId}?token=${token}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const photo = photos.find((p) => p.id === photoId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = photo?.filename || "photo.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!token || !downloadVerified) return;
    setDownloading(true);
    toast({ title: "Downloading...", description: "Preparing your photos for download" });
    for (const photo of displayPhotos) {
      await handleDownloadPhoto(photo.id);
    }
    setDownloading(false);
    toast({ title: "Complete", description: `Downloaded ${displayPhotos.length} photos` });
  };

  const handleVerifyPin = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/g/${slug}/download/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gallery-Token": token },
        body: JSON.stringify({ pin: downloadPin, email: downloadEmail }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Invalid PIN", variant: "destructive" });
        return;
      }
      setDownloadVerified(true);
      setShowDownloadGate(false);
      toast({ title: "Downloads unlocked" });
    } catch {
      toast({ title: "Error", description: "Verification failed", variant: "destructive" });
    }
  };

  const displayPhotos = activeSetId ? photos.filter((p) => p.setId === activeSetId) : photos;
  const lightboxPhotos = displayPhotos;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : lightboxPhotos.length - 1));
  const nextPhoto = () => setLightboxIndex((i) => (i !== null && i < lightboxPhotos.length - 1 ? i + 1 : 0));

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (lightboxIndex === null) return;
    if (e.key === "ArrowLeft") prevPhoto();
    if (e.key === "ArrowRight") nextPhoto();
    if (e.key === "Escape") closeLightbox();
  }, [lightboxIndex]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.targetTouches[0].clientX; };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextPhoto(); else prevPhoto();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF7F2" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#C9A96E" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF7F2" }}>
        <div className="text-center">
          <Camera className="h-12 w-12 mx-auto mb-4" style={{ color: "#C9A96E" }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: "#3D3D3D", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{error}</h2>
        </div>
      </div>
    );
  }

  if (galleryInfo && !token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF7F2" }}>
        <div className="w-full max-w-sm mx-4 text-center">
          <h1 className="text-3xl mb-2" style={{ color: "#3D3D3D", fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
            {galleryInfo.name}
          </h1>
          <p className="text-sm mb-8" style={{ color: "#8B8B8B" }}>Enter the password to view this gallery</p>
          <div className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#C9A96E" }} />
              <Input
                type="password"
                placeholder="Gallery Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && authenticate(password)}
                className="pl-10 text-center border-gray-300"
                style={{ background: "white" }}
              />
            </div>
            {authError && <p className="text-sm text-red-500">{authError}</p>}
            <Button
              className="w-full"
              style={{ background: "#C9A96E", color: "white" }}
              disabled={authenticating}
              onClick={() => authenticate(password)}
            >
              {authenticating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
              Enter Gallery
            </Button>
          </div>
          <p className="text-xs mt-6" style={{ color: "#B0B0B0" }}>Jepson Myles Studio</p>
        </div>
      </div>
    );
  }

  const settings = galleryInfo?.settings || {};

  if (token && showCover) {
    const coverPhoto = photos.length > 0 ? photos[0] : null;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative" style={{ background: "#FAF7F2" }}>
        {coverPhoto && (
          <div className="absolute inset-0 z-0">
            <img
              src={`/api/g/${slug}/image/${coverPhoto.id}?token=${token}`}
              alt=""
              className="w-full h-full object-cover opacity-20"
            />
          </div>
        )}
        <div className="relative z-10 text-center px-6">
          <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#C9A96E" }}>Jepson Myles Studio</p>
          <h1 className="text-4xl md:text-6xl mb-4" style={{ color: "#3D3D3D", fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
            {galleryInfo?.name}
          </h1>
          <p className="text-sm mb-8" style={{ color: "#8B8B8B" }}>
            {photos.length} photos{sets.length > 1 ? ` · ${sets.length} sets` : ""}
          </p>
          <Button
            size="lg"
            className="px-8"
            style={{ background: "#C9A96E", color: "white" }}
            onClick={() => setShowCover(false)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Gallery
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }}>
      <header className="sticky top-0 z-40 border-b" style={{ background: "#FAF7F2", borderColor: "#E8E2D9" }}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl" style={{ color: "#3D3D3D", fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
            {galleryInfo?.name}
          </h1>
          <div className="flex items-center gap-2">
            {settings.favoritesEnabled && (
              <Button
                variant="ghost"
                size="sm"
                className="relative"
                onClick={() => {
                  if (!favSignedIn) setShowFavSignIn(true);
                  else setShowFavDashboard(true);
                }}
              >
                <Heart className={`h-4 w-4 mr-1 ${selectedIds.size > 0 ? "fill-pink-500 text-pink-500" : ""}`} />
                <span className="hidden sm:inline">Favourites</span>
                {selectedIds.size > 0 && (
                  <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {selectedIds.size}
                  </span>
                )}
              </Button>
            )}
            {settings.downloadEnabled && (
              downloadVerified ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={downloading}
                  onClick={handleDownloadAll}
                >
                  {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  <span className="hidden sm:inline">Download All</span>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDownloadGate(true)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )
            )}
          </div>
        </div>
      </header>

      {sets.length > 1 && (
        <div className="border-b overflow-x-auto" style={{ borderColor: "#E8E2D9" }}>
          <div className="container mx-auto px-4 flex gap-1 py-2">
            {sets.map((set) => (
              <button
                key={set.id}
                className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                  activeSetId === set.id ? "text-white" : "hover:bg-gray-200/50"
                }`}
                style={activeSetId === set.id ? { background: "#C9A96E", color: "white" } : { color: "#6B6B6B" }}
                onClick={() => setActiveSetId(set.id)}
              >
                {set.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="container mx-auto px-2 sm:px-4 py-6">
        {displayPhotos.length === 0 ? (
          <div className="text-center py-20">
            <Camera className="h-12 w-12 mx-auto mb-3" style={{ color: "#C9A96E", opacity: 0.5 }} />
            <p style={{ color: "#8B8B8B" }}>No photos in this set yet</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-2 sm:gap-3">
            {displayPhotos.map((photo, index) => {
              const isFav = selectedIds.has(photo.id);
              return (
                <div key={photo.id} className="break-inside-avoid mb-2 sm:mb-3 relative group">
                  <div
                    className="rounded-sm overflow-hidden cursor-pointer bg-gray-200"
                    style={{ aspectRatio: photo.width && photo.height ? `${photo.width}/${photo.height}` : "auto" }}
                    onClick={() => openLightbox(index)}
                  >
                    <img
                      src={`/api/g/${slug}/image/${photo.id}?token=${token}`}
                      alt={settings.filenameDisplay ? photo.filename : ""}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      style={{ display: "block" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f0f0f0' width='400' height='300'/%3E%3Ctext x='200' y='150' text-anchor='middle' fill='%23999' font-size='14'%3EPhoto%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  {favSignedIn && settings.favoritesEnabled && !activeFavList?.isSubmitted && (
                    <button
                      className="absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: isFav ? "#e91e63" : "rgba(255,255,255,0.85)" }}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(photo.id); }}
                    >
                      <Heart className={`h-4 w-4 ${isFav ? "fill-white text-white" : "text-gray-600"}`} />
                    </button>
                  )}
                  {settings.filenameDisplay && (
                    <p className="text-xs mt-1 truncate" style={{ color: "#8B8B8B" }}>{photo.filename}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {lightboxIndex !== null && lightboxPhotos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10" onClick={closeLightbox}>
            <X className="h-6 w-6" />
          </button>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white z-10" onClick={(e) => { e.stopPropagation(); prevPhoto(); }}>
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white z-10" onClick={(e) => { e.stopPropagation(); nextPhoto(); }}>
            <ChevronRight className="h-8 w-8" />
          </button>
          <img
            src={`/api/g/${slug}/image/${lightboxPhotos[lightboxIndex].id}?token=${token}`}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/70 text-sm">
            <span>{lightboxIndex + 1} / {lightboxPhotos.length}</span>
            {settings.filenameDisplay && <span>{lightboxPhotos[lightboxIndex].filename}</span>}
            {favSignedIn && settings.favoritesEnabled && !activeFavList?.isSubmitted && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavorite(lightboxPhotos[lightboxIndex!].id); }}
                className="flex items-center gap-1 hover:text-pink-400"
              >
                <Heart className={`h-4 w-4 ${selectedIds.has(lightboxPhotos[lightboxIndex].id) ? "fill-pink-500 text-pink-500" : ""}`} />
              </button>
            )}
            {downloadVerified && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDownloadPhoto(lightboxPhotos[lightboxIndex!].id); }}
                className="flex items-center gap-1 hover:text-blue-400"
                disabled={downloading}
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <Dialog open={showFavSignIn} onOpenChange={setShowFavSignIn}>
        <DialogContent style={{ background: "#FAF7F2" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#3D3D3D" }}>
              Sign in to Select Favourites
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "#6B6B6B" }}>
              Enter your email to start selecting your favourite photos.
            </p>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#C9A96E" }} />
              <Input
                type="email"
                placeholder="your@email.com"
                value={favEmail}
                onChange={(e) => setFavEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFavSignIn()}
                className="pl-10"
              />
            </div>
            <Button className="w-full" style={{ background: "#C9A96E" }} disabled={!favEmail.trim()} onClick={handleFavSignIn}>
              <Heart className="h-4 w-4 mr-2" /> Start Selecting
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFavDashboard} onOpenChange={setShowFavDashboard}>
        <DialogContent className="max-w-lg" style={{ background: "#FAF7F2" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#3D3D3D" }}>
              My Favourites
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: "#6B6B6B" }}>
                Signed in as <strong>{favEmail}</strong>
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowCreateList(true)}>
                + New List
              </Button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {favLists.map((list) => {
                const isActive = list.id === activeFavListId;
                const listPhotos = photos.filter((p) => (list.selectedPhotoIds || []).includes(p.id));
                return (
                  <div
                    key={list.id}
                    className={`rounded-lg p-4 border cursor-pointer transition-colors ${isActive ? "ring-2 ring-amber-500" : ""}`}
                    style={{ borderColor: "#E8E2D9", background: "white" }}
                    onClick={() => switchFavList(list.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm" style={{ color: "#3D3D3D" }}>{list.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge style={{ background: "#C9A96E20", color: "#C9A96E" }}>{list.selectionCount} selected</Badge>
                        {isActive && <Badge variant="outline" className="text-xs">Active</Badge>}
                      </div>
                    </div>
                    {listPhotos.length > 0 && (
                      <div className="grid grid-cols-6 gap-1 mb-2 max-h-24 overflow-y-auto">
                        {listPhotos.slice(0, 12).map((photo) => (
                          <div key={photo.id} className="relative aspect-square rounded overflow-hidden group">
                            <img
                              src={`/api/g/${slug}/image/${photo.id}?token=${token}`}
                              alt={photo.filename}
                              className="w-full h-full object-cover"
                            />
                            {isActive && !list.isSubmitted && (
                              <button
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(photo.id); }}
                              >
                                <X className="h-3 w-3 text-white" />
                              </button>
                            )}
                          </div>
                        ))}
                        {listPhotos.length > 12 && (
                          <div className="aspect-square rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                            +{listPhotos.length - 12}
                          </div>
                        )}
                      </div>
                    )}
                    {list.isSubmitted ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <Check className="h-4 w-4" />
                        <span className="text-sm">Submitted to photographer</span>
                      </div>
                    ) : isActive ? (
                      <Button
                        className="w-full"
                        size="sm"
                        style={{ background: "#C9A96E" }}
                        disabled={list.selectionCount === 0}
                        onClick={(e) => { e.stopPropagation(); setShowFavDashboard(false); setShowSubmitModal(true); }}
                      >
                        <Send className="h-4 w-4 mr-2" /> Send to Photographer
                      </Button>
                    ) : (
                      <p className="text-xs text-center" style={{ color: "#8B8B8B" }}>Tap to make active</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateList} onOpenChange={setShowCreateList}>
        <DialogContent style={{ background: "#FAF7F2" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#3D3D3D" }}>
              Create New List
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="List name (e.g. Album Picks, Wall Art)"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
            />
            <Button className="w-full" style={{ background: "#C9A96E" }} disabled={!newListName.trim()} onClick={handleCreateList}>
              Create List
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent style={{ background: "#FAF7F2" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#3D3D3D" }}>
              Send Selections to Photographer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "#6B6B6B" }}>
              You have selected <strong>{selectedIds.size}</strong> photos. Add an optional message for your photographer.
            </p>
            <textarea
              className="w-full border rounded-lg p-3 text-sm resize-none"
              rows={3}
              placeholder="Any notes for your photographer... (optional)"
              value={submitMessage}
              onChange={(e) => setSubmitMessage(e.target.value)}
              style={{ borderColor: "#E8E2D9" }}
            />
            <Button
              className="w-full"
              style={{ background: "#C9A96E" }}
              disabled={submitting}
              onClick={handleSubmitSelections}
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit {selectedIds.size} Selections
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDownloadGate} onOpenChange={setShowDownloadGate}>
        <DialogContent style={{ background: "#FAF7F2" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#3D3D3D" }}>
              Download Photos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "#6B6B6B" }}>
              Enter your email and the download PIN provided by your photographer.
            </p>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#C9A96E" }} />
              <Input
                type="email"
                placeholder="your@email.com"
                value={downloadEmail}
                onChange={(e) => setDownloadEmail(e.target.value)}
                className="pl-10"
              />
            </div>
            <Input
              placeholder="4-digit PIN"
              value={downloadPin}
              onChange={(e) => setDownloadPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
              className="text-center text-lg tracking-widest"
              maxLength={4}
            />
            <Button className="w-full" style={{ background: "#C9A96E" }} disabled={downloadPin.length < 4 || !downloadEmail.trim()} onClick={handleVerifyPin}>
              <Download className="h-4 w-4 mr-2" /> Unlock Downloads
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="text-center py-6 border-t" style={{ borderColor: "#E8E2D9" }}>
        <p className="text-xs" style={{ color: "#B0B0B0" }}>Powered by Jepson Myles Studio</p>
      </footer>
    </div>
  );
}
