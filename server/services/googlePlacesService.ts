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

// Studio tag tokens that are part of internal project naming conventions,
// not the client's actual name. Stripped before tokenising so the matcher
// doesn't get confused by e.g. "Lerato (BIRTHDAY SPECIAL)" vs the real
// Google reviewer name "Lerato".
const STUDIO_TAG_TOKENS = new Set([
  "grand", "vip", "tt", "ss", "birthday", "special",
  "make", "up", "makeup",
  "christmas", "chrismas", "xmas",
  "wedding", "engagement", "maternity", "graduation", "matric",
  "shoot", "session", "package", "deal", "promo", "promotion",
  "and", "the", "with", "for",
]);

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

function tokenSet(name: string, dropStudioTags: boolean = false): Set<string> {
  const tokens = normaliseName(name).split(" ").filter(Boolean);
  if (!dropStudioTags) return new Set(tokens);
  return new Set(tokens.filter(t => !STUDIO_TAG_TOKENS.has(t)));
}

function emailLocalPart(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  const local = at > 0 ? email.slice(0, at) : email;
  return local.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
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
  clientEmail?: string | null,
): GooglePlaceReview | null {
  // Two views of the client name:
  //   - rawTokens: original tokenisation (back-compat with the ≥2-overlap rule)
  //   - cleanTokens: with parenthesised tags + studio shortcodes removed
  const rawTokens = tokenSet(clientName);
  const cleanTokens = tokenSet(clientName, true);
  if (rawTokens.size === 0 && cleanTokens.size === 0) return null;
  const rawNorm = Array.from(rawTokens).sort().join(" ");
  const cleanNorm = Array.from(cleanTokens).sort().join(" ");
  const localPart = emailLocalPart(clientEmail);

  for (const r of reviews) {
    const authorTokens = tokenSet(r.authorName);
    if (authorTokens.size === 0) continue;
    const authorNorm = Array.from(authorTokens).sort().join(" ");
    // Exact normalised match (either raw or cleaned) — accepted at any token count.
    if (authorNorm === rawNorm || authorNorm === cleanNorm) return r;

    // ≥2 token overlap against the CLEANED client tokens, so studio tags
    // like "(BIRTHDAY SPECIAL)" or "GRAND" no longer count toward overlap.
    if (cleanTokens.size >= 2 && authorTokens.size >= 2) {
      const overlap = Array.from(cleanTokens).filter(t => authorTokens.has(t));
      if (overlap.length >= 2) {
        if (overlap.length === cleanTokens.size) return r;   // client ⊆ author
        if (overlap.length === authorTokens.size) return r;  // author ⊆ client
      }
    }

    // Single-token assist: when the client's cleaned name is just one token
    // (e.g. "Lerato"), allow a match only when ALL of these hold, to keep
    // false positives down for common first names:
    //   - the token is at least 3 chars long
    //   - the Google author name contains the token
    //   - the email local-part contains the token
    //   - the Google author has ≥2 tokens and at least ONE other author token
    //     also appears in the email local-part (e.g. "ramoollalerato" matches
    //     author "Lerato Ramoolla" because "ramoolla" is in the local-part).
    if (cleanTokens.size === 1 && localPart && authorTokens.size >= 2) {
      const [token] = Array.from(cleanTokens);
      const otherAuthorTokens = Array.from(authorTokens).filter(t => t !== token);
      const corroborated = otherAuthorTokens.some(t => t.length >= 3 && localPart.includes(t));
      if (
        token && token.length >= 3 &&
        localPart.includes(token) &&
        authorTokens.has(token) &&
        corroborated
      ) {
        return r;
      }
    }
  }
  return null;
}

/**
 * Convenience wrapper: fetches the cached/live Google Place summary and
 * returns the matching review (or null) for a client name. Falls back to
 * `null` if the API errors so the caller can decide what to do.
 */
export async function findMatchForClient(
  clientName: string,
  clientEmail?: string | null,
): Promise<GooglePlaceReview | null> {
  try {
    const summary = await fetchGooglePlaceSummary(false);
    return findMatchingGoogleReview(clientName, summary.reviews, clientEmail);
  } catch (err: any) {
    console.warn("[GooglePlaces] match lookup failed:", err?.message);
    return null;
  }
}
