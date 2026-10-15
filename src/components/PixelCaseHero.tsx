/*-- 首页机箱 Hero：「树码空间」像素字 ⇄ 像素数码 3D 机箱 原位双向变形 + 部件交互
   形态（2026-10-15 定案）：全宽舞台 + 图谱下移；暖纸像素陶瓷体素；仅就近介绍卡（本期无跳转）。
   Note: see .agents/notes/2026-10-15-pixel-case-hero-requirement--f47e324c.md --*/

import { useCallback, useEffect, useRef, useState } from "react";
import PixelWaveTitle from "./PixelWaveTitle";
import type { PartKey, SceneApi } from "./pixel-case-scene";

type Mode = "title" | "toCase" | "case" | "toTitle";

type PartInfo = {
  no: string;
  title: string;
  hw: string;
  map: string;
  desc: string;
  side: "left" | "right";
};

const PARTS: Record<PartKey, PartInfo> = {
  cpu: {
    no: "01", title: "CPU 一体式水冷头", hw: "思考核心 · 泵头",
    map: "AI 搜索与翻译管线",
    desc: "整台机器的思考核心：自然语言提问、双语翻译管线都从这里出发。冷排鳍片对应向量索引 blog_index——检索压力被它散掉。",
    side: "left",
  },
  gpu: {
    no: "02", title: "显卡 · 渲染单元", hw: "渲染力",
    map: "知识图谱",
    desc: "显卡负责「渲染」，知识图谱正是被渲染出来的那张关系网——向量相似度点亮节点，隐含联系被看见。",
    side: "left",
  },
  lcd: {
    no: "03", title: '9.2" LCD 仪表屏', hw: "实时仪表",
    map: "站点内容计数",
    desc: "仪表盘即内容盘点——这座花园的「运行状态」实时上屏，与机箱屏上的数字同源。",
    side: "right",
  },
  fans: {
    no: "04", title: "侧置风扇组", hw: "氛围 · 灯效",
    map: "fun-messages 氛围流",
    desc: "风扇是机箱的呼吸与氛围。对应站点的 fun-messages 氛围层——不承载主内容，但让整个空间有生命感。",
    side: "right",
  },
  psu: {
    no: "05", title: "电源仓 PSU 舱", hw: "能量来源",
    map: "关于我 + 灵感箱",
    desc: "整机的能量从这里供给。对应「关于我」与灵感箱 idea box——这台机器的供电者，也是想法的集散地。",
    side: "right",
  },
};

export type PixelCaseHeroProps = {
  text?: string;
  counts: Record<string, number>;
};

