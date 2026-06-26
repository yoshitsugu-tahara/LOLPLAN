import Dexie, { type EntityTable } from "dexie";

/** 1つのMarkdownノート。content は BlockNote のドキュメントJSON */
export interface Note {
  id: string;
  title: string;
  content: unknown; // BlockNote document (Block[]) | undefined
  createdAt: number;
  updatedAt: number;
  sectionId?: string | null; // 所属セクション。未設定＝未分類
  order?: number; // セクション内での並び順（小さいほど上）
}

/** サイドバーの分類セクション（ユーザーが作成） */
export interface Section {
  id: string;
  name: string;
  order: number; // セクション自体の並び順
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
  sections: EntityTable<Section, "id">;
};

db.version(2).stores({
  notes: "id, updatedAt, title",
  maps: "id, updatedAt",
  plans: "id, updatedAt, title",
});

db.version(3)
  .stores({
    notes: "id, updatedAt, title, sectionId, order",
    maps: "id, updatedAt",
    plans: "id, updatedAt, title",
    sections: "id, order",
  })
  .upgrade(async (tx) => {
    // 既存ノートに更新日時順で order を振る（未分類のまま）
    const notes = await tx
      .table("notes")
      .orderBy("updatedAt")
      .reverse()
      .toArray();
    let i = 0;
    for (const n of notes) {
      await tx.table("notes").update(n.id, { order: i++ });
    }
  });

export { db };
