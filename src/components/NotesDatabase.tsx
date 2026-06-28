"use client";

import { useState } from "react";

import { useNotes, useSections } from "@/lib/store";
import type { Note } from "@/lib/types";
import { labelColor } from "./LabelEditor";
import { blocksToText } from "./noteText";
import { CardGridSkeleton, TableSkeleton } from "./Skeleton";

function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function LabelChips({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((l) => (
        <span
          key={l}
          style={labelColor(l)}
          className="rounded-full border px-1.5 py-px text-[11px] font-medium"
        >
          {l}
        </span>
      ))}
    </span>
  );
}

/** ダークテーマに合わせた自作セレクト（ネイティブselectの置き換え） */
function Select({
  value,
  options,
  onChange,
  minW = "min-w-[10rem]",
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  minW?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-200 transition hover:bg-white/10"
      >
        <span className="whitespace-nowrap">{current?.label}</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute left-0 z-20 mt-1 ${minW} overflow-hidden rounded-lg border border-white/10 bg-zinc-800 p-1 shadow-xl`}
          >
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-white/10 ${
                  o.value === value ? "text-sky-300" : "text-zinc-200"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="shrink-0"
                  >
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type SortKey = "updated" | "title" | "section";
type SortDir = "asc" | "desc";
type Config = {
  q: string;
  section: string; // "all" | "none" | sectionId
  labels: string[];
  sortKey: SortKey;
  sortDir: SortDir;
};

const DEFAULT_CONFIG: Config = {
  q: "",
  section: "all",
  labels: [],
  sortKey: "updated",
  sortDir: "desc",
};
const CONFIG_KEY = "lolnote:db-config";

export default function NotesDatabase({
  onOpen,
  onCreate,
}: {
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { data: notes } = useNotes();
  const { data: sections } = useSections();
  const [view, setView] = useState<"table" | "gallery">(() =>
    typeof window !== "undefined" &&
    localStorage.getItem("lolnote:db-view") === "gallery"
      ? "gallery"
      : "table",
  );
  const [cfg, setCfg] = useState<Config>(() => {
    if (typeof window !== "undefined") {
      try {
        const s = localStorage.getItem(CONFIG_KEY);
        if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) };
      } catch {}
    }
    return DEFAULT_CONFIG;
  });
  const [labelOpen, setLabelOpen] = useState(false);

  const setV = (v: "table" | "gallery") => {
    setView(v);
    localStorage.setItem("lolnote:db-view", v);
  };
  const update = (patch: Partial<Config>) =>
    setCfg((c) => {
      const next = { ...c, ...patch };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
      return next;
    });

  const loading = !notes || !sections;
  const secName = (id?: string | null) =>
    id ? (sections ?? []).find((s) => s.id === id)?.name : undefined;

  const allLabels = [
    ...new Set((notes ?? []).flatMap((n) => n.labels ?? [])),
  ].sort((a, b) => a.localeCompare(b, "ja"));

  // フィルタ
  const q = cfg.q.trim().toLowerCase();
  const filtered = (notes ?? []).filter((n) => {
    if (cfg.section === "none") {
      if (n.sectionId) return false;
    } else if (cfg.section !== "all") {
      if (n.sectionId !== cfg.section) return false;
    }
    if (
      cfg.labels.length &&
      !cfg.labels.every((l) => (n.labels ?? []).includes(l))
    )
      return false;
    if (q) {
      const hay = (
        (n.title || "") +
        "\n" +
        blocksToText(n.content)
      ).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // ソート
  const dir = cfg.sortDir === "asc" ? 1 : -1;
  const rows = [...filtered].sort((a, b) => {
    let r = 0;
    if (cfg.sortKey === "title") {
      r = (a.title || "無題のノート").localeCompare(b.title || "無題のノート", "ja");
    } else if (cfg.sortKey === "section") {
      r = (secName(a.sectionId) ?? "").localeCompare(
        secName(b.sectionId) ?? "",
        "ja",
      );
    } else {
      r = a.updatedAt - b.updatedAt;
    }
    if (r === 0) r = a.updatedAt - b.updatedAt;
    return r * dir;
  });

  const filterActive =
    !!cfg.q || cfg.section !== "all" || cfg.labels.length > 0;

  const sortBy = (key: SortKey) => {
    if (cfg.sortKey === key) {
      update({ sortDir: cfg.sortDir === "asc" ? "desc" : "asc" });
    } else {
      update({ sortKey: key, sortDir: key === "updated" ? "desc" : "asc" });
    }
  };

  const Tab = ({ id, label }: { id: "table" | "gallery"; label: string }) => (
    <button
      onClick={() => setV(id)}
      className={`rounded-md px-2.5 py-1 text-sm transition ${
        view === id
          ? "bg-white/10 text-white"
          : "text-zinc-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  const SortArrow = ({ k }: { k: SortKey }) =>
    cfg.sortKey === k ? (
      <span className="text-sky-400">{cfg.sortDir === "asc" ? "▲" : "▼"}</span>
    ) : null;

  const Th = ({
    label,
    k,
  }: {
    label: string;
    k?: SortKey;
  }) => (
    <th className="px-3 py-2">
      {k ? (
        <button
          onClick={() => sortBy(k)}
          className="flex items-center gap-1 transition hover:text-zinc-200"
        >
          {label}
          <SortArrow k={k} />
        </button>
      ) : (
        label
      )}
    </th>
  );

  const renderRow = (n: Note) => (
    <tr
      key={n.id}
      onClick={() => onOpen(n.id)}
      className="cursor-pointer border-b border-white/5 transition hover:bg-white/5"
    >
      <td className="px-3 py-2 font-medium text-zinc-100">
        <span className="line-clamp-1">{n.title || "無題のノート"}</span>
      </td>
      <td className="px-3 py-2">
        <LabelChips labels={n.labels ?? []} />
      </td>
      <td className="px-3 py-2 text-zinc-400">
        {secName(n.sectionId) ?? <span className="text-zinc-600">—</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
        {fmtDate(n.updatedAt)}
      </td>
    </tr>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-8 pt-10">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          すべてのノート
        </h1>
        <span className="text-sm text-zinc-600">
          {loading ? "" : rows.length}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
          <Tab id="table" label="テーブル" />
          <Tab id="gallery" label="ギャラリー" />
        </div>
        <button
          onClick={onCreate}
          className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-400"
        >
          ＋ 新規
        </button>
      </div>

      {/* フィルター/ソート ツールバー */}
      {!loading && (
        <div className="mx-auto mt-4 flex w-full max-w-5xl flex-wrap items-center gap-2 px-8">
          {/* 検索 */}
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="shrink-0 text-zinc-500"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={cfg.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="絞り込み…"
              className="w-32 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
            />
          </div>

          {/* セクション */}
          <Select
            value={cfg.section}
            onChange={(v) => update({ section: v })}
            options={[
              { value: "all", label: "セクション: すべて" },
              { value: "none", label: "未分類" },
              ...(sections ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />

          {/* ラベル絞り込み */}
          {allLabels.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setLabelOpen((o) => !o)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition ${
                  cfg.labels.length
                    ? "border-sky-400/40 bg-sky-500/10 text-sky-200"
                    : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                }`}
              >
                ラベル
                {cfg.labels.length > 0 && (
                  <span className="rounded-full bg-sky-500/30 px-1.5 text-[11px]">
                    {cfg.labels.length}
                  </span>
                )}
              </button>
              {labelOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setLabelOpen(false)}
                  />
                  <div className="absolute left-0 z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-lg border border-white/10 bg-zinc-800 p-1 shadow-xl">
                    {allLabels.map((l) => {
                      const on = cfg.labels.includes(l);
                      return (
                        <button
                          key={l}
                          onClick={() =>
                            update({
                              labels: on
                                ? cfg.labels.filter((x) => x !== l)
                                : [...cfg.labels, l],
                            })
                          }
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/10"
                        >
                          <span
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                              on
                                ? "border-sky-400 bg-sky-500 text-white"
                                : "border-white/25"
                            }`}
                          >
                            {on && (
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                              >
                                <path d="M5 12l5 5L20 7" />
                              </svg>
                            )}
                          </span>
                          <span
                            style={labelColor(l)}
                            className="truncate rounded-full border px-2 py-0.5 text-xs font-medium"
                          >
                            {l}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ソート（ギャラリーはヘッダが無いのでここで） */}
          {view === "gallery" && (
            <div className="flex items-center gap-1">
              <Select
                value={cfg.sortKey}
                onChange={(v) => update({ sortKey: v as SortKey })}
                options={[
                  { value: "updated", label: "並び: 更新" },
                  { value: "title", label: "並び: タイトル" },
                  { value: "section", label: "並び: セクション" },
                ]}
              />
              <button
                onClick={() =>
                  update({ sortDir: cfg.sortDir === "asc" ? "desc" : "asc" })
                }
                title={cfg.sortDir === "asc" ? "昇順" : "降順"}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-white/10"
              >
                {cfg.sortDir === "asc" ? "▲" : "▼"}
              </button>
            </div>
          )}

          {filterActive && (
            <button
              onClick={() =>
                update({ q: "", section: "all", labels: [] })
              }
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              クリア
            </button>
          )}
        </div>
      )}

      <div className="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-8 pb-16">
          {loading &&
            (view === "table" ? <TableSkeleton /> : <CardGridSkeleton />)}

          {!loading && rows.length === 0 && (
            <p className="py-16 text-center text-sm text-zinc-500">
              {(notes ?? []).length === 0
                ? "まだノートがありません"
                : "条件に一致するノートがありません"}
            </p>
          )}

          {!loading && view === "table" && rows.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y border-white/10 text-left text-xs font-medium text-zinc-500">
                  <Th label="タイトル" k="title" />
                  <Th label="ラベル" />
                  <Th label="セクション" k="section" />
                  <Th label="更新" k="updated" />
                </tr>
              </thead>
              <tbody>{rows.map(renderRow)}</tbody>
            </table>
          )}

          {!loading && view === "gallery" && rows.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((n) => {
                const preview = blocksToText(n.content).slice(0, 140);
                return (
                  <button
                    key={n.id}
                    onClick={() => onOpen(n.id)}
                    className="flex h-40 flex-col gap-2 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-3 text-left transition hover:border-white/25 hover:bg-zinc-800"
                  >
                    <div className="line-clamp-2 text-sm font-semibold text-zinc-100">
                      {n.title || "無題のノート"}
                    </div>
                    <div className="line-clamp-3 flex-1 text-xs leading-relaxed text-zinc-500">
                      {preview || (
                        <span className="text-zinc-700">空のノート</span>
                      )}
                    </div>
                    <LabelChips labels={(n.labels ?? []).slice(0, 3)} />
                    <div className="text-[11px] text-zinc-600">
                      {fmtDate(n.updatedAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
