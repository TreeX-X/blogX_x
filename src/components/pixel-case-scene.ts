/*-- 像素数码 3D 机箱舞台：three.js 实例化体素 + 打散组装变形 + 拾取/相机编排
   仅经动态 import 加载（首屏零成本）。Note: see .agents/notes/2026-10-15-pixel-case-hero-requirement--f47e324c.md --*/

import * as THREE from "three";
import { buildVoxelCase, PART_KEYS, PART_POSES, type PartKey, type VoxelModel } from "./voxel-case";

export type { PartKey };

// three 走 any 语义 shim（见 src/types/three-shim.d.ts），实例引用不写具体类型
type Mesh3 = {
  visible: boolean;
  geometry: { dispose(): void };
  material: { dispose(): void };
};

export interface SceneApi {
  resize(): void;
  dispose(): void;
  /** 标题像素（画布 CSS 像素 xy 对，由舞台反投影到 z=0 平面）打散 → 组装；reduced-motion 直切 */
  morphIn(fromPixels: Float32Array, reduced: boolean, onDone: () => void): void;
  /** 机箱散回标题像素位置；reduced-motion 直切 */
  morphOut(fromPixels: Float32Array, reduced: boolean, onDone: () => void): void;
  setHoverPart(p: PartKey | null): void;
  setActivePart(p: PartKey | null): void;
  pickAt(clientX: number, clientY: number): PartKey | null;
  projectPart(p: PartKey): { x: number; y: number };
  /** 腾位：场景沿相机右向平移（left=卡片在左，机箱右让） */
  setCardShift(side: "left" | "right" | null): void;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

const MORPH_MS = 1750;

export async function createPixelCaseScene(
  canvas: HTMLCanvasElement,
  opts: { counts: Record<string, number>; lite?: boolean }
): Promise<SceneApi> {
  const model: VoxelModel = buildVoxelCase({ lite: opts.lite });
  const N = model.count;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000);

