// Google Places API (Place Details) wrapper with in-memory caching.
// Pulls live overall rating, total review count, and the 5 most recent reviews
// for the studio's Google Business listing.

export interface GooglePlaceReview {
  authorName: string;
  authorPhotoUrl?: string;
  rating: number;
  text: string;
  relativeTime: string;
  time: number;
}

export interface GooglePlaceSummary {
  placeName: string;
  rating: number;
  totalRatings: number;
  reviews: GooglePlaceReview[];
  fetchedAt: number;
  url?: string;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: GooglePlaceSummary | null = null;
let cacheError: { message: string; at: number } | null = null;

export async function fetchGooglePlaceSummary(force = false): Promise<GooglePlaceSummary> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) {
    throw new Error("GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID must be set");
  }

  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const fields = [
    "name",
    "rating",
    "user_ratings_total",
    "reviews",
    "url",
  ].join(",");

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId,
  )}&fields=${fields}&reviews_sort=newest&key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    cacheError = { message: `HTTP ${resp.status}`, at: Date.now() };
    throw new Error(`Google Places HTTP ${resp.status}`);
  }
  const json: any = await resp.json();
  if (json.status && json.status !== "OK") {
    const msg = json.error_message || json.status;
    cacheError = { message: msg, at: Date.now() };
    throw new Error(`Google Places ${json.status}: ${msg}`);
  }

  const r = json.result || {};
  const reviews: GooglePlaceReview[] = Array.isArray(r.reviews)
    ? r.reviews.map((rev: any) => ({
        authorName: rev.author_name || "Anonymous",
        authorPhotoUrl: rev.profile_photo_url,
        rating: Number(rev.rating || 0),
        text: rev.text || "",
        relativeTime: rev.relative_time_description || "",
        time: Number(rev.time || 0),
      }))
    : [];

  cache = {
    placeName: r.name || "",
    rating: Number(r.rating || 0),
    totalRatings: Number(r.user_ratings_total || 0),
    reviews,
    fetchedAt: Date.now(),
    url: r.url,
  };
  cacheError = null;
  return cache;
}

export function getLastGooglePlacesError(): { message: string; at: number } | null {
  return cacheError;
}
