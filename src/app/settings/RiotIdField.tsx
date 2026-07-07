"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reloadSetting } from "@/lib/store";
import { setSetting } from "@/server/actions/settings";

export default function RiotIdField({ initial }: { initial: string | null }) {
  const [riotId, setRiotId] = useState(initial ?? "");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    [],
  );

  const save = () => {
    start(async () => {
      await setSetting("riotId", riotId.trim());
      reloadSetting("riotId");
      setDone(true);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(false), 1500);
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
      <div className="flex gap-2">
        <Input
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="名前#タグ（例: Arisa#dps）"
          className="h-9 flex-1"
        />
        <Button onClick={save} disabled={pending} className="h-9">
          {done ? "保存済み" : "保存"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        試合リプレイで「自分」として扱う Riot ID。直近の試合一覧の取得と、対面とのリード差の基準に使います。
      </p>
    </div>
  );
}
