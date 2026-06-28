"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth, isOwner } from "@/auth";
import { db } from "@/server/db";
import { allowedEmails } from "@/server/db/schema";

async function requireOwner() {
  const session = await auth();
  if (!isOwner(session?.user?.email)) {
    throw new Error("権限がありません");
  }
  return session!;
}

export async function listAllowed() {
  await requireOwner();
  return db
    .select()
    .from(allowedEmails)
    .orderBy(asc(allowedEmails.createdAt));
}

export async function addAllowed(emailRaw: string) {
  const session = await requireOwner();
  const email = emailRaw.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "メールアドレスの形式が正しくありません" };
  }
  if (email === process.env.OWNER_EMAIL?.toLowerCase()) {
    return { ok: false as const, error: "オーナーは既に許可されています" };
  }
  await db
    .insert(allowedEmails)
    .values({
      email,
      invitedBy: session.user?.email ?? null,
      createdAt: Date.now(),
    })
    .onConflictDoNothing();
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function removeAllowed(email: string) {
  await requireOwner();
  await db.delete(allowedEmails).where(eq(allowedEmails.email, email));
  revalidatePath("/settings");
  return { ok: true as const };
}
