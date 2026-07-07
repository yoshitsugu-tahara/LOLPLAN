"use client";

import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  type Champion,
  championIcon,
  getChampions,
} from "@/lib/ddragon";
import { reloadFavoriteChampions, useFavoriteChampions } from "@/lib/store";
import {
  addFavoriteChampions,
  toggleFavoriteChampion,
} from "@/server/actions/favorites";
import {
  DND_MIME,
  NUMBERS,
  OBJECTIVES,
  type PaletteToken,
  PINGS,
  type Team,
  teamMinions,
  TEAM_COLORS,
  WARDS,
} from "./data";

const FAV_KEY = "lolnote:champ-favorites";

// 旧localStorageのお気に入り（Neonへ一度だけ移行するために読む）
function loadLegacyFavs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** チャンピオン1マス。クリック/ドラッグで配置、右上の星でお気に入り切替 */
function ChampCell({
  c,
  version,
  isFav,
  onToggleFav,
  onPlace,
}: {
  c: Champion;
  version: string;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  onPlace: (c: Champion) => void;
}) {
  return (
    <div className="group relative aspect-square">
      <button
        title={c.name}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(
            DND_MIME,
            JSON.stringify({ kind: "champion", id: c.id, name: c.name }),
          );
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onPlace(c)}
        className="block h-full w-full overflow-hidden rounded-md border-2 border-transparent transition hover:border-sky-400"
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
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav(c.id);
        }}
        title={isFav ? "お気に入り解除" : "お気に入りに追加"}
        className={`absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded bg-black/55 transition ${
          isFav
            ? "text-yellow-400 opacity-100"
            : "text-white opacity-0 group-hover:opacity-100"
        }`}
      >
        <Star className={`size-3 ${isFav ? "fill-yellow-400" : ""}`} />
      </button>
    </div>
  );
}

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
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border text-lg transition hover:scale-105"
            style={{
              borderColor: t.color,
              background: `${t.color}1f`,
            }}
          >
            {t.icon.startsWith("/") || t.icon.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.icon}
                alt={t.label}
                draggable={false}
                className="pointer-events-none h-7 w-7 object-contain"
              />
            ) : (
              <span className="pointer-events-none select-none">{t.icon}</span>
            )}
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
  const { data: favData } = useFavoriteChampions();
  const favorites = useMemo(() => new Set(favData ?? []), [favData]);

  useEffect(() => {
    getChampions()
      .then(setChampions)
      .catch(() => setChampions([]));
  }, []);

  // 旧localStorageのお気に入りを一度だけNeonへ取り込む
  useEffect(() => {
    if (localStorage.getItem("lolnote:fav-migrated")) return;
    const legacy = loadLegacyFavs();
    (async () => {
      if (legacy.length) {
        await addFavoriteChampions(legacy);
        reloadFavoriteChampions();
      }
      localStorage.setItem("lolnote:fav-migrated", "1");
    })();
  }, []);

  const toggleFav = async (id: string) => {
    await toggleFavoriteChampion(id);
    reloadFavoriteChampions();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return champions;
    return champions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [champions, query]);

  const favChamps = useMemo(
    () => champions.filter((c) => favorites.has(c.id)),
    [champions, favorites],
  );
  const showFavSection = !query.trim() && favChamps.length > 0;

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
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="チャンピオン検索…"
          className="h-8 w-full"
        />
      </div>

      {/* チャンピオングリッド */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2">
        {champions.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-zinc-500">
            読み込み中…
          </p>
        ) : (
          <>
            {showFavSection && (
              <div className="mb-3">
                <h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-yellow-500/80">
                  ★ お気に入り
                </h3>
                <div className="grid grid-cols-5 gap-1">
                  {favChamps.map((c) => (
                    <ChampCell
                      key={c.id}
                      c={c}
                      version={version}
                      isFav
                      onToggleFav={toggleFav}
                      onPlace={onPlaceChampion}
                    />
                  ))}
                </div>
              </div>
            )}
            {showFavSection && (
              <h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                すべて
              </h3>
            )}
            {filtered.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-zinc-500">
                該当なし
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-1">
                {filtered.map((c) => (
                  <ChampCell
                    key={c.id}
                    c={c}
                    version={version}
                    isFav={favorites.has(c.id)}
                    onToggleFav={toggleFav}
                    onPlace={onPlaceChampion}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ワード・オブジェクト・マーカー */}
      <div className="space-y-3 border-t border-white/10 p-3">
        <TokenRow title="ワード" items={WARDS} onPlace={onPlaceToken} />
        <TokenRow title="オブジェクト" items={OBJECTIVES} onPlace={onPlaceToken} />
        <TokenRow
          title={`ミニオン（${team === "blue" ? "青" : "赤"}）`}
          items={teamMinions(team)}
          onPlace={onPlaceToken}
        />
        <TokenRow title="番号（順番）" items={NUMBERS} onPlace={onPlaceToken} />
        <TokenRow title="ピン（合図）" items={PINGS} onPlace={onPlaceToken} />
      </div>
    </aside>
  );
}
