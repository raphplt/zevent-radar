import { z } from "zod";

export const ingdocCategorySchema = z.enum([
  "donation",
  "recurent",
  "global",
  "donation_equal",
  "donation_more_than",
  "donation_largest",
  "incentive"
]);

export const ingdocSocialsSchema = z.object({
  twitch: z
    .object({
      id: z.string().nullable().optional(),
      login: z.string().nullable().optional()
    })
    .nullable()
    .optional()
});

export const ingdocOverviewEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  profile_url: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  live: z.boolean().optional(),
  amount_raised: z.number().int().optional(),
  donation_goals_count: z.number().int(),
  next_donation_goal: z
    .object({ id: z.string(), name: z.string(), amount: z.number().int() })
    .nullable()
    .optional(),
  socials: ingdocSocialsSchema.optional(),
  streamers: z.array(z.object({ id: z.string(), name: z.string(), socials: ingdocSocialsSchema.optional() })).optional()
});

export const ingdocOverviewSchema = z.array(ingdocOverviewEntrySchema);

export const ingdocGoalSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number().int(),
  category: z.string(),
  accomplished: z.boolean(),
  reached: z.boolean(),
  links: z.array(z.string()).optional().default([]),
  participation_id: z.string()
});

export const ingdocGoalsSchema = z.array(ingdocGoalSchema);

export type IngdocOverviewEntry = z.infer<typeof ingdocOverviewEntrySchema>;
export type IngdocGoal = z.infer<typeof ingdocGoalSchema>;

import type { GoalImportFile, GoalImportStreamer } from "./goals";
import type { GoalCategory } from "./labels";

export const INGDOC_DEFAULT_API_BASE = "https://api.ppr.evenmorestats.fr";
export const INGDOC_DEFAULT_EVENT_ID = "019f5bd1-fe07-7d78-a326-a02198a9d50f";
export const INGDOC_SITE_URL = "https://zevent.gdoc.fr";

export function mapIngdocCategory(category: string): GoalCategory {
  switch (category) {
    case "donation":
    case "global":
    case "incentive":
    case "donation_equal":
    case "donation_more_than":
    case "donation_largest":
      return category;
    case "recurent":
    case "recurrent":
      return "recurrent";
    default:
      return "other";
  }
}

export function ingdocParticipationUrl(participationId: string): string {
  return `${INGDOC_SITE_URL}/participations/${participationId}`;
}

export function mapIngdocToImport(
  overview: IngdocOverviewEntry[],
  goalsByParticipation: Map<string, IngdocGoal[]>,
  generatedAt = new Date().toISOString()
): GoalImportFile {
  const streamers: GoalImportStreamer[] = [];
  for (const entry of overview) {
    const twitch = entry.socials?.twitch ?? entry.streamers?.[0]?.socials?.twitch ?? null;
    const login = twitch?.login?.toLowerCase();
    if (!login) continue;
    const goals = goalsByParticipation.get(entry.id) ?? [];
    if (goals.length === 0) continue;
    streamers.push({
      twitchId: twitch?.id ?? undefined,
      twitchLogin: login,
      displayName: entry.name,
      goals: goals.map((g) => ({
        id: g.id,
        amount: g.amount / 100,
        label: g.name.trim(),
        category: mapIngdocCategory(g.category),
        sourceUrl: g.links?.[0] ?? ingdocParticipationUrl(g.participation_id),
        reached: g.reached,
        accomplished: g.accomplished
      }))
    });
  }
  return {
    generatedAt,
    source: { name: "InGDoc", url: `${INGDOC_SITE_URL}/donation_goals` },
    streamers
  };
}
