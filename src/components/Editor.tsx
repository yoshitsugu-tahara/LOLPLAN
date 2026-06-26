"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { filterSuggestionItems } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
  type DefaultReactSuggestionItem,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { nanoid } from "nanoid";
import { useEffect, useRef } from "react";

import { db, type Note } from "@/lib/db";
import { schema, type AppEditor } from "./blocks/schema";
import { toEmbedUrl } from "./blocks/video-url";

function mediaItems(editor: AppEditor): DefaultReactSuggestionItem[] {
  return [
    {
      title: "マップ注釈",
      subtext: "画像にペン・記号で書き込む",
      group: "メディア",
      icon: <span>🗺️</span>,
      onItemClick: async () => {
        const mapId = nanoid();
        await db.maps.add({
          id: mapId,
          snapshot: null,
          preview: null,
          updatedAt: Date.now(),
        });
        editor.insertBlocks(
          [{ type: "map", props: { mapId } }],
          editor.getTextCursorPosition().block,
          "after",
        );
      },
    },
    {
      title: "動画",
      subtext: "YouTube / Twitch を埋め込む",
      group: "メディア",
      icon: <span>🎬</span>,
      onItemClick: () => {
        editor.insertBlocks(
          [{ type: "video" }],
          editor.getTextCursorPosition().block,
          "after",
        );
      },
    },
  ];
}

export default function Editor({ note }: { note: Note }) {
  const editor = useCreateBlockNote({
    schema,
    initialContent:
      Array.isArray(note.content) && note.content.length
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (note.content as any)
        : undefined,
    // YouTube / Twitch のURLを貼ったら「埋め込む？」を選ばせる動画ブロックにする
    pasteHandler: ({ event, editor: ed, defaultPasteHandler }) => {
      const text = event.clipboardData?.getData("text/plain")?.trim();
      if (text && !/\s/.test(text) && toEmbedUrl(text)) {
        const current = ed.getTextCursorPosition().block;
        const blockDef = {
          type: "video" as const,
          props: { url: text, mode: "ask" as const },
        };
        const isEmpty =
          Array.isArray(current.content) && current.content.length === 0;
        if (isEmpty) {
          ed.replaceBlocks([current], [blockDef]);
        } else {
          ed.insertBlocks([blockDef], current, "after");
        }
        return true;
      }
      return defaultPasteHandler();
    },
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleChange = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      db.notes.update(note.id, {
        content: editor.document,
        updatedAt: Date.now(),
      });
    }, 400);
  };

  return (
    <BlockNoteView
      editor={editor}
      theme="dark"
      slashMenu={false}
      onChange={handleChange}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            [...getDefaultReactSlashMenuItems(editor), ...mediaItems(editor)],
            query,
          )
        }
      />
    </BlockNoteView>
  );
}
