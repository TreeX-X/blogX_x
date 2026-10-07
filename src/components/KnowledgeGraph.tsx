import { useEffect, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";

type Node = {
  id: string;
  title: string;
  url: string;
  collection: string;
  summary?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  __vx?: number;
  __vy?: number;
};

type Link = {
  source: string | Node;
  target: string | Node;
  similarity: number;
  distance: number;
};

type Payload = {
  nodes: Node[];
  links: Link[];
  nodeCount: number;
  linkCount: number;
};

type Props = {
  apiUrl: string;
};

/*-- 配色：ljj.world light — 暗红主色 + 暖赭石辅色 --*/
const NODE_COLORS: Record<string, { core: string; glow: string; text: string }> = {
  posts:            { core: "#b93b28", glow: "rgba(185,59,40,0.20)", text: "#151613" },
  "knowledge-base": { core: "#a87530", glow: "rgba(168,117,48,0.18)", text: "#151613" },
  wiki:             { core: "#8A8780", glow: "rgba(138,135,128,0.16)", text: "#151613" },
};

function getNodeStyle(collection: string) {
  return NODE_COLORS[collection] || NODE_COLORS.posts;
}

function toAppUrl(rawUrl: string) {
  if (!rawUrl || rawUrl === "#") return "#";
  if (!rawUrl.startsWith("/")) return rawUrl;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${base}${rawUrl}`;
}

export default function KnowledgeGraph({ apiUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  expandedRef.current = expanded;
  const [selected, setSelected] = useState<Node | null>(null);
  const selectedRef = useRef<Node | null>(null);
  const controlsRef = useRef<{ zoom: (factor: number) => void; reset: () => void; highlight: (node: Node | null) => void } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperGRef = useRef<SVGGElement | null>(null);
  const nodesGRef = useRef<SVGGElement | null>(null);
  const linksGRef = useRef<SVGGElement | null>(null);
  const simRef = useRef<any>(null);
  const width = 600;
  const height = 520;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload>({ nodes: [], links: [], nodeCount: 0, linkCount: 0 });

  /*-- 展开时保持图谱实例、限制背景交互并恢复焦点 --*/
  useEffect(() => {
    controlsRef.current?.highlight(selectedRef.current);
    if (!expanded) return;
    const panel = containerRef.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = Array.from(document.querySelectorAll<HTMLElement>(".home-main, .site-header, footer"));
    const inert = background.map(el => el.inert);
    background.forEach(el => { el.inert = true; });
    panel.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]')).filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      background.forEach((el, i) => { el.inert = inert[i]; });
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [expanded]);

  /*-- 拉取数据 --*/
  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "加载图谱失败");
        if (!active) return;
        setPayload({
          nodes: Array.isArray(data?.nodes) ? data.nodes : [],
          links: Array.isArray(data?.links) ? data.links : [],
          nodeCount: Number(data?.nodeCount || 0),
          linkCount: Number(data?.linkCount || 0),
        });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "加载图谱失败");
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, [apiUrl]);

  /*-- 力导向模拟 + SVG 交互 --*/
  useEffect(() => {
    if (payload.nodes.length === 0) return;
    const svg = svgRef.current;
    const wrapperG = wrapperGRef.current;
    const nodesG = nodesGRef.current;
    const linksG = linksGRef.current;
    if (!svg || !wrapperG || !nodesG || !linksG) return;

    /*-- 清理旧模拟 --*/
    if (simRef.current) {
      simRef.current.stop();
      simRef.current = null;
    }

    const degree = new Map<string, number>();
    payload.links.forEach(link => {
      for (const endpoint of [link.source, link.target]) {
        const id = typeof endpoint === "string" ? endpoint : endpoint.id;
        degree.set(id, (degree.get(id) || 0) + 1);
      }
    });
    const nodes: Node[] = payload.nodes.map((n) => ({ ...n }))
      .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0));
    const links: Link[] = payload.links.map((l) => ({ ...l }));

    /*-- 创建 SVG 元素 --*/
    select(linksG).selectAll("*").remove();
    select(nodesG).selectAll("*").remove();
    wrapperG.style.opacity = "0";

    const linkEls = select(linksG)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "rgba(21,22,19,0.35)")
      .attr("stroke-width", (d: any) => Math.max(0.6, Math.min(2.0, (d.similarity || 0) * 3.5)));

    const nodeGroups = select(nodesG)
      .selectAll("g")
      .data(nodes, (d: any) => d.id)
      .join("g")
      .attr("data-node", "true")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (d: any) => `预览：${d.title}`)
      .style("cursor", "pointer");

    /*-- 柔和光晕 --*/
    nodeGroups
      .append("circle")
      .attr("class", "kg-glow")
      .attr("r", 14)
      .attr("fill", (d: any) => getNodeStyle(d.collection).glow)
      .attr("opacity", 0.6);

    /*-- 核心节点 --*/
    nodeGroups
      .append("circle")
      .attr("class", "kg-core")
      .attr("r", 5)
      .attr("fill", (d: any) => getNodeStyle(d.collection).core)
      .attr("stroke", "rgba(255,255,255,0.6)")
      .attr("stroke-width", 1);

    /*-- 文字标签 --*/
    nodeGroups
      .append("text")
      .attr("class", "kg-label")
      .text((d: any) => (d.title.length > 18 ? d.title.slice(0, 18) + "…" : d.title))
      .attr("x", 10)
      .attr("y", 1)
      .attr("dy", "0.35em")
      .attr("font-size", 15)
      .attr("font-weight", 500)
      .attr("font-family", '"IBM Plex Sans", "Noto Sans SC", -apple-system, sans-serif')
      .attr("fill", (d: any) => getNodeStyle(d.collection).text)
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(245,240,235,0.85)")
      .attr("stroke-width", 3);

    /*-- 点击预览（拖拽结束后短路） --*/
    let suppressClick = false;

    nodeGroups.on("click", (event: any, d: any) => {
      if (suppressClick) { suppressClick = false; return; }
      event.stopPropagation();
      selectedRef.current = d;
      setSelected(d);
      highlight(d);
    });

    /*-- 邻接表 + 悬停高亮 --*/
    const idOf = (x: string | Node) => (typeof x === "string" ? x : x.id);
    const neighbors = new Map<string, Set<string>>();
    links.forEach((l) => {
      const s = idOf(l.source);
      const t = idOf(l.target);
      if (!neighbors.has(s)) neighbors.set(s, new Set());
      if (!neighbors.has(t)) neighbors.set(t, new Set());
      neighbors.get(s)!.add(t);
      neighbors.get(t)!.add(s);
    });

    const highlight = (node: any | null) => {
      const id = node?.id ?? null;
      const nset = id ? neighbors.get(id) : null;
      nodeGroups.attr("aria-pressed", (d: any) => String(d.id === selectedRef.current?.id));
      nodeGroups.select(".kg-label").attr("opacity", (d: any, i: number) =>
        id ? (d.id === id || nset?.has(d.id) ? 1 : 0) : (expandedRef.current || i < 6 ? 1 : 0));
      const edgeColor = node ? getNodeStyle(node.collection).core : null;
      nodeGroups
        .transition()
        .duration(160)
        .style("opacity", (d: any) => {
          if (!id) return 1;
          if (d.id === id) return 1;
          return nset?.has(d.id) ? 1 : 0.12;
        });
      linkEls
        .transition()
        .duration(160)
        .attr("stroke", (l: any) => {
          if (!id) return "rgba(21,22,19,0.35)";
          const s = idOf(l.source);
          const t = idOf(l.target);
          return s === id || t === id
            ? edgeColor || "rgba(21,22,19,0.7)"
            : "rgba(21,22,19,0.12)";
        })
        .style("opacity", (l: any) => {
          if (!id) return 1;
          const s = idOf(l.source);
          const t = idOf(l.target);
          return s === id || t === id ? 0.95 : 0.06;
        });
    };

    nodeGroups
      .on("mouseenter", function (event: any, d: any) {
        highlight(d);
        const g = select(event.currentTarget);
        g.select(".kg-core").transition().duration(160).attr("r", 7);
        g.select(".kg-glow").transition().duration(160).attr("r", 19).attr("opacity", 0.85);
        g.select(".kg-label").transition().duration(160).attr("font-size", 16);
      })
      .on("mouseleave", function (event: any) {
        highlight(selectedRef.current);
        const g = select(event.currentTarget);
        g.select(".kg-core").transition().duration(160).attr("r", 5);
        g.select(".kg-glow").transition().duration(160).attr("r", 14).attr("opacity", 0.6);
        g.select(".kg-label").transition().duration(160).attr("font-size", 15);
      });

    nodeGroups.on("keydown", (event: KeyboardEvent, d: any) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); selectedRef.current = d; setSelected(d); highlight(d);
      }
    }).on("focus", (_event: any, d: any) => highlight(d))
      .on("blur", () => highlight(selectedRef.current));
    highlight(selectedRef.current);
    /*-- 缩放 + 平移：transform 只作用于 wrapperG --*/
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .filter((event: any) => {
        if (event.type === "wheel") return expandedRef.current || event.ctrlKey || event.metaKey;
        if (event.type === "mousedown" || event.type === "touchstart") {
          const target = event.target as Element;
          if (target.closest("[data-node]")) return false;
        }
        return !event.button;
      })
      .on("zoom", (event: any) => {
        select(wrapperG).attr("transform", event.transform.toString());
      });

    select(svg).call(zoomBehavior).on("dblclick.zoom", null);

    /*-- 力导向模拟 --*/
    const sim = forceSimulation(nodes)
      .force("link", forceLink(links).id((d: any) => d.id).distance(100).strength(0.3))
      .force("charge", forceManyBody().strength(-220))
      .force("center", forceCenter(width / 2, (height - 36) / 2).strength(0.05))
      .force("collide", forceCollide().radius(45).strength(0.7))
      .alphaDecay(0.02)
      .velocityDecay(0.35);

    /*-- 拖拽节点 --*/
    let dragNode: Node | null = null;
    let dragStartPos = { x: 0, y: 0 };
    let dragMoved = false;

    nodeGroups
      .on("mousedown.drag", function (event: MouseEvent, d: any) {
        event.stopPropagation();
        event.preventDefault();
        dragNode = d;
        dragMoved = false;
        dragStartPos = { x: event.clientX, y: event.clientY };
        d.fx = d.x;
        d.fy = d.y;
        sim.alphaTarget(0.3).restart();
        select(svg).style("cursor", "grabbing");
      });

    const onMouseMove = (event: MouseEvent) => {
      if (!dragNode) return;
      const matrix = wrapperG.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      if (Math.abs(event.clientX - dragStartPos.x) > 4 || Math.abs(event.clientY - dragStartPos.y) > 4) {
        dragMoved = true;
      }
      dragNode.fx = point.x;
      dragNode.fy = point.y;
    };

    const onMouseUp = () => {
      if (dragNode) {
        if (dragMoved) suppressClick = true;
        dragNode.fx = null;
        dragNode.fy = null;
        dragNode = null;
        sim.alphaTarget(0);
        select(svg).style("cursor", "grab");
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    /*-- Tick：只设置 simulation 空间坐标，zoom 由 wrapperG 统一处理 --*/
    sim.on("tick", () => {
      linkEls
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroups.attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);
    });

    simRef.current = sim;

    /*-- Tooltip --*/
    nodeGroups.append("title").text((d: any) => `${d.title} (${d.collection})`);

    /*-- 初始适配 --*/
    const fitGraph = () => {
      const padding = 40;
      const nodePositions = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
      if (nodePositions.length === 0) return;
      const xs = nodePositions.map((n) => n.x!);
      const ys = nodePositions.map((n) => n.y!);
      const minX = Math.min(...xs) - padding;
      const maxX = Math.max(...xs) + 160;
      const minY = Math.min(...ys) - padding;
      const maxY = Math.max(...ys) + padding;
      const graphW = maxX - minX || 1;
      const graphH = maxY - minY || 1;
      const k = Math.min(width / graphW, (height - 36) / graphH, 2);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const tx = width / 2 - k * cx;
      const ty = (height - 36) / 2 - k * cy;
      const initialTransform = zoomIdentity.translate(tx, ty).scale(k);
      select(svg).call(zoomBehavior.transform, initialTransform);
      wrapperG.style.transition = "opacity 0.6s ease";
      wrapperG.style.opacity = "1";
    };
    controlsRef.current = { zoom: factor => { select(svg).call(zoomBehavior.scaleBy, factor); }, reset: fitGraph, highlight };
    const fitTimer = setTimeout(fitGraph, 800);

    return () => {
      sim.stop();
      simRef.current = null;
      controlsRef.current = null;
      clearTimeout(fitTimer);
      select(svg).on(".zoom", null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [payload]);

  return (
    <div className={`kg-panel${expanded ? " kg-expanded" : ""}`} ref={containerRef}
      role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label="知识地图">
      <div className="kg-header">
        <div><h2>知识地图</h2><p>沿着联系，发现下一篇</p></div>
        <button type="button" className="kg-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "关闭 ✕" : "展开 ↗"}
        </button>
      </div>
      <div className="kg-body">
      <div className="kg-canvas">
      {loading && <div className="kg-loading" role="status"><div className="kg-loading-dot" /><span>加载地图中…</span></div>}
      {error && <p className="kg-error" role="alert">图谱加载失败：{error}</p>}
      {!loading && !error && !payload.nodes.length && <p className="kg-empty">暂无足够的关联数据生成图谱</p>}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height - 36}`}
        width="100%"
        height="100%"
        aria-label="文章与知识库的语义关系网络"
        style={{ display: "block", cursor: "grab", touchAction: expanded ? "none" : "pan-y", userSelect: "none" }}
      >
        <g ref={wrapperGRef}>
          <g ref={linksGRef} />
          <g ref={nodesGRef} />
        </g>
      </svg>
      {!loading && !error && payload.nodes.length > 0 && <div className="kg-tools" aria-label="地图操作">
        <button type="button" aria-label="放大图谱" onClick={() => controlsRef.current?.zoom(1.3)}>＋</button>
        <button type="button" aria-label="缩小图谱" onClick={() => controlsRef.current?.zoom(1 / 1.3)}>−</button>
        <button type="button" onClick={() => controlsRef.current?.reset()}>复位</button>
      </div>}
      </div>
      <div className="kg-detail" aria-live="polite">
        {selected ? <>
          <span className="kg-detail-kind">{{ posts: "文章", "knowledge-base": "知识库", wiki: "Wiki" }[selected.collection] || "内容"}</span>
          <h3>{selected.title}</h3>
          <p>{selected.summary || "探索与这篇内容相连的节点，继续发现相关主题。"}</p>
          {selected.url && selected.url !== "#" && <a href={toAppUrl(selected.url)}>阅读全文 →</a>}
        </> : <><h3>从一个节点开始</h3><p>点击节点预览内容，高亮相连的文章与笔记。</p></>}
      </div>
      </div>
      <div className="kg-footer"><span>{payload.nodeCount} 节点 · {payload.linkCount} 联系</span><span>连线表示语义相近</span></div>
      <p className="kg-tip">{expanded ? "滚轮缩放 · 拖拽平移 · Esc 关闭" : "拖拽探索 · 使用 ＋ / − 缩放"}</p>
    </div>
  );
}
