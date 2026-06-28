import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, isOwner } from "@/auth";
import { listAllowed } from "@/server/actions/allowlist";
import InviteManager from "./InviteManager";
import SignOutButton from "./SignOutButton";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const owner = isOwner(session.user.email);
  const allowed = owner ? await listAllowed() : [];

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto px-6 py-12 text-zinc-100">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-md px-2 py-1 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          ← 戻る
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
      </div>

      {/* アカウント */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">アカウント</h2>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900 p-4">
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-10 w-10 rounded-full"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {session.user.name}
              {owner && (
                <span className="ml-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300">
                  オーナー
                </span>
              )}
            </div>
            <div className="truncate text-xs text-zinc-500">
              {session.user.email}
            </div>
          </div>
          <SignOutButton />
        </div>
      </section>

      {/* 招待（オーナーのみ） */}
      {owner && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-zinc-400">
            招待ユーザー
          </h2>
          <p className="mb-3 text-xs text-zinc-600">
            ここに追加したメールアドレスの Google アカウントだけがログインできます。
          </p>
          <InviteManager initial={allowed} />
        </section>
      )}
    </div>
  );
}
