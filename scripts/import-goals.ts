import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  INGDOC_DEFAULT_API_BASE,
  INGDOC_DEFAULT_EVENT_ID,
  ingdocGoalsSchema,
  ingdocOverviewSchema,
  mapIngdocToImport,
  type IngdocGoal
} from "@zevent-radar/contracts";

const apiBase = process.env.INGDOC_API_BASE ?? INGDOC_DEFAULT_API_BASE;
const eventId = process.env.INGDOC_EVENT_ID ?? INGDOC_DEFAULT_EVENT_ID;
const output = resolve(process.argv[2] ?? "data/initial-goals.json");
const concurrency = 8;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function main() {
  const overview = ingdocOverviewSchema.parse(await getJson(`${apiBase}/events/${eventId}/donation_goals/overview`));
  const withGoals = overview.filter((p) => p.donation_goals_count > 0);
  const goalsByParticipation = new Map<string, IngdocGoal[]>();
  let index = 0;
  let failures = 0;
  async function worker() {
    while (index < withGoals.length) {
      const entry = withGoals[index];
      index += 1;
      if (!entry) return;
      try {
        const goals = ingdocGoalsSchema.parse(await getJson(`${apiBase}/participations/${entry.id}/donation_goals`));
        goalsByParticipation.set(entry.id, goals);
      } catch (error) {
        failures += 1;
        console.error(`goals failed for ${entry.name}: ${(error as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const file = mapIngdocToImport(overview, goalsByParticipation);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(file, null, 2)}\n`);
  const total = file.streamers.reduce((acc, s) => acc + s.goals.length, 0);
  console.log(`wrote ${output}: ${file.streamers.length} streamers, ${total} goals, ${failures} failures`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
