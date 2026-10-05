/**
 * 内容集合的 zod schema（唯一定义处）
 *
 * 从 src/content.config.ts 抽出，供 content.config.ts 与内容云 consumers 共用，
 * 集合字段定义与校验永不漂移。集合键是 LanceDB `content` 表的 collection 字段取值，
 * 对 glob loader 集合还同时是 src/content.config.ts 的 collections 键（T2 的 content-pull
 * 依赖它映射回目录）；不经 glob loader 的集合（toolbox）只在这里登记，见下方注释。
 *
 * z 从 astro/zod 而不是 astro:content 导入（T4 经 Main Agent 授权的范围扩大）：两者是同一个
 * zod v4 实例——astro:content 虚拟模块本体（node_modules/astro/templates/content/module.mjs:18）
 * 就是 `export { z } from 'astro/zod'`。astro:content 是 Astro 虚拟模块，Node 直跑的脚本解析不了
 * 它，于是这份"共用 schema"被锁死在 Astro 运行时里，任何 CLI 想复用同一份字段定义都做不到。
 * 换成 astro/zod（astro package.json exports 的公开子路径 → dist/zod.js → export * from "zod/v4"）
 * 后本模块在 Astro 与 Node 下都能加载：content-migrate / fetch-articles / content-intake /
 * content-publish 从此都能复用同一份 schema，不会退化成两份字段定义。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 */
import { z } from "astro/zod";

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

export const toolboxSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  category: z.string(),
  summary: z.string().default(""),
  icon: z.string().optional(),
});

/*-- 集合键 → schema。新增集合必须同时登记这里与 src/content.config.ts 的 collections。
     toolbox 例外：它不经 glob loader，由 src/lib/toolbox.ts 直接读 content 表（面板写入即时生效，
     不必等 content-pull 落盘），因此只登记 schema，不登记 astro 集合 --*/
export const collectionSchemas = {
  posts: postsSchema,
  knowledgeBase: knowledgeBaseSchema,
  wiki: wikiSchema,
  repos: reposSchema,
  skills: skillsSchema,
  projects: projectsSchema,
  toolbox: toolboxSchema,
};

export type CollectionKey = keyof typeof collectionSchemas;

/*-- passthrough 版 schema：面板写入的校验入口，唯一定义处就在本模块，admin 接口不另写校验。
     用 passthrough 是为留住 schema 之外的键——posts 的 fetched、knowledgeBase 的 source 由
     fetch-articles / sync-obsidian-kb 写入，面板从不构造它们，静默丢弃就是丢数据。 --*/
type ValidateResult =
  | { ok: true; frontmatter: Record<string, unknown> }
  | { ok: false; error: string };

/*-- 结构类型而非 z.ZodObject：本模块的 z 来自 astro:content，只作值不作命名空间 --*/
type PassthroughSchema = {
  passthrough(): {
    safeParse(
      input: unknown
    ):
      | { success: true; data: Record<string, unknown> }
      | {
          success: false;
          error: { issues: Array<{ path: Array<string | number | symbol>; message: string }> };
        };
  };
};

const passthroughSchemas = collectionSchemas as unknown as Record<CollectionKey, PassthroughSchema>;

export function validateCollectionFields(
  collection: CollectionKey,
  fields: unknown
): ValidateResult {
  const result = passthroughSchemas[collection].passthrough().safeParse(fields);
  if (result.success) {
    return { ok: true, frontmatter: result.data };
  }
  const detail = result.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  return { ok: false, error: `字段校验失败（${collection}）: ${detail}` };
}
