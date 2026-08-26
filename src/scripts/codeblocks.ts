/**
 * 代码块增强：复制按钮 + 语言标签
 * - 语言优先读取 code 的 language-* 类，其次启发式检测首行/关键词
 * - MutationObserver 覆盖 ArticleReader 等动态注入/切换的代码块
 */

/*-- 常见语言类名 → 展示名 --*/
const KNOWN: Record<string, string> = {
  py: "Python", python: "Python",
  js: "JavaScript", javascript: "JavaScript",
  ts: "TypeScript", typescript: "TypeScript",
  tsx: "TSX", jsx: "JSX",
  json: "JSON", jsonc: "JSONC",
  html: "HTML", xml: "XML", svg: "SVG",
  css: "CSS", scss: "SCSS", less: "Less",
  bash: "Shell", sh: "Shell", shell: "Shell", zsh: "Shell",
  sql: "SQL",
  md: "Markdown", markdown: "Markdown",
  yaml: "YAML", yml: "YAML", toml: "TOML",
  go: "Go", rust: "Rust", rs: "Rust",
  java: "Java", c: "C", cpp: "C++", "c++": "C++",
  "c#": "C#", csharp: "C#", cs: "C#",
  php: "PHP", ruby: "Ruby", rb: "Ruby",
  swift: "Swift", kotlin: "Kotlin", dart: "Dart",
  dockerfile: "Dockerfile", nginx: "Nginx", diff: "Diff",
  plaintext: "Text", text: "Text", ini: "INI", conf: "Config",
};

/*-- 启发式语言检测：基于首行 + 前 500 字符的关键词 --*/
function detectLanguage(code: string): string {
  const t = code.trim();
  if (!t) return "";
  const head = t.slice(0, 500).toLowerCase();
  const firstLine = t.split("\n")[0].trim().toLowerCase();

  if (/^<!doctype|^<html|^<\/?[a-z][^>]*>/.test(t)) return "HTML";
  if (/^<\?xml/.test(firstLine)) return "XML";
  if (/^#!\//.test(firstLine)) return "Shell";
  if (/^\s*(const|let|var)\s+\w+\s*=/.test(t) || /=>/.test(head) || /console\.(log|error|warn)\(/.test(head)) {
    return /:\s*(string|number|boolean|any)\b|interface\s+\w+|<\w+>\(/.test(head) ? "TypeScript" : "JavaScript";
  }
  if (/^\s*(import|export)\s+/.test(t)) {
    return /:\s*(string|number|boolean|any)\b|interface\s+\w+/.test(head) ? "TypeScript" : "JavaScript";
  }
  if (/^\s*def\s+\w+|^\s*class\s+\w+:\s*$|__init__|print\(/.test(t)) return "Python";
  if (/^\s*(select|insert\s+into|update|delete\s+from|create\s+table|alter\s+table|with\s+\w+\s+as)\b/i.test(t)) return "SQL";
  if (/^\s*(package\s+main|import\s+\()|func\s+\w+/.test(t)) return "Go";
  if (/^\s*(use\s+\w|let\s+mut|fn\s+\w+)/.test(t) || /cargo\s+(run|build)/.test(head)) return "Rust";
  if (/^\s*#include\s*</.test(t)) return /std::|using\s+namespace/.test(head) ? "C++" : "C";
  if (/^\s*(public\s+|private\s+|protected\s+)?(static\s+)?(class|interface)\s+\w+/.test(t) && /System\.out/.test(head)) return "Java";
  if (/^[\{\[]/.test(t) && /"[\w-]+"\s*:/.test(t)) return "JSON";
  if (/^@media|^\.[\w-]+\s*\{|^#[\w-]+\s*\{/.test(t)) return "CSS";
  if (/^[\w-]+\s*:\s+[^\s]/.test(t) && !/;/.test(head)) return "YAML";
  if (/^[\$\#>]\s/.test(firstLine) || /\b(npm|pnpm|yarn|apt|brew|git)\s+[a-z]/.test(head)) return "Shell";
  return "";
}

/*-- 解析代码块语言：类名 > data-* > 启发式 --*/
function labelFor(pre: HTMLPreElement, code: HTMLElement): string {
  const classLang = code.className?.match(/(?:^|\s)language-([\w+-]+)/)?.[1];
  if (classLang && KNOWN[classLang]) return KNOWN[classLang];
  const dataLang = pre.getAttribute("data-language") || code.getAttribute("data-language");
  if (dataLang && KNOWN[dataLang.toLowerCase()]) return KNOWN[dataLang.toLowerCase()];
  return detectLanguage(code.textContent || "");
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(text);
    });
  }
  fallbackCopy(text);
  return Promise.resolve();
}

/*-- 旧浏览器兜底复制 --*/
function fallbackCopy(text: string): void {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch { /* 忽略 */ }
  document.body.removeChild(ta);
}

function enhance(pre: HTMLPreElement): void {
  if (pre.dataset.codeEnhanced === "true") return;
  pre.dataset.codeEnhanced = "true";

  const code = pre.querySelector("code");
  if (!code) return;

  const label = labelFor(pre, code);
  if (label) pre.setAttribute("data-language", label);

  const head = document.createElement("div");
  head.className = "code-head";

  if (label) {
    const lang = document.createElement("span");
    lang.className = "code-lang";
    lang.textContent = label;
    head.appendChild(lang);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "code-copy";
  btn.setAttribute("aria-label", "复制代码");
  btn.innerHTML =
    '<svg class="code-copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
    '</svg><span>复制</span>';

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    copyText(code.textContent || "").then(() => {
      const span = btn.querySelector("span");
      if (span) span.textContent = "已复制";
      btn.classList.add("copied");
      setTimeout(() => {
        if (span) span.textContent = "复制";
        btn.classList.remove("copied");
      }, 1600);
    });
  });

  head.appendChild(btn);
  pre.insertBefore(head, code);
}

export function setupCodeBlocks(): void {
  document.querySelectorAll("pre").forEach((p) => enhance(p as HTMLPreElement));

  if (!("MutationObserver" in window)) return;
  let scheduled = false;
  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((m) => m.addedNodes.length > 0)) return;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node.nodeType !== 1) continue;
          const el = node as Element;
          if (el.tagName === "PRE") enhance(el as HTMLPreElement);
          else el.querySelectorAll("pre").forEach((p) => enhance(p as HTMLPreElement));
        }
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
