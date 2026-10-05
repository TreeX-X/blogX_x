/**
 * 内容集合的 zod schema（唯一定义处）
 *
 * 从 src/content.config.ts 抽出，供 content.config.ts 与内容云 consumers 共用，
 * 集合字段定义与校验永不漂移。集合键即 src/content.config.ts 的 collections 键，
 * 也是 LanceDB `content` 表的 collection 字段取值（T2 的 content-pull 依赖它映射回目录）。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 */
import { z } from "astro:content";

export const postsSchema = z.object({
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
});

export const knowledgeBaseSchema = z.object({
  title: z.string().optional(),
  date: z.coerce.date().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isDraft: z.boolean().default(false),
});

export const wikiSchema = z.object({
  title: z.string().optional(),
  date: z.coerce.date().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isDraft: z.boolean().default(false),
});

export const reposSchema = z.object({
  title: z.string(),
  repoUrl: z.string().url(),
  description: z.string(),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
  stars: z.number().optional(),
  isDraft: z.boolean().default(false),
});

export const skillsSchema = z.object({
  title: z.string(),
  description: z.string(),
  skillDir: z.string(),
  tags: z.array(z.string()).optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  isDraft: z.boolean().default(false),
});

export const projectsSchema = z.object({
  title: z.string(),
  repoUrl: z.string().url(),
  description: z.string(),
  tags: z.array(z.string()).optional(),
  isDraft: z.boolean().default(false),
});

/*-- 集合键 → schema。新增集合必须同时登记这里与 src/content.config.ts 的 collections --*/
export const collectionSchemas = {
  posts: postsSchema,
  knowledgeBase: knowledgeBaseSchema,
  wiki: wikiSchema,
  repos: reposSchema,
  skills: skillsSchema,
  projects: projectsSchema,
};

export type CollectionKey = keyof typeof collectionSchemas;
