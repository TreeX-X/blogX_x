/**
 * 文章阅读器组件
 * 渲染从 LanceDB 读取的文章内容，支持原文/翻译切换
 */
import { useState, useEffect, useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import LanguageToggle, { useLanguage } from "./LanguageToggle";
import ShareBar from "./ShareBar";
import "../styles/share.css";

interface ArticleRecord {
  slug: string;
  sourceUrl: string;
  originalContent: string;
  translatedContent: string;
  originalLang: string;
  title: string;
  description: string;
  author: string;
  coverImage: string;
  wordCount: number;
  fetchStatus: string;
}

interface ArticleReaderProps {
  article: ArticleRecord;
}

/*-- 轻量 Markdown → HTML 转换（处理翻译管道输出的 Markdown 格式内容） --*/
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let inList = false;

  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) { out.push("</code></pre>"); inCodeBlock = false; }
      else { out.push("<pre><code>"); inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { out.push(line); continue; }

    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }

    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      if (inList) { out.push("</ul>"); inList = false; }
      const level = hMatch[1].length;
      out.push(`<h${level}>${inline(hMatch[2])}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      out.push(`<blockquote><p>${inline(trimmed.replace(/^>\s?/, ""))}</p></blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p>${inline(trimmed)}</p>`);
  }
  if (inList) out.push("</ul>");
  if (inCodeBlock) out.push("</code></pre>");
  return out.join("\n");
}

/*-- 检测内容是否为 Markdown（而非 HTML） --*/
function isMarkdown(text: string): boolean {
  const t = text.trim();
  if (t.startsWith("<") && /<[a-z][\s\S]*>/i.test(t)) return false;
  return /^#{1,6}\s/m.test(t) || /\*\*[^*]+\*\*/.test(t) || /!\[.*\]\(.*\)/.test(t);
}

/*-- 使用 DOMPurify 做 XSS 清理，保留安全的 HTML 标签和属性 --*/
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "a", "strong", "em", "b", "i", "u", "s", "del", "mark", "sub", "sup",
      "img", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span", "section", "article", "header", "footer",
      "details", "summary",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "width", "height",
      "class", "id", "name",
      "target", "rel", "loading",
      "colspan", "rowspan",
      "open",
    ],
    ADD_ATTR: ["target"],
    /*-- 外链在新窗口打开 --*/
    ADD_TAGS: [],
  });
}

/*-- 估算阅读时间 --*/
function readingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

/*-- 从 URL 提取域名 --*/
function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export default function ArticleReader({ article }: ArticleReaderProps) {
  const hasOriginal = Boolean(article.originalContent);
  const hasTranslation = Boolean(article.translatedContent);
  const originalLang = article.originalLang || "en";
  const { lang, toggle } = useLanguage(hasTranslation ? "translated" : "original", originalLang);

  /*-- 根据当前语言选择内容 --*/
  const currentContent = useMemo(() => {
    const raw = lang === "translated" && hasTranslation
      ? article.translatedContent
      : article.originalContent;
    if (!raw) return "";
    /*-- 翻译管道输出 Markdown，需先转 HTML 再 sanitize --*/
    const html = isMarkdown(raw) ? markdownToHtml(raw) : raw;
    return sanitizeHtml(html);
  }, [lang, hasTranslation, article.originalContent, article.translatedContent]);

  /*-- 切换时淡入动画 --*/
  const [fadeClass, setFadeClass] = useState("article-content--visible");

  useEffect(() => {
    setFadeClass("article-content--hidden");
    const timer = setTimeout(() => setFadeClass("article-content--visible"), 50);
    return () => clearTimeout(timer);
  }, [lang]);

  const domain = extractDomain(article.sourceUrl);
  const minutes = readingTime(article.wordCount);
  const isFailed = article.fetchStatus === "failed";
  const isEmpty = !currentContent || currentContent.trim() === "";

  return (
    <div className="article-reader">
      {/*-- 来源信息栏 --*/}
      <div className="article-source-bar">
        <div className="article-meta-row">
          {article.author && (
            <span className="article-author">✍️ {article.author}</span>
          )}
          <span className="article-domain">
            来源: <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">{domain}</a>
          </span>
          <span className="article-read-time">📖 约 {minutes} 分钟</span>
        </div>

        <LanguageToggle
          hasOriginal={hasOriginal}
          hasTranslation={hasTranslation}
          lang={lang}
          onToggle={toggle}
          originalLang={originalLang}
        />
      </div>

      {/*-- 文章内容 --*/}
      {isFailed ? (
        <div className={`article-content prose-wrap ${fadeClass}`}>
          <div className="article-error">
            <p>文章内容加载失败</p>
            <p>无法从源站获取文章内容，请稍后再试或查看原文。</p>
            <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
              查看原文
            </a>
          </div>
        </div>
      ) : isEmpty ? (
        <div className={`article-content prose-wrap ${fadeClass}`}>
          <div className="article-empty">
            <p>暂无文章内容</p>
            <p>文章内容可能尚未抓取或翻译，请查看原文。</p>
            <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
              查看原文
            </a>
          </div>
        </div>
      ) : (
        <div
          className={`article-content prose-wrap ${fadeClass}`}
          dangerouslySetInnerHTML={{ __html: currentContent }}
        />
      )}

      {/*-- 分享栏 --*/}
      <ShareBar
        title={article.title}
        description={article.description}
        slug={article.slug}
        lang={lang}
      />

      {/*-- 底部来源回链 --*/}
      <footer className="article-footer">
        <a
          className="article-original-link"
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          🔗 查看原文: {article.title} — {domain}
        </a>
      </footer>
    </div>
  );
}
