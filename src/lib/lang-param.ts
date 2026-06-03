/**
 * URL 语言参数解析工具
 * 从 URL 的 ?lang= 参数中解析语言偏好
 * 优先级: URL 参数 > localStorage > 默认值
 */

/**
 * 根据 originalLang 构建 URL 参数 lang 到内部语言标识的映射
 * originalLang="en"（默认）: ?lang=en→original, ?lang=zh→translated
 * originalLang="zh": ?lang=zh→original, ?lang=en→translated
 */
function buildLangMap(originalLang: string = "en"): Record<string, "original" | "translated"> {
  if (originalLang === "zh") {
    return { zh: "original", en: "translated" };
  }
  return { zh: "translated", en: "original" };
}

/**
 * 从当前 URL 中读取 ?lang= 参数
 * 仅在客户端环境下可用（window 存在时）
 * @param originalLang 文章原文语言，决定参数映射方向
 * @returns 解析后的语言标识，无效参数返回 null
 */
export function getLangFromUrl(originalLang: string = "en"): "original" | "translated" | null {
  if (typeof window === "undefined") return null;
  const param = new URLSearchParams(window.location.search).get("lang");
  if (!param) return null;
  const map = buildLangMap(originalLang);
  return map[param.toLowerCase()] ?? null;
}
