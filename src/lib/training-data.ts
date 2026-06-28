// 練習ループで使う定数（ロール / よくあるミスのタグ）

export const ROLES: { value: string; label: string }[] = [
  { value: "top", label: "TOP" },
  { value: "jungle", label: "JG" },
  { value: "mid", label: "MID" },
  { value: "adc", label: "ADC" },
  { value: "support", label: "SUP" },
];

export function roleLabel(v?: string | null) {
  return ROLES.find((r) => r.value === v)?.label ?? "";
}

// ランク上達でよく出る「ミスのカテゴリ」。試合ログでタグ付け→頻出を集計する。
export const PRESET_TAGS: string[] = [
  "無駄死に/オーバーエクステンド",
  "リコール判断",
  "ウェーブ管理",
  "視界(ワード)",
  "オブジェクト判断",
  "集団戦ポジション",
  "ファーム/CS",
  "ローミング/マップ把握",
  "ピン/コール",
  "スキル/コンボ",
  "アイテム/ビルド判断",
  "tilt/メンタル",
];

export const FOCUS_SCORES: { value: string; label: string; cls: string }[] = [
  { value: "good", label: "◎ 守れた", cls: "text-emerald-300" },
  { value: "ok", label: "○ まあまあ", cls: "text-amber-300" },
  { value: "bad", label: "✕ 守れず", cls: "text-rose-300" },
];
