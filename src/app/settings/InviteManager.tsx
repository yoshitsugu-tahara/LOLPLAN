"use client";

import { useState, useTransition } from "react";

import { addAllowed, removeAllowed } from "@/server/actions/allowlist";

type Row = { email: string; invitedBy: string | null; createdAt: number };

export default function InviteManager({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () => {
    setError(null);
    const value = email.trim().toLowerCase();
    if (!value) return;
    start(async () => {
      const res = await addAllowed(value);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows((r) =>
        r.some((x) => x.email === value)
          ? r
          : [...r, { email: value, invitedBy: null, createdAt: Date.now() }],
      );
      setEmail("");
    });
  };

  const remove = (target: string) => {
    start(async () => {
      await removeAllowed(target);
      setRows((r) => r.filter((x) => x.email !== target));
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          type="email"
          placeholder="invite@example.com"
          className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400"
        />
        <button
          onClick={add}
          disabled={pending}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-50"
        >
          招待
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <ul className="mt-4 divide-y divide-white/5">
        {rows.length === 0 && (
          <li className="py-3 text-center text-xs text-zinc-600">
            まだ招待したユーザーはいません
          </li>
        )}
        {rows.map((r) => (
          <li
            key={r.email}
            className="flex items-center justify-between py-2.5 text-sm"
          >
            <span className="truncate text-zinc-200">{r.email}</span>
            <button
              onClick={() => remove(r.email)}
              disabled={pending}
              className="shrink-0 text-xs text-zinc-500 transition hover:text-red-400 disabled:opacity-50"
            >
              削除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
