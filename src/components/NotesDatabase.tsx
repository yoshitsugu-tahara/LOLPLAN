"use client";

import { ArrowDown, ArrowUp, ArrowUpRight, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { patchNoteCache, useNotes, useSections } from "@/lib/store";
import type { Note } from "@/lib/types";
import { updateNote } from "@/server/actions/notes";
import LabelEditor, { labelColor } from "./LabelEditor";
import { blocksToText } from "./noteText";
import SimpleSelect from "./SimpleSelect";
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

/** テーブル上でタイトルをインライン編集（IME安全なローカルstate＋デバウンス保存） */
function TitleCell({
  id,
  title,
  onSave,
}: {
  id: string;
  title: string;
  onSave: (id: string, title: string) => void;
}) {
  const [value, setValue] = useState(title);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 別のノート行に切り替わった時だけ同期（編集中の値は保持＝IME対策）
  useEffect(() => setValue(title), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const change = (v: string) => {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(id, v), 500);
  };
  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    onSave(id, value);
  };
  return (
    <input
      value={value}
      onChange={(e) => change(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={flush}
      placeholder="無題のノート"
      className="w-full min-w-0 rounded bg-transparent px-1 font-medium text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:bg-white/5 focus:bg-white/10"
    />
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

  // インライン編集（楽観的にキャッシュ更新＋裏で保存）。updatedAtは変えず並びを固定。
  const saveTitle = (id: string, title: string) => {
    patchNoteCache(id, { title });
    updateNote(id, { title });
  };
  const setNoteSection = (id: string, sectionId: string | null) => {
    patchNoteCache(id, { sectionId });
    updateNote(id, { sectionId });
  };
  const setNoteLabels = (id: string, labels: string[]) => {
    patchNoteCache(id, { labels });
    updateNote(id, { labels });
  };
  const sectionOptions = [
    { value: "none", label: "未分類" },
    ...(sections ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];

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

  const SortArrow = ({ k }: { k: SortKey }) =>
    cfg.sortKey === k ? (
      cfg.sortDir === "asc" ? (
        <ArrowUp className="size-3 text-sky-400" />
      ) : (
        <ArrowDown className="size-3 text-sky-400" />
      )
    ) : null;

  const SortHead = ({ label, k }: { label: string; k?: SortKey }) => (
    <TableHead className="text-zinc-500">
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
    </TableHead>
  );

  const renderRow = (n: Note) => (
    <TableRow key={n.id} className="group border-white/5 hover:bg-white/[0.03]">
      <TableCell className="py-1 pl-2 pr-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOpen(n.id)}
            title="開く"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-600 transition hover:bg-white/10 hover:text-sky-300"
          >
            <ArrowUpRight className="size-[13px]" />
          </button>
          <TitleCell id={n.id} title={n.title || ""} onSave={saveTitle} />
        </div>
      </TableCell>
      <TableCell className="px-3 py-1.5">
        <LabelEditor
          labels={n.labels ?? []}
          allLabels={allLabels}
          onChange={(ls) => setNoteLabels(n.id, ls)}
        />
      </TableCell>
      <TableCell className="px-3 py-1.5">
        <SimpleSelect
          value={n.sectionId ?? "none"}
          className="min-w-[8rem]"
          options={sectionOptions}
          onChange={(v) => setNoteSection(n.id, v === "none" ? null : v)}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap px-3 py-1.5 text-zinc-500">
        {fmtDate(n.updatedAt)}
      </TableCell>
    </TableRow>
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
        <Tabs value={view} onValueChange={(v) => setV(v as "table" | "gallery")}>
          <TabsList>
            <TabsTrigger value="table">テーブル</TabsTrigger>
            <TabsTrigger value="gallery">ギャラリー</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={onCreate} size="sm">
          <Plus /> 新規
        </Button>
      </div>

      {/* フィルター/ソート ツールバー */}
      {!loading && (
        <div className="mx-auto mt-4 flex w-full max-w-5xl flex-wrap items-center gap-2 px-8">
          {/* 検索 */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              value={cfg.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="絞り込み…"
              className="h-8 w-44 pl-8"
            />
          </div>

          {/* セクション */}
          <SimpleSelect
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
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className={
                      cfg.labels.length
                        ? "border-sky-400/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15"
                        : ""
                    }
                  />
                }
              >
                ラベル
                {cfg.labels.length > 0 && (
                  <span className="rounded-full bg-sky-500/30 px-1.5 text-[11px]">
                    {cfg.labels.length}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent className="max-h-64 w-52 overflow-y-auto p-1">
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
                      <Checkbox checked={on} className="pointer-events-none" />
                      <span
                        style={labelColor(l)}
                        className="truncate rounded-full border px-2 py-0.5 text-xs font-medium"
                      >
                        {l}
                      </span>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}

          {/* ソート（ギャラリーはヘッダが無いのでここで） */}
          {view === "gallery" && (
            <div className="flex items-center gap-1">
              <SimpleSelect
                value={cfg.sortKey}
                onChange={(v) => update({ sortKey: v as SortKey })}
                options={[
                  { value: "updated", label: "並び: 更新" },
                  { value: "title", label: "並び: タイトル" },
                  { value: "section", label: "並び: セクション" },
                ]}
              />
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  update({ sortDir: cfg.sortDir === "asc" ? "desc" : "asc" })
                }
                title={cfg.sortDir === "asc" ? "昇順" : "降順"}
              >
                {cfg.sortDir === "asc" ? (
                  <ArrowUp />
                ) : (
                  <ArrowDown />
                )}
              </Button>
            </div>
          )}

          {filterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ q: "", section: "all", labels: [] })}
              className="text-zinc-500 hover:text-zinc-300"
            >
              クリア
            </Button>
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
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-white/10 text-xs">
                  <SortHead label="タイトル" k="title" />
                  <SortHead label="ラベル" />
                  <SortHead label="セクション" k="section" />
                  <SortHead label="更新" k="updated" />
                </TableRow>
              </TableHeader>
              <TableBody>{rows.map(renderRow)}</TableBody>
            </Table>
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
