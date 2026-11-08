"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useOptimistic, useTransition, type ReactNode } from "react";
import { formatWeight, UNITS, type Unit, type UnitKind, type UnitPrefs } from "@/lib/units";
import { setPreferredUnit } from "@/server/user/actions";

const UnitContext = createContext<UnitPrefs>({ sbd: "kg", general: "kg" });

/** Makes the signed-in person's units available to every weight on the page. */
export function UnitProvider({ units, children }: { units: UnitPrefs; children: ReactNode }) {
  return <UnitContext.Provider value={units}>{children}</UnitContext.Provider>;
}

/** The viewer's unit for squat/bench/deadlift ("sbd") or everything else ("general"). */
export function useUnit(kind: UnitKind = "general"): Unit {
  return useContext(UnitContext)[kind];
}

/**
 * Shows a load stored in kg in the viewer's unit.
 * <Weight kg={142.5} sbd /> → "142.5 kg" or "314.2 lb", following the SBD setting.
 */
export function Weight({ kg, sbd = false }: { kg: number | null | undefined; sbd?: boolean }) {
  return <>{formatWeight(kg, useUnit(sbd ? "sbd" : "general"))}</>;
}

function Toggle({ kind, label }: { kind: UnitKind; label: string }) {
  const saved = useUnit(kind);
  const [unit, setUnit] = useOptimistic(saved);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <span className="font-heading text-muted text-[0.65rem] font-semibold tracking-[0.15em] uppercase">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={`${label} weight unit`}
        className="border-border flex border text-xs"
        aria-busy={pending}
      >
        {UNITS.map((u) => (
          <button
            key={u}
            role="radio"
            aria-checked={unit === u}
            onClick={() =>
              start(async () => {
                setUnit(u);
                await setPreferredUnit(kind, u);
                router.refresh();
              })
            }
            className={`font-heading px-2 py-1 font-semibold tracking-[0.12em] uppercase transition-colors ${
              unit === u
                ? "bg-primary text-primary-foreground"
                : "text-subtle hover:text-foreground"
            }`}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Two KG | LB switches: SBD (squat, bench, deadlift) and Other. Saved to the
 * account, so they follow the person to every device.
 */
export function UnitToggle() {
  return (
    <div className="flex items-center gap-3">
      <Toggle kind="sbd" label="SBD" />
      <Toggle kind="general" label="Other" />
    </div>
  );
}
