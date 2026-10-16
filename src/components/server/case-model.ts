/*-- 「服务器」机箱底模（S1）：按 ROG Cronox 参考图形态程序化装配
   视角口径（对齐参考图 catalog-1）：玻璃侧透 = +x（默认视图屏左），
   前脸（风扇柱 + 品牌竖条）= -z（默认视图屏右）；默认机位 az=+135°。
   部件分组（cpu/gpu/lcd/fans/psu）为 S2 提线 / S4 拾取 / S5 细节线预留结构。
   Note: see .agents/notes/2026-10-15-server-tab-linecase-requirement--103be143.md
   形态标尺：_temp/design-demos/assets/rog-cronox/（仅参考，不使用其图形资产） --*/

import * as THREE from "three";

// three 走 any 语义 shim（见 src/types/three-shim.d.ts），实例引用不写具体类型
type Obj3D = any;
type Vec3 = any;

export type PartKey = "cpu" | "gpu" | "mb" | "fans" | "psu";
export const PART_KEYS: PartKey[] = ["cpu", "gpu", "mb", "fans", "psu"];

export interface CaseModel {
  root: Obj3D;
  shell: Obj3D;
  partGroups: Record<PartKey, Obj3D>;
  /** 部件锚点（引线/相机 target 用，本地坐标） */
  partAnchors: Record<PartKey, Vec3>;
}

type RGB = number;

const hex = (h: number): RGB => h;

/** 色板：浅系土黄 + 深线（2026-10-16 用户定案「线条绘画感 + 浅系土黄」） */
const C = {
  slate: hex(0xc9b48a), // 壳体主面（浅土黄）
  slateLight: hex(0xdcc9a2), // 亮棱/框条
  slateDark: hex(0xa8906a), // 深槽/格栅
  ink: hex(0x6e5a3c), // 内构件（深棕土黄）
  blade: hex(0x8a7550), // 风扇叶片
  ox: hex(0xb93b28), // 牛血点缀（品牌连续性）
  cream: hex(0xf0e6d0), // 浅件/螺丝
};

