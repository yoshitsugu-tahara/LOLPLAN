"use client";

import { useEffect, useMemo, useState } from "react";

import { championIcon, getChampions, getVersion, type Champion } from "@/lib/ddragon";

// チャンピオン一覧＋バージョンをモジュールキャッシュで一度だけ取得する
let cache: { version: string; champions: Champion[] } | null = null;
let inflight: Promise<{ version: string; champions: Champion[] }> | null = null;

export function useChampions() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    if (cache) {
      setData(cache);
      return;
    }
    if (!inflight) {
      inflight = Promise.all([getVersion(), getChampions()]).then(
        ([version, champions]) => {
          cache = { version, champions };
          return cache;
        },
      );
    }
    let alive = true;
    inflight.then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data; // null while loading
}

/** チャンピオンの四角アイコン（idから） */
export function ChampionIcon({
  id,
  className = "h-5 w-5",
}: {
  id?: string | null;
  className?: string;
}) {
  const data = useChampions();
  if (!id) return null;
  if (!data) return <span className={`${className} rounded bg-white/10`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={championIcon(data.version, id)}
      alt=""
      loading="lazy"
      className={`${className} rounded object-cover`}
    />
  );
}

export default function ChampionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const data = useChampions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const champions = data?.champions ?? [];
  const selected = champions.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return champions;
    return champions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [champions, query]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-[34px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2 text-sm text-zinc-200 transition hover:bg-white/10"
      >
        {selected ? (
          <>
            <ChampionIcon id={selected.id} className="h-5 w-5" />
            <span className="max-w-24 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-zinc-500">チャンプ</span>
        )}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-zinc-500 transition ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-20 mt-1 w-64 rounded-lg border border-white/10 bg-zinc-800 p-2 shadow-xl">
            <div className="mb-2 flex items-center gap-1.5">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="検索…"
                className="flex-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-sky-400"
              />
              {value && (
                <button
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="shrink-0 rounded-md px-1.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  なし
                </button>
              )}
            </div>
            {!data ? (
              <p className="py-4 text-center text-xs text-zinc-500">
                読み込み中…
              </p>
            ) : (
              <div className="no-scrollbar grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    title={c.name}
                    onClick={() => {
                      onChange(c.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`aspect-square overflow-hidden rounded-md border-2 transition hover:border-sky-400 ${
                      c.id === value ? "border-sky-400" : "border-transparent"
                    }`}
                  >
                    <ChampionIcon id={c.id} className="h-full w-full" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-6 py-3 text-center text-xs text-zinc-500">
                    該当なし
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