export default function PixelCaseHero({ text = "树码空间", counts }: PixelCaseHeroProps) {
  const [mode, setMode] = useState<Mode>("title");
  const [activePart, setActivePart] = useState<PartKey | null>(null);
  const [hoverPart, setHoverPart] = useState<PartKey | null>(null);
  const [cardSide, setCardSide] = useState<"left" | "right">("left");
  const [cardTop, setCardTop] = useState(48);
  const [boxH, setBoxH] = useState<number | undefined>(undefined);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const titleWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const sceneLoadRef = useRef<Promise<SceneApi | null> | null>(null);
  const modeRef = useRef<Mode>("title");
  const titleHRef = useRef(0);
  modeRef.current = mode;

  const reducedMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 高度：标题态/机箱态平滑展开（机箱态视口约束，全宽下不无限拉高） ---------- */
  const caseH = (root: HTMLElement) =>
    Math.round(Math.min(window.innerHeight * 0.72, Math.max(320, root.clientWidth * 0.58)));

  const measureTitleH = useCallback(() => {
    if (titleWrapRef.current) titleHRef.current = titleWrapRef.current.offsetHeight;
  }, []);

  useEffect(() => {
    measureTitleH();
    setBoxH(titleHRef.current || undefined);
    const onResize = () => {
      sceneRef.current?.resize();
      if (modeRef.current === "title") {
        measureTitleH();
        setBoxH(titleHRef.current || undefined);
      } else if (rootRef.current) {
        setBoxH(caseH(rootRef.current));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measureTitleH]);

  useEffect(
    () => () => {
      sceneRef.current?.dispose();
    },
    []
  );

  /* ---------- 首页布局：机箱态全宽舞台 + 图谱下移 ---------- */
  const setHomeCaseMode = (on: boolean) => {
    rootRef.current?.closest(".home-experience")?.classList.toggle("case-mode", on);
  };

  /* ---------- 标题像素采样 → 画布 CSS 像素对（舞台按当前相机反投影到 z=0） ---------- */
  const sampleTitleWorld = useCallback((): Float32Array => {
    const wrap = titleWrapRef.current;
    const cv = wrap?.querySelector("canvas");
    const rect = (cv ?? wrap)?.getBoundingClientRect();
    if (!rect || !rect.width) return new Float32Array(0);
    const pts: number[] = [];
    const push = (cssX: number, cssY: number) => {
      pts.push(cssX, cssY);
    };
    if (cv) {
      try {
        const s = document.createElement("canvas");
        s.width = cv.width;
        s.height = cv.height;
        const c = s.getContext("2d");
        if (c) {
          c.drawImage(cv, 0, 0);
          const data = c.getImageData(0, 0, s.width, s.height).data;
          const step = Math.max(6, Math.round(cv.width / rect.width / 1.4));
          for (let y = 0; y < s.height; y += step) {
            for (let x = 0; x < s.width; x += step) {
              const i = (y * s.width + x) * 4;
              if (data[i + 3] > 120) {
                push(rect.left + (x / s.width) * rect.width, rect.top + (y / s.height) * rect.height);
              }
            }
          }
        }
      } catch {
        /* 采样失败走稀疏网格兜底 */
      }
    }
    if (pts.length === 0) {
      for (let gx = 0; gx < 40; gx++) {
        for (let gy = 0; gy < 10; gy++) {
          push(rect.left + (gx / 40) * rect.width, rect.top + (gy / 10) * rect.height);
        }
      }
    }
    return new Float32Array(pts);
  }, []);

  /* ---------- 舞台懒加载 ---------- */
  const ensureScene = useCallback(async (): Promise<SceneApi | null> => {
    if (sceneRef.current) return sceneRef.current;
    if (!sceneLoadRef.current) {
      sceneLoadRef.current = (async () => {
        try {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          const { createPixelCaseScene } = await import("./pixel-case-scene");
          const lite = window.matchMedia("(max-width: 768px)").matches;
          const api = await createPixelCaseScene(canvas, { counts, lite });
          sceneRef.current = api;
          api.resize();
          return api;
        } catch {
          return null;
        }
      })();
    }
    return sceneLoadRef.current;
  }, [counts]);

  /* ---------- 进入机箱 ---------- */
  const enterCase = useCallback(async () => {
    if (modeRef.current !== "title") return;
    const root = rootRef.current;
    if (root) setBoxH(caseH(root));
    setHomeCaseMode(true);
    setMode("toCase");
    setActivePart(null);
    await new Promise((r) => requestAnimationFrame(r));
    const from = sampleTitleWorld();
    const scene = await ensureScene();
    if (scene && from.length) {
      scene.morphIn(from, reducedMotion(), () => setMode("case"));
    } else {
      setMode("case");
    }
  }, [ensureScene, sampleTitleWorld]);

  /* ---------- 返回标题 ---------- */
  const leaveCase = useCallback(async () => {
    if (modeRef.current !== "case") return;
    setActivePart(null);
    setHoverPart(null);
    setMode("toTitle");
    sceneRef.current?.setActivePart(null);
    sceneRef.current?.setCardShift(null);
    const from = sampleTitleWorld();
    const scene = sceneRef.current;
    const done = () => {
      setMode("title");
      setHomeCaseMode(false);
      setBoxH(titleHRef.current || undefined);
    };
    if (scene && from.length && !reducedMotion()) {
      scene.morphOut(from, false, done);
    } else {
      done();
    }
  }, [sampleTitleWorld]);

  /* ---------- Esc：先关卡片，再退出机箱 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activePart) {
        setActivePart(null);
        sceneRef.current?.setActivePart(null);
        sceneRef.current?.setCardShift(null);
      } else if (modeRef.current === "case") {
        void leaveCase();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePart, leaveCase]);

  /* ---------- 部件点击：亮起/放大 + 相机最佳视角 + 就近卡片 ---------- */
  const handlePartClick = (part: PartKey | null) => {
    if (modeRef.current !== "case") return;
    const next = part && activePart !== part ? part : null;
    setActivePart(next);
    sceneRef.current?.setActivePart(next);
    if (!next) {
      sceneRef.current?.setCardShift(null);
      return;
    }
    const info = PARTS[next];
    setCardSide(info.side);
    sceneRef.current?.setCardShift(info.side);
    const place = () => {
      const scene = sceneRef.current;
      const root = rootRef.current;
      if (!scene || !root || modeRef.current !== "case") return;
      const p = scene.projectPart(next);
      const r = root.getBoundingClientRect();
      setCardTop(Math.max(8, Math.min(r.height - 260, p.y - r.top - 60)));
    };
    place();
    window.setTimeout(place, 480); // 相机趋近后再校正一次
    window.setTimeout(place, 900);
  };

  /* ---------- 指针拾取 ---------- */
  const onStageMove = (e: React.PointerEvent) => {
    const scene = sceneRef.current;
    if (!scene || modeRef.current !== "case") return;
    const hit = scene.pickAt(e.clientX, e.clientY);
    if (hit !== hoverPart) {
      setHoverPart(hit);
      scene.setHoverPart(hit);
    }
  };
  const onStageLeave = () => {
    setHoverPart(null);
    sceneRef.current?.setHoverPart(null);
  };

  const info = activePart ? PARTS[activePart] : null;

  return (
    <div
      ref={rootRef}
      className={"pcx-root " + (mode === "title" ? "in-title" : "in-case")}
      style={boxH !== undefined ? { minHeight: boxH } : undefined}
    >
      <div
        ref={titleWrapRef}
        className={"pcx-title" + (mode !== "title" ? " away" : "")}
        onClick={() => void enterCase()}
        title="点击进入机箱"
      >
        <PixelWaveTitle text={text} />
      </div>

      <canvas
        ref={canvasRef}
        className={"pcx-canvas" + (mode === "title" ? " off" : " on") + (hoverPart ? " hot" : "")}
        onPointerMove={onStageMove}
        onPointerLeave={onStageLeave}
        onClick={(e) => {
          const scene = sceneRef.current;
          if (!scene || modeRef.current !== "case") return;
          handlePartClick(scene.pickAt(e.clientX, e.clientY));
        }}
      />

      {mode === "case" && info && (
        <aside
          className={"pcx-card show " + cardSide + (hoverPart === activePart ? " glow" : "")}
          style={{ top: cardTop }}
          aria-live="polite"
        >
          <button className="card-close" onClick={() => handlePartClick(null)} aria-label="关闭">
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
          <div className="p-foot">
            <span>MAP SPEC</span>
            <span>部件硬件职能 = 栏目内容职能</span>
          </div>
        </aside>
      )}

      {mode === "case" && (
        <div className="pcx-hint">
          <button className="back-btn" onClick={() => void leaveCase()}>
            ⟲ 变化回「{text}」
          </button>
          <span>
            <em>点击部件 01–05</em> — 机箱自动旋转到最佳视角，卡片就近介绍
          </span>
        </div>
      )}
    </div>
  );
}
