/*
 * TerraWaltz — procedural NISAR spacecraft model (Three.js).
 *
 * Everything is generated in code: geometry, the crinkled MLI foil normal map,
 * the solar-cell and wire-mesh textures. No model or image files are loaded.
 *
 * Layout (metres, +Y is zenith, Earth is toward -Y):
 *   I3K bus at the origin · radar instrument structure on top · feed aperture
 *   looking up at a 12 m drum reflector held off the bus by a 9 m truss boom ·
 *   two solar wings along ±Z. Proportions follow the published 12 m / 9 m
 *   dimensions; the rest is an illustration, not an engineering model.
 */
import * as THREE from 'three';
import { fbmField } from '../engine/util';

type Strut = [THREE.Vector3, THREE.Vector3, number];
const GOLD = 0xe2ad45, CARBON = 0x14171c;

export interface SatelliteModel {
  craft: THREE.Group;
  /** named points in craft space (bus, ris, solar, feed, boom, gps, reflector) */
  anchors: Record<string, THREE.Vector3>;
  /** centre of the reflecting surface, feed position and the reflector's facing normal */
  refCentre: THREE.Vector3;
  feed: THREE.Vector3;
  refNormal: THREE.Vector3;
  /** a point on the reflecting surface at local (x, z) */
  surfacePoint(x: number, z: number): THREE.Vector3;
}

