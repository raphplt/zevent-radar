import { z } from "zod";

import { GOAL_CATEGORIES, GOAL_STATUSES, type GoalCategory, type GoalStatus } from "./labels";

export type { GoalCategory, GoalStatus };

export const goalCategorySchema = z.enum(GOAL_CATEGORIES);
export const goalStatusSchema = z.enum(GOAL_STATUSES);

export const goalImportEntrySchema = z.object({
  id: z.string().optional(),
  amount: z.number().nonnegative(),
  label: z.string().min(1).max(500),
  category: goalCategorySchema.default("donation"),
  sourceUrl: z.string().url().optional().nullable(),
  reached: z.boolean().optional(),
  accomplished: z.boolean().optional()
});

export const goalImportStreamerSchema = z.object({
  twitchId: z.string().optional(),
  twitchLogin: z.string().min(1),
  displayName: z.string().optional(),
  goals: z.array(goalImportEntrySchema)
});

export const goalImportFileSchema = z.object({
  generatedAt: z.string().optional(),
  source: z.object({ name: z.string(), url: z.string().optional() }).optional(),
  streamers: z.array(goalImportStreamerSchema)
});

export type GoalImportEntry = z.infer<typeof goalImportEntrySchema>;
export type GoalImportStreamer = z.infer<typeof goalImportStreamerSchema>;
export type GoalImportFile = z.infer<typeof goalImportFileSchema>;

export interface GoalRecord {
  id: string;
  streamerId: string;
  amountCents: number;
  label: string;
  category: GoalCategory;
  status: GoalStatus;
  sourceUrl: string | null;
  sourceName: string | null;
  verifiedAt: string | null;
  reachedAt: string | null;
  accomplishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const COMPARABLE_CATEGORIES: ReadonlySet<GoalCategory> = new Set(["donation", "global"]);
export const ACTIVE_STATUSES: ReadonlySet<GoalStatus> = new Set(["pending", "verified"]);
export const VISIBLE_STATUSES: ReadonlySet<GoalStatus> = new Set(["pending", "verified", "reached", "accomplished"]);
