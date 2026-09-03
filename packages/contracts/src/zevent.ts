import { z } from "zod";

const amountSchema = z.object({
  number: z.number(),
  formatted: z.string().optional()
});

export const zeventLiveEntrySchema = z.object({
  twitch_id: z.string().nullable().optional(),
  display: z.string(),
  twitch: z.string(),
  profileUrl: z.string().nullable().optional(),
  online: z.boolean(),
  game: z.string().nullable().optional(),
  viewersAmount: amountSchema,
  streamlabsId: z.string().nullable().optional(),
  donationUrl: z.string().nullable().optional(),
  ref: z.string().nullable().optional(),
  donationAmount: amountSchema
});

export const zeventAppSchema = z.object({
  live: z.array(zeventLiveEntrySchema),
  globalDonationUrl: z.string().optional(),
  donationAmount: amountSchema.optional(),
  viewersCount: amountSchema.optional(),
  websiteMode: z.string().nullable().optional(),
  calendar: z.array(z.unknown()).optional(),
  marquee: z.unknown().optional()
});

export const zeventCurrentAmountSchema = z.object({
  total: z.number()
});

export type ZeventLiveEntry = z.infer<typeof zeventLiveEntrySchema>;
export type ZeventApp = z.infer<typeof zeventAppSchema>;
export type ZeventCurrentAmount = z.infer<typeof zeventCurrentAmountSchema>;
