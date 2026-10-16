import * as THREE from "three";

/** RTX 5090 FE reference: 304 × 137 × 40 mm, scaled to 45 units long.
 * Horizontal PCIe mounting: x = board width, y = slot thickness, z = length.
 * Official gallery references are recorded in the server requirement Note.
 */
export function buildGpuModel() {
  const gpu = new THREE.Group();
  gpu.position.set(-11, -9.8, -1);
  const width = 45 * 137 / 304;
  const thickness = 45 * 40 / 304;
  const half = width / 2;
  const graphite = new THREE.MeshBasicMaterial({ color: 0x625640 });
  const metal = new THREE.MeshBasicMaterial({ color: 0xcbbb99 });
  const finMaterial = new THREE.MeshBasicMaterial({ color: 0xb3a17f });
  const dark = new THREE.MeshBasicMaterial({ color: 0x453d30 });
  const finFaces = [graphite, graphite, finMaterial, dark, graphite, graphite];

  const box = (w: number, h: number, d: number, material: any, x: number, y: number, z: number, outline = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.userData.sketch = outline;
    gpu.add(mesh);
    return mesh;
  };
  const polygon = (points: number[][]) => {
    const path = new THREE.Shape();
    points.forEach(([x, z], index) => index ? path.lineTo(x, z) : path.moveTo(x, z));
    path.closePath();
    return path;
  };
  // Chamfered perimeter and two real openings leave the FE hourglass bridge.
  const frame = polygon([
    [-half + 1.4, -22.5], [half - 1.4, -22.5], [half, -21.1],
    [half, 21.1], [half - 1.4, 22.5], [-half + 1.4, 22.5],
    [-half, 21.1], [-half, -21.1],
  ]);
  for (const sign of [-1, 1]) {
    frame.holes.push(polygon([
      [-half + 1, sign * 20.7], [half - 1, sign * 20.7],
      [half - 1, sign * 11], [1.6, sign * 1.5],
      [-1.6, sign * 1.5], [-half + 1, sign * 11],
    ]));
  }
  const plate = (depth: number, top: number, material: any) => {
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(frame, {
      depth, steps: 1, bevelEnabled: false, curveSegments: 1,
    }), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = top;
    gpu.add(mesh);
  };
  plate(thickness, thickness / 2, graphite);
  plate(0.24, thickness / 2 + 0.04, metal);

  // Recessed fins follow the two tapered flow-through windows. No solid slab
  // beneath them: the gaps remain open through to the recessed fans.
  for (const sign of [-1, 1]) {
    for (let z = 2.4; z < 20.6; z += 0.88) {
      const span = Math.min(half - 1.15, 1.6 + (z - 1.5) * (half - 2.6) / 9.5);
      box(span * 2, thickness - 0.5, 0.22, finFaces, 0, 0.02, sign * z, false);
    }
    // Both fans occupy the underside, as on the official double flow-through cooler.
    const fan = new THREE.Group();
    fan.position.set(0, -thickness / 2 + 0.12, sign * 13.3);
    fan.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.7, 7.2, 48),
      new THREE.MeshBasicMaterial({ color: 0xcbbb99, side: THREE.DoubleSide }));
    fan.add(ring);
    const bladeShape = polygon([[1.6, -0.8], [3.8, -2], [6.4, -1.4], [6.7, 0], [4, 0.8], [1.6, 0.7]]);
    const bladeGeometry = new THREE.ShapeGeometry(bladeShape);
    const bladeMaterial = new THREE.MeshBasicMaterial({ color: 0x807055, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.rotation.z = i * Math.PI * 2 / 7;
      blade.userData.sketch = false;
      fan.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24),
      new THREE.MeshBasicMaterial({ color: 0x453d30, side: THREE.DoubleSide }));
    hub.position.z = 0.02;
    fan.add(hub);
    gpu.add(fan);
  }

  // Slim edge, recessed power socket and actual lettering instead of block glyphs.
  box(0.2, 0.25, 42, metal, half + 0.02, -thickness / 2 + 0.3, 0);
  box(0.3, 2.1, 3.1, dark, half + 0.08, 0.1, 1.8);
  for (let i = 0; i < 6; i++)
    box(0.32, 0.25, 0.2, metal, half + 0.1, -0.3, 0.65 + i * 0.44, false);
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1024;
  labelCanvas.height = 128;
  const ctx = labelCanvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f0e6d0";
    ctx.font = "600 76px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GEFORCE RTX", 512, 68);
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.9), new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false,
    }));
    label.rotation.y = Math.PI / 2;
    label.position.set(half + 0.06, 0, -11.8);
    label.userData.sketch = false;
    gpu.add(label);
  }
  // Two-slot rear bracket and four display sockets; no tall end cap.
  box(width + 0.7, thickness + 0.5, 0.45, metal, 0, 0, 22.8);
  for (let i = 0; i < 4; i++)
    box(2.5, 1.2, 0.18, dark, -6.5 + i * 4.2, -0.7, 23.08);
  for (let i = 0; i < 5; i++)
    box(1.7, 0.45, 0.18, dark, -7 + i * 3.5, 1.5, 23.08, false);
  // Motherboard-side PCB tongue seats into the x16 slot.
  box(1.1, 0.3, 23, dark, -half - 0.45, thickness / 2 - 0.55, 1);
  return gpu;
}
