import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { VideoBlock } from "./VideoBlock";
import { MapBlock } from "./MapBlock";

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    video: VideoBlock,
    map: MapBlock,
  },
});

export type AppEditor = typeof schema.BlockNoteEditor;
