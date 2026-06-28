"use client";

import useSWR, { mutate } from "swr";

import { listNotes } from "@/server/actions/notes";
import { listPlans } from "@/server/actions/plans";
import { listSections } from "@/server/actions/sections";
import { getMap } from "@/server/actions/maps";
import { listFavoriteChampions } from "@/server/actions/favorites";
import {
  listFocuses,
  listGames,
  mistakeStats,
} from "@/server/actions/training";
import type { Note, Section, PlanMeta, MapBoard, Focus, Game } from "./types";

export const KEY = {
  notes: "notes",
  sections: "sections",
  plans: "plans",
  map: (id: string) => ["map", id] as const,
  focuses: "focuses",
  games: "games",
  mistakeStats: "mistakeStats",
  favChampions: "favChampions",
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

export function useFocuses() {
  return useSWR<Focus[]>(KEY.focuses, () => listFocuses());
}
export function useGames() {
  return useSWR<Game[]>(KEY.games, () => listGames());
}
export function useMistakeStats() {
  return useSWR<{ tag: string; count: number }[]>(KEY.mistakeStats, () =>
    mistakeStats(),
  );
}
export function useFavoriteChampions() {
  return useSWR<string[]>(KEY.favChampions, () => listFavoriteChampions());
}
export const reloadFavoriteChampions = () => mutate(KEY.favChampions);

export const reloadFocuses = () => mutate(KEY.focuses);
export const reloadGames = () => {
  mutate(KEY.games);
  mutate(KEY.mistakeStats);
};

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

/** notes 一覧を楽観的に書き換える（再フェッチなし）。作成/移動/削除の即時反映に使う。 */
export function patchNotes(updater: (cur: Note[]) => Note[]) {
  mutate(KEY.notes, (cur?: Note[]) => updater(cur ?? []), false);
}
