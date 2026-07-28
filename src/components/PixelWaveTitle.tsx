import { useEffect, useRef } from "react";

interface Props {
  text?: string;
  className?: string;
  cell?: number; // 显示画布每格像素（块大小）
  sampleCell?: number; // 采样画布每格像素（采样分辨率）
  fontPx?: number; // 采样时字号
}

export default function PixelWaveTitle({
  text = "树码空间",
  className,
  cell = 10,
  sampleCell = 18,
  fontPx = 240,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let grid: boolean[][] = [];
    let cols = 0;
    let rows = 0;

    // 读取主题 accent（与全局 --accent 同步），回退 #b93b28
    const cs = getComputedStyle(canvas);
    const color =
      cs.getPropertyValue("--accent").trim() || "#b93b28";

    const sample = () => {
      const sc = document.createElement("canvas");
      const sctx = sc.getContext("2d");
      if (!sctx) return;
      const font = `600 ${fontPx}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
      sctx.font = font;
      const w = sctx.measureText(text).width;
      cols = Math.ceil(w / sampleCell) + 2;
      rows = Math.ceil((fontPx * 1.25) / sampleCell);
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
      canvas.width = cols * cell;
      canvas.height = rows * cell;
    };

    const draw = (t: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!grid[y]?.[x]) continue;
          // 对角正弦行波：x、y 方向同相位线性叠加，t 控制时间轴
          const phase = 0.22 * x + 0.22 * y - 0.003 * t;
          const s = 0.5 + 0.5 * Math.sin(phase); // 0..1
          const alpha = 0.4 + 0.6 * s; // 0.4..1.0（最低 0.4 保证字形常显）
          const size = cell * (0.78 + 0.22 * s); // 方块随波微缩放
          const cx = x * cell + cell / 2;
          const cy = y * cell + cell / 2;
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
        // 兜底：若采样网格全空（字体异常），直接在显示画布上画出文字，避免空白
        const hasOn = grid.some((row) => row.some((v) => v));
        if (!hasOn) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = color;
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.font = `600 ${canvas.height * 0.82}px "Noto Sans SC", "PingFang SC", system-ui, sans-serif`;
            ctx.fillText(text, 0, canvas.height / 2);
          }
          return; // 不启动 rAF 波动（兜底静态显示）
        }
        raf = requestAnimationFrame(draw);
      };
      // 显式加载所需中文字体后再采样，确保字形可用
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