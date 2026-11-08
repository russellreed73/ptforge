"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isUnit, type UnitKind } from "@/lib/units";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

/**
 * Saves the signed-in person's weight unit (kg or lb) for squat/bench/deadlift
 * ("sbd") or everything else ("general"). Loads stay stored in kg.
 */
export async function setPreferredUnit(kind: UnitKind, unit: string): Promise<{ ok: boolean }> {
  const me = await requireUser();
  if (!isUnit(unit) || (kind !== "sbd" && kind !== "general")) return { ok: false };
  await db
    .update(user)
    .set(kind === "sbd" ? { sbdUnit: unit } : { preferredUnit: unit })
    .where(eq(user.id, me.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
