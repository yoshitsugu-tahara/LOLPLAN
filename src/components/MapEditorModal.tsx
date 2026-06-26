"use client";

import { useCallback, useRef } from "react";
import { type Editor as TLEditor, type TLAssetStore } from "tldraw";

import { db } from "@/lib/db";
import PlannerBoard from "./planner/PlannerBoard";

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 過去にアップロードした画像（data URL アセット）を解決するためのストア。
 * 新しい SR プランナー方式では画像アップロードはしないが、旧データの表示用に残す。
 */
const assetStore: TLAssetStore = {
  async upload(_asset, file) {
    const src = await fileToDataUrl(file);
    return { src };
  },
  resolve(asset) {
    return (asset.props.src as string) ?? null;
  },
};

export default function MapEditorModal({
  mapId,
  onClose,
}: {
  mapId: string;
  onClose: () => void;
}) {
  const editorRef = useRef<TLEditor | null>(null);

  const load = useCallback(async () => {
    const m = await db.maps.get(mapId);
    return m?.snapshot ?? null;
  }, [mapId]);

  const onChange = useCallback(
    (snapshot: { document: unknown }) => {
      db.maps.update(mapId, { snapshot, updatedAt: Date.now() });
    },
    [mapId],
  );

  // 閉じる時にノート内サムネ用のプレビューを生成（チャンピオン等のリモート画像が
  // 含まれると toImage が失敗することがあるが、その場合は黙って諦める）
  const handleClose = async () => {
    const editor = editorRef.current;
    if (editor) {
      try {
        const ids = Array.from(editor.getCurrentPageShapeIds());
        if (ids.length) {
          const result = await editor.toImage(ids, {
            format: "png",
            background: true,
            padding: 16,
            scale: 0.5,
          });
          const preview = await fileToDataUrl(result.blob);
          await db.maps.update(mapId, { preview, updatedAt: Date.now() });
        }
      } catch {
        // プレビュー生成失敗は無視（スナップショットは自動保存済み）
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
        <PlannerBoard
          load={load}
          onChange={onChange}
          onEditor={(e) => (editorRef.current = e)}
          assets={assetStore}
        />
      </div>
    </div>
  );
}
