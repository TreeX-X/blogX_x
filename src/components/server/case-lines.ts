/*-- 「服务器」线条层（S2）：底模提棱线 → fat lines（L1 常显层）
   每部件（含壳体）的棱线合并为单条 LineSegments2（一次绘制调用）；
   线宽两级预留：壳体细线 / 部件粗线；S5 的 L2 细节线在此结构上追加。
   段序按空间扫描排布，instanceCount 渐进揭示即一笔一笔绘出（S3 draw-on）。
   设计语言：浅色石板 + 深线（2026-10-16 用户定案）。
   Note: see .agents/notes/2026-10-15-server-tab-linecase-requirement--103be143.md --*/

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { CaseModel, PartKey } from "./case-model";

// three 走 any 语义 shim，实例引用不写具体类型
type Any3 = any;

export interface CaseLinesApi {
  setResolution(w: number, h: number): void;
  /** 0→1 线条空间序渐进揭示；1 为全显。 */
  setDrawProgress(t: number): void;
  /** 当前笔尖（前沿已绘段中点），未开始或已绘完返回 null。 */
  getDrawFrontier(): { x: number; y: number; z: number } | null;
  dispose(): void;
}

/** 深线色板（浅土黄纸面上的线稿语言） */
const LINE = {
  shell: 0x5a4826, // 壳体主笔（深棕）
  shellGhost: 0x8a7345, // 壳体草稿辅笔（浅棕虚线）
  part: 0x2a2010, // 部件主笔（墨棕，主角）
  partGhost: 0x6b542e, // 部件草稿辅笔
};

/** 时间窗：壳体先行扫完，部件略滞后跟随（同一条笔尖带出结构与内构）。 */
const WINDOW = {
  shell: { start: 0, end: 0.85 },
  part: { start: 0.12, end: 1 },
};

/** 空间扫描键：y 主导（自下而上），x/z 轻微倾斜避免纯水平抹除。 */
const sweepKey = (x: number, y: number, z: number) => x * 0.55 + y + z * 0.25;

type SegData = { positions: Float32Array; keys: Float32Array; mids: Float32Array };
type DrawRec = {
  geo: Any3;
  keys: Float32Array; // 归一化 0..1，升序
  mids: Float32Array;
  layer: "shell" | "part";
  ghost: boolean;
  count: number;
};

