"use client";

import "tldraw/tldraw.css";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createShapeId,
  DefaultColorStyle,
  type Editor,
  getSnapshot,
  loadSnapshot,
  react,
  type TLAssetStore,
  type TLDefaultColorStyle,
  Tldraw,
} from "tldraw";

import { championIcon, getVersion } from "@/lib/ddragon";
import {
  ALL_TOKENS,
  DND_MIME,
  type DndPayload,
  MAP_IMAGE,
  MAP_SIZE,
  type PaletteToken,
  type Team,
  TEAM_COLORS,
} from "./data";
import Palette from "./Palette";
import { type TokenShape, TokenShapeUtil } from "./TokenShape";
import Toolbar from "./Toolbar";

const shapeUtils = [TokenShapeUtil];
const MAP_ID = createShapeId("srmap");

const cameraOptions = {
  isLocked: false,
  panSpeed: 1,
  zoomSpeed: 1,
  zoomSteps: [1, 1.5, 2, 3],
  wheelBehavior: "zoom" as const,
  constraints: {
    bounds: { x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE },
    padding: { x: 32, y: 32 },
    origin: { x: 0.5, y: 0.5 },
    initialZoom: "fit-max" as const,
    baseZoom: "fit-max" as const,
    behavior: "contain" as const,
  },
};

/** 背景マップを1枚だけ・ロック状態・最背面に用意する */
function ensureMap(editor: Editor) {
  if (editor.getShape(MAP_ID)) {
    editor.updateShape<TokenShape>({
      id: MAP_ID,
      type: "token",
      props: { src: MAP_IMAGE },
    });
  } else {
    editor.createShape<TokenShape>({
      id: MAP_ID,
      type: "token",
      x: 0,
      y: 0,
      isLocked: true,
      props: {
        w: MAP_SIZE,
        h: MAP_SIZE,
        kind: "map",
        src: MAP_IMAGE,
        color: "#000000",
        label: "",
      },
    });
  }
  editor.sendToBack([MAP_ID]);
}

/**
 * SRプランナーの盤面（マップ背景＋パレット＋ツールバー＋配置/描画）。
 * 保存先は props で差し替えるので、プランナーページとノートの両方で使える。
 */
