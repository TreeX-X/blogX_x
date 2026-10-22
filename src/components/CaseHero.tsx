/*-- 首页机箱 Hero：「树码空间」像素字 ⇄ 纸板壳机箱 原位双向变形 + 引线交互
   形态（2026-10-14 修订）：不遮罩、不换页——hero 区在原地展开为机箱，首页其余部分不变。
   变形编排：像素按目标位「印刷式」扫入（左上先落），中途色彩骤变、矢量早交棒，糊状中段最短。
   交互模型：机箱居中 · 点击部件腾开空间 · 卡片就近标识线 · 聚焦态卡片即标签 · 部件发光描记。
   Note: see .agents/notes/2026-10-14-home-case-hero-requirement--154e01dc.md --*/

import { useCallback, useEffect, useRef, useState } from "react";
import PixelWaveTitle from "./PixelWaveTitle";
import CaseSvg, { type PartKey, CALLOUTS } from "./CaseSvg";

type Mode = "title" | "toCase" | "case" | "toTitle";

type Cell = { x: number; y: number; r: number; g: number; b: number };

const CELL = 10;
const MORPH_MS = 1200;

type PartInfo = {
  no: string;
  title: string;
  hw: string;
  map: string;
  desc: string;
  routes: string[];
};

const PARTS: Record<PartKey, PartInfo> = {
  cpu: {
    no: "01", title: "CPU 一体式水冷头", hw: "思考核心 · 泵头",
    map: "AI 搜索与翻译管线",
    desc: "整台机器的思考核心：自然语言提问、双语翻译管线都从这里出发。冷排鳍片对应向量索引 blog_index——检索压力被它散掉。",
    routes: ["posts", "knowledge-base"],
  },
  gpu: {
    no: "02", title: "显卡 · 渲染单元", hw: "渲染力",
    map: "知识图谱",
    desc: "显卡负责「渲染」，知识图谱正是被渲染出来的那张关系网——向量相似度点亮节点，隐含联系被看见。",
    routes: [],
  },
  lcd: {
    no: "03", title: "9.2\" LCD 仪表屏", hw: "实时仪表",
    map: "站点内容计数",
    desc: "仪表盘即内容盘点——这座花园的「运行状态」实时上屏，与机箱丝印屏上的数字同源。",
    routes: [],
  },
  fans: {
    no: "04", title: "侧置风扇组", hw: "氛围 · 灯效",
    map: "fun-messages 氛围流",
    desc: "风扇是机箱的呼吸与氛围。对应站点的 fun-messages 氛围层——不承载主内容，但让整个空间有生命感。",
    routes: ["about"],
  },
  psu: {
    no: "05", title: "电源仓 PSU 舱", hw: "能量来源",
    map: "关于我 + 灵感箱",
    desc: "整机的能量从这里供给。对应「关于我」与灵感箱 idea box——这台机器的供电者，也是想法的集散地。",
    routes: ["about"],
  },
};

const smooth = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

export type CaseHeroProps = {
  text?: string;
  base: string;
  counts: Record<string, number>;
};

