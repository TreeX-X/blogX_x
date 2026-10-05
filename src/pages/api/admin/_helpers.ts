/**
 * admin 面板接口的公共层
 *
 * 七个集合的接口原先各自写本地 src/content/<dir> 并自带一份正则 frontmatter 解析，本模块把它们
 * 收敛到两个既有入口：读写一律走 content-store（LanceDB content 表），字段校验一律走
 * content-schemas 的 zod schema。这里只做接口层的薄封装：JSON 响应、路径校验、读改写。
 *
 * 面板本身只在 dev 可达（生产由 middleware 统一 404），但写入口仍按"会被调用"来写：路径按
 * content-pull 写盘的规则校验，因为一条越界路径会让下一次构建把文件写到 src/content 之外。
 *
 * dotenv 由 content-store 在模块顶部自载（本模块不再自行加载）。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 * Note: 管理面为非 dev 环境 404 — see .agents/notes/2026-10-05-task-t0-revoke-public-write--a53dfd24.md
 */
import {
  validateCollectionFields,
  type CollectionKey,
} from "../../../lib/content-schemas";
import {
  deleteEntry,
  getEntry,
  listCollection,
  upsertEntry,
  type ContentStatus,
} from "../../../lib/content-store";

/*-- deleteEntry 随本模块再导出一次：接口层只从这一个门进来，不直接摸 content-store --*/
export { deleteEntry };

/*-- Windows 文件名非法字符。全角冒号「：」不在集合内：KB 的
    「规范文档/实战案例：PRD.md(路径偏置算法V2.0)」就是靠它区分中英文标点的 --*/
const ILLEGAL_SEGMENT = /[\\:*?"<>|]/;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** 读 JSON body；不是对象或解析失败时返回 null（调用方回 400） */
export async function readJson(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeSegment(raw: string): string | null {
  if (!raw || raw === "." || raw === "..") return null;
  if (ILLEGAL_SEGMENT.test(raw)) return null;
  /*-- 控制字符与 path 自带的扩展名都拒绝：写盘时会追加 .md，带扩展名的 path 会变成 .md.md --*/
  if (/[\u0000-\u001f]/.test(raw)) return null;
  if (raw.endsWith(".md")) return null;
  return raw;
}

/**
 * 校验单个 slug（扁平集合：posts / repos / projects / skills / toolbox）。
 * 非法返回 null，原样返回规范化后的值（去首尾空白）。
 */
export function normalizeSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("/")) return null;
  return normalizeSegment(trimmed);
}

/**
 * 校验集合内嵌套路径（knowledgeBase / wiki），正斜杠分隔、每段同样受上面那组规则约束。
 * 知识库现行的 15 条嵌套路径（中文、全角冒号、圆括号、空格、文件名内含 .md）都在这个形状内。
 */
export function normalizeNestedPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("/") || /^[a-zA-Z]:/.test(trimmed)) return null;
  const segments = trimmed.split("/").map((segment) => normalizeSegment(segment.trim()));
  if (segments.some((segment) => segment === null)) return null;
  return segments.join("/");
}

/** 面板列表项：slug 即 content 表的 path，其余字段是 frontmatter 原文，body 是正文 */
export type EntryListItem = Record<string, unknown> & {
  slug: string;
  body: string;
};

export async function listEntries(collection: CollectionKey): Promise<EntryListItem[]> {
  const records = await listCollection(collection);
  return records.map((record) => ({
    slug: record.path,
    ...parseFrontmatter(record.frontmatter),
    body: record.body,
  }));
}

/**
 * 嵌套集合（knowledgeBase / wiki）的列表项：身份字段叫 path。
 * 它是集合内相对路径（「AI使用技巧/AI评选」），不是扁平 slug，名字里的区别要在接口上看得见。
 */
export async function listNestedEntries(collection: CollectionKey) {
  return (await listEntries(collection)).map(({ slug, ...rest }) => ({ path: slug, ...rest }));
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type WriteFields =
  | { ok: true; frontmatter: Record<string, unknown> }
  | { ok: false; error: string };

/** 用集合 schema 校验面板提交的字段（passthrough 保留 source / fetched 等外来键） */
export function validateFields(
  collection: CollectionKey,
  fields: Record<string, unknown>
): WriteFields {
  const result = validateCollectionFields(collection, fields);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, frontmatter: result.frontmatter };
}

