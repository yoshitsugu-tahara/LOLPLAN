"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  reloadNotes,
  reloadSections,
  useNotes,
  useSections,
} from "@/lib/store";
import type { Note } from "@/lib/types";
import { moveNote as moveNoteAction } from "@/server/actions/notes";
import {
  createSection as createSectionAction,
  deleteSection as deleteSectionAction,
  renameSection,
} from "@/server/actions/sections";
import { labelColor } from "./LabelEditor";

const NOTE_MIME = "application/x-lolnote-note";

type MenuItem = { label: string; onClick: () => void; danger?: boolean };
type MenuState = { x: number; y: number; items: MenuItem[] } | null;
type DropTarget = { id: string; pos: "before" | "after" | "into" } | null;

function byOrder(a: Note, b: Note) {
  const ao = a.order ?? 0;
  const bo = b.order ?? 0;
  if (ao !== bo) return ao - bo;
  return b.updatedAt - a.updatedAt;
}

function PageIcon() {
  return (
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
  );
}

function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  useEffect(() => {
    if (!menu) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  return (
    <div
      className="fixed z-50 min-w-44 overflow-hidden rounded-lg border border-white/10 bg-zinc-800 py-1 shadow-xl"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((it, i) => (
        <button
          key={i}
          onClick={() => {
            it.onClick();
            onClose();
          }}
          className={`flex w-full items-center px-3 py-1.5 text-left text-sm transition hover:bg-white/10 ${
            it.danger ? "text-red-400" : "text-zinc-200"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export default function NoteSidebar({
  selectedId,
  onSelect,
  onCreateNote,
  onDeleteNote,
  onToggleSidebar,
  onOpenSearch,
  onOpenDatabase,
  databaseActive = false,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onOpenDatabase: () => void;
  databaseActive?: boolean;
}) {
  const { data: notes } = useNotes();
  const { data: sections } = useSections();
  const [menu, setMenu] = useState<MenuState>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  // 絞り込み中のラベル（複数選択＝すべて含むノートのみ表示）
  const [filter, setFilter] = useState<string[]>([]);

  // 最初のノートを自動選択（DB一覧表示中は勝手にエディタへ戻さない）
  useEffect(() => {
    if (databaseActive) return;
    if (!selectedId && notes && notes.length) {
      const top =
        [...notes].filter((n) => !n.sectionId).sort(byOrder)[0] ??
        [...notes].sort(byOrder)[0];
      if (top) onSelect(top.id);
    }
  }, [notes, selectedId, onSelect, databaseActive]);

  if (!notes || !sections) {
    return (
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-900" />
    );
  }

  // 使われている全ラベル（絞り込みチップ用）
  const allLabels = [...new Set(notes.flatMap((n) => n.labels ?? []))].sort(
    (a, b) => a.localeCompare(b, "ja"),
  );
  // 選択中ラベルをすべて含むか（AND）。未選択時は全件通過
  const matches = (n: Note) =>
    filter.every((l) => (n.labels ?? []).includes(l));
  const toggleFilter = (l: string) =>
    setFilter((f) => (f.includes(l) ? f.filter((x) => x !== l) : [...f, l]));

  const uncategorized = notes
    .filter((n) => !n.sectionId && matches(n))
    .sort(byOrder);
  const notesOf = (sid: string) =>
    notes.filter((n) => n.sectionId === sid && matches(n)).sort(byOrder);

  // --- セクション操作 ---
  const createSection = async () => {
    const id = await createSectionAction();
    await reloadSections();
    setRenaming(id);
  };
  const deleteSection = async (id: string) => {
    if (!confirm("このセクションを削除しますか？（中のノートは未分類に戻ります）"))
      return;
    await deleteSectionAction(id);
    await Promise.all([reloadSections(), reloadNotes()]);
  };

  // --- DnD：ノートを toSectionId の toIndex に移動 ---
  const moveNote = async (
    draggedId: string,
    toSectionId: string | null,
    toIndex: number,
  ) => {
    await moveNoteAction(draggedId, toSectionId, toIndex);
    await reloadNotes();
  };

  const handleDropOnNote = (e: React.DragEvent, target: Note) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData(NOTE_MIME);
    setDropTarget(null);
    if (!draggedId || draggedId === target.id) return;
    const sid = target.sectionId ?? null;
    const list = (sid === null ? uncategorized : notesOf(sid)).filter(
      (n) => n.id !== draggedId,
    );
    const ti = list.findIndex((n) => n.id === target.id);
    const pos = e.clientY;
    const rect = e.currentTarget.getBoundingClientRect();
    const before = pos < rect.top + rect.height / 2;
    moveNote(draggedId, sid, before ? ti : ti + 1);
  };

  const dropInto = (e: React.DragEvent, sid: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData(NOTE_MIME);
    setDropTarget(null);
    if (!draggedId) return;
    const len = (sid === null ? uncategorized : notesOf(sid)).filter(
      (n) => n.id !== draggedId,
    ).length;
    moveNote(draggedId, sid, len);
  };

  const renderNote = (n: Note) => {
    const indicator =
      dropTarget?.id === n.id
        ? dropTarget.pos === "before"
          ? "border-t-2 border-sky-500"
          : "border-b-2 border-sky-500"
        : "border-y-2 border-transparent";
    return (
      <div
        key={n.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData(NOTE_MIME, n.id)}
        onDragEnd={() => setDropTarget(null)}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(NOTE_MIME)) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const before = e.clientY < rect.top + rect.height / 2;
          setDropTarget({ id: n.id, pos: before ? "before" : "after" });
        }}
        onDrop={(e) => handleDropOnNote(e, n)}
        onClick={() => onSelect(n.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              { label: "削除", danger: true, onClick: () => onDeleteNote(n.id) },
            ],
          });
        }}
        className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition ${indicator} ${
          n.id === selectedId
            ? "bg-white/10 text-white"
            : "text-zinc-300 hover:bg-white/5"
        }`}
      >
        <PageIcon />
        <span className="min-w-0 flex-1 truncate text-sm">
          {n.title || "無題のノート"}
        </span>
        {!!(n.labels && n.labels.length) && (
          <span className="flex shrink-0 items-center gap-0.5">
            {n.labels.slice(0, 3).map((l) => (
              <span
                key={l}
                title={l}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: labelColor(l).borderColor }}
              />
            ))}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteNote(n.id);
          }}
          className="shrink-0 text-zinc-500 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
          title="削除"
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-900"
      // サイドバー内の右クリックはブラウザ標準メニューを無効化。
      // ノート/セクションは各自のメニューを stopPropagation で優先し、
      // それ以外の余白では「セクションを作成」を出す。
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({
          x: e.clientX,
          y: e.clientY,
          items: [{ label: "＋ セクションを作成", onClick: createSection }],
        });
      }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-base font-bold tracking-tight text-white">
          lolnote
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onCreateNote}
            title="新規ノート"
            className="flex h-7 w-7 items-center justify-center rounded-md text-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ＋
          </button>
          <button
            onClick={onToggleSidebar}
            title="サイドバーを隠す"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="m16 15-3-3 3-3" />
            </svg>
          </button>
        </div>
      </div>

      <button
        onClick={onOpenSearch}
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left">ノート検索</span>
        <kbd className="rounded bg-white/10 px-1 text-[10px] text-zinc-500">
          Ctrl ⇧ F
        </kbd>
      </button>

      <button
        onClick={onOpenDatabase}
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
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
          className="shrink-0"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
        <span>すべてのノート</span>
      </button>

      <Link
        href="/planner"
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
      >
        🗺️ <span>SRプランナー</span>
      </Link>

      <Link
        href="/settings"
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
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
          className="shrink-0"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>設定</span>
      </Link>

      {/* ラベル絞り込み */}
      {allLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 px-2">
          {allLabels.map((l) => {
            const active = filter.includes(l);
            return (
              <button
                key={l}
                onClick={() => toggleFilter(l)}
                style={active ? labelColor(l) : undefined}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                  active
                    ? ""
                    : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      {/* ノート＋セクション。余白の右クリック（aside側）でセクション作成 */}
      <div
        className="no-scrollbar mt-2 flex-1 overflow-y-auto px-2 pb-4"
        onDragOver={(e) =>
          e.dataTransfer.types.includes(NOTE_MIME) && e.preventDefault()
        }
        onDrop={(e) => dropInto(e, null)}
      >
        {/* 未分類 */}
        <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
          ノート
        </div>
        {uncategorized.map(renderNote)}

        {/* セクション（絞り込み中は該当ノートが無いセクションは隠す） */}
        {sections.map((sec) => {
          const secNotes = notesOf(sec.id);
          if (filter.length && secNotes.length === 0) return null;
          return (
          <div key={sec.id} className="mt-3">
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: [
                    { label: "名前を変更", onClick: () => setRenaming(sec.id) },
                    {
                      label: "セクションを削除",
                      danger: true,
                      onClick: () => deleteSection(sec.id),
                    },
                  ],
                });
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(NOTE_MIME)) return;
                e.preventDefault();
                setDropTarget({ id: `sec-${sec.id}`, pos: "into" });
              }}
              onDrop={(e) => dropInto(e, sec.id)}
              className={`mb-1 rounded px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 ${
                dropTarget?.id === `sec-${sec.id}` ? "bg-sky-500/20" : ""
              }`}
            >
              {renaming === sec.id ? (
                <input
                  autoFocus
                  defaultValue={sec.name}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const name = e.target.value.trim() || "セクション";
                    renameSection(sec.id, name).then(reloadSections);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="w-full bg-transparent py-1 uppercase text-white outline-none"
                />
              ) : (
                <span
                  className="block cursor-default py-1"
                  onDoubleClick={() => setRenaming(sec.id)}
                >
                  {sec.name}
                </span>
              )}
            </div>
            {secNotes.map(renderNote)}
          </div>
          );
        })}
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </aside>
  );
}
