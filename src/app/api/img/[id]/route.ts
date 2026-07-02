import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/server/db";
import { images } from "@/server/db/schema";

export const runtime = "nodejs";

// 本人のログインセッションでのみ画像を配信（ノートは非公開のため）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const rows = await db
    .select()
    .from(images)
    .where(and(eq(images.id, id), eq(images.userId, session.user.id)))
    .limit(1);
  const img = rows[0];
  if (!img) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(img.data, "base64"), {
    headers: {
      "content-type": img.mime,
      // 画像はアップロード後不変。プライベートに長期キャッシュ。
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
