interface Inline {
  type: string;
  text?: string;
  content?: Inline[];
}
interface Block {
  type?: string;
  content?: unknown;
  children?: Block[];
}

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as Inline[])
    .map((c) => (c.type === "text" ? (c.text ?? "") : inlineText(c.content)))
    .join("");
}

/** BlockNote ドキュメント(Block[])から検索用のプレーンテキストを取り出す */
export function blocksToText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const out: string[] = [];
  const walk = (blocks: Block[]) => {
    for (const b of blocks) {
      if (Array.isArray(b.content)) {
        const t = inlineText(b.content);
        if (t) out.push(t);
      }
      if (Array.isArray(b.children) && b.children.length) walk(b.children);
    }
  };
  walk(content as Block[]);
  return out.join("\n");
}
