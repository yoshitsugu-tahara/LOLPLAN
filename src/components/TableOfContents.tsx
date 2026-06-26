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
    <nav className="mb-2 max-h-52 overflow-y-auto border-l-2 border-white/10 pl-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
        目次
      </div>
      {headings.map((h) => (
        <button
          key={h.id}
          onClick={() => scrollTo(h.id)}
          style={{ paddingLeft: (h.level - minLevel) * 14 }}
          className="block w-full truncate py-0.5 text-left text-sm text-zinc-400 transition hover:text-white"
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}
