import { z } from "zod";
import { goalCategorySchema, goalStatusSchema } from "./goals";

import { REPORT_KINDS, type ReportKind } from "./labels";

export const reportKindSchema = z.enum(REPORT_KINDS);

export const installationIdSchema = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const createReportSchema = z.object({
  streamerId: z.string().min(1).max(32),
  kind: reportKindSchema,
  message: z.string().min(3).max(280),
  sourceUrl: z.string().url().max(500).optional().nullable(),
  installationId: installationIdSchema,
  turnstileToken: z.string().optional()
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const confirmReportSchema = z.object({
  installationId: installationIdSchema
});

export interface CommunityReport {
  id: string;
  streamerId: string;
  streamerLogin: string | null;
  streamerDisplayName: string | null;
  kind: ReportKind;
  message: string;
  sourceUrl: string | null;
  status: "pending" | "approved" | "rejected" | "expired";
  confirmations: number;
  createdAt: string;
  expiresAt: string | null;
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(5)
  })
});

export const subscribeSchema = z.object({
  installationId: installationIdSchema,
  subscription: pushSubscriptionSchema
});

export const notificationPreferenceSchema = z.object({
  streamerId: z.string().min(1).max(32),
  approaching: z.boolean().default(true),
  reached: z.boolean().default(true),
  accomplished: z.boolean().default(true),
  live: z.boolean().default(false)
});
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const updatePreferencesSchema = z.object({
  installationId: installationIdSchema,
  preferences: z.array(notificationPreferenceSchema).max(200)
});

export const unsubscribeSchema = z.object({
  installationId: installationIdSchema,
  endpoint: z.string().url().optional()
});

export const adminGoalUpdateSchema = z.object({
  amount: z.number().nonnegative().optional(),
  label: z.string().min(1).max(500).optional(),
  category: goalCategorySchema.optional(),
  status: goalStatusSchema.optional(),
  sourceUrl: z.string().url().nullable().optional()
});

export const adminGoalCreateSchema = z.object({
  streamerId: z.string().min(1),
  amount: z.number().nonnegative(),
  label: z.string().min(1).max(500),
  category: goalCategorySchema.default("donation"),
  sourceUrl: z.string().url().nullable().optional(),
  status: goalStatusSchema.default("verified")
});

export const adminReportDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"])
});

export type NotificationType = "approaching" | "reached" | "accomplished" | "live";

export interface NotificationJob {
  eventKey: string;
  type: NotificationType;
  streamerId: string;
  streamerLogin: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  createdAt: string;
}
