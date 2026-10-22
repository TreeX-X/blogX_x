/*-- 像素数码 3D 机箱：程序化体素装配（暖纸像素陶瓷）
   部件→栏目映射见 .agents/notes/2026-10-15-pixel-case-hero-requirement--f47e324c.md
   T1 精度提档（2026-10-15）：设计格 ×u 细格（桌面 u=2、lite u=1），世界尺寸保持 52×78×38；
   九项细节（外框/玻璃/主板/显卡风扇叶/水冷头管路/冷排鳍片/电源仓/LCD/前置 I/O）按细格重画；
   大体量件只填壳面，占用表去重叠（细节落同一细格即改色，不堆实例）。
   色板全部取自 src/styles/global.css token 族，不发明新颜色。 --*/

export type PartKey = "cpu" | "gpu" | "lcd" | "fans" | "psu";

/** 体素 part 索引：0=壳体（不可点），1..5 与 PART_KEYS 对齐 */
export const PART_KEYS: PartKey[] = ["cpu", "gpu", "lcd", "fans", "psu"];

export interface VoxelModel {
  /** 每体素中心 xyz（已居中到原点） */
  positions: Float32Array;
  /** 每体素 rgb（0..1） */
  colors: Float32Array;
  /** 每体素部件索引（0=shell） */
  parts: Uint8Array;
  count: number;
  /** 细格间距（世界单位）：u=2 时 0.5，u=1 时 1 */
  cellSize: number;
  /** LCD 纹理屏矩形（世界单位）：屏面嵌在唇边框内，遮住体素接缝 */
  lcdScreen: { x: number; y: number; w: number; h: number; z: number };
  partBoxes: Record<
    PartKey,
    { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] }
  >;
}

/** 相机位姿（相对部件中心）：az/el 为度，dist 为部件外径倍率。
    朝向口径：前脸（LCD/IO）= 世界 -z，玻璃侧透 = 世界 -x。
    最佳展示位一律取「前脸-玻璃」象限（az ∈ (-180, -90)），保证 LCD 正面与内部构件同框。 */
export const PART_POSES: Record<
  PartKey | "home",
  { az: number; el: number; dist: number; lift: [number, number, number] }
> = {
  home: { az: -132, el: 14, dist: 2.55, lift: [0, 2, 0] },
  cpu: { az: -112, el: 18, dist: 1.85, lift: [0, 1, 0] },
  gpu: { az: -104, el: 6, dist: 1.8, lift: [0, 0, 0] },
  lcd: { az: -172, el: 8, dist: 1.75, lift: [0, 2, 0] },
  fans: { az: -86, el: 8, dist: 1.85, lift: [0, 1, 0] },
  psu: { az: -124, el: -12, dist: 1.85, lift: [0, -3, 0] },
};

type RGB = [number, number, number];

/** token 族色板（global.css）：陶瓷 greige + 牛血嵌色 */
const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const C = {
  glaze: hex(0xe9eae6), // surface 陶瓷主面
  glazeLight: hex(0xf8f9f6), // surface-raised 亮棱
  glazeWarm: hex(0xebeae4), // bg-soft 次面
  glazeDeep: hex(0xd9dad5), // surface-deep 暗棱/结构
  inkSoft: hex(0x696b64), // text-muted 内部中灰
  ink: hex(0x383a35), // text-secondary 深结构
  shadow: hex(0x151613), // text 缝隙/深舱
  ox: hex(0xb93b28), // accent 牛血
  oxDeep: hex(0x7a2418), // accent-warm
  oxLight: hex(0xf3d8d0), // accent-light
  cream: hex(0xf8f9f6),
};

/** 确定性抖动（同输入同输出），做釉面微色差 */
const jitter = (x: number, y: number, z: number) => {
  const n = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  return (((n >>> 0) % 1024) / 1024 - 0.5) * 2; // -1..1
};

