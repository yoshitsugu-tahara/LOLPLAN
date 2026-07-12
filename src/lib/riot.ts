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

/** アイテム売買イベント（時間対応ビルド用） */
export interface ItemEvent {
  ms: number;
  itemId: number;
  kind: "PURCHASED" | "SOLD" | "UNDO";
}

/** 参加者の最終戦績（match エンドポイント由来）＋時系列の購入/スキル */
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
  wardsPlaced: number;
  wardsKilled: number;
  items: number[]; // item0..item6（0 は空）
  spell1: number;
  spell2: number;
  csPerMin: number;
  killParticipation: number; // 0..1
  purchases: ItemEvent[]; // 時系列のアイテム売買
  skillOrder: number[]; // スキル上げ順（1=Q,2=W,3=E,4=R）
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
  // CHAMPION_KILL / ELITE_MONSTER_KILL / BUILDING_KILL / TURRET_PLATE_DESTROYED
  // / DRAGON_SOUL_GIVEN
  type: string;
  rx: number;
  ry: number;
  killerId?: number;
  victimId?: number;
  assistIds?: number[];
  teamId?: number; // BUILDING/PLATE: 建物側チーム / SOUL: 取得チーム / MONSTER: 取得チーム
  monsterType?: string; // DRAGON / BARON_NASHOR / RIFTHERALD / HORDE
  monsterSubType?: string; // FIRE_DRAGON / ELDER_DRAGON など
  buildingType?: string; // TOWER_BUILDING / INHIBITOR_BUILDING
  towerType?: string; // OUTER_TURRET / INNER_TURRET / BASE_TURRET / NEXUS_TURRET
  laneType?: string; // TOP_LANE / MID_LANE / BOT_LANE
  soulName?: string; // DRAGON_SOUL_GIVEN の属性名
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

// ───────── ◯分時点の状態復元（イベントを畳む） ─────────

export const BARON_BUFF_MS = 180000; // バロン 3分
export const ELDER_BUFF_MS = 150000; // エルダー 2.5分

export interface TeamObjective {
  dragons: string[]; // 属性リスト（取得順）
  heralds: number;
  grubs: number;
  barons: number;
  soul: string | null;
  baronActiveUntil: number | null;
  elderActiveUntil: number | null;
}
export interface DownTower {
  teamId: number;
  lane: string;
  tower: string;
}
export interface GameState {
  towersDown: DownTower[];
  platesDown: { teamId: number; lane: string }[];
  team: Record<number, TeamObjective>;
}

const emptyObj = (): TeamObjective => ({
  dragons: [],
  heralds: 0,
  grubs: 0,
  barons: 0,
  soul: null,
  baronActiveUntil: null,
  elderActiveUntil: null,
});

/** ドラゴンの属性を短い日本語に */
export function dragonShort(subType?: string): string {
  const m: Record<string, string> = {
    FIRE_DRAGON: "火",
    AIR_DRAGON: "風",
    EARTH_DRAGON: "土",
    WATER_DRAGON: "水",
    HEXTECH_DRAGON: "H",
    CHEMTECH_DRAGON: "C",
    ELDER_DRAGON: "長老",
  };
  return (subType && m[subType]) || "竜";
}

/** ms 時点のタワー/オブジェクト状態をイベントから復元 */
export function stateAt(data: ReplayData, ms: number): GameState {
  const team: Record<number, TeamObjective> = { 100: emptyObj(), 200: emptyObj() };
  const towersDown: DownTower[] = [];
  const platesDown: { teamId: number; lane: string }[] = [];
  const pTeam = new Map(data.participants.map((p) => [p.participantId, p.teamId]));
  const takerTeam = (e: ReplayEvent) =>
    e.teamId ?? (e.killerId != null ? pTeam.get(e.killerId) : undefined);

  for (const e of data.events) {
    if (e.ms > ms) continue;
    if (e.type === "BUILDING_KILL" && e.teamId) {
      towersDown.push({
        teamId: e.teamId,
        lane: e.laneType ?? "",
        tower: e.towerType ?? e.buildingType ?? "",
      });
    } else if (e.type === "TURRET_PLATE_DESTROYED" && e.teamId) {
      platesDown.push({ teamId: e.teamId, lane: e.laneType ?? "" });
    } else if (e.type === "DRAGON_SOUL_GIVEN" && e.teamId) {
      team[e.teamId].soul = e.soulName ?? "ソウル";
    } else if (e.type === "ELITE_MONSTER_KILL") {
      const t = takerTeam(e);
      if (t !== 100 && t !== 200) continue;
      if (e.monsterType === "DRAGON") {
        if (e.monsterSubType === "ELDER_DRAGON")
          team[t].elderActiveUntil = e.ms + ELDER_BUFF_MS;
        else team[t].dragons.push(dragonShort(e.monsterSubType));
      } else if (e.monsterType === "BARON_NASHOR") {
        team[t].barons += 1;
        team[t].baronActiveUntil = e.ms + BARON_BUFF_MS;
      } else if (e.monsterType === "RIFTHERALD") team[t].heralds += 1;
      else if (e.monsterType === "HORDE") team[t].grubs += 1;
    }
  }
  // バフ有効切れの後処理
  for (const t of [100, 200]) {
    if (team[t].baronActiveUntil && team[t].baronActiveUntil <= ms)
      team[t].baronActiveUntil = null;
    if (team[t].elderActiveUntil && team[t].elderActiveUntil <= ms)
      team[t].elderActiveUntil = null;
  }
  return { towersDown, platesDown, team };
}

/** ms 時点で所持しているアイテム（購入/売却/UNDOを畳む） */
export function itemsAt(purchases: ItemEvent[] | undefined, ms: number): number[] {
  const owned: number[] = [];
  for (const e of purchases ?? []) {
    if (e.ms > ms) break;
    if (e.kind === "PURCHASED") owned.push(e.itemId);
    else if (e.kind === "SOLD" || e.kind === "UNDO") {
      const i = owned.lastIndexOf(e.itemId);
      if (i >= 0) owned.splice(i, 1);
    }
  }
  // 末尾優先で最大6個＋トリンケット相当は無視（雑に直近6個）
  return owned.slice(-6);
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
