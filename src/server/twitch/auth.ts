// Twitch client-credentials OAuth2 — the APP token used to check whether a
// user's linked channel is live (src/data/twitch.ts). Same in-memory-cached
// idiom as src/server/wcl/auth.js's Warcraft Logs token.
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

let cached: { token: string; expiresAt: number } | null = null;

/** True when TWITCH_CLIENT_ID/SECRET are configured - callers use this to
 * skip the live-status lookup entirely rather than fail on every call when
 * the feature is simply unconfigured (it's optional, unlike WCL). */
export function twitchEnabled(): boolean {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

/** The app-wide token. Cached in memory until shortly before expiry. Throws
 * if credentials aren't configured - callers should check twitchEnabled()
 * first, same as bnetEnabled gates Battle.net login. */
export async function getTwitchToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET - create an app at https://dev.twitch.tv/console/apps/create");
  }

  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" });
  const res = await fetch(`${TOKEN_URL}?${params}`, { method: "POST" });
  if (!res.ok) throw new Error(`Twitch OAuth token request failed: HTTP ${res.status} - ${await res.text()}`);

  const data = await res.json();
  if (!data.access_token) throw new Error(`Twitch OAuth response had no access_token: ${JSON.stringify(data).slice(0, 500)}`);

  cached = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return cached.token;
}
