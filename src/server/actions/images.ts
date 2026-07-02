"use server";

import { nanoid } from "nanoid";

import { db } from "@/server/db";
import { images } from "@/server/db/schema";
import { getUserId } from "@/server/session";

const MAX_BYTES = 6 * 1024 * 1024; // 6MB

/** data URL を受け取り画像を保存、配信URL(/api/img/<id>)を返す。 */
export async function uploadImage(dataUrl: string): Promise<string> {
  const uid = await getUserId();
  const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) throw new Error("invalid image data");
  const mime = m[1];
  const b64 = m[2];
  if (!mime.startsWith("image/")) throw new Error("not an image");
  // base64長 × 3/4 ≈ バイト数
  if (b64.length * 0.75 > MAX_BYTES) throw new Error("image too large (max 6MB)");

  const id = nanoid();
  await db.insert(images).values({
    id,
    userId: uid,
    mime,
    data: b64,
    createdAt: Date.now(),
  });
  return `/api/img/${id}`;
}
