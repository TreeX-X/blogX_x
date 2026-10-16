/* 「服务器」机箱：ROG Cronox / Hyperion 布局研究后的程序化装配。
 * +x 与 +z 保留全景玻璃展示面；-z 为进风风扇列，-x 为主板托盘。
 * 顶置三风扇冷排、CPU 薄泵头、四 DIMM、横装 FE 显卡、底部独立电源仓。
 * Reference: .agents/notes/2026-10-15-server-tab-linecase-requirement--103be143.md
 */
import * as THREE from "three";
import { buildGpuModel } from "./gpu-model";
import { createCaseParts } from "./case-model-parts";

type Obj3D = any;
type Vec3 = any;
export type PartKey = "cpu" | "gpu" | "mb" | "ram" | "fans" | "psu";
export const PART_KEYS: PartKey[] = ["cpu", "gpu", "mb", "ram", "fans", "psu"];
export interface CaseModel {
  root: Obj3D;
  shell: Obj3D;
  partGroups: Record<PartKey, Obj3D>;
  /** 引线 / 相机锚点，本地坐标。 */
  partAnchors: Record<PartKey, Vec3>;
}

export function buildCaseModel(): CaseModel {
  const { m, box, face, screw, tube, label, fan } = createCaseParts();
  const root = new THREE.Group();
  const shell = new THREE.Group();
  shell.name = "chassis";
  root.add(shell);
  const group = (parent: Obj3D, name: string) => {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    return g;
  };
  const partGroups = {} as Record<PartKey, Obj3D>;
  for (const key of PART_KEYS) {
    const g = group(root, key);
    g.userData.partKey = key;
    partGroups[key] = g;
  }

  /* W54 × H92 × D58：薄铝框与无立柱的两面全景玻璃。 */
  box(shell, 54, 1.8, 58, m.shell, 0, -46, 0);
  box(shell, 1.4, 90, 58, m.shell, -27, 0, 0);
  box(shell, 54, 90, 1.6, m.shell, 0, 0, -29);
  // 顶板开窗及细密栅条，代替厚实棋盘块。
  for (const sx of [-24.75, 24.75]) box(shell, 4.5, 1.4, 58, m.trim, sx, 46, 0);
  for (const sz of [-26.25, 26.25]) box(shell, 45, 1.4, 5.5, m.trim, 0, 46, sz);
  for (let z = -22; z <= 22; z += 1.8) box(shell, 44, 0.35, 0.45, m.recess, 0, 45.95, z, false);
  // 风扇侧实体面板保留长条进气缝和细竖向灯带。
  for (const fy of [-22, 0, 22]) {
    for (let i = 0; i < 7; i++) box(shell, 25, 0.65, 0.2, m.dark, 8, fy - 6.9 + i * 2.3, -29.85, false);
  }
  box(shell, 0.5, 65, 0.2, m.red, -13, 1, -29.9, false);
  // 玻璃法向保持两面可读；透明面不重复描边。
  const glassMaterial = new THREE.MeshBasicMaterial({ color: 0xf0e6d0,
    transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false });
  const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(55.5, 88), glassMaterial);
  sideGlass.rotation.y = Math.PI / 2;
  sideGlass.position.set(27.15, 0, 0);
  sideGlass.userData.sketch = false;
  shell.add(sideGlass);
  const endGlass = new THREE.Mesh(new THREE.PlaneGeometry(52, 88), glassMaterial);
  endGlass.position.set(0, 0, 29.15);
  endGlass.userData.sketch = false;
  shell.add(endGlass);
  for (const sy of [-44.4, 44.4]) {
    box(shell, 1.25, 1.6, 58, m.trim, 27, sy, 0);
    box(shell, 54, 1.6, 1.25, m.trim, 0, sy, 29);
  }
  // 仅靠实体面保留承力柱，玻璃交会处不再放遮挡 CPU/GPU 的粗立柱。
  box(shell, 1.4, 88, 1.8, m.trim, 26.7, 0, -27.6);
  box(shell, 1.8, 88, 1.4, m.trim, -25.8, 0, 28.6);
  for (const y of [-42.5, 42.5]) {
    screw(shell, 27.8, y, -26);
    screw(shell, -24.4, y, 29.8, "z");
  }
  // 顶部前置 IO：沉槽、电源键和薄 USB 插孔。
  box(shell, 22, 0.4, 3, m.dark, -7, 46.9, -25.6);
  box(shell, 1.7, 0.22, 1.7, m.red, -15.4, 47.25, -25.6, false);
  for (const x of [-10.6, -5.7]) box(shell, 3.2, 0.2, 1.2, m.screen, x, 47.22, -25.6, false);
  box(shell, 1.6, 0.2, 0.8, m.paper, -0.8, 47.22, -25.6, false);
  // 低矮的金属滑橇脚与减震垫。
  for (const z of [-22, 22]) {
    box(shell, 46, 2.8, 5.5, m.dark, 0, -48.25, z);
    box(shell, 43, 0.6, 4.3, m.recess, 0, -49.95, z, false);
  }

  /* CPU：薄泵体、独立安装框、屏幕与真实接管；不再使用悬空厚盒。 */
  const pump = group(partGroups.cpu, "cpu-pump");
  face(pump, 13, 13, 0.7, 1, m.recess, -21.7, 17, -4);
  face(pump, 11.5, 11.5, 5, 1.4, m.dark, -18.85, 17, -4);
  face(pump, 11.8, 11.8, 0.45, 1.35, m.trim, -16.1, 17, -4);
  face(pump, 9.7, 9.7, 0.2, 1.05, m.screen, -15.75, 17, -4);
  label(pump, "CPU", "LIQUID COOLED", 8.4, 7.5, -15.61, 17, -4);
  box(pump, 0.1, 0.22, 6.1, m.red, -15.6, 12.75, -4, false);
  for (const sy of [-5.5, 5.5]) for (const sz of [-5.5, 5.5])
    screw(pump, -21.15, 17 + sy, -4 + sz);
  const hoses = group(partGroups.cpu, "coolant-hoses");
  for (const offset of [0, 2.4]) {
    box(hoses, 2.1, 1.9, 1.9, m.recess, -17.2, 15 + offset, -10.4);
    tube(hoses, [[-16.8, 15 + offset, -11], [-10, 17 + offset, -16],
      [-5, 25 + offset, -20.7], [-4 + offset, 34, -21.8], [-4 + offset, 40.1, -22]],
      0.62, m.dark, true);
  }
  // 360 风格冷排：薄框 + 两端水室 + 三把并排风扇。
  const radiator = group(partGroups.cpu, "top-radiator");
  box(radiator, 18.6, 3.2, 50, m.dark, 1.8, 41.3, 0);
  for (const z of [-24, 24]) box(radiator, 19, 3.5, 2.2, m.recess, 1.8, 41.3, z);
  for (const x of [-7.6, 11.2]) box(radiator, 0.55, 3.5, 46, m.trim, x, 41.3, 0);
  for (let z = -22; z < 23; z += 1.1) box(radiator, 16.8, 0.2, 0.25, m.recess, 1.8, 39.58, z, false);
  for (const z of [-16, 0, 16]) {
    const f = fan(7.3, 2.2);
    f.name = "radiator-fan";
    f.rotation.x = Math.PI / 2;
    f.position.set(1.8, 38.1, z);
    radiator.add(f);
  }

  /* 显卡沿用上一轮已优化的横装 RTX 5090 FE。 */
  partGroups.gpu.add(buildGpuModel());

  /* 主板：托盘 / PCB / 分区装甲 / 四条 DIMM / 插槽 / 供电。 */
  const board = group(partGroups.mb, "motherboard");
  box(board, 0.8, 61, 46, m.recess, -24.9, 5.5, 0);
  box(board, 0.9, 58, 44, m.pcb, -23.8, 6, 0);
  // 克制的电路走线，在大块散热装甲之间露出。
  for (let i = 0; i < 5; i++) {
    box(board, 0.08, 9 + i * 1.6, 0.16, m.trim, -23.3, -14, -18 + i * 1.7, false);
    box(board, 0.08, 0.16, 5.5, m.trim, -23.3, -9.5 + i * 0.8, -15.3 + i * 1.7, false);
  }
  const vrm = group(board, "vrm-heatsinks");
  face(vrm, 7, 25, 2.9, 0.8, m.dark, -21.5, 20, -16.6);
  face(vrm, 23, 5.6, 2.6, 0.7, m.trim, -21.5, 32.9, -1);
  for (let i = 0; i < 6; i++) box(vrm, 0.16, 18, 0.25, m.recess, -19.98, 20, -19 + i * 0.85, false);
  for (let i = 0; i < 10; i++) box(vrm, 0.18, 4.2, 0.3, m.dark, -20.1, 32.9, -11 + i * 2.1, false);
  // DIMM 长轴沿 y，薄边沿 z；散热马甲从主板向 +x 伸出。
  const memory = group(partGroups.ram, "memory");
  for (let i = 0; i < 4; i++) {
    const z = 7 + i * 3.25;
    const dimm = group(memory, `dimm-${i + 1}`);
    box(dimm, 1.6, 24.2, 1.9, m.recess, -22.1, 17, z);
    box(dimm, 6.4, 22, 0.7, m.pcb, -18.7, 17, z);
    box(dimm, 5.8, 21.2, 1.25, m.dark, -18.5, 17, z);
    box(dimm, 0.65, 21.6, 1.35, m.trim, -15.35, 17, z);
    box(dimm, 0.14, 20.2, 0.52, i % 2 ? m.paper : m.red, -14.96, 17, z, false);
    for (const y of [5.1, 28.9]) box(dimm, 2.6, 1.1, 2.2, m.trim, -21.5, y, z);
    for (const y of [10.6, 17, 23.4]) box(dimm, 0.2, 0.3, 1.4, m.recess, -15.75, y, z, false);
    for (const y of [9, 12, 22, 25]) {
      const groove = box(dimm, 4.6, 0.12, 0.06, m.recess, -18.4, y, z + 0.66, false);
      groove.rotation.z = -0.28;
    }
  }
  const slots = group(board, "pcie-slots");
  box(slots, 1.6, 1.4, 30, m.recess, -22.2, -7.4, 0);
  for (const y of [-15.8, -22]) {
    box(slots, 1.5, 0.9, 26, m.dark, -22.3, y, -1);
    box(slots, 0.1, 0.22, 24, m.paper, -21.51, y + 0.28, -1, false);
  }
  face(board, 18, 3.5, 1.4, 0.5, m.trim, -22.1, -2, -3);
  face(board, 14, 3.5, 1.2, 0.5, m.trim, -22.1, -19, -4);
  face(board, 10, 8, 1.5, 0.9, m.dark, -22, -13, 13.8);
  box(board, 0.1, 0.35, 6, m.red, -21.17, -13, 13.8, false);
  const connector = group(board, "atx-power-connector");
  box(connector, 2.8, 7.8, 2.6, m.dark, -21.5, 1.5, 20);
  for (let y = -1.4; y < 5; y += 1.1) box(connector, 0.15, 0.35, 1.4, m.recess, -20.02, y, 20, false);
  for (let i = 0; i < 5; i++) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 12), m.trim);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(-22.1, 26.7, -7 + i * 2.3);
    cap.userData.sketch = false;
    board.add(cap);
  }
  for (const y of [-21, 33]) for (const z of [-20, 20]) screw(board, -23.1, y, z);

  /* 侧面三进风：独立方框、弯叶与支架，不再是粗圆环堆叠。 */
  const sideFans = group(partGroups.fans, "side-fan-bank");
  for (const x of [-2, 18]) box(sideFans, 0.8, 66, 2, m.recess, x, 0, -25.8);
  for (const y of [-22, 0, 22]) {
    const f = fan(8.6, 2.4);
    f.name = "intake-fan";
    f.position.set(8, y, -25.2);
    sideFans.add(f);
  }

  /* 电源真正位于下仓：顶部透气盖、侧面展示窗、线材从边缘归槽。 */
  const shroud = group(partGroups.psu, "psu-shroud");
  box(shroud, 50, 0.8, 53, m.trim, 0, -31.8, 0);
  // 展示窗留在玻璃侧后段，其余为折弯薄板。
  box(shroud, 0.9, 12, 23, m.shell, 24.8, -38, -15);
  for (const y of [-32.8, -43.7]) box(shroud, 0.9, 1.1, 29, m.shell, 24.8, y, 11);
  box(shroud, 0.9, 10, 1.1, m.shell, 24.8, -38, 25.2);
  box(shroud, 49.5, 12, 0.8, m.shell, 0, -38, 26.5);
  for (let i = 0; i < 12; i++) box(shroud, 9, 0.1, 0.5, m.dark, 13, -31.34, -19 + i * 2, false);
  box(shroud, 3, 0.12, 6.2, m.dark, -19.5, -31.3, 21, false);
  box(shroud, 2.7, 0.12, 4, m.dark, 5.5, -31.3, 2, false);
  label(shroud, "POWER BAY", "", 13.5, 2.2, 25.28, -37.6, -15);
  const psu = group(partGroups.psu, "psu-body");
  box(psu, 30, 10.5, 26, m.dark, 6, -38, 10);
  box(psu, 0.35, 9.2, 24.5, m.recess, 21.25, -38, 10);
  label(psu, "PSU", "MODULAR POWER", 14.5, 6.5, 21.46, -38, 13, "#625640");
  for (const y of [-42.2, -33.8]) for (const z of [-1.5, 21.5]) screw(psu, 21.5, y, z);
  for (let z = -1; z <= 3; z += 1) box(psu, 0.18, 7.3, 0.25, m.dark, 21.5, -38, z, false);
  // 两束编织线采用中性深色，单根牛血色识别线；绕开显卡实体。
  const cables = group(partGroups.psu, "power-cables");
  for (let i = 0; i < 5; i++) {
    const z = 23.7 + i * 0.38;
    tube(cables, [[-19.5, -31.3, z], [-19.8, -20, z], [-19.8, -2, z], [-20, 1.5 + i * 0.65, 20.2]],
      0.16, i === 0 ? m.red : m.dark);
  }
  for (let i = 0; i < 4; i++) {
    const z = 0.2 + i * 0.58;
    tube(cables, [[-0.55, -9.7, z], [4.2, -9.7, z], [6.2, -16, z], [6.2, -25, z + 1], [5.5, -31.35, z + 1]],
      0.19, i === 0 ? m.red : m.dark);
  }
  const partAnchors: Record<PartKey, Vec3> = {
    cpu: new THREE.Vector3(-15.6, 17, -4),
    gpu: new THREE.Vector3(-0.8, -9.8, -12.8),
    mb: new THREE.Vector3(-22.5, -2, -8),
    ram: new THREE.Vector3(-14.6, 17, 12),
    fans: new THREE.Vector3(8, 0, -23.8),
    psu: new THREE.Vector3(21.5, -38, 13),
  };
  return { root, shell, partGroups, partAnchors };
}
