"use client";

import { useSession } from "next-auth/react";
import {
  ArrowUpRight,
  FileText,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Table2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  patchNotes,
  reloadNotes,
  reloadSections,
  useNotes,
  useSections,
  useSetting,
} from "@/lib/store";
import type { Note } from "@/lib/types";
import { moveNote as moveNoteAction } from "@/server/actions/notes";
import {
  createSection as createSectionAction,
  deleteSection as deleteSectionAction,
  renameSection,
} from "@/server/actions/sections";
import { useConfirm } from "./ConfirmDialog";
import { labelColor } from "./LabelEditor";
import { SidebarSkeleton } from "./Skeleton";
import TemplateModal from "./TemplateModal";

const NOTE_MIME = "application/x-lolnote-note";

type DropTarget = { id: string; pos: "before" | "after" | "into" } | null;

function byOrder(a: Note, b: Note) {
  const ao = a.order ?? 0;
  const bo = b.order ?? 0;
  if (ao !== bo) return ao - bo;
  return b.updatedAt - a.updatedAt;
}

/** サーバの moveNote と同じ並べ替えをクライアント側で適用（楽観的更新用） */
function applyMove(
  all: Note[],
  draggedId: string,
  toSectionId: string | null,
  toIndex: number,
): Note[] {
  const dragged = all.find((n) => n.id === draggedId);
  if (!dragged) return all;
  const fromSectionId = dragged.sectionId ?? null;
  const target = all
    .filter((n) => (n.sectionId ?? null) === toSectionId && n.id !== draggedId)
    .sort(byOrder);
  const idx = Math.max(0, Math.min(toIndex, target.length));
  target.splice(idx, 0, dragged);

  const orderMap = new Map<string, number>();
  target.forEach((n, i) => orderMap.set(n.id, i));
  if (fromSectionId !== toSectionId) {
    const old = all
      .filter(
        (n) => (n.sectionId ?? null) === fromSectionId && n.id !== draggedId,
      )
      .sort(byOrder);
    old.forEach((n, i) => orderMap.set(n.id, i));
  }
  return all.map((n) => {
    const order = orderMap.has(n.id) ? orderMap.get(n.id)! : n.order;
    const sectionId = n.id === draggedId ? toSectionId : n.sectionId;
    return order !== n.order || sectionId !== n.sectionId
      ? { ...n, order, sectionId }
      : n;
  });
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
  onCreateNote: (sectionId?: string | null) => void;
  onDeleteNote: (id: string) => void;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onOpenDatabase: () => void;
  databaseActive?: boolean;
}) {
  const { data: notes } = useNotes();
  const { data: sections } = useSections();
  const { data: session } = useSession();
  const { data: coachUrl } = useSetting("coachUrl");
  const confirm = useConfirm();
  const user = session?.user;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [templateSec, setTemplateSec] = useState<{
    id: string;
    name: string;
    template: string;
  } | null>(null);
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

  const loading = !notes || !sections;

  // 使われている全ラベル（絞り込みチップ用）
  const allLabels = [
    ...new Set((notes ?? []).flatMap((n) => n.labels ?? [])),
  ].sort((a, b) => a.localeCompare(b, "ja"));
  // 選択中ラベルをすべて含むか（AND）。未選択時は全件通過
  const matches = (n: Note) =>
    filter.every((l) => (n.labels ?? []).includes(l));
  const toggleFilter = (l: string) =>
    setFilter((f) => (f.includes(l) ? f.filter((x) => x !== l) : [...f, l]));

  const uncategorized = (notes ?? [])
    .filter((n) => !n.sectionId && matches(n))
    .sort(byOrder);
  const notesOf = (sid: string) =>
    (notes ?? []).filter((n) => n.sectionId === sid && matches(n)).sort(byOrder);

  // --- セクション操作 ---
  const createSection = async () => {
    const id = await createSectionAction();
    await reloadSections();
    setRenaming(id);
  };
  const deleteSection = async (id: string) => {
    const ok = await confirm({
      title: "このセクションを削除しますか？",
      description: "中のノートは未分類に戻ります。",
      actionLabel: "削除",
      destructive: true,
    });
    if (!ok) return;
    await deleteSectionAction(id);
    await Promise.all([reloadSections(), reloadNotes()]);
  };

  // --- DnD：ノートを toSectionId の toIndex に移動 ---
  const moveNote = async (
    draggedId: string,
    toSectionId: string | null,
    toIndex: number,
  ) => {
    // 先に並べ替えを反映（楽観的）→ 裏でサーバ更新。再フェッチはしない。
    patchNotes((cur) => applyMove(cur, draggedId, toSectionId, toIndex));
    await moveNoteAction(draggedId, toSectionId, toIndex);
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
      <ContextMenu key={n.id}>
        <ContextMenuTrigger
          render={
            <div
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
              className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition ${indicator} ${
                n.id === selectedId
                  ? "bg-white/10 text-white"
                  : "text-zinc-300 hover:bg-white/5"
              }`}
            />
          }
        >
          <FileText className="size-[15px] shrink-0 text-zinc-500" />
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
            <X className="size-3.5" />
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDeleteNote(n.id)}
          >
            <X /> 削除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-900" />
        }
      >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-base font-bold tracking-tight text-white">
          lolnote
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onCreateNote()}
            title="新規ノート"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <Plus className="size-[18px]" />
          </button>
          <button
            onClick={onToggleSidebar}
            title="サイドバーを隠す"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <PanelLeftClose className="size-[17px]" />
          </button>
        </div>
      </div>

      <button
        onClick={onOpenSearch}
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
      >
        <Search className="size-[15px] shrink-0" />
        <span className="flex-1 text-left">ノート検索</span>
        <kbd className="rounded bg-white/10 px-1 text-[10px] text-zinc-500">
          Ctrl ⇧ F
        </kbd>
      </button>

      <button
        onClick={onOpenDatabase}
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
      >
        <Table2 className="size-[15px] shrink-0" />
        <span>すべてのノート</span>
      </button>

      <Link
        href="/train"
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
      >
        🎯 <span>練習ループ</span>
      </Link>

      <Link
        href="/planner"
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
      >
        🗺️ <span>SRプランナー</span>
      </Link>

      <button
        onClick={() => {
          if (coachUrl)
            window.open(coachUrl, "lolnote-coach", "width=480,height=860");
          else window.location.href = "/settings";
        }}
        title={coachUrl ? "別ウィンドウでコーチを開く" : "設定でURLを登録"}
        className="mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
      >
        🧠 <span className="flex-1 text-left">コーチと話す</span>
        <ArrowUpRight className="size-[13px] shrink-0 text-zinc-600" />
      </button>

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

      {/* ノート＋セクション。余白の右クリックでセクション作成 */}
      <div
        className="no-scrollbar mt-2 flex-1 overflow-y-auto px-2 pb-4"
        onDragOver={(e) =>
          e.dataTransfer.types.includes(NOTE_MIME) && e.preventDefault()
        }
        onDrop={(e) => dropInto(e, null)}
      >
        {loading && <SidebarSkeleton />}

          {/* 未分類 */}
          {!loading && (
            <div className="group/sec mb-1 flex items-center gap-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
              <span className="flex-1">ノート</span>
              <button
                onClick={() => onCreateNote(null)}
                title="ノートをここに追加"
                className="flex h-4 w-4 items-center justify-center rounded text-zinc-500 opacity-0 transition hover:bg-white/10 hover:text-white group-hover/sec:opacity-100"
              >
                <Plus className="size-3" />
              </button>
            </div>
          )}
          {uncategorized.map(renderNote)}

          {/* セクション（絞り込み中は該当ノートが無いセクションは隠す） */}
          {(sections ?? []).map((sec) => {
            const secNotes = notesOf(sec.id);
            if (filter.length && secNotes.length === 0) return null;
            return (
              <div key={sec.id} className="mt-3">
                <ContextMenu>
                  <ContextMenuTrigger
                    render={
                      <div
                        onDragOver={(e) => {
                          if (!e.dataTransfer.types.includes(NOTE_MIME)) return;
                          e.preventDefault();
                          setDropTarget({ id: `sec-${sec.id}`, pos: "into" });
                        }}
                        onDrop={(e) => dropInto(e, sec.id)}
                        className={`group/sec mb-1 flex items-center gap-1 rounded px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 ${
                          dropTarget?.id === `sec-${sec.id}`
                            ? "bg-sky-500/20"
                            : ""
                        }`}
                      />
                    }
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
                      <>
                        <span
                          className="flex-1 cursor-default py-1"
                          onDoubleClick={() => setRenaming(sec.id)}
                        >
                          {sec.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateNote(sec.id);
                          }}
                          title="ノートをここに追加"
                          className="flex h-4 w-4 items-center justify-center rounded text-zinc-500 opacity-0 transition hover:bg-white/10 hover:text-white group-hover/sec:opacity-100"
                        >
                          <Plus className="size-3" />
                        </button>
                      </>
                    )}
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => setRenaming(sec.id)}>
                      名前を変更
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() =>
                        setTemplateSec({
                          id: sec.id,
                          name: sec.name,
                          template: sec.titleTemplate ?? "",
                        })
                      }
                    >
                      タイトルテンプレート
                    </ContextMenuItem>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => deleteSection(sec.id)}
                    >
                      セクションを削除
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                {secNotes.map(renderNote)}
              </div>
            );
          })}
      </div>

      {/* 最下部のアカウント（クリックで設定へ） */}
      <Link
        href="/settings"
        className="mt-auto flex items-center gap-2.5 border-t border-white/10 px-3 py-2.5 transition hover:bg-white/5"
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="h-7 w-7 shrink-0 rounded-full"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-300">
            {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-200">
            {user?.name ?? "アカウント"}
          </div>
          <div className="truncate text-[11px] text-zinc-500">
            {user?.email ?? ""}
          </div>
        </div>
        <Settings className="size-[15px] shrink-0 text-zinc-500" />
      </Link>

      {templateSec && (
        <TemplateModal
          sectionId={templateSec.id}
          sectionName={templateSec.name}
          initial={templateSec.template}
          onClose={() => setTemplateSec(null)}
        />
      )}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={createSection}>
          <Plus /> セクションを作成
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
