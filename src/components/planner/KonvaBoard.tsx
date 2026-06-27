"use client";

import type Konva from "konva";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Arrow,
  Circle,
  Group,
  Image as KImage,
  Layer,
  Line,
  Stage,
  Text,
  Transformer,
} from "react-konva";

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
import { isImageSrc, newId, type Shape, type TokenShape, type Tool } from "./shapes";
import Toolbar from "./Toolbar";
import { useImage } from "./useImage";

const MAP = MAP_SIZE;

function clampPos(
  pos: { x: number; y: number },
  scale: number,
  w: number,
  h: number,
) {
  const mapW = MAP * scale;
  const mapH = MAP * scale;
  const x = mapW <= w ? (w - mapW) / 2 : Math.min(0, Math.max(w - mapW, pos.x));
  const y = mapH <= h ? (h - mapH) / 2 : Math.min(0, Math.max(h - mapH, pos.y));
  return { x, y };
}

/** 1つのトークンを描画 */
function TokenNode({
  shape,
  tool,
  onSelect,
  onChange,
  onErase,
}: {
  shape: TokenShape;
  tool: Tool;
  onSelect: (id: string) => void;
  onChange: (s: TokenShape) => void;
  onErase: (id: string) => void;
}) {
  const isImg = isImageSrc(shape.src);
  const img = useImage(isImg ? shape.src : undefined);
  const r = shape.size / 2;
  const iw = shape.size * (shape.fit === "cover" ? 1 : 0.78);

  const handleClick = () => {
    if (tool === "eraser") onErase(shape.id);
    else onSelect(shape.id);
  };

  return (
    <Group
      id={shape.id}
      name="token"
      x={shape.x}
      y={shape.y}
      draggable={tool === "select"}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={(e) =>
        onChange({ ...shape, x: e.target.x(), y: e.target.y() })
      }
      onTransformEnd={(e) => {
        const node = e.target;
        const s = node.scaleX();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          ...shape,
          x: node.x(),
          y: node.y(),
          size: Math.max(16, shape.size * s),
        });
      }}
    >
      <Circle radius={r} fill={isImg ? "#0b0e14" : `${shape.color}33`} />
      {isImg && img && (
        <Group
          clipFunc={(ctx) => {
            ctx.arc(0, 0, r, 0, Math.PI * 2, false);
          }}
        >
          <KImage image={img} x={-iw / 2} y={-iw / 2} width={iw} height={iw} />
        </Group>
      )}
      {!isImg && (
        <Text
          text={shape.src}
          fontSize={r * 1.1}
          fontStyle="bold"
          fill="#fff"
          width={shape.size}
          height={shape.size}
          x={-r}
          y={-r}
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      )}
      <Circle radius={r} stroke={shape.color} strokeWidth={2.5} />
      {shape.label && (
        <Text
          text={shape.label}
          fontSize={12}
          fontStyle="bold"
          fill="#fff"
          shadowColor="#000"
          shadowBlur={3}
          width={120}
          x={-60}
          y={r + 3}
          align="center"
          listening={false}
        />
      )}
    </Group>
  );
}

