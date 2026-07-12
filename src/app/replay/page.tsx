"use client";

import { Pause, Play, RefreshCw, Skull } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChampionIcon, useChampions } from "@/components/ChampionSelect";
import SimpleSelect from "@/components/SimpleSelect";
import { MAP_IMAGE } from "@/components/planner/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSetting } from "@/lib/store";
import {
  dragonShort,
  itemsAt,
  opponentOf,
  queueName,
  rankLabel,
  stateAt,
  tierColor,
  type GameState,
  type MatchSummary,
  type RankInfo,
  type ReplayData,
  type ReplayParticipant,
  type ReplayStat,
  type TeamObjective,
} from "@/lib/riot";

function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtGold(g: number) {
  return `${(g / 1000).toFixed(1)}k`;
}
function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function itemIcon(version: string | undefined, id: number) {
  return version && id
    ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`
    : null;
}

// ───────── リード差（自分 vs 対面）ミニグラフ ─────────
function GoldDiffSparkline({
  data,
  mePid,
  oppPid,
  minute,
}: {
  data: ReplayData;
  mePid: number;
  oppPid: number;
  minute: number;
}) {
  const W = 260;
  const H = 56;
  const diffs = data.frames.map((f) => {
    const me = f.stats.find((s) => s.participantId === mePid)?.totalGold ?? 0;
    const op = f.stats.find((s) => s.participantId === oppPid)?.totalGold ?? 0;
    return me - op;
  });
  const maxAbs = Math.max(500, ...diffs.map((d) => Math.abs(d)));
  const x = (i: number) => (i / Math.max(1, diffs.length - 1)) * W;
  const y = (d: number) => H / 2 - (d / maxAbs) * (H / 2 - 4);
  const pts = diffs.map((d, i) => `${x(i)},${y(d)}`).join(" ");
  const cur = diffs[minute] ?? 0;

  return (
    <svg width={W} height={H} className="w-full">
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,.15)" />
      {/* 正=青の塗り, 負=赤の塗り は省略しシンプルに線＋現在点 */}
      <polyline
        points={pts}
        fill="none"
        stroke={cur >= 0 ? "#38bdf8" : "#f87171"}
        strokeWidth={2}
      />
      <circle cx={x(minute)} cy={y(cur)} r={3.5} fill="#fff" />
    </svg>
  );
}

// ───────── 選択中の分の「自分 vs 対面」パネル ─────────
function LeadPanel({
  data,
  me,
  minute,
}: {
  data: ReplayData;
  me: ReplayParticipant;
  minute: number;
}) {
  const opp = opponentOf(me, data.participants);
  const frame = data.frames[minute];
  const stat = (pid: number): ReplayStat | undefined =>
    frame?.stats.find((s) => s.participantId === pid);
  const meS = stat(me.participantId);

  if (!opp || !meS) {
    return (
      <div className="rounded-lg border border-white/10 bg-zinc-900 p-3 text-sm text-zinc-500">
        対面（同ロールの敵）を特定できませんでした。
      </div>
    );
  }
  const oppS = stat(opp.participantId);
  if (!oppS) return null;

  const rows: { label: string; me: number; op: number; fmt?: (n: number) => string }[] = [
    { label: "ゴールド", me: meS.totalGold, op: oppS.totalGold, fmt: fmtGold },
    { label: "CS", me: meS.cs, op: oppS.cs },
    { label: "レベル", me: meS.level, op: oppS.level },
  ];

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-sky-300">
          <ChampionIcon id={me.championName} className="h-5 w-5 rounded" />
          自分
        </span>
        <span className="text-zinc-600">vs 対面</span>
        <span className="flex items-center gap-1.5 text-red-300">
          {opp.championName}
          <ChampionIcon id={opp.championName} className="h-5 w-5 rounded" />
        </span>
      </div>
      {rows.map((r) => {
        const d = r.me - r.op;
        const f = r.fmt ?? ((n: number) => String(n));
        return (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            <span className="w-14 text-right tabular-nums text-zinc-300">
              {f(r.me)}
            </span>
            <span className="w-20 text-center text-[11px] text-zinc-600">
              {r.label}
            </span>
            <span className="w-14 tabular-nums text-zinc-300">{f(r.op)}</span>
            <span
              className={`ml-auto w-16 text-right text-xs font-semibold tabular-nums ${
                d > 0 ? "text-sky-300" : d < 0 ? "text-red-300" : "text-zinc-500"
              }`}
            >
              {r.fmt ? (d >= 0 ? "+" : "") + f(Math.abs(d)) : signed(d)}
            </span>
          </div>
        );
      })}
      <div className="pt-1">
        <div className="mb-0.5 text-[11px] text-zinc-600">
          ゴールド差の推移（青=自分リード / 赤=負け）
        </div>
        <GoldDiffSparkline
          data={data}
          mePid={me.participantId}
          oppPid={opp.participantId}
          minute={minute}
        />
      </div>
    </div>
  );
}

// ───────── 最終スコアボード ─────────
function Scoreboard({
  data,
  mePid,
  version,
  ranks,
}: {
  data: ReplayData;
  mePid: number | null;
  version: string | undefined;
  ranks: Record<string, RankInfo>;
}) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {[100, 200].map((team) => {
        const win = data.participants.find((p) => p.teamId === team)?.win;
        return (
          <div
            key={team}
            className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
          >
            <div
              className={`flex items-center justify-between px-3 py-1.5 text-xs font-bold ${
                team === 100
                  ? "bg-sky-500/10 text-sky-300"
                  : "bg-red-500/10 text-red-300"
              }`}
            >
              <span>{team === 100 ? "ブルー" : "レッド"}</span>
              <span>{win ? "勝利" : "敗北"}</span>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {data.participants
                  .filter((p) => p.teamId === team)
                  .map((p) => {
                    const isMe = mePid != null && p.participantId === mePid;
                    return (
                      <tr
                        key={p.participantId}
                        className={`border-t border-white/5 ${isMe ? "bg-yellow-400/10" : ""}`}
                      >
                        <td className="py-1 pl-2 pr-1">
                          <div className="flex items-center gap-1.5">
                            <div className="relative shrink-0">
                              <ChampionIcon
                                id={p.championName}
                                className="h-7 w-7 rounded"
                              />
                              <span className="absolute -bottom-1 -right-1 rounded bg-black/85 px-0.5 text-[9px] font-bold leading-tight text-zinc-200">
                                {p.champLevel}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-zinc-200">
                                {p.championName}
                              </div>
                              <div
                                className="truncate text-[10px]"
                                style={{ color: tierColor(ranks[p.puuid]?.tier) }}
                              >
                                {rankLabel(ranks[p.puuid])}
                                {p.riotIdGameName && (
                                  <span className="text-zinc-600">
                                    {" "}
                                    · {p.riotIdGameName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-1 text-center tabular-nums text-zinc-300">
                          {p.kills}/{p.deaths}/{p.assists}
                        </td>
                        <td className="px-1 text-center tabular-nums text-zinc-400">
                          {p.cs}
                          <span className="text-[10px] text-zinc-600">
                            {" "}
                            ({p.csPerMin.toFixed(1)})
                          </span>
                        </td>
                        <td className="px-1 text-center tabular-nums text-amber-300/80">
                          {fmtGold(p.gold)}
                        </td>
                        <td className="hidden px-1 sm:table-cell">
                          <div className="flex gap-0.5">
                            {p.items.slice(0, 6).map((it, i) => {
                              const src = itemIcon(version, it);
                              return src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={i}
                                  src={src}
                                  alt=""
                                  className="h-4 w-4 rounded-sm"
                                />
                              ) : (
                                <span
                                  key={i}
                                  className="h-4 w-4 rounded-sm bg-white/5"
                                />
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function ItemRow({ ids, version }: { ids: number[]; version?: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 6 }).map((_, i) => {
        const src = itemIcon(version, ids[i] ?? 0);
        return src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" className="h-5 w-5 rounded-sm" />
        ) : (
          <span key={i} className="h-5 w-5 rounded-sm bg-white/5" />
        );
      })}
    </div>
  );
}

const LANES = [
  ["TOP_LANE", "TOP"],
  ["MID_LANE", "MID"],
  ["BOT_LANE", "BOT"],
] as const;
const TIERS = ["OUTER_TURRET", "INNER_TURRET", "BASE_TURRET"] as const;

function TeamTowers({ state, teamId }: { state: GameState; teamId: number }) {
  const up = teamId === 100 ? "bg-sky-400" : "bg-red-400";
  const isDown = (lane: string, tier: string) =>
    state.towersDown.some(
      (t) => t.teamId === teamId && t.lane === lane && t.tower === tier,
    );
  const nexusDown = state.towersDown.filter(
    (t) => t.teamId === teamId && t.tower === "NEXUS_TURRET",
  ).length;
  return (
    <div className="space-y-0.5">
      {LANES.map(([lane, ll]) => (
        <div key={lane} className="flex items-center gap-1">
          <span className="w-8 text-[10px] text-zinc-600">{ll}</span>
          {TIERS.map((tier) => (
            <span
              key={tier}
              className={`h-2.5 w-2.5 rounded-full ${isDown(lane, tier) ? "bg-white/10" : up}`}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-1">
        <span className="w-8 text-[10px] text-zinc-600">Nex</span>
        {[0, 1].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${i < 2 - nexusDown ? up : "bg-white/10"}`}
          />
        ))}
      </div>
    </div>
  );
}

