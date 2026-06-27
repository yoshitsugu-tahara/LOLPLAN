import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

export const searchKey = new PluginKey<SearchState>("lolnote-search");

interface Match {
  from: number;
  to: number;
}
interface SearchState {
  term: string;
  active: number;
  matches: Match[];
  deco: DecorationSet;
}

const empty: SearchState = {
  term: "",
  active: 0,
  matches: [],
  deco: DecorationSet.empty,
};

function findMatches(doc: PMNode, term: string): Match[] {
  const out: Match[] = [];
  if (!term) return out;
  const q = term.toLowerCase();
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text.toLowerCase();
      let i = 0;
      while ((i = text.indexOf(q, i)) !== -1) {
        out.push({ from: pos + i, to: pos + i + q.length });
        i += q.length;
      }
    }
    return true;
  });
  return out;
}

function buildDeco(doc: PMNode, matches: Match[], active: number): DecorationSet {
  if (!matches.length) return DecorationSet.empty;
  return DecorationSet.create(
    doc,
    matches.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class: i === active ? "lol-find lol-find-active" : "lol-find",
      }),
    ),
  );
}

export function searchPlugin() {
  return new Plugin<SearchState>({
    key: searchKey,
    state: {
      init: () => empty,
      apply(tr, prev) {
        const meta = tr.getMeta(searchKey) as
          | { term?: string; active?: number }
          | undefined;
        if (meta?.term !== undefined) {
          const matches = findMatches(tr.doc, meta.term);
          return {
            term: meta.term,
            active: 0,
            matches,
            deco: buildDeco(tr.doc, matches, 0),
          };
        }
        if (meta?.active !== undefined) {
          if (!prev.matches.length) return prev;
          const n = prev.matches.length;
          const active = ((meta.active % n) + n) % n;
          return { ...prev, active, deco: buildDeco(tr.doc, prev.matches, active) };
        }
        if (tr.docChanged && prev.term) {
          const matches = findMatches(tr.doc, prev.term);
          const active = matches.length
            ? Math.min(prev.active, matches.length - 1)
            : 0;
          return {
            term: prev.term,
            active,
            matches,
            deco: buildDeco(tr.doc, matches, active),
          };
        }
        return prev;
      },
    },
    props: {
      decorations(state) {
        return searchKey.getState(state)?.deco;
      },
    },
  });
}

export function getSearch(view: EditorView): SearchState {
  return searchKey.getState(view.state) ?? empty;
}
export function setSearch(view: EditorView, term: string) {
  view.dispatch(view.state.tr.setMeta(searchKey, { term }));
}
export function setActive(view: EditorView, active: number) {
  view.dispatch(view.state.tr.setMeta(searchKey, { active }));
}
export function scrollToActive(view: EditorView) {
  const st = getSearch(view);
  const m = st.matches[st.active];
  if (!m) return;
  try {
    const { node } = view.domAtPos(m.from);
    const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {
    // ignore
  }
}
