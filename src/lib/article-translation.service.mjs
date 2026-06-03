/**
 * 翻译服务：检测语言方向并执行翻译
 * 负责文章的语言检测、翻译执行和结果处理
 *
 * 这是 article-translation.service.ts 的 JavaScript 版本，
 * 供 scripts/fetch-articles.mjs 等直接使用 node 运行的脚本使用。
 */

/*-- 语言检测正则表达式 --*/
const CHINESE_CHAR_REGEX = /[\u4e00-\u9fff]/g;
const ENGLISH_CHAR_REGEX = /[a-zA-Z]/g;

/*-- GLM 翻译配置 --*/
const GLM_API_KEY = process.env.GLM_API_KEY;
const GLM_BASE_URL = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
const GLM_MODEL = process.env.GLM_MODEL || "glm-4.5-air";

/*-- 英文 → 中文 的翻译 prompt：保留 HTML 标签、占位符、URL、代码块不翻译 --*/
const TRANSLATE_SYSTEM_PROMPT_EN_TO_ZH = `你是一位专业的技术文章翻译者。请将以下技术文章翻译为中文（中文）。
规则：
1. 保留所有代码块（\`\`\`...\`\`\`）原样不翻译
2. 保留所有行内代码（\`...\`）原样不翻译
3. 保留所有链接 URL 不翻译，但翻译链接文字
4. 保留所有图片 URL 不翻译
5. 技术术语首次出现时用「中文（English）」格式，后续直接用中文
6. 保持原文的段落结构和 Markdown 格式
7. 翻译要自然流畅，不要生硬直译
8. 直接输出翻译结果，不要添加任何解释
9. 严格保留所有 HTML 标签（<p>、<h1>、<a>、<img>、<pre>、<code>、<ul>、<ol>、<li>、<blockquote> 等）的尖括号、属性名、属性值（包括 src / href / class / alt 等）
10. 严格保留所有占位符 \`[[T_N]]\` 和 \`[[/T_N]]\`（N 为数字）原样不动，只翻译它们**内部**的文本内容
11. 不要新增、删除、改写任何标签、URL、属性或占位符标记`;

/*-- 中文 → 英文 的翻译 prompt：镜像 EN→ZH 规则，但目标语言为 English --*/
const TRANSLATE_SYSTEM_PROMPT_ZH_TO_EN = `You are a professional technical article translator. Please translate the following technical article into English.
Rules:
1. Keep all code blocks (\`\`\`...\`\`\`\`) untranslated
2. Keep all inline code (\`...\`\`) untranslated
3. Keep all link URLs untranslated, but translate the link text
4. Keep all image URLs untranslated
5. For technical terms that have a well-known English name, keep the English name; on first occurrence, format as \`English (中文)\`, afterwards use English only
6. Preserve the original paragraph structure and Markdown formatting
7. Translate naturally and fluently, do not word-for-word literally
8. Output the translation directly without any explanation
9. Strictly preserve all HTML tags (<p>, <h1>, <a>, <img>, <pre>, <code>, <ul>, <ol>, <li>, <blockquote>, etc.) and their attribute names/values (src / href / class / alt, etc.) exactly as they appear
10. Strictly preserve all placeholders \`[[T_N]]\` and \`[[/T_N]]\` (N is a number) exactly as they appear; only translate the text content **between** them
11. Do not add, remove, or rewrite any tag, URL, attribute, or placeholder marker`;

/**
 * 检测文本主要语言
 * @param {string} text 待检测的文本
 * @returns {'zh' | 'en' | 'unknown'} 'zh' 表示中文，'en' 表示英文，'unknown' 表示无法确定
 */
export function detectLanguage(text) {
  if (!text || text.trim().length === 0) {
    return 'unknown';
  }

  // 移除HTML标签和多余空格进行更准确的检测
  const cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  if (cleanText.length === 0) {
    return 'unknown';
  }

  const chineseMatches = cleanText.match(CHINESE_CHAR_REGEX);
  const englishMatches = cleanText.match(ENGLISH_CHAR_REGEX);

  const chineseCount = chineseMatches ? chineseMatches.length : 0;
  const englishCount = englishMatches ? englishMatches.length : 0;

  // 如果中文字符数量显著多于英文字符，判断为中文
  if (chineseCount > englishCount * 1.5) {
    return 'zh';
  }
  // 如果英文字符数量显著多于中文字符，判断为英文
  if (englishCount > chineseCount * 1.5) {
    return 'en';
  }

  // 否则根据哪种字符更多来判断
  if (chineseCount > englishCount) {
    return 'zh';
  } else if (englishCount > chineseCount) {
    return 'en';
  }

  return 'unknown';
}

/**
 * 根据源语言挑选对应的 system prompt；未知语言默认按 EN→ZH 处理
 * @param {'zh' | 'en'} sourceLang 源语言
 * @returns {string} 系统提示词
 */
function pickTranslateSystemPrompt(sourceLang) {
  return sourceLang === "zh" ? TRANSLATE_SYSTEM_PROMPT_ZH_TO_EN : TRANSLATE_SYSTEM_PROMPT_EN_TO_ZH;
}