/** 新建前的冲突检测：KB/wiki 的嵌套路径撞车时拒绝，避免静默覆盖一条已有笔记 */
export async function entryExists(
  collection: CollectionKey,
  path: string
): Promise<boolean> {
  return (await getEntry(collection, path)) !== null;
}

/**
 * 保存一条记录。
 *
 * @param base 合并基线。null = 整份写入（新建）；给一个 path = 在该 path 的既有记录上合并。
 *   原地编辑传目标 path 本身；搬家传 from——源记录的键与正文要跟着走，否则一次移动就把面板
 *   不展示的键（knowledgeBase 的 source 等）和正文丢掉。
 *
 * 合并是必要的：表单只展示编辑用得到的字段，而 posts 的 fetched、knowledgeBase 的 source 由
 * fetch-articles / sync-obsidian-kb 写入，面板从不构造它们。整份替换会把一次普通编辑变成
 * 元数据丢失（article-db 的 fetchedAt / contentHash / translatedAt 全部读不到）。
 *
 * body 同一规则，且"缺键"与"空串"必须分开：没提交 body 就保留原正文，显式提交 "" 才算清空。
 * JSON 本身能区分这两者，混为一谈会让任何不带 body 的 PUT 静默抹掉整篇笔记。
 */
export async function saveEntry(
  collection: CollectionKey,
  path: string,
  fields: { frontmatter: Record<string, unknown> },
  body: string | undefined,
  base: string | null = null
): Promise<void> {
  const existing = base === null ? null : await getEntry(collection, base);
  const frontmatter = existing
    ? { ...parseFrontmatter(existing.frontmatter), ...fields.frontmatter }
    : fields.frontmatter;
  const status: ContentStatus = existing?.status === "draft" ? "draft" : "published";
  /*-- upsertEntry 是"删同 (collection, path) 行后整行插入"，所以下面构造的记录就是整行替换：
       没写进这条记录的字段会随旧行一起消失。逐字段审计——"保留"指从 existing 透传，"重置"指
       有意写成新值。新增或改动字段前先过这一遍（本注释为补漏而写：这两列曾被写死 ""，一次面板
       保存就把 3 篇真实文章的双语正文抹成空串，根因就是"造了一条记录却没意识到它在替换整行"）：
       - collection：编辑目标集合，来自参数 → 有意重置为新值；
       - path：目标 path，来自参数（搬家时是目标而非 from） → 有意重置为新值；
       - frontmatter：既有键与提交键合并，提交键覆盖 → 未提交的键保留；
       - body：existing 存在且请求未带 body 键 → 保留 existing.body；否则按提交值（含显式 ""）→ 重置；
       - originalBody / translatedBody：posts 的双语正文，表单与七个接口都不提交它们（接口把 body
         从请求体摘出后，其余键才进 frontmatter，这两个键从不在里面） → 唯一来源是 existing，
         必须透传保留。曾写死 ""，一次面板保存就把 3 篇真实文章的 36036/14592、16517/37961、
         14160/6167 字符正文抹成空串（T3 引入的回归）。其余六个集合这两列本就是空串，透传不改
         变行为；新建（existing = null）无既有正文可留，才写 ""；
       - status：existing 为 draft 保留草稿态，其余一律 published（面板与 intake 只发 published）；
       - updatedAt：有意重置为当前时间。--*/
  await upsertEntry({
    collection,
    path,
    frontmatter: JSON.stringify(frontmatter),
    body: existing && body === undefined ? existing.body : (body ?? ""),
    originalBody: existing?.originalBody ?? "",
    translatedBody: existing?.translatedBody ?? "",
    status,
    updatedAt: new Date().toISOString(),
  });
}

/** 删前先读，把实际删掉了什么回给前端（面板据此显示，而不是假装成功） */
export async function removeEntry(collection: CollectionKey, path: string) {
  const current = await getEntry(collection, path);
  if (!current) return { ok: false as const, status: 404, error: `记录不存在: ${path}` };
  await deleteEntry(collection, path);
  return {
    ok: true as const,
    status: 200,
    deleted: { slug: path, ...parseFrontmatter(current.frontmatter) },
  };
}
