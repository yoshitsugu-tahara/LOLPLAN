"use client";

import { useState } from "react";

import { reloadSections } from "@/lib/store";
import { renderTitleTemplate } from "@/lib/template";
import { setSectionTemplate } from "@/server/actions/sections";

const PRESETS = [
  { label: "26/07/04", tpl: "{date:YY/MM/DD}" },
  { label: "2026/7/4(土)", tpl: "{date:YYYY/M/D(ddd)}" },
  { label: "7/4 日記", tpl: "{date:M/D} 日記" },
  { label: "2026-07-04", tpl: "{date:YYYY-MM-DD}" },
];

export default function TemplateModal({
  sectionId,
  sectionName,
  initial,
  onClose,
}: {
  sectionId: string;
  sectionName: string;
  initial: string;
  onClose: () => void;
}) {
  const [tpl, setTpl] = useState(initial);

  const save = async (value: string) => {
    await setSectionTemplate(sectionId, value);
    reloadSections();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-semibold text-zinc-200">
          「{sectionName}」の新規ノートのタイトル
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          このセクションで＋から作るノートのタイトルに使われます。
        </p>

        <input
          autoFocus
          value={tpl}
          onChange={(e) => setTpl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save(tpl);
            if (e.key === "Escape") onClose();
          }}
          placeholder="例: {date:YY/MM/DD}"
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400"
        />

        {/* プレビュー */}
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-xs text-zinc-500">プレビュー:</span>
          <span className="rounded bg-white/5 px-2 py-0.5 font-medium text-sky-300">
            {tpl ? renderTitleTemplate(tpl) || "（空）" : "（テンプレートなし）"}
          </span>
        </div>

        {/* プリセット */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.tpl}
              onClick={() => setTpl(p.tpl)}
              className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-sky-400/50 hover:text-white"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* トークン説明 */}
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[11px] leading-relaxed text-zinc-500">
          <code className="text-zinc-300">{"{date}"}</code>=今日(YYYY/MM/DD)、
          <code className="text-zinc-300">{"{date:YY/MM/DD}"}</code>、
          <code className="text-zinc-300">{"{time}"}</code>=時刻。
          書式: YYYY/YY(年) M/MM(月) D/DD(日) H/HH(時) mm(分) ddd(曜)
          dddd(◯曜日)。トークン以外の文字はそのまま入ります。
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => save("")}
            className="text-xs text-zinc-500 transition hover:text-red-400"
          >
            テンプレートを削除
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5"
            >
              取消
            </button>
            <button
              onClick={() => save(tpl)}
              className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-400"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
