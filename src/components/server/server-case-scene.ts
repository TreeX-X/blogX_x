/*-- 「服务器」机箱舞台（S1）：three 场景 + 限角轨道相机（默认 45°，禁自转）
   与 public/3d-poc 同源的相机骨架；点击驱动部件聚焦、L2 手绘与上下文淡化。
   Note: see .agents/notes/2026-10-15-server-tab-linecase-requirement--103be143.md --*/

import * as THREE from "three";
import { buildCaseModel, type PartKey } from "./case-model";
import { buildCaseLines } from "./case-lines";

// three 走 any 语义 shim（与 case-lines 同规约）
type Any3 = any;

export type { PartKey };

/** S4：部件锚点在画布内的投影（CSS 像素），与当前渲染帧同步。 */
export interface AnchorScreen {
  key: PartKey;
  x: number;
  y: number;
  visible: boolean;
}

export interface ServerSceneApi {
  resize(): void;
  dispose(): void;
  /** 手绘加载完成后 resolve（reduced-motion 立即）。 */
  whenDrawn: Promise<void>;
  /** 聚焦部件并绘出 L2；null 收回细节、回到默认全景。 */
  setActivePart(key: PartKey | null): void;
  /** S4：hover 命中变化回调（null=离开部件）。 */
  onHover(cb: (key: PartKey | null) => void): void;
  /** S4：点击命中回调（null=点空白）；由宿主决定选中/收起。 */
  onSelect(cb: (key: PartKey | null) => void): void;
  /** S4：每帧回调部件锚点投影，供标注层定位。 */
  onFrame(cb: (anchors: AnchorScreen[], focusProgress: number) => void): void;
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

  /* S4 交互层：可交互部件（风扇为纯结构件，不参与拾取/标注/卡片）。 */
  const INTERACTIVE: PartKey[] = ["cpu", "gpu", "ram", "mb", "psu"];
  const pickables: Any3[] = [];
  for (const key of INTERACTIVE) {
    model.partGroups[key].traverse((o: Any3) => {
      if (!o.isMesh) return;
      o.userData.partKey = key;
      pickables.push(o);
    });
  }
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hoverKey: PartKey | null = null;
  let activeKey: PartKey | null = null;
  let hoverCb: (key: PartKey | null) => void = () => {};
  let selectCb: (key: PartKey | null) => void = () => {};
  let frameCb: (anchors: AnchorScreen[], focusProgress: number) => void = () => {};
  let cardProgress = 1;

