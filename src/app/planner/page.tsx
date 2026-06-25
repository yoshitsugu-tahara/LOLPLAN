"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { db } from "@/lib/db";

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PlannerGallery() {
  const router = useRouter();
  const plans = useLiveQuery(
    () => db.plans.orderBy("updatedAt").reverse().toArray(),
    [],
  );

  const createPlan = async () => {
    const id = nanoid();
    const now = Date.now();
    await db.plans.add({
      id,
      title: "無題のプラン",
      snapshot: null,
      preview: null,
      createdAt: now,
      updatedAt: now,
    });
    router.push(`/planner/${id}`);
  };

  const deletePlan = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("このプランを削除しますか？")) return;
    await db.plans.delete(id);
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
        <button
          onClick={createPlan}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-400"
        >
          ＋ 新しいプラン
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {plans?.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-zinc-500">まだプランがありません</p>
            <button
              onClick={createPlan}
              className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-400"
            >
              ＋ 最初のプランを作る
            </button>
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
                className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-zinc-300 opacity-0 transition hover:bg-red-500 hover:text-white group-hover:opacity-100"
              >
                ✕
              </button>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
