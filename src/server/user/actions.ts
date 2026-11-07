"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isUnit } from "@/lib/units";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

/** Saves the signed-in person's weight unit (kg or lb). Loads stay stored in kg. */
export async function setPreferredUnit(unit: string): Promise<{ ok: boolean }> {
  const me = await requireUser();
  if (!isUnit(unit)) return { ok: false };
  await db
    .update(user)
    .set({ preferredUnit: unit, updatedAt: new Date() })
    .where(eq(user.id, me.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
