import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()).optional(),
    coverImage: z.string().optional(),
    isDraft: z.boolean().default(false),
  }),
});

const knowledgeBase = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/knowledge-base' }),
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isDraft: z.boolean().default(false),
  }),
});

export const collections = {
  posts,
  knowledgeBase,
};
