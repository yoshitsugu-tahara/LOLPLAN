"use client";

import {
  Eraser,
  MousePointer2,
  MoveUpRight,
  Pen,
  Redo2,
  Slash,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { DRAW_COLORS } from "./data";
import type { Tool } from "./shapes";

const TOOLS: { id: Tool; label: string; Icon: LucideIcon }[] = [
  { id: "select", label: "選択", Icon: MousePointer2 },
  { id: "pen", label: "ペン", Icon: Pen },
  { id: "arrow", label: "矢印", Icon: MoveUpRight },
  { id: "line", label: "線", Icon: Slash },
  { id: "text", label: "テキスト", Icon: Type },
  { id: "eraser", label: "消しゴム", Icon: Eraser },
];

export default function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  onUndo,
  onRedo,
  onDelete,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-900/80 p-1 shadow-xl backdrop-blur">
      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          title={label}
          onClick={() => setTool(id)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
            tool === id
              ? "bg-sky-500 text-white"
              : "text-zinc-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon className="size-[18px]" />
        </button>
      ))}

      <div className="mx-1 h-6 w-px bg-white/10" />

      <div className="flex items-center gap-1 px-0.5">
        {DRAW_COLORS.map((c) => (
          <button
            key={c.hex}
            title={c.value}
            onClick={() => setColor(c.hex)}
            className={`h-5 w-5 rounded-full border transition ${
              color === c.hex
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
        onClick={onUndo}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white"
      >
        <Undo2 className="size-[18px]" />
      </button>
      <button
        title="やり直す"
        onClick={onRedo}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white"
      >
        <Redo2 className="size-[18px]" />
      </button>
      <button
        title="選択を削除"
        onClick={onDelete}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-red-500/80 hover:text-white"
      >
        <Trash2 className="size-[18px]" />
      </button>
    </div>
  );
}
