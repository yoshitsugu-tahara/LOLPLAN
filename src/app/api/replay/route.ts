import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/server/db";
import { getUserId } from "@/server/session";
import {
  appSettings,
  riotMatches,
  riotMatchPlayers,
  riotRanks,
} from "@/server/db/schema";
import {
  gameToRel,
  type ItemEvent,
  type MatchSummary,
  type RankInfo,
  type ReplayData,
  type ReplayEvent,
  type ReplayFrame,
  type ReplayParticipant,
} from "@/lib/riot";

export const runtime = "nodejs";

// Account-V1 / Match-V5 は regional クラスタ「asia」、League-V4 は platform「jp1」
const REGION = "asia";
const PLATFORM = "jp1";
const RANK_TTL = 24 * 60 * 60 * 1000; // 24h

interface LeagueEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

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
  wardsPlaced: number;
  wardsKilled: number;
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
  monsterSubType?: string;
  buildingType?: string;
  towerType?: string;
  laneType?: string;
  killerId?: number;
  killerTeamId?: number;
  victimId?: number;
  teamId?: number;
  assistingParticipantIds?: number[];
  name?: string; // DRAGON_SOUL_GIVEN の属性名
  participantId?: number; // ITEM_* / SKILL_LEVEL_UP
  itemId?: number;
  skillSlot?: number;
}
interface TLFrame {
  timestamp: number;
  participantFrames: Record<string, TLParticipantFrame>;
  events: TLEvent[];
}
interface TimelineDto {
  info: { frames: TLFrame[] };
}