export default function KonvaBoard({
  load,
  onChange,
  onStage,
}: {
  load: () => Promise<Shape[] | null>;
  onChange: (shapes: Shape[]) => void;
  onStage?: (stage: Konva.Stage) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#f4f4f5");
  const [team, setTeam] = useState<Team>("blue");
  const [version, setVersion] = useState("");

  const mapImg = useImage(MAP_IMAGE);
  const shapesRef = useRef<Shape[]>([]);
  shapesRef.current = shapes;
  const pastRef = useRef<Shape[][]>([]);
  const futureRef = useRef<Shape[][]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Shape | null>(null);
  const drawing = useRef(false);
  const fitted = useRef(false);

  const scheduleSave = useCallback(
    (next: Shape[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onChange(next), 600);
    },
    [onChange],
  );

  // 確定的な変更（履歴に積む）。updater内で副作用を起こさないよう ref から計算する
  const commit = useCallback(
    (producer: (curr: Shape[]) => Shape[]) => {
      const curr = shapesRef.current;
      const next = producer(curr);
      pastRef.current.push(curr);
      if (pastRef.current.length > 100) pastRef.current.shift();
      futureRef.current = [];
      shapesRef.current = next;
      setShapes(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (prev === undefined) return;
    futureRef.current.push(shapesRef.current);
    shapesRef.current = prev;
    setShapes(prev);
    scheduleSave(prev);
    setSelectedId(null);
  }, [scheduleSave]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (next === undefined) return;
    pastRef.current.push(shapesRef.current);
    shapesRef.current = next;
    setShapes(next);
    scheduleSave(next);
  }, [scheduleSave]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit((curr) => curr.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, commit]);

  // 読み込み
  useEffect(() => {
    let active = true;
    (async () => {
      const v = await getVersion();
      if (active) setVersion(v);
      const loaded = await load();
      if (active && Array.isArray(loaded)) setShapes(loaded);
    })();
    return () => {
      active = false;
    };
    // load は親で useCallback 済み
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // コンテナサイズ追従
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const minScale = useMemo(() => {
    if (!size.w || !size.h) return 0.1;
    return Math.min(size.w / MAP, size.h / MAP);
  }, [size]);

  // 初回フィット
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !size.w || fitted.current || minScale <= 0) return;
    stage.scale({ x: minScale, y: minScale });
    stage.position({
      x: (size.w - MAP * minScale) / 2,
      y: (size.h - MAP * minScale) / 2,
    });
    fitted.current = true;
    onStage?.(stage);
  }, [size, minScale, onStage]);

  // 選択時に Transformer をアタッチ（トークンのみリサイズ可）
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const sel = shapes.find((s) => s.id === selectedId);
    if (selectedId && sel?.type === "token") {
      const node = stage.findOne(`#${selectedId}`);
      tr.nodes(node ? [node] : []);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, shapes]);

  // 画面→ページ座標
  const toPage = (stage: Konva.Stage) => {
    const p = stage.getRelativePointerPosition();
    return p ?? { x: 0, y: 0 };
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const dir = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.max(minScale, Math.min(minScale * 5, oldScale * dir));
    stage.scale({ x: newScale, y: newScale });
    const pos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(clampPos(pos, newScale, size.w, size.h));
    stage.batchDraw();
  };

  // --- 描画ツールのポインタ操作 ---
  const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    if (tool === "select") {
      // 空白クリックで選択解除
      if (e.target === stage) setSelectedId(null);
      return;
    }
    if (tool === "eraser") return; // 消しゴムは shape クリックで処理
    const p = toPage(stage);
    if (tool === "text") {
      const text = window.prompt("テキスト");
      if (text)
        commit((curr) => [
          ...curr,
          { id: newId(), type: "text", x: p.x, y: p.y, text, color, fontSize: 22 },
        ]);
      return;
    }
    drawing.current = true;
    const d: Shape =
      tool === "pen"
        ? { id: newId(), type: "pen", points: [p.x, p.y], color, width: 4 }
        : {
            id: newId(),
            type: tool,
            points: [p.x, p.y, p.x, p.y],
            color,
            width: 4,
          };
    draftRef.current = d;
    setDraft(d);
  };

  const onPointerMove = () => {
    if (!drawing.current) return;
    const stage = stageRef.current;
    const d = draftRef.current;
    if (!stage || !d || (d.type !== "pen" && d.type !== "line" && d.type !== "arrow"))
      return;
    const p = toPage(stage);
    const next: Shape =
      d.type === "pen"
        ? { ...d, points: [...d.points, p.x, p.y] }
        : { ...d, points: [d.points[0], d.points[1], p.x, p.y] };
    draftRef.current = next;
    setDraft(next);
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const d = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (d && (d.type !== "pen" || d.points.length >= 4)) {
      commit((curr) => [...curr, d]);
    }
  };

  // --- 配置 ---
  const placeChampion = useCallback(
    (c: { id: string; name: string }, at?: { x: number; y: number }) => {
      if (!version) return;
      const stage = stageRef.current;
      const p =
        at ??
        (stage
          ? { x: -stage.x() / stage.scaleX() + size.w / 2 / stage.scaleX(), y: -stage.y() / stage.scaleY() + size.h / 2 / stage.scaleY() }
          : { x: MAP / 2, y: MAP / 2 });
      commit((curr) => [
        ...curr,
        {
          id: newId(),
          type: "token",
          x: p.x,
          y: p.y,
          size: 44,
          src: championIcon(version, c.id),
          color: TEAM_COLORS[team],
          label: c.name,
          fit: "cover",
        },
      ]);
    },
    [version, team, size, commit],
  );

  const placeToken = useCallback(
    (t: PaletteToken, at?: { x: number; y: number }) => {
      const stage = stageRef.current;
      const p =
        at ??
        (stage
          ? { x: -stage.x() / stage.scaleX() + size.w / 2 / stage.scaleX(), y: -stage.y() / stage.scaleY() + size.h / 2 / stage.scaleY() }
          : { x: MAP / 2, y: MAP / 2 });
      const kind = t.id.startsWith("minion") || t.id.startsWith("obj");
      commit((curr) => [
        ...curr,
        {
          id: newId(),
          type: "token",
          x: p.x,
          y: p.y,
          size: t.size ?? 36,
          src: t.icon,
          color: t.color,
          label: "",
          fit: t.id.startsWith("minion") ? "cover" : kind ? "contain" : "contain",
        },
      ]);
    },
    [size, commit],
  );

  // DnD（パレット → キャンバス）
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData(DND_MIME);
      const stage = stageRef.current;
      if (!raw || !stage) return;
      const rect = stage.container().getBoundingClientRect();
      const at = {
        x: (e.clientX - rect.left - stage.x()) / stage.scaleX(),
        y: (e.clientY - rect.top - stage.y()) / stage.scaleY(),
      };
      let payload: DndPayload;
      try {
        payload = JSON.parse(raw) as DndPayload;
      } catch {
        return;
      }
      if (payload.kind === "champion")
        placeChampion({ id: payload.id, name: payload.name }, at);
      else {
        const t = ALL_TOKENS[payload.id];
        if (t) placeToken(t, at);
      }
    },
    [placeChampion, placeToken],
  );

  // キーボード削除
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const t = document.activeElement?.tagName;
        if (t === "INPUT" || t === "TEXTAREA") return;
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteSelected]);

  const updateShape = useCallback(
    (s: Shape) => commit((curr) => curr.map((x) => (x.id === s.id ? s : x))),
    [commit],
  );

  const eraseShape = useCallback(
    (id: string) => commit((curr) => curr.filter((s) => s.id !== id)),
    [commit],
  );

  const onShapeClick = (id: string) => {
    if (tool === "eraser") eraseShape(id);
    else if (tool === "select") setSelectedId(id);
  };

  const renderDraw = (s: Shape, key?: string) => {
    if (s.type === "pen" || s.type === "line") {
      return (
        <Line
          key={key ?? s.id}
          id={s.id}
          points={s.points}
          stroke={s.color}
          strokeWidth={s.width}
          lineCap="round"
          lineJoin="round"
          tension={s.type === "pen" ? 0.4 : 0}
          hitStrokeWidth={Math.max(12, s.width + 8)}
          draggable={tool === "select"}
          onClick={() => onShapeClick(s.id)}
          onTap={() => onShapeClick(s.id)}
          onDragEnd={(e) => {
            const dx = e.target.x();
            const dy = e.target.y();
            e.target.position({ x: 0, y: 0 });
            updateShape({
              ...s,
              points: s.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)),
            });
          }}
        />
      );
    }
    if (s.type === "arrow") {
      return (
        <Arrow
          key={key ?? s.id}
          id={s.id}
          points={s.points}
          stroke={s.color}
          fill={s.color}
          strokeWidth={s.width}
          pointerLength={12}
          pointerWidth={11}
          hitStrokeWidth={16}
          draggable={tool === "select"}
          onClick={() => onShapeClick(s.id)}
          onTap={() => onShapeClick(s.id)}
          onDragEnd={(e) => {
            const dx = e.target.x();
            const dy = e.target.y();
            e.target.position({ x: 0, y: 0 });
            updateShape({
              ...s,
              points: s.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)),
            });
          }}
        />
      );
    }
    if (s.type === "text") {
      return (
        <Text
          key={key ?? s.id}
          id={s.id}
          x={s.x}
          y={s.y}
          text={s.text}
          fontSize={s.fontSize}
          fontStyle="bold"
          fill={s.color}
          draggable={tool === "select"}
          onClick={() => onShapeClick(s.id)}
          onTap={() => onShapeClick(s.id)}
          onDblClick={() => {
            const t = window.prompt("テキスト", s.text);
            if (t != null) updateShape({ ...s, text: t });
          }}
          onDragEnd={(e) => updateShape({ ...s, x: e.target.x(), y: e.target.y() })}
        />
      );
    }
    return null;
  };

  return (
    <div className="flex min-h-0 flex-1 bg-zinc-950 text-white">
      <Palette
        version={version}
        team={team}
        setTeam={setTeam}
        onPlaceChampion={placeChampion}
        onPlaceToken={placeToken}
      />

      <div
        ref={wrapRef}
        className="relative min-w-0 flex-1"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DND_MIME)) e.preventDefault();
        }}
        onDrop={onDrop}
      >
        {size.w > 0 && (
          <Stage
            ref={stageRef}
            width={size.w}
            height={size.h}
            draggable={tool === "select"}
            dragBoundFunc={(pos) =>
              clampPos(pos, stageRef.current?.scaleX() ?? 1, size.w, size.h)
            }
            onWheel={handleWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ cursor: tool === "select" ? "default" : "crosshair" }}
          >
            <Layer>
              {mapImg && (
                <KImage
                  image={mapImg}
                  width={MAP}
                  height={MAP}
                  listening={false}
                />
              )}
              {shapes.map((s) =>
                s.type === "token" ? (
                  <TokenNode
                    key={s.id}
                    shape={s}
                    tool={tool}
                    onSelect={onShapeClick}
                    onChange={updateShape}
                    onErase={eraseShape}
                  />
                ) : (
                  renderDraw(s)
                ),
              )}
              {draft && renderDraw(draft, "draft")}
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                keepRatio
                enabledAnchors={[
                  "top-left",
                  "top-right",
                  "bottom-left",
                  "bottom-right",
                ]}
                boundBoxFunc={(oldB, newB) =>
                  newB.width < 16 ? oldB : newB
                }
              />
            </Layer>
          </Stage>
        )}

        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <Toolbar
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            onUndo={undo}
            onRedo={redo}
            onDelete={deleteSelected}
          />
        </div>
      </div>
    </div>
  );
}
