import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/server/db";
import { riotMatches } from "@/server/db/schema";
import {
  gameToRel,
  type MatchSummary,
  type ReplayData,
  type ReplayEvent,
  type ReplayFrame,
  type ReplayParticipant,
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
  teamPosition: string;
  win: boolean;
  riotIdGameName?: string;
  kills: number;
  deaths: number;
  assists: number;
  champLevel: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  visionScore: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  summoner1Id: number;
  summoner2Id: number;
  challenges?: { killParticipation?: number };
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
interface TLParticipantFrame {
  position: TLPos;
  totalGold: number;
  level: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
}
interface TLEvent {
  type: string;
  timestamp: number;
  position?: TLPos;
  monsterType?: string;
  buildingType?: string;
  laneType?: string;
  killerId?: number;
  victimId?: number;
}
interface TLFrame {
  timestamp: number;
  participantFrames: Record<string, TLParticipantFrame>;
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

/** キャッシュ済みなら返す（試合は不変なので永久キャッシュ） */
async function getCached(matchId: string): Promise<ReplayData | null> {
  const rows = await db
    .select({ data: riotMatches.data })
    .from(riotMatches)
    .where(eq(riotMatches.matchId, matchId))
    .limit(1);
  return rows[0] ? (rows[0].data as ReplayData) : null;
}

/** match + timeline を取得して加工＆キャッシュ保存 */
async function fetchAndCache(
  matchId: string,
  key: string,
): Promise<ReplayData> {
  const [match, timeline] = await Promise.all([
    riot<MatchDto>(`/lol/match/v5/matches/${matchId}`, key),
    riot<TimelineDto>(`/lol/match/v5/matches/${matchId}/timeline`, key),
  ]);

  const participants: ReplayParticipant[] = match.info.participants.map((p) => ({
    participantId: p.participantId,
    puuid: p.puuid,
    championName: p.championName,
    teamId: p.teamId,
    role: p.teamPosition ?? "",
    riotIdGameName: p.riotIdGameName ?? "",
    win: p.win,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    champLevel: p.champLevel,
    cs: p.totalMinionsKilled + p.neutralMinionsKilled,
    gold: p.goldEarned,
    dmgToChamps: p.totalDamageDealtToChampions,
    visionScore: p.visionScore,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
    spell1: p.summoner1Id,
    spell2: p.summoner2Id,
    csPerMin:
      match.info.gameDuration > 0
        ? ((p.totalMinionsKilled + p.neutralMinionsKilled) /
            match.info.gameDuration) *
          60
        : 0,
    killParticipation: p.challenges?.killParticipation ?? 0,
  }));

  const frames: ReplayFrame[] = timeline.info.frames.map((f) => {
    const entries = Object.entries(f.participantFrames);
    return {
      ms: f.timestamp,
      minute: Math.round(f.timestamp / 60000),
      positions: entries.map(([pid, pf]) => {
        const { rx, ry } = gameToRel(pf.position.x, pf.position.y);
        return { participantId: Number(pid), rx, ry };
      }),
      stats: entries.map(([pid, pf]) => ({
        participantId: Number(pid),
        totalGold: pf.totalGold,
        level: pf.level,
        cs: pf.minionsKilled + pf.jungleMinionsKilled,
      })),
    };
  });

  const events: ReplayEvent[] = [];
  for (const f of timeline.info.frames) {
    for (const e of f.events) {
      if (
        (e.type === "CHAMPION_KILL" ||
          e.type === "ELITE_MONSTER_KILL" ||
          e.type === "BUILDING_KILL") &&
        e.position
      ) {
        const { rx, ry } = gameToRel(e.position.x, e.position.y);
        events.push({
          ms: e.timestamp,
          type: e.type,
          rx,
          ry,
          killerId: e.killerId,
          victimId: e.victimId,
          monsterType: e.monsterType,
          buildingType: e.buildingType,
          laneType: e.laneType,
        });
      }
    }
  }

  const data: ReplayData = {
    matchId,
    queueId: match.info.queueId,
    gameStart: match.info.gameStartTimestamp,
    durationSec: match.info.gameDuration,
    participants,
    frames,
    events,
  };

  // 保存（重複時は無視）。試合は不変なので更新不要。
  await db
    .insert(riotMatches)
    .values({ matchId, data, createdAt: Date.now() })
    .onConflictDoNothing();

  return data;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.RIOT_API_KEY;

  const url = new URL(req.url);
  const riotId = url.searchParams.get("riotId");
  const list = url.searchParams.get("list"); // "1" → 直近試合の一覧だけ返す
  const count = Math.min(20, Number(url.searchParams.get("count") ?? "10"));
  const matchId = url.searchParams.get("matchId");

  try {
    // --- 個別の試合：まずキャッシュ、無ければAPI ---
    if (matchId) {
      const cached = await getCached(matchId);
      if (cached) return NextResponse.json(cached);
      if (!key)
        return NextResponse.json(
          { error: "RIOT_API_KEY が未設定です（.env.local / Vercel に追加）" },
          { status: 500 },
        );
      const data = await fetchAndCache(matchId, key);
      return NextResponse.json(data);
    }

    // ここから先は riotId → puuid が必要（＝APIキー必須）
    if (!riotId)
      return NextResponse.json(
        { error: "matchId または riotId が必要です" },
        { status: 400 },
      );
    if (!key)
      return NextResponse.json(
        { error: "RIOT_API_KEY が未設定です（.env.local / Vercel に追加）" },
        { status: 500 },
      );

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
    const puuid = acc.puuid;

    // --- 一覧モード：直近 N 試合のサマリ（キャッシュ済みはAPIを叩かない） ---
    if (list) {
      const ids = await riot<string[]>(
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`,
        key,
      );
      const matches: MatchSummary[] = [];
      for (const id of ids) {
        const cached = await getCached(id);
        if (cached) {
          const me = cached.participants.find((p) => p.puuid === puuid);
          matches.push({
            matchId: id,
            champ: me?.championName ?? "",
            win: !!me?.win,
            queueId: cached.queueId,
            gameStart: cached.gameStart,
            duration: cached.durationSec,
          });
        } else {
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
      }
      return NextResponse.json({ puuid, matches });
    }

    // riotId だけ（matchId未指定）→ 直近1件を読み込む
    const ids = await riot<string[]>(
      `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=1`,
      key,
    );
    if (!ids[0])
      return NextResponse.json({ error: "試合が見つかりません" }, { status: 404 });
    const cached = await getCached(ids[0]);
    const data = cached ?? (await fetchAndCache(ids[0], key));
    return NextResponse.json({ puuid, ...data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
