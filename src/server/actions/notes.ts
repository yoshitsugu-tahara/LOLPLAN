"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { Note } from "@/lib/types";
import { db } from "@/server/db";
import { notes } from "@/server/db/schema";
import { getUserId } from "@/server/session";

function byOrder(a: Note, b: Note) {
  const ao = a.order ?? 0;
  const bo = b.order ?? 0;
  if (ao !== bo) return ao - bo;
  return b.updatedAt - a.updatedAt;
}

export async function listNotes(): Promise<Note[]> {
  const uid = await getUserId();
  const rows = await db.select().from(notes).where(eq(notes.userId, uid));
  return rows as Note[];
}

export async function createNote(): Promise<string> {
  const uid = await getUserId();
  const id = nanoid();
  const now = Date.now();
  await db.insert(notes).values({
    id,
    userId: uid,
    title: "無題のノート",
    content: null,
    sectionId: null,
    order: -now, // 新規は未分類の先頭に
    labels: [],
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateNote(
  id: string,
  patch: {
    title?: string;
    content?: unknown;
    labels?: string[];
    sectionId?: string | null;
  },
): Promise<void> {
  const uid = await getUserId();
  await db
    .update(notes)
    .set({ ...patch, updatedAt: Date.now() })
    .where(and(eq(notes.id, id), eq(notes.userId, uid)));
}

export async function deleteNote(id: string): Promise<void> {
  const uid = await getUserId();
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, uid)));
}

/** ノートを toSectionId の toIndex 位置へ移動し、関係するセクションの order を振り直す */
export async function moveNote(
  draggedId: string,
  toSectionId: string | null,
  toIndex: number,
): Promise<void> {
  const uid = await getUserId();
  const all = (await db
    .select()
    .from(notes)
    .where(eq(notes.userId, uid))) as Note[];
  const dragged = all.find((n) => n.id === draggedId);
  if (!dragged) return;
  const fromSectionId = dragged.sectionId ?? null;

  const target = all
    .filter((n) => (n.sectionId ?? null) === toSectionId && n.id !== draggedId)
    .sort(byOrder);
  const idx = Math.max(0, Math.min(toIndex, target.length));
  target.splice(idx, 0, dragged);

  const now = Date.now();
  const ops: Promise<unknown>[] = [];
  for (let i = 0; i < target.length; i++) {
    const patch: { order: number; updatedAt: number; sectionId?: string | null } =
      { order: i, updatedAt: now };
    if (target[i].id === draggedId) patch.sectionId = toSectionId;
    ops.push(
      db
        .update(notes)
        .set(patch)
        .where(and(eq(notes.id, target[i].id), eq(notes.userId, uid))),
    );
  }
  if (fromSectionId !== toSectionId) {
    const old = all
      .filter(
        (n) => (n.sectionId ?? null) === fromSectionId && n.id !== draggedId,
      )
      .sort(byOrder);
    for (let i = 0; i < old.length; i++) {
      ops.push(
        db
          .update(notes)
          .set({ order: i })
          .where(and(eq(notes.id, old[i].id), eq(notes.userId, uid))),
      );
    }
  }
  await Promise.all(ops);
}
