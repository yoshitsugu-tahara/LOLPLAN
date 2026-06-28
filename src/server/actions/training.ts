"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { Focus, Game } from "@/lib/types";
import { db } from "@/server/db";
import { focuses, games } from "@/server/db/schema";
import { getUserId } from "@/server/session";

// ───────────── 意識 (focus) ─────────────

export async function listFocuses(): Promise<Focus[]> {
  const uid = await getUserId();
  const rows = await db
    .select()
    .from(focuses)
    .where(eq(focuses.userId, uid))
    .orderBy(asc(focuses.order), asc(focuses.createdAt));
  return rows as Focus[];
}

export async function addFocus(text: string): Promise<void> {
  const uid = await getUserId();
  const t = text.trim().slice(0, 200);
  if (!t) return;
  const existing = await db
    .select({ order: focuses.order })
    .from(focuses)
    .where(eq(focuses.userId, uid));
  const maxO = existing.reduce((m, f) => Math.max(m, f.order), -1);
  await db.insert(focuses).values({
    id: nanoid(),
    userId: uid,
    text: t,
    order: maxO + 1,
    createdAt: Date.now(),
  });
}

export async function deleteFocus(id: string): Promise<void> {
  const uid = await getUserId();
  await db
    .delete(focuses)
    .where(and(eq(focuses.id, id), eq(focuses.userId, uid)));
}

// ───────────── 試合ログ (game) ─────────────

export type GameInput = {
  result: "win" | "lose";
  champion?: string;
  role?: string;
  focusScore?: string;
  good?: string;
  mistake?: string;
  tags?: string[];
  nextFocus?: string;
};

export async function listGames(limit = 50): Promise<Game[]> {
  const uid = await getUserId();
  const rows = await db
    .select()
    .from(games)
    .where(eq(games.userId, uid))
    .orderBy(desc(games.playedAt))
    .limit(limit);
  return rows as Game[];
}

export async function addGame(input: GameInput): Promise<void> {
  const uid = await getUserId();
  const now = Date.now();
  await db.insert(games).values({
    id: nanoid(),
    userId: uid,
    result: input.result,
    champion: input.champion?.trim() || null,
    role: input.role || null,
    focusScore: input.focusScore || null,
    good: input.good?.trim() || null,
    mistake: input.mistake?.trim() || null,
    tags: input.tags && input.tags.length ? input.tags : null,
    nextFocus: input.nextFocus?.trim() || null,
    playedAt: now,
    createdAt: now,
  });
}

export async function deleteGame(id: string): Promise<void> {
  const uid = await getUserId();
  await db.delete(games).where(and(eq(games.id, id), eq(games.userId, uid)));
}

/** 直近 limit 試合の頻出ミスタグ集計（多い順） */
export async function mistakeStats(
  limit = 20,
): Promise<{ tag: string; count: number }[]> {
  const uid = await getUserId();
  const rows = await db
    .select({ tags: games.tags })
    .from(games)
    .where(eq(games.userId, uid))
    .orderBy(desc(games.playedAt))
    .limit(limit);
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
