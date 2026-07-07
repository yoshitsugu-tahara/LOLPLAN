"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reloadSetting } from "@/lib/store";
import { setSetting } from "@/server/actions/settings";

export default function CoachUrlField({ initial }: { initial: string | null }) {
  const [url, setUrl] = useState(initial ?? "");
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
      await setSetting("coachUrl", url);
      reloadSetting("coachUrl");
      setDone(true);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(false), 1500);
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          type="url"
          placeholder="https://claude.ai/project/..."
          className="h-9 flex-1"
        />
        <Button onClick={save} disabled={pending} className="h-9">
          {done ? "保存済み" : "保存"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        サイドバーの「コーチと話す」から、このURLを別ウィンドウで開きます。
        （claude.ai は埋め込み不可のため、専用ウィンドウで開く方式です）
      </p>
    </div>
  );
}
