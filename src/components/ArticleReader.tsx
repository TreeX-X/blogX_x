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
  const { lang, toggle } = useLanguage(hasTranslation ? "translated" : "original");

  /*-- 根据当前语言选择内容 --*/
  const currentContent = useMemo(() => {
    const raw = lang === "translated" && hasTranslation
      ? article.translatedContent
      : article.originalContent;
    return sanitizeHtml(raw);
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
        />
      </div>

      {/*-- 文章内容 --*/}
      <div
        className={`article-content prose-wrap ${fadeClass}`}
        dangerouslySetInnerHTML={{ __html: currentContent }}
      />

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
