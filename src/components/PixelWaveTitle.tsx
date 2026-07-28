import { useEffect, useRef } from "react";

interface Props {
  text?: string;
  className?: string;
  cell?: number; // 显示画布每格逻辑像素
  sampleCell?: number; // 采样画布每格像素（越小分辨率越高）
  fontPx?: number; // 采样字号
}

export default function PixelWaveTitle({
  text = "树码空间",
  className,
  cell = 9,
  sampleCell = 15,
  fontPx = 260,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let grid: boolean[][] = [];
    let cols = 0;
    let rows = 0;

    const cs = getComputedStyle(canvas);
    const color = cs.getPropertyValue("--accent").trim() || "#b93b28";

    const sample = () => {
      const sc = document.createElement("canvas");
      const sctx = sc.getContext("2d");
      if (!sctx) return;
      const font = `600 ${fontPx}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
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
          const bob = Math.sin(0.18 * y + 0.004 * t) * 0.1; // -0.1..0.1
          const alpha = Math.min(1, 0.32 + 0.45 * s + 0.28 * sweep);
          const size = cell * (0.68 + 0.2 * s + 0.12 * sweep);
          const cx = x * cell + cell / 2;
          const cy = y * cell + cell / 2 + bob * cell;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      const begin = () => {
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
            ctx.font = `600 ${logicalH * 0.82}px "Noto Sans SC", "PingFang SC", system-ui, sans-serif`;
            ctx.fillText(text, 0, logicalH / 2);
          }
          return;
        }
        raf = requestAnimationFrame(draw);
      };
      if (document.fonts && document.fonts.load) {
        Promise.all([
          document.fonts.load(`600 ${fontPx}px "Noto Sans SC"`),
          document.fonts.ready,
        ])
          .then(begin)
          .catch(begin);
      } else {
        begin();
      }
    };
    start();
    return () => cancelAnimationFrame(raf);
  }, [text, cell, sampleCell, fontPx]);

  return (
    <canvas
      ref={canvasRef}
      className={`pixel-wave-title${className ? " " + className : ""}`}
      role="img"
      aria-hidden="true"
    />
  );
}