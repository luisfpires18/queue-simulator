"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CharacterDTO } from "@/data/source";
import { classById, specById } from "@/game/classes";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { classIconSlug } from "@/game/icons";
import { flag } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function CharacterManager({ initial }: { initial: CharacterDTO[] }) {
  const [chars] = useState(initial);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const sync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/characters/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setMsg(data.error ?? "Sync failed");
      else setMsg(`Imported ${data.imported} character${data.imported === 1 ? "" : "s"}.`);
      router.refresh();
    } catch {
      setMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const setMain = (characterId: string) => {
    start(async () => {
      await fetch("/api/characters/main", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={sync} disabled={syncing} className="btn-gold">
          {syncing ? "Syncing…" : "Sync characters"}
        </button>
        {msg && <span className="text-sm text-gray-400">{msg}</span>}
      </div>

      {chars.length === 0 ? (
        <div className="panel p-10 text-center text-gray-500">
          No characters yet. Hit “Sync characters”.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {chars.map((c) => {
            const cls = classById(c.classId);
            const spec = c.specId ? specById(c.specId) : null;
            return (
              <div
                key={c.id}
                className={cn(
                  "panel p-3 flex flex-col items-center gap-2 relative",
                  c.isMain && "ring-2 ring-gold"
                )}
              >
                <button
                  onClick={() => setMain(c.id)}
                  disabled={pending}
                  title={c.isMain ? "Main" : "Set as main"}
                  className={cn(
                    "absolute top-2 right-2 text-lg leading-none",
                    c.isMain ? "text-gold" : "text-gray-600 hover:text-gold"
                  )}
                >
                  {c.isMain ? "★" : "☆"}
                </button>
                {c.specId ? (
                  <SpecIcon specId={c.specId} size={48} />
                ) : (
                  <WowIcon slug={classIconSlug(c.classId)} size={48} fallbackColor={cls?.color} />
                )}
                <div className="text-center">
                  <div className="text-sm font-bold truncate max-w-[7rem]" style={{ color: cls?.color }}>
                    {c.name}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {spec ? `${spec.name} · ` : ""}{cls?.name}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {flag(c.region === "eu" ? null : c.region)} {c.realm} · {c.ilvl ? `${c.ilvl} ilvl` : `lvl ${c.level}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
