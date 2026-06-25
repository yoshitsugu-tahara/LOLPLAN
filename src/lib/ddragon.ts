/**
 * Riot Data Dragon のアセットヘルパー。
 * バージョン・チャンピオン一覧をフェッチし、アイコン/マップ画像のURLを組み立てる。
 */

const BASE = "https://ddragon.leagueoflegends.com";
const FALLBACK_VERSION = "16.13.1";

export interface Champion {
  id: string; // 例: "Aatrox"（アイコンURLに使う）
  key: string; // 数値ID（文字列）
  name: string; // 表示名（ロケール依存）
}

let versionPromise: Promise<string> | null = null;
/** 最新パッチのバージョン文字列を返す（キャッシュ付き） */
export function getVersion(): Promise<string> {
  if (!versionPromise) {
    versionPromise = fetch(`${BASE}/api/versions.json`)
      .then((r) => r.json())
      .then((v: string[]) => v[0] ?? FALLBACK_VERSION)
      .catch(() => FALLBACK_VERSION);
  }
  return versionPromise;
}

let championsPromise: Promise<Champion[]> | null = null;
/** 全チャンピオンを名前順で返す（キャッシュ付き、日本語名） */
export function getChampions(): Promise<Champion[]> {
  if (!championsPromise) {
    championsPromise = (async () => {
      const version = await getVersion();
      const r = await fetch(`${BASE}/cdn/${version}/data/ja_JP/champion.json`);
      const j = (await r.json()) as {
        data: Record<string, { id: string; key: string; name: string }>;
      };
      return Object.values(j.data)
        .map((c) => ({ id: c.id, key: c.key, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ja"));
    })();
  }
  return championsPromise;
}

/** チャンピオンの四角アイコンURL */
export function championIcon(version: string, id: string): string {
  return `${BASE}/cdn/${version}/img/champion/${id}.png`;
}

/** サモナーズリフト（map11）のミニマップ画像URL */
export function mapImage(version: string): string {
  return `${BASE}/cdn/${version}/img/map/map11.png`;
}
