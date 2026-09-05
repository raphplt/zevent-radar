import type { HistoryPoint } from "@zevent-radar/contracts";
import data from "@/data/editions.json";

/** [minutes from the marathon start (Friday 18:00 Paris), cents] */
export type OffsetPoint = [minutes: number, cents: number];

export interface Edition {
  year: number;
  approximate: boolean;
  marathonStart: string;
  openedAt: string;
  endedAt: string;
  finalCents: number;
  points: OffsetPoint[];
}

export type Alignment = "marathon" | "opening";

export const CURRENT_YEAR = 2026;
/** Friday 4 September 2026, 18:00 Paris. */
export const CURRENT_MARATHON_START = "2026-09-04T16:00:00.000Z";
/** Thursday 3 September 2026, 20:00 Paris: the opening concert, when the counter started. */
export const CURRENT_OPENED_AT = "2026-09-03T18:00:00.000Z";
export const PAST_EDITIONS: Edition[] = (data.editions as Edition[]).slice().sort((a, b) => b.year - a.year);
export const EDITIONS_SOURCE = data.source as { name: string; url: string; note: string | null };
export const MILESTONES_CENTS = [1_000_000_00, 2_000_000_00, 5_000_000_00, 10_000_000_00, 15_000_000_00];

const MINUTE = 60_000;
const DAY_LABELS = ["mer.", "jeu.", "ven.", "sam.", "dim.", "lun.", "mar."];
const FRIDAY_INDEX = 2;
const START_HOUR = 18;

export function toOffsetMinutes(ms: number, marathonStartIso: string): number {
  return (ms - Date.parse(marathonStartIso)) / MINUTE;
}

/** Converts a collector series (ms, cents) to offsets from the marathon start. */
export function toOffsetPoints(points: HistoryPoint[], marathonStartIso: string): OffsetPoint[] {
  const start = Date.parse(marathonStartIso);
  return points.map(([ts, cents]) => [(ts - start) / MINUTE, cents]);
}

/** Builds the current edition from the collector's series so it reads like a past one. */
export function currentEdition(points: HistoryPoint[], finalCents: number): Edition {
  const first = points[0];
  const last = points[points.length - 1];
  return {
    year: CURRENT_YEAR,
    approximate: false,
    marathonStart: CURRENT_MARATHON_START,
    openedAt: CURRENT_OPENED_AT,
    endedAt: last ? new Date(last[0]).toISOString() : CURRENT_OPENED_AT,
    finalCents,
    points: first ? toOffsetPoints(points, CURRENT_MARATHON_START) : []
  };
}

export function openingOffset(edition: Edition): number {
  return toOffsetMinutes(Date.parse(edition.openedAt), edition.marathonStart);
}

/** Shifts an edition's points so that x = 0 is the opening of donations instead of the marathon start. */
export function alignPoints(edition: Edition, alignment: Alignment): OffsetPoint[] {
  if (alignment === "marathon") return edition.points;
  const shift = openingOffset(edition);
  return edition.points.map(([m, c]) => [m - shift, c]);
}

/** Converts a marathon offset to the same instant on the other axis. */
export function alignOffset(edition: Edition, offset: number, alignment: Alignment): number {
  return alignment === "marathon" ? offset : offset - openingOffset(edition);
}

export interface Reading {
  cents: number;
  /** The edition had already closed at that stage: `cents` is its final total. */
  ended: boolean;
}

/** Value of a step series at `offset`: the last point at or before it. Null before the first point. */
export function valueAtOffset(points: OffsetPoint[], offset: number): Reading | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || offset < first[0]) return null;
  if (offset >= last[0]) return { cents: last[1], ended: offset > last[0] };
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid]![0] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { cents: points[lo]![1], ended: false };
}

/** First offset at which the series reaches `cents`, or null if it never did. */
export function offsetForAmount(points: OffsetPoint[], cents: number): number | null {
  for (const [m, c] of points) if (c >= cents) return m;
  return null;
}

/** "ven. 18h" for an offset from the marathon start; handles Thursday (negative) and the Monday night. */
export function weekdayLabel(offsetMinutes: number, withMinutes = false): string {
  const total = START_HOUR * 60 + Math.round(offsetMinutes);
  const day = Math.floor(total / 1440);
  const minutesOfDay = total - day * 1440;
  const hours = Math.floor(minutesOfDay / 60);
  const minutes = minutesOfDay % 60;
  const label = DAY_LABELS[FRIDAY_INDEX + day] ?? `J${day > 0 ? "+" : ""}${day}`;
  return withMinutes ? `${label} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` : `${label} ${String(hours).padStart(2, "0")}h`;
}

/** "36 h" or "36 h 20" of elapsed time since the opening of donations. */
export function elapsedLabel(minutes: number, withMinutes = false): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (!withMinutes) return `${hours} h`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

export function axisLabel(offset: number, alignment: Alignment, withMinutes = false): string {
  return alignment === "marathon" ? weekdayLabel(offset, withMinutes) : elapsedLabel(offset, withMinutes);
}

export interface StageComparison {
  edition: Edition;
  reading: Reading | null;
  /** Positive when the current edition is ahead. */
  gapCents: number | null;
  /** Marathon offset at which the edition reached the current total, null if it never did. */
  reachedCurrentAt: number | null;
}

/** Compares every past edition to the current total at the same stage. */
export function compareAtStage(editions: Edition[], current: { offset: number; cents: number }, alignment: Alignment): StageComparison[] {
  const currentShift = alignment === "marathon" ? 0 : toOffsetMinutes(Date.parse(CURRENT_OPENED_AT), CURRENT_MARATHON_START);
  return editions.map((edition) => {
    const offset = alignment === "marathon" ? current.offset : current.offset - currentShift + openingOffset(edition);
    const reading = valueAtOffset(edition.points, offset);
    return {
      edition,
      reading,
      gapCents: reading ? current.cents - reading.cents : null,
      reachedCurrentAt: offsetForAmount(edition.points, current.cents)
    };
  });
}

/** 1-based rank of the current total among editions at the same stage (ties count as ahead). */
export function rankAtStage(comparisons: StageComparison[]): number {
  return 1 + comparisons.filter((c) => c.gapCents !== null && c.gapCents < 0).length;
}

/** Rounded-up axis maximum and tick step so that there are between three and six gridlines. */
export function niceAmountScale(maxCents: number): { max: number; step: number } {
  const candidates = [50_000_000, 100_000_000, 200_000_000, 250_000_000, 500_000_000, 1_000_000_000];
  for (const step of candidates) {
    const ticks = Math.ceil(Math.max(1, maxCents) / step);
    if (ticks <= 6) return { max: ticks * step, step };
  }
  const step = candidates[candidates.length - 1]!;
  return { max: Math.ceil(maxCents / step) * step, step };
}

/** Compact amount for axis ticks: "5 M€", "500 k€". */
export function compactEuros(cents: number): string {
  const euros = cents / 100;
  if (euros >= 1_000_000) return `${(euros / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (euros >= 1_000) return `${Math.round(euros / 1_000).toLocaleString("fr-FR")} k€`;
  return `${Math.round(euros).toLocaleString("fr-FR")} €`;
}
