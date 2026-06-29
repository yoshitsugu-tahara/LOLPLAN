import { createHash, randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";

import { db } from "@/server/db";
import { oauthClients, oauthCodes, oauthRefreshTokens } from "@/server/db/schema";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

export const ACCESS_TTL = 60 * 60; // 1h
const CODE_TTL = 10 * 60 * 1000; // 10m (ms)
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000; // 30d (ms)

const b64url = (b: Buffer) =>
  b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** MCPサーバの canonical URI（トークンの audience） */
export const mcpResource = (origin: string) => `${origin}/api/mcp`;

// ───────── アクセストークン（署名JWT・ステートレス） ─────────

export async function signAccessToken(args: {
  origin: string;
  userId: string;
  resource: string;
  scope?: string | null;
}): Promise<string> {
  return new SignJWT({ scope: args.scope ?? "" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.userId)
    .setIssuer(args.origin)
    .setAudience(args.resource)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(secret());
}

/** 検証してuserIdを返す。audienceがこのMCPサーバ向けでなければ null。 */
export async function verifyAccessToken(
  token: string,
  expectedAudience: string,
): Promise<{ userId: string; scope: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      audience: expectedAudience,
    });
    if (!payload.sub) return null;
    return { userId: payload.sub, scope: (payload.scope as string) ?? "" };
  } catch {
    return null;
  }
}

// ───────── PKCE ─────────

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  const computed = b64url(createHash("sha256").update(verifier).digest());
  return computed === challenge;
}

// ───────── クライアント（DCR） ─────────

export async function createClient(
  name: string | undefined,
  redirectUris: string[],
): Promise<string> {
  const id = `mcp_${b64url(randomBytes(18))}`;
  await db.insert(oauthClients).values({
    id,
    name: name ?? null,
    redirectUris,
    createdAt: Date.now(),
  });
  return id;
}

export async function getClient(id: string) {
  const rows = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ───────── 認可コード ─────────

export async function saveCode(args: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  resource?: string | null;
  scope?: string | null;
}): Promise<string> {
  const code = b64url(randomBytes(32));
  await db.insert(oauthCodes).values({
    code,
    clientId: args.clientId,
    userId: args.userId,
    redirectUri: args.redirectUri,
    codeChallenge: args.codeChallenge,
    resource: args.resource ?? null,
    scope: args.scope ?? null,
    expiresAt: Date.now() + CODE_TTL,
  });
  return code;
}

/** コードを単回消費。期限切れ/不正は null。 */
export async function consumeCode(code: string) {
  const rows = await db
    .select()
    .from(oauthCodes)
    .where(eq(oauthCodes.code, code))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db.delete(oauthCodes).where(eq(oauthCodes.code, code));
  if (row.expiresAt < Date.now()) return null;
  return row;
}

// ───────── リフレッシュトークン（回転式） ─────────

export async function issueRefreshToken(args: {
  clientId: string;
  userId: string;
  resource?: string | null;
  scope?: string | null;
}): Promise<string> {
  const token = b64url(randomBytes(32));
  await db.insert(oauthRefreshTokens).values({
    token,
    clientId: args.clientId,
    userId: args.userId,
    resource: args.resource ?? null,
    scope: args.scope ?? null,
    expiresAt: Date.now() + REFRESH_TTL,
  });
  return token;
}

/** リフレッシュトークンを検証して消費（回転のため削除）。 */
export async function consumeRefreshToken(token: string, clientId: string) {
  const rows = await db
    .select()
    .from(oauthRefreshTokens)
    .where(
      and(
        eq(oauthRefreshTokens.token, token),
        eq(oauthRefreshTokens.clientId, clientId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db
    .delete(oauthRefreshTokens)
    .where(eq(oauthRefreshTokens.token, token));
  if (row.expiresAt < Date.now()) return null;
  return row;
}
