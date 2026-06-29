import { getOrigin } from "@/lib/origin";
import {
  ACCESS_TTL,
  consumeCode,
  consumeRefreshToken,
  issueRefreshToken,
  mcpResource,
  signAccessToken,
  verifyPkceS256,
} from "@/server/oauth";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const err = (error: string, description?: string, status = 400) =>
  Response.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status, headers: cors },
  );

export async function POST(req: Request) {
  const form = await req.formData();
  const grantType = form.get("grant_type");
  const origin = getOrigin(req);

  if (grantType === "authorization_code") {
    const code = form.get("code")?.toString();
    const redirectUri = form.get("redirect_uri")?.toString();
    const clientId = form.get("client_id")?.toString();
    const codeVerifier = form.get("code_verifier")?.toString();
    if (!code || !redirectUri || !clientId || !codeVerifier) {
      return err("invalid_request", "missing parameters");
    }
    const row = await consumeCode(code);
    if (!row) return err("invalid_grant", "code invalid or expired");
    if (row.clientId !== clientId || row.redirectUri !== redirectUri) {
      return err("invalid_grant", "client/redirect mismatch");
    }
    if (!verifyPkceS256(codeVerifier, row.codeChallenge)) {
      return err("invalid_grant", "PKCE verification failed");
    }
    const resource = row.resource ?? mcpResource(origin);
    const accessToken = await signAccessToken({
      origin,
      userId: row.userId,
      resource,
      scope: row.scope,
    });
    const refreshToken = await issueRefreshToken({
      clientId,
      userId: row.userId,
      resource,
      scope: row.scope,
    });
    return Response.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TTL,
        refresh_token: refreshToken,
        scope: row.scope ?? "lolnote:read",
      },
      { headers: cors },
    );
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token")?.toString();
    const clientId = form.get("client_id")?.toString();
    if (!refreshToken || !clientId) {
      return err("invalid_request", "missing parameters");
    }
    const row = await consumeRefreshToken(refreshToken, clientId);
    if (!row) return err("invalid_grant", "refresh token invalid or expired");
    const resource = row.resource ?? mcpResource(origin);
    const accessToken = await signAccessToken({
      origin,
      userId: row.userId,
      resource,
      scope: row.scope,
    });
    const newRefresh = await issueRefreshToken({
      clientId,
      userId: row.userId,
      resource,
      scope: row.scope,
    });
    return Response.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TTL,
        refresh_token: newRefresh,
        scope: row.scope ?? "lolnote:read",
      },
      { headers: cors },
    );
  }

  return err("unsupported_grant_type");
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
