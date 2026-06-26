"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

import { db } from "@/lib/db";
import { OPEN_MAP_EVENT } from "./blocks/MapBlock";

const Editor = dynamic(() => import("./Editor"), { ssr: false });
const MapEditorModal = dynamic(() => import("./MapEditorModal"), {
  ssr: false,
});

export default function AppShell() {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const notes = useLiveQuery(
    () => db.notes.orderBy("updatedAt").reverse().toArray(),
    [],
  );
  const selected = useLiveQuery(
    () => (selectedId ? db.notes.get(selectedId) : undefined),
    [selectedId],
  );

  // マップブロックからの「開いて」イベントを受け取る
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ mapId: string }>).detail.mapId;
      setMapId(id);
    };
    window.addEventListener(OPEN_MAP_EVENT, handler);
    return () => window.removeEventListener(OPEN_MAP_EVENT, handler);
  }, []);

  // 最初のノートを自動選択
  useEffect(() => {
    if (!selectedId && notes && notes.length) {
      setSelectedId(notes[0].id);
    }
  }, [notes, selectedId]);

  const createNote = async () => {
    const id = nanoid();
    const now = Date.now();
    await db.notes.add({
      id,
      title: "無題のノート",
      content: undefined,
      createdAt: now,
      updatedAt: now,
    });
    setSelectedId(id);
  };

  const deleteNote = async (id: string) => {
    if (!confirm("このノートを削除しますか？")) return;
    await db.notes.delete(id);
    if (selectedId === id) setSelectedId(null);
  };

  const updateTitle = (title: string) => {
    if (!selectedId) return;
    db.notes.update(selectedId, { title, updatedAt: Date.now() });
  };

  if (!mounted) return null;

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100">
      {/* サイドバー */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-base font-bold tracking-tight text-white">
            lolnote
          </span>
          <button
            onClick={createNote}
            title="新規ノート"
            className="flex h-7 w-7 items-center justify-center rounded-md text-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ＋
          </button>
        </div>
        <Link
          href="/planner"
          className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
        >
          🗺️ <span>SRプランナー</span>
        </Link>

        <div className="mb-1 mt-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
          ノート
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-2">
          {notes?.length === 0 && (
            <p className="px-2 py-4 text-sm text-zinc-600">
              まだノートがありません
            </p>
          )}
          {notes?.map((n) => (
            <div
              key={n.id}
              onClick={() => setSelectedId(n.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition ${
                n.id === selectedId
                  ? "bg-white/10 text-white"
                  : "text-zinc-300 hover:bg-white/5"
              }`}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-zinc-500"
              >
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-sm">
                {n.title || "無題のノート"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(n.id);
                }}
                className="shrink-0 text-zinc-500 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                title="削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* 本文 */}
      <main className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="mx-auto w-full max-w-3xl px-[54px] pt-16 pb-4">
              <input
                value={selected.title}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="無題"
                className="w-full bg-transparent text-4xl font-bold tracking-tight text-white outline-none placeholder:text-zinc-700"
              />
            </div>
            <div className="flex-1 overflow-y-auto pb-32">
              <div className="mx-auto w-full max-w-3xl">
                <Editor key={selected.id} note={selected} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-zinc-500">
            <div className="text-center">
              <p className="mb-3">ノートを選択するか、新規作成してください</p>
              <button
                onClick={createNote}
                className="rounded bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
              >
                ＋ 新しいノート
              </button>
            </div>
          </div>
        )}
      </main>

      {mapId && (
        <MapEditorModal mapId={mapId} onClose={() => setMapId(null)} />
      )}
    </div>
  );
}
