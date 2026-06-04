import { useEffect, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";

type Node = {
  id: string;
  title: string;
  url: string;
  collection: string;
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

/*-- 配色：Takram 暖纸风格 -- posts 鼠尾草绿, knowledge-base 暖赭, wiki 暖灰 --*/
const NODE_COLORS: Record<string, { core: string; glow: string; text: string }> = {
  posts:            { core: "#6B8F71", glow: "rgba(107,143,113,0.20)", text: "#2D3436" },
  "knowledge-base": { core: "#C0956E", glow: "rgba(192,149,110,0.18)", text: "#2D3436" },
  wiki:             { core: "#A3967E", glow: "rgba(163,150,126,0.16)", text: "#2D3436" },
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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperGRef = useRef<SVGGElement | null>(null);
  const nodesGRef = useRef<SVGGElement | null>(null);
  const linksGRef = useRef<SVGGElement | null>(null);
  const simRef = useRef<any>(null);
  const [width, setWidth] = useState(360);
  const [height, setHeight] = useState(500);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload>({ nodes: [], links: [], nodeCount: 0, linkCount: 0 });

  /*-- 响应式尺寸 --*/
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.max(280, Math.floor(entries[0].contentRect.width));
      setWidth(nextWidth);
      setHeight(Math.max(480, Math.floor(nextWidth * 1.35)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

    const nodes: Node[] = payload.nodes.map((n) => ({ ...n }));
    const links: Link[] = payload.links.map((l) => ({ ...l }));

    /*-- 创建 SVG 元素 --*/
    select(linksG).selectAll("*").remove();
    select(nodesG).selectAll("*").remove();
    wrapperG.style.opacity = "0";

    const linkEls = select(linksG)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "rgba(200,194,182,0.35)")
      .attr("stroke-width", (d: any) => Math.max(0.6, Math.min(2.0, (d.similarity || 0) * 3.5)));

    const nodeGroups = select(nodesG)
      .selectAll("g")
      .data(nodes, (d: any) => d.id)
      .join("g")
      .attr("data-node", "true")
      .style("cursor", "pointer");

    /*-- 柔和光晕 --*/
    nodeGroups
      .append("circle")
      .attr("r", 14)
      .attr("fill", (d: any) => getNodeStyle(d.collection).glow)
      .attr("opacity", 0.6);

    /*-- 核心节点 --*/
    nodeGroups
      .append("circle")
      .attr("r", 5)
      .attr("fill", (d: any) => getNodeStyle(d.collection).core)
      .attr("stroke", "rgba(255,255,255,0.6)")
      .attr("stroke-width", 1);

    /*-- 文字标签 --*/
    nodeGroups
      .append("text")
      .text((d: any) => (d.title.length > 18 ? d.title.slice(0, 18) + "…" : d.title))
      .attr("x", 10)
      .attr("y", 1)
      .attr("dy", "0.35em")
      .attr("font-size", 11)
      .attr("font-weight", 500)
      .attr("font-family", '"IBM Plex Sans", "Noto Sans SC", -apple-system, sans-serif')
      .attr("fill", (d: any) => getNodeStyle(d.collection).text)
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(245,240,235,0.85)")
      .attr("stroke-width", 3);

    /*-- 点击跳转（拖拽结束后短路） --*/
    let suppressClick = false;

    nodeGroups.on("click", (event: any, d: any) => {
      if (suppressClick) { suppressClick = false; return; }
      event.stopPropagation();
      if (!d?.url || d.url === "#") return;
      const url = toAppUrl(d.url);
      if (url && url !== "#") window.location.href = url;
    });

    /*-- 缩放 + 平移：transform 只作用于 wrapperG --*/
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .filter((event: any) => {
        if (event.type === "wheel") return true;
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
      const t = select(svg).property("__zoom") || zoomIdentity;
      const dx = (event.clientX - dragStartPos.x) / t.k;
      const dy = (event.clientY - dragStartPos.y) / t.k;
      if (Math.abs(event.clientX - dragStartPos.x) > 4 || Math.abs(event.clientY - dragStartPos.y) > 4) {
        dragMoved = true;
      }
      dragNode.fx = (dragNode.fx ?? dragNode.x!) + dx;
      dragNode.fy = (dragNode.fy ?? dragNode.y!) + dy;
      dragStartPos = { x: event.clientX, y: event.clientY };
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
    const fitTimer = setTimeout(() => {
      const padding = 40;
      const nodePositions = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
      if (nodePositions.length === 0) return;
      const xs = nodePositions.map((n) => n.x!);
      const ys = nodePositions.map((n) => n.y!);
      const minX = Math.min(...xs) - padding;
      const maxX = Math.max(...xs) + padding;
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
    }, 800);

    return () => {
      sim.stop();
      simRef.current = null;
      clearTimeout(fitTimer);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [payload, width, height]);

  /*-- Loading / Error / Empty --*/
  if (loading) {
    return (
      <div className="kg-panel" ref={containerRef}>
        <div className="kg-loading">
          <div className="kg-loading-dot" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kg-panel" ref={containerRef}>
        <p className="kg-error">图谱加载失败：{error}</p>
      </div>
    );
  }

  if (!payload.nodes.length) {
    return (
      <div className="kg-panel" ref={containerRef}>
        <p className="kg-empty">暂无足够的关联数据生成图谱</p>
      </div>
    );
  }

  return (
    <div className="kg-panel" ref={containerRef}>
      <div className="kg-header">
        <span className="kg-stats">
          <span className="kg-stat-dot posts" /> {payload.nodeCount} 节点
          <span className="kg-sep">·</span>
          {payload.linkCount} 关系
        </span>
        <span className="kg-hint">滚轮缩放 · 拖拽平移 · 拖动节点</span>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height - 36}
        style={{ display: "block", width: "100%", cursor: "grab", touchAction: "none", userSelect: "none" }}
      >
        <g ref={wrapperGRef}>
          <g ref={linksGRef} />
          <g ref={nodesGRef} />
        </g>
      </svg>

      <p className="kg-tip">点击节点跳转对应条目</p>
    </div>
  );
}
