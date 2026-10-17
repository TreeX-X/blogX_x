/*-- 「服务器」机箱岛（S1 舞台 / S3 绘线 / S4 全景交互层）
   底模与限角轨道相机在 server-case-scene；此层承载部件 hover/点击、
   常驻直角横折引线标注（编号+名称，锚点与渲染帧同步）与
   就近信息卡（点击后原位替换对应标签，「机箱即我」五模块）。
   点击同步相机拉近与 L2 手绘；卡片展开时相邻标识让位。
   Note: see .agents/notes/2026-10-15-server-tab-linecase-requirement--103be143.md --*/

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
    desc: "显卡负责渲染与输出，对应我的作品台 JanusX 工作台——想法在这里被渲染成看得见的东西。", side: "left", y: 0.66 },
  { key: "ram", no: "03", title: "内存条 ×4", hw: "记忆体", map: "知识库 · 我的记忆",
    desc: "四根内存条是记忆体，对应知识库与笔记——文章、Wiki、作品库都存放在这里。", side: "right", y: 0.4 },
  { key: "psu", no: "04", title: "电源仓", hw: "能量来源", map: "关于我",
    desc: "整机能量从这里供给，对应「关于我」——我是谁、在造什么、怎么找到我。", side: "right", y: 0.78 },
  { key: "mb", no: "05", title: "主板", hw: "总线枢纽", map: "中转站（建设中）",
    desc: "主板是贯通所有部件的总线枢纽，预留给独立产品「中转站」——一句话定位，内容待补。", side: "left", y: 0.44 },
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
  const anchorsRef = useRef<AnchorScreen[]>([]);

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

  /* 固定槽位与引线端点；卡片向槽位外侧展开，不改变引线几何。 */
  const layout = (anchors: AnchorScreen[], focusProgress = 0) => {
    anchorsRef.current = anchors;
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
    if (card) card.style.setProperty("--focus-progress", `${focusProgress}`);
    const stacked = window.matchMedia("(max-width: 720px)").matches;
    const slotWidth = stacked ? (w - 32) * 0.44 : Math.min(240, w * 0.22);
    const canvas = canvasRef.current;
    const canvasX = canvas?.offsetLeft ?? 0, canvasY = canvas?.offsetTop ?? 0;
    const baseRow = (key: PartId, y: number) => stacked
      ? ({ cpu: 64, ram: 208, gpu: h - 184, mb: 112, psu: h - 112 })[key] : y * h;
    const slots = PARTS.map(p => ({
      ...p,
      row: baseRow(p.key, p.y),
      height: labelSizeRef.current[p.key]?.lh ?? 28,
      top: baseRow(p.key, p.y) - (labelSizeRef.current[p.key]?.lh ?? 28) / 2,
    }));
    const selected = slots.find(p => p.key === activeKey);
    if (selected && card) {
      const width = `${slotWidth}px`;
      if (card.style.width !== width) card.style.width = width;
      const upper = selected.row < 320;
      const peers = slots.filter(p => p.side === selected.side && (!stacked || (p.row < 320) === upper));
      peers.sort((a, b) => a.row - b.row);
      const start = stacked && !upper ? h - 310 : 8;
      const end = stacked && upper ? 310 : h - 8;
      const otherHeight = peers.filter(p => p !== selected).reduce((sum, p) => sum + p.height + 16, 0);
      const maxHeight = `${end - start - otherHeight}px`;
      if (card.style.maxHeight !== maxHeight) card.style.maxHeight = maxHeight;
      selected.height = card.offsetHeight;
      // 先依原顺序向下排，底端超界时再从下向上收拢。只移动同侧相邻标识。
      let next = start;
      for (const p of peers) {
        p.top = Math.max(p.top, next);
        next = p.top + p.height + 16;
      }
      next = end;
      for (const p of peers.slice().reverse()) {
        p.top = Math.min(p.top, next - p.height);
        next = p.top - 16;
      }
    }
    for (const p of PARTS) {
      const anchor = anchors.find((a) => a.key === p.key);
      const label = labelRefs.current[p.key];
      if (!anchor || !label) continue;
      const ax = Number((anchor.x + canvasX).toFixed(2));
      const ay = Number((anchor.y + canvasY).toFixed(2));

      /* 槽位端：标签始终占位（激活时隐藏但保持定位，收起后不跳位）；
         卡片与标签的内缘重合，引线端点不变。 */
      const { lw = 0, lh = 0 } = labelSizeRef.current[p.key] ?? {};
      const lx = p.side === "left" ? 16 + slotWidth - lw : w - 16 - slotWidth;
      const slot = slots.find(s => s.key === p.key)!;
      const ly = Math.max(8, Math.min(p.key === activeKey ? slot.row - lh / 2 : slot.top, h - lh - 8));
      const pos = `${Math.round(lx)},${Math.round(ly)}`;
      if (pos !== cache.labelPos[p.key]) {
        cache.labelPos[p.key] = pos;
        label.style.left = `${Math.round(lx)}px`;
        label.style.top = `${Math.round(ly)}px`;
      }
      const ex = Math.round(p.side === "left" ? lx + lw + 6 : lx - 6);
      const ey = Math.round(p.key === activeKey
        ? Math.max(slot.top + 12, Math.min(slot.row, slot.top + slot.height - 12)) : ly + lh / 2);
      if (p.key === activeKey && card) {
        const cx0 = p.side === "left" ? 16 : lx;
        const cy0 = slot.top;
        const cpos = `${Math.round(cx0)},${Math.round(cy0)}`;
        if (cpos !== cache.cardPos) {
          cache.cardPos = cpos;
          card.style.left = `${Math.round(cx0)}px`;
          card.style.top = `${Math.round(cy0)}px`;
        }
      }

      /* 直角横折：水平离开部件 → 垂直折转 → 水平接入固定槽位。 */
      const lane = ({ gpu: 14, mb: 36, cpu: 14, ram: 36, psu: 58 })[p.key];
      const bx = p.side === "left" ? ex + lane : ex - lane;
      const pts = `${ax},${ay} ${bx},${ay} ${bx},${ey} ${ex},${ey}`;
      const poly = polyRefs.current[p.key];
      if (poly && pts !== cache.leadPts[p.key]) {
        cache.leadPts[p.key] = pts;
        poly.setAttribute("points", pts);
      }
      const dot = `${ax},${ay}`;
      if (dot !== cache.dotPos[p.key]) {
        cache.dotPos[p.key] = dot;
        for (const node of [ringRefs.current[p.key], coreRefs.current[p.key]]) {
          if (!node) continue;
          node.setAttribute("cx", `${ax}`);
          node.setAttribute("cy", `${ay}`);
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

  // 在浏览器绘制前完成卡片定位，切换部件时不会闪现上一张卡片的位置。
  useLayoutEffect(() => {
    activeRef.current = active;
    // 切换部件会重建卡片，必须同步写入新节点的位置。
    writeCacheRef.current.cardPos = "";
    layout(anchorsRef.current);
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    (async () => {
      const { createServerCaseScene } = await import("./server-case-scene");
      if (cancelled) return;
      const api = await createServerCaseScene(canvas);
      if (cancelled) { api.dispose(); return; }
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
              <polyline className="case-lead" ref={(el) => { polyRefs.current[p.key] = el; }} points="0,0 0,0 0,0 0,0" />
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
            aria-expanded={active === p.key}
            aria-controls="server-part-card"
            tabIndex={active === p.key ? -1 : 0}
            ref={(el) => { labelRefs.current[p.key] = el; }}
            onClick={() => setActive((prev) => (prev === p.key ? null : p.key))}
          >
            <span className="case-num">{p.no}</span>
            <span className="case-txt">{p.title}</span>
          </button>
        ))}
      </div>
      <aside
        key={active ?? "closed"}
        id="server-part-card"
        className={`case-card${active ? " is-show" : ""}`}
        ref={cardRef}
        data-active-part={active ?? ""}
        style={{ transformOrigin: activePart?.side === "left" ? "right center" : "left center" }}
        aria-hidden={!active}
        aria-live="polite"
      >
        {activePart && (
          <>
            <button type="button" className="case-card-close" aria-label="关闭" onClick={() => setActive(null)}>×</button>
            <div className="case-card-no">{activePart.no} / 部件特写</div>
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
