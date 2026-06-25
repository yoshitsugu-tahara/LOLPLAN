"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

/** マップ注釈ブロックを開くようAppShellへ依頼するイベント名 */
export const OPEN_MAP_EVENT = "lolnote:open-map";

export function openMap(mapId: string) {
  window.dispatchEvent(
    new CustomEvent(OPEN_MAP_EVENT, { detail: { mapId } }),
  );
}

export const MapBlock = createReactBlockSpec(
  {
    type: "map",
    propSchema: {
      mapId: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block }) => {
      const mapId = block.props.mapId;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const map = useLiveQuery(
        () => (mapId ? db.maps.get(mapId) : undefined),
        [mapId],
      );

      return (
        <div className="my-1 w-full" data-content-type="map">
          <button
            onClick={() => mapId && openMap(mapId)}
            className="group relative block w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-left transition hover:border-blue-400"
          >
            {map?.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={map.preview}
                alt="マップ注釈"
                className="max-h-[420px] w-full object-contain"
              />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-1 text-zinc-400">
                <span className="text-2xl">🗺️</span>
                <span className="text-sm">クリックしてマップに書き込む</span>
              </div>
            )}
            <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100">
              ✏️ 編集
            </span>
          </button>
        </div>
      );
    },
  },
);