  /* 手绘加载（S3）：线条一笔一笔绘出；色块按同一空间扫描序跟笔渐显。
     reduced-motion 直切静态全显，无笔尖、无渐进。 */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) lines.setDrawProgress(1); // 直切静态全显（AC-3）
  type FillRec = { mats: Any3[]; base: number[]; depth: boolean[]; owner: PartKey | "shell"; key: number };
  const fills: FillRec[] = [];
  const fillClones: Any3[] = [];
  {
    const v = new THREE.Vector3();
    model.root.traverse((o: Any3) => {
      if (!o.isMesh || !o.material || o.material.isLineMaterial) return;
      // 材质数组（如显卡鳍片按面配色）逐面处理：整包塞 Set 会漏掉透明度控制
      const src: Any3[] = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = src.map((m: Any3) => {
        const c = m.clone();
        fillClones.push(c);
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
      let parent = o;
      while (parent.parent && parent.parent !== model.root) parent = parent.parent;
      const owner = parent === model.shell ? "shell" : parent.userData.partKey as PartKey;
      // 扫描键取世界包围盒底部中心：笔扫到件底时该件开始上色（自下而上）
      o.updateWorldMatrix(true, false);
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      v.set((bb.min.x + bb.max.x) / 2, bb.min.y, (bb.min.z + bb.max.z) / 2).applyMatrix4(o.matrixWorld);
      fills.push({
        mats: cloned,
        base: cloned.map((m: Any3) => m.opacity),
        depth: cloned.map((m: Any3) => m.depthWrite),
        owner,
        key: lines.sweepNorm(v.x, v.y, v.z),
      });
      for (const m of cloned) { m.transparent = true; if (!reduceMotion) m.opacity = 0; }
    });
  }
  /** 色块随扫描阈值渐显（软边 0.1，色略滞后于线） */
  let contextLevel = 0;
  let contextKey: PartKey | null = null;
  let contextMotion: { from: number; to: number; elapsed: number } | null = null;
  const applyFill = (t: number) => {
    const th = lines.layerThreshold("part", t);
    for (const f of fills) {
      const r = THREE.MathUtils.clamp((th - f.key) / 0.1, 0, 1);
      const muted = f.owner === "shell" || f.owner !== contextKey;
      const factor = 1 - contextLevel * (f.owner === "shell" ? 0.88 : muted ? 0.7 : 0);
      for (let i = 0; i < f.mats.length; i++) {
        f.mats[i].opacity = f.base[i] * r * factor;
        // 透明度只控制淡化；切换深度写入会让被遮挡结构在过渡末帧跳变。
        f.mats[i].depthWrite = f.depth[i];
      }
    }
    shadowMaterial.opacity = THREE.MathUtils.clamp(th / 0.12, 0, 1);
  };
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
  const overview = { ...cam };
  const overviewTarget = target.clone();
  const detailProgress: Partial<Record<PartKey, number>> = {};
  const preferredDistance = { cpu: 58, gpu: 100, ram: 76, mb: 132, psu: 92 };
  // 取完整部件（含冷排、水管和线束）的世界包围盒，不再只对准手工锚点。
  const partBounds = Object.fromEntries(INTERACTIVE.map(key => {
    const box = new THREE.Box3().setFromObject(model.partGroups[key]);
    const corners: Any3[] = [];
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    return [key, { center: box.getCenter(new THREE.Vector3()), corners }];
  })) as Record<PartKey, { center: Any3; corners: Any3[] }>;
  const direction = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const offset = new THREE.Vector3(), worldUp = new THREE.Vector3(0, 1, 0);
  const fitDistance = (key: PartKey, view: typeof cam, center: Any3) => {
    direction.set(Math.cos(view.el) * Math.sin(view.az), Math.sin(view.el), Math.cos(view.el) * Math.cos(view.az));
    right.crossVectors(worldUp, direction).normalize();
    up.crossVectors(direction, right);
    // 包围盒投影最多占画面 84%，为描边和拖转保留安全边距。
    const tanV = Math.tan(camera.fov * D2R / 2) / camera.zoom * 0.84;
    const tanH = tanV * camera.aspect;
    let distance = 0;
    for (const corner of partBounds[key].corners) {
      offset.copy(corner).sub(center);
      distance = Math.max(distance, offset.dot(direction)
        + Math.max(Math.abs(offset.dot(right)) / tanH, Math.abs(offset.dot(up)) / tanV));
    }
    return distance;
  };
  let motion: { from: typeof cam; to: typeof cam; fromTarget: Any3; toTarget: Any3; elapsed: number } | null = null;
  const focusPart = (key: PartKey | null, reframe = false) => {
    if ((!reframe && key === activeKey) || key === "fans") return;
    activeKey = key;
    if (!reframe) cardProgress = reduceMotion ? 1 : 0;
    // 返回期间保留原部件身份，避免按 Esc 时原选中件立即被当作背景淡化。
    if (key) contextKey = key;
    contextMotion = reduceMotion ? null : { from: contextLevel, to: key ? 1 : 0, elapsed: 0 };
    const to = { ...overview, dist: key ? preferredDistance[key] : overview.dist };
    const toTarget = key ? partBounds[key].center.clone() : overviewTarget.clone();
    if (key) to.dist = Math.max(to.dist, fitDistance(key, to, toTarget));
    Object.assign(camGoal, to);
    if (reduceMotion) {
      Object.assign(cam, to);
      target.copy(toTarget);
      motion = null;
    } else {
      motion = { from: { ...cam }, to, fromTarget: target.clone(), toTarget, elapsed: 0 };
    }
  };
  const applyCam = () => {
    camera.position.set(
      target.x + cam.dist * Math.cos(cam.el) * Math.sin(cam.az),
      target.y + cam.dist * Math.sin(cam.el),
      target.z + cam.dist * Math.cos(cam.el) * Math.cos(cam.az)
    );
    camera.lookAt(target);
    // project() 读取 matrixWorldInverse；必须在投影前更新，不能等 renderer.render。
    camera.updateMatrixWorld();
  };
  applyCam();

  let dragging = false, moved = false, px = 0, py = 0, downX = 0, downY = 0;
  let drawn = reduceMotion;

  const setCursor = () => {
    if (!drawn) { canvas.style.cursor = "default"; return; }
    canvas.style.cursor = dragging ? "grabbing" : hoverKey ? "pointer" : "grab";
  };
  const setHover = (key: PartKey | null) => {
    if (key === hoverKey) return;
    hoverKey = key;
    hoverCb(key);
    setCursor();
  };
  /** 射线拾取：命中可交互部件（线条过细，拾取走同形实体网格）。 */
  const pickAt = (clientX: number, clientY: number): PartKey | null => {
    if (!drawn) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    return hit ? (hit.object.userData.partKey as PartKey) : null;
  };
  setCursor();

  canvas.addEventListener("pointerdown", (e) => {
    if (!drawn) return;
    dragging = true; moved = false;
    px = downX = e.clientX; py = downY = e.clientY;
    setCursor();
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (dragging) {
      const dx = e.clientX - px, dy = e.clientY - py;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) moved = true;
      if (moved && motion) { motion = null; Object.assign(camGoal, cam); }
      px = e.clientX; py = e.clientY;
      camGoal.az = THREE.MathUtils.clamp(camGoal.az - dx * 0.0042, 15 * D2R, 75 * D2R);
      camGoal.el = THREE.MathUtils.clamp(camGoal.el + dy * 0.0032, 2 * D2R, 30 * D2R);
      return;
    }
    setHover(pickAt(e.clientX, e.clientY));
  });
  const endDrag = () => { dragging = false; setCursor(); };
  canvas.addEventListener("pointerup", (e) => {
    if (dragging && !moved && drawn) selectCb(pickAt(e.clientX, e.clientY));
    endDrag();
  });
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => { if (!dragging) setHover(null); });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (!drawn) return;
    if (motion) { motion = null; Object.assign(camGoal, cam); }
    camGoal.dist = THREE.MathUtils.clamp(camGoal.dist + e.deltaY * 0.09, activeKey ? 45 : 150, 280);
  }, { passive: false });

  /* 尺寸 */
  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 狭长的中间画布仍完整展示机箱，给两侧标识保留独立空间。
    camera.zoom = Math.min(1, camera.aspect / 0.85);
    camera.updateProjectionMatrix();
    lines.setResolution(w, h); // fat lines 线宽按屏幕像素
    if (activeKey) focusPart(activeKey, true);
  };
  resize();

  /* 保留亚像素精度，避免拖转时整像素阶跃；相机收敛后坐标保持不变。 */
  const anchorVec = new THREE.Vector3();
  const anchorOut: AnchorScreen[] = INTERACTIVE.map((key) => ({ key, x: 0, y: 0, visible: true }));
  const emitFrame = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    for (let i = 0; i < INTERACTIVE.length; i++) {
      const a = anchorOut[i];
      anchorVec.copy(model.partAnchors[INTERACTIVE[i]]).applyMatrix4(model.root.matrixWorld).project(camera);
      a.x = Number(((anchorVec.x * 0.5 + 0.5) * w).toFixed(2));
      a.y = Number(((-anchorVec.y * 0.5 + 0.5) * h).toFixed(2));
      a.visible = anchorVec.z >= -1 && anchorVec.z <= 1 && Math.abs(anchorVec.x) <= 1 && Math.abs(anchorVec.y) <= 1;
    }
    frameCb(anchorOut, cardProgress);
  };

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

    /* 手绘加载：线性偏机械缓动；线扫到哪、色上到哪（同一空间序） */
    if (drawElapsed < DRAW_MS) {
      drawElapsed = Math.min(DRAW_MS, drawElapsed + dt);
      const t = drawElapsed / DRAW_MS;
      canvas.dataset.drawT = t.toFixed(3); // 验证探针（可读、无副作用）
      lines.setDrawProgress(t);
      applyFill(t);
      const frontier = lines.getDrawFrontier();
      if (frontier) tip.position.set(frontier.x, frontier.y, frontier.z);
      tipMaterial.opacity = t > 0.92 ? (1 - t) / 0.08 * 0.9 : 0.9;
      if (drawElapsed >= DRAW_MS) {
        lines.setDrawProgress(1);
        applyFill(1);
        canvas.dataset.drawT = "1";
        tip.visible = false;
        drawn = true;
        setCursor();
        drawResolve();
      }
    }

    /* 阻尼趋近；残差小于阈值即吸附到目标——渐近尾巴会让投影无限蠕动（引线抖动源） */
    const k = 1 - Math.pow(0.002, dt / 1000);
    const damp = (cur: number, goal: number) => {
      const next = cur + (goal - cur) * k;
      return Math.abs(goal - next) < 1e-4 ? goal : next;
    };
    if (motion) {
      motion.elapsed = Math.min(1000, motion.elapsed + dt);
      const t = motion.elapsed / 1000;
      const ease = t * t * (3 - 2 * t);
      cardProgress = Math.max(cardProgress, ease);
      for (const key of ["az", "el", "dist"] as const) cam[key] = motion.from[key] + (motion.to[key] - motion.from[key]) * ease;
      target.copy(motion.fromTarget).lerp(motion.toTarget, ease);
      if (t === 1) motion = null;
    } else {
      cardProgress = 1;
      cam.az = damp(cam.az, camGoal.az);
      cam.el = damp(cam.el, camGoal.el);
      cam.dist = damp(cam.dist, camGoal.dist);
    }
    if (activeKey && !motion) {
      // 手动拖转和滚轮也不能把已选部件推到视窗之外。
      const minimum = fitDistance(activeKey, cam, target);
      cam.dist = Math.max(cam.dist, minimum);
      camGoal.dist = Math.max(camGoal.dist, minimum);
    }
    applyCam();

    let nextContext = reduceMotion ? (activeKey ? 1 : 0) : contextLevel;
    if (contextMotion) {
      contextMotion.elapsed = Math.min(1000, contextMotion.elapsed + dt);
      const t = contextMotion.elapsed / 1000;
      const ease = t * t * (3 - 2 * t);
      nextContext = contextMotion.from + (contextMotion.to - contextMotion.from) * ease;
      if (t === 1) contextMotion = null;
    }
    if (contextLevel !== nextContext || drawElapsed < DRAW_MS || activeKey) {
      contextLevel = nextContext;
      if (contextLevel === 0) contextKey = null;
      applyFill(drawElapsed / DRAW_MS);
      lines.setContext(contextKey, contextLevel);
    }
    for (const key of INTERACTIVE) {
      const before = detailProgress[key] ?? 0;
      const wanted = key === activeKey ? 1 : 0;
      const after = reduceMotion ? wanted : THREE.MathUtils.clamp(before + (wanted ? dt / 1000 : -dt / 400), 0, 1);
      detailProgress[key] = after;
      const detail = lines.setDetailProgress(key, after);
      canvas.dataset[`detail${key[0].toUpperCase()}${key.slice(1)}`] = `${detail.visible}/${detail.total}`;
      if (key === activeKey && after > 0 && after < 1 && detail.frontier && !reduceMotion) {
        tip.visible = true;
        tip.position.set(detail.frontier.x, detail.frontier.y, detail.frontier.z);
        tipMaterial.opacity = 0.65;
      }
    }
    if (drawn && (!activeKey || detailProgress[activeKey] === 1 || reduceMotion)) tip.visible = false;
    canvas.dataset.focus = activeKey ?? "";
    canvas.dataset.cameraDistance = cam.dist.toFixed(2);
    canvas.dataset.cameraTarget = `${target.x.toFixed(2)},${target.y.toFixed(2)},${target.z.toFixed(2)}`;
    canvas.dataset.context = contextLevel.toFixed(3);
    if (activeKey) {
      let extent = 0;
      for (const corner of partBounds[activeKey].corners) {
        anchorVec.copy(corner).project(camera);
        extent = Math.max(extent, Math.abs(anchorVec.x), Math.abs(anchorVec.y));
      }
      canvas.dataset.focusExtent = extent.toFixed(4);
    } else delete canvas.dataset.focusExtent;

    /* S4：激活/悬停强调（线色向牛血红偏移、线宽提升） */
    for (const key of INTERACTIVE) {
      lines.setPartEmphasis(key, key === activeKey ? 1 : key === hoverKey ? 0.45 : 0);
    }
    renderer.render(scene, camera);
    emitFrame();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  if (reduceMotion) drawResolve();

  return {
    resize,
    whenDrawn,
    setActivePart: focusPart,
    onHover(cb) { hoverCb = cb; },
    onSelect(cb) { selectCb = cb; },
    onFrame(cb) { frameCb = cb; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      lines.dispose();
      for (const m of fillClones) m.dispose();
      tipTexture.dispose();
      tipMaterial.dispose();
      shadowTexture.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      renderer.dispose();
    },
  };
}