/**
 * 将文本分割成适合翻译的段落
 * @param {string} text 待分割的文本
 * @param {number} maxLen 每段最大长度
 * @returns {string[]} 分割后的段落数组
 */
function splitTextIntoSegments(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const segments = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";
  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxLen && current.length > 0) {
      segments.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + para;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

/**
 * 调用 GLM API 进行翻译
 * @param {string} text 待翻译的文本
 * @param {string} systemPrompt 系统提示词
 * @returns {Promise<string|null>} 翻译后的文本
 */
async function callGlmApi(text, systemPrompt) {
  try {
    const resp = await fetch(`${GLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error(`[article-translation] GLM API 调用失败:`, error);
    return null;
  }
}

/**
 * 执行翻译（使用 GLM API）
 * @param {string} text 待翻译的文本
 * @param {'zh' | 'en'} sourceLang 源语言
 * @param {'zh' | 'en'} targetLang 目标语言
 * @returns {Promise<string>} 翻译后的文本
 */
export async function translateText(text, sourceLang, targetLang) {
  // 如果源语言和目标语言相同，直接返回原文
  if (sourceLang === targetLang) {
    return text;
  }

  // 检查 GLM API 配置
  if (!GLM_API_KEY) {
    console.warn("[article-translation] GLM_API_KEY 未配置，使用占位翻译");
    // 占位符翻译逻辑（实际应用中应删除此部分并集成真实翻译API）
    if (sourceLang === 'zh' && targetLang === 'en') {
      // 中文到英文的简单占位翻译
      return `[English Translation] ${text}`;
    } else if (sourceLang === 'en' && targetLang === 'zh') {
      // 英文到中文的简单占位翻译
      return `[中文翻译] ${text}`;
    }
    // 如果语言组合不支持，返回原文并记录警告
    console.warn(`[article-translation] 不支持的语言组合: ${sourceLang} -> ${targetLang}`);
    return text;
  }

  try {
    console.log(`[article-translation] 翻译请求: ${sourceLang} -> ${targetLang}, 文本长度: ${text.length}`);

    // 系统提示词
    const systemPrompt = pickTranslateSystemPrompt(sourceLang);

    // 将文本分割成段落以避免超出 API 限制
    const TRANSLATE_BATCH_SIZE = 1500; // 与 fetch-articles.mjs 保持一致
    const segments = splitTextIntoSegments(text, TRANSLATE_BATCH_SIZE);
    const translatedSegments = [];

    if (segments.length > 1) {
      console.log(`[article-translation] 共 ${segments.length} 个段落待翻译...`);
    }

    // 翻译每个段落
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segments.length > 1) {
        console.log(`[article-translation] 翻译段落 ${i + 1}/${segments.length} (${segment.length} 字符)...`);
      }

      // 调用 GLM API
      const translated = await callGlmApi(segment, systemPrompt);
      if (translated) {
        translatedSegments.push(translated);
      } else {
        // 如果翻译失败，使用原文作为后备
        console.warn(`[article-translation] 段落 ${i + 1} 翻译失败，使用原文`);
        translatedSegments.push(segment);
      }
    }

    return translatedSegments.join("\n\n");
  } catch (error) {
    console.error(`[article-translation] 翻译过程中发生错误:`, error);
    // 出现错误时返回原文
    return text;
  }
}

/**
 * 处理文章翻译流程
 * @param {Object} articleData 包含文章信息的对象
 * @returns {Promise<Object>} 处理后的文章数据，包含翻译结果
 */
export async function processArticleTranslation(articleData) {
  // 检测原始内容语言
  const originalLang = detectLanguage(articleData.originalContent);

  // 如果无法检测语言，默认为英文（因为大多数技术内容源自英文，且英文处理更安全）
  const lang = originalLang !== 'unknown' ? originalLang : 'en';

  // 确定目标语言（与源语言相反）
  const targetLang = lang === 'zh' ? 'en' : 'zh';

  // 执行翻译
  const translatedContent = await translateText(
    articleData.originalContent,
    lang,
    targetLang
  );

  // 翻译标题和描述
  const translatedTitle = await translateText(
    articleData.title,
    lang,
    targetLang
  );

  const translatedDescription = await translateText(
    articleData.description,
    lang,
    targetLang
  );

  // 生成内容哈希
  const crypto = await import("node:crypto");
  const contentHash = crypto.createHash("sha256")
    .update(`${articleData.sourceUrl}::${articleData.originalContent.slice(0, 500)}`, "utf8")
    .digest("hex");

  const now = new Date().toISOString();

  return {
    slug: articleData.slug,
    sourceUrl: articleData.sourceUrl,
    originalContent: articleData.originalContent,
    translatedContent: translatedContent,
    contentHash: contentHash,
    fetchedAt: now,
    translatedAt: now,
    originalLang: lang,
    title: translatedTitle,
    description: translatedDescription,
    author: articleData.author,
    coverImage: articleData.coverImage,
    wordCount: articleData.wordCount,
    fetchStatus: articleData.fetchStatus
  };
}
