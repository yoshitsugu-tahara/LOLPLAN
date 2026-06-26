"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useEffect, useState } from "react";

import { db, type Note } from "@/lib/db";

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
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onToggleSidebar: () => void;
}) {
  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const sections = useLiveQuery(
    () => db.sections.orderBy("order").toArray(),
    [],
  );
  const [menu, setMenu] = useState<MenuState>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  // 最初のノートを自動選択
  useEffect(() => {
    if (!selectedId && notes && notes.length) {
      const top =
        [...notes].filter((n) => !n.sectionId).sort(byOrder)[0] ??
        [...notes].sort(byOrder)[0];
      if (top) onSelect(top.id);
    }
  }, [notes, selectedId, onSelect]);

  if (!notes || !sections) {
    return (
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-900" />
    );
  }

  const uncategorized = notes.filter((n) => !n.sectionId).sort(byOrder);
  const notesOf = (sid: string) =>
    notes.filter((n) => n.sectionId === sid).sort(byOrder);

  // --- セクション操作 ---
  const createSection = () => {
    const id = nanoid();
    const maxO = sections.reduce((m, s) => Math.max(m, s.order), -1);
    db.sections.add({ id, name: "新しいセクション", order: maxO + 1 });
    setRenaming(id);
  };
  const deleteSection = async (id: string) => {
    if (!confirm("このセクションを削除しますか？（中のノートは未分類に戻ります）"))
      return;
    await db.transaction("rw", db.notes, db.sections, async () => {
      const inSec = (await db.notes.toArray()).filter(
        (n) => n.sectionId === id,
      );
      for (const n of inSec) await db.notes.update(n.id, { sectionId: null });
      await db.sections.delete(id);
    });
  };

  // --- DnD：ノートを toSectionId の toIndex に移動 ---
  const moveNote = async (
    draggedId: string,
    toSectionId: string | null,
    toIndex: number,
  ) => {
    await db.transaction("rw", db.notes, async () => {
      const all = await db.notes.toArray();
      const dragged = all.find((n) => n.id === draggedId);
      if (!dragged) return;
      const fromSectionId = dragged.sectionId ?? null;
      const target = all
        .filter((n) => (n.sectionId ?? null) === toSectionId && n.id !== draggedId)
        .sort(byOrder);
      const idx = Math.max(0, Math.min(toIndex, target.length));
      target.splice(idx, 0, dragged);
      for (let i = 0; i < target.length; i++) {
        const patch: Partial<Note> = { order: i };
        if (target[i].id === draggedId) patch.sectionId = toSectionId;
        await db.notes.update(target[i].id, patch);
      }
      if (fromSectionId !== toSectionId) {
        const old = all
          .filter(
            (n) => (n.sectionId ?? null) === fromSectionId && n.id !== draggedId,
          )
          .sort(byOrder);
        for (let i = 0; i < old.length; i++)
          await db.notes.update(old[i].id, { order: i });
      }
    });
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
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-900">
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

      <Link
        href="/planner"
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
      >
        🗺️ <span>SRプランナー</span>
      </Link>

      {/* ノート＋セクション。空きスペース右クリックでセクション作成 */}
      <div
        className="no-scrollbar mt-2 flex-1 overflow-y-auto px-2 pb-4"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({
            x: e.clientX,
            y: e.clientY,
            items: [{ label: "＋ セクションを作成", onClick: createSection }],
          });
        }}
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

        {/* セクション */}
        {sections.map((sec) => (
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
                    db.sections.update(sec.id, {
                      name: e.target.value.trim() || "セクション",
                    });
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
            {notesOf(sec.id).map(renderNote)}
          </div>
        ))}
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </aside>
  );
}
