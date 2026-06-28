"use client";

import { useEffect, useMemo, useState } from "react";

import { useNotes } from "@/lib/store";
import { blocksToText } from "./noteText";

interface Result {
  id: string;
  title: string;
  snippet: string;
}

/** クエリ中の一致部分をハイライト */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="rounded bg-sky-500/30 text-sky-200">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return <>{parts}</>;
}

export default function SearchModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { data: notes } = useNotes();

  const results = useMemo<Result[]>(() => {
    const query = q.trim().toLowerCase();
    if (!query || !notes) return [];
    const out: Result[] = [];
    for (const n of notes) {
      const title = n.title || "無題のノート";
      const body = blocksToText(n.content);
      if (!(title.toLowerCase() + "\n" + body.toLowerCase()).includes(query))
        continue;
      const bidx = body.toLowerCase().indexOf(query);
      let snippet = "";
      if (bidx >= 0) {
        const start = Math.max(0, bidx - 24);
        snippet =
          (start > 0 ? "…" : "") +
          body.slice(start, bidx + query.length + 40).replace(/\s+/g, " ");
      }
      out.push({ id: n.id, title, snippet });
      if (out.length >= 50) break;
    }
    return out;
  }, [q, notes]);

  useEffect(() => setActive(0), [q]);

  const choose = (id: string) => {
    onSelect(id);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active].id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center bg-black/50 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="flex h-fit max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4">
          <svg
            width="16"
            height="16"
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
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ノートを検索…"
            className="flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <kbd className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
            Esc
          </kbd>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {q && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">
              一致するノートがありません
            </p>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => choose(r.id)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition ${
                i === active ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <span className="truncate text-sm font-medium text-zinc-100">
                <Highlight text={r.title} query={q} />
              </span>
              {r.snippet && (
                <span className="line-clamp-1 text-xs text-zinc-500">
                  <Highlight text={r.snippet} query={q} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
