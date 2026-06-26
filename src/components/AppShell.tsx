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

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

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
          <span className="text-lg font-bold text-white">lolnote</span>
          <button
            onClick={createNote}
            title="新規ノート"
            className="rounded bg-sky-500 px-2 py-1 text-sm font-medium text-white hover:bg-sky-400"
          >
            ＋ 新規
          </button>
        </div>
        <Link
          href="/planner"
          className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          🗺️ <span>SRプランナー</span>
        </Link>
        <div className="flex-1 overflow-y-auto">
          {notes?.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">
              まだノートがありません
            </p>
          )}
          {notes?.map((n) => (
            <div
              key={n.id}
              onClick={() => setSelectedId(n.id)}
              className={`group flex cursor-pointer items-center justify-between px-4 py-2 ${
                n.id === selectedId
                  ? "bg-sky-500/15"
                  : "hover:bg-white/5"
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-100">
                  {n.title || "無題のノート"}
                </div>
                <div className="text-xs text-zinc-500">
                  {formatDate(n.updatedAt)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(n.id);
                }}
                className="ml-2 shrink-0 text-zinc-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
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
            <div className="mx-auto w-full max-w-3xl px-12 pt-10">
              <input
                value={selected.title}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="タイトル"
                className="w-full bg-transparent text-3xl font-bold text-white outline-none placeholder:text-zinc-600"
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
