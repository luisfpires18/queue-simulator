import type { Metadata, Viewport } from "next";
import { Overpass } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SEASON } from "@/game/season";
import { HeaderAuth } from "@/components/HeaderAuth";
import { CurrentCharacterNav } from "@/components/CurrentCharacterNav";
import { SwRegister } from "@/components/SwRegister";
import { viewableFeatures, viewerIsAdmin } from "@/server/features";
import { FEATURES } from "@/game/features";
import Link from "next/link";

// Overpass = open-source Highway Gothic / Expressway clone. Clean, wide, signage-like.
const overpass = Overpass({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-overpass",
  display: "swap",
});

export const metadata: Metadata = {
  title: "M+ Queue Simulator",
  description: "Smart Mythic+ group finder and parse analysis for WoW Midnight. Comp analysis, utility coverage, meta detection, and top-player parse comparison.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-panel2 transition-colors">
      {children}
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nav entries for gated features only render for someone who can actually
  // reach them - otherwise the alpha announces itself with links that 404.
  // One auth() call covers all three (see viewableFeatures).
  const visible = await viewableFeatures(FEATURES.map((f) => f.key));
  const isAdmin = await viewerIsAdmin();

  return (
    <html lang="en" className={overpass.variable}>
      <body className="antialiased" suppressHydrationWarning>
        <SwRegister />
        <Providers>
          <header className="sticky top-0 z-30 bg-panel/80 backdrop-blur border-b border-panelborder">
            <div className="mx-auto max-w-6xl px-5 h-14 flex items-center gap-1">
              <Link href="/" className="mr-6 shrink-0 font-black tracking-tight text-[15px] uppercase">
                M+<span className="text-accent">Queue</span> Sim
              </Link>
              {/* Four entries no longer fit a narrow phone, so the nav group
                  scrolls sideways rather than wrapping the header onto two rows. */}
              <nav className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <NavLink href="/runs">M+ Runs</NavLink>
                <NavLink href="/raids">Raids</NavLink>
                {visible.has("recruitment") && <NavLink href="/recruitment">Recruitment</NavLink>}
                {visible.has("guilds") && <NavLink href="/guilds">Guilds</NavLink>}
                {/* Previously reachable only by typing the URL. */}
                {visible.has("analyses") && <NavLink href="/analyses">Analyses</NavLink>}
                {isAdmin && <NavLink href="/admin">Admin</NavLink>}
              </nav>
              <div className="ml-auto flex shrink-0 items-center gap-4">
                <span className="text-[11px] uppercase tracking-widest text-gray-500 hidden md:block">
                  {SEASON.expansion} · S{SEASON.season}
                </span>
                <CurrentCharacterNav />
                <HeaderAuth />
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
