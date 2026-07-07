import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  gameToRel,
  type MatchSummary,
  type ReplayData,
  type ReplayEvent,
  type ReplayFrame,
} from "@/lib/riot";

export const runtime = "nodejs";

// 日本(jp1)は regional routing クラスタ「asia」を使う（Account-V1 / Match-V5 共通）
const REGION = "asia";

// --- Riot API レスポンスのうち使う部分だけの型 ---
interface RiotAccount {
  puuid: string;
}
interface MatchParticipant {
  participantId: number;
  puuid: string;
  championName: string;
  teamId: number;
  win: boolean;
  riotIdGameName?: string;
}
interface MatchDto {
  info: {
    participants: MatchParticipant[];
    queueId: number;
    gameStartTimestamp: number;
    gameDuration: number;
  };
}
interface TLPos {
  x: number;
  y: number;
}
interface TLEvent {
  type: string;
  timestamp: number;
  position?: TLPos;
  monsterType?: string;
}
interface TLFrame {
  timestamp: number;
  participantFrames: Record<string, { position: TLPos }>;
  events: TLEvent[];
}
interface TimelineDto {
  info: { frames: TLFrame[] };
}

async function riot<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`https://${REGION}.api.riotgames.com${path}`, {
    headers: { "X-Riot-Token": key },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Riot ${res.status} @ ${path} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.RIOT_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "RIOT_API_KEY が未設定です（.env.local / Vercel に追加してください）" },
      { status: 500 },
    );

  const url = new URL(req.url);
  const riotId = url.searchParams.get("riotId");
  const list = url.searchParams.get("list"); // "1" → 直近試合の一覧だけ返す
  const count = Math.min(20, Number(url.searchParams.get("count") ?? "10"));
  let matchId = url.searchParams.get("matchId");
  let puuid = url.searchParams.get("puuid");

  try {
    // Riot ID → puuid
    if (!puuid && riotId) {
      const [gameName, tagLine] = riotId.split("#");
      if (!gameName || !tagLine)
        return NextResponse.json(
          { error: "Riot ID は「名前#タグ」形式で入力してください" },
          { status: 400 },
        );
      const acc = await riot<RiotAccount>(
        `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
          gameName,
        )}/${encodeURIComponent(tagLine)}`,
        key,
      );
      puuid = acc.puuid;
    }

    // 一覧モード：直近 N 試合のサマリ
    if (list) {
      if (!puuid)
        return NextResponse.json({ error: "riotId が必要です" }, { status: 400 });
      const ids = await riot<string[]>(
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`,
        key,
      );
      const matches: MatchSummary[] = [];
      for (const id of ids) {
        const m = await riot<MatchDto>(`/lol/match/v5/matches/${id}`, key);
        const me = m.info.participants.find((p) => p.puuid === puuid);
        matches.push({
          matchId: id,
          champ: me?.championName ?? "",
          win: !!me?.win,
          queueId: m.info.queueId,
          gameStart: m.info.gameStartTimestamp,
          duration: m.info.gameDuration,
        });
      }
      return NextResponse.json({ puuid, matches });
    }

    // matchId 未指定なら直近1件
    if (!matchId && puuid) {
      const ids = await riot<string[]>(
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=1`,
        key,
      );
      matchId = ids[0];
    }
    if (!matchId)
      return NextResponse.json(
        { error: "matchId または riotId が必要です" },
        { status: 400 },
      );

    const [match, timeline] = await Promise.all([
      riot<MatchDto>(`/lol/match/v5/matches/${matchId}`, key),
      riot<TimelineDto>(`/lol/match/v5/matches/${matchId}/timeline`, key),
    ]);

    const participants = match.info.participants.map((p) => ({
      participantId: p.participantId,
      championName: p.championName,
      teamId: p.teamId,
      riotIdGameName: p.riotIdGameName ?? "",
    }));

    const frames: ReplayFrame[] = timeline.info.frames.map((f) => ({
      ms: f.timestamp,
      minute: Math.round(f.timestamp / 60000),
      positions: Object.entries(f.participantFrames).map(([pid, pf]) => {
        const { rx, ry } = gameToRel(pf.position.x, pf.position.y);
        return { participantId: Number(pid), rx, ry };
      }),
    }));

    const events: ReplayEvent[] = [];
    for (const f of timeline.info.frames) {
      for (const e of f.events) {
        if (
          (e.type === "CHAMPION_KILL" || e.type === "ELITE_MONSTER_KILL") &&
          e.position
        ) {
          const { rx, ry } = gameToRel(e.position.x, e.position.y);
          events.push({
            ms: e.timestamp,
            type: e.type,
            rx,
            ry,
            monsterType: e.monsterType,
          });
        }
      }
    }

    const data: ReplayData = {
      matchId,
      durationSec: match.info.gameDuration,
      participants,
      frames,
      events,
    };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
