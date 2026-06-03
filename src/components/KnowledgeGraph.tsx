import { useEffect, useMemo, useRef, useState } from "react";

type Node = {
  id: string;
  title: string;
  url: string;
  collection: string;
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

/*-- 配色：posts 温紫, knowledge-base 冷青, wiki 暖琥珀 --*/
const NODE_COLORS: Record<string, { core: string; glow: string; text: string }> = {
  posts:              { core: "#c084fc", glow: "rgba(192,132,252,0.35)", text: "#e8d5ff" },
  "knowledge-base":   { core: "#38bdf8", glow: "rgba(56,189,248,0.30)", text: "#bae6fd" },
  wiki:               { core: "#fbbf24", glow: "rgba(251,191,36,0.28)", text: "#fef3c7" },
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
  const graphRef = useRef<any>(null);
  const [GraphImpl, setGraphImpl] = useState<any>(null);
  const [width, setWidth] = useState(320);
  const [height, setHeight] = useState(430);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload>({ nodes: [], links: [], nodeCount: 0, linkCount: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.max(280, Math.floor(entries[0].contentRect.width));
      setWidth(nextWidth);
      setHeight(Math.max(360, Math.floor(nextWidth * 1.15)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  useEffect(() => {
    let active = true;
    import("react-force-graph-2d")
      .then((mod) => { if (active) setGraphImpl(() => mod.default); })
      .catch(() => { if (active) setError("图谱渲染库加载失败"); });
    return () => { active = false; };
  }, []);

  const graphData = useMemo(() => ({ nodes: payload.nodes, links: payload.links }), [payload]);

  useEffect(() => {
    if (!graphRef.current || payload.nodes.length === 0) return;
    /*-- 力导向参数：节点间距适中，电荷力适度排斥 --*/
    graphRef.current.d3Force("charge")?.strength(-180);
    graphRef.current.d3Force("link")?.distance(90);
    graphRef.current.zoomToFit(600, 30);
  }, [payload]);

  /*-- Loading / Error / Empty states --*/
  if (loading || !GraphImpl) {
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
      {/*-- 顶部状态栏 --*/}
      <div className="kg-header">
        <span className="kg-stats">
          <span className="kg-stat-dot posts" /> {payload.nodeCount} 节点
          <span className="kg-sep">·</span>
          {payload.linkCount} 关系
        </span>
        <span className="kg-hint">滚轮缩放 · 拖拽平移</span>
      </div>

      {/*-- 力导向图 --*/}
      <GraphImpl
        ref={graphRef}
        width={width}
        height={height - 36}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        /*-- 交互：启用拖拽 + 缩放平移 --*/
        enableNodeDrag={true}
        enableZoomPanInteraction={true}
        enablePointerInteraction={true}
        /*-- 动画 --*/
        cooldownTicks={150}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        /*-- 连线样式：半透明渐变 --*/
        linkWidth={(link) => Math.max(0.6, Math.min(2.0, Number((link as Link).similarity || 0) * 3.5))}
        linkColor={() => "rgba(148,163,184,0.18)"}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={() => "rgba(192,132,252,0.4)"}
        linkDirectionalParticleSpeed={0.003}
        /*-- 节点样式 --*/
        nodeRelSize={6}
        nodeLabel={(node) => `${(node as Node).title} (${(node as Node).collection})`}
        nodeCanvasObject={(node, ctx, scale) => {
          const n = node as Node;
          const style = getNodeStyle(n.collection);
          const x = (node as { x?: number }).x ?? 0;
          const y = (node as { y?: number }).y ?? 0;
          const r = 6;

          /*-- 光晕层（外圈模糊） --*/
          ctx.save();
          ctx.shadowColor = style.glow;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(x, y, r + 2, 0, 2 * Math.PI, false);
          ctx.fillStyle = style.glow;
          ctx.fill();
          ctx.restore();

          /*-- 核心节点 --*/
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 2 * Math.PI, false);
          ctx.fillStyle = style.core;
          ctx.fill();

          /*-- 节点边框高光 --*/
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.lineWidth = 0.8;
          ctx.stroke();

          /*-- 文字标签（始终可见，阴影增强对比度） --*/
          if (scale <= 3) {
            const label = n.title.length > 18 ? n.title.slice(0, 18) + "…" : n.title;
            const fontSize = Math.max(10, 12 / Math.sqrt(scale));
            ctx.font = `500 ${fontSize}px "IBM Plex Sans", -apple-system, sans-serif`;

            /*-- 文字阴影（深色背景对比度保障） --*/
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(label, x + r + 5, y + 1);

            /*-- 文字本体 --*/
            ctx.fillStyle = style.text;
            ctx.fillText(label, x + r + 4, y);
          }
        }}
        onNodeClick={(node) => {
          const n = node as Node;
          if (!n?.url || n.url === "#") return;
          window.location.href = toAppUrl(n.url);
        }}
      />

      {/*-- 底部提示 --*/}
      <p className="kg-tip">点击节点跳转对应条目</p>
    </div>
  );
}
