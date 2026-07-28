"use client";

import { useRef, useState } from "react";
import { BANNER_OPTIONS, bannerSpec } from "@/game/banners";
import { iconUrl } from "@/game/icons";
import { ImageResizeError, resizeToBanner } from "@/lib/imageResize";
import { ProfileBanner } from "./ProfileBanner";

export interface BannerValue {
  bannerType: string;
  bannerClassId: string | null;
  bannerImage: string | null;
}

export function BannerPicker({
  value,
  mainClassId,
  onPickClass,
  onUploadChange,
}: {
  value: BannerValue;
  mainClassId: string | null;
  /** Persisted by the parent through /api/profile/settings. */
  onPickClass: (classId: string | null) => void;
  /** Called after the banner route has already persisted the change. */
  onUploadChange: (next: { bannerType: string; bannerImage: string | null }) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const blob = await resizeToBanner(file);
      const form = new FormData();
      form.append("file", blob, "banner.webp");
      const res = await fetch("/api/profile/banner", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Upload failed.");
      onUploadChange({ bannerType: data.bannerType, bannerImage: data.bannerImage });
    } catch (e) {
      setError(e instanceof ImageResizeError || e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removeUpload = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/profile/banner", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove the image.");
      onUploadChange({ bannerType: "class", bannerImage: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Profile banner</label>

      <ProfileBanner {...value} fallbackClassId={mainClassId} standalone />

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="btn btn-gold disabled:opacity-50">
          {busy ? "Working…" : value.bannerImage ? "Replace image" : "Upload image"}
        </button>
        {value.bannerImage && (
          <button type="button" onClick={removeUpload} disabled={busy} className="btn btn-ghost disabled:opacity-50">
            Remove image
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-2">{error}</p>}
      <p className="text-[11px] text-gray-500 mt-2">
        Cropped to 1600x400 in your browser before uploading. WebP, JPEG or PNG, up to 2 MB.
      </p>

      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
          {value.bannerType === "upload" ? "Used if your image ever fails to load" : "Class banner"}
        </div>
        <div className="flex flex-wrap gap-2">
          {BANNER_OPTIONS.map((opt) => {
            const selected = (value.bannerClassId ?? null) === opt.classId;
            // The "follow my main" swatch previews what it will actually render.
            const spec = opt.classId === null ? bannerSpec(mainClassId) : opt.spec;
            return (
              <button
                key={opt.classId ?? "neutral"}
                type="button"
                title={opt.name}
                onClick={() => onPickClass(opt.classId)}
                className={`relative h-11 w-16 overflow-hidden rounded-md border transition-colors ${
                  selected ? "border-accent" : "border-panelborder hover:border-gray-500"
                }`}
                style={{ background: spec.background }}
              >
                {spec.watermarkSlug && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconUrl(spec.watermarkSlug, "medium")} alt="" loading="lazy" decoding="async" className="absolute inset-0 m-auto h-7 w-7 opacity-60" draggable={false} />
                )}
              </button>
            );
          })}
        </div>
        {!value.bannerClassId && (
          <p className="text-[11px] text-gray-500 mt-2">
            The first swatch follows your main character&apos;s class. Pick any other to fix the colour.
          </p>
        )}
      </div>
    </div>
  );
}
