/**
 * 中英文语言切换组件（纯展示层）
 * 在原文和翻译之间切换，记住用户偏好
 * 优先级: URL ?lang 参数 > localStorage > 默认值
 */
import { useState, useEffect, useCallback } from "react";
import { getLangFromUrl } from "../lib/lang-param";

interface LanguageToggleProps {
  hasOriginal: boolean;
  hasTranslation: boolean;
  lang: "original" | "translated";
  onToggle: (lang: "original" | "translated") => void;
}

export default function LanguageToggle({
  hasOriginal,
  hasTranslation,
  lang,
  onToggle,
}: LanguageToggleProps) {
  const bothAvailable = hasOriginal && hasTranslation;

  return (
    <div className="lang-toggle" role="group" aria-label="文章语言切换">
      <button
        type="button"
        className={`lang-btn ${lang === "original" ? "active" : ""}`}
        onClick={() => onToggle("original")}
        disabled={!hasOriginal}
        aria-label="显示英文原文"
        aria-pressed={lang === "original"}
      >
        EN
      </button>
      {bothAvailable && <span className="lang-sep">/</span>}
      <button
        type="button"
        className={`lang-btn ${lang === "translated" ? "active" : ""}`}
        onClick={() => onToggle("translated")}
        disabled={!hasTranslation}
        aria-label="显示中文翻译"
        aria-pressed={lang === "translated"}
      >
        中
      </button>
    </div>
  );
}

/*-- 语言状态管理 Hook，供 ArticleReader 等使用 --*/
const STORAGE_KEY = "preferred-article-lang";

export function useLanguage(defaultLang: "original" | "translated" = "translated") {
  const [lang, setLang] = useState<"original" | "translated">(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved === "original" || saved === "translated") return saved;
    } catch { /* SSR 忽略 */ }
    return defaultLang;
  });

  /*-- SSR hydrate 后同步: URL 参数优先，其次 localStorage --*/
  useEffect(() => {
    /*-- 优先从 URL ?lang= 参数读取语言偏好 --*/
    const urlLang = getLangFromUrl();
    if (urlLang) {
      setLang(urlLang);
      try { localStorage.setItem(STORAGE_KEY, urlLang); } catch { /* ignore */ }
      return;
    }
    /*-- 回退到 localStorage 中保存的偏好 --*/
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "original" || saved === "translated") setLang(saved);
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback((target: "original" | "translated") => {
    setLang(target);
    try { localStorage.setItem(STORAGE_KEY, target); } catch { /* ignore */ }
  }, []);

  return { lang, toggle };
}
