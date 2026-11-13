/*
 * TerraWaltz — the Apsis orbit scene.
 * The procedural NISAR spacecraft above a shadow-draped Earth at the terminator,
 * an apsidal orbit ellipse, and two wave ribbons travelling down the swath:
 * L-band (24 cm) in cyan and S-band (9.4 cm) in magenta, drawn at their true
 * wavelength ratio.
 */
import * as THREE from 'three';
import { clamp, lerp, rng, reducedMotion } from '../engine/util';
import { buildSatellite } from './SatelliteModel';

export interface ApsisHandle {
  resize(): void;
  start(): void;
  stop(): void;
  setPointer(nx: number, ny: number): void;
  /** Fly the camera down the swath toward the surface. Resolves when the dive is complete. */
  dive(onProgress?: (k: number) => void): Promise<void>;
  resetDive(): void;
  dispose(): void;
  lookAngle: number;
}

const L_COLOR = new THREE.Color(0x00f0ff), S_COLOR = new THREE.Color(0xff2a85);

export function createApsisScene(canvas: HTMLCanvasElement): ApsisHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const still = reducedMotion();
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.5, 900);
  // The sun sits low behind the planet's limb: the spacecraft is lit, the ground below is still in shadow.
  const SUN = V(-0.4, 0.2, -0.89).normalize();

  /* ---- environment for the metallic foil: one hot sun panel, a cool Earth disc, dim fills ---- */
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.04, 0.05, 0.07), side: THREE.BackSide })));
    const sunP = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.2, 6.9) }));
    sunP.position.copy(SUN).multiplyScalar(60); sunP.lookAt(0, 0, 0); env.add(sunP);
    const earthP = new THREE.Mesh(new THREE.CircleGeometry(90, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.32, 0.6) }));
    earthP.position.y = -40; earthP.rotation.x = -Math.PI / 2; env.add(earthP);
    ([[55, 14, 40, 1.3], [-30, 8, 58, 0.7], [-20, 34, -50, 0.5]] as number[][]).forEach((q) => {
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(90, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(q[3], q[3] * 1.02, q[3] * 1.08) }));
      fill.position.set(q[0], q[1], q[2]); fill.lookAt(0, 0, 0); env.add(fill);
    });
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
  }

  /* ---- spacecraft -------------------------------------------------------- */
  const model = buildSatellite(SUN);
  scene.add(model.craft);

  /* ---- radar geometry ---------------------------------------------------- */
  const O = model.refCentre.clone();
  const dIn = V().subVectors(O, model.feed).normalize();
  const dOut = dIn.clone().sub(model.refNormal.clone().multiplyScalar(2 * dIn.dot(model.refNormal))).normalize();
  const lookAngle = (Math.acos(-dOut.y) * 180) / Math.PI;
  const EARTH_C = V(26, -126, -34), EARTH_R = 120;
  const oc = V().subVectors(O, EARTH_C), bq = oc.dot(dOut), disc = bq * bq - (oc.lengthSq() - EARTH_R * EARTH_R);
  const tHit = disc > 0 ? -bq - Math.sqrt(disc) : 40;
  const HIT = O.clone().addScaledVector(dOut, tHit);

  {
    const rays: number[] = [];
    ([[0, 0], [4.6, 0], [-4.6, 0], [0, 4.6], [0, -4.6]] as number[][]).forEach((p) => {
      const w = model.surfacePoint(p[0], p[1]);
      rays.push(model.feed.x, model.feed.y, model.feed.z, w.x, w.y, w.z);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(rays, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.2 })));
  }

  /* ---- wave ribbons ------------------------------------------------------ */
  const timeUni = { value: 0 };
  const e1 = V(0, 0, 1), e2 = V().crossVectors(e1, dOut).normalize();
  function ribbon(color: THREE.Color, lambda: number, amp: number, halfW: number, across: THREE.Vector3, sway: THREE.Vector3, speed: number, opacity: number): THREE.Mesh {
    const ns = 460, nw = 6, pos: number[] = [], sw: number[] = [], idx: number[] = [];
    for (let i = 0; i <= ns; i++) for (let k = 0; k <= nw; k++) {
      const s = i / ns, w = (k / nw) * 2 - 1;
      const p = O.clone().addScaledVector(dOut, s * tHit).addScaledVector(across, w * halfW * (1 + 2.4 * s));
      pos.push(p.x, p.y, p.z); sw.push(s, w);
    }
    for (let i = 0; i < ns; i++) for (let k = 0; k < nw; k++) {
      const a = i * (nw + 1) + k, b = a + nw + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSW', new THREE.Float32BufferAttribute(sw, 2));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: timeUni, uColor: { value: color }, uSway: { value: sway }, uLen: { value: tHit }, uLambda: { value: lambda }, uAmp: { value: amp }, uSpeed: { value: speed }, uOpacity: { value: opacity } },
      vertexShader: [
        'attribute vec2 aSW; uniform float uTime, uLen, uLambda, uAmp, uSpeed; uniform vec3 uSway;',
        'varying vec2 vSW; varying float vWave;',
        'void main(){',
        '  vSW = aSW;',
        '  float ph = 6.2831853 * (aSW.x * uLen / uLambda - uTime * uSpeed);',
        '  vWave = sin(ph);',
        '  float env = smoothstep(0.0, 0.05, aSW.x) * (0.55 + 0.9 * aSW.x);',
        '  vec3 p = position + uSway * (uAmp * env * vWave);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uOpacity; varying vec2 vSW; varying float vWave;',
        'void main(){',
        '  float edge = pow(max(0.0, 1.0 - vSW.y * vSW.y), 1.6);',
        '  float fade = smoothstep(0.0, 0.04, vSW.x) * (1.0 - smoothstep(0.86, 1.0, vSW.x));',
        '  float crest = 0.42 + 0.58 * vWave * vWave;',
        '  gl_FragColor = vec4(uColor, edge * fade * crest * uOpacity);',
        '}',
      ].join('\n'),
    });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false; m.renderOrder = 3;
    return m;
  }
  const L_LAMBDA = 3.1;                                                     // scene units for 24 cm
  scene.add(ribbon(L_COLOR, L_LAMBDA, 0.8, 0.7, e1, e2, 0.34, 0.42));       // L-band: long wave
  scene.add(ribbon(S_COLOR, L_LAMBDA * (9.4 / 24), 0.4, 0.4, e2, e1, 0.62, 0.36)); // S-band: 9.4 / 24 of its length

  /* ---- Earth at the terminator ------------------------------------------- */
  const earthUni = { uSun: { value: SUN }, uHit: { value: HIT }, uTime: timeUni };
  const NOISE = [
    'float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
    'float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),',
    '             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }',
    'float fbm(vec3 p){ return 0.5 * n3(p) + 0.25 * n3(p * 2.03) + 0.125 * n3(p * 4.01) + 0.0625 * n3(p * 8.1); }',
  ].join('\n');
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 128, 80), new THREE.ShaderMaterial({
    uniforms: earthUni,
    vertexShader: [
      'varying vec3 vN; varying vec3 vW; varying vec3 vL;',
      'void main(){ vL = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uSun; uniform vec3 uHit; uniform float uTime; varying vec3 vN; varying vec3 vW; varying vec3 vL;',
      NOISE,
      'void main(){',
      '  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);',
      '  float ndl = dot(n, uSun);',
      '  float day = smoothstep(-0.06, 0.34, ndl);',
      '  float land = smoothstep(0.5, 0.58, fbm(vL * 3.2 + 4.0));',
      '  float cloud = smoothstep(0.52, 0.74, fbm(vL * 5.5 + vec3(0.0, uTime * 0.004, 9.0)));',
      '  vec3 base = mix(vec3(0.012, 0.045, 0.10), vec3(0.05, 0.062, 0.05), land);',
      '  base = mix(base, vec3(0.42, 0.47, 0.52), cloud * 0.6);',
      '  vec3 col = base * (0.10 + 1.7 * day);',
      '  col += vec3(1.0, 0.52, 0.2) * smoothstep(-0.04, 0.05, ndl) * (1.0 - smoothstep(0.05, 0.24, ndl)) * 0.07;',   // warm terminator
      '  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.2);',
      '  col += vec3(0.22, 0.6, 1.0) * fres * (0.10 + 1.3 * day);',
      '  float dh = distance(vW, uHit);',
      '  float ring = smoothstep(0.14, 0.0, abs(fract(dh * 0.16 - uTime * 0.22) - 0.5)) * exp(-dh * 0.085);',
      '  col += vec3(0.0, 0.94, 1.0) * (ring * 0.5 + 0.20 * exp(-dh * 0.14));',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  }));
  earth.position.copy(EARTH_C);
  scene.add(earth);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.012, 128, 80), new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN } }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: [
      'uniform vec3 uSun; varying vec3 vN; varying vec3 vW;',
      'void main(){',
      '  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);',
      '  float rim = pow(clamp(1.0 + dot(n, v), 0.0, 1.0), 3.6) * smoothstep(0.0, 0.35, -dot(n, v));',
      '  float lit = smoothstep(-0.25, 0.3, dot(n, uSun));',
      '  vec3 c = mix(vec3(0.10, 0.34, 0.85), vec3(0.72, 0.9, 1.0), lit) * (0.12 + 1.5 * lit);',
      '  gl_FragColor = vec4(c, rim * 0.8);',
      '}',
    ].join('\n'),
  }));
  atmo.position.copy(EARTH_C);
  scene.add(atmo);

  /* ---- apsidal orbit ellipse with degree ticks --------------------------- */
  {
    const u = V().sub(EARTH_C).normalize(), a = EARTH_C.length();
    const at = (th: number, k: number) => EARTH_C.clone().addScaledVector(u, a * Math.cos(th) * k).addScaledVector(e1, a * 1.07 * Math.sin(th) * k);
    const loop: number[] = [], ticks: number[] = [];
    for (let i = 0; i <= 720; i++) { const p = at((i / 720) * Math.PI * 2, 1); loop.push(p.x, p.y, p.z); }
    for (let d = -60; d <= 60; d++) {
      const th = (d * Math.PI) / 180 / 3, big = d % 5 === 0;
      const p0 = at(th, 1), p1 = at(th, 1 + (big ? 0.009 : 0.0035));
      ticks.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
    const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(loop, 3));
    scene.add(new THREE.Line(g1, new THREE.LineBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.26 })));
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
    scene.add(new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ color: 0xf5b041, transparent: true, opacity: 0.3 })));
  }

  /* ---- stars and lights -------------------------------------------------- */
  {
    const r = rng(99), pos: number[] = [];
    for (let i = 0; i < 620; i++) {
      const uu = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - uu * uu);
      pos.push(Math.cos(a) * s * 600, uu * 600, Math.sin(a) * s * 600);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9aa7ba, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.65 })));
  }
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.5);
  sun.position.copy(SUN).multiplyScalar(40).add(V(3, 4, 0));
  sun.target.position.set(3, 4, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -12.5; sc.right = 12.5; sc.top = 12.5; sc.bottom = -12.5; sc.near = 14; sc.far = 68;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const shine = new THREE.DirectionalLight(0x5f8fc8, 0.75);     // Earth-shine from below
  shine.position.set(-2, -20, 6); scene.add(shine);
  const fill = new THREE.DirectionalLight(0xc4d3ea, 1.15);      // soft key from the viewer's side
  fill.position.set(18, 9, 30); scene.add(fill);
  scene.add(new THREE.AmbientLight(0x222a38, 0.9));

  /* ---- camera rig -------------------------------------------------------- */
  const CENTRE = V(3.4, 4.6, 0), UP = V(0, 1, 0);
  const BASE_OFF = V(16.1, -1.6, 25.5);                                  // from the craft to the camera
  const B_FWD = BASE_OFF.clone().multiplyScalar(-1).normalize();
  const B_RIGHT = V().crossVectors(B_FWD, UP).normalize();
  const B_UP = V().crossVectors(B_RIGHT, B_FWD).normalize();
  const DIVE_P = O.clone().addScaledVector(dOut, tHit * 0.9).add(V(0, 2.2, 3.5));
  const FOV = 31, TAN = Math.tan((FOV * Math.PI) / 360);
  let cssW = 1, cssH = 1, px = 0, py = 0, pxT = 0, pyT = 0, time = 0, last = 0, raf = 0, running = false, dirty = true;
  let diveK = 0, diveT0 = 0, diving = false, diveDone: (() => void) | null = null, diveCb: ((k: number) => void) | null = null;
  const DIVE_MS = 1900;
  const pos = V(), tgt = V(), off = V(), right = V();

  function resize(): void {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    cssW = r.width; cssH = r.height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(cssW, cssH, false);
    camera.aspect = cssW / cssH;
    dirty = true;
    if (!running) render(performance.now());
  }

  function render(now: number): void {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!still) time += dt;
    const k = still ? 1 : 1 - Math.exp(-dt * 4);
    px += (pxT - px) * k; py += (pyT - py) * k;
    if (diving) {
      diveK = clamp((now - diveT0) / DIVE_MS, 0, 1);
      diveCb?.(diveK);
      if (diveK >= 1) { diving = false; const done = diveDone; diveDone = null; done?.(); }
    }
    const e = diveK * diveK * diveK;                                   // ease-in: the fall accelerates
    // Framing: back off until the craft fits, then slide it to the upper right on wide
    // stages (the title owns the lower left) or to the upper half on tall ones.
    const asp = camera.aspect, wide = clamp((asp - 1) / 0.5, 0, 1);
    const dist = BASE_OFF.length() * clamp(0.85 / asp, 1.5, 2.3);
    const visH = 2 * dist * TAN, visW = visH * asp;
    tgt.copy(CENTRE).addScaledVector(B_RIGHT, -0.2 * visW * wide).addScaledVector(B_UP, -lerp(0.2, 0.15, wide) * visH);
    off.copy(BASE_OFF).setLength(dist);
    const yaw = 0.06 * Math.sin(time * 0.19) - px * 0.08, pitch = 0.02 * Math.sin(time * 0.15 + 1) + py * 0.045;
    off.applyAxisAngle(UP, yaw * (1 - e));
    right.crossVectors(off, UP).normalize();
    off.applyAxisAngle(right, pitch * (1 - e));
    pos.copy(tgt).add(off).lerp(DIVE_P, e);
    tgt.lerp(HIT, e);
    camera.position.copy(pos);
    camera.fov = lerp(FOV, 52, e);
    camera.updateProjectionMatrix();
    camera.lookAt(tgt);
    timeUni.value = time;
    earth.rotation.x = -time * 0.006;
    renderer.render(scene, camera);
  }
  function loop(now: number): void {
    raf = 0;
    if (!running) return;
    const moving = !still || dirty || diving || Math.abs(pxT - px) > 0.0005 || Math.abs(pyT - py) > 0.0005;
    if (moving) { dirty = false; render(now); }
    raf = requestAnimationFrame(loop);
  }

  return {
    lookAngle,
    resize,
    start() { if (running) return; running = true; last = performance.now(); dirty = true; raf = requestAnimationFrame(loop); },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    setPointer(nx, ny) { pxT = clamp(nx, -1, 1); pyT = clamp(ny, -1, 1); },
    dive(onProgress) {
      if (still) { onProgress?.(1); return Promise.resolve(); }
      return new Promise<void>((resolve) => {
        diveCb = onProgress || null; diveDone = resolve; diveT0 = performance.now(); diving = true;
        if (!running) { running = true; last = diveT0; raf = requestAnimationFrame(loop); }
      });
    },
    resetDive() { diveK = 0; diving = false; diveDone = null; diveCb = null; dirty = true; },
    dispose() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; renderer.dispose(); },
  };
}
