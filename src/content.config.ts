import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    /*-- 外链文章必填：原文 URL --*/
    sourceUrl: z.string().url(),
    /*-- 以下字段可选，不填则从源 URL 自动提取 --*/
    title: z.string().optional(),
    date: z.coerce.date().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    coverImage: z.string().optional(),
    /*-- 补充元数据 --*/
    originalAuthor: z.string().optional(),
    originalLang: z.string().default('en'),
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

const wiki = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/wiki' }),
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isDraft: z.boolean().default(false),
  }),
});

const repos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/repos' }),
  schema: z.object({
    title: z.string(),
    repoUrl: z.string().url(),
    description: z.string(),
    language: z.string().optional(),
    tags: z.array(z.string()).optional(),
    stars: z.number().optional(),
    isDraft: z.boolean().default(false),
  }),
});

export const collections = {
  posts,
  knowledgeBase,
  wiki,
  repos,
};