export function buildVoxelCase(opts: { lite?: boolean } = {}): VoxelModel {
  const lite = opts.lite === true;
  const u = lite ? 1 : 2; // 细格倍率：设计格 ×u
  const S = 1 / u; // 世界单位/细格（箱体世界尺寸恒 52×78×38）
  const DW = 52, DH = 78, DD = 38;
  const W = DW * u, H = DH * u, D = DD * u;

  const pos: number[] = [];
  const col: number[] = [];
  const par: number[] = [];
  // 占用表：同一细格后写改色（细节落在壳面上即改色，不堆叠实例）
  const occ = new Map<number, number>();
  const key = (x: number, y: number, z: number) => x + 256 + (y + 256) * 1024 + (z + 256) * 1048576;

  /** 细格坐标写入（重叠即改色/改部件） */
  const put = (x: number, y: number, z: number, c: RGB, p = 0, glazeJitter = 0.035) => {
    const j = glazeJitter > 0 ? jitter(x, y, z) * glazeJitter : 0;
    const r = Math.min(1, Math.max(0, c[0] + j));
    const g = Math.min(1, Math.max(0, c[1] + j));
    const b = Math.min(1, Math.max(0, c[2] + j));
    const k = key(x, y, z);
    const idx = occ.get(k);
    if (idx !== undefined) {
      col[idx * 3] = r; col[idx * 3 + 1] = g; col[idx * 3 + 2] = b;
      par[idx] = p;
      return;
    }
    occ.set(k, par.length);
    pos.push((x - W / 2) * S, (y - H / 2) * S, (z - D / 2) * S);
    col.push(r, g, b);
    par.push(p);
  };

  /* ===== 设计格原语（外框/大面布局；端点含，每设计格展开 u³ 细格） ===== */

  /** 实体盒 */
  const box = (
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    c: RGB, p = 0, jt = 0.035
  ) => {
    for (let y = y0 * u; y <= y1 * u + u - 1; y++)
      for (let z = z0 * u; z <= z1 * u + u - 1; z++)
        for (let x = x0 * u; x <= x1 * u + u - 1; x++) put(x, y, z, c, p, jt);
  };

  /** 1 细格厚壳面（大体量件只留可见表面；skip: +x -x +y -y +z -z） */
  const shell = (
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    c: RGB, p = 0, skip = ""
  ) => {
    const xs = x0 * u, xe = x1 * u + u - 1, ys = y0 * u, ye = y1 * u + u - 1, zs = z0 * u, ze = z1 * u + u - 1;
    for (let y = ys; y <= ye; y++)
      for (let z = zs; z <= ze; z++)
        for (let x = xs; x <= xe; x++) {
          const on = x === xs || x === xe || y === ys || y === ye || z === zs || z === ze;
          if (!on) continue;
          if (x === xe && skip.includes("+x")) continue;
          if (x === xs && skip.includes("-x")) continue;
          if (y === ye && skip.includes("+y")) continue;
          if (y === ys && skip.includes("-y")) continue;
          if (z === ze && skip.includes("+z")) continue;
          if (z === zs && skip.includes("-z")) continue;
          put(x, y, z, c, p);
        }
  };

  /** 盒棱边倒角（u 细格厚亮棱） */
  const edges = (
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    c: RGB, p = 0
  ) => {
    const xs = x0 * u, xe = x1 * u + u - 1, ys = y0 * u, ye = y1 * u + u - 1, zs = z0 * u, ze = z1 * u + u - 1;
    for (let x = xs; x <= xe; x++)
      for (let t = 0; t < u; t++) {
        put(x, ys + t, zs + t, c, p); put(x, ys + t, ze - t, c, p);
        put(x, ye - t, zs + t, c, p); put(x, ye - t, ze - t, c, p);
      }
    for (let y = ys; y <= ye; y++)
      for (let t = 0; t < u; t++) {
        put(xs + t, y, zs + t, c, p); put(xs + t, y, ze - t, c, p);
        put(xe - t, y, zs + t, c, p); put(xe - t, y, ze - t, c, p);
      }
    for (let z = zs; z <= ze; z++)
      for (let t = 0; t < u; t++) {
        put(xs + t, ys + t, z, c, p); put(xs + t, ye - t, z, c, p);
        put(xe - t, ys + t, z, c, p); put(xe - t, ye - t, z, c, p);
      }
  };

  /* ===== 细格原语（坐标全部为细格） ===== */

  /** x 轴向圆盘（面向玻璃） */
  const discX = (cx: number, cy: number, cz: number, r: number, thick: number, c: RGB, p = 0) => {
    for (let t = 0; t < thick; t++)
      for (let y = -r; y <= r; y++)
        for (let z = -r; z <= r; z++)
          if (y * y + z * z <= r * r) put(cx + t, cy + y, cz + z, c, p, 0);
  };

  /** x 轴向圆环 */
  const ringX = (cx: number, cy: number, cz: number, r: number, w: number, thick: number, c: RGB, p = 0) => {
    for (let t = 0; t < thick; t++)
      for (let y = -r; y <= r; y++)
        for (let z = -r; z <= r; z++) {
          const d = Math.hypot(y, z);
          if (d <= r && d > r - w) put(cx + t, cy + y, cz + z, c, p, 0);
        }
  };

  /** z 轴向圆盘/圆环（前脸 I/O 用） */
  const discZ = (cz: number, cx: number, cy: number, r: number, thick: number, c: RGB, p = 0) => {
    for (let t = 0; t < thick; t++)
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++)
          if (x * x + y * y <= r * r) put(cx + x, cy + y, cz + t, c, p, 0);
  };
  const ringZ = (cz: number, cx: number, cy: number, r: number, w: number, thick: number, c: RGB, p = 0) => {
    for (let t = 0; t < thick; t++)
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++) {
          const d = Math.hypot(x, y);
          if (d <= r && d > r - w) put(cx + x, cy + y, cz + t, c, p, 0);
        }
  };

  /** 风扇（轴向 = x，面向玻璃；外环 + 9 弯叶 + 牛血毂）。cxF 为细格起点（贴面前 1 细格做浮雕） */
  const fanX = (cxF: number, cyF: number, czF: number, rF: number, p: number) => {
    const thick = Math.max(1, u);
    ringX(cxF, cyF, czF, rF, Math.max(1, u / 2 + 0.5), thick, C.glazeDeep, p);
    const hr = Math.max(2, Math.round(rF / 3));
    discX(cxF, cyF, czF, hr, thick, C.ox, p);
    put(cxF, cyF, czF, C.oxDeep, p, 0);
    for (let blade = 0; blade < 9; blade++) {
      const base = (blade / 9) * Math.PI * 2;
      for (let t = hr + 1; t < rF - 1; t++) {
        const rad = base + t * 0.22;
        const yy = cyF + Math.round(Math.cos(rad) * t);
        const zz = czF + Math.round(Math.sin(rad) * t);
        for (let xt = 0; xt < thick; xt++) put(cxF + xt, yy, zz, blade % 2 ? C.inkSoft : C.ink, p, 0);
      }
    }
  };

  /** 管路（设计格路径点，沿线铺 u³ 方块） */
  const tube = (pts: [number, number, number][], c: RGB, p: number) => {
    const emit = (x: number, y: number, z: number) => {
      for (let dx = 0; dx < u; dx++)
        for (let dy = 0; dy < u; dy++)
          for (let dz = 0; dz < u; dz++) put(x + dx, y + dy, z + dz, c, p, 0);
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0] * u, ay = pts[i][1] * u, az = pts[i][2] * u;
      const bx = pts[i + 1][0] * u, by = pts[i + 1][1] * u, bz = pts[i + 1][2] * u;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / u));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        emit(Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t), Math.round(az + (bz - az) * t));
      }
    }
    const last = pts[pts.length - 1];
    emit(last[0] * u, last[1] * u, last[2] * u);
  };

  /* ================= 壳体（外框） ================= */

  // 主面板（+x 不开窗，-x = 玻璃）
  shell(0, 0, 0, DW - 1, DH - 1, DD - 1, C.glaze, 0, "-x");

  // 亮棱倒角
  edges(0, 0, 0, DW - 1, DH - 1, DD - 1, C.glazeLight);

  // 陶瓷板缝（前后面竖缝 + 右面板横缝；lite 跳过）
  if (!lite) {
    for (const sx of [12, 24, 36])
      for (let y = 2 * u; y < (DH - 2) * u; y++)
        for (let t = 0; t < u; t++) {
          put(sx * u + t, y, 0, C.glazeDeep, 0, 0.015);
          put(sx * u + t, y, D - 1, C.glazeDeep, 0, 0.015);
        }
    for (const sy of [16, 32, 48, 64])
      for (let z = 2 * u; z < (DD - 2) * u; z++)
        for (let t = 0; t < u; t++) put(W - 1, sy * u + t, z, C.glazeDeep, 0, 0.015);
  }

  // 顶部散热槽（冷排上方棋盘格）
  for (let dz = 0; dz < 27; dz += 2)
    for (let dx = 0; dx < 25; dx += 2)
      for (let t = 0; t < u; t++)
        for (let s = 0; s < u; s++) put((14 + dx) * u + s, H - 1, (6 + dz) * u + t, C.shadow, 0, 0);

  // 底部脚垫
  for (const [fx, fz] of [[3, 3], [DW - 6, 3], [3, DD - 6], [DW - 6, DD - 6]] as const)
    box(fx, -3, fz, fx + 2, -1, fz + 2, C.ink, 0, 0);

  /* ================= 前置 I/O（前脸 z=0，圆件走 z 轴向） ================= */
  {
    // 电源键：外环 + 牛血心
    ringZ(0, 30 * u, 69 * u, 2 * u, Math.max(1, u), 1, C.ink, 0);
    discZ(0, 30 * u, 69 * u, u, 1, C.ox, 0);
    // USB-A ×2（深槽 + 舌片）
    for (const px of [20, 27]) {
      box(px, 65, 0, px + 5, 67, 0, C.shadow, 0, 0);
      for (let x = (px + 1) * u; x <= (px + 4) * u + u - 1; x++) put(x, 66 * u, 0, C.glazeDeep, 0, 0);
    }
    // USB-C 小口
    box(15, 65, 0, 18, 66, 0, C.shadow, 0, 0);
    // 音频孔
    discZ(0, 11 * u, 65 * u, u, 1, C.shadow, 0);
    // 复位针孔
    put(35 * u, 68 * u, 0, C.shadow, 0, 0);
    // 品牌铭牌（牛血小牌 + 奶油像素点）
    box(5, 68, 0, 10, 72, 0, C.ox, 0, 0);
    put(6 * u, 71 * u, 0, C.cream, 0, 0);
    put(9 * u, 71 * u, 0, C.cream, 0, 0);
    // PSU 进气孔带（斜纹格）
    if (!lite)
      for (let x = 8 * u; x <= 44 * u; x++)
        for (let y = 5 * u; y <= 9 * u; y++)
          if ((x + y) % (2 * u) < u) put(x, y, 0, C.glazeDeep, 0, 0.01);
  }

  /* ================= LCD 仪表屏（03）：唇边框嵌屏，遮体素接缝 ================= */
  {
    const p = 3;
    // 唇边（向 -z 突出 1 设计格的外框）
    for (let x = 8 * u; x <= 42 * u + u - 1; x++)
      for (let t = 0; t < u; t++) {
        put(x, 41 * u + t, -u, C.glazeLight, p, 0);
        put(x, 64 * u + t, -u, C.glazeLight, p, 0);
      }
    for (let y = 41 * u; y <= 64 * u + u - 1; y++)
      for (let t = 0; t < u; t++) {
        put(8 * u + t, y, -u, C.glazeLight, p, 0);
        put(42 * u + t, y, -u, C.glazeLight, p, 0);
      }
    // 齐平面框（平面上）
    for (let x = 8 * u; x <= 42 * u + u - 1; x++)
      for (let t = 0; t < u; t++) {
        put(x, 41 * u + t, 0, C.glazeLight, p, 0);
        put(x, 64 * u + t, 0, C.glazeLight, p, 0);
      }
    for (let y = 41 * u; y <= 64 * u + u - 1; y++)
      for (let t = 0; t < u; t++) {
        put(8 * u + t, y, 0, C.glazeLight, p, 0);
        put(42 * u + t, y, 0, C.glazeLight, p, 0);
      }
    // 屏底暗床（纹理面贴其上）
    for (let x = 9 * u; x <= 41 * u + u - 1; x++)
      for (let y = 42 * u; y <= 63 * u + u - 1; y++) put(x, y, 0, C.shadow, p, 0);
  }

  /* ================= 侧透玻璃（-x 面框 + 角钉） ================= */
  {
    const g0 = 2, g1 = DD - 3, y0 = 2, y1 = DH - 3;
    for (let y = y0 * u; y <= y1 * u + u - 1; y++)
      for (let t = 0; t < u; t++) {
        put(0, y, g0 * u + t, C.glazeLight, 0, 0);
        put(0, y, g1 * u + t, C.glazeLight, 0, 0);
      }
    for (let z = g0 * u; z <= g1 * u + u - 1; z++)
      for (let t = 0; t < u; t++) {
        put(0, y0 * u + t, z, C.glazeLight, 0, 0);
        put(0, y1 * u + t, z, C.glazeLight, 0, 0);
      }
    // 角钉（奶油小圆）
    for (const [sy, sz] of [[y0, g0], [y0, g1], [y1, g0], [y1, g1]] as const)
      discX(0, (sy + 1) * u, (sz + 1) * u, u, 1, C.cream, 0);
  }

  /* ================= 主板（壳内右壁，1 设计格薄板） ================= */
  {
    box(48, 16, 8, 48, 52, 32, C.inkSoft, 0, 0.02);
    // 内存条 ×2（散热片 + 牛血顶）
    for (const mz of [10, 15]) {
      box(45, 40, mz, 47, 47, mz + 2, C.ink, 0, 0.02);
      for (let z = mz * u; z <= (mz + 2) * u + u - 1; z++)
        for (let x = 45 * u; x <= 47 * u + u - 1; x++) put(x, 48 * u, z, C.oxDeep, 0, 0);
    }
    // VRM 散热片（鳍纹朝玻璃）
    box(45, 48, 18, 49, 52, 28, C.glazeDeep, 0, 0.02);
    for (let z = 19; z <= 27; z += 2)
      for (let y = 48 * u; y <= 52 * u + u - 1; y++) put(44 * u, y, z * u, C.inkSoft, 0, 0);
    // 芯片组 + 小核心
    box(46, 20, 22, 49, 24, 28, C.glazeDeep, 0, 0.02);
    box(47, 24, 24, 48, 24, 26, C.shadow, 0, 0);
    // 24-pin 供电口
    box(45, 30, 8, 47, 34, 10, C.shadow, 0, 0);
    for (let y = 31; y <= 33; y += 2) put(44 * u, y * u, 9 * u, C.ink, 0, 0);
  }

  /* ================= CPU 水冷头（01） ================= */
  {
    const p = 1;
    shell(40, 42, 17, 47, 48, 25, C.glazeDeep, p);
    // 泵盖圆环（面向玻璃，贴面前 1 细格浮雕）
    const pr = 2 * u + (lite ? 0 : 1);
    ringX(40 * u - 1, 45 * u, 21 * u, pr, Math.max(1, u), u, C.ox, p);
    discX(40 * u - 1, 45 * u, 21 * u, Math.max(1, u), u, C.oxDeep, p);
    // 牛血顶盖（1 设计格浮雕）+ 奶油角标
    box(41, 49, 18, 46, 49, 24, C.ox, p, 0.02);
    put(40 * u, 48 * u + u - 1, 17 * u, C.cream, p, 0);
    put(47 * u + u - 1, 48 * u + u - 1, 25 * u + u - 1, C.cream, p, 0);
    // 水冷管 ×2（冷头 → 冷排，牛血冷却液）+ 接头套
    tube([[42, 49, 18], [38, 53, 15], [31, 56, 12], [24, 58, 10], [16, 58, 10]], C.oxDeep, p);
    tube([[42, 49, 24], [38, 53, 27], [31, 56, 30], [24, 58, 31], [16, 58, 31]], C.oxDeep, p);
    for (const [tx, ty, tz] of [[42, 49, 18], [42, 49, 24], [16, 58, 10], [16, 58, 31]] as const)
      box(tx - 1, ty - 1, tz - 1, tx, ty, tz, C.ox, p, 0);
    /* 冷排（顶置：壳体 + 鳍片竖纹 + 端盖线） */
    shell(14, 58, 6, 38, 62, 32, C.ink, p);
    for (let z = 7; z <= 31; z += 2)
      for (let y = 58 * u; y <= 62 * u + u - 1; y++)
        for (let t = 0; t < u; t++)
          put(14 * u - 1 + t, y, z * u, z % 4 === 1 ? C.inkSoft : C.glazeDeep, p, 0);
    for (const ty of [58, 61])
      for (let x = 14 * u; x <= 38 * u + u - 1; x++)
        for (let z = 6 * u; z <= 32 * u + u - 1; z++) put(x, ty * u, z, C.glazeDeep, p, 0.02);
  }

  /* ================= 显卡（02） ================= */
  {
    const p = 2;
    shell(8, 26, 10, 40, 34, 30, C.ink, p);
    // 顶板肋条（浮雕 1 设计格）
    for (let z = 10; z <= 30; z += 2)
      for (let x = 8 * u; x <= 40 * u + u - 1; x++)
        for (let t = 0; t < u; t++) put(x, 35 * u + t, z * u, z % 4 === 0 ? C.glaze : C.glazeDeep, p, 0.02);
    // 玻璃侧顶缘牛血灯带（齐平改色）
    for (let z = 10 * u; z <= 30 * u + u - 1; z++)
      for (let x = 8 * u; x <= 12 * u + u - 1; x++) put(x, 34 * u + u - 1, z, C.ox, p, 0);
    // 双风扇（面向玻璃，贴面前 1 细格浮雕）
    fanX(8 * u - 1, 30 * u, 15 * u, 4 * u, p);
    fanX(8 * u - 1, 30 * u, 25 * u, 4 * u, p);
    // 热管 ×2（沿顶板）
    tube([[12, 35, 13], [20, 35, 13], [30, 35, 13], [36, 35, 13]], C.oxDeep, p);
    tube([[12, 35, 27], [20, 35, 27], [30, 35, 27], [36, 35, 27]], C.oxDeep, p);
  }

  /* ================= 侧置风扇组（04） ================= */
  {
    const p = 4;
    shell(3, 22, 9, 5, 52, 23, C.ink, p); // 侧架
    fanX(2 * u, 30 * u, 16 * u, 5 * u, p);
    fanX(2 * u, 44 * u, 16 * u, 5 * u, p);
    // 架角螺钉
    for (const [sy, sz] of [[23, 10], [23, 22], [51, 10], [51, 22]] as const)
      discX(2 * u, sy * u, sz * u, u, 1, C.glazeDeep, p);
  }

  /* ================= 电源仓 PSU 舱（05） ================= */
  {
    const p = 5;
    shell(4, 2, 3, 47, 12, 34, C.glazeWarm, p);
    // 舱顶散热格（棋盘）
    if (!lite)
      for (let x = 7; x <= 44; x += 2)
        for (let z = 5; z <= 32; z += 2)
          for (let t = 0; t < u; t++)
            for (let s = 0; s < u; s++) put(x * u + s, 12 * u + u - 1, z * u + t, C.glazeDeep, p, 0.01);
    // 玻璃侧牛血铭带（齐平改色，1 细格）
    for (let y = 5 * u; y <= 8 * u + u - 1; y++)
      for (let z = 4 * u; z <= 30 * u + u - 1; z++) put(4 * u, y, z, C.oxDeep, p, 0);
    for (let z = 10; z <= 30; z += 4) put(4 * u, 6 * u, z * u, C.ox, p, 0);
    // 电源本体（舱内一角，面向玻璃）
    shell(6, 4, 6, 18, 10, 16, C.ink, p);
    ringX(6 * u - 1, 7 * u, 11 * u, 3 * u, Math.max(1, u), u, C.glazeDeep, p);
    discX(6 * u - 1, 7 * u, 11 * u, u, u, C.oxDeep, p);
    // 背线（隐约）
    for (let y = 14; y <= 40; y += 3) put((DW - 2) * u, y * u, 6 * u, C.ink, p, 0);
    // 24-pin 线束（主板供电口 → 电源）
    tube([[46, 32, 9], [40, 28, 8], [30, 16, 8], [20, 11, 10]], C.ink, p);
  }

  /* ================= 打包 ================= */
  const count = par.length;
  const positions = new Float32Array(pos);
  const colors = new Float32Array(col);
  const parts = new Uint8Array(par);

  const partBoxes = {} as VoxelModel["partBoxes"];
  for (const key of PART_KEYS) {
    const pi = PART_KEYS.indexOf(key) + 1;
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++) {
      if (parts[i] !== pi) continue;
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x;
      if (y > max[1]) max[1] = y;
      if (z > max[2]) max[2] = z;
    }
    partBoxes[key] = {
      min,
      max,
      center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    };
  }

  // LCD 纹理屏：内孔（设计格 9..41 × 42..63）世界矩形，屏面嵌在唇边框内侧
  const sx0 = 9 * u, sx1 = 41 * u + u - 1, sy0 = 42 * u, sy1 = 63 * u + u - 1;
  const lcdScreen = {
    x: ((sx0 + sx1) / 2 - W / 2) * S,
    y: ((sy0 + sy1) / 2 - H / 2) * S,
    w: (sx1 - sx0 + 1) * S,
    h: (sy1 - sy0 + 1) * S,
    z: (0 - D / 2) * S - 0.4, // 屏面略出暗床、藏在唇边框内
  };

  return { positions, colors, parts, count, cellSize: S, lcdScreen, partBoxes };
}
