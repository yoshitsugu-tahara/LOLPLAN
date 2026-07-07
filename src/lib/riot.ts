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

export interface ReplayParticipant {
  participantId: number; // 1..10
  championName: string; // ddragon の id（アイコン用）
  teamId: number; // 100 = ブルー / 200 = レッド
  riotIdGameName: string;
}

export interface ReplayPos {
  participantId: number;
  rx: number;
  ry: number;
}

export interface ReplayFrame {
  ms: number;
  minute: number;
  positions: ReplayPos[];
}

export interface ReplayEvent {
  ms: number;
  type: string; // CHAMPION_KILL / ELITE_MONSTER_KILL
  rx: number;
  ry: number;
  monsterType?: string;
}

export interface ReplayData {
  matchId: string;
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
