"use client";

import { useEffect, useMemo, useState } from "react";

import {
  type Champion,
  championIcon,
  getChampions,
} from "@/lib/ddragon";
import {
  DND_MIME,
  MARKERS,
  OBJECTIVES,
  type PaletteToken,
  type Team,
  TEAM_COLORS,
  WARDS,
} from "./data";

function TokenRow({
  title,
  items,
  onPlace,
}: {
  title: string;
  items: PaletteToken[];
  onPlace: (t: PaletteToken) => void;
}) {
  return (
    <div>
      <h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <button
            key={t.id}
            title={t.label}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                DND_MIME,
                JSON.stringify({ kind: "token", id: t.id }),
              );
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onPlace(t)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition hover:scale-105"
            style={{
              borderColor: t.color,
              background: `${t.color}1f`,
            }}
          >
            <span className="pointer-events-none select-none">{t.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Palette({
  version,
  team,
  setTeam,
  onPlaceChampion,
  onPlaceToken,
}: {
  version: string;
  team: Team;
  setTeam: (t: Team) => void;
  onPlaceChampion: (c: Champion) => void;
  onPlaceToken: (t: PaletteToken) => void;
}) {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getChampions()
      .then(setChampions)
      .catch(() => setChampions([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return champions;
    return champions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [champions, query]);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-950">
      {/* チーム切り替え */}
      <div className="flex gap-1 p-2">
        {(["blue", "red"] as Team[]).map((t) => (
          <button
            key={t}
            onClick={() => setTeam(t)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-bold transition ${
              team === t
                ? "text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10"
            }`}
            style={team === t ? { background: TEAM_COLORS[t] } : undefined}
          >
            {t === "blue" ? "ブルー" : "レッド"}
          </button>
        ))}
      </div>

      {/* チャンピオン検索 */}
      <div className="px-2 pb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="チャンピオン検索…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none"
        />
      </div>

      {/* チャンピオングリッド */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {champions.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-zinc-500">
            読み込み中…
          </p>
        ) : (
          <div className="grid grid-cols-5 gap-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                title={c.name}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    DND_MIME,
                    JSON.stringify({
                      kind: "champion",
                      id: c.id,
                      name: c.name,
                    }),
                  );
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onPlaceChampion(c)}
                className="aspect-square overflow-hidden rounded-md border-2 border-transparent transition hover:border-sky-400"
                style={{ borderColor: "transparent" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={championIcon(version, c.id)}
                  alt={c.name}
                  loading="lazy"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ワード・オブジェクト・マーカー */}
      <div className="space-y-3 border-t border-white/10 p-3">
        <TokenRow title="ワード" items={WARDS} onPlace={onPlaceToken} />
        <TokenRow title="オブジェクト" items={OBJECTIVES} onPlace={onPlaceToken} />
        <TokenRow title="マーカー" items={MARKERS} onPlace={onPlaceToken} />
      </div>
    </aside>
  );
}