/** @param SUN unit vector toward the sun; the solar wings tilt to face it */
export function buildSatellite(SUN: THREE.Vector3): SatelliteModel {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  /* ---- procedural textures ----------------------------------------------- */
  function foilTextures(size: number) {
    // crinkled multi-layer insulation: ridged noise -> tangent-space normals + roughness
    const a = fbmField(size, size, 771, 5, { oct: 3, ridged: true, tile: true, aspect: 1 });
    const b = fbmField(size, size, 772, 17, { oct: 3, ridged: true, tile: true, aspect: 1 });
    const hgt = new Float32Array(size * size);
    for (let i = 0; i < hgt.length; i++) hgt[i] = a[i] * 0.8 + b[i] * 0.2;
    const nd = new Uint8Array(size * size * 4), rd = new Uint8Array(size * size * 4);
    const at = (x: number, y: number) => hgt[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * 7, dy = (at(x, y + 1) - at(x, y - 1)) * 7;
        const l = 1 / Math.sqrt(dx * dx + dy * dy + 1), j = (y * size + x) * 4;
        nd[j] = (-dx * l * 0.5 + 0.5) * 255; nd[j + 1] = (-dy * l * 0.5 + 0.5) * 255; nd[j + 2] = (l * 0.5 + 0.5) * 255; nd[j + 3] = 255;
        const r = 0.17 + 0.3 * hgt[y * size + x];
        rd[j] = 255; rd[j + 1] = r * 255; rd[j + 2] = 255; rd[j + 3] = 255;
      }
    }
    const mk = (d: Uint8Array) => {
      const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
      return t;
    };
    return { normal: mk(nd), rough: mk(rd) };
  }
  function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb?: boolean): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d')!, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const foil = foilTextures(256);
  const cellMap = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#0a1634'; g.fillRect(0, 0, w, h);
    const nx = 8, ny = 12, cw = w / nx, chh = h / ny;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      g.fillStyle = (x + y) % 2 ? '#0c1b40' : '#0b193b';
      g.fillRect(x * cw + 1.5, y * chh + 1.5, cw - 3, chh - 3);
      g.fillStyle = 'rgba(96,130,200,0.20)';
      g.fillRect(x * cw + cw * 0.33, y * chh + 2, 1, chh - 4); g.fillRect(x * cw + cw * 0.66, y * chh + 2, 1, chh - 4);
    }
  }, true);
  const cellRough = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(255,36,255)'; g.fillRect(0, 0, w, h);            // interconnect lines: smooth
    const nx = 8, ny = 12, cw = w / nx, chh = h / ny;
    g.fillStyle = 'rgb(255,92,255)';                                     // cells: slightly rougher
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) g.fillRect(x * cw + 1.5, y * chh + 1.5, cw - 3, chh - 3);
  });
  const meshAlpha = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = 'rgb(34,34,34)'; g.fillRect(0, 0, w, h);               // open area: mostly transparent
    g.strokeStyle = 'rgb(255,255,255)'; g.lineWidth = 3.2;
    g.beginPath();
    for (let k = -1; k <= 2; k++) { g.moveTo(k * 32, 0); g.lineTo(k * 32 + 64, 64); g.moveTo(k * 32 + 64, 0); g.lineTo(k * 32, 64); }
    g.stroke();
  });
  const meshShadow = canvasTex(16, 16, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);  // ≈ a third of the light blocked
  });
  meshShadow.magFilter = THREE.NearestFilter; meshShadow.minFilter = THREE.NearestFilter;
  const feedMap = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#d9d5c8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,44,52,0.55)'; g.lineWidth = 2;
    for (let x = 0; x <= 12; x++) { g.beginPath(); g.moveTo((x * w) / 12, 0); g.lineTo((x * w) / 12, h); g.stroke(); }
    for (let y = 0; y <= 2; y++) { g.beginPath(); g.moveTo(0, (y * h) / 2); g.lineTo(w, (y * h) / 2); g.stroke(); }
    g.fillStyle = 'rgba(40,44,52,0.35)';
    for (let x = 0; x < 12; x++) for (let y = 0; y < 2; y++) g.fillRect((x * w) / 12 + 7, (y * h) / 2 + 20, w / 12 - 14, h / 2 - 40);
  }, true);

  /* ---- materials --------------------------------------------------------- */
  const mFoil = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 1, roughnessMap: foil.rough, normalMap: foil.normal, normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 1.55 });
  const mFoilDark = mFoil.clone(); mFoilDark.color = new THREE.Color(0xb07c26);
  const mSilver = new THREE.MeshStandardMaterial({ color: 0xd5dae0, metalness: 0.35, roughness: 0.42 });
  const mCarbon = new THREE.MeshStandardMaterial({ color: CARBON, metalness: 0.55, roughness: 0.42 });
  const mJoint = new THREE.MeshStandardMaterial({ color: 0x8c939c, metalness: 0.9, roughness: 0.35 });
  const mCell = new THREE.MeshStandardMaterial({ map: cellMap, roughnessMap: cellRough, metalness: 0.35, roughness: 1, envMapIntensity: 0.9 });
  const mPanelBack = new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.3, roughness: 0.7 });
  const mFeed = new THREE.MeshStandardMaterial({ map: feedMap, metalness: 0.1, roughness: 0.62 });
  const mMesh = new THREE.MeshStandardMaterial({ color: 0xf0c869, metalness: 1, roughness: 0.3, alphaMap: meshAlpha, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 });
  const line = (color: number, opacity: number) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });

  /* ---- instanced struts -------------------------------------------------- */
  function strut(list: Strut[], a: THREE.Vector3, b: THREE.Vector3, r: number): void { list.push([a.clone(), b.clone(), r]); }
  function instanced(list: Strut[], material: THREE.Material, part: string): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, false), material, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0), d = V(), mid = V(), s = V();
    list.forEach((it, i) => {
      d.subVectors(it[1], it[0]);
      const len = d.length();
      mid.addVectors(it[0], it[1]).multiplyScalar(0.5);
      q.setFromUnitVectors(up, d.normalize());
      s.set(it[2], len, it[2]);
      mesh.setMatrixAt(i, m.compose(mid, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.part = part;
    return mesh;
  }
  function truss(list: Strut[], a: THREE.Vector3, b: THREE.Vector3, w: number, bay: number, r: number): void {
    const dir = V().subVectors(b, a), len = dir.length();
    dir.normalize();
    const n1 = V().crossVectors(dir, V(0, 0, 1)).normalize(), n2 = V().crossVectors(dir, n1).normalize();
    const n = Math.max(2, Math.round(len / bay));
    let prev: THREE.Vector3[] | null = null;
    for (let i = 0; i <= n; i++) {
      const c = V().copy(a).addScaledVector(dir, (len * i) / n);
      const nodes = [0, 1, 2].map((k) => {
        const ang = (k / 3) * Math.PI * 2 + Math.PI / 2;
        return V().copy(c).addScaledVector(n1, Math.cos(ang) * w).addScaledVector(n2, Math.sin(ang) * w);
      });
      for (let k = 0; k < 3; k++) strut(list, nodes[k], nodes[(k + 1) % 3], r * 0.7);
      if (prev) for (let k = 0; k < 3; k++) { strut(list, prev[k], nodes[k], r); strut(list, prev[k], nodes[(k + 1) % 3], r * 0.6); }
      prev = nodes;
    }
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], part: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true; m.receiveShadow = true; m.userData.part = part;
    return m;
  };

  /* ---- spacecraft -------------------------------------------------------- */
  const craft = new THREE.Group();
  const anchors: Record<string, THREE.Vector3> = {};

  // I3K bus
  const bus = box(1.9, 2.2, 1.9, mFoil, 'bus');
  craft.add(bus);
  const deck = box(2.0, 0.06, 2.0, mCarbon, 'bus'); deck.position.y = -1.13; craft.add(deck);
  [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach((p) => {       // thrusters
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.2, 12), mJoint);
    t.position.set(p[0], -1.26, p[1]); t.castShadow = true; t.userData.part = 'bus'; craft.add(t);
  });
  const tracker = box(0.3, 0.3, 0.42, mSilver, 'bus'); tracker.position.set(-1.05, 0.55, 0.45); craft.add(tracker);
  const tracker2 = box(0.3, 0.3, 0.42, mSilver, 'bus'); tracker2.position.set(-1.05, 0.55, -0.45); craft.add(tracker2);
  const hga = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 8, 0, Math.PI * 2, 0, 0.75), mSilver);   // downlink dish
  hga.position.set(-0.55, -1.52, 0.5); hga.rotation.x = Math.PI; hga.castShadow = true; hga.userData.part = 'bus'; hga.material.side = THREE.DoubleSide;
  craft.add(hga);
  anchors.bus = V(0.3, -0.45, 0.96);

  // radar instrument structure: L- and S-band electronics housing
  const ris = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.45, 8), mFoilDark);
  (function (uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) { for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 4); })(ris.geometry.attributes.uv as THREE.BufferAttribute);   // keep the foil scale even around the drum
  ris.position.y = 1.1 + 0.725; ris.rotation.y = Math.PI / 8; ris.castShadow = true; ris.receiveShadow = true; ris.userData.part = 'ris';
  craft.add(ris);
  for (let k = 0; k < 8; k += 2) {                                             // radiator panels
    const a = (k / 8) * Math.PI * 2;
    const rad = box(0.05, 1.05, 0.78, mSilver, 'ris');
    rad.position.set(Math.cos(a) * 1.13, 1.82, Math.sin(a) * 1.13); rad.rotation.y = -a;
    craft.add(rad);
  }
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.26, 1.26, 0.07, 8), mCarbon);
  lid.position.y = 2.58; lid.rotation.y = Math.PI / 8; lid.castShadow = true; lid.receiveShadow = true; lid.userData.part = 'ris'; craft.add(lid);
  anchors.ris = V(-0.2, 1.8, 1.13);

  // solar arrays
  [1, -1].forEach((side) => {
    const wing = new THREE.Group();
    wing.position.set(0, 0.25, side * 0.95);
    const sl: Strut[] = [];
    strut(sl, V(0, 0, 0), V(0, 0, side * 1.0), 0.03);
    strut(sl, V(0, 0, side * 0.2), V(0.9, 0, side * 1.0), 0.02); strut(sl, V(0, 0, side * 0.2), V(-0.9, 0, side * 1.0), 0.02);
    wing.add(instanced(sl, mJoint, 'solar'));
    const tilt = new THREE.Group(); tilt.rotation.z = -Math.atan2(SUN.x, SUN.y) * 0.9; wing.add(tilt);
    for (let p = 0; p < 2; p++) {
      const z = side * (1.0 + 1.34 + p * 2.76);
      const front = box(2.5, 0.035, 2.66, [mPanelBack, mPanelBack, mCell, mPanelBack, mPanelBack, mPanelBack], 'solar');
      front.position.set(0, 0, z); tilt.add(front);
      const frame = box(2.56, 0.02, 0.05, mJoint, 'solar'); frame.position.set(0, -0.03, z - side * 1.36); tilt.add(frame);
    }
    craft.add(wing);
  });
  anchors.solar = V(0.2, 0.9, 4.2);

  // feed RF aperture (L-band array + S-band strip), aimed at the reflector centre
  const REF_POS = V(4.7, 8.9, 0), REF_TILT = (4 * Math.PI) / 180, R = 6, DRUM = 1.5;
  const yF = (r: number) => 0.02 + 0.95 * (1 - (r / R) * (r / R));
  const yR = (r: number) => DRUM - 0.55 * (1 - (r / R) * (r / R));
  const reflector = new THREE.Group();
  reflector.position.copy(REF_POS); reflector.rotation.z = REF_TILT;
  craft.add(reflector);
  reflector.updateMatrixWorld(true);
  const refCentre = reflector.localToWorld(V(0, yF(0), 0));
  const FEED = V(1.0, 2.95, 0);
  const feed = new THREE.Group();
  feed.position.copy(FEED); feed.lookAt(refCentre);
  const lArr = box(2.3, 1.15, 0.09, [mSilver, mSilver, mSilver, mSilver, mFeed, mSilver], 'feed'); feed.add(lArr);
  const sArr = box(2.3, 0.34, 0.09, mSilver, 'feed'); sArr.position.set(0, -0.8, 0); feed.add(sArr);
  const fl: Strut[] = [];
  strut(fl, V(-1.0, -0.5, -0.05), V(-0.7, -0.9, -0.75), 0.03); strut(fl, V(1.0, -0.5, -0.05), V(0.7, -0.9, -0.75), 0.03);
  strut(fl, V(-1.0, 0.45, -0.05), V(-0.7, -0.9, -0.75), 0.022); strut(fl, V(1.0, 0.45, -0.05), V(0.7, -0.9, -0.75), 0.022);
  feed.add(instanced(fl, mJoint, 'feed'));
  craft.add(feed);
  anchors.feed = FEED.clone();

  // 9 m boom: two truss segments with hinges, GPS antenna at the tip
  const B0 = V(-0.55, 2.62, 0), B1 = V(-4.2, 6.1, 0);
  const B2 = reflector.localToWorld(V(-R - 0.12, DRUM * 0.5, 0));
  const bl: Strut[] = [];
  truss(bl, B0, B1, 0.17, 0.5, 0.026);
  truss(bl, B1, B2, 0.17, 0.5, 0.026);
  craft.add(instanced(bl, mCarbon, 'boom'));
  [B0, B1, B2].forEach((p) => {
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16), mJoint);
    j.position.copy(p); j.rotation.x = Math.PI / 2; j.castShadow = true; j.userData.part = 'boom'; craft.add(j);
  });
  anchors.boom = V().lerpVectors(B0, B1, 0.55);
  const gps = new THREE.Group();
  gps.position.copy(B2).add(V(-0.1, 0.42, 0));
  const gBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16), mJoint); gps.add(gBase);
  const gCone = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.085, 0.3, 12), mSilver); gCone.position.y = 0.17; gps.add(gCone);
  gps.children.forEach((c) => { c.castShadow = true; c.userData.part = 'gps'; });
  craft.add(gps);
  anchors.gps = gps.position.clone().add(V(0, 0.3, 0));

  // 12 m drum reflector: perimeter truss, front and rear nets, tension ties, mesh surface
  (function () {
    const N = 30, rl: Strut[] = [];
    const fr: THREE.Vector3[] = [], rr: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      fr.push(V(Math.cos(a) * R, 0, Math.sin(a) * R)); rr.push(V(Math.cos(a) * R, DRUM, Math.sin(a) * R));
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      strut(rl, fr[i], fr[j], 0.034); strut(rl, rr[i], rr[j], 0.034); strut(rl, fr[i], rr[i], 0.034);
      strut(rl, i % 2 ? fr[i] : rr[i], i % 2 ? rr[j] : fr[j], 0.02);
    }
    reflector.add(instanced(rl, mCarbon, 'reflector'));

    // geodesic nets on a triangular lattice
    const sp = 0.86, nodes = new Map<string, [number, number]>();
    for (let j = -9; j <= 9; j++) for (let i = -16; i <= 16; i++) {
      const x = (i + j * 0.5) * sp, z = j * sp * 0.866;
      if (Math.hypot(x, z) < R - 0.1) nodes.set(i + ',' + j, [x, z]);
    }
    const front: number[] = [], rear: number[] = [], ties: number[] = [];
    nodes.forEach((p, key) => {
      const [i, j] = key.split(',').map(Number), r0 = Math.hypot(p[0], p[1]);
      [[i + 1, j], [i, j + 1], [i - 1, j + 1]].forEach((q) => {
        const n = nodes.get(q[0] + ',' + q[1]);
        if (!n) return;
        const r1 = Math.hypot(n[0], n[1]);
        front.push(p[0], yF(r0) - 0.012, p[1], n[0], yF(r1) - 0.012, n[1]);
        rear.push(p[0], yR(r0), p[1], n[0], yR(r1), n[1]);
      });
      ties.push(p[0], yF(r0), p[1], p[0], yR(r0), p[1]);
    });
    for (let i = 0; i < N; i++) {                                           // edge webs and radial cables
      let best: [number, number] = [0, 0], bd = 1e9;
      nodes.forEach((p) => { const d = Math.hypot(p[0] - fr[i].x, p[1] - fr[i].z); if (d < bd) { bd = d; best = p; } });
      const rb = Math.hypot(best[0], best[1]);
      front.push(fr[i].x, 0, fr[i].z, best[0], yF(rb) - 0.012, best[1]);
      rear.push(rr[i].x, DRUM, rr[i].z, best[0], yR(rb), best[1]);
      if (i % 2 === 0) rear.push(rr[i].x, DRUM, rr[i].z, 0, yR(0), 0);
    }
    const seg = (arr: number[], mat: THREE.Material) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.LineSegments(g, mat);
    };
    reflector.add(seg(front, line(0xf6d886, 0.62)));
    reflector.add(seg(rear, line(0xcaa24e, 0.26)));
    reflector.add(seg(ties, line(0xcaa24e, 0.1)));

    // reflective mesh surface (paraboloid inside the drum)
    const nr = 14, ns = 72, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= nr; i++) for (let k = 0; k <= ns; k++) {
      const r = (R * i) / nr, a = (k / ns) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, yF(r), z); uv.push((x / R) * 34, (z / R) * 34);
    }
    for (let i = 0; i < nr; i++) for (let k = 0; k < ns; k++) {
      const a = i * (ns + 1) + k, b = a + ns + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const surf = new THREE.Mesh(g, mMesh);
    surf.castShadow = true; surf.receiveShadow = false; surf.renderOrder = 2; surf.userData.part = 'reflector';
    const shadowTex = meshShadow.clone(); shadowTex.needsUpdate = true; shadowTex.repeat.set(2.6, 2.6);
    surf.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: shadowTex, alphaTest: 0.5, side: THREE.DoubleSide });
    reflector.add(surf);
  })();
  anchors.reflector = reflector.localToWorld(V(2.4, yF(4.2), 3.4));

  return {
    craft, anchors, refCentre, feed: FEED,
    refNormal: V(0, -1, 0).applyAxisAngle(V(0, 0, 1), REF_TILT),
    surfacePoint: (x: number, z: number) => reflector.localToWorld(V(x, yF(Math.hypot(x, z)), z)),
  };
}
