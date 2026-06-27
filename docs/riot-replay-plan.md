# Riot API 試合リプレイ（○分時点のマップ状況）— 調査・設計メモ

> ステータス: **計画（未着手）**。あとで PoC から再開する。
> 目的: 過去の試合を Riot API で取り込み、「○分時点で各チャンピオンがどこに居たか」を
> 既存の SR マップ（Konva）上に再現する。キル/ドラゴン等のイベントも時刻付きで表示。

## 判定: 実現可能 ✅

Match-V5 タイムライン API が **全10プレイヤーの座標を約1分ごと** に返す。試合後データなので
視界制限なしで全員見える。既存のマップ・チャンピオンアイコン・トークン描画を流用できる。

---

## 1. データソース

### タイムライン
`GET /lol/match/v5/matches/{matchId}/timeline`（regional routing: americas / asia / europe）

- `info.frames[]` … 約 60,000ms（1分）ごとのフレーム
  - `participantFrames["1".."10"].position {x, y}` … 各プレイヤー位置（＋level/gold/cs等）
  - `events[]` … `timestamp`(ms) 付き。`CHAMPION_KILL`(position付), `BUILDING_KILL`,
    `ELITE_MONSTER_KILL`(DRAGON/BARON/RIFTHERALD), `WARD_PLACED`, `ITEM_PURCHASED` など
- 粒度は **1分**。中間は直線補間で“推測”表示は可能だが正確ではない。

### 試合の特定（入力 → matchId）
1. **Account-V1**: `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` → `puuid`
2. **Match-V5**: `GET /lol/match/v5/matches/by-puuid/{puuid}/ids?count=N` → matchId 一覧
3. **Match-V5**: `GET /lol/match/v5/matches/{matchId}` → 各参加者の `championId`（アイコン用）, `teamId`, `puuid`
4. **Match-V5 timeline**: 上記

---

## 2. 座標変換（SR）

hextechdocs 確認値。SR の範囲:

```
min { x: -120,  y: -120 }
max { x: 14870, y: 14980 }
```

ゲーム座標 → マップ画像ピクセル（既存 MAP_SIZE = 1024）:

```ts
const MIN_X = -120, MAX_X = 14870;
const MIN_Y = -120, MAX_Y = 14980;

function gameToImage(gx: number, gy: number, MAP = 1024) {
  const ix = ((gx - MIN_X) / (MAX_X - MIN_X)) * MAP;
  // game の Y は上方向、画像は下方向なので反転
  const iy = MAP - ((gy - MIN_Y) / (MAX_Y - MIN_Y)) * MAP;
  return { x: ix, y: iy };
}
```

※ PoC で実際の試合と見比べて微調整（数百単位のオフセット差が出ることがある）。

---

## 3. 制約・リスク

| 項目 | 内容 / 対策 |
|---|---|
| **CORS不可・キー秘匿** | Riot API はブラウザ直叩き不可。**Next.js API ルート（Vercel関数）をプロキシ**にし、キーは env のみ。 |
| **APIキーの種類** | Development=**24h失効**（PoC用）。常用は **Personal API Key（申請制・失効なし・無料/非商用）**。キーは env 差し替えのみでコード不変。 |
| **粒度1分** | 滑らかな動きは無い。スライダーはフレーム単位＋任意で補間。 |
| **対象試合** | タイムラインがある試合のみ（通常/ランク等）。古い試合は欠落あり。 |
| **レート制限** | dev: 20req/s, 100req/2min。個人利用は十分。同じ試合は**キャッシュ**して再取得しない。 |
| **規約** | 非商用・レート遵守・Riot 表記。個人/学習用途の範囲で運用。 |

---

## 4. 設計（案）

```
[ブラウザ] RiotID + 地域 or matchId を入力
   │
   ▼
[Next.js API ルート /api/replay]   ← RIOT_API_KEY (env, サーバ秘匿)
   │  Account-V1 / Match-V5 (match + timeline) を取得
   │  整形 → frames[ minute → { participants:[{championId,team,imgX,imgY}], events:[...] } ]
   ▼
[ブラウザ] 既存 Konva マップに描画
   - 時間スライダー（0〜試合終了分）／再生・一時停止
   - 選択分の10チャンピオンを配置（既存トークン描画を流用、チーム色）
   - イベント（キル/ドラゴン等）をマーカー表示
```

プランナーの新モード「リプレイ / 試合インポート」として追加するのが自然。
取り込んだ配置を編集・メモできるようにすると学習用途に効く。

---

## 5. PoC（“使えるか”最小判定）

1. dev API キーを env (`RIOT_API_KEY`) に置く（取得が必要）
2. `/api/replay?matchId=...&region=...` を1本作り、「分ごとの10座標」だけ返す
3. 簡易ページ: スライダー＋マップに10点描画
4. **判定基準**: 序盤レーンに居る／ロームやガンクの動きが読み取れる／座標変換が正しい

OK なら本実装へ。

---

## 6. 実装フェーズ（PoC通過後）

1. 入力UI（RiotID＋地域 or matchID）＋地域ルーティング
2. プロキシ堅牢化（試合キャッシュ／レート制御／エラー処理）
3. 再生UI（再生/一時停止、分表示、イベントマーカー、チーム色）
4. プランナー統合（インポート配置を編集・注釈）
5. キー運用（Personal API Key 申請 → env 差し替え）

---

## 7. 再開時にまず必要なもの

- **Riot Developer Portal の API キー**（PoC は dev key で可、公開時は Personal key 申請）
- 対象**地域**（例: アジア = `asia` ルーティング / プラットフォーム `jp1`）
- 試したい**試合の RiotID** か matchId

## 参考

- Riot Developer Portal — APIs: https://developer.riotgames.com/apis
- hextechdocs — Map data（座標境界）: https://hextechdocs.dev/map-data/
- RiotWatcher Match-V5 docs: https://riot-watcher.readthedocs.io/en/latest/riotwatcher/LeagueOfLegends/MatchApiV5.html
