import type { Metadata, Viewport } from "next";
import { Overpass } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AccountMenu } from "@/components/AccountMenu";
import { SwRegister } from "@/components/SwRegister";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { isAdminBattletag } from "@/lib/admin";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import Link from "next/link";

// Overpass = open-source Highway Gothic / Expressway clone. Clean, wide, signage-like.
const overpass = Overpass({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-overpass",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Queue Simulator",
  description: "Smart Mythic+ group finder and parse analysis for WoW Midnight. Comp analysis, utility coverage, meta detection, and top-player parse comparison.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  // iOS ignores manifest.json for "Add to Home Screen" - without these it
  // opens the installed icon in plain Safari chrome instead of standalone.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Queue Simulator",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  viewportFit: "cover",
  // Without this, iOS/Android leave the layout viewport alone when the
  // on-screen keyboard opens and just shrink the visual viewport instead —
  // any 100vh/100dvh-sized fixed layout (the chat thread, its input bar)
  // ends up partly hidden behind the keyboard. "resizes-content" makes the
  // layout viewport itself shrink, so dvh-based heights stay correct.
  interactiveWidget: "resizes-content",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block px-3 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-panel2 transition-colors">
      {children}
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  const loggedIn = Boolean(s?.user && s?.bnetId);
  const isAdmin = isAdminBattletag(s?.battletag);
  // Group chat bubbles need "is this message mine" against potentially many
  // senders (see ChatDockContext) — resolved once here, same ensureUser call
  // AccountMenu makes independently for its own data.
  const currentUserId = loggedIn ? (await ensureUser(s!.bnetId!, s!.battletag)).id : undefined;

  return (
    <html lang="en" className={overpass.variable}>
      <body className="antialiased" suppressHydrationWarning>
        <SwRegister />
        <Providers currentUserId={currentUserId}>
          <header className="sticky top-0 z-30 bg-panel/80 backdrop-blur border-b border-panelborder" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div className="mx-auto max-w-6xl px-5 h-14 flex items-center gap-1">
              <Link href="/" className="mr-6 flex items-center gap-2 font-black tracking-tight text-[15px] uppercase">
                <img src="/icons/icon-192.png" alt="" width={24} height={24} className="shrink-0" />
                <span className="text-accent">Queue</span> Simulator
              </Link>

              {/* Desktop: full inline nav, unchanged. */}
              <div className="hidden sm:flex items-center gap-1">
                <NavLink href="/runs">M+ Runs</NavLink>
                <NavLink href="/raids">Raids</NavLink>
                {loggedIn && <NavLink href="/improvement">Parse Improvement</NavLink>}
              </div>
              <div className="ml-auto hidden sm:flex items-center gap-4">
                {isAdmin && (
                  <Link href="/admin" className="chip bg-panel2 border border-panelborder text-gray-200 hover:border-accent/50">
                    Admin
                  </Link>
                )}
                <AccountMenu />
              </div>

              {/* Mobile: everything above collapses behind a hamburger + slide-in drawer. */}
              <div className="ml-auto sm:hidden">
                <MobileNavDrawer>
                  <div className="flex flex-col gap-1">
                    <NavLink href="/runs">M+ Runs</NavLink>
                    <NavLink href="/raids">Raids</NavLink>
                    {loggedIn && <NavLink href="/improvement">Parse Improvement</NavLink>}
                    {isAdmin && <NavLink href="/admin">Admin</NavLink>}
                  </div>
                  <div className="pt-3 mt-1 border-t border-panelborder space-y-3">
                    <div className="px-3">
                      <AccountMenu />
                    </div>
                  </div>
                </MobileNavDrawer>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-5 py-10 text-[11px] uppercase tracking-widest text-gray-600">
            Not affiliated with Blizzard
          </footer>
        </Providers>
      </body>
    </html>
  );
}
