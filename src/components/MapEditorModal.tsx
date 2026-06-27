"use client";

import type Konva from "konva";
import { useCallback, useRef } from "react";

import { db } from "@/lib/db";
import { MAP_SIZE } from "./planner/data";
import KonvaBoard from "./planner/KonvaBoard";
import type { Shape } from "./planner/shapes";

export default function MapEditorModal({
  mapId,
  onClose,
}: {
  mapId: string;
  onClose: () => void;
}) {
  const stageRef = useRef<Konva.Stage | null>(null);

  const load = useCallback(async () => {
    const m = await db.maps.get(mapId);
    return (m?.snapshot as Shape[] | null) ?? null;
  }, [mapId]);

  const onChange = useCallback(
    (shapes: Shape[]) => {
      db.maps.update(mapId, { snapshot: shapes, updatedAt: Date.now() });
    },
    [mapId],
  );

  // 閉じる時にノート内サムネ用プレビューを生成。
  // 現在のズームに依らずマップ全体を、高解像度で切り出す（best-effort）。
  const handleClose = async () => {
    const stage = stageRef.current;
    if (stage) {
      try {
        const THUMB = 720;
        const scale = THUMB / MAP_SIZE;
        const prevScale = stage.scaleX();
        const prevPos = stage.position();
        stage.scale({ x: scale, y: scale });
        stage.position({ x: 0, y: 0 });
        stage.draw();
        const preview = stage.toDataURL({
          x: 0,
          y: 0,
          width: THUMB,
          height: THUMB,
          pixelRatio: 1.5,
          mimeType: "image/jpeg",
          quality: 0.85,
        });
        stage.scale({ x: prevScale, y: prevScale });
        stage.position(prevPos);
        stage.draw();
        await db.maps.update(mapId, { preview, updatedAt: Date.now() });
      } catch {
        // 失敗は無視（スナップショットは自動保存済み）
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4 sm:p-8">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="font-medium text-zinc-200">🗺️ マップ注釈</span>
          <button
            onClick={handleClose}
            className="rounded bg-sky-500 px-3 py-1 text-sm font-medium text-white hover:bg-sky-400"
          >
            閉じる
          </button>
        </div>
        <KonvaBoard
          load={load}
          onChange={onChange}
          onStage={(s) => (stageRef.current = s)}
        />
      </div>
    </div>
  );
}
