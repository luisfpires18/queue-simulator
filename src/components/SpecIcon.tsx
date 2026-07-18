import { specById, CLASS_BY_ID } from "@/game/classes";
import { SPEC_ICON } from "@/game/icons";
import { WowIcon } from "./WowIcon";
import { RoleIcon } from "./RoleIcon";
import { cn } from "@/lib/utils";

const ROLE_RING: Record<string, string> = {
  TANK: "ring-sky-400/70",
  HEALER: "ring-emerald-400/70",
  DPS: "ring-rose-400/70",
};

export function SpecIcon({
  specId,
  size = 40,
  showRole = true,
  title,
  dim = false,
}: {
  specId: string;
  size?: number;
  showRole?: boolean;
  title?: string;
  dim?: boolean; // desired-but-unfilled slot: grayscale until a player fills it
}) {
  const spec = specById(specId);
  const cls = spec ? CLASS_BY_ID[spec.classId] : null;
  const label = spec && cls ? `${spec.name} ${cls.name}` : specId;

  return (
    <div className={cn("relative inline-block", dim && "grayscale opacity-50")} style={{ width: size, height: size }}>
      <div className={cn("rounded-md ring-2 overflow-hidden", showRole && spec ? ROLE_RING[spec.role] : "ring-transparent")}>
        <WowIcon
          slug={SPEC_ICON[specId]}
          size={size}
          title={title ?? label}
          fallbackGlyph={spec?.name.slice(0, 2).toUpperCase()}
          fallbackColor={cls?.color ?? "#888"}
        />
      </div>
      {showRole && spec && (
        <span
          className="absolute -bottom-1 -right-1 rounded-full bg-black/90 border border-panelborder flex items-center justify-center overflow-hidden"
          style={{ width: size * 0.44, height: size * 0.44 }}
        >
          <RoleIcon role={spec.role} size={Math.round(size * 0.34)} rounded="full" />
        </span>
      )}
    </div>
  );
}
