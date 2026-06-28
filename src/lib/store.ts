"use client";

import useSWR, { mutate } from "swr";

import { listNotes } from "@/server/actions/notes";
import { listPlans } from "@/server/actions/plans";
import { listSections } from "@/server/actions/sections";
import { getMap } from "@/server/actions/maps";
import type { Note, Section, PlanMeta, MapBoard } from "./types";

export const KEY = {
  notes: "notes",
  sections: "sections",
  plans: "plans",
  map: (id: string) => ["map", id] as const,
};

export function useNotes() {
  return useSWR<Note[]>(KEY.notes, () => listNotes());
}

export function useSections() {
  return useSWR<Section[]>(KEY.sections, () => listSections());
}

export function usePlans() {
  return useSWR<PlanMeta[]>(KEY.plans, () => listPlans());
}

export function useMap(id: string | null) {
  return useSWR<MapBoard | null>(id ? KEY.map(id) : null, () =>
    getMap(id as string),
  );
}

export const reloadNotes = () => mutate(KEY.notes);
export const reloadSections = () => mutate(KEY.sections);
export const reloadPlans = () => mutate(KEY.plans);
export const reloadMap = (id: string) => mutate(KEY.map(id));

/** notes 一覧キャッシュを部分更新（再フェッチなし）。本文の自動保存などに使う。 */
export function patchNoteCache(id: string, patch: Partial<Note>) {
  mutate(
    KEY.notes,
    (cur?: Note[]) =>
      cur?.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    false,
  );
}
