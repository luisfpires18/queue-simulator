"use client";

import { useEffect, useState } from "react";
import { CLASS_BY_ID, type ClassId } from "@/game/classes";

interface ZoneOption { id: number; name: string; patch: string | null }

interface SpecTrack {
  specId: string;
  role: string;
  points: number | null;
  isMain?: boolean;
}

export function CharacterSettings({
  characterId,
  classId,
  wclZone,
  specTracks,
  onSaved,
}: {
  characterId: string;
  classId: string;
  wclZone: string | null;
  specTracks: SpecTrack[];
  onSaved: () => void;
}) {
  const specs = CLASS_BY_ID[classId as ClassId]?.specs ?? [];
  const [zone, setZone] = useState(wclZone ?? "");
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set(specTracks.map((s) => s.specId)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wcl/dungeon-zones")
      .then((r) => r.json())
      .then((d) => setZones(d.zones ?? []))
      .catch(() => {});
  }, []);

  function toggle(specId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const zoneRes = await fetch(`/api/wcl/characters/${characterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wclZone: zone }),
      });
      if (!zoneRes.ok) throw new Error((await zoneRes.json()).error);

      const specsBody = [...checked].map((specId) => ({
        specId,
        points: specTracks.find((s) => s.specId === specId)?.points ?? null,
      }));
      if (specsBody.length) {
        const specsRes = await fetch(`/api/wcl/characters/${characterId}/specs`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ specs: specsBody }),
        });
        if (!specsRes.ok) throw new Error((await specsRes.json()).error);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <h3 className="text-sm font-bold">Parse-tracking settings</h3>
      <label className="text-xs text-gray-400 flex flex-col gap-1">
        Warcraft Logs zone
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="bg-panel2 border border-panelborder rounded px-2 py-1 text-sm w-64"
        >
          <option value="">Select a zone…</option>
          {zone && !zones.some((z) => String(z.id) === zone) && (
            <option value={zone}>Zone #{zone} (not in current list)</option>
          )}
          {zones.map((z) => (
            <option key={z.id} value={String(z.id)}>{z.name}</option>
          ))}
        </select>
      </label>
      <div>
        <div className="text-xs text-gray-400 mb-1">Specs to track (which of your logged specs to include)</div>
        <div className="flex flex-wrap gap-2">
          {specs.map((s) => (
            <label key={s.id} className="chip border border-panelborder cursor-pointer">
              <input type="checkbox" checked={checked.has(s.id)} onChange={() => toggle(s.id)} className="mr-1" />
              {s.name} <span className="text-gray-500 ml-1">({s.role})</span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <button onClick={save} disabled={saving} className="btn-gold text-xs px-3 py-1.5 self-start">
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
