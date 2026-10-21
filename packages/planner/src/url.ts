import type { Site, Subgoal, Timing, Track } from "./types";

/**
 * Every answer lives in the URL so a result is shareable (§C.1):
 * `/plan?zip=26501&site=open&track=food&size=20&timing=mixed`.
 * This module is the one place that reads and writes those params.
 */

export const SITES: readonly Site[] = ["open", "wet", "poor", "shade"];
export const TRACKS: readonly Track[] = ["food", "agro", "deer"];
export const SUBGOALS: readonly Subgoal[] = ["alley", "silvo", "riparian", "windbreak"];

/** Size chips per track (§C.1). Agro "more than 100" is the consult path, not a size. */
export const SIZES: Record<Track, readonly number[]> = {
  food: [5, 20, 50, 100],
  agro: [50, 100],
  deer: [8, 16, 30],
};

export const TIMINGS: Record<Track, readonly Timing[]> = {
  food: ["fast", "patient", "mixed"],
  agro: ["fast", "patient", "mixed"],
  deer: ["early", "late", "all", "year"],
};

export function defaultTiming(track: Track): Timing {
  return track === "deer" ? "all" : "mixed";
}

export interface PlanAnswers {
  zip?: string;
  /** Two-letter state, only when the ZIP was unknown and the customer picked one. */
  state?: string;
  site?: Site;
  track?: Track;
  subgoal?: Subgoal;
  size?: number;
  timing?: Timing;
}

type ParamSource = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function read(source: ParamSource, name: string): string | null {
  if (typeof (source as { get?: unknown }).get === "function") {
    return (source as { get(name: string): string | null }).get(name);
  }
  const v = (source as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value != null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Parse and validate the quiz answers from a URL; anything invalid is dropped. */
export function parsePlanParams(source: ParamSource): PlanAnswers {
  const answers: PlanAnswers = {};
  const zip = (read(source, "zip") ?? "").trim();
  if (/^\d{5}$/.test(zip)) answers.zip = zip;
  const state = (read(source, "state") ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(state)) answers.state = state;
  const site = oneOf(read(source, "site"), SITES);
  if (site) answers.site = site;
  const track = oneOf(read(source, "track"), TRACKS);
  if (track) answers.track = track;
  const subgoal = oneOf(read(source, "subgoal"), SUBGOALS);
  if (subgoal && track === "agro") answers.subgoal = subgoal;
  const size = Number(read(source, "size"));
  if (Number.isInteger(size) && size > 0 && size <= 1000) answers.size = size;
  const timing = oneOf(read(source, "timing"), track ? TIMINGS[track] : []);
  if (timing) answers.timing = timing;
  return answers;
}

/** Serialise answers back to a query string, in a stable key order. */
export function planParamsToSearch(answers: PlanAnswers): string {
  const params = new URLSearchParams();
  if (answers.zip) params.set("zip", answers.zip);
  if (answers.state) params.set("state", answers.state);
  if (answers.site) params.set("site", answers.site);
  if (answers.track) params.set("track", answers.track);
  if (answers.subgoal && answers.track === "agro") params.set("subgoal", answers.subgoal);
  if (answers.size != null) params.set("size", String(answers.size));
  if (answers.timing) params.set("timing", answers.timing);
  return params.toString();
}

/** All four questions answered (plus the sub-goal on the agro track). */
export function answersComplete(a: PlanAnswers): boolean {
  if (!(a.zip || a.state) || !a.site || !a.track || a.size == null) return false;
  if (a.track === "agro" && !a.subgoal) return false;
  return true;
}
