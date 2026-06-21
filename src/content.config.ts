import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: ['*.md', '.*.md'], base: './blog' }),
  schema: z.object({
    title: z.string(),
    time: z.union([z.string(), z.number()]).transform((value) => String(value)),
    des: z.string().optional().default(''),
    tags: z.array(z.string()).optional().default([]),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { blog };
