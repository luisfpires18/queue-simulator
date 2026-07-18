import { ratingTier } from "@/game/season";

export function RatingBadge({ rating, size = "md" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const tier = ratingTier(rating);
  const pad = size === "lg" ? "px-3 py-1 text-lg" : size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold tabular-nums ${pad}`}
      style={{ color: tier.hex, background: `${tier.hex}1a`, border: `1px solid ${tier.hex}44` }}
      title={`${tier.label} tier`}
    >
      {rating.toLocaleString()}
    </span>
  );
}
