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

const NODE_COLORS: Record<string, string> = {
  posts: "#111111",
  notes: "#6b7280",
};

function getNodeColor(collection: string) {
  return NODE_COLORS[collection] || "#9ca3af";
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
      setHeight(Math.max(360, Math.floor(nextWidth * 1.2)));
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
    return () => {
      active = false;
    };
  }, [apiUrl]);

  useEffect(() => {
    let active = true;
    import("react-force-graph-2d")
      .then((mod) => {
        if (!active) return;
        setGraphImpl(() => mod.default);
      })
      .catch(() => {
        if (!active) return;
        setError("图谱渲染库加载失败");
      });
    return () => {
      active = false;
    };
  }, []);

  const graphData = useMemo(() => ({ nodes: payload.nodes, links: payload.links }), [payload]);

  useEffect(() => {
    if (!graphRef.current || payload.nodes.length === 0) return;
    graphRef.current.d3Force("charge")?.strength(-120);
    graphRef.current.d3Force("link")?.distance(75);
    graphRef.current.zoomToFit(500, 20);
  }, [payload]);

  if (loading || !GraphImpl) {
    return (
      <div className="kg-panel" ref={containerRef}>
        <p className="meta">知识图谱加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kg-panel" ref={containerRef}>
        <p className="meta">知识图谱加载失败：{error}</p>
      </div>
    );
  }

  if (!payload.nodes.length || !payload.links.length) {
    return (
      <div className="kg-panel" ref={containerRef}>
        <p className="meta">暂无足够的关联数据生成图谱。</p>
      </div>
    );
  }

  return (
    <div className="kg-panel" ref={containerRef}>
      <p className="kg-meta">节点 {payload.nodeCount} / 关系 {payload.linkCount}</p>
      <GraphImpl
        ref={graphRef}
        width={width}
        height={height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        enableNodeDrag={false}
        cooldownTicks={120}
        linkWidth={(link) => Math.max(0.8, Math.min(2.2, Number((link as Link).similarity || 0) * 4))}
        linkColor={() => "rgba(82,82,82,0.55)"}
        nodeRelSize={5}
        nodeLabel={(node) => `${(node as Node).title} (${(node as Node).collection})`}
        nodeCanvasObject={(node, ctx, scale) => {
          const n = node as Node;
          const label = n.title || n.id;
          const fontSize = Math.max(8, 11 / scale);
          const x = (node as { x?: number }).x ?? 0;
          const y = (node as { y?: number }).y ?? 0;
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, 2 * Math.PI, false);
          ctx.fillStyle = getNodeColor(n.collection);
          ctx.fill();
          if (scale > 2.1) return;
          ctx.font = `${fontSize}px IBM Plex Sans, sans-serif`;
          ctx.fillStyle = "rgba(10,10,10,0.85)";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(label.slice(0, 16), x + 8, y);
        }}
        onNodeClick={(node) => {
          const n = node as Node;
          if (!n?.url || n.url === "#") return;
          window.location.href = n.url;
        }}
      />
      <p className="kg-tip meta">点击节点可跳转到对应文章或笔记</p>
    </div>
  );
}
