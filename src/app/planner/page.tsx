"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { usePlans, reloadPlans } from "@/lib/store";
import {
  createPlan as createPlanAction,
  deletePlan as deletePlanAction,
} from "@/server/actions/plans";
import { CardGridSkeleton } from "@/components/Skeleton";

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PlannerGallery() {
  const router = useRouter();
  const { data: plans } = usePlans();
  const confirm = useConfirm();

  const createPlan = async () => {
    const id = await createPlanAction();
    router.push(`/planner/${id}`);
  };

  const deletePlan = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: "このプランを削除しますか？",
      actionLabel: "削除",
      destructive: true,
    });
    if (!ok) return;
    await deletePlanAction(id);
    reloadPlans();
  };

  return (
    <div className="min-h-full bg-zinc-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-zinc-400 transition hover:text-white"
          >
            ← lolnote
          </Link>
          <h1 className="text-xl font-bold">
            <span className="text-sky-400">SR</span> プランナー
          </h1>
        </div>
        <Button onClick={createPlan} className="font-bold">
          <Plus /> 新しいプラン
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {plans === undefined && <CardGridSkeleton count={8} aspect="aspect-video" />}

        {plans?.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-zinc-500">まだプランがありません</p>
            <Button onClick={createPlan} size="lg" className="font-bold">
              <Plus /> 最初のプランを作る
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {plans?.map((p) => (
            <Link
              key={p.id}
              href={`/planner/${p.id}`}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900 transition hover:border-sky-500/60 hover:bg-zinc-800"
            >
              <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-3xl">
                🗺️
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-semibold">
                  {p.title || "無題のプラン"}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {formatDate(p.updatedAt)}
                </div>
              </div>
              <button
                onClick={(e) => deletePlan(e, p.id)}
                title="削除"
                className="absolute right-2 top-2 flex items-center justify-center rounded-md bg-black/60 p-1.5 text-zinc-300 opacity-0 transition hover:bg-red-500 hover:text-white group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
