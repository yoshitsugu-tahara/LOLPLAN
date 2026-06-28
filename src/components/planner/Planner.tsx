"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { getOrCreatePlan, updatePlan } from "@/server/actions/plans";
import KonvaBoard from "./KonvaBoard";
import type { Shape } from "./shapes";

export default function Planner({ planId }: { planId: string }) {
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    const plan = await getOrCreatePlan(planId);
    setTitle(plan.title);
    return (plan.snapshot as Shape[] | null) ?? null;
  }, [planId]);

  const onChange = useCallback(
    (shapes: Shape[]) => {
      updatePlan(planId, { snapshot: shapes });
    },
    [planId],
  );

  const updateTitle = (t: string) => {
    setTitle(t);
    updatePlan(planId, { title: t });
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-white">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-3">
        <Link
          href="/planner"
          className="rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          ← 一覧
        </Link>
        <input
          value={title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="プラン名"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
        />
        <span className="text-xs text-zinc-600">自動保存</span>
      </header>

      <KonvaBoard load={load} onChange={onChange} />
    </div>
  );
}