export function buildCaseLines(model: CaseModel): CaseLinesApi {
  model.root.updateMatrixWorld(true);

  const recs: DrawRec[] = [];
  const geometries: Any3[] = [];
  const materials: Any3[] = [];
  const v = new THREE.Vector3();

  /* 确定性顶点抖动：按原坐标取哈希 → 共享顶点抖动一致，笔迹连贯；草稿手绘感来源 */
  const hash3 = (x: number, y: number, z: number, seed: number) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 17.13) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  };

  let keyMin = Infinity, keyMax = -Infinity;

  const collect = (group: Any3, threshold: number, amp: number, seed: number): SegData => {
    const segs: number[][] = []; // [key, x1,y1,z1, x2,y2,z2, mx,my,mz]
    const v2 = new THREE.Vector3();
    /** 长线段切小段后按「原坐标哈希」抖动：共享端点一致 → 连续手绘起伏（非整根倾斜） */
    const pushJittered = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / 7));
      for (let s = 0; s < n; s++) {
        const t0 = s / n, t1 = (s + 1) / n;
        const x0 = ax + (bx - ax) * t0, y0 = ay + (by - ay) * t0, z0 = az + (bz - az) * t0;
        const x1 = ax + (bx - ax) * t1, y1 = ay + (by - ay) * t1, z1 = az + (bz - az) * t1;
        const jx0 = x0 + hash3(x0, y0, z0, seed) * amp, jy0 = y0 + hash3(x0, y0, z0, seed + 1) * amp, jz0 = z0 + hash3(x0, y0, z0, seed + 2) * amp;
        const jx1 = x1 + hash3(x1, y1, z1, seed) * amp, jy1 = y1 + hash3(x1, y1, z1, seed + 1) * amp, jz1 = z1 + hash3(x1, y1, z1, seed + 2) * amp;
        const mx = (jx0 + jx1) / 2, my = (jy0 + jy1) / 2, mz = (jz0 + jz1) / 2;
        const key = sweepKey(mx, my, mz);
        if (key < keyMin) keyMin = key;
        if (key > keyMax) keyMax = key;
        segs.push([key, jx0, jy0, jz0, jx1, jy1, jz1, mx, my, mz]);
      }
    };
    group.traverse((o: Any3) => {
      if (!o.isMesh || !o.geometry || o.userData.sketch === false) return;
      const eg = new THREE.EdgesGeometry(o.geometry, threshold);
      const pos = eg.attributes.position;
      for (let i = 0; i < pos.count; i += 2) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        v2.fromBufferAttribute(pos, i + 1).applyMatrix4(o.matrixWorld);
        pushJittered(v.x, v.y, v.z, v2.x, v2.y, v2.z);
      }
      eg.dispose();
    });
    segs.sort((a, b) => a[0] - b[0]);
    const n = segs.length;
    const positions = new Float32Array(n * 6);
    const keys = new Float32Array(n);
    const mids = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const s = segs[i];
      keys[i] = s[0];
      positions.set([s[1], s[2], s[3], s[4], s[5], s[6]], i * 6);
      mids.set([s[7], s[8], s[9]], i * 3);
    }
    return { positions, keys, mids };
  };

  const makeLines = (data: SegData, color: number, width: number, opacity: number,
    dashed: boolean, layer: "shell" | "part", ghost: boolean, partKey?: PartKey) => {
    if (data.positions.length < 6) return;
    const geo = new LineSegmentsGeometry();
    geo.setPositions(data.positions);
    const mat = new LineMaterial({
      color,
      linewidth: width,
      transparent: true,
      opacity,
      dashed,
      dashScale: 1,
      dashSize: dashed ? 2.6 : 1,
      gapSize: dashed ? 1.8 : 0,
    });
    const ls = new LineSegments2(geo, mat);
    if (dashed) ls.computeLineDistances();
    if (partKey) ls.userData.partKey = partKey;
    geometries.push(geo);
    materials.push(mat);
    model.root.add(ls);
    recs.push({ geo, keys: data.keys, mids: data.mids, layer, ghost, count: data.keys.length });
  };

  /** 双层笔迹：实线主笔 + 抖动虚线草稿辅笔 */
  const sketch = (group: Any3, colorMain: number, colorGhost: number, width: number,
    layer: "shell" | "part", precision = false, partKey?: PartKey) => {
    makeLines(collect(group, 25, precision ? 0.035 : 0.1, 1), colorMain, width, 0.95, false, layer, false, partKey);
    if (!precision) makeLines(collect(group, 25, 0.28, 7), colorGhost, width * 0.5, 0.2, true, layer, true, partKey);
  };

  // 壳体：细笔迹
  sketch(model.shell, LINE.shell, LINE.shellGhost, 1.45, "shell");

  // 五部件：粗主笔（拾取/高亮/细节开关按组走）
  for (const key of Object.keys(model.partGroups) as PartKey[]) {
    // Component details use a single fine stroke; the shell retains its sketch trace.
    sketch(model.partGroups[key], LINE.part, LINE.partGhost, key === "gpu" ? 1.25 : 1.45, "part", true, key);
  }

  // All strokes follow actual model edges; no free-floating drafting marks.

  /* 键空间归一化 0..1，供时间窗映射阈值 */
  const span = Math.max(1e-6, keyMax - keyMin);
  for (const rec of recs) {
    for (let i = 0; i < rec.keys.length; i++) rec.keys[i] = (rec.keys[i] - keyMin) / span;
  }

  const thresholdFor = (layer: "shell" | "part", t: number) => {
    const w = WINDOW[layer];
    return THREE.MathUtils.clamp((t - w.start) / (w.end - w.start), 0, 1);
  };
  /** 升序 keys 上找 key ≤ th 的个数（线性扫足够：段数数千级） */
  const revealCount = (rec: DrawRec, th: number) => {
    let n = 0;
    while (n < rec.count && rec.keys[n] <= th) n++;
    return n;
  };

  let drawT = 0;
  const applyProgress = (t: number) => {
    drawT = THREE.MathUtils.clamp(t, 0, 1);
    for (const rec of recs) rec.geo.instanceCount = revealCount(rec, thresholdFor(rec.layer, drawT));
  };
  applyProgress(0);

  return {
    setResolution(w: number, h: number) {
      for (const m of materials) m.resolution.set(w, h);
    },
    setDrawProgress: applyProgress,
    getDrawFrontier() {
      if (drawT <= 0 || drawT >= 1) return null;
      let best: { x: number; y: number; z: number } | null = null;
      let bestKey = -1;
      for (const rec of recs) {
        if (rec.ghost) continue;
        const th = thresholdFor(rec.layer, drawT);
        if (th >= 1) continue; // 该层已绘完：不再贡献前沿，笔尖跟随仍在画的层
        const n = revealCount(rec, th);
        if (n > 0 && rec.keys[n - 1] > bestKey) {
          bestKey = rec.keys[n - 1];
          best = { x: rec.mids[(n - 1) * 3], y: rec.mids[(n - 1) * 3 + 1], z: rec.mids[(n - 1) * 3 + 2] };
        }
      }
      return best;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