function TeamObjectives({ obj, ms }: { obj: TeamObjective; ms: number }) {
  return (
    <div className="mt-1.5 space-y-0.5 text-[11px] text-zinc-400">
      <div>
        🐉 {obj.dragons.length ? obj.dragons.join(" ") : "—"}
        {obj.soul ? (
          <span className="text-amber-300"> ✨{obj.soul}</span>
        ) : null}
      </div>
      {obj.baronActiveUntil && (
        <div className="text-purple-300">
          バロン残 {fmtClock(obj.baronActiveUntil - ms)}
        </div>
      )}
      {obj.elderActiveUntil && (
        <div className="text-amber-300">
          エルダー残 {fmtClock(obj.elderActiveUntil - ms)}
        </div>
      )}
      <div className="text-zinc-500">
        ヘラルド{obj.heralds}・グラブ{obj.grubs}
      </div>
    </div>
  );
}

function StatePanel({
  data,
  ms,
  me,
  version,
}: {
  data: ReplayData;
  ms: number;
  me: ReplayParticipant | null;
  version?: string;
}) {
  const state = stateAt(data, ms);
  const opp = me ? opponentOf(me, data.participants) : undefined;
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
      <div className="mb-2 text-xs font-semibold text-zinc-300">
        この時点の状況
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[100, 200].map((team) => (
          <div key={team}>
            <div
              className={`mb-1 text-[11px] font-bold ${team === 100 ? "text-sky-400" : "text-red-400"}`}
            >
              {team === 100 ? "ブルー" : "レッド"}
            </div>
            <TeamTowers state={state} teamId={team} />
            <TeamObjectives obj={state.team[team]} ms={ms} />
          </div>
        ))}
      </div>
      {me && opp && (
        <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="shrink-0 text-sky-300">自分</span>
            <ItemRow ids={itemsAt(me.purchases, ms)} version={version} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="shrink-0 text-red-300">対面</span>
            <ItemRow ids={itemsAt(opp.purchases, ms)} version={version} />
          </div>
        </div>
      )}
    </div>
  );
}

