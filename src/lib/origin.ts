/** リクエストから公開オリジン(プロトコル+ホスト)を組み立てる。Vercelのプロキシ対応。 */
export function getOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
