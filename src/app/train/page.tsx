"use client";

import { Monitor, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import ChampionSelect, {
  ChampionIcon,
  useChampions,
} from "@/components/ChampionSelect";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  reloadFocuses,
  reloadGames,
  useFocuses,
  useGames,
  useMistakeStats,
} from "@/lib/store";
import { FOCUS_SCORES, PRESET_TAGS, ROLES, roleLabel } from "@/lib/training-data";
import type { GameResult } from "@/lib/types";
import {
  addFocus,
  addGame,
  deleteFocus,
  deleteGame,
} from "@/server/actions/training";

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ───────────── 意識ボード ─────────────
function FocusBoard() {
  const { data: focuses } = useFocuses();
  const [text, setText] = useState("");

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await addFocus(t);
    reloadFocuses();
  };

  return (
    <Card className="gap-0 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">今の意識</h2>
        <span className="text-[11px] text-zinc-600">1〜3個に絞ると効く</span>
      </div>

      <ul className="mb-3 space-y-1.5">
        {(focuses ?? []).length === 0 && (
          <li className="py-3 text-center text-xs text-zinc-600">
            意識を追加してサブモニターに出そう
          </li>
        )}
        {(focuses ?? []).map((f, i) => (
          <li
            key={f.id}
            className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300">
              {i + 1}
            </span>
            <span className="flex-1 text-sm text-zinc-100">{f.text}</span>
            <button
              onClick={async () => {
                await deleteFocus(f.id);
                reloadFocuses();
              }}
              className="text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="例: 3分のリコールタイミングを意識"
          className="h-9 flex-1"
        />
        <Button onClick={add} className="h-9">
          追加
        </Button>
      </div>
    </Card>
  );
}

// ───────────── 試合記録フォーム ─────────────
function GameForm() {
  const [result, setResult] = useState<GameResult | null>(null);
  const [role, setRole] = useState("");
  const [champion, setChampion] = useState("");
  const [focusScore, setFocusScore] = useState("");
  const [good, setGood] = useState("");
  const [mistake, setMistake] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [nextFocus, setNextFocus] = useState("");
  const [addNext, setAddNext] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setResult(null);
    setRole("");
    setChampion("");
    setFocusScore("");
    setGood("");
    setMistake("");
    setTags([]);
    setNextFocus("");
    setAddNext(false);
  };

  const toggleTag = (t: string) =>
    setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  const save = async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      await addGame({
        result,
        role,
        champion,
        focusScore,
        good,
        mistake,
        tags,
        nextFocus,
      });
      if (addNext && nextFocus.trim()) await addFocus(nextFocus.trim());
      reloadGames();
      reloadFocuses();
      reset();
    } finally {
      setSaving(false);
    }
  };

  const Pill = ({
    on,
    onClick,
    children,
    className = "",
  }: {
    on: boolean;
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        on
          ? "border-sky-400/50 bg-sky-500/15 text-white"
          : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
      } ${className}`}
    >
      {children}
    </button>
  );

  return (
    <Card className="gap-0 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-300">試合を記録</h2>

      {/* 勝敗 */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setResult("win")}
          className={`flex-1 rounded-lg border py-2 text-sm font-bold transition ${
            result === "win"
              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
              : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
          }`}
        >
          勝ち
        </button>
        <button
          onClick={() => setResult("lose")}
          className={`flex-1 rounded-lg border py-2 text-sm font-bold transition ${
            result === "lose"
              ? "border-rose-400/50 bg-rose-500/20 text-rose-200"
              : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
          }`}
        >
          負け
        </button>
      </div>

      {/* ロール + チャンプ */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {ROLES.map((r) => (
          <Pill key={r.value} on={role === r.value} onClick={() => setRole(role === r.value ? "" : r.value)}>
            {r.label}
          </Pill>
        ))}
        <ChampionSelect value={champion} onChange={setChampion} />
      </div>

      {/* 意識スコア */}
      <div className="mb-3">
        <div className="mb-1 text-xs text-zinc-500">意識は守れた？</div>
        <div className="flex gap-1.5">
          {FOCUS_SCORES.map((s) => (
            <Pill
              key={s.value}
              on={focusScore === s.value}
              onClick={() => setFocusScore(focusScore === s.value ? "" : s.value)}
            >
              <span className={focusScore === s.value ? "" : s.cls}>{s.label}</span>
            </Pill>
          ))}
        </div>
      </div>

      {/* 良かった点 / ミス */}
      <Input
        value={good}
        onChange={(e) => setGood(e.target.value)}
        placeholder="◎ よかった点（一言）"
        className="mb-2 h-9"
      />
      <Input
        value={mistake}
        onChange={(e) => setMistake(e.target.value)}
        placeholder="✕ 一番のミス（一言）"
        className="mb-2 h-9"
      />

      {/* ミスタグ */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESET_TAGS.map((t) => (
          <button
            key={t}
            onClick={() => toggleTag(t)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              tags.includes(t)
                ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
                : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 次の意識 */}
      <Input
        value={nextFocus}
        onChange={(e) => setNextFocus(e.target.value)}
        placeholder="→ 次の試合の意識（任意）"
        className="mb-2 h-9"
      />
      <label className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <Checkbox
          checked={addNext}
          onCheckedChange={(v) => setAddNext(v === true)}
        />
        この意識を「今の意識」ボードに追加する
      </label>

      <Button
        onClick={save}
        disabled={!result || saving}
        className="h-10 w-full font-bold"
      >
        {saving ? "記録中…" : "記録する"}
      </Button>
    </Card>
  );
}

// ───────────── 最近の試合 ─────────────
function RecentGames() {
  const { data: games } = useGames();
  const champData = useChampions();
  const champName = (id?: string | null) =>
    (id && champData?.champions.find((c) => c.id === id)?.name) || id || "";
  const list = games ?? [];
  // 今日の戦績
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = list.filter((g) => g.playedAt >= start.getTime());
  const w = today.filter((g) => g.result === "win").length;
  const l = today.length - w;

  return (
    <Card className="gap-0 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">最近の試合</h2>
        {today.length > 0 && (
          <span className="text-xs text-zinc-500">
            今日 <span className="text-emerald-300">{w}</span>
            <span className="text-zinc-600">-</span>
            <span className="text-rose-300">{l}</span>
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {list.length === 0 && (
          <li className="py-4 text-center text-xs text-zinc-600">
            まだ記録がありません
          </li>
        )}
        {list.map((g) => (
          <li
            key={g.id}
            className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                g.result === "win"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/20 text-rose-300"
              }`}
            >
              {g.result === "win" ? "勝" : "負"}
            </span>
            <span className="w-9 shrink-0 text-xs text-zinc-500">
              {roleLabel(g.role)}
            </span>
            <span className="flex w-24 shrink-0 items-center gap-1.5 text-zinc-300">
              {g.champion ? (
                <>
                  <ChampionIcon id={g.champion} className="h-5 w-5" />
                  <span className="truncate">{champName(g.champion)}</span>
                </>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-zinc-500">
              {g.mistake ? `✕ ${g.mistake}` : g.good ? `◎ ${g.good}` : ""}
            </span>
            <span className="shrink-0 text-[11px] text-zinc-600">
              {fmtTime(g.playedAt)}
            </span>
            <button
              onClick={async () => {
                await deleteGame(g.id);
                reloadGames();
              }}
              className="shrink-0 text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ───────────── 頻出ミス ─────────────
function MistakeTop() {
  const { data: stats } = useMistakeStats();
  const top = (stats ?? []).slice(0, 6);
  const max = top[0]?.count ?? 1;

  return (
    <Card className="gap-0 p-4">
      <h2 className="mb-1 text-sm font-semibold text-zinc-300">
        頻出ミス（直近20試合）
      </h2>
      <p className="mb-3 text-[11px] text-zinc-600">
        多いものを次の意識にすると伸びやすい
      </p>
      {top.length === 0 ? (
        <p className="py-3 text-center text-xs text-zinc-600">
          試合を記録すると集計されます
        </p>
      ) : (
        <ul className="space-y-2">
          {top.map((s) => (
            <li key={s.tag} className="flex items-center gap-2">
              <span className="w-36 shrink-0 truncate text-xs text-zinc-300">
                {s.tag}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-rose-400/70"
                  style={{ width: `${(s.count / max) * 100}%` }}
                />
              </div>
              <span className="w-4 shrink-0 text-right text-xs text-zinc-500">
                {s.count}
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={async () => {
                  await addFocus(s.tag);
                  reloadFocuses();
                }}
                title="意識に追加"
                className="shrink-0 text-zinc-400 hover:border-sky-400/50 hover:text-sky-300"
              >
                <Plus /> 意識
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function TrainPage() {
  return (
    <div className="min-h-full bg-zinc-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-zinc-400 transition hover:text-white"
          >
            ← lolnote
          </Link>
          <h1 className="text-xl font-bold">
            練習<span className="text-sky-400">ループ</span>
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.open("/focus", "lolnote-focus", "width=420,height=600")
          }
        >
          <Monitor /> サブモニター表示
        </Button>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-6 py-6 lg:grid-cols-2">
        <div className="space-y-4">
          <FocusBoard />
          <MistakeTop />
        </div>
        <div className="space-y-4">
          <GameForm />
          <RecentGames />
        </div>
      </main>
    </div>
  );
}
