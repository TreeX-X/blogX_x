import { useEffect, useRef } from "react";

interface Props {
  text?: string;
  className?: string;
  cell?: number; // 显示画布每格逻辑像素
  sampleCell?: number; // 采样画布每格像素（越小分辨率越高）
  fontPx?: number; // 采样字号
  fontFamily?: string; // 采样字体栈（默认中文像素标题用）
  waveScale?: number; // 波动强度倍率（默认 1 = hero 大标题观感）
  animated?: boolean;
}

const DEFAULT_FONT_FAMILY = `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;

/**
 * 从字体栈中提取第一个可直接被 document.fonts.load 解析的字体名。
 * 丢弃 var(--xxx) 片段（CSS 变量在 FontFace API 不可用）与多余 fallback，
 * 返回带引号的单一字体名（如 `"Geist Mono"`）；若全空则返回 undefined。
 */
function pickLoadableFont(stack: string): string | undefined {
  const cleaned = stack
    // 移除 var(--xxx) / var(--xxx, fallback) 片段
    .replace(/var\([^)]*\)/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const name of cleaned) {
    if (!name) continue;
    // monospace / sans-serif 等通用族名无法被 fonts.load 解析为具体字体
    if (/^(monospace|sans-serif|serif|system-ui|cursive|fantasy)$/i.test(name)) continue;
    return name.startsWith('"') || name.startsWith("'") ? name : `"${name}"`;
  }
  return undefined;
}

export default function PixelWaveTitle({
  text = "树码空间",
  className,
  cell = 9,
  sampleCell = 15,
  fontPx = 260,
  fontFamily = DEFAULT_FONT_FAMILY,
  waveScale = 1,
  animated = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let grid: boolean[][] = [];
    let cols = 0;
    let rows = 0;
    let active = true;
    const isScrollBrand = className?.split(" ").includes("brand-wave") ?? false;
    let waveProgress = isScrollBrand
      ? Number.parseFloat(
          document.querySelector<HTMLElement>(".site-header")?.style.getPropertyValue("--brand-progress") || "0"
        )
      : 0;

    const cs = getComputedStyle(canvas);
    const color = cs.getPropertyValue("--accent").trim() || "#b93b28";

    const sample = () => {
      const sc = document.createElement("canvas");
      const sctx = sc.getContext("2d");
      if (!sctx) return;
      const font = `600 ${fontPx}px ${fontFamily}`;
      sctx.font = font;
      const w = sctx.measureText(text).width;
      cols = Math.ceil(w / sampleCell) + 2;
      rows = Math.ceil((fontPx * 1.2) / sampleCell);
      sc.width = cols * sampleCell;
      sc.height = rows * sampleCell;
      // canvas 尺寸变更后上下文状态被重置，需重设 font
      sctx.font = font;
      sctx.textBaseline = "middle";
      sctx.fillStyle = "#000";
      sctx.fillText(text, sampleCell, (rows * sampleCell) / 2);
      const data = sctx.getImageData(0, 0, sc.width, sc.height).data;
      grid = [];
      for (let y = 0; y < rows; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < cols; x++) {
          const px = Math.floor((x + 0.5) * sampleCell);
          const py = Math.floor((y + 0.5) * sampleCell);
          const a = (py * sc.width + px) * 4 + 3; // alpha
          row.push(data[a] > 128);
        }
        grid.push(row);
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cols * cell * dpr);
      canvas.height = Math.round(rows * cell * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
      }
    };

    const draw = (t: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = cols * cell;
      const H = rows * cell;
      ctx.clearRect(0, 0, W, H);
      // 顶栏滚动时由事件直接传入进度，避免在每个像素动画帧读取计算样式。
      const ws = animated ? waveScale * (1 - waveProgress * 0.72) : 0;
      // 横向扫描线增亮带位置（在 cols 之外循环，留缓冲）
      const sweepCenter = (t * 0.06) % (cols + 14) - 7;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!grid[y]?.[x]) continue;
          // 对角行波：明暗起伏
          const phase = 0.22 * x + 0.22 * y - 0.003 * t;
          const s = 0.5 + 0.5 * Math.sin(phase); // 0..1
          // 扫描线增亮
          const sweep = Math.max(0, 1 - Math.abs(x - sweepCenter) / 6); // 0..1
          // 垂直微浮
          const bob = Math.sin(0.18 * y + 0.004 * t) * 0.1 * ws; // -0.1ws..0.1ws
          // 波动项乘以 ws：compact 态收敛（更安静、更小），hero 态保持原观感
          const alpha = Math.min(1, 0.58 + (0.28 * s + 0.14 * sweep) * ws);
          const size = cell * (0.76 + (0.14 * s + 0.08 * sweep) * ws);
          const cx = x * cell + cell / 2;
          const cy = y * cell + cell / 2 + bob * cell;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
      if (animated && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const onBrandProgress = (event: Event) => {
      waveProgress = Math.min(1, Math.max(0, (event as CustomEvent<number>).detail));
    };
    const onVisibilityChange = () => {
      cancelAnimationFrame(raf);
      if (animated && !document.hidden) raf = requestAnimationFrame(draw);
    };
    if (animated && isScrollBrand) window.addEventListener("brand-progress", onBrandProgress);
    if (animated) document.addEventListener("visibilitychange", onVisibilityChange);

    const start = () => {
      const begin = () => {
        if (!active) return;
        cancelAnimationFrame(raf);
        sample();
        const hasOn = grid.some((row) => row.some((v) => v));
        if (!hasOn) {
          // 兜底：网格全空时静态绘制文字（用逻辑尺寸，dpr transform 下也正确）
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const logicalH = rows * cell || canvas.height;
            ctx.clearRect(0, 0, cols * cell, logicalH);
            ctx.fillStyle = color;
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.font = `600 ${logicalH * 0.82}px ${fontFamily}`;
            ctx.fillText(text, 0, logicalH / 2);
          }
          return;
        }
        if (animated) raf = requestAnimationFrame(draw);
        else draw(0);
      };

      // 先用可用的系统字体立即绘制；目标字体加载后再精确重采样。
      begin();
      const loadFont = pickLoadableFont(fontFamily);
      if (loadFont) {
        document.fonts.load(`600 ${fontPx}px ${loadFont}`).then(begin).catch(() => {});
      }
    };
    start();
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      if (animated && isScrollBrand) window.removeEventListener("brand-progress", onBrandProgress);
      if (animated) document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [text, cell, sampleCell, fontPx, fontFamily, waveScale, animated, className]);

  return (
    <canvas
      ref={canvasRef}
      className={`pixel-wave-title${className ? " " + className : ""}`}
      role="img"
      aria-hidden="true"
    />
  );
}
