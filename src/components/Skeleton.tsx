// 読み込み中のスケルトン表示（Neon取得待ちのちらつき防止）
import type { CSSProperties } from "react";

/** 汎用シマーブロック */
export function Bar({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-white/[0.07] ${className}`}
      style={style}
    />
  );
}

/** サイドバーのノート一覧スケルトン */
export function SidebarSkeleton() {
  return (
    <div className="space-y-1">
      <Bar className="mb-2 ml-2 h-3 w-12" />
      {[88, 72, 80, 64].map((w, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <Bar className="h-3.5 w-3.5 shrink-0" />
          <Bar className="h-3.5" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

/** テーブルビューのスケルトン */
export function TableSkeleton() {
  return (
    <div className="space-y-px">
      <Bar className="mb-2 h-7 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-2.5">
          <Bar className="h-4 flex-1" />
          <Bar className="h-4 w-20" />
          <Bar className="h-4 w-16" />
          <Bar className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

/** ギャラリー/グリッドのカードスケルトン */
export function CardGridSkeleton({
  count = 8,
  aspect = "h-40",
}: {
  count?: number;
  aspect?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex ${aspect} flex-col gap-2 rounded-xl border border-white/10 bg-zinc-900 p-3`}
        >
          <Bar className="h-4 w-3/4" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-2/3" />
          <div className="flex-1" />
          <Bar className="h-2.5 w-12" />
        </div>
      ))}
    </div>
  );
}

/** ノート本文エディタのスケルトン */
export function EditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-[54px] pt-16">
      <Bar className="h-10 w-2/3" />
      <div className="mt-8 space-y-3">
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-11/12" />
        <Bar className="h-4 w-4/5" />
        <Bar className="mt-6 h-4 w-3/4" />
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-5/6" />
      </div>
    </div>
  );
}
