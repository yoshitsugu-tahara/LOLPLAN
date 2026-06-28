"use client";

import { useEffect, useState } from "react";

import { reloadFocuses, reloadGames, useFocuses, useGames } from "@/lib/store";

export default function FocusHud() {
  const { data: focuses } = useFocuses();
  const { data: games } = useGames();
  const [done, setDone] = useState<Set<string>>(new Set());

  // サブモニターはフォーカスされないので定期的に取り直す
  useEffect(() => {
    const t = setInterval(() => {
      reloadFocuses();
      reloadGames();
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = (games ?? []).filter((g) => g.playedAt >= start.getTime());
  const w = today.filter((g) => g.result === "win").length;
  const l = today.length - w;

  const toggle = (id: string) =>
    setDone((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const list = focuses ?? [];

  return (
    <div className="flex h-full flex-col bg-zinc-950 px-6 py-6 text-white">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-wide text-zinc-300">
          今日の意識
        </h1>
        {today.length > 0 && (
          <span className="text-sm font-semibold">
            <span className="text-emerald-400">{w}</span>
            <span className="text-zinc-600"> - </span>
            <span className="text-rose-400">{l}</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {list.length === 0 && (
          <p className="text-center text-sm text-zinc-600">
            /train で意識を追加してください
          </p>
        )}
        {list.map((f, i) => {
          const on = done.has(f.id);
          return (
            <button
              key={f.id}
              onClick={() => toggle(f.id)}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                on
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold transition ${
                  on
                    ? "bg-emerald-500 text-white"
                    : "bg-sky-500/20 text-sky-300"
                }`}
              >
                {on ? "✓" : i + 1}
              </span>
              <span
                className={`text-xl font-bold leading-snug ${
                  on ? "text-emerald-200 line-through decoration-2" : "text-white"
                }`}
              >
                {f.text}
              </span>
            </button>
          );
        })}
      </div>

      {list.length > 0 && (
        <button
          onClick={() => setDone(new Set())}
          className="mt-4 self-center rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          チェックをリセット（次の試合へ）
        </button>
      )}
    </div>
  );
}
