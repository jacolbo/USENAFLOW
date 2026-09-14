// Shared Google authentication.
//
// Two credential sources, checked in this order:
//
//   1. First-party OAuth — GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET +
//      GOOGLE_REFRESH_TOKEN. google-auth-library refreshes access tokens on
//      demand, so this works on any host.
//   2. Replit connectors — the original path, kept as a fallback so the app
//      keeps running unchanged on Replit until the variables above are set.
//
// This mirrors the env-var-first pattern already used by emailService.ts for
// Resend. The studio uses a single Google account throughout (calendars are
// read as 'primary', Gmail as 'me'), so one refresh token covers Calendar,
// Gmail and Drive.

import { google } from 'googleapis';

// Derived from the runtime class rather than imported from google-auth-library:
// googleapis bundles its own nested copy of that package (9.x) while the
// top-level dependency is 10.x, and the two OAuth2Client types are not
// assignable to each other. Deriving it here keeps this correct regardless of
// which version either package resolves to.
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export type GoogleConnectorName = 'google-calendar' | 'google-mail' | 'google-drive';

/** True when first-party OAuth credentials are configured. */
export function hasOwnGoogleCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

// ─── First-party OAuth ────────────────────────────────────────────────────────

// Safe to cache: the client refreshes its own access tokens from the refresh
// token. (The connector clients below are NOT cached - see the note there.)
let ownClient: OAuth2Client | null = null;

function getOwnClient(): OAuth2Client {
  if (ownClient) return ownClient;

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5555/oauth2callback'
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  ownClient = client;
  return client;
}

// ─── Replit connector fallback ────────────────────────────────────────────────

interface CachedConnectorToken {
  accessToken: string;
  expiresAt: number;
}

// Keyed by connector name. A plain object rather than a Map so this compiles
// without downlevelIteration under the project's default ES5 target.
const connectorTokens: { [name: string]: CachedConnectorToken | undefined } = {};

function getReplitToken(): string | null {
  if (process.env.REPL_IDENTITY) return 'repl ' + process.env.REPL_IDENTITY;
  if (process.env.WEB_REPL_RENEWAL) return 'depl ' + process.env.WEB_REPL_RENEWAL;
  return null;
}

async function getConnectorAccessToken(name: GoogleConnectorName): Promise<string> {
  const cached = connectorTokens[name];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = getReplitToken();

  if (!xReplitToken || !hostname) {
    throw new Error(
      `Google (${name}) is not configured. Set GOOGLE_CLIENT_ID, ` +
      `GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN, or run on Replit with ` +
      `the ${name} connector enabled.`
    );
  }

  const url =
    'https://' + hostname +
    '/api/v2/connection?include_secrets=true&connector_names=' + name;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Connector API returned ${response.status} for ${name}: ${body}`);
  }

  const data: any = await response.json();
  const settings = data.items && data.items[0] ? data.items[0].settings : undefined;

  const accessToken: string | undefined =
    (settings && settings.access_token) ||
    (settings && settings.oauth && settings.oauth.credentials
      ? settings.oauth.credentials.access_token
      : undefined);

  if (!accessToken) {
    throw new Error(`Google connector '${name}' returned no access token`);
  }

  // Expire a minute early so a token never goes stale mid-request. Fall back to
  // a short window when the connector does not report an expiry.
  const reportedExpiry = settings && settings.expires_at
    ? new Date(settings.expires_at).getTime()
    : 0;
  const expiresAt = reportedExpiry > 0
    ? reportedExpiry - 60_000
    : Date.now() + 5 * 60_000;

  connectorTokens[name] = { accessToken, expiresAt };
  return accessToken;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** A bare access token, for callers that talk to the REST API directly. */
export async function getGoogleAccessToken(name: GoogleConnectorName): Promise<string> {
  if (hasOwnGoogleCredentials()) {
    const result = await getOwnClient().getAccessToken();
    const token = typeof result === 'string' ? result : result.token;
    if (!token) {
      throw new Error(
        'Google refresh failed - no access token returned. Check that ' +
        'GOOGLE_REFRESH_TOKEN is still valid (revoked or expired tokens must ' +
        'be regenerated with scripts/google-auth-setup.ts).'
      );
    }
    return token;
  }
  return getConnectorAccessToken(name);
}

/**
 * An auth client to hand to googleapis, e.g. google.gmail({ auth }).
 *
 * In first-party mode the returned client is shared and self-refreshing. In
 * connector mode a fresh client is built per call, because the connector hands
 * out short-lived access tokens with no refresh token attached - caching one
 * would leave callers holding an expired token.
 */
export async function getGoogleAuthClient(name: GoogleConnectorName): Promise<OAuth2Client> {
  if (hasOwnGoogleCredentials()) {
    return getOwnClient();
  }

  const accessToken = await getConnectorAccessToken(name);
  const client = new google.auth.OAuth2();
  client.setCredentials({ access_token: accessToken });
  return client;
}

/**
 * GET a Google REST path (e.g. '/calendar/v3/users/me/calendarList') using
 * whichever credential source is active.
 */
export async function googleApiGet(name: GoogleConnectorName, path: string): Promise<any> {
  const accessToken = await getGoogleAccessToken(name);
  const url = path.indexOf('http') === 0 ? path : 'https://www.googleapis.com' + path;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + accessToken,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Google API error ${response.status}: ${body}`);
  }

  return response.json();
}

/** Which credential source is active - used by the /health diagnostics. */
export function describeGoogleAuthMode(): string {
  return hasOwnGoogleCredentials()
    ? 'first-party OAuth (GOOGLE_CLIENT_ID / GOOGLE_REFRESH_TOKEN)'
    : 'Replit connectors';
}
