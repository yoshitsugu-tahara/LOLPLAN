"use client";

import type { EditorView } from "@tiptap/pm/view";
import { useEffect, useRef, useState } from "react";

import { getSearch, scrollToActive, setActive, setSearch } from "./searchPlugin";

export default function FindBar({
  view,
  onClose,
}: {
  view: EditorView;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const [count, setCount] = useState({ active: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // 閉じる時にハイライト解除
  useEffect(
    () => () => {
      setSearch(view, "");
    },
    [view],
  );

  const refresh = () => {
    const st = getSearch(view);
    setCount({
      active: st.matches.length ? st.active + 1 : 0,
      total: st.matches.length,
    });
  };

  const onChange = (t: string) => {
    setTerm(t);
    setSearch(view, t);
    refresh();
    requestAnimationFrame(() => scrollToActive(view));
  };

  const nav = (dir: number) => {
    const st = getSearch(view);
    if (!st.matches.length) return;
    setActive(view, st.active + dir);
    refresh();
    scrollToActive(view);
  };

  return (
    <div className="fixed right-6 top-16 z-30 flex items-center gap-0.5 rounded-lg border border-white/10 bg-zinc-800 p-1 shadow-xl">
      <input
        ref={inputRef}
        value={term}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            nav(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="このノート内を検索"
        className="w-44 bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-zinc-500"
      />
      <span className="min-w-[46px] text-center text-xs tabular-nums text-zinc-400">
        {count.total ? `${count.active}/${count.total}` : term ? "0" : ""}
      </span>
      <button
        onClick={() => nav(-1)}
        title="前へ (Shift+Enter)"
        className="flex h-7 w-7 items-center justify-center rounded text-zinc-300 transition hover:bg-white/10 hover:text-white"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      <button
        onClick={() => nav(1)}
        title="次へ (Enter)"
        className="flex h-7 w-7 items-center justify-center rounded text-zinc-300 transition hover:bg-white/10 hover:text-white"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <button
        onClick={onClose}
        title="閉じる (Esc)"
        className="flex h-7 w-7 items-center justify-center rounded text-zinc-300 transition hover:bg-white/10 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
