import type { APIRoute } from "astro";
import {
  createIntakeDraft,
  deleteIntakeDraft,
  listIntakeDrafts,
  publishIntakeDraft,
  PublishValidationError,
  summarizeIntakeDraft,
  INTAKE_COLLECTION,
  type DraftSummary,
  type IntakeSourceKind,
} from "../../../lib/article-intake.service";
import { fail, json, readJson } from "./_helpers";

export const prerender = false;

/**
 * AI 上传处理通道（面板侧）。
 *
 * CLI（scripts/content-intake.mjs / content-publish.mjs）与这里共用同一个
 * article-intake.service，读写的也是同一批 content 表草稿——所以面板的草稿箱能看到 CLI
 * 写的草稿，反之亦然（需求 AC-6 的跨机器可见）。面板只在 dev 可达（生产由 middleware 404）。
 *
 * 面板提交的是已经读出来的文件文本而不是文件路径：不接受客户端传本地路径，省掉一层路径穿越面。
 *
 * Note: 内容真相源为 LanceDB 单表 content — see .agents/notes/2026-10-05-decision-truth-source-lancedb--10d55da8.md
 * Note: 面板只在 dev 可达 — see .agents/notes/2026-10-05-task-t0-revoke-public-write--a53dfd24.md
 */

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

/** 草稿箱：CLI 与面板写的是同一批 draft 记录 */
export const GET: APIRoute = async () => json(await listIntakeDrafts(INTAKE_COLLECTION));

/** 三个入口（上传文件 / 粘贴 URL / 粘贴正文）→ 生成草稿 */
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");

  const source = body.source;
  if (source !== "url" && source !== "file" && source !== "text") {
    return fail("source 必须是 url / file / text");
  }
  const sourceKind: IntakeSourceKind = source;

  try {
    const draft = await createIntakeDraft(
      {
        source: sourceKind,
        url: stringField(body, "url"),
        text: stringField(body, "text"),
        filename: stringField(body, "filename"),
        sourceUrl: stringField(body, "sourceUrl"),
      },
      { onProgress: (message) => console.log(`[intake] ${message}`) }
    );
    const summary: DraftSummary = summarizeIntakeDraft(draft.record);
    return json({
      ok: true,
      draft: summary,
      /*-- GLM 失败等原因必须随响应回到界面：草稿照常落库，但失败不能只在终端里 --*/
      warnings: draft.warnings,
    });
  } catch (error) {
    console.error("[intake] 生成草稿失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    /*-- 抓取不到/读不出内容归 502（上游问题），其余（缺 source、内容存储拒绝写入等）归 400。
         两条路都把 message 原样回给面板——失败原因必须在界面上看得见 --*/
    const status = /抓取|HTTP|正文为空|文件内容为空/.test(message) ? 502 : 400;
    return fail(message, status);
  }
};

/** 发布草稿：schema 校验 → status: published → Deploy Hook */
export const PUT: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const path = stringField(body, "path").trim();
  if (!path) return fail("path required");

  try {
    const report = await publishIntakeDraft(INTAKE_COLLECTION, path, {
      dryRun: body.dryRun === true,
      onProgress: (message) => console.log(`[intake] ${message}`),
    });
    return json({ ok: true, report });
  } catch (error) {
    if (error instanceof PublishValidationError) {
      return fail(`${error.message}\n${error.issues.map((issue) => `- ${issue}`).join("\n")}`, 400);
    }
    console.error("[intake] 发布草稿失败:", error);
    return fail(error instanceof Error ? error.message : String(error), 400);
  }
};

/** 丢弃草稿 */
export const DELETE: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (!body) return fail("请求体不是合法 JSON");
  const path = stringField(body, "path").trim();
  if (!path) return fail("path required");
  try {
    await deleteIntakeDraft(INTAKE_COLLECTION, path);
    return json({ ok: true, deleted: path });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error), 400);
  }
};
