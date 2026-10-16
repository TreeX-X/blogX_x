/*-- 「服务器」机箱岛（S1 舞台 / S3 绘线 / S4 全景交互层）
   底模与限角轨道相机在 server-case-scene；此层承载部件 hover/点击、
   常驻横折引线标注（编号+名称，锚点投影跟随相机、量化防抖）与
   就近信息卡（点击后原位替换对应标签，「机箱即我」五模块）。
   「点击拉近 × 细节丰富」归 S5。
   Note: see .agents/notes/2026-10-15-server-tab-linecase-requirement--103be143.md --*/

import { useEffect, useRef, useState } from "react";
import type { AnchorScreen, PartKey, ServerSceneApi } from "./server-case-scene";

type PartId = "cpu" | "gpu" | "ram" | "mb" | "psu";

interface PartInfo {
  key: PartId;
  no: string;
  title: string;
  hw: string;
  map: string;
  desc: string;
  side: "left" | "right";
  y: number;
}

/* 内容映射（需求 2026-10-16「机箱即我」）：部件职能 = 我的数字身份；风扇为纯结构件不设标注。 */
const PARTS: PartInfo[] = [
  { key: "cpu", no: "01", title: "CPU 水冷头", hw: "思考核心 · 泵头", map: "WorkFlowX · 我怎么工作",
    desc: "这台机器的思考核心。多智能体编排方法论从这里出发——先想清楚，再动手。", side: "right", y: 0.24 },
  { key: "gpu", no: "02", title: "显卡 · 渲染单元", hw: "渲染输出", map: "JanusX · 我的作品台",
    desc: "显卡负责渲染与输出，对应我的作品台 JanusX 工作台——想法在这里被渲染成看得见的东西。", side: "left", y: 0.44 },
  { key: "ram", no: "03", title: "内存条 ×4", hw: "记忆体", map: "知识库 · 我的记忆",
    desc: "四根内存条是记忆体，对应知识库与笔记——文章、Wiki、作品库都存放在这里。", side: "right", y: 0.4 },
  { key: "psu", no: "04", title: "电源仓", hw: "能量来源", map: "关于我",
    desc: "整机能量从这里供给，对应「关于我」——我是谁、在造什么、怎么找到我。", side: "right", y: 0.78 },
  { key: "mb", no: "05", title: "主板", hw: "总线枢纽", map: "中转站（建设中）",
    desc: "主板是贯通所有部件的总线枢纽，预留给独立产品「中转站」——一句话定位，内容待补。", side: "left", y: 0.66 },
];

