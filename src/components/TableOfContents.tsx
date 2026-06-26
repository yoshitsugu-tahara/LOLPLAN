"use client";

import { useMemo } from "react";

interface Inline {
  type: string;
  text?: string;
  content?: Inline[];
}
interface Block {
  id: string;
  type: string;
  props?: { level?: number };
  content?: Inline[];
  children?: Block[];
}

function inlineText(content?: Inline[]): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => (c.type === "text" ? (c.text ?? "") : inlineText(c.content)))
    .join("");
}

function extractHeadings(content: unknown) {
  const out: { id: string; level: number; text: string }[] = [];
  const walk = (blocks: Block[]) => {
    for (const b of blocks) {
      if (b.type === "heading") {
        const text = inlineText(b.content).trim();
        if (text) out.push({ id: b.id, level: b.props?.level ?? 1, text });
      }
      if (Array.isArray(b.children) && b.children.length) walk(b.children);
    }
  };
  if (Array.isArray(content)) walk(content as Block[]);
  return out;
}

/** ノート本文の見出しから目次を作る（Notion風）。クリックでその見出しへスクロール */
export default function TableOfContents({ content }: { content: unknown }) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  if (headings.length < 2) return null;

  const minLevel = Math.min(...headings.map((h) => h.level));
  const scrollTo = (id: string) => {
    document
      .querySelector(`[data-id="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="mt-6 max-h-60 overflow-y-auto border-l border-white/10 pl-4">
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
        目次
      </div>
      <div className="space-y-0.5">
        {headings.map((h) => (
          <button
            key={h.id}
            onClick={() => scrollTo(h.id)}
            style={{ marginLeft: (h.level - minLevel) * 16 }}
            className="block max-w-full truncate rounded px-2 py-1 text-left text-sm leading-relaxed text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            {h.text}
          </button>
        ))}
      </div>
    </nav>
  );
}
