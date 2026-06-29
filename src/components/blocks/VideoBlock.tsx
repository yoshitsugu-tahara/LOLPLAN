"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useState } from "react";

import { toEmbedUrl, youtubeId, youtubeThumb } from "./video-url";

export const VideoBlock = createReactBlockSpec(
  {
    type: "video",
    propSchema: {
      url: { default: "" },
      // "ask" = 埋め込むかリンクのままか選ばせる / "embed" = 埋め込み表示
      mode: { default: "embed", values: ["ask", "embed"] as const },
      // 折りたたみ状態（デフォルトは展開）
      collapsed: { default: false },
      // シンプル表示（コントロールバー非表示。デフォルトは通常表示）
      simple: { default: false },
      // 折りたたみバーの表示名（空なら動画タイトル→URLの順でフォールバック）
      label: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const url = block.props.url;
      const mode = block.props.mode;
      const embed = url ? toEmbedUrl(url, block.props.simple) : null;
      const ytId = youtubeId(url);

      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [draft, setDraft] = useState("");
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [playing, setPlaying] = useState(false);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [title, setTitle] = useState("");
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [editing, setEditing] = useState(false);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [labelDraft, setLabelDraft] = useState("");

      const label = block.props.label;
      // カスタム名が無いYouTube動画は、折りたたみ表示用にタイトルを取得
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useEffect(() => {
        if (!ytId || label) {
          setTitle("");
          return;
        }
        let cancelled = false;
        fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (!cancelled && j?.title) setTitle(j.title as string);
          })
          .catch(() => {});
        return () => {
          cancelled = true;
        };
      }, [ytId, label]);

      // 1) ペースト直後：埋め込むかリンクのままか選ぶ
      if (mode === "ask" && url) {
        const keepAsLink = () => {
          editor.replaceBlocks(
            [block],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [
              {
                type: "paragraph",
                content: [{ type: "link", href: url, content: url }],
              },
            ] as any,
          );
        };
        return (
          <div
            className="my-1 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2"
            data-content-type="video"
          >
            <span className="text-base">🎬</span>
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-400">
              {url}
            </span>
            <button
              onClick={() =>
                editor.updateBlock(block, {
                  type: "video",
                  props: { url, mode: "embed" },
                })
              }
              className="rounded bg-sky-500 px-3 py-1 text-sm font-medium text-white hover:bg-sky-400"
            >
              埋め込む
            </button>
            <button
              onClick={keepAsLink}
              className="rounded px-3 py-1 text-sm text-zinc-300 hover:bg-white/10"
            >
              リンクのまま
            </button>
          </div>
        );
      }

      // 2) 埋め込み表示
      if (embed) {
        const collapsed = block.props.collapsed;
        const toggleCollapsed = () =>
          editor.updateBlock(block, {
            type: "video",
            props: { ...block.props, collapsed: !collapsed },
          });

        // 折りたたみ時：細いバーだけ表示（クリックで展開・右クリックで名前編集）
        if (collapsed) {
          const display = label || title || url;
          const saveLabel = () => {
            editor.updateBlock(block, {
              type: "video",
              props: { ...block.props, label: labelDraft.trim() },
            });
            setEditing(false);
          };
          return (
            <div className="my-1 w-full" data-content-type="video">
              {editing ? (
                <div className="flex w-full items-center gap-2 rounded-lg border border-sky-400/50 bg-white/5 px-3 py-2">
                  <span className="shrink-0">🎬</span>
                  <input
                    autoFocus
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    onBlur={saveLabel}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveLabel();
                      } else if (e.key === "Escape") {
                        setEditing(false);
                      }
                    }}
                    placeholder="動画名（空でタイトルに戻る）"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </div>
              ) : (
                <button
                  onClick={toggleCollapsed}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLabelDraft(label || title || "");
                    setEditing(true);
                  }}
                  title="クリックで展開 / 右クリックで名前を編集"
                  className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-white/10"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  <span className="shrink-0">🎬</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-300">
                    {display}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-600">展開</span>
                </button>
              )}
            </div>
          );
        }

        const simple = block.props.simple;
        const toggleSimple = () =>
          editor.updateBlock(block, {
            type: "video",
            props: { ...block.props, simple: !simple },
          });

        return (
          <div className="group my-1 w-full" data-content-type="video">
            <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
              {/* 右上のコントロール（ホバーで表示） */}
              <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSimple();
                  }}
                  title={simple ? "通常表示（バーあり）" : "シンプル表示（バーなし）"}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-white transition ${
                    simple
                      ? "bg-sky-500/80 hover:bg-sky-500"
                      : "bg-black/60 hover:bg-black/80"
                  }`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 6h16M4 12h16M4 18h10" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapsed();
                  }}
                  title="折りたたむ"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-black/80"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                </button>
              </div>
              {ytId && !playing ? (
                // クリックするまではクリーンなサムネ＋再生ボタンだけ表示
                <button
                  onClick={() => setPlaying(true)}
                  className="group absolute inset-0 h-full w-full"
                  title="再生"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={youtubeThumb(ytId)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/25">
                    <span className="flex h-12 w-[68px] items-center justify-center rounded-xl bg-red-600 shadow-lg transition group-hover:bg-red-500">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                </button>
              ) : (
                <iframe
                  src={ytId ? `${embed}&autoplay=1` : embed}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        );
      }

      if (!editor.isEditable) {
        return (
          <div className="my-1 rounded-lg border border-dashed border-white/15 p-4 text-sm text-zinc-500">
            動画が設定されていません
          </div>
        );
      }

      // 3) スラッシュメニューから挿入した直後：URL入力
      const submit = () => {
        const ok = toEmbedUrl(draft);
        if (ok) {
          editor.updateBlock(block, {
            type: "video",
            props: { url: draft, mode: "embed" },
          });
        }
      };

      return (
        <div
          className="my-1 rounded-lg border border-dashed border-white/15 bg-white/5 p-4"
          data-content-type="video"
        >
          <div className="mb-2 text-sm font-medium text-zinc-300">
            🎬 動画を埋め込む（YouTube / Twitch）
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-400"
            />
            <button
              onClick={submit}
              className="rounded bg-sky-500 px-3 py-1 text-sm font-medium text-white hover:bg-sky-400"
            >
              埋め込む
            </button>
          </div>
          {draft && !toEmbedUrl(draft) && (
            <div className="mt-1 text-xs text-red-500">
              対応していないURLです（YouTube / Twitch のみ）
            </div>
          )}
        </div>
      );
    },
  },
);
