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
  Rect,
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
  onClick,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransform,
}: {
  shape: TokenShape;
  tool: Tool;
  onClick: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string) => void;
  onDragEnd: (id: string) => void;
  onTransform: (s: TokenShape) => void;
}) {
  const isImg = isImageSrc(shape.src);
  const img = useImage(isImg ? shape.src : undefined);
  const r = shape.size / 2;
  const iw = shape.size * (shape.fit === "cover" ? 1 : 0.78);

  return (
    <Group
      id={shape.id}
      name="token"
      x={shape.x}
      y={shape.y}
      draggable={tool === "select"}
      onClick={(e) => onClick(shape.id, e)}
      onTap={(e) => onClick(shape.id, e)}
      onDragStart={() => onDragStart(shape.id)}
      onDragMove={() => onDragMove(shape.id)}
      onDragEnd={() => onDragEnd(shape.id)}
      onTransformEnd={(e) => {
        const node = e.target;
        const s = node.scaleX();
        node.scaleX(1);
        node.scaleY(1);
        onTransform({
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
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
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const panStart = useRef<{ px: number; py: number; sx: number; sy: number } | null>(
    null,
  );
  const spaceDown = useRef(false);
  // 複数選択ドラッグ用：開始時の各選択ノード位置
  const groupDrag = useRef<{
    id: string;
    sx: number;
    sy: number;
    others: { id: string; x: number; y: number }[];
  } | null>(null);

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
    setSelectedIds([]);
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
    if (!selectedIds.length) return;
    const ids = new Set(selectedIds);
    commit((curr) => curr.filter((s) => !ids.has(s.id)));
    setSelectedIds([]);
  }, [selectedIds, commit]);

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

  // 選択時に Transformer を選択ノード全てへアタッチ
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((n): n is NonNullable<typeof n> => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, shapes]);

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

  // --- ポインタ操作（パン / マーキー選択 / 描画） ---
  const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const evt = e.evt;
    // パン：中ボタン or スペース+左
    if (evt.button === 1 || (spaceDown.current && evt.button === 0)) {
      panStart.current = {
        px: evt.clientX,
        py: evt.clientY,
        sx: stage.x(),
        sy: stage.y(),
      };
      return;
    }
    if (evt.button !== 0) return;

    if (tool === "select") {
      if (e.target === stage) {
        // 空白ドラッグ＝マーキー選択
        const p = toPage(stage);
        marqueeStart.current = { x: p.x, y: p.y };
        setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
        if (!evt.shiftKey) setSelectedIds([]);
      }
      return;
    }
    if (tool === "eraser") return;

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
    const stage = stageRef.current;
    if (!stage) return;
    // パン
    if (panStart.current) {
      const ps = panStart.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      // clientX/Y ベースの移動量
      const rect = stage.container().getBoundingClientRect();
      const dx = pointer.x + rect.left - ps.px;
      const dy = pointer.y + rect.top - ps.py;
      stage.position(
        clampPos(
          { x: ps.sx + dx, y: ps.sy + dy },
          stage.scaleX(),
          size.w,
          size.h,
        ),
      );
      stage.batchDraw();
      return;
    }
    // マーキー
    if (marqueeStart.current) {
      const s = marqueeStart.current;
      const p = toPage(stage);
      setMarquee({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      });
      return;
    }
    // 描画
    if (!drawing.current) return;
    const d = draftRef.current;
    if (!d || (d.type !== "pen" && d.type !== "line" && d.type !== "arrow")) return;
    const p = toPage(stage);
    const next: Shape =
      d.type === "pen"
        ? { ...d, points: [...d.points, p.x, p.y] }
        : { ...d, points: [d.points[0], d.points[1], p.x, p.y] };
    draftRef.current = next;
    setDraft(next);
  };

  const onPointerUp = () => {
    if (panStart.current) {
      panStart.current = null;
      return;
    }
    if (marqueeStart.current) {
      const m = marquee;
      marqueeStart.current = null;
      setMarquee(null);
      const stage = stageRef.current;
      if (m && stage && (m.w > 3 || m.h > 3)) {
        const hit = shapes
          .filter((s) => {
            const node = stage.findOne(`#${s.id}`);
            if (!node) return false;
            const r = node.getClientRect({ relativeTo: stage });
            return !(
              r.x + r.width < m.x ||
              m.x + m.w < r.x ||
              r.y + r.height < m.y ||
              m.y + m.h < r.y
            );
          })
          .map((s) => s.id);
        setSelectedIds(hit);
      }
      return;
    }
    if (!drawing.current) return;
    drawing.current = false;
    const d = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (d && (d.type !== "pen" || d.points.length >= 4)) {
      commit((curr) => [...curr, d]);
    }
  };

  // 複数トークンのまとめ移動
  const onNodeDragStart = (id: string) => {
    const stage = stageRef.current;
    if (!stage || !selectedIds.includes(id) || selectedIds.length < 2) {
      groupDrag.current = null;
      return;
    }
    const self = stage.findOne(`#${id}`);
    if (!self) return;
    groupDrag.current = {
      id,
      sx: self.x(),
      sy: self.y(),
      others: selectedIds
        .filter((x) => x !== id)
        .map((oid) => {
          const n = stage.findOne(`#${oid}`);
          return n ? { id: oid, x: n.x(), y: n.y() } : null;
        })
        .filter((o): o is { id: string; x: number; y: number } => !!o),
    };
  };

  const onNodeDragMove = (id: string) => {
    const g = groupDrag.current;
    const stage = stageRef.current;
    if (!g || g.id !== id || !stage) return;
    const self = stage.findOne(`#${id}`);
    if (!self) return;
    const dx = self.x() - g.sx;
    const dy = self.y() - g.sy;
    for (const o of g.others) {
      const n = stage.findOne(`#${o.id}`);
      if (n) n.position({ x: o.x + dx, y: o.y + dy });
    }
    trRef.current?.forceUpdate();
  };

  const onNodeDragEnd = (id: string) => {
    const stage = stageRef.current;
    if (!stage) return;
    const g = groupDrag.current;
    groupDrag.current = null;
    const ids = g && g.id === id ? [id, ...g.others.map((o) => o.id)] : [id];
    const pos = new Map<string, { x: number; y: number }>();
    for (const i of ids) {
      const n = stage.findOne(`#${i}`);
      if (n) pos.set(i, { x: n.x(), y: n.y() });
    }
    commit((curr) =>
      curr.map((s) =>
        s.type === "token" && pos.has(s.id)
          ? { ...s, x: pos.get(s.id)!.x, y: pos.get(s.id)!.y }
          : s,
      ),
    );
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

  // キーボード（削除・パン用スペース）
  useEffect(() => {
    const isTyping = () => {
      const t = document.activeElement?.tagName;
      return t === "INPUT" || t === "TEXTAREA";
    };
    const down = (e: KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length &&
        !isTyping()
      ) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.code === "Space" && !isTyping()) {
        spaceDown.current = true;
        const c = stageRef.current?.container();
        if (c) c.style.cursor = "grab";
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = false;
        const c = stageRef.current?.container();
        if (c) c.style.cursor = "";
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [selectedIds, deleteSelected]);

  const updateShape = useCallback(
    (s: Shape) => commit((curr) => curr.map((x) => (x.id === s.id ? s : x))),
    [commit],
  );

  const eraseShape = useCallback(
    (id: string) => commit((curr) => curr.filter((s) => s.id !== id)),
    [commit],
  );

  const onShapeClick = (
    id: string,
    e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    if (tool === "eraser") {
      eraseShape(id);
      return;
    }
    if (tool !== "select") return;
    const shift = !!(e?.evt as MouseEvent | undefined)?.shiftKey;
    setSelectedIds((prev) =>
      shift
        ? prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id]
        : [id],
    );
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
          onClick={(e) => onShapeClick(s.id, e)}
          onTap={(e) => onShapeClick(s.id, e)}
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
          onClick={(e) => onShapeClick(s.id, e)}
          onTap={(e) => onShapeClick(s.id, e)}
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
          onClick={(e) => onShapeClick(s.id, e)}
          onTap={(e) => onShapeClick(s.id, e)}
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
                    onClick={onShapeClick}
                    onDragStart={onNodeDragStart}
                    onDragMove={onNodeDragMove}
                    onDragEnd={onNodeDragEnd}
                    onTransform={updateShape}
                  />
                ) : (
                  renderDraw(s)
                ),
              )}
              {draft && renderDraw(draft, "draft")}
              {marquee && (
                <Rect
                  x={marquee.x}
                  y={marquee.y}
                  width={marquee.w}
                  height={marquee.h}
                  fill="rgba(56,189,248,0.12)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  listening={false}
                />
              )}
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