export default function CaseHero({ text = "树码空间", base, counts }: CaseHeroProps) {
  const [mode, setMode] = useState<Mode>("title");
  const [activePart, setActivePart] = useState<PartKey | null>(null);
  const [hoverPart, setHoverPart] = useState<PartKey | null>(null);
  const [cardSide, setCardSide] = useState<"left" | "right">("left");
  const [cardTop, setCardTop] = useState(40);
  const [boxH, setBoxH] = useState<number | undefined>(undefined);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const titleWrapRef = useRef<HTMLDivElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const titleHRef = useRef<number>(0);
  const modeRef = useRef<Mode>("title");
  modeRef.current = mode;

  /* ---------- 尺寸：case-hero 在标题态/机箱态之间平滑展开 ---------- */
  const measureTitleH = useCallback(() => {
    if (titleWrapRef.current) titleHRef.current = titleWrapRef.current.offsetHeight;
  }, []);

  useEffect(() => {
    measureTitleH();
    setBoxH(titleHRef.current || undefined);
    const onResize = () => {
      if (modeRef.current === "title") {
        measureTitleH();
        setBoxH(titleHRef.current || undefined);
      } else if (rootRef.current) {
        setBoxH((rootRef.current.clientWidth * 720) / 860);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measureTitleH]);

  /* ---------- 采样：标题像素（PixelWaveTitle 画布快照 → 根容器局部坐标） ---------- */
  const sampleTitle = useCallback((): Cell[] => {
    const cells: Cell[] = [];
    const root = rootRef.current;
    const wrap = titleWrapRef.current;
    const cv = wrap?.querySelector("canvas");
    const rect = (cv ?? wrap)?.getBoundingClientRect();
    const rootRect = root?.getBoundingClientRect();
    if (!rect || !rootRect) return cells;
    const ox = rect.left - rootRect.left;
    const oy = rect.top - rootRect.top;
    if (cv) {
      try {
        const s = document.createElement("canvas");
        s.width = cv.width;
        s.height = cv.height;
        const c = s.getContext("2d");
        if (c) {
          c.drawImage(cv, 0, 0);
          const data = c.getImageData(0, 0, s.width, s.height).data;
          const step = Math.max(4, Math.round(CELL * (cv.width / rect.width)));
          for (let y = 0; y < s.height; y += step) {
            for (let x = 0; x < s.width; x += step) {
              const i = (y * s.width + x) * 4;
              if (data[i + 3] > 120) {
                cells.push({
                  x: ox + (x / s.width) * rect.width,
                  y: oy + (y / s.height) * rect.height,
                  r: data[i], g: data[i + 1], b: data[i + 2],
                });
              }
            }
          }
        }
      } catch {
        /* 快照失败走文字采样兜底 */
      }
    }
    if (cells.length === 0) {
      const s = document.createElement("canvas");
      s.width = Math.max(2, Math.round(rect.width));
      s.height = Math.max(2, Math.round(rect.height));
      const c = s.getContext("2d");
      if (c) {
        c.font = `700 ${Math.round(rect.height * 0.72)}px "Noto Sans SC", sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#fff";
        c.fillText(text, s.width / 2, s.height / 2);
        const data = c.getImageData(0, 0, s.width, s.height).data;
        for (let y = 0; y < s.height; y += CELL) {
          for (let x = 0; x < s.width; x += CELL) {
            const i = (y * s.width + x) * 4;
            if (data[i + 3] > 120) {
              cells.push({ x: ox + x, y: oy + y, r: 185, g: 59, b: 40 });
            }
          }
        }
      }
    }
    return cells;
  }, [text]);

  /* ---------- 采样：机箱像素（栅格化 CaseSvg → 根容器局部坐标） ---------- */
  const sampleCase = useCallback(async (): Promise<Cell[]> => {
    const svg = stageWrapRef.current?.querySelector("svg.case-svg");
    const stageRect = stageWrapRef.current?.getBoundingClientRect();
    const rootRect = rootRef.current?.getBoundingClientRect();
    if (!svg || !stageRect || !rootRect) return [];
    const ox = stageRect.left - rootRect.left;
    const oy = stageRect.top - rootRect.top;
    const xml = new XMLSerializer().serializeToString(svg);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg rasterize failed"));
      img.src = url;
    });
    const s = document.createElement("canvas");
    s.width = Math.round(stageRect.width);
    s.height = Math.round(stageRect.height);
    const c = s.getContext("2d");
    if (!c) return [];
    c.drawImage(img, 0, 0, s.width, s.height);
    const data = c.getImageData(0, 0, s.width, s.height).data;
    const cells: Cell[] = [];
    for (let y = 0; y < s.height; y += CELL) {
      for (let x = 0; x < s.width; x += CELL) {
        const i = (y * s.width + x) * 4;
        if (data[i + 3] > 24) {
          cells.push({ x: ox + x, y: oy + y, r: data[i], g: data[i + 1], b: data[i + 2] });
        }
      }
    }
    return cells;
  }, []);

  /* ---------- 变形动画 ----------
     编排（2026-10-14 重做，解决长途飞行的糊状中段）：
     正向——标题像素自上而下「融化」（微下沉淡出）；机箱像素在各自目标位按对角波次
     「盖印」弹出（尺寸从大收小 + 淡入，颜色即目标色）；矢量在 0.55–0.85 交棒。
     反向——机箱自右下反向融化，标题像素盖印回来。全程一次连续运动。 */
  const runMorph = useCallback(
    (from: Cell[], to: Cell[], reverse: boolean, onDone: () => void) => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      const stage = stageWrapRef.current;
      const root = rootRef.current;
      if (!cv || !ctx || !stage || !root) return onDone();
      const w = root.clientWidth;
      const h = root.clientHeight;
      cv.width = w;
      cv.height = h;
      cv.style.opacity = "1";
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / MORPH_MS);
        ctx.clearRect(0, 0, w, h);
        if (!reverse) {
          for (const c of from) {
            const d = 0.22 * (c.y / Math.max(1, h));
            const melt = smooth(t, d, d + 0.32);
            const a = 1 - melt;
            if (a <= 0.02) continue;
            ctx.fillStyle = `rgba(185,59,40,${a})`;
            ctx.fillRect(c.x, c.y + melt * 10, CELL - 1, CELL - 1);
          }
          for (const c of to) {
            const d = 0.5 * ((c.x / Math.max(1, w) + c.y / Math.max(1, h)) / 2) + ((c.x * 7 + c.y * 13) % 10) * 0.004;
            const lt = smooth(t, 0.12 + d, 0.42 + d);
            if (lt <= 0.02) continue;
            const size = CELL + 2 - 3 * lt;
            const off = (CELL - 1 - size) / 2;
            ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${Math.min(1, lt * 1.5)})`;
            ctx.fillRect(c.x + off, c.y + off, size, size);
          }
          stage.style.opacity = String(smooth(t, 0.55, 0.85));
          cv.style.opacity = t < 0.86 ? "1" : String(1 - (t - 0.86) / 0.14);
        } else {
          for (const c of to) {
            const d = 0.42 * (1 - (c.x / Math.max(1, w) + c.y / Math.max(1, h)) / 2);
            const a = 1 - smooth(t, d, d + 0.3);
            if (a <= 0.02) continue;
            ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a})`;
            ctx.fillRect(c.x, c.y, CELL - 1, CELL - 1);
          }
          for (const c of from) {
            const d = 0.36 * (1 - c.y / Math.max(1, h));
            const lt = smooth(t, 0.12 + d * 0.5, 0.42 + d * 0.5);
            if (lt <= 0.02) continue;
            const size = CELL + 2 - 3 * lt;
            const off = (CELL - 1 - size) / 2;
            ctx.fillStyle = `rgba(185,59,40,${Math.min(1, lt * 1.5)})`;
            ctx.fillRect(c.x + off, c.y + off, size, size);
          }
          stage.style.opacity = String(1 - smooth(t, 0.05, 0.35));
          cv.style.opacity = t < 0.9 ? "1" : String(1 - (t - 0.9) / 0.1);
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          stage.style.opacity = "";
          cv.style.opacity = "";
          onDone();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    []
  );

  /* ---------- 进入机箱（原位展开） ---------- */
  const enterCase = useCallback(async () => {
    if (modeRef.current !== "title") return;
    const root = rootRef.current;
    if (root) setBoxH((root.clientWidth * 720) / 860);
    setMode("toCase");
    setActivePart(null);
    await new Promise((r) => requestAnimationFrame(r));
    try {
      const from = sampleTitle();
      const to = await sampleCase();
      if (from.length && to.length) {
        runMorph(from, to, false, () => setMode("case"));
      } else {
        setMode("case");
      }
    } catch {
      setMode("case");
    }
  }, [runMorph, sampleCase, sampleTitle]);

  /* ---------- 返回标题（原位收回） ---------- */
  const leaveCase = useCallback(async () => {
    if (modeRef.current !== "case") return;
    setActivePart(null);
    setMode("toTitle");
    try {
      const from = sampleTitle();
      const to = await sampleCase();
      if (from.length && to.length) {
        runMorph(from, to, true, () => {
          setMode("title");
          setBoxH(titleHRef.current || undefined);
        });
      } else {
        setMode("title");
        setBoxH(titleHRef.current || undefined);
      }
    } catch {
      setMode("title");
      setBoxH(titleHRef.current || undefined);
    }
  }, [runMorph, sampleCase, sampleTitle]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activePart) setActivePart(null);
      else if (modeRef.current === "case") void leaveCase();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePart, leaveCase]);

  /* ---------- 部件点击：腾开空间 + 就近卡片 ---------- */
  const handlePartClick = (part: PartKey) => {
    if (modeRef.current !== "case") return;
    if (activePart === part) {
      setActivePart(null);
      return;
    }
    const callout = CALLOUTS.find((c) => c.part === part);
    const h = boxH ?? rootRef.current?.clientHeight ?? 0;
    if (callout && h) {
      const ratioY = callout.end[1] / 720;
      setCardSide(callout.side);
      setCardTop(Math.max(8, h * ratioY - 52));
    }
    setActivePart(part);
  };

  const info = activePart ? PARTS[activePart] : null;
  const activeCallout = activePart ? CALLOUTS.find((c) => c.part === activePart) : null;

  return (
    <div
      ref={rootRef}
      className={"case-hero " + (mode === "title" ? "in-title" : "in-case")}
      style={boxH !== undefined ? { minHeight: boxH } : undefined}
    >
      <div
        ref={titleWrapRef}
        className={"case-hero-title" + (mode !== "title" ? " away" : "")}
        onClick={() => void enterCase()}
        title="点击进入机箱"
      >
        <PixelWaveTitle text={text} />
      </div>

      <div
        ref={stageWrapRef}
        className={
          "case-stage" +
          (mode !== "title" ? " on" : "") +
          (activePart && activeCallout
            ? activeCallout.side === "left"
              ? " shift-right"
              : " shift-left"
            : "") +
          (activePart ? " has-active" : "")
        }
      >
        <CaseSvg
          counts={counts}
          activePart={activePart}
          hoverPart={hoverPart}
          onPartClick={handlePartClick}
          onPartHover={setHoverPart}
        />
      </div>

      <canvas
        ref={canvasRef}
        className={"morph-canvas" + (mode === "toCase" || mode === "toTitle" ? "" : " hidden")}
      />

      {mode === "case" && info && (
        <aside className={"case-card show " + cardSide} style={{ top: cardTop }} aria-live="polite">
          <button className="card-close" onClick={() => setActivePart(null)} aria-label="关闭">
            ×
          </button>
          <div className="p-no">{info.no}</div>
          <div className="p-title">{info.title}</div>
          <div className="p-hw">HW — {info.hw}</div>
          <div className="p-map">
            <span className="arrow">→</span>
            <span className="map-name">{info.map}</span>
          </div>
          <p className="p-desc">{info.desc}</p>
          {activePart === "lcd" && (
            <div className="p-stats">
              {[
                ["posts", counts.posts],
                ["kb", counts.knowledgeBase],
                ["wiki", counts.wiki],
                ["repos", counts.repos],
                ["projects", counts.projects],
                ["skills", counts.skills],
                ["toolbox", counts.toolbox],
              ].map(([k, v]) => (
                <div className="stat" key={String(k)}>
                  <span className="k">{k}</span>
                  <span className="v">{v ?? 0}</span>
                </div>
              ))}
            </div>
          )}
          {info.routes.length > 0 && (
            <div className="p-route">
              {info.routes.map((r) => (
                <a
                  className="route-chip"
                  key={r}
                  href={`${base.replace(/\/$/, "")}/${r}`}
                >
                  /{r}
                </a>
              ))}
            </div>
          )}
          <div className="p-foot">
            <span>MAP SPEC</span>
            <span>部件硬件职能 = 栏目内容职能</span>
          </div>
        </aside>
      )}

      {mode === "case" && (
        <div className="case-hint">
          <button className="back-btn" onClick={() => void leaveCase()}>
            ⟲ 变化回「{text}」
          </button>
          <span>
            <em>点击部件 01–05</em> — 机箱腾开空间，卡片就近标识线
          </span>
        </div>
      )}
    </div>
  );
}
