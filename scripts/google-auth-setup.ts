/**
 * One-time Google OAuth setup.
 *
 *   npx tsx scripts/google-auth-setup.ts
 *
 * Prints a GOOGLE_REFRESH_TOKEN to store alongside GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET. Once set, the app authenticates to Calendar, Gmail and
 * Drive without Replit's connectors, and without any further interactive step:
 * google-auth-library exchanges the refresh token for access tokens as needed.
 *
 * Prerequisites in Google Cloud Console:
 *   1. A project with the Calendar, Gmail and Drive APIs enabled.
 *   2. An OAuth 2.0 Client ID of type "Web application".
 *   3. This exact redirect URI registered on that client:
 *        http://localhost:5555/oauth2callback
 *      (override with GOOGLE_OAUTH_REDIRECT_URI if you register a different one)
 *
 * Run it on a machine with a browser. The studio's own Google account must be
 * the one that grants consent - the app reads the primary calendar and the
 * 'me' mailbox of whichever account authorises here.
 */

import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';

// Scopes are derived from what the services actually call:
//   calendar.readonly  - listCalendars(), fetchCalendarEvents() only read
//   gmail.modify       - listEmails/getEmail read, markAsRead modifies
//   gmail.send         - sendEmail(); not covered by gmail.modify
//   drive              - full scope is required because the app operates on
//                        pre-existing folders it did not create
//                        (findFolderByName, makeFolderPublic, renameFolder),
//                        which drive.file cannot reach
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive',
];

const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5555/oauth2callback';

function fail(message: string): never {
  console.error('\n  ' + message + '\n');
  process.exit(1);
}

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    fail(
      'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first, e.g.\n\n' +
      '    GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy \\\n' +
      '      npx tsx scripts/google-auth-setup.ts'
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    // offline + consent together are what make Google return a refresh token.
    // Without prompt:'consent' a repeat authorisation returns only an access
    // token, and the script would have nothing useful to print.
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  const port = Number(new URL(REDIRECT_URI).port || 5555);
  const callbackPath = new URL(REDIRECT_URI).pathname;

  console.log('\n  Open this URL and grant access as the studio Google account:\n');
  console.log('  ' + authUrl + '\n');
  console.log('  Waiting for the redirect on ' + REDIRECT_URI + ' ...\n');

  const code: string = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, 'http://localhost:' + port);
      if (url.pathname !== callbackPath) {
        res.writeHead(404).end('Not found');
        return;
      }

      const error = url.searchParams.get('error');
      const received = url.searchParams.get('code');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:3rem">' +
        (received
          ? '<h1>Authorised</h1><p>You can close this tab and return to the terminal.</p>'
          : '<h1>Authorisation failed</h1><p>' + (error || 'No code returned') + '</p>') +
        '</body>'
      );

      server.close();
      if (received) resolve(received);
      else reject(new Error(error || 'No authorisation code returned'));
    });

    server.on('error', reject);
    server.listen(port);
  });

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    fail(
      'Google returned no refresh token.\n\n' +
      '  This happens when the account has already authorised this client.\n' +
      '  Remove it at https://myaccount.google.com/permissions and re-run.'
    );
  }

  console.log('  Success. Add this to your environment:\n');
  console.log('    GOOGLE_CLIENT_ID=' + clientId);
  console.log('    GOOGLE_CLIENT_SECRET=' + clientSecret);
  console.log('    GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
  console.log('  Treat the refresh token like a password: it grants ongoing');
  console.log('  access to the calendar, mailbox and Drive of the account that');
  console.log('  just authorised. Store it as a secret, never in the repo.\n');
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
