import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, isOwner } from "@/auth";
import { listAllowed } from "@/server/actions/allowlist";
import { getSetting } from "@/server/actions/settings";
import CoachUrlField from "./CoachUrlField";
import DisplayNameField from "./DisplayNameField";
import InviteManager from "./InviteManager";
import RiotIdField from "./RiotIdField";
import SignOutButton from "./SignOutButton";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const owner = isOwner(session.user.email);
  const allowed = owner ? await listAllowed() : [];
  const coachUrl = await getSetting("coachUrl");
  const riotId = await getSetting("riotId");

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
            <DisplayNameField initial={session.user.name} isOwner={owner} />
            <div className="truncate text-xs text-zinc-500">
              {session.user.email}
            </div>
          </div>
          <SignOutButton />
        </div>
      </section>

      {/* コーチ */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-semibold text-zinc-400">
          AIコーチ
        </h2>
        <p className="mb-3 text-xs text-zinc-600">
          「コーチと話す」で開くURL（Claudeのプロジェクト等）。
        </p>
        <CoachUrlField initial={coachUrl} />
      </section>

      {/* Riot 連携 */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-semibold text-zinc-400">Riot ID</h2>
        <p className="mb-3 text-xs text-zinc-600">
          試合リプレイで自分の試合を取得するのに使います。
        </p>
        <RiotIdField initial={riotId} />
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
