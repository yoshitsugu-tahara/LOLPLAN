"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/server/db";
import { appSettings } from "@/server/db/schema";
import { getUserId } from "@/server/session";

export async function getSetting(key: string): Promise<string | null> {
  const uid = await getUserId();
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(and(eq(appSettings.userId, uid), eq(appSettings.key, key)))
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(
  key: string,
  value: string,
): Promise<void> {
  const uid = await getUserId();
  const v = value.trim();
  await db
    .insert(appSettings)
    .values({ userId: uid, key, value: v })
    .onConflictDoUpdate({
      target: [appSettings.userId, appSettings.key],
      set: { value: v },
    });
  revalidatePath("/settings");
}
