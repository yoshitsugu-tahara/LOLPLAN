/**
 * Riot Match-V5 リプレイ用の共有型と座標変換（クライアント/サーバ両用・純粋関数のみ）。
 * SR の座標境界は hextechdocs 準拠。
 */

export const SR_MIN_X = -120;
export const SR_MAX_X = 14870;
export const SR_MIN_Y = -120;
export const SR_MAX_Y = 14980;

/** ゲーム座標(x,y) → 画像内の相対位置 0..1（左上原点。ゲームのYは上向きなので反転） */
export function gameToRel(gx: number, gy: number): { rx: number; ry: number } {
  const rx = (gx - SR_MIN_X) / (SR_MAX_X - SR_MIN_X);
  const ry = 1 - (gy - SR_MIN_Y) / (SR_MAX_Y - SR_MIN_Y);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return { rx: clamp(rx), ry: clamp(ry) };
}

/** 参加者の最終戦績（match エンドポイント由来） */
export interface ReplayParticipant {
  participantId: number; // 1..10
  puuid: string;
  championName: string; // ddragon の id（アイコン用）
  teamId: number; // 100 = ブルー / 200 = レッド
  role: string; // TOP / JUNGLE / MIDDLE / BOTTOM / UTILITY（空の場合あり）
  riotIdGameName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  champLevel: number;
  cs: number; // minions + jungle
  gold: number;
  dmgToChamps: number;
  visionScore: number;
  items: number[]; // item0..item6（0 は空）
  spell1: number;
  spell2: number;
  csPerMin: number;
  killParticipation: number; // 0..1
}

export interface ReplayPos {
  participantId: number;
  rx: number;
  ry: number;
}

/** その分の各参加者のスナップショット（リード差グラフ用） */
export interface ReplayStat {
  participantId: number;
  totalGold: number;
  level: number;
  cs: number;
}

export interface ReplayFrame {
  ms: number;
  minute: number;
  positions: ReplayPos[];
  stats: ReplayStat[];
}

export interface ReplayEvent {
  ms: number;
  type: string; // CHAMPION_KILL / ELITE_MONSTER_KILL / BUILDING_KILL
  rx: number;
  ry: number;
  killerId?: number;
  victimId?: number;
  monsterType?: string; // DRAGON / BARON_NASHOR / RIFTHERALD / HORDE
  buildingType?: string; // TOWER_BUILDING / INHIBITOR_BUILDING
  laneType?: string;
}

export interface ReplayData {
  matchId: string;
  queueId: number;
  gameStart: number;
  durationSec: number;
  participants: ReplayParticipant[];
  frames: ReplayFrame[];
  events: ReplayEvent[];
}

export interface MatchSummary {
  matchId: string;
  champ: string; // 対象プレイヤーのチャンピオン
  win: boolean;
  queueId: number;
  gameStart: number;
  duration: number;
}

/** teamPosition から対面（敵チームの同ロール）の participantId を引く */
export function opponentOf(
  me: ReplayParticipant,
  all: ReplayParticipant[],
): ReplayParticipant | undefined {
  if (!me.role) return undefined;
  return all.find((p) => p.teamId !== me.teamId && p.role === me.role);
}

/**
 * 相対座標(rx,ry: 0..1, 画像左上原点) → SR のエリア名ラベル。
 * ブルー拠点=左下 / レッド拠点=右上 の標準向き。LLMに位置を渡す用の粗いラベル。
 */
export function regionLabel(rx: number, ry: number): string {
  if (rx < 0.14 && ry > 0.86) return "ブルー拠点";
  if (rx > 0.86 && ry < 0.14) return "レッド拠点";
  const center = Math.hypot(rx - 0.5, ry - 0.5);
  if (center < 0.1) return "川(中央)";
  const diag = rx + ry - 1; // <0 = トップ側 / >0 = ボット側
  if (Math.abs(diag) < 0.14) return "ミッドレーン";
  const nearTopEdge = ry < 0.22 || rx < 0.22;
  const nearBotEdge = ry > 0.78 || rx > 0.78;
  if (diag < 0 && nearTopEdge) return "トップレーン";
  if (diag > 0 && nearBotEdge) return "ボットレーン";
  const side = diag < 0 ? "トップ側" : "ボット側";
  const dBlue = Math.hypot(rx - 0, ry - 1);
  const dRed = Math.hypot(rx - 1, ry - 0);
  const team = dBlue < dRed ? "ブルー" : "レッド";
  return `${team}JG(${side})`;
}

export interface RankInfo {
  tier: string | null; // GOLD 等（null=アンランク）
  division: string | null;
  lp: number;
  wins: number;
  losses: number;
}

const TIER_SHORT: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Plat",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "GM",
  CHALLENGER: "Chall",
};
const APEX = ["MASTER", "GRANDMASTER", "CHALLENGER"];

/** ランク表示（例: "Gold II" / "Diamond 32LP" / "Unranked"） */
export function rankLabel(r?: RankInfo | null): string {
  if (!r || !r.tier) return "Unranked";
  const t = TIER_SHORT[r.tier] ?? r.tier;
  return APEX.includes(r.tier) ? `${t} ${r.lp}LP` : `${t} ${r.division ?? ""}`.trim();
}

/** ランクtierの色（CSS色文字列） */
export function tierColor(tier?: string | null): string {
  const m: Record<string, string> = {
    IRON: "#6b6b6b",
    BRONZE: "#a97142",
    SILVER: "#9aa4ad",
    GOLD: "#e6b34d",
    PLATINUM: "#4fd1c5",
    EMERALD: "#34d399",
    DIAMOND: "#7aa5ff",
    MASTER: "#c084fc",
    GRANDMASTER: "#f87171",
    CHALLENGER: "#f5d76e",
  };
  return (tier && m[tier]) || "#71717a";
}

/** キューID → 表示名（主要なものだけ） */
export function queueName(id: number): string {
  const m: Record<number, string> = {
    420: "ランク ソロ/デュオ",
    440: "ランク フレックス",
    400: "ノーマル ドラフト",
    430: "ノーマル ブラインド",
    450: "ARAM",
    490: "ノーマル（クイック）",
    700: "クラッシュ",
    1700: "アリーナ",
    1900: "URF",
  };
  return m[id] ?? `Queue ${id}`;
}
