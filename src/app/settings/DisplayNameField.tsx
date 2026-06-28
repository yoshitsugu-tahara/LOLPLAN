"use client";

import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";

import { updateDisplayName } from "@/server/actions/profile";

export default function DisplayNameField({
  initial,
  isOwner,
}: {
  initial: string | null | undefined;
  isOwner: boolean;
}) {
  const { update } = useSession();
  const [name, setName] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, start] = useTransition();

  const save = () => {
    start(async () => {
      const saved = await updateDisplayName(draft);
      setName(saved);
      // セッション(JWT)にも反映 → サイドバー等の表示も即更新
      await update({ name: saved });
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          maxLength={80}
          placeholder="表示名"
          className="w-44 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-sky-400"
        />
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-sky-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-400 disabled:opacity-50"
        >
          保存
        </button>
        <button
          onClick={() => {
            setDraft(name);
            setEditing(false);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="truncate text-sm font-medium">
        {name || "（表示名なし）"}
        {isOwner && (
          <span className="ml-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300">
            オーナー
          </span>
        )}
      </span>
      <button
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="text-xs text-zinc-500 transition hover:text-sky-300"
      >
        編集
      </button>
    </div>
  );
}
