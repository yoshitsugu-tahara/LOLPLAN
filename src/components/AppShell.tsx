"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { db } from "@/lib/db";
import { OPEN_MAP_EVENT } from "./blocks/MapBlock";
import LabelEditor from "./LabelEditor";
import NoteSidebar from "./NoteSidebar";
import NotesDatabase from "./NotesDatabase";
import SearchModal from "./SearchModal";
import TableOfContents from "./TableOfContents";

const Editor = dynamic(() => import("./Editor"), { ssr: false });
const MapEditorModal = dynamic(() => import("./MapEditorModal"), {
  ssr: false,
});

export default function AppShell() {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [mode, setMode] = useState<"editor" | "database">("editor");
  // タイトル入力はローカルstateで持つ（DB(liveQuery)を value にすると
  // 日本語IMEの変換中に値が裏で書き換わって文字化け・増殖する）
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("lolnote:sidebar-open") === "0") {
      setSidebarOpen(false);
    }
  }, []);

  const toggleSidebar = () =>
    setSidebarOpen((o) => {
      const next = !o;
      localStorage.setItem("lolnote:sidebar-open", next ? "1" : "0");
      return next;
    });

  const selected = useLiveQuery(
    () => (selectedId ? db.notes.get(selectedId) : undefined),
    [selectedId],
  );

  // 全ノートから使われているラベル一覧（オートコンプリート用）
  const allLabels = useLiveQuery(async () => {
    const ns = await db.notes.toArray();
    return [...new Set(ns.flatMap((n) => n.labels ?? []))].sort((a, b) =>
      a.localeCompare(b, "ja"),
    );
  }, []);

  // 別のノートに切り替わった時だけタイトル入力欄を同期する。
  // （同じノートの本文編集などで selected が更新されても上書きしない）
  useEffect(() => {
    setTitleDraft(selected?.title ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Ctrl+F = ノート内検索 / Ctrl+Shift+F = 全ノート横断検索（標準の検索は無効化）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (e.shiftKey) setSearchOpen(true);
        else setFindOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ノートを切り替えたらノート内検索は閉じる
  useEffect(() => setFindOpen(false), [selectedId]);

  // マップブロックからの「開いて」イベントを受け取る
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ mapId: string }>).detail.mapId;
      setMapId(id);
    };
    window.addEventListener(OPEN_MAP_EVENT, handler);
    return () => window.removeEventListener(OPEN_MAP_EVENT, handler);
  }, []);

  const createNote = async () => {
    const id = nanoid();
    const now = Date.now();
    await db.notes.add({
      id,
      title: "無題のノート",
      content: undefined,
      createdAt: now,
      updatedAt: now,
      sectionId: null,
      order: -now, // 新規は未分類の先頭に
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
    setTitleDraft(title);
    db.notes.update(selectedId, { title, updatedAt: Date.now() });
  };

  const updateLabels = (labels: string[]) => {
    if (!selectedId) return;
    db.notes.update(selectedId, { labels, updatedAt: Date.now() });
  };

  if (!mounted) return null;

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100">
      {/* サイドバー */}
      {sidebarOpen && (
        <NoteSidebar
          selectedId={mode === "database" ? null : selectedId}
          databaseActive={mode === "database"}
          onSelect={(id) => {
            setSelectedId(id);
            setMode("editor");
          }}
          onCreateNote={createNote}
          onDeleteNote={deleteNote}
          onToggleSidebar={toggleSidebar}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenDatabase={() => setMode("database")}
        />
      )}

      {/* 本文 */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            title="サイドバーを表示"
            className="absolute left-2 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9 3 3-3 3" />
            </svg>
          </button>
        )}
        {mode === "database" ? (
          <NotesDatabase
            onOpen={(id) => {
              setSelectedId(id);
              setMode("editor");
            }}
            onCreate={() => {
              createNote();
              setMode("editor");
            }}
          />
        ) : selected ? (
          <>
            <div className="mx-auto w-full max-w-3xl px-[54px] pt-16 pb-8">
              <input
                value={titleDraft}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="無題"
                className="w-full bg-transparent text-4xl font-bold leading-tight tracking-tight text-white outline-none placeholder:text-zinc-700"
              />
              <div className="mt-3">
                <LabelEditor
                  labels={selected.labels ?? []}
                  allLabels={allLabels ?? []}
                  onChange={updateLabels}
                />
              </div>
              <TableOfContents content={selected.content} />
            </div>
            <div className="flex-1 overflow-y-auto pb-32">
              <div className="mx-auto w-full max-w-3xl">
                <Editor
                  key={selected.id}
                  note={selected}
                  findOpen={findOpen}
                  onFindClose={() => setFindOpen(false)}
                />
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

      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onSelect={setSelectedId}
        />
      )}
    </div>
  );
}
