import Dexie, { type EntityTable } from "dexie";

/** 1つのMarkdownノート。content は BlockNote のドキュメントJSON */
export interface Note {
  id: string;
  title: string;
  content: unknown; // BlockNote document (Block[]) | undefined
  createdAt: number;
  updatedAt: number;
}

/** マップ注釈ブロック1つ分。tldraw のスナップショットとプレビュー画像を保持 */
export interface MapBoard {
  id: string;
  snapshot: unknown | null; // tldraw getSnapshot() の戻り値
  preview: string | null; // PNG data URL（ノート内に表示するサムネ）
  updatedAt: number;
}

/** SRプランナーの1ボード。tldraw スナップショットとサムネを保持 */
export interface Plan {
  id: string;
  title: string;
  snapshot: unknown | null; // tldraw getSnapshot() の戻り値
  preview: string | null; // PNG data URL（一覧サムネ）
  createdAt: number;
  updatedAt: number;
}

const db = new Dexie("lolnote") as Dexie & {
  notes: EntityTable<Note, "id">;
  maps: EntityTable<MapBoard, "id">;
  plans: EntityTable<Plan, "id">;
};

db.version(2).stores({
  notes: "id, updatedAt, title",
  maps: "id, updatedAt",
  plans: "id, updatedAt, title",
});

export { db };
