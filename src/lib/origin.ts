/** 公開オリジン(プロトコル+ホスト)。APP_ORIGIN が設定されていれば
 *  ヘッダを信用せずそれを使う（OAuthのissuer/audienceのなりすまし防止）。 */
export function getOrigin(req: Request): string {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
