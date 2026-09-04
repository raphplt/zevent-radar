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

export const zeventStreamerSchema = z.object({
  streamer: z
    .object({
      twitchId: z.string().nullable().optional(),
      twitchLogin: z.string().nullable().optional()
    })
    .optional(),
  donationAmount: amountSchema,
  globalDonationAmount: amountSchema.optional(),
  donationGoal: z
    .object({
      goals: z.array(z.object({ amountRequired: amountSchema, title: z.string().optional() }))
    })
    .optional()
});

export type ZeventLiveEntry = z.infer<typeof zeventLiveEntrySchema>;
export type ZeventApp = z.infer<typeof zeventAppSchema>;
export type ZeventCurrentAmount = z.infer<typeof zeventCurrentAmountSchema>;
export type ZeventStreamer = z.infer<typeof zeventStreamerSchema>;
