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

// Normalise a name for fuzzy comparison: lowercase, strip punctuation,
// collapse whitespace. Used to match a client's name against the
// authorName fields on live Google reviews.
function normaliseName(raw: string): string {
  return (raw || "")
    .toLowerCase()
    // Strip parenthesised parts like "Jane (Wedding 2024)"
    .replace(/\([^)]*\)/g, " ")
    // Remove anything that is not a letter, digit, or whitespace
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(name: string): Set<string> {
  return new Set(normaliseName(name).split(" ").filter(Boolean));
}

/**
 * Decide whether a client's name matches any of the live Google review authors.
 *
 * Matching rules (case-insensitive, punctuation-insensitive):
 *   1. Exact normalised match.
 *   2. Author tokens are a superset of all client tokens (e.g. client "Jane Doe"
 *      vs author "Jane M. Doe").
 *   3. Client tokens are a superset of all author tokens (e.g. client
 *      "Jane Doe" vs author "Jane Doe").
 *
 * Returns the first matching review (or null) so callers can record which
 * Google reviewer was matched.
 */
export function findMatchingGoogleReview(
  clientName: string,
  reviews: GooglePlaceReview[],
): GooglePlaceReview | null {
  const clientTokens = tokenSet(clientName);
  if (clientTokens.size === 0) return null;
  const clientNorm = Array.from(clientTokens).sort().join(" ");

  for (const r of reviews) {
    const authorTokens = tokenSet(r.authorName);
    if (authorTokens.size === 0) continue;
    const authorNorm = Array.from(authorTokens).sort().join(" ");
    // Exact normalised match — accepted at any token count.
    if (authorNorm === clientNorm) return r;

    // Partial / superset matches require AT LEAST 2 overlapping tokens to
    // avoid auto-suppressing unrelated people who happen to share a single
    // common first name (e.g. "John" vs "John Smith").
    if (clientTokens.size < 2 || authorTokens.size < 2) continue;
    const overlap = Array.from(clientTokens).filter(t => authorTokens.has(t));
    if (overlap.length < 2) continue;
    if (overlap.length === clientTokens.size) return r;   // client tokens ⊆ author
    if (overlap.length === authorTokens.size) return r;   // author tokens ⊆ client
  }
  return null;
}

/**
 * Convenience wrapper: fetches the cached/live Google Place summary and
 * returns the matching review (or null) for a client name. Falls back to
 * `null` if the API errors so the caller can decide what to do.
 */
export async function findMatchForClient(clientName: string): Promise<GooglePlaceReview | null> {
  try {
    const summary = await fetchGooglePlaceSummary(false);
    return findMatchingGoogleReview(clientName, summary.reviews);
  } catch (err: any) {
    console.warn("[GooglePlaces] match lookup failed:", err?.message);
    return null;
  }
}
