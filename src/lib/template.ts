// ノートのタイトルテンプレート。{date}/{time} トークンを今日の日付で置換する。
//   {date}            → YYYY/MM/DD（既定）
//   {date:YY/MM/DD}   → 26/07/04
//   {date:M/D(ddd)}   → 7/4(土)   ※ ddd=曜日1文字, dddd=金曜日
//   {time} / {time:HH:mm}
// 対応トークン: YYYY YY MM M DD D HH H mm ddd dddd

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function formatDate(pattern: string, d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const wk = WEEK[d.getDay()];
  return pattern
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/YY/g, pad(d.getFullYear() % 100))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/M/g, String(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/D/g, String(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/H/g, String(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/dddd/g, `${wk}曜日`)
    .replace(/ddd/g, wk);
}

/** テンプレート文字列を today の日付で描画する（トークン外の文字はそのまま） */
export function renderTitleTemplate(tpl: string, now: Date = new Date()): string {
  return tpl
    .replace(/\{date(?::([^}]*))?\}/g, (_m, f) => formatDate(f || "YYYY/MM/DD", now))
    .replace(/\{time(?::([^}]*))?\}/g, (_m, f) => formatDate(f || "HH:mm", now))
    .trim();
}
