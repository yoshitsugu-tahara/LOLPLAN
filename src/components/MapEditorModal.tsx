"use client";

import "tldraw/tldraw.css";

import { useCallback, useRef } from "react";
import {
  type Editor as TLEditor,
  getSnapshot,
  loadSnapshot,
  Tldraw,
  type TLAssetStore,
} from "tldraw";

import { db } from "@/lib/db";

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 画像を IndexedDB に残すため、アセットを data URL として保存する。
 * （tldraw のデフォルトは blob URL で、リロードすると消えてしまう）
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMount = useCallback(
    (editor: TLEditor) => {
      editorRef.current = editor;
      db.maps.get(mapId).then((m) => {
        if (m?.snapshot) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          loadSnapshot(editor.store, m.snapshot as any);
        }
      });
    },
    [mapId],
  );

  const save = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const snapshot = getSnapshot(editor.store);

    let preview: string | null = null;
    const ids = Array.from(editor.getCurrentPageShapeIds());
    if (ids.length) {
      try {
        const result = await editor.toImage(ids, {
          format: "png",
          background: true,
          padding: 16,
          scale: 1,
        });
        preview = await fileToDataUrl(result.blob);
      } catch {
        // プレビュー生成失敗は無視（スナップショットは保存済み）
      }
    }

    await db.maps.update(mapId, { snapshot, preview, updatedAt: Date.now() });
  }, [mapId]);

  const handleSaveAndClose = async () => {
    await save();
    onClose();
  };

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const editor = editorRef.current;
    e.target.value = "";
    if (!file || !editor) return;
    await editor.putExternalContent({
      type: "files",
      files: [file],
      point: editor.getViewportPageBounds().center,
      ignoreParent: false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40 p-4 sm:p-8">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-700">🗺️ マップ注釈</span>
            <button
              onClick={handlePickImage}
              className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              ＋ マップ画像を追加
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              破棄して閉じる
            </button>
            <button
              onClick={handleSaveAndClose}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              保存して閉じる
            </button>
          </div>
        </div>
        <div className="relative flex-1">
          <Tldraw assets={assetStore} onMount={handleMount} />
        </div>
      </div>
    </div>
  );
}
