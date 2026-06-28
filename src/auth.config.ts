import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

// edge(middleware)でも読み込める軽い設定。DBやアダプタはここに入れない。
export const authConfig = {
  providers: [Google],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // Vercel等のプロキシ越しで x-forwarded-proto(https) を信頼し、
  // callback URL を https で組み立てさせる（redirect_uri_mismatch 対策）
  trustHost: true,
  callbacks: {
    // middleware から呼ばれる。ログイン済みかどうかでアクセス可否を決める。
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
