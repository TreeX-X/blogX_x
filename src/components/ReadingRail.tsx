/**
 * 阅读左侧栏（文章 / 知识库 / Wiki）：自动解析章节树 + 滚动定位 + 阅读进度条
 * 交互对齐 claude.dev/blog 的 rail：树形目录、当前章节高亮、▓░ 字符进度条。
 * 挂载时解析目标容器内 h2–h4 标题；内容替换（如原文/译文切换）后自动重建。
 */
import { useEffect, useRef, useState } from "react";

interface TreeItem {
  id: string;
  text: string;
  depth: number; /*-- 2|3|4，决定缩进 --*/
}

interface TreeGroup {
  head: TreeItem;
  subs: TreeItem[];
}

interface ReadingRailProps {
  /*-- 正文容器选择器，树从其内部标题自动解析 --*/
  targetSelector: string;
  title: string;
  minutes?: number;
  /*-- article：仅当前组展开，服务线性阅读；reference：子树常开，服务查阅跳转 --*/
  variant?: "article" | "reference";
}

const PROG_CELLS = 28;

/*-- 标题锚点 slug：保留中英文字母数字，缺省回退 sec-N --*/
function slugify(text: string, index: number): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base || `sec-${index}`;
}

/*-- 为标题补全唯一 id（已有 id 时保留） --*/
function ensureHeadingIds(headings: HTMLElement[]): void {
  const used = new Set<string>();
  headings.forEach((el, i) => {
    let id = el.id;
    if (!id) {
      id = slugify(el.textContent || "", i);
      let unique = id;
      let n = 2;
      while (used.has(unique)) unique = `${id}-${n++}`;
      el.id = unique;
    }
    used.add(el.id);
  });
}

/*-- 把标题序列分组：不深于当前组头层级的标题开新组（h2 恒开新组；无 h2 的文章里同级
     h3 各自成组，而不是全塞进首组的收起子树），更深的折叠为组头的子项 --*/
function buildGroups(headings: HTMLElement[]): TreeGroup[] {
  const groups: TreeGroup[] = [];
  let current: TreeGroup | null = null;
  headings.forEach((el) => {
    const depth = Number(el.tagName.slice(1));
    const item: TreeItem = {
      id: el.id,
      text: (el.textContent || "").trim(),
      depth,
    };
    if (!current || depth <= current.head.depth) {
      current = { head: item, subs: [] };
      groups.push(current);
    } else {
      current.subs.push(item);
    }
  });
  return groups;
}

