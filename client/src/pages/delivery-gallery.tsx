import { useCallback, useEffect, useState } from "react";
import { useParams } from "wouter";
import { Download, Loader2, X, ChevronLeft, ChevronRight, Camera } from "lucide-react";

/**
 * The client's view of their finished photographs.
 *
 * This page exists so a client never has to open Google Drive. Everything it
 * shows is served through our own server: there is no Drive URL here, and no
 * Drive file id — photographs are addressed by our id and nothing else.
 */

interface DeliveryPhoto {
  id: string;
  filename: string;
  // Two sizes. The grid must never load the big one: four hundred full
  // previews is most of a gigabyte, and nobody is looking at them all at once.
  thumbUrl: string;
  previewUrl: string;
  ready: boolean;
}

interface DeliveryGallery {
  title: string;
  clientName: string;
  photoCount: number;
  canDownload: boolean;
  coverPhotoId: string | null;
  photos: DeliveryPhoto[];
}

export default function DeliveryGalleryPage() {
  const { token } = useParams<{ token: string }>();
  const [gallery, setGallery] = useState<DeliveryGallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/d/${token}`);
        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          throw new Error(detail.error || "This gallery could not be opened.");
        }
        const data = (await response.json()) as DeliveryGallery;
        if (!cancelled) setGallery(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const move = useCallback(
    (step: number) => {
      setLightbox((current) => {
        if (current === null || !gallery) return current;
        const next = current + step;
        if (next < 0 || next >= gallery.photos.length) return current;
        return next;
      });
    },
    [gallery]
  );

  // Arrow keys are how people actually move through a gallery.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, move]);

  function downloadAll() {
    setDownloading(true);
    // A plain navigation, so the browser's own download manager handles a
    // multi-gigabyte archive rather than us buffering it in a fetch.
    window.location.href = `/api/d/${token}/download.zip`;
    window.setTimeout(() => setDownloading(false), 4000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !gallery) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <Camera className="h-8 w-8 mx-auto text-neutral-300" />
          <h1 className="mt-4 text-lg font-medium text-neutral-900">Gallery unavailable</h1>
          <p className="mt-2 text-sm text-neutral-500">{error || "This link is no longer active."}</p>
        </div>
      </div>
    );
  }

  const cover =
    gallery.photos.find((p) => p.id === gallery.coverPhotoId) || gallery.photos[0] || null;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Cover */}
      <header className="border-b border-neutral-100">
        {cover && (
          <div className="w-full overflow-hidden bg-neutral-50" style={{ maxHeight: "44dvh" }}>
            <img
              src={cover.previewUrl}
              alt=""
              fetchPriority="high"
              className="w-full object-cover"
              style={{ maxHeight: "44dvh" }}
            />
          </div>
        )}
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
          <h1 className="text-2xl sm:text-3xl font-serif tracking-tight">{gallery.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
            <p className="text-sm text-neutral-500">
              {gallery.photoCount} {gallery.photoCount === 1 ? "photograph" : "photographs"}
            </p>
            <div className="flex-1" />
            {gallery.canDownload ? (
              <button
                type="button"
                onClick={downloadAll}
                disabled={downloading || gallery.photoCount === 0}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
                data-testid="button-download-all"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download all
              </button>
            ) : (
              // Shown rather than hidden: a client who expects a download
              // should learn it is coming, not wonder where the button went.
              <p className="text-sm text-neutral-400" data-testid="text-not-released">
                Downloads open once your photographer releases the gallery.
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        {gallery.photos.length === 0 ? (
          <p className="text-sm text-neutral-500">There are no photographs here yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {gallery.photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setLightbox(index)}
                className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-neutral-50"
                data-testid={`button-photo-${photo.id}`}
              >
                <img
                  src={photo.thumbUrl}
                  alt={photo.filename}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightbox !== null && gallery.photos[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/98 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
            data-testid="button-close-lightbox"
          >
            <X className="h-5 w-5" />
          </button>

          {lightbox > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                move(-1);
              }}
              className="absolute left-2 sm:left-6 rounded-full p-3 text-neutral-500 hover:bg-neutral-100"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <figure className="max-h-[88dvh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={gallery.photos[lightbox].previewUrl}
              alt={gallery.photos[lightbox].filename}
              className="max-h-[80dvh] max-w-[92vw] object-contain"
            />
            <figcaption className="mt-4 flex items-center justify-center gap-4 text-sm text-neutral-500">
              <span>{gallery.photos[lightbox].filename}</span>
              {gallery.canDownload && (
                <a
                  href={`/api/d/${token}/download/${gallery.photos[lightbox].id}`}
                  className="inline-flex items-center gap-1.5 text-neutral-900 hover:underline"
                  data-testid="link-download-one"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              )}
            </figcaption>
          </figure>

          {lightbox < gallery.photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                move(1);
              }}
              className="absolute right-2 sm:right-6 rounded-full p-3 text-neutral-500 hover:bg-neutral-100"
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
