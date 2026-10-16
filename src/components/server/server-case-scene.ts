/*-- 「服务器」机箱舞台（S1）：three 场景 + 限角轨道相机（默认 45°，禁自转）
   与 public/3d-poc 同源的相机/灯光骨架；提线渲染（S2）与交互层（S4/S5）后续叠加。
   Note: see .agents/notes/2026-10-15-server-tab-linecase-requirement--103be143.md --*/

import * as THREE from "three";
import { buildCaseModel, type PartKey } from "./case-model";
import { buildCaseLines } from "./case-lines";

// three 走 any 语义 shim（与 case-lines 同规约）
type Any3 = any;

export type { PartKey };

export interface ServerSceneApi {
  resize(): void;
  dispose(): void;
  /** 手绘加载完成后 resolve（reduced-motion 立即）。 */
  whenDrawn: Promise<void>;
}

export async function createServerCaseScene(canvas: HTMLCanvasElement): Promise<ServerSceneApi> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 2000);
  const target = new THREE.Vector3(0, 2, 0);

  /* 平涂线稿风：填充走 MeshBasic（无光照），玻璃留半透 */
  const model = buildCaseModel();
  scene.add(model.root);
  const lines = buildCaseLines(model);

  /* 手绘加载（S3）：线条一笔一笔绘出；色块在后段随笔迹淡入。
     reduced-motion 直切静态全显，无笔尖、无渐进。 */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) lines.setDrawProgress(1); // 直切静态全显（AC-3）
  const fillMats = new Set<Any3>();
  model.root.traverse((o: Any3) => {
    if (o.isMesh && o.material && !o.material.isLineMaterial) fillMats.add(o.material);
  });
  const baseFillOpacity = new Map<Any3, number>();
  for (const mat of fillMats) {
    baseFillOpacity.set(mat, mat.opacity);
    if (!reduceMotion) {
      mat.transparent = true;
      mat.opacity = 0;
    }
  }
  let drawResolve!: () => void;
  const whenDrawn = new Promise<void>((resolve) => { drawResolve = resolve; });

  /* 笔尖光点：跟随前沿段中点的柔光 sprite，绘完淡出 */
  const tipCanvas = document.createElement("canvas");
  tipCanvas.width = tipCanvas.height = 64;
  const tipCtx = tipCanvas.getContext("2d");
  if (tipCtx) {
    const grad = tipCtx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 236, 200, 0.95)");
    grad.addColorStop(0.35, "rgba(185, 59, 40, 0.45)");
    grad.addColorStop(1, "rgba(185, 59, 40, 0)");
    tipCtx.fillStyle = grad;
    tipCtx.fillRect(0, 0, 64, 64);
  }
  const tipTexture = new THREE.CanvasTexture(tipCanvas);
  const tipMaterial = new THREE.SpriteMaterial({
    map: tipTexture, transparent: true, depthTest: false, opacity: 0.9,
  });
  const tip = new THREE.Sprite(tipMaterial);
  tip.scale.set(3.4, 3.4, 1);
  tip.visible = !reduceMotion;
  scene.add(tip);

  // A soft contact shadow anchors the model directly on the shared page paper.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext("2d");
  if (shadowContext) {
    const gradient = shadowContext.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, "rgba(83, 65, 39, 0.17)");
    gradient.addColorStop(0.45, "rgba(83, 65, 39, 0.08)");
    gradient.addColorStop(1, "rgba(83, 65, 39, 0)");
    shadowContext.fillStyle = gradient;
    shadowContext.fillRect(0, 0, 128, 128);
  }
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeometry = new THREE.PlaneGeometry(102, 80);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture, transparent: true, depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -50.6;
  scene.add(shadow);

  /* 相机：默认 45°「另一侧」视角（2026-10-16 用户定案：玻璃 + 后侧同框，构图左右对调），
     限角拖转，禁自转 */
  const D2R = Math.PI / 180;
  const cam = { az: 45 * D2R, el: 15 * D2R, dist: 225 };
  const camGoal = { ...cam };
  const applyCam = () => {
    camera.position.set(
      target.x + cam.dist * Math.cos(cam.el) * Math.sin(cam.az),
      target.y + cam.dist * Math.sin(cam.el),
      target.z + cam.dist * Math.cos(cam.el) * Math.cos(cam.az)
    );
    camera.lookAt(target);
  };
  applyCam();

  let dragging = false, px = 0, py = 0;
  let drawn = reduceMotion;
  canvas.style.cursor = drawn ? "grab" : "default";
  canvas.addEventListener("pointerdown", (e) => {
    if (!drawn) return;
    dragging = true; px = e.clientX; py = e.clientY;
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    camGoal.az = THREE.MathUtils.clamp(camGoal.az - dx * 0.0042, 15 * D2R, 75 * D2R);
    camGoal.el = THREE.MathUtils.clamp(camGoal.el + dy * 0.0032, 2 * D2R, 30 * D2R);
  });
  const endDrag = () => { dragging = false; if (drawn) canvas.style.cursor = "grab"; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (!drawn) return;
    camGoal.dist = THREE.MathUtils.clamp(camGoal.dist + e.deltaY * 0.09, 150, 280);
  }, { passive: false });

  /* 尺寸 */
  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    lines.setResolution(w, h); // fat lines 线宽按屏幕像素
  };
  resize();

  /* 渲染循环（阻尼趋近；无自转；驱动 draw-on 时间轴） */
  const DRAW_MS = 2000; // 1.5–2.5s 量级（AC-3）
  let drawElapsed = reduceMotion ? DRAW_MS : 0;
  let raf = 0;
  let disposed = false;
  let last = performance.now();
  const tick = (now: number) => {
    if (disposed) return;
    const dt = Math.min(64, now - last);
    last = now;

    /* 手绘加载：线性偏机械缓动，色块在 55% 后随笔迹淡入 */
    if (drawElapsed < DRAW_MS) {
      drawElapsed = Math.min(DRAW_MS, drawElapsed + dt);
      const t = drawElapsed / DRAW_MS;
      lines.setDrawProgress(t);
      const frontier = lines.getDrawFrontier();
      if (frontier) tip.position.set(frontier.x, frontier.y, frontier.z);
      tipMaterial.opacity = t > 0.92 ? (1 - t) / 0.08 * 0.9 : 0.9;
      const fill = THREE.MathUtils.clamp((t - 0.55) / 0.45, 0, 1);
      const fillEase = fill * fill * (3 - 2 * fill);
      for (const mat of fillMats) mat.opacity = (baseFillOpacity.get(mat) ?? 1) * fillEase;
      shadowMaterial.opacity = fillEase;
      if (drawElapsed >= DRAW_MS) {
        lines.setDrawProgress(1);
        for (const mat of fillMats) mat.opacity = baseFillOpacity.get(mat) ?? 1;
        shadowMaterial.opacity = 1;
        tip.visible = false;
        drawn = true;
        canvas.style.cursor = "grab";
        drawResolve();
      }
    }

    const k = 1 - Math.pow(0.002, dt / 1000);
    cam.az += (camGoal.az - cam.az) * k;
    cam.el += (camGoal.el - cam.el) * k;
    cam.dist += (camGoal.dist - cam.dist) * k;
    applyCam();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  if (reduceMotion) drawResolve();

  return {
    resize,
    whenDrawn,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      lines.dispose();
      tipTexture.dispose();
      tipMaterial.dispose();
      shadowTexture.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      renderer.dispose();
    },
  };
}
