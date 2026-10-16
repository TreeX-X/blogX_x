import * as THREE from "three";

/** Shared construction details for the warm technical illustration. */
export function createCaseParts() {
  const material = (color: number) => new THREE.MeshBasicMaterial({ color });
  const m = {
    shell: material(0xc9b48a), trim: material(0xdcc9a2), recess: material(0xa8906a),
    dark: material(0x625640), red: material(0xb93b28),
    paper: material(0xf0e6d0), screen: material(0x39372f), pcb: material(0x786d55),
  };
  const box = (parent: any, w: number, h: number, d: number, mat: any,
    x: number, y: number, z: number, sketch = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.userData.sketch = sketch;
    parent.add(mesh);
    return mesh;
  };
  /** Chamfered rectangular face in the yz plane, extruded along x. */
  const face = (parent: any, w: number, h: number, depth: number, cut: number,
    mat: any, x: number, y: number, z: number) => {
    const shape = new THREE.Shape();
    const points = [[-w / 2 + cut, -h / 2], [w / 2 - cut, -h / 2],
      [w / 2, -h / 2 + cut], [w / 2, h / 2 - cut],
      [w / 2 - cut, h / 2], [-w / 2 + cut, h / 2],
      [-w / 2, h / 2 - cut], [-w / 2, -h / 2 + cut]];
    points.forEach(([u, v], i) => i ? shape.lineTo(u, v) : shape.moveTo(u, v));
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), mat);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x - depth / 2, y, z);
    parent.add(mesh);
    return mesh;
  };
  const screw = (parent: any, x: number, y: number, z: number, axis: "x" | "z" = "x") => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.22, 8), m.recess);
    if (axis === "x") mesh.rotation.z = Math.PI / 2;
    else mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.userData.sketch = false;
    parent.add(mesh);
  };
  const tube = (parent: any, points: number[][], radius: number, mat: any, sketch = false) => {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 36, radius, 8), mat);
    mesh.userData.sketch = sketch;
    parent.add(mesh);
    return mesh;
  };
  /** Actual typography on a +x-facing plate; never fake letters with boxes. */
  const label = (parent: any, title: string, subtitle: string, w: number, h: number,
    x: number, y: number, z: number, background?: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = Math.round(768 * h / w);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.fillStyle = "#f0e6d0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(canvas.height * (subtitle ? 0.36 : 0.62))}px monospace`;
    ctx.fillText(title, 384, canvas.height * (subtitle ? 0.4 : 0.52), 720);
    if (subtitle) {
      ctx.fillStyle = "#c9b48a";
      ctx.font = `${Math.round(canvas.height * 0.14)}px monospace`;
      ctx.fillText(subtitle, 384, canvas.height * 0.77, 720);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false,
    }));
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.userData.sketch = false;
    parent.add(mesh);
  };
  /** Square mounting frame, thin circular lip and seven swept planar blades. Axis +z. */
  const fan = (radius: number, depth: number) => {
    const group = new THREE.Group();
    const size = radius * 2.12, rail = radius * 0.1;
    for (const sign of [-1, 1]) {
      box(group, size, rail, depth, m.dark, 0, sign * (size - rail) / 2, 0);
      box(group, rail, size - 2 * rail, depth, m.dark, sign * (size - rail) / 2, 0, 0);
    }
    const lip = new THREE.Mesh(new THREE.RingGeometry(radius * 0.91, radius, 48),
      new THREE.MeshBasicMaterial({ color: 0xdcc9a2, side: THREE.DoubleSide }));
    lip.position.z = depth / 2 + 0.02;
    group.add(lip);
    const recess = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.91, 48), m.dark);
    recess.position.z = -depth / 2 + 0.06;
    recess.userData.sketch = false;
    group.add(recess);
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(radius * 0.2, -radius * 0.1);
    bladeShape.quadraticCurveTo(radius * 0.5, -radius * 0.44, radius * 0.84, -radius * 0.34);
    bladeShape.quadraticCurveTo(radius * 0.94, -radius * 0.24, radius * 0.88, -radius * 0.08);
    bladeShape.quadraticCurveTo(radius * 0.55, radius * 0.1, radius * 0.22, radius * 0.08);
    bladeShape.closePath();
    const bladeGeometry = new THREE.ShapeGeometry(bladeShape, 10);
    const bladeMaterial = new THREE.MeshBasicMaterial({ color: 0xb3a17f, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.rotation.z = i / 7 * Math.PI * 2;
      blade.position.z = 0.1;
      blade.userData.sketch = false;
      group.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, depth * 0.6, 24), m.dark);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.2;
    group.add(hub);
    // A short accent remains restrained at the mounting corners.
    for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      screw(group, sx * radius * 0.94, sy * radius * 0.94, depth / 2 + 0.12, "z");
    }
    box(group, radius * 0.55, 0.2, 0.12, m.red, 0, -size / 2 + rail / 2, depth / 2 + 0.08, false);
    return group;
  };
  return { m, box, face, screw, tube, label, fan };
}
