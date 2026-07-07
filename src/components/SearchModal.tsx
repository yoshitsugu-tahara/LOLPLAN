"use client";

import { useDeferredValue, useMemo, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useNotes, useSections } from "@/lib/store";
import { labelColor } from "./LabelEditor";
import { blocksToText } from "./noteText";

interface Indexed {
  id: string;
  title: string;
  sectionName: string;
  labels: string[];
  text: string;
  updatedAt: number;
  lowerTitle: string;
  lowerSection: string;
  lowerLabels: string;
  lowerText: string;
}
interface Result {
  item: Indexed;
  terms: string[];
}

/** 複数語のいずれかに一致する箇所をハイライト */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const t of terms) {
    if (!t) continue;
    let i = 0;
    for (;;) {
      const idx = lower.indexOf(t, i);
      if (idx < 0) break;
      ranges.push([idx, idx + t.length]);
      i = idx + t.length;
    }
  }
  if (!ranges.length) return <>{text}</>;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const parts: React.ReactNode[] = [];
  let pos = 0;
  let key = 0;
  for (const [s, e] of merged) {
    if (s > pos) parts.push(text.slice(pos, s));
    parts.push(
      <mark key={key++} className="rounded bg-sky-500/30 text-sky-200">
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return <>{parts}</>;
}

/** 各語の一致場所で重み付けスコア。1語でもどこにも無ければ -1（AND不成立）。 */
function scoreOf(it: Indexed, terms: string[]): number {
  let s = 0;
  for (const t of terms) {
    let hit = 0;
    if (it.lowerTitle.includes(t)) {
      hit += 12;
      if (it.lowerTitle.startsWith(t)) hit += 6;
    }
    if (it.lowerSection.includes(t)) hit += 6;
    if (it.lowerLabels.includes(t)) hit += 6;
    if (it.lowerText.includes(t)) hit += 2;
    if (hit === 0) return -1;
    s += hit;
  }
  return s;
}

/** 本文中の最初の一致周辺を抜き出す */
function snippetOf(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  if (idx < 0) return text.slice(0, 90).replace(/\s+/g, " ");
  const start = Math.max(0, idx - 26);
  return (
    (start > 0 ? "…" : "") + text.slice(start, idx + 60).replace(/\s+/g, " ")
  );
}

export default function SearchModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const { data: notes } = useNotes();
  const { data: sections } = useSections();
  const dq = useDeferredValue(q);

  // インデックスは notes/sections が変わった時だけ構築（blocksToText再計算を避ける）
  const index = useMemo<Indexed[]>(() => {
    const secMap = new Map((sections ?? []).map((s) => [s.id, s.name]));
    return (notes ?? []).map((n) => {
      const title = n.title || "無題のノート";
      const sectionName = n.sectionId ? (secMap.get(n.sectionId) ?? "") : "";
      const labels = n.labels ?? [];
      const text = blocksToText(n.content);
      return {
        id: n.id,
        title,
        sectionName,
        labels,
        text,
        updatedAt: n.updatedAt,
        lowerTitle: title.toLowerCase(),
        lowerSection: sectionName.toLowerCase(),
        lowerLabels: labels.join(" ").toLowerCase(),
        lowerText: text.toLowerCase(),
      };
    });
  }, [notes, sections]);

  const results = useMemo<Result[]>(() => {
    const terms = dq.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      // 空クエリ：最近更新したノートをクイックスイッチャーとして出す
      return [...index]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10)
        .map((item) => ({ item, terms: [] }));
    }
    const scored: { item: Indexed; s: number }[] = [];
    for (const it of index) {
      const s = scoreOf(it, terms);
      if (s >= 0) scored.push({ item: it, s });
    }
    scored.sort((a, b) => b.s - a.s || b.item.updatedAt - a.item.updatedAt);
    return scored.slice(0, 40).map(({ item }) => ({ item, terms }));
  }, [dq, index]);

  const isEmptyQuery = !dq.trim();

  const choose = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <CommandDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      className="top-[12vh] max-w-xl"
    >
      {/* 自前スコアリングで並べるので cmdk のフィルタは無効化 */}
      <Command shouldFilter={false}>
        <CommandInput
          autoFocus
          value={q}
          onValueChange={setQ}
          placeholder="ノート・セクション・ラベルを検索…（スペースで絞り込み）"
        />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>一致するノートがありません</CommandEmpty>
          <CommandGroup heading={isEmptyQuery ? "最近のノート" : undefined}>
            {results.map(({ item, terms }) => {
              const snip = terms.length ? snippetOf(item.text, terms) : "";
              return (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => choose(item.id)}
                  className="flex-col items-start gap-1"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
                      <Highlight text={item.title} terms={terms} />
                    </span>
                    {item.sectionName && (
                      <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
                        <Highlight text={item.sectionName} terms={terms} />
                      </span>
                    )}
                    {item.labels.slice(0, 3).map((l) => (
                      <span
                        key={l}
                        style={labelColor(l)}
                        className="shrink-0 rounded-full border px-1.5 text-[10px] font-medium"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                  {snip && (
                    <span className="line-clamp-1 text-xs text-zinc-500">
                      <Highlight text={snip} terms={terms} />
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>

        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-[11px] text-zinc-600">
          <span>
            <kbd className="rounded bg-white/10 px-1">↑</kbd>
            <kbd className="ml-0.5 rounded bg-white/10 px-1">↓</kbd> 移動
          </span>
          <span>
            <kbd className="rounded bg-white/10 px-1">↵</kbd> 開く
          </span>
          <span className="ml-auto">{results.length} 件</span>
        </div>
      </Command>
    </CommandDialog>
  );
}
