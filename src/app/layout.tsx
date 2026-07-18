import type { Metadata, Viewport } from "next";
import { Overpass } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SEASON } from "@/game/season";
import { HeaderAuth } from "@/components/HeaderAuth";
import { CurrentCharacterNav } from "@/components/CurrentCharacterNav";
import { SwRegister } from "@/components/SwRegister";
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
    <Link href={href} className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-panel2 transition-colors">
      {children}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={overpass.variable}>
      <body className="antialiased" suppressHydrationWarning>
        <SwRegister />
        <Providers>
          <header className="sticky top-0 z-30 bg-panel/80 backdrop-blur border-b border-panelborder">
            <div className="mx-auto max-w-6xl px-5 h-14 flex items-center gap-1">
              <Link href="/" className="mr-6 font-black tracking-tight text-[15px] uppercase">
                M+<span className="text-accent">Queue</span> Sim
              </Link>
              <NavLink href="/runs">M+ Runs</NavLink>
              <NavLink href="/raids">Raids</NavLink>
              <div className="ml-auto flex items-center gap-4">
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
