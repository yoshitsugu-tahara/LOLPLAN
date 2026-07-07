"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          type="email"
          placeholder="invite@example.com"
          className="h-9 flex-1"
        />
        <Button onClick={add} disabled={pending} className="h-9">
          招待
        </Button>
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
            <Button
              variant="ghost"
              size="xs"
              onClick={() => remove(r.email)}
              disabled={pending}
              className="shrink-0 text-zinc-500 hover:text-red-400"
            >
              削除
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