  /* ---------- 灯光：奶油聚光 + 暖纸环境（token 族）
     总光强刻意压在 1 以下，保住釉面明暗差——过曝会把暖纸陶瓷吹成无字白块 ---------- */
  scene.add(new THREE.HemisphereLight(0xf8f9f6, 0xd9dad5, 0.62));
  const key = new THREE.DirectionalLight(0xf8f9f6, 0.82);
  key.position.set(-60, 110, 90);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xf3d8d0, 0.32);
  fill.position.set(80, 30, -60);
  scene.add(fill);

  /* ---------- 实例化体素 ---------- */
  const root = new THREE.Group();
  scene.add(root);
  const geo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
  const mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // 实例分布在整箱范围内，几何包围球（原点 1 单位）会把整个网格误剔除
  mesh.frustumCulled = false;
  root.add(mesh);

  const baseColors = new Float32Array(model.colors);
  const partInstanceIdx: number[][] = [[], [], [], [], [], []]; // 0=shell .. 5=psu
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) {
    m4.setPosition(model.positions[i * 3], model.positions[i * 3 + 1], model.positions[i * 3 + 2]);
    mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, new THREE.Color(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]));
    partInstanceIdx[model.parts[i]].push(i);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  /* ---------- 拾取代理（部件包围盒） ---------- */
  const pickMeshes: Mesh3[] = [];
  const pickByPart = new Map<PartKey, Mesh3>();
  const pickMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  for (const key of PART_KEYS) {
    const b = model.partBoxes[key];
    const size = new THREE.Vector3(
      Math.max(2, b.max[0] - b.min[0] + 2),
      Math.max(2, b.max[1] - b.min[1] + 2),
      Math.max(2, b.max[2] - b.min[2] + 2)
    );
    const pm = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), pickMat);
    pm.position.set(b.center[0], b.center[1], b.center[2]);
    root.add(pm);
    pickMeshes.push(pm);
    pickByPart.set(key, pm);
  }

  /* ---------- LCD 纹理屏 ---------- */
  let lcdMesh: Mesh3;
  const lcdCanvas = document.createElement("canvas");
  lcdCanvas.width = 256;
  lcdCanvas.height = 160;
  const lcdTex = new THREE.CanvasTexture(lcdCanvas);
  lcdTex.magFilter = THREE.NearestFilter;
  lcdTex.minFilter = THREE.NearestFilter;
  const drawLcd = () => {
    const g = lcdCanvas.getContext("2d");
    if (!g) return;
    g.fillStyle = "#151613";
    g.fillRect(0, 0, 256, 160);
    // 扫描线
    g.fillStyle = "rgba(185,59,40,0.12)";
    for (let y = 0; y < 160; y += 4) g.fillRect(0, y, 256, 1);
    g.fillStyle = "#f3d8d0";
    g.font = "bold 22px monospace";
    g.fillText("TREEBOX // LIVE", 12, 30);
    const rows: [string, number][] = [
      ["POSTS", opts.counts.posts ?? 0],
      ["KB", opts.counts.knowledgeBase ?? 0],
      ["WIKI", opts.counts.wiki ?? 0],
      ["REPO", opts.counts.repos ?? 0],
      ["SKILL", opts.counts.skills ?? 0],
    ];
    g.font = "bold 18px monospace";
    rows.forEach(([k, v], i) => {
      const y = 58 + i * 22;
      g.fillStyle = i === 0 ? "#b93b28" : "#f8f9f6";
      g.fillText(k, 12, y);
      g.fillStyle = "#f3d8d0";
      g.fillText(String(v).padStart(3, "0"), 150, y);
    });
    lcdTex.needsUpdate = true;
  };
  drawLcd();
  {
    const b = model.partBoxes.lcd;
    const w = b.max[0] - b.min[0] - 3;
    const h = b.max[1] - b.min[1] - 3;
    const lcd = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(4, w), Math.max(4, h)),
      new THREE.MeshBasicMaterial({ map: lcdTex })
    );
    lcd.position.set(b.center[0], b.center[1], b.min[2] - 0.6);
    lcd.rotation.y = Math.PI; // 前脸朝世界 -z，纹理面向外
    root.add(lcd);
    lcdMesh = lcd;
  }
  const lcdVisible = (on: boolean) => {
    lcdMesh.visible = on;
  };

  /* ---------- 相机球坐标状态 ----------
     dist 一律为世界距离；部件视角 = pose.dist × 部件外径，home 视角固定 HOME_DIST */
  const HOME_DIST = PART_POSES.home.dist * 62;
  const cam = { az: PART_POSES.home.az, el: PART_POSES.home.el, dist: HOME_DIST, tx: 0, ty: 2, tz: 0 };
  const camGoal = { ...cam };
  const applyCam = () => {
    const azR = (cam.az * Math.PI) / 180;
    const elR = (cam.el * Math.PI) / 180;
    camera.position.set(
      cam.tx + cam.dist * Math.cos(elR) * Math.sin(azR),
      cam.ty + cam.dist * Math.sin(elR),
      cam.tz + cam.dist * Math.cos(elR) * Math.cos(azR)
    );
    camera.lookAt(cam.tx, cam.ty, cam.tz);
  };

  /* ---------- 变形状态 ---------- */
  // 每实例：起点（标题像素映射）、爆散控制点、目标、错峰延迟
  const src = new Float32Array(N * 3);
  const ctrl = new Float32Array(N * 3);
  const dst = new Float32Array(N * 3);
  const delay = new Float32Array(N);
  let morphT = -1; // -1 未在变形
  let morphDir: "in" | "out" = "in";
  let morphDone: (() => void) | null = null;

  /** 画布 CSS 像素 → 世界坐标：投到过场景中心、面向相机的平面
      （世界 z=0 平面在斜机位下近乎侧视，反投影会被放大一个数量级） */
  const unprojectTitle = (fromXY: Float32Array): Float32Array => {
    const rect = canvas.getBoundingClientRect();
    const n = fromXY.length / 2;
    const out = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    camera.updateMatrixWorld(); // 反投影依赖 matrixWorld，机位跳变后必须先刷新
    // 场景中心平面：过 (0,2,0)，法线 = 相机视线
    const planeP = new THREE.Vector3(cam.tx, cam.ty, cam.tz);
    const planeN = new THREE.Vector3().subVectors(camera.position, planeP).normalize();
    for (let i = 0; i < n; i++) {
      const nx = ((fromXY[i * 2] - rect.left) / (rect.width || 1)) * 2 - 1;
      const ny = -((fromXY[i * 2 + 1] - rect.top) / (rect.height || 1)) * 2 + 1;
      v.set(nx, ny, 0.5).unproject(camera);
      const d = v.sub(camera.position).normalize();
      const t = planeP.clone().sub(camera.position).dot(planeN) / (d.dot(planeN) || 1e-6);
      out[i * 3] = camera.position.x + d.x * t;
      out[i * 3 + 1] = camera.position.y + d.y * t;
      out[i * 3 + 2] = camera.position.z + d.z * t;
    }
    return out;
  };

  const seedMorph = (fromXY: Float32Array, dir: "in" | "out") => {
    const fromPixels = unprojectTitle(fromXY);
    const nSrc = Math.max(1, fromPixels.length / 3);
    for (let i = 0; i < N; i++) {
      const si = i % nSrc;
      const jx = ((i * 9301 + 49297) % 233280) / 233280 - 0.5;
      const jy = ((i * 4177 + 12345) % 233280) / 233280 - 0.5;
      const sx = fromPixels[si * 3] + jx * 3;
      const sy = fromPixels[si * 3 + 1] + jy * 3;
      const sz = (((i * 7919) % 100) / 100 - 0.5) * 2;
      const dx = model.positions[i * 3];
      const dy = model.positions[i * 3 + 1];
      const dz = model.positions[i * 3 + 2];
      if (dir === "in") {
        src[i * 3] = sx; src[i * 3 + 1] = sy; src[i * 3 + 2] = sz;
        dst[i * 3] = dx; dst[i * 3 + 1] = dy; dst[i * 3 + 2] = dz;
      } else {
        src[i * 3] = dx; src[i * 3 + 1] = dy; src[i * 3 + 2] = dz;
        dst[i * 3] = sx; dst[i * 3 + 1] = sy; dst[i * 3 + 2] = sz;
      }
      // 爆散控制点：中点 + 径向外抛（打散观感）
      const mx = (src[i * 3] + dst[i * 3]) / 2;
      const my = (src[i * 3 + 1] + dst[i * 3 + 1]) / 2;
      const mz = (src[i * 3 + 2] + dst[i * 3 + 2]) / 2;
      const burst = 26 + (((i * 31337) % 100) / 100) * 34;
      const rx = ((i * 104729) % 1000) / 1000 - 0.5;
      const ry = ((i * 15485863) % 1000) / 1000 - 0.5;
      const rz = ((i * 32452843) % 1000) / 1000 - 0.5;
      const rl = Math.hypot(rx, ry, rz) || 1;
      ctrl[i * 3] = mx + (rx / rl) * burst;
      ctrl[i * 3 + 1] = my + (ry / rl) * burst * 0.7 + 8;
      ctrl[i * 3 + 2] = mz + (rz / rl) * burst;
      // 错峰：按目标对角波次
      const wave = (dx + dy * 0.6 + dz) * 0.012;
      const noise = ((i * 65537) % 100) / 100 * 0.12;
      delay[i] = clamp01(0.32 + wave * 0.35 + noise);
    }
    morphDir = dir;
    morphT = 0;
  };

  const stepMorph = (dtMs: number) => {
    if (morphT < 0) return;
    morphT += dtMs / MORPH_MS;
    const done = morphT >= 1;
    const arr = mesh.instanceMatrix.array as Float32Array;
    const colArr = mesh.instanceColor?.array as Float32Array | undefined;
    for (let i = 0; i < N; i++) {
      const local = clamp01((morphT - delay[i] * 0.38) / 0.62);
      const t = easeInOutCubic(local);
      const u = 1 - t;
      const x = u * u * src[i * 3] + 2 * u * t * ctrl[i * 3] + t * t * dst[i * 3];
      const y = u * u * src[i * 3 + 1] + 2 * u * t * ctrl[i * 3 + 1] + t * t * dst[i * 3 + 1];
      const z = u * u * src[i * 3 + 2] + 2 * u * t * ctrl[i * 3 + 2] + t * t * dst[i * 3 + 2];
      const s = 0.72 + 0.28 * t + 0.1 * Math.sin(Math.PI * t); // 轻微过冲
      const b = i * 16;
      arr[b] = s; arr[b + 5] = s; arr[b + 10] = s; arr[b + 15] = 1;
      arr[b + 1] = arr[b + 2] = arr[b + 3] = arr[b + 4] = 0;
      arr[b + 6] = arr[b + 7] = arr[b + 8] = arr[b + 9] = 0;
      arr[b + 11] = arr[b + 12] = arr[b + 13] = arr[b + 14] = 0;
      arr[b + 12] = x; arr[b + 13] = y; arr[b + 14] = z;
      if (colArr) {
        // 牛血（标题色）→ 目标陶瓷色
        const k = morphDir === "in" ? t : 1 - t;
        const bi = i * 3;
        colArr[bi] = 0.725 * (1 - k) + baseColors[bi] * k;
        colArr[bi + 1] = 0.231 * (1 - k) + baseColors[bi + 1] * k;
        colArr[bi + 2] = 0.157 * (1 - k) + baseColors[bi + 2] * k;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (done) {
      morphT = -1;
      lcdVisible(true);
      const cb = morphDone;
      morphDone = null;
      cb?.();
    }
  };

  /* ---------- 高亮/放大状态 ---------- */
  let hoverPart: PartKey | null = null;
  let activePart: PartKey | null = null;
  let pulse = 0;
  let lastPaintedPart: PartKey | null = null;

  const paintParts = () => {
    // 绘制全部可点部件的基色/高亮混合（壳体不动）
    const colArr = mesh.instanceColor?.array as Float32Array | undefined;
    const arr = mesh.instanceMatrix.array as Float32Array;
    if (!colArr) return;
    for (const key of PART_KEYS) {
      const pi = PART_KEYS.indexOf(key) + 1;
      const idx = partInstanceIdx[pi];
      const active = activePart === key;
      const hot = active ? 0.55 + pulse * 0.25 : hoverPart === key ? 0.3 : 0;
      // 有选中时其余部件轻微弱化（压暗 12%）
      const dim = activePart && !active && hoverPart !== key ? 0.88 : 1;
      const s = active ? 1 + 0.06 + pulse * 0.03 : 1;
      for (const i of idx) {
        const bi = i * 3;
        if (hot > 0) {
          // 奶油聚光提亮（红橙面上血红对比不足的结论沿用）
          colArr[bi] = baseColors[bi] * (1 - hot) + 0.973 * hot;
          colArr[bi + 1] = baseColors[bi + 1] * (1 - hot) + 0.91 * hot;
          colArr[bi + 2] = baseColors[bi + 2] * (1 - hot) + 0.847 * hot;
        } else {
          colArr[bi] = baseColors[bi] * dim;
          colArr[bi + 1] = baseColors[bi + 1] * dim;
          colArr[bi + 2] = baseColors[bi + 2] * dim;
        }
        const b = i * 16;
        arr[b] = s; arr[b + 5] = s; arr[b + 10] = s;
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    lastPaintedPart = activePart ?? hoverPart;
  };

  /* ---------- 腾位 ---------- */
  let shiftX = 0;
  let shiftGoal = 0;

  /* ---------- 渲染循环 ---------- */
  let raf = 0;
  let lastT = performance.now();
  let disposed = false;
  const tick = () => {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(64, now - lastT);
    lastT = now;

    stepMorph(dt);

    // 相机趋近
    const k = 1 - Math.pow(0.0022, dt / 1000); // 帧率无关阻尼
    cam.az += (camGoal.az - cam.az) * k;
    cam.el += (camGoal.el - cam.el) * k;
    cam.dist += (camGoal.dist - cam.dist) * k;
    cam.tx += (camGoal.tx - cam.tx) * k;
    cam.ty += (camGoal.ty - cam.ty) * k;
    cam.tz += (camGoal.tz - cam.tz) * k;

    // 空闲自转（未选中、未变形）
    if (morphT < 0 && !activePart && !hoverPart && !document.hidden) {
      cam.az += dt * 0.0022; // ≈0.126°/帧·秒
      camGoal.az = cam.az;
    }

    // 腾位滑移
    shiftX += (shiftGoal - shiftX) * k;
    const azR = (cam.az * Math.PI) / 180;
    root.position.x = Math.cos(azR) * shiftX;
    root.position.z = -Math.sin(azR) * shiftX;

    // 呼吸脉冲（选中时逐帧重绘高亮）
    if (activePart) {
      pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
      paintParts();
    }

    applyCam();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  /* ---------- API ---------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const api: SceneApi = {
    resize() {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      geo.dispose();
      mat.dispose();
      pickMat.dispose();
      lcdTex.dispose();
      renderer.dispose();
    },
    morphIn(fromPixels, reduced, onDone) {
      if (reduced) {
        // 直切：从目标位开始
        const arr = mesh.instanceMatrix.array as Float32Array;
        for (let i = 0; i < N; i++) {
          const b = i * 16;
          arr[b] = arr[b + 5] = arr[b + 10] = 1;
          arr[b + 12] = model.positions[i * 3];
          arr[b + 13] = model.positions[i * 3 + 1];
          arr[b + 14] = model.positions[i * 3 + 2];
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          const c = mesh.instanceColor.array as Float32Array;
          c.set(baseColors);
          mesh.instanceColor.needsUpdate = true;
        }
        onDone();
        return;
      }
      // 入场镜头：远机位轻微俯冲 dolly-in，落回 home 位姿（先定机位再播种，反投影才对齐首帧）
      cam.az = PART_POSES.home.az + 16;
      cam.el = PART_POSES.home.el + 7;
      cam.dist = HOME_DIST * 1.55;
      camGoal.az = PART_POSES.home.az;
      camGoal.el = PART_POSES.home.el;
      camGoal.dist = HOME_DIST;
      camGoal.tx = PART_POSES.home.lift[0];
      camGoal.ty = PART_POSES.home.lift[1] + 2;
      camGoal.tz = PART_POSES.home.lift[2];
      applyCam();
      lcdVisible(false);
      api.resize(); // 矩阵/尺寸与当前 rect 同步后再反投影
      seedMorph(fromPixels, "in");
      morphDone = onDone;
    },
    morphOut(fromPixels, reduced, onDone) {
      if (reduced) {
        onDone();
        return;
      }
      lcdVisible(false);
      seedMorph(fromPixels, "out");
      morphDone = onDone;
    },
    setHoverPart(p) {
      if (hoverPart === p) return;
      hoverPart = p;
      paintParts();
    },
    setActivePart(p) {
      activePart = p;
      paintParts();
      if (p) {
        const pose = PART_POSES[p];
        const c = model.partBoxes[p].center;
        camGoal.az = pose.az;
        camGoal.el = pose.el;
        camGoal.dist = pose.dist * Math.max(
          24,
          model.partBoxes[p].max[0] - model.partBoxes[p].min[0] + 18,
          model.partBoxes[p].max[1] - model.partBoxes[p].min[1] + 18,
          model.partBoxes[p].max[2] - model.partBoxes[p].min[2] + 18
        );
        camGoal.tx = c[0] + pose.lift[0];
        camGoal.ty = c[1] + pose.lift[1];
        camGoal.tz = c[2] + pose.lift[2];
      } else {
        camGoal.az = PART_POSES.home.az;
        camGoal.el = PART_POSES.home.el;
        camGoal.dist = HOME_DIST;
        camGoal.tx = PART_POSES.home.lift[0];
        camGoal.ty = PART_POSES.home.lift[1];
        camGoal.tz = PART_POSES.home.lift[2];
      }
    },
    pickAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(pickMeshes, false);
      if (!hits.length) return null;
      for (const [key, meshRef] of pickByPart) {
        if (hits[0].object === meshRef) return key;
      }
      return null;
    },
    projectPart(p) {
      const c = model.partBoxes[p].center;
      const v = new THREE.Vector3(c[0], c[1], c[2]).applyMatrix4(root.matrixWorld).project(camera);
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + ((v.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - v.y) / 2) * rect.height,
      };
    },
    setCardShift(side) {
      shiftGoal = side === "left" ? 16 : side === "right" ? -16 : 0;
    },
  };

  api.resize();
  // 机箱态高度靠 min-height 过渡改变，窗口 resize 不触发——观察画布盒子本身
  const ro = new ResizeObserver(() => api.resize());
  ro.observe(canvas);
  const origDispose = api.dispose;
  api.dispose = () => {
    ro.disconnect();
    origDispose();
  };
  return api;
}
