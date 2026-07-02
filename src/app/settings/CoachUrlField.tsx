"use client";

import { useEffect, useRef, useState, useTransition } from "react";

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
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          type="url"
          placeholder="https://claude.ai/project/..."
          className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400"
        />
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-50"
        >
          {done ? "保存済み" : "保存"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        サイドバーの「コーチと話す」から、このURLを別ウィンドウで開きます。
        （claude.ai は埋め込み不可のため、専用ウィンドウで開く方式です）
      </p>
    </div>
  );
}
