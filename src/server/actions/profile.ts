"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { getUserId } from "@/server/session";

/** ログイン中ユーザーの表示名を変更する。空にするとnull（メール表示に戻る）。 */
export async function updateDisplayName(name: string): Promise<string> {
  const uid = await getUserId();
  const trimmed = name.trim().slice(0, 80);
  await db
    .update(users)
    .set({ name: trimmed || null })
    .where(eq(users.id, uid));
  revalidatePath("/settings");
  return trimmed;
}
