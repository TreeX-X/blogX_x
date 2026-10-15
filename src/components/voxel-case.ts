/*-- 像素数码 3D 机箱：程序化体素装配（暖纸像素陶瓷）
   部件→栏目映射见 .agents/notes/2026-10-15-pixel-case-hero-requirement--f47e324c.md
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

const W = 52;
const H = 78;
const D = 38;

/** 确定性抖动（同输入同输出），做釉面微色差 */
const jitter = (x: number, y: number, z: number) => {
  const n = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  return (((n >>> 0) % 1024) / 1024 - 0.5) * 2; // -1..1
};

export function buildVoxelCase(opts: { lite?: boolean } = {}): VoxelModel {
  const lite = opts.lite === true;
  const pos: number[] = [];
  const col: number[] = [];
  const par: number[] = [];

  const put = (x: number, y: number, z: number, c: RGB, p = 0, glazeJitter = 0.035) => {
    const j = glazeJitter > 0 ? jitter(x, y, z) * glazeJitter : 0;
    pos.push(x - W / 2, y - H / 2, z - D / 2);
    col.push(
      Math.min(1, Math.max(0, c[0] + j)),
      Math.min(1, Math.max(0, c[1] + j)),
      Math.min(1, Math.max(0, c[2] + j))
    );
    par.push(p);
  };

  /** 实体盒 */
  const box = (
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    c: RGB, p = 0, jt = 0.035
  ) => {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) put(x, y, z, c, p, jt);
  };

  /** 1 厚墙（可指定跳过的面：+x -x +y -y +z -z） */
  const shell = (
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    c: RGB, p = 0, skip = ""
  ) => {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const onShell =
            x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1;
          if (!onShell) continue;
          if (x === x1 && skip.includes("+x")) continue;
          if (x === x0 && skip.includes("-x")) continue;
          if (y === y1 && skip.includes("+y")) continue;
          if (y === y0 && skip.includes("-y")) continue;
          if (z === z1 && skip.includes("+z")) continue;
          if (z === z0 && skip.includes("-z")) continue;
          put(x, y, z, c, p);
        }
  };

  /** 盒棱边（亮棱倒角感） */
  const edges = (
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    c: RGB, p = 0
  ) => {
    for (let x = x0; x <= x1; x++) {
      put(x, y0, z0, c, p); put(x, y0, z1, c, p);
      put(x, y1, z0, c, p); put(x, y1, z1, c, p);
    }
    for (let y = y0; y <= y1; y++) {
      put(x0, y, z0, c, p); put(x0, y, z1, c, p);
      put(x1, y, z0, c, p); put(x1, y, z1, c, p);
    }
    for (let z = z0; z <= z1; z++) {
      put(x0, y0, z, c, p); put(x0, y1, z, c, p);
      put(x1, y0, z, c, p); put(x1, y1, z, c, p);
    }
  };

  /** 风扇（轴向 = x：面向玻璃；环+叶片+牛血毂） */
  const fanX = (cx: number, cy: number, cz: number, r: number, p: number) => {
    for (let a = 0; a < 360; a += 4) {
      const rad = (a * Math.PI) / 180;
      const ex = Math.round(Math.cos(rad) * r);
      const ez = Math.round(Math.sin(rad) * r);
      put(cx, cy + ex, cz + ez, a % 8 < 4 ? C.glazeDeep : C.inkSoft, p, 0);
    }
    for (let blade = 0; blade < 7; blade++) {
      const base = (blade / 7) * Math.PI * 2;
      for (let t = 1; t < r - 1; t++) {
        const rad = base + t * 0.16;
        put(
          cx, cy + Math.round(Math.cos(rad) * t), cz + Math.round(Math.sin(rad) * t),
          blade % 2 ? C.inkSoft : C.ink, p, 0
        );
      }
    }
    put(cx, cy, cz, C.ox, p, 0);
    put(cx - 1, cy, cz, C.oxDeep, p, 0);
    put(cx + 1, cy, cz, C.oxDeep, p, 0);
  };

  /* ================= 壳体 ================= */

  // 主面板（右/-x 不开窗，左 = 玻璃）
  shell(0, 0, 0, W - 1, H - 1, D - 1, C.glaze, 0, "-x");

  // 亮棱倒角
  edges(0, 0, 0, W - 1, H - 1, D - 1, C.glazeLight);

  // 陶瓷板缝（竖向分带，深一档；lite 降档跳过装饰缝）
  if (!lite) {
    for (let sx = 12; sx < W - 2; sx += 12)
      for (let y = 2; y < H - 2; y++) {
        put(sx, y, 0, C.glazeDeep, 0, 0.015);
        put(sx, y, D - 1, C.glazeDeep, 0, 0.015);
      }
    for (let sy = 16; sy < H - 2; sy += 16)
      for (let x = 2; x < W - 2; x++) {
        put(x, sy, D - 1, C.glazeDeep, 0, 0.015);
        put(W - 1, sy, x % (D - 4), C.glazeDeep, 0, 0.015); // 右面板横缝
      }
  }

  // 顶部散热槽（冷排上方；lite 步长减半）
  for (let z = 6; z <= 30; z += lite ? 6 : 3)
    for (let x = 14; x <= 38; x += lite ? 4 : 2) put(x, H - 1, z, C.shadow, 0, 0);

  // 底部脚垫
  for (const [fx, fz] of [[3, 3], [W - 6, 3], [3, D - 6], [W - 6, D - 6]] as const)
    box(fx, -3, fz, fx + 2, -1, fz + 2, C.ink, 0, 0);

  // 前面板：电源键 / I/O / 进气孔
  put(30, H - 8, 0, C.ox, 0, 0);
  put(30, H - 9, 0, C.oxDeep, 0, 0);
  put(31, H - 8, 0, C.oxDeep, 0, 0);
  box(22, H - 12, 0, 27, H - 11, 0, C.ink, 0, 0); // USB
  box(18, H - 12, 0, 20, H - 11, 0, C.shadow, 0, 0); // 音频
  if (!lite)
    for (let y = 5; y <= 9; y += 2)
      for (let x = 8; x <= W - 10; x += 3) put(x, y, 0, C.glazeDeep, 0, 0.01); // PSU 进气孔带

  // 前面板品牌铭牌（牛血小牌）
  box(6, H - 10, 0, 9, H - 7, 0, C.ox, 0, 0);

  /* ================= LCD 仪表屏（03） ================= */
  {
    const p = 3;
    // 凹陷黑边 + 屏面基底（纹理由舞台层贴上）
    box(9, 42, 0, 41, 63, 0, C.shadow, p, 0);
    box(11, 44, 0, 39, 61, 0, C.ink, p, 0);
    // 屏框亮棱
    for (let x = 8; x <= 42; x++) {
      put(x, 41, 0, C.glazeLight, p, 0);
      put(x, 64, 0, C.glazeLight, p, 0);
    }
    for (let y = 41; y <= 64; y++) {
      put(8, y, 0, C.glazeLight, p, 0);
      put(42, y, 0, C.glazeLight, p, 0);
    }
  }

  /* ================= 侧透玻璃（-x 面格栅） ================= */
  {
    // 框
    for (let y = 2; y <= H - 3; y++) {
      put(0, y, 2, C.glazeLight, 0, 0);
      put(0, y, D - 3, C.glazeLight, 0, 0);
    }
    for (let z = 2; z <= D - 3; z++) {
      put(0, 2, z, C.glazeLight, 0, 0);
      put(0, H - 3, z, C.glazeLight, 0, 0);
    }
    // 竖棂 + 横棂（疏格透出内部；lite 只留框与粗棂）
    for (let y = 4; y <= H - 5; y++)
      for (let z = 4; z <= D - 5; z++) {
        const bar = lite ? y % 16 === 5 && z % 8 === 4 : z % 6 === 4 || y % 10 === 5;
        if (bar) put(0, y, z, y % 10 === 5 ? C.glaze : C.glazeLight, 0, 0.02);
      }
  }

  /* ================= 主板（壳内右壁） ================= */
  {
    box(W - 4, 16, 8, W - 2, 52, 32, C.inkSoft, 0, 0.02);
    // 走线点 + 插槽（lite 减量）
    const dots = lite ? 16 : 42;
    for (let i = 0; i < dots; i++) {
      const hx = W - 3;
      const hy = 18 + ((i * 17) % 32);
      const hz = 9 + ((i * 11) % 22);
      put(hx, hy, hz, i % 5 === 0 ? C.oxDeep : C.ink, 0, 0);
    }
    for (let z = 10; z <= 14; z++) box(W - 3, 40, z, W - 3, 46, z, C.shadow, 0, 0); // 内存槽
  }

  /* ================= CPU 水冷头（01） ================= */
  {
    const p = 1;
    box(W - 12, 42, 17, W - 5, 48, 25, C.glazeDeep, p, 0.02); // 冷头主体
    box(W - 11, 47, 18, W - 6, 48, 24, C.ox, p, 0.02); // 牛血顶盖（思考核心）
    put(W - 12, 48, 17, C.cream, p, 0);
    put(W - 5, 48, 25, C.cream, p, 0);
    // 水冷管：冷头 → 冷排（牛血冷却液）
    const tubeA = [
      [W - 8, 48, 18], [W - 10, 51, 16], [W - 12, 54, 14], [W - 14, 56, 12], [W - 16, 57, 10],
    ];
    const tubeB = [
      [W - 8, 48, 24], [W - 10, 51, 26], [W - 12, 54, 28], [W - 14, 56, 30], [W - 16, 57, 31],
    ];
    for (const path of [tubeA, tubeB])
      for (const [tx, ty, tz] of path) {
        box(tx - 1, ty, tz - 1, tx, ty + 1, tz, C.oxDeep, p, 0);
        put(tx, ty, tz, C.ox, p, 0);
      }
  }

  /* ================= 冷排 + 鳍片（01，向量索引隐喻） ================= */
  {
    const p = 1;
    box(14, 58, 6, 38, 62, 32, C.ink, p, 0.02); // 排体
    for (let z = 7; z <= 31; z += lite ? 3 : 2)
      for (let x = 15; x <= 37; x += lite ? 3 : 2) put(x, 58, z, x % 4 === 1 ? C.inkSoft : C.glazeDeep, p, 0); // 鳍片阵
  }

  /* ================= 显卡（02） ================= */
  {
    const p = 2;
    box(8, 28, 10, 40, 33, 30, C.ink, p, 0.02); // 卡身
    box(9, 33, 11, 39, 33, 29, C.glazeDeep, p, 0.02); // 顶板
    for (let z = 12; z <= 28; z += lite ? 4 : 2) put(9, 33, z, z % 4 === 0 ? C.glaze : C.glazeDeep, p, 0.02); // 顶板肋
    put(8, 31, 14, C.ox, p, 0); // 侧向牛血灯带
    put(8, 31, 20, C.ox, p, 0);
    put(8, 31, 26, C.ox, p, 0);
    fanX(8, 30, 15, 4, p); // 双风扇面向玻璃
    fanX(8, 30, 25, 4, p);
  }

  /* ================= 侧置风扇组（04） ================= */
  {
    const p = 4;
    // 玻璃侧内竖置双风扇（O11 式侧装）
    box(3, 22, 9, 5, 52, 23, C.ink, p, 0.02); // 侧架
    fanX(2, 30, 16, 5, p);
    fanX(2, 44, 16, 5, p);
    put(2, 30, 16, C.ox, p, 0);
    put(2, 44, 16, C.ox, p, 0);
  }

  /* ================= 电源仓 PSU 舱（05） ================= */
  {
    const p = 5;
    box(4, 2, 3, W - 5, 12, D - 4, C.glazeWarm, p, 0.025); // 舱体
    for (let z = 5; z <= D - 6; z += lite ? 5 : 3)
      for (let x = 7; x <= W - 8; x += lite ? 5 : 3) put(x, 12, z, C.glazeDeep, p, 0.01); // 舱顶散热格
    box(4, 5, 2, W - 5, 8, 2, C.oxDeep, p, 0); // 面向玻璃的牛血铭带
    for (let x = 10; x <= W - 12; x += 4) put(x, 6, 2, C.ox, p, 0);
    // 电源本体（舱内可见一角）
    box(6, 4, 6, 18, 10, 16, C.ink, p, 0.02);
    put(6, 7, 8, C.oxDeep, p, 0);
    // 背线（隐约）
    for (let y = 14; y <= 40; y += 3) put(W - 2, y, 6, C.ink, p, 0);
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

  return { positions, colors, parts, count, partBoxes };
}