function EventLog({
  data,
  partById,
  minute,
  onJump,
}: {
  data: ReplayData;
  partById: Map<number, ReplayParticipant>;
  minute: number;
  onJump: (m: number) => void;
}) {
  const champ = (id?: number) =>
    (id != null ? partById.get(id)?.championName : undefined) ?? "?";
  const teamName = (t?: number) =>
    t === 100 ? "ブルー" : t === 200 ? "レッド" : "?";
  const rows = data.events
    .filter((e) =>
      [
        "CHAMPION_KILL",
        "ELITE_MONSTER_KILL",
        "BUILDING_KILL",
        "DRAGON_SOUL_GIVEN",
      ].includes(e.type),
    )
    .map((e) => {
      let icon = "";
      let label = "";
      if (e.type === "CHAMPION_KILL") {
        icon = "⚔️";
        label = `${champ(e.killerId)} → ${champ(e.victimId)}`;
      } else if (e.type === "ELITE_MONSTER_KILL") {
        const name =
          e.monsterType === "DRAGON"
            ? `ドラゴン(${dragonShort(e.monsterSubType)})`
            : e.monsterType === "BARON_NASHOR"
              ? "バロン"
              : e.monsterType === "RIFTHERALD"
                ? "ヘラルド"
                : e.monsterType === "HORDE"
                  ? "グラブ"
                  : (e.monsterType ?? "モンスター");
        icon = "🐉";
        label = `${name} 討伐 (${teamName(e.teamId)})`;
      } else if (e.type === "BUILDING_KILL") {
        icon = "🏛️";
        label = `${(e.laneType ?? "").replace("_LANE", "")} タワー破壊 (${teamName(e.teamId)}側)`;
      } else {
        icon = "✨";
        label = `ドラゴンソウル (${teamName(e.teamId)})`;
      }
      return { ms: e.ms, icon, label, minute: Math.round(e.ms / 60000) };
    });
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900 p-3">
      <div className="mb-2 text-sm font-semibold text-zinc-300">
        イベントログ（クリックでその時間へ）
      </div>
      <div className="no-scrollbar max-h-72 space-y-0.5 overflow-y-auto">
        {rows.map((r, i) => (
          <button
            key={i}
            onClick={() => onJump(r.minute)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition hover:bg-white/5 ${
              r.minute === minute ? "bg-white/10" : ""
            }`}
          >
            <span className="w-10 shrink-0 tabular-nums text-zinc-500">
              {fmtClock(r.ms)}
            </span>
            <span className="shrink-0">{r.icon}</span>
            <span className="truncate text-zinc-300">{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReplayPoc() {
  const { data: savedRiotId } = useSetting("riotId");
  const champData = useChampions();
  const version = champData?.version;

  const [riotId, setRiotId] = useState("");
  const [myPuuid, setMyPuuid] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [matchId, setMatchId] = useState("");
  const [data, setData] = useState<ReplayData | null>(null);
  const [ranks, setRanks] = useState<Record<string, RankInfo>>({});
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 設定のRiot IDを初期値に（ユーザーがまだ触っていなければ）
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && savedRiotId) {
      setRiotId(savedRiotId);
      seeded.current = true;
    }
  }, [savedRiotId]);

  const maxMinute = data ? data.frames.length - 1 : 0;
  // 自分の特定: puuid優先、ダメならRiot IDの名前で照合（Account-V1とMatch-V5で
  // puuidが食い違うことがあるためフォールバックを持つ）
  const me = useMemo(() => {
    if (!data) return null;
    const gm = riotId.split("#")[0]?.trim().toLowerCase();
    return (
      (myPuuid && data.participants.find((p) => p.puuid === myPuuid)) ||
      (gm &&
        data.participants.find(
          (p) => (p.riotIdGameName ?? "").toLowerCase() === gm,
        )) ||
      null
    );
  }, [data, myPuuid, riotId]);

  // 訪問時：DBの保存済み一覧を即表示（Riotは叩かない）
  const loadCached = async () => {
    try {
      const res = await fetch(`/api/replay?cached=1&count=10`);
      const j = await res.json();
      if (!res.ok) return;
      if (j.puuid) setMyPuuid(j.puuid);
      setMatches(j.matches ?? []);
      if (j.matches?.[0]) {
        setMatchId(j.matches[0].matchId);
        void loadReplay(j.matches[0].matchId);
      }
    } catch {
      /* 保存済みが無ければ何もしない */
    }
  };
  useEffect(() => {
    void loadCached();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 「更新」：Riotから直近試合を取り直してDBに保存
  const refresh = async () => {
    if (!riotId.trim()) {
      setError("設定でRiot IDを保存するか、ここに入力してください");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/replay?list=1&count=10&riotId=${encodeURIComponent(riotId)}`,
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMyPuuid(j.puuid);
      setMatches(j.matches);
      if (j.matches[0] && !data) {
        setMatchId(j.matches[0].matchId);
        void loadReplay(j.matches[0].matchId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadReplay = async (id: string) => {
    setError(null);
    setLoading(true);
    setPlaying(false);
    try {
      const res = await fetch(`/api/replay?matchId=${encodeURIComponent(id)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j as ReplayData);
      setMinute(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // 再生
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setMinute((m) => {
        if (m >= maxMinute) {
          setPlaying(false);
          return m;
        }
        return m + 1;
      });
    }, 700);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, maxMinute]);

  // 試合が変わったら10人の現在ランクを取得（サーバ側で24hキャッシュ）
  useEffect(() => {
    if (!data) return;
    setRanks({});
    const puuids = data.participants.map((p) => p.puuid).filter(Boolean);
    if (!puuids.length) return;
    let alive = true;
    fetch(`/api/replay?ranks=${encodeURIComponent(puuids.join(","))}`)
      .then((r) => r.json())
      .then((j) => alive && j.ranks && setRanks(j.ranks))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [data]);

  const frame = data?.frames[minute];
  const partById = useMemo(() => {
    const m = new Map<number, ReplayParticipant>();
    for (const p of data?.participants ?? []) m.set(p.participantId, p);
    return m;
  }, [data]);

  // 現在の分の前後30秒のイベント
  const nowEvents = useMemo(() => {
    if (!data) return [];
    const center = minute * 60000;
    return data.events.filter((e) => Math.abs(e.ms - center) <= 30000);
  }, [data, minute]);

  // 自分のデス（全試合・常時マーカー）
  const myDeaths = useMemo(() => {
    if (!data || !me) return [];
    return data.events.filter(
      (e) => e.type === "CHAMPION_KILL" && e.victimId === me.participantId,
    );
  }, [data, me]);

  const matchOptions = matches.map((m) => ({
    value: m.matchId,
    label: `${m.champ} ${m.win ? "◯" : "✕"} ${queueName(m.queueId)} ・ ${fmtDate(m.gameStart)}`,
  }));

  return (
    <div className="min-h-full bg-zinc-950 text-white">
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <Link
          href="/planner"
          className="text-sm text-zinc-400 transition hover:text-white"
        >
          ← プランナー
        </Link>
        <h1 className="text-xl font-bold">
          試合<span className="text-sky-400">リプレイ</span>
        </h1>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refresh()}
            placeholder="名前#タグ"
            className="h-9 w-52"
          />
          <Button
            onClick={refresh}
            disabled={loading}
            variant="outline"
            className="h-9"
            title="Riotから最新の試合を取り込む"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} /> 更新
          </Button>
          {matches.length > 0 && (
            <SimpleSelect
              value={matchId}
              options={matchOptions}
              onChange={(v) => {
                setMatchId(v);
                void loadReplay(v);
              }}
              className="min-w-[20rem]"
            />
          )}
          <span className="text-xs text-zinc-600">asia (jp1)</span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row">
          {/* ① マップ */}
          <div className="relative aspect-square w-full max-w-[560px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MAP_IMAGE}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
            {/* 自分のデス（全試合・常時） */}
            {myDeaths.map((e, i) => (
              <div
                key={`d${i}`}
                title={`自分のデス (${Math.round(e.ms / 60000)}分)`}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-red-500/70"
                style={{ left: `${e.rx * 100}%`, top: `${e.ry * 100}%` }}
              >
                <Skull className="size-3.5" />
              </div>
            ))}
            {/* 現在の分のイベント */}
            {nowEvents.map((e, i) => (
              <div
                key={`e${i}`}
                title={e.type + (e.monsterType ? ` ${e.monsterType}` : "")}
                className={`absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/70 ${
                  e.type === "CHAMPION_KILL"
                    ? "bg-red-500"
                    : e.type === "ELITE_MONSTER_KILL"
                      ? "bg-amber-400"
                      : "bg-zinc-300"
                }`}
                style={{ left: `${e.rx * 100}%`, top: `${e.ry * 100}%` }}
              />
            ))}
            {/* チャンピオン位置 */}
            {frame?.positions.map((pos) => {
              const p = partById.get(pos.participantId);
              if (!p) return null;
              const blue = p.teamId === 100;
              const isMe = !!me && p.participantId === me.participantId;
              return (
                <div
                  key={pos.participantId}
                  title={`${p.championName} (${p.riotIdGameName})`}
                  className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${pos.rx * 100}%`, top: `${pos.ry * 100}%` }}
                >
                  <div
                    className={`overflow-hidden rounded-full ring-2 ${
                      isMe
                        ? "ring-yellow-300 ring-offset-1 ring-offset-black"
                        : blue
                          ? "ring-sky-400"
                          : "ring-red-400"
                    }`}
                  >
                    <ChampionIcon
                      id={p.championName}
                      className={isMe ? "h-8 w-8 rounded-full" : "h-6 w-6 rounded-full"}
                    />
                  </div>
                </div>
              );
            })}
            {!data && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-zinc-500">
                {loading
                  ? "読み込み中…"
                  : matches.length
                    ? "試合を選んでください"
                    : "「更新」で試合を取り込んでください"}
              </div>
            )}
          </div>

          {/* ② 情報パネル */}
          <div className="flex-1 space-y-3">
            {data && (
              <>
                <div className="text-xs text-zinc-500">
                  {queueName(data.queueId)} ・ {Math.floor(data.durationSec / 60)}
                  分 ・ {data.frames.length}フレーム(1分)
                </div>

                {/* 再生＋スライダー */}
                <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setPlaying((p) => !p)}
                    >
                      {playing ? <Pause /> : <Play />}
                    </Button>
                    <span className="text-lg font-bold tabular-nums">
                      {minute}
                      <span className="ml-0.5 text-xs font-normal text-zinc-500">
                        分
                      </span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxMinute}
                    value={minute}
                    onChange={(e) => {
                      setPlaying(false);
                      setMinute(Number(e.target.value));
                    }}
                    className="w-full accent-sky-500"
                  />
                </div>

                {/* 自分 vs 対面のリード差 */}
                {me ? (
                  <LeadPanel data={data} me={me} minute={minute} />
                ) : (
                  <div className="rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-zinc-500">
                    この試合にあなた（{riotId}）が見つからないため、リード差は表示できません。
                  </div>
                )}

                {/* ◯分時点の状況（タワー/オブジェクト/アイテム） */}
                <StatePanel
                  data={data}
                  ms={frame?.ms ?? minute * 60000}
                  me={me}
                  version={version}
                />
              </>
            )}
          </div>
        </div>

        {/* ③ 最終スコアボード */}
        {data && (
          <Scoreboard
            data={data}
            mePid={me?.participantId ?? null}
            version={version}
            ranks={ranks}
          />
        )}

        {/* ④ イベントログ */}
        {data && (
          <EventLog
            data={data}
            partById={partById}
            minute={minute}
            onJump={(m) => {
              setPlaying(false);
              setMinute(m);
            }}
          />
        )}
      </main>
    </div>
  );
}
