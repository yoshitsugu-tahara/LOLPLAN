"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { db } from "@/lib/db";
import PlannerBoard from "./PlannerBoard";

export default function Planner({ planId }: { planId: string }) {
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    let plan = await db.plans.get(planId);
    if (!plan) {
      const now = Date.now();
      plan = {
        id: planId,
        title: "無題のプラン",
        snapshot: null,
        preview: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.plans.add(plan);
    }
    setTitle(plan.title);
    return plan.snapshot ?? null;
  }, [planId]);

  const onChange = useCallback(
    (snapshot: { document: unknown }) => {
      db.plans.update(planId, { snapshot, updatedAt: Date.now() });
    },
    [planId],
  );

  const updateTitle = (t: string) => {
    setTitle(t);
    db.plans.update(planId, { title: t, updatedAt: Date.now() });
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-white">
      {/* ヘッダー */}
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

      <PlannerBoard load={load} onChange={onChange} />
    </div>
  );
}
