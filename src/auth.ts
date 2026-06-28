import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "./auth.config";
import { db } from "./server/db";
import {
  accounts,
  allowedEmails,
  sessions,
  users,
  verificationTokens,
} from "./server/db/schema";

/** このメールはログインを許可されているか（オーナー or 招待済み） */
export async function isAllowed(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const e = email.toLowerCase();
  if (e === process.env.OWNER_EMAIL?.toLowerCase()) return true;
  const row = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, e))
    .limit(1);
  return row.length > 0;
}

// 開発時のみ：OWNER_EMAIL のユーザーとして即ログインする検証用プロバイダ。
// 本番ビルド(NODE_ENV=production)では providers に追加されないので存在しない。
const devProviders =
  process.env.NODE_ENV === "development"
    ? [
        Credentials({
          id: "dev",
          name: "Dev login",
          credentials: {},
          async authorize() {
            const email = process.env.OWNER_EMAIL?.toLowerCase();
            if (!email) return null;
            const rows = await db
              .select()
              .from(users)
              .where(eq(users.email, email))
              .limit(1);
            return rows[0] ?? null;
          },
        }),
      ]
    : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, ...devProviders],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    ...authConfig.callbacks,
    // 許可リストにないメールはログインさせない（招待制）
    async signIn({ user }) {
      return isAllowed(user.email);
    },
  },
});

/** このメールはオーナー（＝allowlist を管理できる）か */
export function isOwner(email?: string | null): boolean {
  return (
    !!email && email.toLowerCase() === process.env.OWNER_EMAIL?.toLowerCase()
  );
}
