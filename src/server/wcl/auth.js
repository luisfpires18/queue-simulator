// Warcraft Logs client-credentials OAuth2 — the APP token used for all public
// parse analysis. User login is Battle.net only (see src/auth.ts); Warcraft
// Logs never sees a user, so the authorization-code flow that used to live
// here is gone on purpose.
const TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';

let cached = null; // { token, expiresAt }

function clientCredentials() {
  const id = process.env.WCL_CLIENT_ID;
  const secret = process.env.WCL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      'Missing WCL_CLIENT_ID / WCL_CLIENT_SECRET. Create an API client at ' +
        'https://www.warcraftlogs.com/api/clients/ and put the values in .env (see .env.example).'
    );
  }
  return { id, secret, basic: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') };
}

/** The app-wide token. Cached in memory until shortly before expiry. */
export async function getToken() {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const { basic } = clientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basic,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`OAuth token request failed: HTTP ${res.status} — ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`OAuth response had no access_token: ${JSON.stringify(data).slice(0, 500)}`);
  }
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return cached.token;
}
