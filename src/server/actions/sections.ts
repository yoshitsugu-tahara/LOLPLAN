"use server";

import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { Section } from "@/lib/types";
import { db } from "@/server/db";
import { notes, sections } from "@/server/db/schema";
import { getUserId } from "@/server/session";

export async function listSections(): Promise<Section[]> {
  const uid = await getUserId();
  const rows = await db
    .select()
    .from(sections)
    .where(eq(sections.userId, uid))
    .orderBy(asc(sections.order));
  return rows as Section[];
}

export async function createSection(name = "新しいセクション"): Promise<string> {
  const uid = await getUserId();
  const existing = await db
    .select({ order: sections.order })
    .from(sections)
    .where(eq(sections.userId, uid));
  const maxO = existing.reduce((m, s) => Math.max(m, s.order), -1);
  const id = nanoid();
  await db.insert(sections).values({ id, userId: uid, name, order: maxO + 1 });
  return id;
}

export async function renameSection(id: string, name: string): Promise<void> {
  const uid = await getUserId();
  await db
    .update(sections)
    .set({ name })
    .where(and(eq(sections.id, id), eq(sections.userId, uid)));
}

/** セクションのタイトルテンプレートを設定（空文字/未指定でクリア） */
export async function setSectionTemplate(
  id: string,
  template: string,
): Promise<void> {
  const uid = await getUserId();
  const t = template.trim().slice(0, 200);
  await db
    .update(sections)
    .set({ titleTemplate: t || null })
    .where(and(eq(sections.id, id), eq(sections.userId, uid)));
}

export async function deleteSection(id: string): Promise<void> {
  const uid = await getUserId();
  // 中のノートは未分類に戻す
  await db
    .update(notes)
    .set({ sectionId: null })
    .where(and(eq(notes.sectionId, id), eq(notes.userId, uid)));
  await db
    .delete(sections)
    .where(and(eq(sections.id, id), eq(sections.userId, uid)));
}
