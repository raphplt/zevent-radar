import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Builds apps/web/src/data/editions.json: the global total of past editions, one point every five minutes,
 * expressed as minutes from the marathon start (Friday 18:00 Paris) so editions line up on the same axis.
 *
 * Source: the curves compiled by ZEvenTracker (astucesweb.fr/projets/zevent), mirrored as a single JSON by
 * zevent2026.yannctr.fr. Pass a local file path or URL as first argument to use another copy.
 */

const DEFAULT_SOURCE = "https://zevent2026.yannctr.fr/data/historical-editions.json";
const OUTPUT = resolve("apps/web/src/data/editions.json");
const STEP_MINUTES = 5;

/** Official totals announced at the closing of each edition (euros). */
const OFFICIAL_FINAL_EUROS: Record<number, number> = {
  2018: 1_094_731,
  2019: 3_509_878,
  2020: 5_724_377,
  2021: 10_064_480,
  2022: 10_182_126,
  2024: 10_145_881,
  2025: 16_179_096
};

/** Marathon start: Friday 18:00 Paris, in UTC. The concert and early donations of Thursday appear at negative offsets. */
const MARATHON_START: Record<number, string> = {
  2018: "2018-11-09T17:00:00.000Z",
  2019: "2019-09-20T16:00:00.000Z",
  2020: "2020-10-16T16:00:00.000Z",
  2021: "2021-10-29T16:00:00.000Z",
  2022: "2022-09-09T16:00:00.000Z",
  2024: "2024-09-06T16:00:00.000Z",
  2025: "2025-09-05T16:00:00.000Z"
};

interface SourceEdition {
  year: number;
  approximate?: boolean;
  startedAt: number;
  endedAt: number;
  points: Array<[seconds: number, euros: number]>;
}

interface SourceFile {
  source?: { label?: string; url?: string; note?: string };
  editions: SourceEdition[];
}

export interface EditionRecord {
  year: number;
  approximate: boolean;
  marathonStart: string;
  openedAt: string;
  endedAt: string;
  finalCents: number;
  /** [minutes from marathon start, cents] */
  points: Array<[number, number]>;
}

async function load(source: string): Promise<SourceFile> {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`${res.status} ${source}`);
    return (await res.json()) as SourceFile;
  }
  return JSON.parse(await readFile(resolve(source), "utf8")) as SourceFile;
}

/** Keeps the last value of every five-minute bucket, stops once the official total is reached, never goes down. */
export function compact(points: Array<[number, number]>, startMs: number, finalCents: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let bucket: number | null = null;
  let last = -Infinity;
  for (const [seconds, euros] of points) {
    const cents = Math.min(finalCents, Math.round(euros * 100));
    if (cents < last) continue;
    last = cents;
    const offset = Math.round((seconds * 1000 - startMs) / 60_000);
    const key = Math.floor(offset / STEP_MINUTES);
    const point: [number, number] = [offset, cents];
    if (bucket === key && out.length > 0) out[out.length - 1] = point;
    else out.push(point);
    bucket = key;
    if (cents >= finalCents) break;
  }
  return out;
}

async function main() {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  const file = await load(source);
  const editions: EditionRecord[] = [];
  for (const edition of file.editions.sort((a, b) => a.year - b.year)) {
    const finalEuros = OFFICIAL_FINAL_EUROS[edition.year];
    const marathonStart = MARATHON_START[edition.year];
    if (finalEuros === undefined || marathonStart === undefined) {
      console.warn(`skipping ${edition.year}: no official total or marathon start on record`);
      continue;
    }
    const startMs = Date.parse(marathonStart);
    const points = compact(edition.points, startMs, finalEuros * 100);
    editions.push({
      year: edition.year,
      approximate: edition.approximate === true,
      marathonStart,
      openedAt: new Date(edition.startedAt * 1000).toISOString(),
      endedAt: new Date(edition.endedAt * 1000).toISOString(),
      finalCents: finalEuros * 100,
      points
    });
    console.log(`${edition.year}: ${edition.points.length} → ${points.length} points, final ${finalEuros.toLocaleString("fr-FR")} €`);
  }
  const output = {
    source: { name: "ZEvenTracker", url: "https://astucesweb.fr/projets/zevent/", note: file.source?.note ?? null },
    generatedAt: new Date().toISOString(),
    stepMinutes: STEP_MINUTES,
    editions
  };
  await writeFile(OUTPUT, `${JSON.stringify(output)}\n`);
  console.log(`wrote ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
