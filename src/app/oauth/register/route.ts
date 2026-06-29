import { createClient } from "@/server/oauth";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// 動的クライアント登録 (RFC 7591)。PKCE前提の public client として登録。
export async function POST(req: Request) {
  let body: {
    redirect_uris?: string[];
    client_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "invalid JSON" },
      { status: 400, headers: cors },
    );
  }

  const redirectUris = body.redirect_uris ?? [];
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: "redirect_uris is required",
      },
      { status: 400, headers: cors },
    );
  }
  // https か localhost のみ許可
  for (const uri of redirectUris) {
    try {
      const u = new URL(uri);
      const ok =
        u.protocol === "https:" ||
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1";
      if (!ok) throw new Error("bad");
    } catch {
      return Response.json(
        {
          error: "invalid_redirect_uri",
          error_description: `invalid redirect_uri: ${uri}`,
        },
        { status: 400, headers: cors },
      );
    }
  }

  const clientId = await createClient(body.client_name, redirectUris);

  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: body.client_name ?? "MCP Client",
    },
    { status: 201, headers: cors },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
