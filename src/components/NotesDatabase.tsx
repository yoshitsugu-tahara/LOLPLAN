"use client";

import { useState } from "react";

import { useNotes, useSections } from "@/lib/store";
import { labelColor } from "./LabelEditor";
import { blocksToText } from "./noteText";

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

  const setV = (v: "table" | "gallery") => {
    setView(v);
    localStorage.setItem("lolnote:db-view", v);
  };

  if (!notes || !sections) return null;

  const secName = (id?: string | null) =>
    id ? sections.find((s) => s.id === id)?.name : undefined;
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);

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

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-8 pt-10">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          すべてのノート
        </h1>
        <span className="text-sm text-zinc-600">{notes.length}</span>
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

      <div className="no-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-8 pb-16">
          {notes.length === 0 && (
            <p className="py-16 text-center text-sm text-zinc-500">
              まだノートがありません
            </p>
          )}

          {view === "table" && notes.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y border-white/10 text-left text-xs font-medium text-zinc-500">
                  <th className="px-3 py-2">タイトル</th>
                  <th className="px-3 py-2">ラベル</th>
                  <th className="px-3 py-2">セクション</th>
                  <th className="px-3 py-2">更新</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((n) => (
                  <tr
                    key={n.id}
                    onClick={() => onOpen(n.id)}
                    className="cursor-pointer border-b border-white/5 transition hover:bg-white/5"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-100">
                      <span className="line-clamp-1">
                        {n.title || "無題のノート"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <LabelChips labels={n.labels ?? []} />
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {secName(n.sectionId) ?? (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                      {fmtDate(n.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === "gallery" && notes.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sorted.map((n) => {
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
                      {preview || <span className="text-zinc-700">空のノート</span>}
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
