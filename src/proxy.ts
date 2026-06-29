import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

// edge で動く軽い認証チェック（Next 16 の proxy 規約）。未ログインは /login へ。
export const { auth: withAuth } = NextAuth(authConfig);

export default withAuth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isOnLogin = nextUrl.pathname.startsWith("/login");

  if (isOnLogin) {
    if (isLoggedIn)
      return Response.redirect(new URL("/", nextUrl));
    return; // 未ログインはログイン画面を表示
  }

  if (!isLoggedIn) {
    const url = new URL("/login", nextUrl);
    return Response.redirect(url);
  }
});

export const config = {
  // 認証API・MCP・OAuth・静的ファイル・画像以外を保護。
  // (.well-known はドットを含むため既存の `.*\.` 除外で対象外)
  matcher: [
    "/((?!api/auth|api/mcp|oauth|_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
};
