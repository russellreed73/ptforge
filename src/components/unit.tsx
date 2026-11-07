"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useOptimistic, useTransition, type ReactNode } from "react";
import { formatWeight, UNITS, type Unit } from "@/lib/units";
import { setPreferredUnit } from "@/server/user/actions";

const UnitContext = createContext<Unit>("kg");

/** Makes the signed-in person's unit available to every weight on the page. */
export function UnitProvider({ unit, children }: { unit: Unit; children: ReactNode }) {
  return <UnitContext.Provider value={unit}>{children}</UnitContext.Provider>;
}

export function useUnit(): Unit {
  return useContext(UnitContext);
}

/** Shows a load stored in kg in the viewer's unit, e.g. <Weight kg={142.5} /> → "142.5 kg" or "314.2 lb". */
export function Weight({ kg }: { kg: number }) {
  return <>{formatWeight(kg, useUnit())}</>;
}

/** KG | LB switch. Saves to the account, so it follows the person to every device. */
export function UnitToggle() {
  const saved = useUnit();
  const [unit, setUnit] = useOptimistic(saved);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div
      role="radiogroup"
      aria-label="Weight unit"
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
              await setPreferredUnit(u);
              router.refresh();
            })
          }
          className={`font-heading px-2.5 py-1 font-semibold tracking-[0.12em] uppercase transition-colors ${
            unit === u ? "bg-primary text-primary-foreground" : "text-subtle hover:text-foreground"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