export function buildCaseModel(): CaseModel {
  const root = new THREE.Group();
  const shell = new THREE.Group();
  root.add(shell);

  /* 平涂填充（MeshBasic，无光影）——线条绘画感：色块 + 线稿，像纸上插画 */
  const mSlate = new THREE.MeshBasicMaterial({ color: C.slate });
  const mSlateL = new THREE.MeshBasicMaterial({ color: C.slateLight });
  const mSlateD = new THREE.MeshBasicMaterial({ color: C.slateDark });
  const mInk = new THREE.MeshBasicMaterial({ color: C.ink });
  const mBlade = new THREE.MeshBasicMaterial({ color: C.blade });
  const mOx = new THREE.MeshBasicMaterial({ color: C.ox });
  const mCream = new THREE.MeshBasicMaterial({ color: C.cream });
  const mGlass = new THREE.MeshBasicMaterial({
    color: 0xf0e6d0, transparent: true, opacity: 0.07,
    side: THREE.DoubleSide, depthWrite: false,
  });

  const box = (w: number, h: number, d: number, mat: Obj3D, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  };

  /** 风扇（轴向 = z：默认面向 ±z；group 旋转可改向） */
  const fanZ = (r: number, depth: number) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.92, r * 0.12, 12, 40), mSlateL);
    g.add(ring);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.32, depth * 1.2, 20), mInk);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, r * 0.05, 8, 40), mOx);
    glow.position.z = depth * 0.4;
    g.add(glow);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(r * 0.58, r * 0.26, depth * 0.5), mBlade);
      blade.position.set(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 0);
      blade.rotation.z = a + Math.PI / 2.5;
      blade.rotation.x = 0.45;
      g.add(blade);
    }
    return g;
  };

  /* ================= 壳体（W54 × H92 × D58，中心原点） ================= */
  shell.add(box(54, 2.6, 58, mSlate, 0, 46, 0));           // 顶
  shell.add(box(54, 2.6, 58, mSlate, 0, -46, 0));          // 底
  shell.add(box(2.6, 92, 58, mSlate, -27, 0, 0));          // 深壁板（-x 实体）

  // 前脸（-z，风扇侧）：实体面板 + 散热缝 + 品牌竖条（2026-10-16：非玻璃但保留风扇）
  shell.add(box(54, 92, 2.6, mSlate, 0, 0, -29));          // 前面板整面实体
  for (const fy of [24, 0, -24])
    for (let i = 0; i < 6; i++)
      shell.add(box(26, 1.6, 1.1, mSlateD, 5, fy - 7 + i * 3, -30.3)); // 散热缝（对齐风扇位）
  shell.add(box(1.2, 64, 0.8, mOx, -14.2, 2, -30.4));      // 牛血细条
  shell.add(box(3.2, 3.2, 0.8, mCream, -17.2, 36, -30.4)); // Logo 方块
  shell.add(box(6.4, 0.7, 0.8, mCream, -17.2, 32.4, -30.4));
  shell.add(box(2.6, 22, 0.8, mCream, -19.6, 16, -30.4));  // 大字竖排
  shell.add(box(2.6, 14, 0.8, mCream, -19.6, -8, -30.4));
  shell.add(box(2.6, 18, 0.8, mCream, -19.6, -28, -30.4));

  // 后侧（+z）玻璃（2026-10-16：可见侧皆玻璃）+ 框条 + 角钉
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(49, 89), mGlass);
  rearGlass.position.set(0, 0, 29.3);
  shell.add(rearGlass);
  shell.add(box(58, 3.4, 2.2, mSlateL, 0, 44.2, 27.6));
  shell.add(box(58, 3.4, 2.2, mSlateL, 0, -44.2, 27.6));
  shell.add(box(3.4, 88, 2.2, mSlateL, -25.2, 0, 27.6));
  shell.add(box(3.4, 88, 2.2, mSlateL, 25.2, 0, 27.6));

  // 品牌竖条丝印（参考图前柱：Logo + 白线 + 大字竖排）
  shell.add(box(3.2, 3.2, 0.8, mCream, -17.2, 36, -29.6));          // Logo 方块
  shell.add(box(6.4, 0.7, 0.8, mCream, -17.2, 32.4, -29.6));        // Logo 下白线
  shell.add(box(1.2, 64, 0.8, mOx, -14.2, 2, -29.6));               // 牛血细条
  shell.add(box(2.6, 22, 0.8, mCream, -19.6, 16, -29.6));           // 大字竖排（长短交替）
  shell.add(box(2.6, 14, 0.8, mCream, -19.6, -8, -29.6));
  shell.add(box(2.6, 18, 0.8, mCream, -19.6, -28, -29.6));

  // 玻璃侧透（+x）+ 框条 + 角钉
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(55, 89), mGlass);
  glass.position.set(27.3, 0, 0);
  glass.rotation.y = Math.PI / 2;
  shell.add(glass);
  shell.add(box(2.2, 3.4, 58, mSlateL, 27, 44.2, 0));   // 上沿（z 向）
  shell.add(box(2.2, 3.4, 58, mSlateL, 27, -44.2, 0));  // 下沿
  shell.add(box(2.2, 88, 3.4, mSlateL, 27, 0, -27.2));  // 前沿（y 向）
  shell.add(box(2.2, 88, 3.4, mSlateL, 27, 0, 27.2));   // 后沿

  // 顶面散热格（棋盘）
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 5; j++)
      shell.add(box(3.6, 0.5, 3.6, mSlateD, -18 + i * 6, 47.4, -12 + j * 6));
  // 顶前 IO 条（参考图 top-front：电源 / USB×2 / 音频）
  shell.add(box(22, 0.9, 7, mSlateD, -6, 47.3, -21));
  shell.add(box(2.6, 0.7, 2.6, mOx, -14, 47.9, -21));        // 电源键
  shell.add(box(3.4, 0.7, 1.8, mInk, -8, 47.9, -21));        // USB-A
  shell.add(box(3.4, 0.7, 1.8, mInk, -3, 47.9, -21));
  shell.add(box(2.2, 0.7, 1.8, mInk, 1.4, 47.9, -21));       // USB-C
  shell.add(box(1.6, 0.7, 1.6, mCream, 5, 47.9, -21));       // 音频

  // 脚垫
  for (const [fx, fz] of [[-20, -20], [20, -20], [-20, 20], [20, 20]] as const) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 3.4, 18), mInk);
    foot.position.set(fx, -48.8, fz);
    shell.add(foot);
  }

  /* ================= 部件组 ================= */
  const partGroups = {} as Record<PartKey, Obj3D>;
  for (const k of PART_KEYS) {
    const g = new THREE.Group();
    g.userData.partKey = k;
    partGroups[k] = g;
    root.add(g);
  }

  /* ---- 01 CPU 水冷头 + 管路 + 顶置冷排 ---- */
  {
    const g = partGroups.cpu;
    g.add(box(13.5, 13.5, 12, mInk, -13, 15, -2));                   // 泵头主体
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.65, 10, 36), mOx);
    ring.position.set(-5.8, 15, -2);
    ring.rotation.y = Math.PI / 2; // 面向玻璃（+x）
    g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3, 0.45, 8, 28), mSlateL);
    ring2.position.set(-6, 15, -2);
    ring2.rotation.y = Math.PI / 2;
    g.add(ring2);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.2, 24), mOx);
    cap.position.set(-5.8, 15, -2);
    cap.rotation.z = Math.PI / 2;
    g.add(cap);
    // 泵盖四角螺钉
    for (const [sy, sz] of [[4.8, -4.8], [4.8, 4.8], [-4.8, -4.8], [-4.8, 4.8]] as const) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.9, 10), mCream);
      screw.position.set(-6.1, 15 + sy, -2 + sz);
      screw.rotation.z = Math.PI / 2;
      g.add(screw);
    }
    // 泵体顶底棱 + 侧肋条
    g.add(box(14.2, 1.8, 12.7, mSlateL, -13, 21.3, -2));
    g.add(box(14.2, 1.2, 12.7, mSlateD, -13, 8.3, -2));
    for (let i = 0; i < 3; i++) {
      g.add(box(1, 1.2, 12.8, mSlateD, -17.5 + i * 4, 22.4, -2));
      g.add(box(1, 1.2, 12.8, mSlateD, -17.5 + i * 4, 7.6, -2));
    }
    // 安装支架臂（泵头 → 主板）
    g.add(box(8, 2, 2.6, mSlateL, -19.5, 21, -6.5));
    g.add(box(8, 2, 2.6, mSlateL, -19.5, 21, 2.5));
    // 水冷管接头套环
    g.add(box(3, 2.4, 3, mSlateL, -11, 19.6, -5));
    g.add(box(3, 2.4, 3, mSlateL, -11, 19.6, 3));
    g.add(box(28, 3.6, 36, mSlateL, -2, 41.5, 2));                   // 冷排
    for (let i = 0; i < 9; i++) g.add(box(24, 0.5, 1, mInk, -2, 39.4, -13 + i * 3.6)); // 鳍片
    for (const tz of [-5, 3]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-11, 20, tz), new THREE.Vector3(-9, 28, tz - 1.5),
        new THREE.Vector3(-5, 35, tz - 1), new THREE.Vector3(-3, 39, tz),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 1, 8), mOx));
    }
  }

  /* ---- 02 显卡（NVIDIA Founders Edition 形态还原，2026-10-16 用户指令重做：
     官方 304×137×61 三槽比例 → 厚 12(x)×高 25(y)×长 45(z) 修薄卡身；
     设计语言：机加工棱框 + 双端贯穿风扇（底置）+ 玻璃侧鳍片梳 + GEFORCE 字带 + 顶置供电口） ---- */
  {
    const g = partGroups.gpu;
    // 卡身中心 (-15.5,-5.5,-1)：金手指侧贴主板 PCIe（x -21.5），玻璃侧 x -9.5
    const cx = -15.5, cy = -5.5, cz = -1;
    g.add(box(12, 25, 45, mInk, cx, cy, cz));                    // 深色罩壳（FE 石墨质感）
    // 机加工棱框（FE 铸铝倒角语言）：上下长棱 + 前端框
    g.add(box(13, 1.9, 46, mSlateL, cx, 6.45, cz));
    g.add(box(13, 1.9, 46, mSlateL, cx, -17.45, cz));
    g.add(box(13, 25.4, 1.7, mSlateL, cx, cy, -23.6));
    // 玻璃侧鳍片梳（贯穿风道散热鳍，微凸面板 → 竖向梳齿线）
    for (let i = 0; i < 18; i++)
      g.add(box(10.8, 19, 0.85, mSlateD, -14.3, -5.2, -18.5 + i * 2.25));
    // GEFORCE 字带（玻璃侧中部铭牌 + 抽象字块 + 牛血灯带）
    g.add(box(0.85, 3.6, 18, mCream, -8.3, -5.5, -2));
    for (let i = 0; i < 8; i++)
      g.add(box(0.8, 2.1, 1.05, mInk, -7.7, -5.5, -9.2 + i * 2.05));
    g.add(box(0.9, 0.9, 10, mOx, -8.1, -2.9, -2));
    // 顶置供电口（12VHPWR 位，顶棱中前段，避让水冷头底部）
    g.add(box(3.4, 1.2, 4.4, mSlateD, -14.5, 7.6, -12));
    g.add(box(3.8, 0.55, 4.8, mCream, -14.5, 8.25, -12));
    // 底置贯穿双风扇（FE 式：两端各一，面向 -y）+ 八角开孔环
    for (const tz of [-13.5, 13.5]) {
      const f = fanZ(5.8, 1.4);
      f.position.set(cx, -19.1, tz);
      f.rotation.x = Math.PI / 2; // 面向 -y（下方）
      g.add(f);
      const cut = new THREE.Mesh(new THREE.TorusGeometry(5.9, 0.65, 10, 8), mCream);
      cut.position.set(cx, -18.9, tz);
      cut.rotation.x = Math.PI / 2;
      g.add(cut);
    }
    // 后缘 IO 挡板（+z 端，朝后玻璃可看）：挡板 + 接口槽 + 散热缝 + 螺丝耳
    g.add(box(14.5, 27, 1.3, mSlateL, cx, -4, 22.3));
    for (let i = 0; i < 4; i++)
      g.add(box(2.1, 1.6, 0.8, mInk, -19.2 + i * 2.55, 1.2, 22.9));
    for (const sy of [5.2, 6.6]) g.add(box(9.5, 0.7, 0.55, mSlateD, cx, sy, 22.9));
    g.add(box(2.6, 3.2, 1, mSlateL, -20, 11.05, 22.3));
  }

  /* ---- 03 主板（2026-10-16 细节强化，取代已移除的 LCD 部件位） ---- */
  {
    const g = partGroups.mb;
    // PCB 薄板
    g.add(box(1.4, 58, 44, mInk, -23.8, 6, 0));
    // PCB 丝印走线（细条纹）
    for (let i = 0; i < 6; i++) g.add(box(0.35, 40, 0.5, mSlateD, -22.95, 6, -18 + i * 7.2));
    // CPU 插座区 + 背板
    g.add(box(1.2, 15, 15, mSlateD, -22.9, 15, -2));
    g.add(box(0.8, 11, 11, mSlateL, -22.2, 15, -2));
    // VRM 顶散热片（鳍纹）
    g.add(box(2.4, 6, 22, mSlateL, -22.4, 31, -2));
    for (let z = -11; z <= 8; z += 3) g.add(box(2.9, 6.6, 0.7, mSlateD, -22.4, 31, z));
    // VRM 侧散热片
    g.add(box(2.4, 14, 6, mSlateL, -22.4, 25, -16));
    // 内存插槽 ×4（牛血顶光；靠视角侧，与水冷头错开投影）
    for (let i = 0; i < 4; i++) {
      g.add(box(1.8, 16, 2.4, mSlateL, -21.8, 18, 7 + i * 3.6));
      g.add(box(0.4, 16, 0.8, mOx, -20.7, 18, 7 + i * 3.6));
    }
    // PCIe 插槽 ×2 + M.2 散热片（x16 对准显卡金手指底棱 y≈-18，下方开放槽）
    g.add(box(1.6, 1.4, 30, mSlateD, -22.2, -18, -6));
    g.add(box(1.6, 1.4, 26, mSlateD, -22.2, -22, -4));
    g.add(box(1.2, 1.3, 14, mSlateL, -22.2, -20, -8));
    // 芯片组散热片（牛血芯）
    g.add(box(2.2, 7, 10, mSlateL, -22.3, -15, 8));
    g.add(box(0.6, 3, 5, mOx, -21, -15, 8));
    // 24-pin 主供电 + 8-pin CPU 供电
    g.add(box(2.4, 7, 3.4, mSlateD, -21.8, 2, 19.5));
    g.add(box(2.4, 3, 2.6, mSlateD, -21.8, 28, 15));
    // 电容阵列
    for (let i = 0; i < 5; i++) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 10), mSlateL);
      cap.position.set(-21.8, 26, -10 + i * 2.6);
      cap.rotation.z = Math.PI / 2;
      g.add(cap);
    }
    // CMOS 电池
    const battery = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.8, 18), mSlateL);
    battery.position.set(-21.8, -16, -12);
    battery.rotation.z = Math.PI / 2;
    g.add(battery);
    // 安装螺钉
    for (const [sy, sz] of [[30, -18], [30, 18], [-16, -18], [-16, 18]] as const) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.7, 10), mCream);
      screw.position.set(-22.6, sy, sz);
      screw.rotation.z = Math.PI / 2;
      g.add(screw);
    }
  }

  /* ---- 04 风扇组：前脸 ×3（2026-10-16：移除主板区多余的后置支架风扇） ---- */
  {
    const g = partGroups.fans;
    for (let i = 0; i < 3; i++) {
      const f = fanZ(9.2, 2);
      f.position.set(5, 24 - i * 24, -26.2); // 面向 -z（前脸）
      g.add(f);
    }
  }

  /* ---- 05 电源仓（2026-10-16 终版：舱盖 + 舱盖上大电源（避让前风扇）） ---- */
  {
    const g = partGroups.psu;
    // 舱盖（整宽，顶面格栅）
    g.add(box(50, 11, 54, mSlate, 0, -38, 1));
    for (let i = 0; i < 5; i++) g.add(box(2.2, 0.5, 40, mSlateD, -18 + i * 9, -32.2, 1));
    // 电源本体：坐在舱盖上、前部（风扇侧），z 向避让前风扇平面（z≥-20）
    g.add(box(28, 17, 22, mInk, -2, -23.5, -8));
    g.add(box(29, 1, 23, mSlateL, -2, -14.8, -8));                   // 顶盖亮棱
    const grill = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.7, 10, 32), mSlateL);
    grill.position.set(12.4, -23.5, -8);
    grill.rotation.y = Math.PI / 2; // 面向玻璃
    g.add(grill);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1, 20), mOx);
    hub.position.set(12.4, -23.5, -8);
    hub.rotation.z = Math.PI / 2;
    g.add(hub);
    // 品牌铭带（齐平，玻璃侧）
    g.add(box(1, 3.2, 12, mOx, 12.2, -29.5, -8));
  }

  /* ---- 内构氛围已并入主板部件块（2026-10-16） ---- */

  const partAnchors: Record<PartKey, Vec3> = {
    cpu: new THREE.Vector3(-8, 15, -2),
    gpu: new THREE.Vector3(-8, -5.5, -1),
    mb: new THREE.Vector3(-22, 6, 0),
    fans: new THREE.Vector3(5, 0, -26),
    psu: new THREE.Vector3(-2, -23, -8),
  };

  return { root, shell, partGroups, partAnchors };
}
