"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

/** ラベル名から安定した色を作る */
export function labelColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    background: `hsl(${hue} 55% 22%)`,
    color: `hsl(${hue} 75% 80%)`,
    borderColor: `hsl(${hue} 45% 40%)`,
  };
}

export default function LabelEditor({
  labels,
  allLabels,
  onChange,
}: {
  labels: string[];
  allLabels: string[];
  onChange: (labels: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allLabels
      .filter((l) => !labels.includes(l) && l.toLowerCase().includes(q))
      .slice(0, 6);
  }, [allLabels, labels, query]);

  const add = (name: string) => {
    const n = name.trim();
    if (!n || labels.includes(n)) {
      setQuery("");
      return;
    }
    onChange([...labels, n]);
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (name: string) => onChange(labels.filter((l) => l !== name));

  const showCreate =
    query.trim() &&
    !allLabels.some((l) => l.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((l) => (
        <span
          key={l}
          style={labelColor(l)}
          className="group/chip inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
        >
          {l}
          <button
            onClick={() => remove(l)}
            className="opacity-60 transition hover:opacity-100"
            title="削除"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      {adding ? (
        <div className="relative">
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setTimeout(() => setAdding(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // 候補があれば先頭候補を採用、無ければ入力文字で新規作成
                add(suggestions[0] ?? query);
              } else if (e.key === "Escape") {
                setAdding(false);
                setQuery("");
              }
            }}
            placeholder="ラベル名…"
            className="w-32 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-sky-400"
          />
          {(suggestions.length > 0 || showCreate) && (
            <div className="absolute left-0 top-7 z-20 min-w-36 overflow-hidden rounded-lg border border-white/10 bg-zinc-800 py-1 shadow-xl">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(s);
                  }}
                  className="flex w-full items-center px-2 py-1 text-left text-xs text-zinc-200 hover:bg-white/10"
                >
                  <span
                    style={labelColor(s)}
                    className="rounded-full border px-2 py-0.5 font-medium"
                  >
                    {s}
                  </span>
                </button>
              ))}
              {showCreate && (
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(query);
                  }}
                  className="flex w-full items-center gap-1 px-2 py-1 text-left text-xs text-zinc-400 hover:bg-white/10"
                >
                  ＋「{query.trim()}」を作成
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/20 px-2 py-0.5 text-xs text-zinc-400 transition hover:border-white/40 hover:text-white"
        >
          <Plus className="size-3" /> ラベル
        </button>
      )}
    </div>
  );
}
