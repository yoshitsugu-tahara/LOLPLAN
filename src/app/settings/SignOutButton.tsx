"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5 hover:text-white"
    >
      ログアウト
    </button>
  );
}
