import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { VideoBlock } from "./VideoBlock";
import { MapBlock } from "./MapBlock";

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    // BlockNote 0.51 の createReactBlockSpec は「specを返すファクトリ」を返すため呼び出す
    video: VideoBlock(),
    map: MapBlock(),
  },
});

export type AppEditor = typeof schema.BlockNoteEditor;
