import Link from "next/link";
import { WowIcon } from "@/components/WowIcon";
import { classIconSlug } from "@/game/icons";
import { classById } from "@/game/classes";
import type { DisplayIdentityDTO } from "@/data/dto";

/** A friend/request row's "who is this" — class icon (or a battletag-initial
 * fallback if they have no characters synced yet) + name, linking to their
 * public profile when one exists. Shared by the Network page, request rows,
 * and the chat header so identity always renders the same way.
 *
 * preferBattletag: for messaging surfaces, where the label needs to stay
 * stable no matter which character the other person currently has selected
 * as main - characterName is a live lookup, not stored per-message, so it
 * can silently change out from under an open thread. Battletag never does;
 * the class icon still follows their main character, that part's harmless. */
export function IdentityBadge({
  identity, size = 36, preferBattletag = false,
}: { identity: DisplayIdentityDTO; size?: number; preferBattletag?: boolean }) {
  const label = preferBattletag
    ? identity.battletag ?? identity.characterName ?? "Unknown player"
    : identity.characterName ?? identity.battletag?.split("#")[0] ?? "Unknown player";
  const sub = identity.characterRealm ?? null;

  const avatar = (
    <WowIcon
      slug={identity.classId ? classIconSlug(identity.classId) : undefined}
      size={size}
      cdnSize="medium"
      rounded="full"
      fallbackGlyph={label.slice(0, 1).toUpperCase()}
      fallbackColor={identity.classId ? (classById(identity.classId)?.color ?? "#888") : "#888"}
      title={label}
    />
  );

  return (
    <div className="flex items-center gap-2 min-w-0">
      {identity.characterRealmSlug && identity.characterName ? (
        <Link href={`/u/${encodeURIComponent(identity.characterRealmSlug)}/${encodeURIComponent(identity.characterName)}`} className="shrink-0">
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-100 truncate">{label}</div>
        {sub && <div className="text-[11px] text-gray-500 truncate">{sub}</div>}
      </div>
    </div>
  );
}
