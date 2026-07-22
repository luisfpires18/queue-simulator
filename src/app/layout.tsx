import type { Metadata, Viewport } from "next";
import { Overpass } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SEASON } from "@/game/season";
import { HeaderAuth } from "@/components/HeaderAuth";
import { CurrentCharacterNav } from "@/components/CurrentCharacterNav";
import { SwRegister } from "@/components/SwRegister";
import { auth } from "@/auth";
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

  return (
    <html lang="en" className={overpass.variable}>
      <body className="antialiased" suppressHydrationWarning>
        <SwRegister />
        <Providers>
          <header className="sticky top-0 z-30 bg-panel/80 backdrop-blur border-b border-panelborder" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div className="mx-auto max-w-6xl px-5 h-14 flex items-center gap-1">
              <Link href="/" className="mr-6 font-black tracking-tight text-[15px] uppercase">
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
                <span className="text-[11px] uppercase tracking-widest text-gray-500 hidden md:block">
                  {SEASON.expansion} · S{SEASON.season}
                </span>
                <CurrentCharacterNav />
                <HeaderAuth />
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
                    <span className="block text-[11px] uppercase tracking-widest text-gray-500 px-3">
                      {SEASON.expansion} · S{SEASON.season}
                    </span>
                    <div className="px-3">
                      <CurrentCharacterNav />
                    </div>
                    <div className="px-3">
                      <HeaderAuth />
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
