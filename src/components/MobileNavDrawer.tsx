"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ChatGPT-style mobile nav: a hamburger button that slides in a left drawer
// over a dimmed overlay. Every item inside is still server-rendered by
// RootLayout (auth-gated links, CurrentCharacterNav, HeaderAuth) and just
// passed through as children - this component only owns the open/close state
// and the drawer chrome, never re-renders server logic itself.
//
// The overlay+panel are portaled straight to document.body rather than
// rendered where this component sits in the tree. The header they'd
// otherwise nest under uses backdrop-blur, and backdrop-filter establishes a
// containing block for position:fixed descendants on Safari/iOS - without
// the portal the "fixed" overlay/drawer get trapped inside the header's own
// small box instead of covering the viewport, letting page content bleed
// through underneath them.
export function MobileNavDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="w-9 h-9 grid place-items-center rounded-lg text-gray-300 hover:text-white hover:bg-panel2"
        >
          <span className="text-lg leading-none">☰</span>
        </button>
      )}

      {mounted &&
        createPortal(
          <>
            <div
              className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
                open ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              onClick={() => setOpen(false)}
            />
            <div
              className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[80vw] bg-panel border-r border-panelborder transition-transform duration-200 ${
                open ? "translate-x-0" : "-translate-x-full"
              }`}
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="h-14 px-4 flex items-center justify-between border-b border-panelborder">
                <span className="font-black tracking-tight text-[15px] uppercase">
                  <span className="text-accent">Queue</span> Simulator
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="w-8 h-8 grid place-items-center rounded-lg text-gray-400 hover:text-white hover:bg-panel2"
                >
                  ✕
                </button>
              </div>
              <div
                className="p-3 space-y-3 overflow-y-auto h-[calc(100%-3.5rem)]"
                onClick={(e) => {
                  // Close on an actual nav link (navigation happens either
                  // way), but not on clicks inside widgets like the character
                  // picker or logout button - those need their own click to
                  // register.
                  if ((e.target as HTMLElement).closest("a")) setOpen(false);
                }}
              >
                {children}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
