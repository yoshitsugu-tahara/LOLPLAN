"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { favoriteChampions } from "@/server/db/schema";
import { getUserId } from "@/server/session";

export async function listFavoriteChampions(): Promise<string[]> {
  const uid = await getUserId();
  const rows = await db
    .select({ id: favoriteChampions.championId })
    .from(favoriteChampions)
    .where(eq(favoriteChampions.userId, uid));
  return rows.map((r) => r.id);
}

export async function toggleFavoriteChampion(
  championId: string,
): Promise<void> {
  const uid = await getUserId();
  const existing = await db
    .select({ id: favoriteChampions.championId })
    .from(favoriteChampions)
    .where(
      and(
        eq(favoriteChampions.userId, uid),
        eq(favoriteChampions.championId, championId),
      ),
    )
    .limit(1);
  if (existing.length) {
    await db
      .delete(favoriteChampions)
      .where(
        and(
          eq(favoriteChampions.userId, uid),
          eq(favoriteChampions.championId, championId),
        ),
      );
  } else {
    await db
      .insert(favoriteChampions)
      .values({ userId: uid, championId })
      .onConflictDoNothing();
  }
}

/** localStorage からの一回限りの取り込み用（不足分だけ追加） */
export async function addFavoriteChampions(ids: string[]): Promise<void> {
  const uid = await getUserId();
  if (!ids.length) return;
  await db
    .insert(favoriteChampions)
    .values(ids.map((championId) => ({ userId: uid, championId })))
    .onConflictDoNothing();
}
