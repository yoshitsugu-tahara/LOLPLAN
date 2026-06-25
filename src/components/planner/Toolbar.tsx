"use client";

import {
  DefaultColorStyle,
  type Editor,
  type TLDefaultColorStyle,
} from "tldraw";

import { DRAW_COLORS } from "./data";
import {
  ArrowIcon,
  CursorIcon,
  EraserIcon,
  LineIcon,
  PenIcon,
  RedoIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
} from "./icons";

const TOOLS = [
  { id: "select", label: "選択", Icon: CursorIcon },
  { id: "draw", label: "ペン", Icon: PenIcon },
  { id: "arrow", label: "矢印", Icon: ArrowIcon },
  { id: "line", label: "線", Icon: LineIcon },
  { id: "text", label: "テキスト", Icon: TextIcon },
  { id: "eraser", label: "消しゴム", Icon: EraserIcon },
] as const;

export default function Toolbar({
  editor,
  activeTool,
  color,
  setColor,
}: {
  editor: Editor;
  activeTool: string;
  color: string;
  setColor: (v: string) => void;
}) {
  const pickColor = (value: string) => {
    setColor(value);
    const c = value as TLDefaultColorStyle;
    editor.setStyleForNextShapes(DefaultColorStyle, c);
    editor.setStyleForSelectedShapes(DefaultColorStyle, c);
  };

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-900/80 p-1 shadow-xl backdrop-blur">
      {TOOLS.map(({ id, label, Icon }) => {
        const active = activeTool === id;
        return (
          <button
            key={id}
            title={label}
            onClick={() => editor.setCurrentTool(id)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
              active
                ? "bg-sky-500 text-white"
                : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon />
          </button>
        );
      })}

      <div className="mx-1 h-6 w-px bg-white/10" />

      {/* 色スウォッチ */}
      <div className="flex items-center gap-1 px-0.5">
        {DRAW_COLORS.map((c) => (
          <button
            key={c.value}
            title={c.value}
            onClick={() => pickColor(c.value)}
            className={`h-5 w-5 rounded-full border transition ${
              color === c.value
                ? "scale-110 border-white"
                : "border-black/30 hover:scale-110"
            }`}
            style={{ background: c.hex }}
          />
        ))}
      </div>

      <div className="mx-1 h-6 w-px bg-white/10" />

      <button
        title="元に戻す"
        onClick={() => editor.undo()}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white"
      >
        <UndoIcon />
      </button>
      <button
        title="やり直す"
        onClick={() => editor.redo()}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white"
      >
        <RedoIcon />
      </button>
      <button
        title="選択を削除"
        onClick={() => editor.deleteShapes(editor.getSelectedShapeIds())}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-red-500/80 hover:text-white"
      >
        <TrashIcon />
      </button>
    </div>
  );
}
