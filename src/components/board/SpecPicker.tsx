"use client";

import { SPECS_BY_ROLE, ROLE_LABEL } from "../GroupFormShared";
import { SpecIcon } from "../SpecIcon";
import type { Role } from "@/game/classes";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["TANK", "HEALER", "DPS"];

/** The exclude-specs multi-toggle in both boards' filter sidebars -
 * role-grouped spec icons that light up when selected. */
export function SpecPicker({
  selected, onToggle,
}: { selected: Set<string>; onToggle: (specId: string) => void }) {
  return (
    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
      {ROLES.map((role) => (
        <div key={role}>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{ROLE_LABEL[role]}</div>
          <div className="flex flex-wrap gap-1.5">
            {SPECS_BY_ROLE[role].map((sp) => {
              const on = selected.has(sp.id);
              return (
                <button
                  key={sp.id}
                  onClick={() => onToggle(sp.id)}
                  title={sp.name}
                  className={cn(
                    "rounded-md p-0.5 border transition",
                    on ? "border-accent bg-accent/10" : "border-transparent opacity-40 hover:opacity-80"
                  )}
                >
                  <SpecIcon specId={sp.id} size={26} showRole={false} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
