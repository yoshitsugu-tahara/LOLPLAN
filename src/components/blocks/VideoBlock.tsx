"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";

/** YouTube / Twitch のURLを埋め込み用URLに変換する */
function toEmbedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parent =
    typeof window !== "undefined" ? window.location.hostname : "localhost";

  // YouTube
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname.startsWith("/embed/")) return raw;
    if (u.pathname.startsWith("/shorts/")) {
      return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    }
    const id = u.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  // Twitch
  if (host === "twitch.tv") {
    const vid = u.pathname.match(/\/videos\/(\d+)/);
    if (vid) {
      return `https://player.twitch.tv/?video=${vid[1]}&parent=${parent}&autoplay=false`;
    }
    const clip = u.pathname.match(/\/clip\/([^/]+)/);
    if (clip) {
      return `https://clips.twitch.tv/embed?clip=${clip[1]}&parent=${parent}&autoplay=false`;
    }
    const channel = u.pathname.split("/")[1];
    if (channel) {
      return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=false`;
    }
  }
  if (host === "clips.twitch.tv") {
    const slug = u.pathname.slice(1);
    if (slug) {
      return `https://clips.twitch.tv/embed?clip=${slug}&parent=${parent}&autoplay=false`;
    }
  }

  return null;
}

export const VideoBlock = createReactBlockSpec(
  {
    type: "video",
    propSchema: {
      url: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const url = block.props.url;
      const embed = url ? toEmbedUrl(url) : null;

      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [draft, setDraft] = useState("");

      if (embed) {
        return (
          <div className="my-1 w-full" data-content-type="video">
            <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
              <iframe
                src={embed}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {editor.isEditable && (
              <button
                className="mt-1 text-xs text-zinc-400 hover:text-zinc-200"
                onClick={() =>
                  editor.updateBlock(block, {
                    type: "video",
                    props: { url: "" },
                  })
                }
              >
                URLを変更
              </button>
            )}
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

      const submit = () => {
        const ok = toEmbedUrl(draft);
        if (ok) {
          editor.updateBlock(block, { type: "video", props: { url: draft } });
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
