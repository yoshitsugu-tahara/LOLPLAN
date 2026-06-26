"use client";

import "tldraw/tldraw.css";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createShapeId,
  DefaultColorStyle,
  type Editor,
  getSnapshot,
  loadSnapshot,
  react,
  type TLDefaultColorStyle,
  Tldraw,
} from "tldraw";

import { db } from "@/lib/db";
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
  const url = MAP_IMAGE;
  if (editor.getShape(MAP_ID)) {
    editor.updateShape<TokenShape>({
      id: MAP_ID,
      type: "token",
      props: { src: url },
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
        src: url,
        color: "#000000",
        label: "",
      },
    });
  }
  editor.sendToBack([MAP_ID]);
}

export default function Planner({ planId }: { planId: string }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [version, setVersion] = useState("");
  const [activeTool, setActiveTool] = useState("select");
  const [color, setColor] = useState("white");
  const [team, setTeam] = useState<Team>("blue");
  const [title, setTitle] = useState("");

  const colorRef = useRef(color);
  colorRef.current = color;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMount = useCallback(
    (ed: Editor) => {
      setEditor(ed);
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
          db.plans.update(planId, {
            snapshot: { document },
            updatedAt: Date.now(),
          });
        }, 700);
      };

      let dispose = () => {};
      (async () => {
        const v = await getVersion();
        setVersion(v);

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

        if (plan.snapshot) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            loadSnapshot(ed.store, plan.snapshot as any);
          } catch {
            // 壊れたスナップショットは無視して空から始める
          }
        }
        ensureMap(ed);

        // マップ全体がちゃんと収まるよう明示的にフィット。
        // 初回はレイアウト確定前にビューポートサイズが確定しておらず
        // 下が見切れることがあるので、rAF と遅延でも再フィットする。
        const fitMap = () => {
          try {
            ed.zoomToBounds(
              { x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE },
              { inset: 8 },
            );
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

      // cleanup（onMount のクロージャを useEffect 側で破棄するため ref に保持）
      cleanupRef.current = () => {
        stopReact();
        dispose();
      };
    },
    [planId],
  );

  const cleanupRef = useRef<() => void>(() => {});
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      cleanupRef.current();
    };
  }, []);

  const updateTitle = (t: string) => {
    setTitle(t);
    db.plans.update(planId, { title: t, updatedAt: Date.now() });
  };

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
      // 自分のMIMEのときだけ preventDefault してドロップを許可する
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

      <div className="flex min-h-0 flex-1">
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
    </div>
  );
}
