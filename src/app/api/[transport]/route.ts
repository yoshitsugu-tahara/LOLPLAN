import { and, desc, eq } from "drizzle-orm";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

import { blocksToText } from "@/components/noteText";
import { getOrigin } from "@/lib/origin";
import { roleLabel } from "@/lib/training-data";
import { db } from "@/server/db";
import { focuses, games, notes } from "@/server/db/schema";
import { mcpResource, verifyAccessToken } from "@/server/oauth";

export const runtime = "nodejs";

function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 認証済みトークンから userId を取り出す（withMcpAuth required で必ず存在） */
function uid(extra: { authInfo?: { extra?: Record<string, unknown> } }): string {
  return extra.authInfo?.extra?.userId as string;
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "search_notes",
      "lolnoteのノートを全文検索する（タイトル＋本文）。LOLの戦略・振り返りメモが入っている。",
      { query: z.string().describe("検索キーワード") },
      async ({ query }, extra) => {
        const userId = uid(extra);
        const rows = await db.select().from(notes).where(eq(notes.userId, userId));
        const q = query.trim().toLowerCase();
        const hits = rows
          .filter((n) =>
            ((n.title || "") + "\n" + blocksToText(n.content))
              .toLowerCase()
              .includes(q),
          )
          .slice(0, 20)
          .map(
            (n) =>
              `- [${n.id}] ${n.title || "無題のノート"}: ${blocksToText(n.content).slice(0, 120)}`,
          );
        return {
          content: [
            { type: "text", text: hits.length ? hits.join("\n") : "該当なし" },
          ],
        };
      },
    );

    server.tool(
      "get_note",
      "ノートIDを指定して本文全文を取得する。",
      { id: z.string().describe("ノートID（search_notesの[]内）") },
      async ({ id }, extra) => {
        const userId = uid(extra);
        const rows = await db
          .select()
          .from(notes)
          .where(and(eq(notes.id, id), eq(notes.userId, userId)))
          .limit(1);
        const n = rows[0];
        if (!n) return { content: [{ type: "text", text: "見つかりません" }] };
        return {
          content: [
            {
              type: "text",
              text: `# ${n.title || "無題のノート"}\n\n${blocksToText(n.content)}`,
            },
          ],
        };
      },
    );

    server.tool(
      "recent_games",
      "直近の試合ログ（勝敗・ロール・チャンプ・意識達成度・良かった点・ミス・タグ）を取得する。",
      { limit: z.number().optional().describe("件数（既定20）") },
      async ({ limit }, extra) => {
        const userId = uid(extra);
        const rows = await db
          .select()
          .from(games)
          .where(eq(games.userId, userId))
          .orderBy(desc(games.playedAt))
          .limit(Math.min(limit ?? 20, 50));
        if (!rows.length)
          return { content: [{ type: "text", text: "試合ログがありません" }] };
        const lines = rows.map((g) => {
          const parts = [
            fmtDate(g.playedAt),
            g.result === "win" ? "勝" : "負",
            roleLabel(g.role),
            g.champion || "",
            g.good ? `◎${g.good}` : "",
            g.mistake ? `✕${g.mistake}` : "",
            (g.tags ?? []).length ? `[${(g.tags ?? []).join(",")}]` : "",
          ].filter(Boolean);
          return "- " + parts.join(" / ");
        });
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.tool(
      "mistake_stats",
      "直近の試合の頻出ミスタグ集計（多い順）。弱点把握に使う。",
      {},
      async (_args, extra) => {
        const userId = uid(extra);
        const rows = await db
          .select({ tags: games.tags })
          .from(games)
          .where(eq(games.userId, userId))
          .orderBy(desc(games.playedAt))
          .limit(20);
        const counts = new Map<string, number>();
        for (const r of rows)
          for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
        const top = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([tag, c]) => `- ${tag}: ${c}`);
        return {
          content: [
            { type: "text", text: top.length ? top.join("\n") : "データなし" },
          ],
        };
      },
    );

    server.tool(
      "current_focuses",
      "今ユーザーが意識していること（練習の意識ボード）を取得する。",
      {},
      async (_args, extra) => {
        const userId = uid(extra);
        const rows = await db
          .select()
          .from(focuses)
          .where(eq(focuses.userId, userId));
        return {
          content: [
            {
              text: rows.length
                ? rows.map((f) => `- ${f.text}`).join("\n")
                : "未設定",
              type: "text",
            },
          ],
        };
      },
    );
  },
  {},
  { basePath: "/api" },
);

const authed = withMcpAuth(
  handler,
  async (req, bearer) => {
    if (!bearer) return undefined;
    const res = await verifyAccessToken(bearer, mcpResource(getOrigin(req)));
    if (!res) return undefined;
    return {
      token: bearer,
      clientId: "lolnote-mcp",
      scopes: res.scope ? res.scope.split(" ") : [],
      extra: { userId: res.userId },
    };
  },
  { required: true },
);

export { authed as GET, authed as POST, authed as DELETE };
