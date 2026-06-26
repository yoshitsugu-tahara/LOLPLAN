/** プランナーで使う固定アセット（ワード・オブジェクト・マーカー）の定義 */

export const MAP_SIZE = 1024;

/** 背景に使うサモナーズリフト画像（public 配下・1380x1380 の正方形） */
export const MAP_IMAGE = "/map2.jpg";

/** チーム色（チャンピオン配置時のリング色） */
export const TEAM_COLORS = {
  blue: "#3b82f6",
  red: "#ef4444",
} as const;
export type Team = keyof typeof TEAM_COLORS;

/** 描画ツールで使う色スウォッチ（tldraw DefaultColorStyle の値 → 表示色） */
export const DRAW_COLORS: { value: string; hex: string }[] = [
  { value: "white", hex: "#f4f4f5" },
  { value: "yellow", hex: "#facc15" },
  { value: "orange", hex: "#fb923c" },
  { value: "red", hex: "#f87171" },
  { value: "violet", hex: "#a78bfa" },
  { value: "blue", hex: "#60a5fa" },
  { value: "light-green", hex: "#4ade80" },
  { value: "black", hex: "#18181b" },
];

export interface PaletteToken {
  id: string;
  label: string;
  icon: string; // 画像URL（/icons/... or http）または絵文字
  color: string;
  size?: number;
}

// ワード = Data Dragon のアイテムアイコン、オブジェクト = Community Dragon の
// ミニマップアイコンを public/icons/ に取り込んだもの。
export const WARDS: PaletteToken[] = [
  { id: "ward-stealth", label: "ステルスワード", icon: "/icons/ward-stealth.png", color: "#22c55e", size: 36 },
  { id: "ward-control", label: "コントロールワード", icon: "/icons/ward-control.png", color: "#ec4899", size: 36 },
  { id: "ward-farsight", label: "ファーサイト", icon: "/icons/ward-farsight.png", color: "#38bdf8", size: 36 },
];

export const OBJECTIVES: PaletteToken[] = [
  { id: "obj-dragon", label: "ドラゴン", icon: "/icons/obj-dragon.png", color: "#f97316", size: 40 },
  { id: "obj-baron", label: "バロン", icon: "/icons/obj-baron.png", color: "#a855f7", size: 40 },
  { id: "obj-herald", label: "ヘラルド", icon: "/icons/obj-herald.png", color: "#6366f1", size: 40 },
  { id: "obj-grubs", label: "ヴォイドグラブ", icon: "/icons/obj-grubs.png", color: "#84cc16", size: 36 },
  { id: "obj-scuttle", label: "スカトル", icon: "/icons/obj-scuttle.png", color: "#06b6d4", size: 36 },
];

export const MARKERS: PaletteToken[] = [
  { id: "mk-danger", label: "危険", icon: "⚠️", color: "#ef4444", size: 34 },
  { id: "mk-target", label: "ターゲット", icon: "🎯", color: "#ef4444", size: 34 },
  { id: "mk-star", label: "重要", icon: "⭐", color: "#facc15", size: 34 },
  { id: "mk-flag", label: "目標", icon: "🚩", color: "#22c55e", size: 34 },
  { id: "mk-x", label: "回避", icon: "❌", color: "#f87171", size: 34 },
];

/** id から PaletteToken を引くための一覧（ドロップ時の解決に使う） */
export const ALL_TOKENS: Record<string, PaletteToken> = Object.fromEntries(
  [...WARDS, ...OBJECTIVES, ...MARKERS].map((t) => [t.id, t]),
);

/**
 * パレット→マップへのドラッグ&ドロップで使う独自MIME。
 * 画像URLではなくこの型だけを dataTransfer に載せることで、
 * tldraw が「URLのドロップ」と誤認してブックマークを作るのを防ぐ。
 */
export const DND_MIME = "application/x-lol-token";

export type DndPayload =
  | { kind: "champion"; id: string; name: string }
  | { kind: "token"; id: string };
