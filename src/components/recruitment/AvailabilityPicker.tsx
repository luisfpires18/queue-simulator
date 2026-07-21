"use client";

import { useState } from "react";
import { DAY_LABELS, DAY_LABELS_LONG, formatMinutes, type WeeklySlot } from "@/game/availability";
import { FilterChip } from "@/components/ui/Filters";

/** Weekly schedule editor, shared by M+ posts, raid teams and raider profiles.
 *
 * Deliberately not a drag-on-a-grid: recruitment schedules are almost always
 * "these days, this time window", so picking days and then one time range
 * covers the real cases in two interactions instead of fourteen. A per-day
 * override is available for the minority who genuinely differ by night. */
export function AvailabilityPicker({
  value,
  onChange,
  label = "Availability",
}: {
  value: WeeklySlot[];
  onChange: (next: WeeklySlot[]) => void;
  label?: string;
}) {
  // Derived from the current value rather than held separately, so editing an
  // existing post shows what was saved.
  const days = [...new Set(value.map((s) => s.day))].sort((a, b) => a - b);
  const first = value[0];
  const [start, setStart] = useState(first ? formatMinutes(first.startMin) : "20:00");
  const [end, setEnd] = useState(first ? formatMinutes(first.endMin) : "23:00");
  const [perDay, setPerDay] = useState(false);

  const startMin = parseTime(start);
  const endMin = parseTime(end);

  function toggleDay(day: number) {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    emit(next, startMin, endMin);
  }

  function emit(nextDays: number[], s: number, e: number) {
    onChange(nextDays.sort((a, b) => a - b).map((day) => ({ day, startMin: s, endMin: e })));
  }

  function setDayTime(day: number, which: "start" | "end", raw: string) {
    const min = parseTime(raw);
    onChange(
      value.map((slot) =>
        slot.day === day ? { ...slot, [which === "start" ? "startMin" : "endMin"]: min } : slot
      )
    );
  }

  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </span>

      <div className="flex flex-wrap gap-1.5">
        {DAY_LABELS.map((d, i) => (
          <FilterChip
            key={d}
            label={d}
            title={DAY_LABELS_LONG[i]}
            selected={days.includes(i)}
            onClick={() => toggleDay(i)}
          />
        ))}
      </div>

      {days.length > 0 && !perDay && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <TimeInput label="From" value={start} onChange={(v) => { setStart(v); emit(days, parseTime(v), endMin); }} />
          <TimeInput label="To" value={end} onChange={(v) => { setEnd(v); emit(days, startMin, parseTime(v)); }} />
          {endMin <= startMin && (
            // Not an error: a 22:00-01:00 raid night is normal and the overlap
            // math handles it. Said out loud so it doesn't look like a typo.
            <p className="text-[11px] text-gray-500">Runs past midnight into the next day.</p>
          )}
        </div>
      )}

      {days.length > 1 && (
        <button
          type="button"
          onClick={() => setPerDay((p) => !p)}
          className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-accent hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          {perDay ? "Use the same time every day" : "Set a different time per day"}
        </button>
      )}

      {perDay && (
        <div className="mt-3 space-y-2">
          {value.map((slot) => (
            <div key={slot.day} className="flex flex-wrap items-end gap-3">
              <span className="w-10 pb-1.5 text-xs font-semibold text-gray-400">{DAY_LABELS[slot.day]}</span>
              <TimeInput
                label="From"
                value={formatMinutes(slot.startMin)}
                onChange={(v) => setDayTime(slot.day, "start", v)}
              />
              <TimeInput
                label="To"
                value={formatMinutes(slot.endMin)}
                onChange={(v) => setDayTime(slot.day, "end", v)}
              />
            </div>
          ))}
        </div>
      )}

      {!days.length && (
        <p className="mt-2 text-[11px] text-gray-600">
          Pick the days you play. Schedules are matched against other listings, so this is worth filling in.
        </p>
      )}
    </div>
  );
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-panelborder bg-panel2 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </label>
  );
}

/** "20:30" -> 1230. Falls back to 0 on anything unparseable rather than
 * producing NaN, which would poison the stored slot. */
function parseTime(v: string): number {
  const [h, m] = v.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.min(1439, Math.max(0, h * 60 + m));
}
