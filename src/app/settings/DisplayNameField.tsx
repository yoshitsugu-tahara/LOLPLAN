"use client";

import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <Input
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
          className="h-7 w-44"
        />
        <Button size="xs" onClick={save} disabled={pending}>
          保存
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            setDraft(name);
            setEditing(false);
          }}
        >
          取消
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-2 truncate text-sm font-medium">
        {name || "（表示名なし）"}
        {isOwner && (
          <Badge className="bg-sky-500/20 text-[10px] text-sky-300">
            オーナー
          </Badge>
        )}
      </span>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="text-zinc-500 hover:text-sky-300"
      >
        編集
      </Button>
    </div>
  );
}
