import { auth } from "@/auth";
import { getOrigin } from "@/lib/origin";
import { getClient, mcpResource, saveCode } from "@/server/oauth";

function errorPage(message: string, status = 400) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#09090b;color:#e4e4e7;padding:40px"><h2>認可エラー</h2><p>${message}</p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;
  const origin = getOrigin(req);

  const responseType = p.get("response_type");
  const clientId = p.get("client_id");
  const redirectUri = p.get("redirect_uri");
  const codeChallenge = p.get("code_challenge");
  const codeChallengeMethod = p.get("code_challenge_method");
  const state = p.get("state");
  const scope = p.get("scope");
  const resource = p.get("resource");

  // クライアント/redirect_uri を先に検証（不正なら絶対にリダイレクトしない）
  if (!clientId) return errorPage("client_id がありません");
  const client = await getClient(clientId);
  if (!client) return errorPage("不明な client_id です");
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return errorPage("redirect_uri が登録と一致しません");
  }

  // ここから先のエラーは redirect_uri にエラーを返す
  const back = (params: Record<string, string>) => {
    const u = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    if (state) u.searchParams.set("state", state);
    return Response.redirect(u.toString(), 302);
  };

  if (responseType !== "code") return back({ error: "unsupported_response_type" });
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return back({ error: "invalid_request", error_description: "PKCE S256 required" });
  }

  // ログイン必須（既存のGoogleログインを流用）。未ログインなら戻り先付きで /login へ。
  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL(`${origin}/login`);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  const code = await saveCode({
    clientId,
    userId: session.user.id,
    redirectUri,
    codeChallenge,
    resource: resource ?? mcpResource(origin),
    scope: scope ?? "lolnote:read",
  });

  return back({ code });
}