export default function ReadingRail({ targetSelector, title, minutes, variant = "article" }: ReadingRailProps) {
  const [groups, setGroups] = useState<TreeGroup[]>([]);
  const navRef = useRef<HTMLElement>(null);
  const progFillRef = useRef<HTMLElement>(null);
  const progEmptyRef = useRef<HTMLElement>(null);
  const pctRef = useRef<HTMLElement>(null);
  const progWrapRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = document.querySelector(targetSelector);
    if (!container) return;

    let headings: HTMLElement[] = [];
    let disposed = false;
    let raf = 0;

    /*-- 解析标题 → 重建树（内容切换后 DOM 变化会再次触发） --*/
    const parse = () => {
      if (disposed) return;
      headings = Array.from(container.querySelectorAll<HTMLElement>("h2, h3, h4"));
      if (headings.length > 0) ensureHeadingIds(headings);
      setGroups(buildGroups(headings));
      requestAnimationFrame(sync);
    };

    /*-- 滚动同步：进度条、当前章节、子树展开、标题浮现 --*/
    const sync = () => {
      raf = 0;
      if (disposed) return;

      /*-- 进度：滚过正文可视比例（正文底边对齐视口底为 100%） --*/
      const end = container.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
      const p = Math.max(0, Math.min(1, window.scrollY / Math.max(1, end)));
      const filled = Math.round(PROG_CELLS * p);
      const pct = Math.round(100 * p);
      if (progFillRef.current) progFillRef.current.textContent = "▓".repeat(filled);
      if (progEmptyRef.current) progEmptyRef.current.textContent = "░".repeat(PROG_CELLS - filled);
      if (pctRef.current) pctRef.current.textContent = `${String(pct).padStart(2, "0")}%`;
      progWrapRef.current?.setAttribute("aria-valuenow", String(pct));

      /*-- 当前章节：最后一个越过视口 40% 线的标题 --*/
      let active = -1;
      headings.forEach((el, i) => {
        if (el.getBoundingClientRect().top < 0.4 * window.innerHeight) active = i;
      });

      const nav = navRef.current;
      if (nav) {
        const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a"));
        const activeHref = active >= 0 ? `#${headings[active]?.id}` : null;
        links.forEach((a) => {
          const on = activeHref !== null && a.getAttribute("href") === activeHref;
          a.classList.toggle("on", on);
          if (on) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
        /*-- 当前章节所在组（或组头自身激活时）的子树展开，其余收起；reference 常开 --*/
        nav.querySelectorAll<HTMLElement>(".read-subs").forEach((el) => {
          if (variant === "reference") {
            el.classList.add("open");
            return;
          }
          const head = el.previousElementSibling as HTMLElement | null;
          const headOn = head?.classList.contains("on") ?? false;
          const contains = el.querySelector("a.on") !== null;
          el.classList.toggle("open", headOn || contains);
        });
      }

      /*-- 滚过 h1 后在栏顶浮现文章标题 --*/
      const h1 = document.querySelector<HTMLElement>(`${targetSelector} h1, #article-body h1`);
      const past = h1 ? h1.getBoundingClientRect().bottom < 0 : window.scrollY > 240;
      titleRef.current?.classList.toggle("on", past);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };

    /*-- 内容替换（语言切换 / 延迟渲染）后重新解析 --*/
    let mutationRaf = 0;
    const onMutation = () => {
      if (mutationRaf) return;
      mutationRaf = requestAnimationFrame(() => {
        mutationRaf = 0;
        parse();
      });
    };

    parse();
    const observer = new MutationObserver(onMutation);
    observer.observe(container, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    sync();

    /*-- 初始 hash 定位 --*/
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el && container.contains(el)) {
        setTimeout(() => {
          el.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "start",
          });
        }, 150);
      }
    }

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (mutationRaf) cancelAnimationFrame(mutationRaf);
    };
  }, [targetSelector, variant]);

  /*-- 点击树项：平滑滚动到对应标题并记录 hash --*/
  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    history.pushState(null, "", `#${id}`);
  };

  if (groups.length === 0 && minutes == null) return null;

  return (
    <aside className="read-rail" aria-label="阅读目录">
      <div className="read-rail-title" ref={titleRef}>{title}</div>
      {groups.length > 0 && (
        <>
          <div className="read-rail-label">目录</div>
          <nav className="read-tree" ref={navRef} aria-label="章节跳转">
            {groups.map((group, gi) => (
              <div className="read-group" key={`${group.head.id}-${gi}`}>
                <a href={`#${group.head.id}`} onClick={(e) => { e.preventDefault(); jumpTo(group.head.id); }}>
                  <span className="br" aria-hidden="true">└</span>
                  {group.head.text}
                </a>
                {group.subs.length > 0 && (
                  <div className={variant === "reference" ? "read-subs open" : "read-subs"}>
                    <div>
                      {group.subs.map((sub) => (
                        <a
                          className="sub"
                          href={`#${sub.id}`}
                          key={sub.id}
                          onClick={(e) => { e.preventDefault(); jumpTo(sub.id); }}
                        >
                          <span className="br" aria-hidden="true">└</span>
                          {sub.text}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </>
      )}
      <div
        className="read-prog"
        ref={progWrapRef}
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <b ref={progFillRef} />
        <span ref={progEmptyRef} />
        <span className="pct" ref={pctRef}>00%</span>
      </div>
      {minutes != null && <div className="read-time">约 {minutes} 分钟</div>}
    </aside>
  );
}
