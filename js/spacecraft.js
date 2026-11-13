/*
 * TerraWaltz — procedural NISAR spacecraft (Three.js).
 *
 * Everything is generated in code: geometry, the crinkled MLI foil normal map,
 * the solar-cell and wire-mesh textures, the environment map, the radar beam
 * and the Caspian terrain it scans. No model or image files are loaded.
 *
 * Layout (metres, +Y is zenith, Earth is toward -Y):
 *   I3K bus at the origin · radar instrument structure on top · feed aperture
 *   looking up at a 12 m drum reflector held off the bus by a 9 m truss boom ·
 *   two solar wings along ±Z · beam reflected 37° off nadir toward +X.
 */
(function () {
  'use strict';
  const TW = (window.TW = window.TW || {});
  const U = TW.util;

  const GOLD = 0xe2ad45, CARBON = 0x14171c, SIGNAL = 0x00f0ff;

  function Spacecraft(canvas, hooks) {
    const THREE = window.THREE;
    hooks = hooks || {};
    if (!THREE) return { ok: false };
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { return { ok: false }; }
    if (!renderer.getContext()) return { ok: false };

    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const still = U.reducedMotion();
    renderer.setClearColor(0x05070a, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
    const SUN = V(0.62, 0.74, 0.26).normalize();          // direction toward the sun

    /* ---- environment: one hot sun panel, a cool Earth disc, nothing else ---- */
    (function () {
      const env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.04, 0.05, 0.07), side: THREE.BackSide })));
      const sun = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.2, 6.9) }));
      sun.position.copy(SUN).multiplyScalar(60); sun.lookAt(0, 0, 0); env.add(sun);
      const earth = new THREE.Mesh(new THREE.CircleGeometry(90, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.36, 0.6) }));
      earth.position.y = -40; earth.rotation.x = -Math.PI / 2; env.add(earth);
      [[-55, 12, 34, 1.5], [18, 6, 62, 0.8], [-20, 30, -50, 0.5]].forEach((q) => {      // broad, dim fill panels
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(90, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(q[3], q[3] * 1.02, q[3] * 1.08) }));
        fill.position.set(q[0], q[1], q[2]); fill.lookAt(0, 0, 0); env.add(fill);
      });
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(env, 0.02).texture;
      pm.dispose();
    })();

    /* ---- procedural textures ----------------------------------------------- */
    function foilTextures(size) {
      // crinkled multi-layer insulation: ridged noise -> tangent-space normals + roughness
      const a = U.fbmField(size, size, 771, 5, { oct: 3, ridged: true, tile: true, aspect: 1 });
      const b = U.fbmField(size, size, 772, 17, { oct: 3, ridged: true, tile: true, aspect: 1 });
      const hgt = new Float32Array(size * size);
      for (let i = 0; i < hgt.length; i++) hgt[i] = a[i] * 0.8 + b[i] * 0.2;
      const nd = new Uint8Array(size * size * 4), rd = new Uint8Array(size * size * 4);
      const at = (x, y) => hgt[((y + size) % size) * size + ((x + size) % size)];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = (at(x + 1, y) - at(x - 1, y)) * 7, dy = (at(x, y + 1) - at(x, y - 1)) * 7;
          const l = 1 / Math.sqrt(dx * dx + dy * dy + 1), j = (y * size + x) * 4;
          nd[j] = (-dx * l * 0.5 + 0.5) * 255; nd[j + 1] = (-dy * l * 0.5 + 0.5) * 255; nd[j + 2] = (l * 0.5 + 0.5) * 255; nd[j + 3] = 255;
          const r = 0.17 + 0.3 * hgt[y * size + x];
          rd[j] = 255; rd[j + 1] = r * 255; rd[j + 2] = 255; rd[j + 3] = 255;
        }
      }
      const mk = (d) => {
        const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
        return t;
      };
      return { normal: mk(nd), rough: mk(rd) };
    }
    function canvasTex(w, h, draw, srgb) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
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
    const line = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });

    /* ---- instanced struts -------------------------------------------------- */
    function strut(list, a, b, r) { list.push([a.clone(), b.clone(), r]); }
    function instanced(list, material, part) {
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
    function truss(list, a, b, w, bay, r) {
      const dir = V().subVectors(b, a), len = dir.length();
      dir.normalize();
      const n1 = V().crossVectors(dir, V(0, 0, 1)).normalize(), n2 = V().crossVectors(dir, n1).normalize();
      const n = Math.max(2, Math.round(len / bay));
      let prev = null;
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
    const box = (w, h, d, mat, part) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.castShadow = true; m.receiveShadow = true; m.userData.part = part;
      return m;
    };

    /* ---- spacecraft -------------------------------------------------------- */
    const craft = new THREE.Group();
    scene.add(craft);
    const anchors = {};

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
    (function (uv) { for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 4); })(ris.geometry.attributes.uv);   // keep the foil scale even around the drum
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
      const sl = [];
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
    const yF = (r) => 0.02 + 0.95 * (1 - (r / R) * (r / R));
    const yR = (r) => DRUM - 0.55 * (1 - (r / R) * (r / R));
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
    const fl = [];
    strut(fl, V(-1.0, -0.5, -0.05), V(-0.7, -0.9, -0.75), 0.03); strut(fl, V(1.0, -0.5, -0.05), V(0.7, -0.9, -0.75), 0.03);
    strut(fl, V(-1.0, 0.45, -0.05), V(-0.7, -0.9, -0.75), 0.022); strut(fl, V(1.0, 0.45, -0.05), V(0.7, -0.9, -0.75), 0.022);
    feed.add(instanced(fl, mJoint, 'feed'));
    craft.add(feed);
    anchors.feed = FEED.clone();

    // 9 m boom: two truss segments with hinges, GPS antenna at the tip
    const B0 = V(-0.55, 2.62, 0), B1 = V(-4.2, 6.1, 0);
    const B2 = reflector.localToWorld(V(-R - 0.12, DRUM * 0.5, 0));
    const bl = [];
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
      const N = 30, rl = [];
      const fr = [], rr = [];
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
      const sp = 0.86, nodes = new Map();
      for (let j = -9; j <= 9; j++) for (let i = -16; i <= 16; i++) {
        const x = (i + j * 0.5) * sp, z = j * sp * 0.866;
        if (Math.hypot(x, z) < R - 0.1) nodes.set(i + ',' + j, [x, z]);
      }
      const front = [], rear = [], ties = [];
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
        let best = null, bd = 1e9;
        nodes.forEach((p) => { const d = Math.hypot(p[0] - fr[i].x, p[1] - fr[i].z); if (d < bd) { bd = d; best = p; } });
        const rb = Math.hypot(best[0], best[1]);
        front.push(fr[i].x, 0, fr[i].z, best[0], yF(rb) - 0.012, best[1]);
        rear.push(rr[i].x, DRUM, rr[i].z, best[0], yR(rb), best[1]);
        if (i % 2 === 0) rear.push(rr[i].x, DRUM, rr[i].z, 0, yR(0), 0);
      }
      const seg = (arr, mat) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        return new THREE.LineSegments(g, mat);
      };
      reflector.add(seg(front, line(0xf6d886, 0.62)));
      reflector.add(seg(rear, line(0xcaa24e, 0.26)));
      reflector.add(seg(ties, line(0xcaa24e, 0.1)));

      // reflective mesh surface (paraboloid inside the drum)
      const nr = 14, ns = 72, pos = [], uv = [], idx = [];
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

    /* ---- radar geometry: feed rays, reflected beam, footprint -------------- */
    const GROUND_Y = -15;
    const nRef = V(0, -1, 0).applyAxisAngle(V(0, 0, 1), REF_TILT);
    const dIn = V().subVectors(refCentre, FEED).normalize();
    const dOut = dIn.clone().sub(nRef.clone().multiplyScalar(2 * dIn.dot(nRef))).normalize();
    const hit = refCentre.clone().addScaledVector(dOut, (refCentre.y - GROUND_Y) / -dOut.y);
    const lookAngle = (Math.acos(-dOut.y) * 180) / Math.PI;
    const FOOT_X = 9.5, FOOT_Z = 1.6;
    (function () {
      const rays = [];
      [[0, 0], [4.6, 0], [-4.6, 0], [0, 4.6], [0, -4.6]].forEach((p) => {
        const w = reflector.localToWorld(V(p[0], yF(Math.hypot(p[0], p[1])), p[1]));
        rays.push(FEED.x, FEED.y, FEED.z, w.x, w.y, w.z);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(rays, 3));
      scene.add(new THREE.LineSegments(g, line(SIGNAL, 0.22)));
    })();
    const beamUni = { uTime: { value: 0 }, uGain: { value: 1 } };
    (function () {
      const e1 = V(0, 0, 1), e2 = V().crossVectors(e1, dOut).normalize();
      const ns = 64, pos = [], uv = [], idx = [];
      for (let k = 0; k <= ns; k++) {
        const a = (k / ns) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const t = refCentre.clone().addScaledVector(e2, c * 3.4).addScaledVector(e1, s * 1.0);
        pos.push(t.x, t.y, t.z, hit.x + c * FOOT_X, GROUND_Y + 0.05, hit.z + s * FOOT_Z);
        uv.push(k / ns, 0, k / ns, 1);
      }
      for (let k = 0; k < ns; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        uniforms: beamUni, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'varying vec2 vUv; uniform float uTime; uniform float uGain;',
          'void main(){',
          '  float f = fract(vUv.y * 26.0 - uTime * 0.55);',                 // wavefronts travelling down
          '  float front = smoothstep(0.0, 0.035, f) * (1.0 - smoothstep(0.035, 0.11, f));',
          '  float edge = pow(abs(cos(vUv.x * 6.2831853)), 6.0);',           // the two limbs of the fan
          '  float fade = mix(1.0, 0.45, vUv.y) * smoothstep(0.0, 0.05, vUv.y);',
          '  float a = (0.014 + 0.09 * front + 0.045 * edge) * fade * uGain;',
          '  gl_FragColor = vec4(0.0, 0.94, 1.0, a);',
          '}',
        ].join('\n'),
      });
      const m = new THREE.Mesh(g, mat); m.renderOrder = 3; m.frustumCulled = false;
      scene.add(m);
    })();

    /* ---- terrain: the Caspian shore as a contour drawing, scanned by the beam */
    const T_W = 62, T_D = 38.75, terrain = { ready: false, geo: {} };
    const terrUni = { uSar: { value: null }, uScan: { value: 0.7 }, uFoot: { value: new THREE.Vector2(0.5, FOOT_X / T_W) }, uReveal: { value: 0 } };
    function buildTerrain() {
      if (!TW.scenes) return;
      const sc = TW.scenes.getScene('caspian'), SW = TW.scenes.W, SH = TW.scenes.H, hg = sc.height;
      const sx = 168, sz = 105;
      const g = new THREE.PlaneGeometry(T_W, T_D, sx, sz);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, uvs = g.attributes.uv, hs = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) {
        const u = uvs.getX(i), v = uvs.getY(i);
        const px = Math.min(SW - 1, Math.round(u * (SW - 1))), py = Math.min(SH - 1, Math.round((1 - v) * (SH - 1)));
        const hm = hg[py * SW + px];
        hs[i] = hm;
        p.setY(i, Math.sign(hm) * Math.log(1 + Math.abs(hm) / 4) * 0.8);
      }
      g.setAttribute('aH', new THREE.BufferAttribute(hs, 1));
      // SAR image of the same scene, revealed behind the scan line
      const S = TW.scenes.makeState();
      sc.compute(2026.67, S, false, 1);
      const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
      const cx = cv.getContext('2d'), im = cx.createImageData(SW, SH);
      TW.render.sar(sc, S, 'HH', 'L', im.data, new Float32Array(SW * SH));
      cx.putImageData(im, 0, 0);
      const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
      terrUni.uSar.value = tex;
      const mat = new THREE.ShaderMaterial({
        uniforms: terrUni, transparent: true, depthWrite: false, extensions: { derivatives: true },
        vertexShader: 'attribute float aH; varying vec2 vUv; varying float vH; void main(){ vUv = uv; vH = aH; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'varying vec2 vUv; varying float vH;',
          'uniform sampler2D uSar; uniform float uScan; uniform vec2 uFoot; uniform float uReveal;',
          'float ln(float x){ float f = abs(fract(x - 0.5) - 0.5) / max(fwidth(x), 1e-5); return 1.0 - min(f, 1.0); }',
          'void main(){',
          '  float sea = step(vH, -0.04);',
          '  vec3 col = mix(vec3(0.036, 0.043, 0.055), vec3(0.016, 0.024, 0.036), sea);',
          '  float grid = max(ln(vUv.x * 32.0), ln(vUv.y * 20.0));',
          '  col += grid * 0.045;',
          '  float iso = mix(ln(vH / 10.0), ln(vH / 2.5), sea);',              // land contours 10 m, bathymetry 2.5 m
          '  col += iso * mix(vec3(0.11, 0.12, 0.14), vec3(0.03, 0.17, 0.22), sea);',
          '  float coast = 1.0 - min(abs(vH + 0.04) / max(fwidth(vH), 1e-5) / 1.4, 1.0);',
          '  col = mix(col, vec3(0.86, 0.9, 0.94), coast * 0.8);',
          '  float inSw = 1.0 - smoothstep(uFoot.y - 0.004, uFoot.y, abs(vUv.x - uFoot.x));',
          '  float behind = step(uScan, vUv.y);',                              // the scan moves north to south (v decreasing)
          '  float trail = behind * (1.0 - smoothstep(0.0, 0.62, vUv.y - uScan));',
          '  vec3 sar = texture2D(uSar, vUv).rgb;',
          '  col = mix(col, sar * vec3(0.9, 0.97, 1.0) + coast * 0.25, inSw * trail * 0.94 * uReveal);',
          '  float scan = (1.0 - min(abs(vUv.y - uScan) / max(fwidth(vUv.y), 1e-5) / 1.5, 1.0)) * inSw;',
          '  float limb = 1.0 - min(abs(abs(vUv.x - uFoot.x) - uFoot.y) / max(fwidth(vUv.x), 1e-5) / 1.2, 1.0);',
          '  col += vec3(0.0, 0.94, 1.0) * (scan * 0.9 + limb * 0.28) * uReveal;',
          '  vec2 e = smoothstep(vec2(0.0), vec2(0.07), vUv) * smoothstep(vec2(0.0), vec2(0.07), 1.0 - vUv);',
          '  gl_FragColor = vec4(col, e.x * e.y);',
          '}',
        ].join('\n'),
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(hit.x, GROUND_Y, 0); mesh.renderOrder = 1;
      scene.add(mesh);
      // places on the ground, in world coordinates
      const place = (a) => {
        const px = Math.round(a[0] * (SW - 1)), py = Math.round(a[1] * (SH - 1)), hm = hg[py * SW + px];
        return V(hit.x - T_W / 2 + a[0] * T_W, GROUND_Y + Math.sign(hm) * Math.log(1 + Math.abs(hm) / 4) * 0.8, -T_D / 2 + a[1] * T_D);
      };
      anchors.aktau = place(sc.anchors.city); anchors.karakol = place(sc.anchors.karakol);
      anchors.sea = V(hit.x - T_W * 0.36, GROUND_Y, T_D * 0.1);
      terrain.ready = true;
      dirty = true;
    }

    /* ---- stars and lights -------------------------------------------------- */
    (function () {
      const r = U.rng(99), pos = [];
      for (let i = 0; i < 520; i++) {
        const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        pos.push(Math.cos(a) * s * 300, u * 300, Math.sin(a) * s * 300);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8591a3, size: 1.25, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
    })();
    const sun = new THREE.DirectionalLight(0xfff0dc, 3.3);
    sun.position.copy(SUN).multiplyScalar(40).add(V(3, 4, 0));
    sun.target.position.set(3, 4, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -11.5; sc.right = 11.5; sc.top = 11.5; sc.bottom = -11.5; sc.near = 18; sc.far = 62;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.025;
    scene.add(sun, sun.target);
    const albedo = new THREE.DirectionalLight(0x5f8fc8, 0.55);                  // Earth-shine from below
    albedo.position.set(-2, -20, 6); scene.add(albedo);
    scene.add(new THREE.AmbientLight(0x222a38, 0.8));

    /* ---- camera choreography ----------------------------------------------- */
    const ST = [
      { pos: V(-14.4, 7.2, 23.0), tgt: V(3.5, 4.3, 0), fov: 30 },    // whole spacecraft
      { pos: V(13.6, 1.6, 10.8), tgt: V(4.5, 8.2, 0.4), fov: 34 },   // under the reflector
      { pos: V(7.4, 5.4, 9.6), tgt: V(0.5, 1.7, 0), fov: 30 },       // feed and bus
      { pos: V(-24, 3, 50), tgt: V(12.5, -5.2, 0), fov: 33 },        // beam and swath
    ];
    const path = new THREE.CatmullRomCurve3(ST.map((s) => s.pos), false, 'centripetal');
    let cssW = 1, cssH = 1, prog = 0, progT = 0, px = 0, py = 0, pxT = 0, pyT = 0, dragYaw = 0, dragPitch = 0;
    let time = 0, last = 0, raf = 0, running = false, dirty = true;
    const pos = V(), tgt = V(), off = V(), right = V(), UP = V(0, 1, 0), tmp = V();

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      cssW = r.width; cssH = r.height;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(cssW, cssH, false);
      camera.aspect = cssW / cssH;
      dirty = true;
      if (!running) render(performance.now());
    }

    function render(now) {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!still) time += dt;
      const k = still ? 1 : 1 - Math.exp(-dt * 4.2);
      prog += (progT - prog) * k;
      px += (pxT - px) * k; py += (pyT - py) * k;
      const seg = Math.min(2, Math.floor(prog)), f = U.sat(prog - seg), e = f * f * (3 - 2 * f);
      path.getPoint((seg + e) / 3, pos);
      tgt.lerpVectors(ST[seg].tgt, ST[seg + 1].tgt, e);
      camera.fov = U.lerp(ST[seg].fov, ST[seg + 1].fov, e);
      off.subVectors(pos, tgt).multiplyScalar(U.clamp(1.0 / camera.aspect, 1, 2.3));   // back off on narrow stages
      const yaw = 0.085 * Math.sin(time * 0.21) + dragYaw - px * 0.11;
      const pitch = 0.028 * Math.sin(time * 0.16 + 1) + dragPitch + py * 0.06;
      off.applyAxisAngle(UP, yaw);
      right.crossVectors(off, UP).normalize();
      off.applyAxisAngle(right, pitch);
      camera.position.copy(tgt).add(off);
      camera.updateProjectionMatrix();
      camera.lookAt(tgt);
      beamUni.uTime.value = time;
      beamUni.uGain.value = U.lerp(0.75, 1.5, U.smooth(1.9, 3, prog));
      terrUni.uScan.value = still ? 0.34 : 1.06 - ((time * 0.085) % 1) * 1.3;
      terrUni.uReveal.value = terrain.ready ? 1 : 0;
      renderer.render(scene, camera);
      if (hooks.onFrame) hooks.onFrame(prog);
    }
    function loop(now) {
      raf = 0;
      if (!running) return;
      const moving = !still || dirty || Math.abs(progT - prog) > 0.0005 || Math.abs(pxT - px) > 0.0005 || Math.abs(pyT - py) > 0.0005;
      if (moving) { dirty = false; render(now); }
      raf = requestAnimationFrame(loop);
    }

    const ray = new THREE.Raycaster();
    const pickables = [];
    craft.traverse((o) => { if (o.userData && o.userData.part && (o.isMesh || o.isInstancedMesh)) pickables.push(o); });

    setTimeout(buildTerrain, 80);

    return {
      ok: true,
      lookAngle,
      resize,
      start() { if (running) return; running = true; last = performance.now(); dirty = true; raf = requestAnimationFrame(loop); },
      stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
      setProgress(p) { progT = U.clamp(p, 0, 3); },
      setPointer(nx, ny) { pxT = U.clamp(nx, -1, 1); pyT = U.clamp(ny, -1, 1); },
      drag(dx, dy) { dragYaw = U.clamp(dragYaw - dx * 0.006, -1.1, 1.1); dragPitch = U.clamp(dragPitch + dy * 0.004, -0.35, 0.35); dirty = true; },
      settle() { dragYaw *= 0.9; dragPitch *= 0.9; dirty = true; },
      /** Screen position (CSS px) of a named anchor; null until it exists. */
      project(id) {
        const a = anchors[id];
        if (!a) return null;
        tmp.copy(a).project(camera);
        return { x: (tmp.x * 0.5 + 0.5) * cssW, y: (-tmp.y * 0.5 + 0.5) * cssH, front: tmp.z < 1 };
      },
      /** Subsystem under a pointer position given in normalised device coordinates. */
      pick(nx, ny) {
        ray.setFromCamera({ x: nx, y: ny }, camera);
        const hits = ray.intersectObjects(pickables, false);
        return hits.length ? hits[0].object.userData.part : null;
      },
      size: () => ({ w: cssW, h: cssH }),
    };
  }

  TW.Spacecraft = Spacecraft;
})();
