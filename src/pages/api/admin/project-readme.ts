import type { APIRoute } from "astro";
import { fetchProjectReadme } from "../../../lib/project-readme";
import { projectReadmeSchema } from "../../../lib/content-schemas";
import { fail, json, readJson } from "./_helpers";

export const prerender = false;

// Fetch is a preview only. The existing project save endpoint owns persistence.
export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (typeof body?.repoUrl !== "string") return fail("请先填写 GitHub 仓库地址");
  try {
    const snapshot = projectReadmeSchema.parse(await fetchProjectReadme(body.repoUrl));
    return json(snapshot);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "README 读取失败", 422);
  }
};
