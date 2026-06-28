// アプリ全体で使う共有データ型（Drizzleスキーマと対応）。
// クライアントからも import するので、ここにはランタイムコードを置かない。

export interface Note {
  id: string;
  userId?: string;
  title: string;
  content: unknown; // BlockNote document (Block[]) | null
  sectionId: string | null;
  order: number | null;
  labels: string[] | null;
  createdAt: number;
  updatedAt: number;
}

export interface Section {
  id: string;
  userId?: string;
  name: string;
  order: number;
}

export interface MapBoard {
  id: string;
  userId?: string;
  snapshot: unknown; // Shape[] | null
  preview: string | null;
  updatedAt: number;
}

export interface Plan {
  id: string;
  userId?: string;
  title: string;
  snapshot: unknown; // Shape[] | null
  preview: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 一覧用の軽量プラン（snapshotを含まない） */
export type PlanMeta = Pick<
  Plan,
  "id" | "title" | "preview" | "createdAt" | "updatedAt"
>;

// ───────────── 練習ループ ─────────────

export interface Focus {
  id: string;
  userId?: string;
  text: string;
  order: number;
  createdAt: number;
}

export type GameResult = "win" | "lose";
export type FocusScore = "good" | "ok" | "bad";
export type Role = "top" | "jungle" | "mid" | "adc" | "support";

export interface Game {
  id: string;
  userId?: string;
  result: GameResult;
  champion: string | null;
  role: string | null;
  focusScore: string | null;
  good: string | null;
  mistake: string | null;
  tags: string[] | null;
  nextFocus: string | null;
  playedAt: number;
  createdAt: number;
}
