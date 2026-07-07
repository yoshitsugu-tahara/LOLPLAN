"use client";

import { Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChampionIcon } from "@/components/ChampionSelect";
import SimpleSelect from "@/components/SimpleSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAP_IMAGE } from "@/components/planner/data";
import type { MatchSummary, ReplayData } from "@/lib/riot";

function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ReplayPoc() {
  const [riotId, setRiotId] = useState("Arisa#dps");
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [matchId, setMatchId] = useState("");
  const [data, setData] = useState<ReplayData | null>(null);
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxMinute = data ? data.frames.length - 1 : 0;

  // 試合一覧を取得
  const loadList = async () => {
    setError(null);
    setLoading(true);
    setData(null);
    setMatches([]);
    try {
      const res = await fetch(
        `/api/replay?list=1&count=10&riotId=${encodeURIComponent(riotId)}`,
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMatches(j.matches);
      if (j.matches[0]) {
        setMatchId(j.matches[0].matchId);
        void loadReplay(j.matches[0].matchId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // 選択した試合のタイムラインを取得
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

  const frame = data?.frames[minute];
  const partById = useMemo(() => {
    const m = new Map<number, ReplayData["participants"][number]>();
    for (const p of data?.participants ?? []) m.set(p.participantId, p);
    return m;
  }, [data]);

  // 現在の分の前後30秒に起きたイベント
  const nowEvents = useMemo(() => {
    if (!data) return [];
    const center = minute * 60000;
    return data.events.filter((e) => Math.abs(e.ms - center) <= 30000);
  }, [data, minute]);

  const matchOptions = matches.map((m) => ({
    value: m.matchId,
    label: `${m.champ} ${m.win ? "◯勝" : "✕負"} ・ ${fmtDate(m.gameStart)}`,
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
          <span className="ml-2 text-xs font-normal text-zinc-600">PoC</span>
        </h1>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {/* 入力 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadList()}
            placeholder="名前#タグ（例: Arisa#dps）"
            className="h-9 w-56"
          />
          <Button onClick={loadList} disabled={loading} className="h-9">
            {loading ? "取得中…" : "試合を取得"}
          </Button>
          {matches.length > 0 && (
            <SimpleSelect
              value={matchId}
              options={matchOptions}
              onChange={(v) => {
                setMatchId(v);
                void loadReplay(v);
              }}
              className="min-w-[16rem]"
            />
          )}
          <span className="text-xs text-zinc-600">地域: asia (jp1)</span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row">
          {/* マップ */}
          <div className="relative aspect-square w-full max-w-[640px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MAP_IMAGE}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
            {/* イベント（キル/オブジェクト） */}
            {nowEvents.map((e, i) => (
              <div
                key={i}
                title={e.type + (e.monsterType ? ` ${e.monsterType}` : "")}
                className={`absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/70 ${
                  e.type === "CHAMPION_KILL" ? "bg-red-500" : "bg-amber-400"
                }`}
                style={{ left: `${e.rx * 100}%`, top: `${e.ry * 100}%` }}
              />
            ))}
            {/* チャンピオン位置 */}
            {frame?.positions.map((pos) => {
              const p = partById.get(pos.participantId);
              if (!p) return null;
              const blue = p.teamId === 100;
              return (
                <div
                  key={pos.participantId}
                  title={`${p.championName} (${p.riotIdGameName})`}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${pos.rx * 100}%`, top: `${pos.ry * 100}%` }}
                >
                  <div
                    className={`overflow-hidden rounded-full ring-2 ${
                      blue ? "ring-sky-400" : "ring-red-400"
                    }`}
                  >
                    <ChampionIcon
                      id={p.championName}
                      className="h-7 w-7 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
            {!data && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
                {loading ? "読み込み中…" : "試合を取得してください"}
              </div>
            )}
          </div>

          {/* 情報パネル */}
          <div className="flex-1 space-y-3">
            {data && (
              <>
                <div className="text-sm text-zinc-400">
                  試合時間 {Math.floor(data.durationSec / 60)}分 / フレーム{" "}
                  {data.frames.length}（1分粒度）
                </div>
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

                {/* 凡例（チーム） */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[100, 200].map((team) => (
                    <div
                      key={team}
                      className="rounded-lg border border-white/10 bg-zinc-900 p-2"
                    >
                      <div
                        className={`mb-1 font-bold ${team === 100 ? "text-sky-400" : "text-red-400"}`}
                      >
                        {team === 100 ? "ブルー" : "レッド"}
                      </div>
                      {(data.participants ?? [])
                        .filter((p) => p.teamId === team)
                        .map((p) => (
                          <div
                            key={p.participantId}
                            className="flex items-center gap-1.5 py-0.5 text-zinc-300"
                          >
                            <ChampionIcon
                              id={p.championName}
                              className="h-4 w-4 rounded"
                            />
                            <span className="truncate">{p.championName}</span>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
