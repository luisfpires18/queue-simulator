"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import { apiFetch } from "@/lib/api-client";
import { VISIBILITY_OPTIONS, grantsApply, type Visibility } from "@/game/features";
import { formatListingAge } from "@/game/expiry";
import { inputClass } from "@/components/ui/Filters";
import type { FeatureState, GrantRow } from "@/data/features";

export function FeatureControls({
  initialFeatures,
  initialGrants,
}: {
  initialFeatures: FeatureState[];
  initialGrants: Record<string, GrantRow[]>;
}) {
  const [features, setFeatures] = useState(initialFeatures);
  const [grants, setGrants] = useState(initialGrants);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setVisibility(key: string, visibility: Visibility) {
    setBusy(key);
    setError(null);
    // Optimistic: the radio should move the instant it is clicked, and the
    // server answer replaces it a moment later.
    setFeatures((all) =>
      all.map((f) => (f.feature.key === key ? { ...f, visibility, usingDefault: false } : f))
    );
    try {
      const res = await apiPost<{ features: FeatureState[] }>(
        "/api/admin/features",
        { key, visibility },
        "PATCH"
      );
      setFeatures(res.features);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change that.");
      // Put the old value back rather than leaving the UI lying.
      setFeatures(initialFeatures);
    } finally {
      setBusy(null);
    }
  }

  async function grant(key: string, bnetId: string, note: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await apiPost<{ grants: GrantRow[] }>("/api/admin/features/grants", {
        key,
        bnetId,
        note: note || null,
      });
      setGrants((g) => ({ ...g, [key]: res.grants }));
      // Grant count lives on the feature row, so refresh it too.
      const fresh = await apiFetch<{ features: FeatureState[] }>("/api/admin/features");
      setFeatures(fresh.features);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that grant.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(key: string, bnetId: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await apiPost<{ grants: GrantRow[] }>(
        "/api/admin/features/grants",
        { key, bnetId },
        "DELETE"
      );
      setGrants((g) => ({ ...g, [key]: res.grants }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that grant.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="panel px-4 py-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      {features.map((f) => (
        <FeatureCard
          key={f.feature.key}
          state={f}
          grants={grants[f.feature.key] ?? []}
          busy={busy === f.feature.key}
          onVisibility={(v) => setVisibility(f.feature.key, v)}
          onGrant={(bnetId, note) => grant(f.feature.key, bnetId, note)}
          onRevoke={(bnetId) => revoke(f.feature.key, bnetId)}
        />
      ))}
    </div>
  );
}

function FeatureCard({
  state,
  grants,
  busy,
  onVisibility,
  onGrant,
  onRevoke,
}: {
  state: FeatureState;
  grants: GrantRow[];
  busy: boolean;
  onVisibility: (v: Visibility) => void;
  onGrant: (bnetId: string, note: string) => void;
  onRevoke: (bnetId: string) => void;
}) {
  const [bnetId, setBnetId] = useState("");
  const [note, setNote] = useState("");
  const showGrants = grantsApply(state.visibility);

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white">{state.feature.label}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{state.feature.description}</p>
        </div>
        {state.usingDefault && (
          // Says the value is a default rather than someone's choice.
          <span className="chip shrink-0 bg-panel2 text-gray-500">Default</span>
        )}
      </div>

      <fieldset className="mt-3" disabled={busy}>
        <legend className="sr-only">Who can access {state.feature.label}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {VISIBILITY_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-lg border p-2.5 transition-colors ${
                state.visibility === o.value
                  ? "border-accent bg-accent/10"
                  : "border-panelborder hover:border-gray-600"
              } ${busy ? "opacity-50" : ""}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`visibility-${state.feature.key}`}
                  value={o.value}
                  checked={state.visibility === o.value}
                  onChange={() => onVisibility(o.value)}
                  className="accent-accent"
                />
                <span className="text-sm font-semibold text-gray-200">{o.label}</span>
              </span>
              <span className="mt-1 block text-[11px] text-gray-500">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 border-t border-panelborder pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Invites ({grants.length})
          </h3>
          {!showGrants && (
            // Otherwise it looks like the grants are doing nothing for no reason.
            <span className="text-[11px] text-gray-600">
              {state.visibility === "public"
                ? "Not needed while this is public."
                : "Ignored while this is admin only."}
            </span>
          )}
        </div>

        {grants.length > 0 && (
          <ul className="mt-2 space-y-1">
            {grants.map((g) => (
              <li
                key={g.bnetId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-panelborder px-2.5 py-1.5"
              >
                <span className="min-w-0">
                  <span className="text-sm text-gray-200">{g.battletag ?? g.bnetId}</span>
                  {!g.battletag && (
                    // The invite is valid but unused - worth distinguishing
                    // from a typo'd id.
                    <span className="ml-1.5 text-[11px] text-gray-600">not signed in yet</span>
                  )}
                  {g.note && <span className="block text-[11px] text-gray-600">{g.note}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-gray-600">
                    {formatListingAge(g.createdAt).toLowerCase()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRevoke(g.bnetId)}
                    disabled={busy}
                    className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                  >
                    Revoke
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!bnetId.trim()) return;
            onGrant(bnetId.trim(), note.trim());
            setBnetId("");
            setNote("");
          }}
          className="mt-2 flex flex-wrap items-end gap-2"
        >
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[11px] uppercase tracking-widest text-gray-600">
              Battle.net id
            </span>
            <input
              value={bnetId}
              onChange={(e) => setBnetId(e.target.value)}
              placeholder="e.g. 123456789"
              className={inputClass}
            />
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[11px] uppercase tracking-widest text-gray-600">
              Note (optional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="who this is"
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={busy || !bnetId.trim()} className="btn-ghost">
            Invite
          </button>
        </form>
        <p className="mt-1 text-[11px] text-gray-600">
          Works before they have ever signed in - the grant is keyed to the Battle.net id, not an account.
        </p>
      </div>
    </section>
  );
}
