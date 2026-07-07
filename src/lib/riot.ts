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