export default function PlannerBoard({
  load,
  onChange,
  onEditor,
  assets,
}: {
  /** 保存済みスナップショットを返す（無ければ null）。マウント後に1回呼ばれる */
  load: () => Promise<unknown | null>;
  /** 編集のたびにデバウンスして呼ばれる。スナップショットを永続化する */
  onChange: (snapshot: { document: unknown }) => void;
  /** tldraw の Editor を親へ渡す（プレビュー生成などに使う） */
  onEditor?: (editor: Editor) => void;
  /** アップロード画像の data URL を解決するためのアセットストア（任意） */
  assets?: TLAssetStore;
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [version, setVersion] = useState("");
  const [activeTool, setActiveTool] = useState("select");
  const [color, setColor] = useState("white");
  const [team, setTeam] = useState<Team>("blue");

  const colorRef = useRef(color);
  colorRef.current = color;
  const loadRef = useRef(load);
  loadRef.current = load;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onEditorRef = useRef(onEditor);
  onEditorRef.current = onEditor;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed);
    onEditorRef.current?.(ed);
    ed.user.updateUserPreferences({ colorScheme: "dark" });
    ed.setStyleForNextShapes(
      DefaultColorStyle,
      colorRef.current as TLDefaultColorStyle,
    );

    const stopReact = react("tool-sync", () => {
      setActiveTool(ed.getCurrentToolId());
    });

    const scheduleSave = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const { document } = getSnapshot(ed.store);
        onChangeRef.current({ document });
      }, 700);
    };

    let dispose = () => {};
    (async () => {
      const v = await getVersion();
      setVersion(v);

      const snapshot = await loadRef.current();
      if (snapshot) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          loadSnapshot(ed.store, snapshot as any);
        } catch {
          // 壊れたスナップショットは無視して空から始める
        }
      }
      ensureMap(ed);

      // マップ全体が収まるよう明示フィット（初回レイアウト確定前のズレ対策）
      const fitMap = () => {
        try {
          ed.zoomToBounds({ x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE }, { inset: 8 });
        } catch {
          // アンマウント後などは無視
        }
      };
      fitMap();
      requestAnimationFrame(fitMap);
      setTimeout(fitMap, 200);

      dispose = ed.store.listen(scheduleSave, {
        scope: "document",
        source: "user",
      });
    })();

    cleanupRef.current = () => {
      stopReact();
      dispose();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      cleanupRef.current();
    };
  }, []);

  const placeChampion = useCallback(
    (c: { id: string; name: string }, at?: { x: number; y: number }) => {
      if (!editor || !version) return;
      const p = at ?? editor.getViewportPageBounds().center;
      const id = createShapeId();
      editor.createShape<TokenShape>({
        id,
        type: "token",
        x: p.x - 22,
        y: p.y - 22,
        props: {
          w: 44,
          h: 44,
          kind: "champion",
          src: championIcon(version, c.id),
          color: TEAM_COLORS[team],
          label: c.name,
        },
      });
      editor.select(id);
      editor.setCurrentTool("select");
    },
    [editor, version, team],
  );

  const placeToken = useCallback(
    (t: PaletteToken, at?: { x: number; y: number }) => {
      if (!editor) return;
      const size = t.size ?? 36;
      const p = at ?? editor.getViewportPageBounds().center;
      const id = createShapeId();
      editor.createShape<TokenShape>({
        id,
        type: "token",
        x: p.x - size / 2,
        y: p.y - size / 2,
        props: {
          w: size,
          h: size,
          kind: t.id.startsWith("obj") ? "objective" : "ward",
          src: t.icon,
          color: t.color,
          label: "",
        },
      });
      editor.select(id);
      editor.setCurrentTool("select");
    },
    [editor],
  );

  // パレットからのドラッグ&ドロップで、落とした位置にトークンを配置する。
  // tldraw 自身もドロップを処理する（=画像URLならブックマーク化）ため、
  // キャプチャ段階のネイティブリスナーで tldraw より先に横取りする。
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el || !editor) return;

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(DND_MIME)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onDrop = (e: DragEvent) => {
      const raw = e.dataTransfer?.getData(DND_MIME);
      if (!raw) return; // 自分のドラッグ以外は tldraw に任せる
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      let payload: DndPayload;
      try {
        payload = JSON.parse(raw) as DndPayload;
      } catch {
        return;
      }
      const at = editor.screenToPage({ x: e.clientX, y: e.clientY });
      if (payload.kind === "champion") {
        placeChampion({ id: payload.id, name: payload.name }, at);
      } else {
        const t = ALL_TOKENS[payload.id];
        if (t) placeToken(t, at);
      }
    };

    el.addEventListener("dragover", onDragOver, true);
    el.addEventListener("drop", onDrop, true);
    return () => {
      el.removeEventListener("dragover", onDragOver, true);
      el.removeEventListener("drop", onDrop, true);
    };
  }, [editor, placeChampion, placeToken]);

  return (
    <div className="flex min-h-0 flex-1 bg-zinc-950 text-white">
      <Palette
        version={version}
        team={team}
        setTeam={setTeam}
        onPlaceChampion={placeChampion}
        onPlaceToken={placeToken}
      />

      {/* キャンバス */}
      <div ref={canvasWrapRef} className="relative min-w-0 flex-1">
        <Tldraw
          shapeUtils={shapeUtils}
          cameraOptions={cameraOptions}
          assets={assets}
          hideUi
          onMount={handleMount}
        />
        {/* 自作ツールバー（キャンバス上にフロート） */}
        {editor && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
            <Toolbar
              editor={editor}
              activeTool={activeTool}
              color={color}
              setColor={setColor}
            />
          </div>
        )}
      </div>
    </div>
  );
}
