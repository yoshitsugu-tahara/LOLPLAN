"use client";

import { ChevronDown, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { championIcon, getChampions, getVersion, type Champion } from "@/lib/ddragon";
import { reloadFavoriteChampions, useFavoriteChampions } from "@/lib/store";
import { toggleFavoriteChampion } from "@/server/actions/favorites";

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

/** 1マス（アイコン＋お気に入り星） */
function Cell({
  c,
  value,
  fav,
  onPick,
}: {
  c: Champion;
  value: string;
  fav: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="group relative aspect-square">
      <button
        title={c.name}
        onClick={() => onPick(c.id)}
        className={`block h-full w-full overflow-hidden rounded-md border-2 transition hover:border-sky-400 ${
          c.id === value ? "border-sky-400" : "border-transparent"
        }`}
      >
        <ChampionIcon id={c.id} className="h-full w-full" />
      </button>
      <button
        onClick={async (e) => {
          e.stopPropagation();
          await toggleFavoriteChampion(c.id);
          reloadFavoriteChampions();
        }}
        title={fav ? "お気に入り解除" : "お気に入りに追加"}
        className={`absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded bg-black/55 transition ${
          fav
            ? "text-yellow-400 opacity-100"
            : "text-white opacity-0 group-hover:opacity-100"
        }`}
      >
        <Star className={`size-2.5 ${fav ? "fill-yellow-400" : ""}`} />
      </button>
    </div>
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
  const { data: favs } = useFavoriteChampions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const champions = data?.champions ?? [];
  const selected = champions.find((c) => c.id === value);
  const favSet = new Set(favs ?? []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return champions;
    return champions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [champions, query]);

  const favChamps = champions.filter((c) => favSet.has(c.id));
  const showFav = !query.trim() && favChamps.length > 0;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button className="flex h-[34px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2 text-sm text-zinc-200 transition hover:bg-white/10" />
        }
      >
        {selected ? (
          <>
            <ChampionIcon id={selected.id} className="h-5 w-5" />
            <span className="max-w-24 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-zinc-500">チャンプ</span>
        )}
        <ChevronDown className="size-3 text-zinc-500" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="mb-2 flex items-center gap-1.5">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索…"
            className="h-8 flex-1"
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
          <p className="py-4 text-center text-xs text-zinc-500">読み込み中…</p>
        ) : (
          <div className="no-scrollbar max-h-56 overflow-y-auto">
            {showFav && (
              <>
                <div className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500/80">
                  ★ お気に入り
                </div>
                <div className="mb-2 grid grid-cols-6 gap-1">
                  {favChamps.map((c) => (
                    <Cell key={c.id} c={c} value={value} fav onPick={pick} />
                  ))}
                </div>
                <div className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  すべて
                </div>
              </>
            )}
            <div className="grid grid-cols-6 gap-1">
              {filtered.map((c) => (
                <Cell
                  key={c.id}
                  c={c}
                  value={value}
                  fav={favSet.has(c.id)}
                  onPick={pick}
                />
              ))}
              {filtered.length === 0 && (
                <p className="col-span-6 py-3 text-center text-xs text-zinc-500">
                  該当なし
                </p>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
