/**
 * 文章分享栏组件
 * 提供复制链接（含语言参数）和社交媒体分享功能
 * 纯 CSS 实现，无第三方分享 SDK
 */
import { useState, useCallback, useRef, useEffect } from "react";

interface ShareBarProps {
  /** 文章标题 */
  title: string;
  /** 文章描述 */
  description: string;
  /** 文章 slug，用于构建分享链接 */
  slug: string;
  /** 当前语言模式 */
  lang: "original" | "translated";
}

/*-- 构建含语言参数的分享链接 --*/
function buildShareUrl(slug: string, lang: "original" | "translated"): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const langParam = lang === "translated" ? "zh" : "en";
  return `${base}/posts/${slug}?lang=${langParam}`;
}

/*-- Twitter/X 分享链接 --*/
function twitterShareUrl(url: string, title: string): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
}

/*-- LinkedIn 分享链接 --*/
function linkedInShareUrl(url: string, title: string, description: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(description)}`;
}

/*-- 微信分享：由于无法直接调起微信，降级为复制链接提示 --*/
function weChatShareFallback(): void {
  alert("请使用微信「扫一扫」功能扫描分享链接，或复制链接后发送给好友。");
}

export default function ShareBar({ title, description, slug, lang }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*-- 复制链接到剪贴板 --*/
  const handleCopy = useCallback(async () => {
    const url = buildShareUrl(slug, lang);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /*-- 降级：选中文本复制 --*/
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [slug, lang]);

  /*-- 打开社交媒体分享窗口 --*/
  const openShare = useCallback((platform: "twitter" | "linkedin" | "wechat") => {
    const url = buildShareUrl(slug, lang);
    let shareUrl = "";

    switch (platform) {
      case "twitter":
        shareUrl = twitterShareUrl(url, title);
        break;
      case "linkedin":
        shareUrl = linkedInShareUrl(url, title, description);
        break;
      case "wechat":
        weChatShareFallback();
        return;
    }

    if (shareUrl) {
      window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=400");
    }
  }, [slug, lang, title, description]);

  /*-- 清理定时器 --*/
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="share-bar" role="group" aria-label="分享文章">
      <span className="share-label">分享</span>

      {/*-- 复制链接按钮 --*/}
      <button
        type="button"
        className={`share-btn share-btn-copy ${copied ? "copied" : ""}`}
        onClick={handleCopy}
        aria-label={copied ? "链接已复制" : "复制文章链接"}
      >
        {/*-- 链接图标 --*/}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span className="share-btn-text">{copied ? "已复制" : "复制链接"}</span>
      </button>

      {/*-- 复制成功提示（始终渲染，CSS 控制可见性，避免重复触发动画） --*/}
      <span className={`share-toast ${copied ? "visible" : "hidden"}`} role="status" aria-live="polite">
        ✓ 链接已复制到剪贴板
      </span>

      {/*-- 社交媒体分享按钮 --*/}
      <div className="share-socials">
        {/*-- Twitter/X --*/}
        <button
          type="button"
          className="share-btn share-btn-social"
          onClick={() => openShare("twitter")}
          aria-label="分享到 Twitter/X"
          title="分享到 Twitter/X"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </button>

        {/*-- LinkedIn --*/}
        <button
          type="button"
          className="share-btn share-btn-social"
          onClick={() => openShare("linkedin")}
          aria-label="分享到 LinkedIn"
          title="分享到 LinkedIn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </button>

        {/*-- 微信 --*/}
        <button
          type="button"
          className="share-btn share-btn-social"
          onClick={() => openShare("wechat")}
          aria-label="分享到微信"
          title="分享到微信"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.093 6.093 0 0 1-.247-1.722c0-3.645 3.39-6.605 7.573-6.605.257 0 .507.02.755.04C16.758 4.66 13.068 2.188 8.691 2.188zm-2.92 5.21a1.09 1.09 0 1 1 0-2.18 1.09 1.09 0 0 1 0 2.18zm5.84 0a1.09 1.09 0 1 1 0-2.18 1.09 1.09 0 0 1 0 2.18zm4.368 3.086c-3.678 0-6.66 2.622-6.66 5.855 0 3.233 2.982 5.855 6.66 5.855a8.37 8.37 0 0 0 2.315-.327.646.646 0 0 1 .536.073l1.404.822a.242.242 0 0 0 .124.04.22.22 0 0 0 .215-.219c0-.053-.022-.106-.036-.157l-.288-1.095a.44.44 0 0 1 .157-.494C22.088 19.164 23 17.506 23 15.34c0-3.233-2.982-5.856-6.66-5.856h-.361zm-2.47 3.313a.812.812 0 1 1 0-1.624.812.812 0 0 1 0 1.624zm4.94 0a.812.812 0 1 1 0-1.624.812.812 0 0 1 0 1.624z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
