interface Point { x: number; y: number; }
interface IndicatorPos extends Point { w: number; }
interface NavTransition { origin: IndicatorPos; }

const TRANSITION_KEY = "nav-particle-transition";
const DURATION = 1100;
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Block {
  // 起始位置（原指示条上的相对位置）
  startOffsetX: number;  // 相对于原指示条左端的偏移
  // 散开参数
  scatterY: number;
  scatterRot: number;
  // 飞行参数
  delay: number;
  speed: number;
  lane: number;
  // 目标指示条上的相对位置
  endOffsetX: number;
}

export function rememberNavOrigin(link: HTMLElement): void {
  const rect = link.getBoundingClientRect();
  sessionStorage.setItem(TRANSITION_KEY, JSON.stringify({
    origin: { x: rect.left, y: rect.bottom + 4, w: rect.width }
  }));
}

export function takeNavTransition(): NavTransition | null {
  const raw = sessionStorage.getItem(TRANSITION_KEY);
  sessionStorage.removeItem(TRANSITION_KEY);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    return Number.isFinite(t?.origin?.x) && Number.isFinite(t?.origin?.w) ? t : null;
  } catch { return null; }
}

export function spawnNavParticles(origin: Point & { w: number }, target: Point & { w: number }, targetLink: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "nav-particle-canvas";
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(ratio, ratio);

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#b93b28";

  // 把原指示条切成 N 块积木
  const BLOCK_COUNT = 18;
  const blockW = origin.w / BLOCK_COUNT;
  const barH = 2;

  // 预生成每块积木的参数
  const blocks: Block[] = Array.from({ length: BLOCK_COUNT }, (_, i) => {
    const t = i / (BLOCK_COUNT - 1); // 0~1 在原指示条上的位置
    return {
      startOffsetX: t * origin.w,
      scatterY: (Math.random() - 0.5) * 16,
      scatterRot: (Math.random() - 0.5) * 0.8,
      delay: i * 20 + Math.random() * 15, // 从左到右依次出发
      speed: 0.7 + Math.random() * 0.4,
      lane: (Math.random() - 0.5) * 10,
      endOffsetX: t * target.w,
    };
  });

  const dist = Math.abs(target.x - origin.x);

  let startedAt: number | null = null;

  const PHASE_SCATTER = 0.2;  // 0~20% 瓦解
  const PHASE_FLY = 0.7;      // 20~70% 飞行
  const PHASE_ASSEMBLE = 1.0;  // 70~100% 组装

  function frame(now: number) {
    if (startedAt === null) startedAt = now;
    const elapsed = now - startedAt;
    const globalT = Math.min(elapsed / DURATION, 1);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // 绘制每块积木
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const local = elapsed - b.delay;
      if (local <= 0) {
        // 还没轮到，画在原位
        drawBlock(ctx, accent, origin.x + b.startOffsetX, origin.y, blockW, barH, 0, 1);
        continue;
      }

      const rawT = clamp((local / DURATION) * b.speed * 2.5);

      if (globalT < PHASE_SCATTER) {
        // Phase 1: 瓦解 — 从原指示条上散开
        const st = clamp(globalT / PHASE_SCATTER);
        const eased = expoOut(st);
        const px = origin.x + b.startOffsetX;
        const py = origin.y + b.scatterY * eased;
        const rot = b.scatterRot * eased;
        const alpha = 1 - st * 0.15;
        drawBlock(ctx, accent, px, py, blockW, barH, rot, alpha);

      } else if (globalT < PHASE_FLY) {
        // Phase 2: 直线流动
        const flyT = clamp(rawT * 1.5 - 0.1);
        const eased = expoOut(flyT);

        const px = lerp(origin.x + b.startOffsetX, target.x + b.endOffsetX, eased);
        const py = origin.y + b.lane * Math.sin(Math.PI * eased);

        const rot = b.scatterRot * (1 - eased) * Math.sin(Math.PI * eased);
        const alpha = flyT > 0.85 ? (1 - flyT) / 0.15 : 0.85;

        drawBlock(ctx, accent, px, py, blockW, barH, rot, alpha);

      } else {
        // Phase 3: 组装 — 积木归位到目标指示条
        const at = clamp((globalT - PHASE_FLY) / (PHASE_ASSEMBLE - PHASE_FLY));
        // 从左到右依次归位（根据 index 延迟）
        const blockDelay = i / BLOCK_COUNT * 0.6;
        const assembleT = clamp((at - blockDelay) / (1 - blockDelay));
        const eased = expoOut(assembleT);

        // 起点：飞行终点附近，终点：目标指示条上的位置
        const destX = target.x + b.endOffsetX;
        const destY = target.y;

        const px = lerp(destX + b.lane * 0.5, destX, eased);
        const py = lerp(origin.y + b.lane, destY, eased);
        const rot = b.scatterRot * (1 - eased) * 0.3 * (1 - eased);
        const alpha = 0.85 + 0.15 * eased;

        drawBlock(ctx, accent, px, py, blockW, barH, rot, alpha);
      }
    }

    if (elapsed < DURATION) {
      requestAnimationFrame(frame);
    } else {
      // 动画结束：移除 pending 状态，显示指示条
      document.documentElement.classList.remove("nav-transition-pending");
      targetLink.classList.add("nav-focus-arrived");
      window.setTimeout(() => targetLink.classList.remove("nav-focus-arrived"), 440);
      canvas.classList.add("nav-particle-fade");
      window.setTimeout(() => canvas.remove(), 180);
    }
  }

  requestAnimationFrame(frame);
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number, y: number,
  w: number, h: number,
  rotation: number,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}
