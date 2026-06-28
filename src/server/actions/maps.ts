"use server";

import { and, eq } from "drizzle-orm";

import type { MapBoard } from "@/lib/types";
import { db } from "@/server/db";
import { maps } from "@/server/db/schema";
import { getUserId } from "@/server/session";

export async function getMap(id: string): Promise<MapBoard | null> {
  const uid = await getUserId();
  const rows = await db
    .select()
    .from(maps)
    .where(and(eq(maps.id, id), eq(maps.userId, uid)))
    .limit(1);
  return (rows[0] as MapBoard) ?? null;
}

export async function upsertMap(
  id: string,
  data: { snapshot?: unknown; preview?: string },
): Promise<void> {
  const uid = await getUserId();
  const now = Date.now();
  await db
    .insert(maps)
    .values({
      id,
      userId: uid,
      snapshot: data.snapshot ?? null,
      preview: data.preview ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: maps.id,
      set: {
        ...(data.snapshot !== undefined ? { snapshot: data.snapshot } : {}),
        ...(data.preview !== undefined ? { preview: data.preview } : {}),
        updatedAt: now,
      },
    });
}