export default function ServerCase() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<ServerSceneApi | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const groupRefs = useRef<Record<string, SVGGElement | null>>({});
  const polyRefs = useRef<Record<string, SVGPolylineElement | null>>({});
  const ringRefs = useRef<Record<string, SVGCircleElement | null>>({});
  const coreRefs = useRef<Record<string, SVGCircleElement | null>>({});

  const [drawn, setDrawn] = useState(false);
  const [active, setActive] = useState<PartId | null>(null);
  const [hover, setHover] = useState<PartId | null>(null);
  const activeRef = useRef<PartId | null>(null);
  useEffect(() => { activeRef.current = active; }, [active]);

  /* 标签尺寸缓存：内容不变，仅在容器尺寸变化、字体就绪后测量，
     避免每帧 offsetWidth 强制布局。 */
  const labelSizeRef = useRef<Record<string, { lw: number; lh: number }>>({});
  const measureLabels = () => {
    for (const p of PARTS) {
      const el = labelRefs.current[p.key];
      if (el) labelSizeRef.current[p.key] = { lw: el.offsetWidth, lh: el.offsetHeight };
    }
  };
  const writeCacheRef = useRef({
    view: "", labelPos: {} as Record<string, string>, cardPos: "",
    leadPts: {} as Record<string, string>, dotPos: {} as Record<string, string>,
    vis: {} as Record<string, string>,
  });

  /* 每帧把锚点投影写进 DOM：坐标已在场景侧取整，槽位整数量化 + 变更检测
     （静置时零写入，消除亚像素抖动）。激活部件的卡片原位替换其标签。 */
  const layout = (anchors: AnchorScreen[]) => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;
    const w = container.clientWidth, h = container.clientHeight;
    const cache = writeCacheRef.current;
    const view = `${w}x${h}`;
    if (view !== cache.view) {
      cache.view = view;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      measureLabels();
    }
    const activeKey = activeRef.current;
    const card = cardRef.current;
    for (const p of PARTS) {
      const anchor = anchors.find((a) => a.key === p.key);
      const label = labelRefs.current[p.key];
      if (!anchor || !label) continue;

      /* 槽位端：标签始终占位（激活时隐藏但保持定位，收起后不跳位）；
         激活部件由卡片接管同一槽位，引线水平段改接卡片内缘。 */
      const { lw = 0, lh = 0 } = labelSizeRef.current[p.key] ?? {};
      const lx = p.side === "left" ? 28 : w - 28 - lw;
      const ly = Math.max(8, Math.min(p.y * h - lh / 2, h - lh - 8));
      const pos = `${Math.round(lx)},${Math.round(ly)}`;
      if (pos !== cache.labelPos[p.key]) {
        cache.labelPos[p.key] = pos;
        label.style.left = `${Math.round(lx)}px`;
        label.style.top = `${Math.round(ly)}px`;
      }
      let ex = p.side === "left" ? lx + lw + 6 : lx - 6;
      let ey = ly + lh / 2;
      if (p.key === activeKey && card) {
        const cw = card.offsetWidth || 300, ch = card.offsetHeight || 180;
        const cx0 = Math.max(12, Math.min(p.side === "left" ? 28 : w - 28 - cw, w - cw - 12));
        const cy0 = Math.max(8, Math.min(p.y * h - ch / 2, h - ch - 8));
        const cpos = `${Math.round(cx0)},${Math.round(cy0)}`;
        if (cpos !== cache.cardPos) {
          cache.cardPos = cpos;
          card.style.left = `${Math.round(cx0)}px`;
          card.style.top = `${Math.round(cy0)}px`;
        }
        ex = p.side === "left" ? cx0 + cw + 6 : cx0 - 6;
        ey = cy0 + ch / 2;
      }

      /* 横折线：锚点 → 斜段 → 折点 → 水平段接入槽位端（工业图解引线语汇） */
      const bx = p.side === "left" ? ex + 28 : ex - 28;
      const pts = `${anchor.x},${anchor.y} ${Math.round(bx)},${Math.round(ey)} ${Math.round(ex)},${Math.round(ey)}`;
      const poly = polyRefs.current[p.key];
      if (poly && pts !== cache.leadPts[p.key]) {
        cache.leadPts[p.key] = pts;
        poly.setAttribute("points", pts);
      }
      const dot = `${anchor.x},${anchor.y}`;
      if (dot !== cache.dotPos[p.key]) {
        cache.dotPos[p.key] = dot;
        for (const node of [ringRefs.current[p.key], coreRefs.current[p.key]]) {
          if (!node) continue;
          node.setAttribute("cx", `${anchor.x}`);
          node.setAttribute("cy", `${anchor.y}`);
        }
      }
      const vis = anchor.visible ? "1" : "0";
      if (groupRefs.current[p.key] && vis !== cache.vis[p.key]) {
        cache.vis[p.key] = vis;
        groupRefs.current[p.key]!.style.opacity = vis;
      }
    }
    if (card && !activeKey && cache.cardPos !== "12,12") {
      // 收起时归位，避免残留的桌面端坐标在窄视口造成横向溢出。
      cache.cardPos = "12,12";
      card.style.left = "12px";
      card.style.top = "12px";
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    (async () => {
      const { createServerCaseScene } = await import("./server-case-scene");
      if (cancelled) return;
      const api = await createServerCaseScene(canvas);
      sceneRef.current = api;
      api.resize();
      api.setActivePart(activeRef.current);
      api.onHover((key: PartKey | null) => setHover(key as PartId | null));
      api.onSelect((key: PartKey | null) => setActive((prev) => (prev === key ? null : (key as PartId | null))));
      api.onFrame(layout);
      api.whenDrawn.then(() => { if (!cancelled) setDrawn(true); });
    })();
    measureLabels();
    document.fonts?.ready.then(() => { if (!cancelled) measureLabels(); });
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onResize = () => sceneRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    sceneRef.current?.setActivePart(active);
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const activePart = PARTS.find((p) => p.key === active) ?? null;

  return (
    <div className={`server-case${drawn ? " is-drawn" : ""}`} ref={containerRef}>
      <canvas ref={canvasRef} className="server-canvas" aria-label="可拖拽旋转、滚轮缩放、点击部件的机箱结构模型" />
      <div className="case-overlay">
        <svg className="case-leaders" ref={svgRef} aria-hidden="true">
          {PARTS.map((p) => (
            <g
              key={p.key}
              data-part={p.key}
              ref={(el) => { groupRefs.current[p.key] = el; }}
            >
              <polyline className="case-lead" ref={(el) => { polyRefs.current[p.key] = el; }} points="0,0 0,0 0,0" />
              <circle className="case-anchor-ring" r="8" cx="0" cy="0" ref={(el) => { ringRefs.current[p.key] = el; }} />
              <circle className="case-anchor-core" r="2.6" cx="0" cy="0" ref={(el) => { coreRefs.current[p.key] = el; }} />
            </g>
          ))}
        </svg>
        {PARTS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`case-lbl${active === p.key ? " is-active" : ""}${active && active !== p.key ? " is-dim" : ""}${hover === p.key ? " is-hover" : ""}`}
            data-part={p.key}
            ref={(el) => { labelRefs.current[p.key] = el; }}
            onClick={() => setActive((prev) => (prev === p.key ? null : p.key))}
          >
            <span className="case-num">{p.no}</span>
            <span className="case-txt">{p.title}</span>
          </button>
        ))}
      </div>
      <aside
        className={`case-card${active ? " is-show" : ""}`}
        ref={cardRef}
        data-active-part={active ?? ""}
        aria-hidden={!active}
        aria-live="polite"
      >
        {activePart && (
          <>
            <button type="button" className="case-card-close" aria-label="关闭" onClick={() => setActive(null)}>×</button>
            <div className="case-card-no">{activePart.no}</div>
            <h2 className="case-card-title">{activePart.title}</h2>
            <div className="case-card-hw">HW — {activePart.hw}</div>
            <p className="case-card-map"><span className="arrow">→</span>{activePart.map}</p>
            <p className="case-card-desc">{activePart.desc}</p>
            <div className="case-card-foot"><span>模块映射</span><span>部件职能 = 我的数字身份</span></div>
          </>
        )}
      </aside>
      <p className={`server-hint${drawn ? " is-ready" : ""}`}>拖拽观察 · 滚轮缩放 · 点击部件</p>
    </div>
  );
}