async function riotHost<T>(host: string, path: string, key: string): Promise<T> {
  const res = await fetch(`https://${host}.api.riotgames.com${path}`, {
    headers: { "X-Riot-Token": key },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Riot ${res.status} @ ${path} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
const riot = <T>(path: string, key: string) => riotHost<T>(REGION, path, key);

/** puuidの現在ランクを取得（24hキャッシュ）。keyが無ければキャッシュ分だけ返す。 */
async function getRanks(
  puuids: string[],
  key: string | undefined,
): Promise<Record<string, RankInfo>> {
  const out: Record<string, RankInfo> = {};
  if (!puuids.length) return out;
  const now = Date.now();
  const rows = await db
    .select()
    .from(riotRanks)
    .where(inArray(riotRanks.puuid, puuids));
  const cache = new Map(rows.map((r) => [r.puuid, r]));
  const toFetch: string[] = [];
  for (const pu of puuids) {
    const c = cache.get(pu);
    if (c && now - c.fetchedAt < RANK_TTL) {
      out[pu] = {
        tier: c.tier,
        division: c.division,
        lp: c.lp ?? 0,
        wins: c.wins ?? 0,
        losses: c.losses ?? 0,
      };
    } else {
      toFetch.push(pu);
    }
  }
  if (toFetch.length && key) {
    for (const pu of toFetch) {
      try {
        const entries = await riotHost<LeagueEntry[]>(
          PLATFORM,
          `/lol/league/v4/entries/by-puuid/${pu}`,
          key,
        );
        const e =
          entries.find((x) => x.queueType === "RANKED_SOLO_5x5") ??
          entries.find((x) => x.queueType === "RANKED_FLEX_SR");
        const info: RankInfo = e
          ? {
              tier: e.tier,
              division: e.rank,
              lp: e.leaguePoints,
              wins: e.wins,
              losses: e.losses,
            }
          : { tier: null, division: null, lp: 0, wins: 0, losses: 0 };
        out[pu] = info;
        await db
          .insert(riotRanks)
          .values({ puuid: pu, ...info, fetchedAt: now })
          .onConflictDoUpdate({
            target: riotRanks.puuid,
            set: { ...info, fetchedAt: now },
          });
      } catch {
        // 取得失敗（レート等）はスキップ。キャッシュがあればそれを使う。
        const c = cache.get(pu);
        if (c)
          out[pu] = {
            tier: c.tier,
            division: c.division,
            lp: c.lp ?? 0,
            wins: c.wins ?? 0,
            losses: c.losses ?? 0,
          };
      }
    }
  }
  return out;
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

  // タイムラインから購入/スキル上げを参加者ごとに集める
  const purchases: Record<number, ItemEvent[]> = {};
  const skills: Record<number, number[]> = {};
  for (const f of timeline.info.frames) {
    for (const e of f.events) {
      if (e.participantId == null) continue;
      if (e.type === "ITEM_PURCHASED" && e.itemId) {
        (purchases[e.participantId] ??= []).push({
          ms: e.timestamp,
          itemId: e.itemId,
          kind: "PURCHASED",
        });
      } else if (
        (e.type === "ITEM_SOLD" || e.type === "ITEM_UNDO") &&
        e.itemId
      ) {
        (purchases[e.participantId] ??= []).push({
          ms: e.timestamp,
          itemId: e.itemId,
          kind: e.type === "ITEM_SOLD" ? "SOLD" : "UNDO",
        });
      } else if (e.type === "SKILL_LEVEL_UP" && e.skillSlot) {
        (skills[e.participantId] ??= []).push(e.skillSlot);
      }
    }
  }

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
    wardsPlaced: p.wardsPlaced ?? 0,
    wardsKilled: p.wardsKilled ?? 0,
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
    purchases: purchases[p.participantId] ?? [],
    skillOrder: skills[p.participantId] ?? [],
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

  const EVENT_TYPES = new Set([
    "CHAMPION_KILL",
    "ELITE_MONSTER_KILL",
    "BUILDING_KILL",
    "TURRET_PLATE_DESTROYED",
    "DRAGON_SOUL_GIVEN",
  ]);
  const events: ReplayEvent[] = [];
  for (const f of timeline.info.frames) {
    for (const e of f.events) {
      if (!EVENT_TYPES.has(e.type)) continue;
      const pos = e.position ? gameToRel(e.position.x, e.position.y) : null;
      events.push({
        ms: e.timestamp,
        type: e.type,
        rx: pos?.rx ?? 0,
        ry: pos?.ry ?? 0,
        killerId: e.killerId,
        victimId: e.victimId,
        assistIds: e.assistingParticipantIds,
        teamId: e.teamId ?? e.killerTeamId,
        monsterType: e.monsterType,
        monsterSubType: e.monsterSubType,
        buildingType: e.buildingType,
        towerType: e.towerType,
        laneType: e.laneType,
        soulName: e.name,
      });
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
  const list = url.searchParams.get("list"); // "1" → Riotから直近試合を取得（更新）
  const cachedMode = url.searchParams.get("cached"); // "1" → DBの保存済み一覧だけ（Riot不要）
  const ranksParam = url.searchParams.get("ranks"); // "puuid,puuid,..." → 現在ランク
  const count = Math.min(20, Number(url.searchParams.get("count") ?? "10"));
  const matchId = url.searchParams.get("matchId");

  try {
    // --- 現在ランク（24hキャッシュ・League-V4） ---
    if (ranksParam) {
      const puuids = ranksParam.split(",").filter(Boolean).slice(0, 10);
      const ranks = await getRanks(puuids, key);
      return NextResponse.json({ ranks });
    }

    // --- 保存済み一覧（訪問時に即表示・Riotを一切叩かない） ---
    if (cachedMode) {
      const uid = await getUserId();
      const s = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(and(eq(appSettings.userId, uid), eq(appSettings.key, "riotPuuid")))
        .limit(1);
      const savedPuuid = s[0]?.value;
      if (!savedPuuid)
        return NextResponse.json({ matches: [], needsRefresh: true });
      const rows = await db
        .select()
        .from(riotMatchPlayers)
        .where(eq(riotMatchPlayers.puuid, savedPuuid))
        .orderBy(desc(riotMatchPlayers.gameStart))
        .limit(count);
      const matches: MatchSummary[] = rows.map((r) => ({
        matchId: r.matchId,
        champ: r.champ ?? "",
        win: !!r.win,
        queueId: r.queueId ?? 0,
        gameStart: r.gameStart ?? 0,
        duration: r.duration ?? 0,
      }));
      return NextResponse.json({ puuid: savedPuuid, matches });
    }

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

    // --- 一覧モード：直近 N 試合のサマリ（ノーマル＋ランクのみ・キャッシュ優先） ---
    if (list) {
      // ノーマル/ランクだけを許可（450=ARAM, 1700=アリーナ, 700=クラッシュ等は除外）
      const ALLOWED = new Set([400, 420, 430, 440, 490]);
      // type で API 側から事前に絞る（ranked と normal を別々に取得してマージ）
      const [rankedIds, normalIds] = await Promise.all([
        riot<string[]>(
          `/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&count=${count}`,
          key,
        ),
        riot<string[]>(
          `/lol/match/v5/matches/by-puuid/${puuid}/ids?type=normal&count=${count}`,
          key,
        ),
      ]);
      // matchId 末尾の連番は時刻とほぼ単調なので、それで新しい順に並べて上位 count 件だけ詳細取得
      const num = (id: string) => Number(id.split("_")[1] ?? 0);
      const ids = [...new Set([...rankedIds, ...normalIds])]
        .sort((a, b) => num(b) - num(a))
        .slice(0, count);

      const matches: MatchSummary[] = [];
      for (const id of ids) {
        const cached = await getCached(id);
        let s: MatchSummary;
        if (cached) {
          const me = cached.participants.find((p) => p.puuid === puuid);
          s = {
            matchId: id,
            champ: me?.championName ?? "",
            win: !!me?.win,
            queueId: cached.queueId,
            gameStart: cached.gameStart,
            duration: cached.durationSec,
          };
        } else {
          const m = await riot<MatchDto>(`/lol/match/v5/matches/${id}`, key);
          const me = m.info.participants.find((p) => p.puuid === puuid);
          s = {
            matchId: id,
            champ: me?.championName ?? "",
            win: !!me?.win,
            queueId: m.info.queueId,
            gameStart: m.info.gameStartTimestamp,
            duration: m.info.gameDuration,
          };
        }
        if (ALLOWED.has(s.queueId)) matches.push(s);
      }
      matches.sort((a, b) => b.gameStart - a.gameStart);

      // 次回訪問時に Riot 無しで即表示できるよう、puuid とサマリを保存
      const uid = await getUserId();
      await db
        .insert(appSettings)
        .values({ userId: uid, key: "riotPuuid", value: puuid })
        .onConflictDoUpdate({
          target: [appSettings.userId, appSettings.key],
          set: { value: puuid },
        });
      if (matches.length) {
        await db
          .insert(riotMatchPlayers)
          .values(
            matches.map((m) => ({
              puuid,
              matchId: m.matchId,
              champ: m.champ,
              win: m.win,
              queueId: m.queueId,
              gameStart: m.gameStart,
              duration: m.duration,
            })),
          )
          .onConflictDoNothing();
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
