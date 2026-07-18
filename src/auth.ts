import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const region = (process.env.BLIZZARD_REGION || "eu").toLowerCase();

// Auth host is global (oauth.battle.net) except mainland China.
const AUTH_HOST = region === "cn" ? "https://oauth.battlenet.com.cn" : "https://oauth.battle.net";

// Only enable the provider when credentials exist, so the app runs without them.
export const bnetEnabled = Boolean(
  process.env.BLIZZARD_CLIENT_ID && process.env.BLIZZARD_CLIENT_SECRET
);

// Custom Battle.net provider as plain OAuth2 (NOT OIDC).
// Battle.net injects its own `nonce` claim into the id_token even when none is
// sent, which oauth4webapi rejects in OIDC mode ("unexpected nonce claim").
// Running as OAuth2 skips id_token validation and reads the BattleTag from /userinfo.
const battlenet: NextAuthConfig["providers"][number] = {
  id: "battlenet",
  name: "Battle.net",
  type: "oauth",
  clientId: process.env.BLIZZARD_CLIENT_ID,
  clientSecret: process.env.BLIZZARD_CLIENT_SECRET,
  checks: ["pkce", "state"],
  authorization: {
    url: `${AUTH_HOST}/authorize`,
    // No `openid` -> Battle.net returns NO id_token, so oauth4webapi skips
    // id_token issuer/nonce validation (both of which Battle.net violates).
    // Identity comes from /userinfo instead. `wow.profile` enables char import later.
    params: { scope: "wow.profile" },
  },
  token: `${AUTH_HOST}/token`,
  userinfo: `${AUTH_HOST}/userinfo`,
  style: { brandColor: "#148eff" },
  // /userinfo -> { sub, id, battletag }
  profile(profile: { sub: string; id?: number; battletag?: string }) {
    return {
      id: profile.sub,
      name: profile.battletag ?? null,
      email: null,
      image: null,
    };
  },
};

// Dev-only login bypass — lets you sign in as a seeded fake user (see
// prisma/seed.ts) without a real Battle.net account. Real Battle.net OAuth
// can never authenticate a fake account, so this is the only way to exercise
// logged-in flows with test data. Two hard gates keep this out of prod:
// (1) ALLOW_DEV_LOGIN must be explicitly "1" (not just NODE_ENV, which can be
// misconfigured), and (2) authorize() only ever accepts bnetIds that already
// exist in the DB AND start with "dev-fake-" — never an arbitrary or real id,
// so flipping the flag on by accident can't be used to impersonate a real user.
export const devLoginEnabled = process.env.ALLOW_DEV_LOGIN === "1";

const devLogin: NextAuthConfig["providers"][number] = Credentials({
  id: "dev-login",
  name: "Dev Login",
  credentials: { bnetId: { label: "Fake bnetId", type: "text" } },
  async authorize(creds) {
    const bnetId = typeof creds?.bnetId === "string" ? creds.bnetId : null;
    if (!bnetId || !bnetId.startsWith("dev-fake-")) return null;
    const user = await prisma.user.findUnique({ where: { bnetId } });
    if (!user) return null;
    return { id: user.bnetId, name: user.battletag, email: null, image: null };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
  providers: [...(bnetEnabled ? [battlenet] : []), ...(devLoginEnabled ? [devLogin] : [])],
  callbacks: {
    // Persist BattleTag + Blizzard access token + account id so we can call the
    // WoW profile API on the user's behalf.
    async jwt({ token, user, account, profile }) {
      if (user?.name) token.battletag = user.name;
      if (account?.access_token) token.accessToken = account.access_token;
      const sub = (profile as { sub?: string } | undefined)?.sub ?? account?.providerAccountId ?? user?.id;
      if (sub) token.bnetId = sub;
      return token;
    },
    async session({ session, token }) {
      const tag = token.battletag as string | undefined;
      if (tag) session.user.name = tag;
      const s = session as typeof session & {
        battletag?: string;
        accessToken?: string;
        bnetId?: string;
      };
      s.battletag = tag;
      s.accessToken = token.accessToken as string | undefined;
      s.bnetId = token.bnetId as string | undefined;
      return session;
    },
  },
});
