import { z } from 'zod'

// Vault/Markdown content schema. uid is optional — normalization falls back
// to entry.id when absent.
export const contentHubSchema = z.object({
  uid: z.string().optional(),
  title: z.string(),
  topics: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  date: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  excerpt: z.string().optional(),
})

// Feed/external-source schema. categories maps RSS <category> elements,
// used as topic source when topics is absent.
export const feedEntrySchema = z.object({
  title: z.string(),
  topics: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  link: z.string().url(),
  date: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  excerpt: z.string().optional(),
})

export type ContentHubSchemaInput = z.input<typeof contentHubSchema>
export type FeedEntrySchemaInput = z.input<typeof feedEntrySchema>
