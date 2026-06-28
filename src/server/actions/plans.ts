"use server";

import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { Plan, PlanMeta } from "@/lib/types";
import { db } from "@/server/db";
import { plans } from "@/server/db/schema";
import { getUserId } from "@/server/session";

export async function listPlans(): Promise<PlanMeta[]> {
  const uid = await getUserId();
  const rows = await db
    .select({
      id: plans.id,
      title: plans.title,
      preview: plans.preview,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
    })
    .from(plans)
    .where(eq(plans.userId, uid))
    .orderBy(desc(plans.updatedAt));
  return rows as PlanMeta[];
}

export async function createPlan(): Promise<string> {
  const uid = await getUserId();
  const id = nanoid();
  const now = Date.now();
  await db.insert(plans).values({
    id,
    userId: uid,
    title: "無題のプラン",
    snapshot: null,
    preview: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** 指定IDのプランを取得。無ければ作って返す（直リンク対策） */
export async function getOrCreatePlan(id: string): Promise<Plan> {
  const uid = await getUserId();
  const rows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, id), eq(plans.userId, uid)))
    .limit(1);
  if (rows[0]) return rows[0] as Plan;
  const now = Date.now();
  const row = {
    id,
    userId: uid,
    title: "無題のプラン",
    snapshot: null,
    preview: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(plans).values(row);
  return row as Plan;
}

export async function updatePlan(
  id: string,
  patch: { title?: string; snapshot?: unknown; preview?: string },
): Promise<void> {
  const uid = await getUserId();
  await db
    .update(plans)
    .set({ ...patch, updatedAt: Date.now() })
    .where(and(eq(plans.id, id), eq(plans.userId, uid)));
}

export async function deletePlan(id: string): Promise<void> {
  const uid = await getUserId();
  await db.delete(plans).where(and(eq(plans.id, id), eq(plans.userId, uid)));
}
