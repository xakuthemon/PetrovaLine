/*
 * Petrova Line landing stage: one WebGL scene that the scroll film moves through.
 *
 * A NASA Blue Marble globe graded to the page's night palette, with a gold limb
 * ring, a few dozen hairline orbits with satellites, NISAR on its 747 km
 * sun-synchronous orbit, the procedural spacecraft for close-ups, the L- and
 * S-band waves at their true 24 : 9.4 ratio, a 12-day coverage build-up and a
 * terrain slab that lifts simulated radar scenes off the globe.
 */
import * as THREE from 'three';
import { buildSatellite } from './SatelliteModel';
import { clamp, lerp, rng } from '../engine/util';
import { SLIDES, coverCount, scanAt, type FilmPos } from '../landing/film';
import type { SceneId } from '../engine/scenes';
import type { SlabResult } from '../landing/slabData';
import dayUrl from '../assets/earth/day.jpg';
import nightUrl from '../assets/earth/night.jpg';

export interface Intro { ring: number; globe: number; orbits: number; sats: number; push: number; trail: number }
export interface Anchor { x: number; y: number; on: number }
export interface LandingHandle {
  /** intro build values, animated by the page (0 → 1) */
  intro: Intro;
  setFilm(f: FilmPos): void;
  setPointer(nx: number, ny: number): void;
  addSlab(r: SlabResult): void;
  resize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
  /** screen position of NISAR in CSS pixels, every frame */
  onAnchor: ((a: Anchor) => void) | null;
}

// brand: cream (#F4ECE3), crimson (#D3243F), steel (#7E9BD0)
const CREAM = new THREE.Color('#F4ECE3'), CRIMSON = new THREE.Color('#D3243F'), STEEL = new THREE.Color('#7E9BD0');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));
const sstep = (a: number, b: number, x: number) => ease(clamp((x - a) / (b - a), 0, 1));

const NOISE = [
  'float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
  'float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),',
  '             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }',
  'float fbm(vec3 p){ return 0.5 * n3(p) + 0.25 * n3(p * 2.03) + 0.125 * n3(p * 4.01) + 0.0625 * n3(p * 8.1); }',
].join('\n');

/** unit vector for a latitude / longitude on THREE.SphereGeometry with an equirectangular map */
export function latLon(lat: number, lon: number, r = 1): THREE.Vector3 {
  const phi = ((lon + 180) / 360) * Math.PI * 2, th = ((90 - lat) / 180) * Math.PI;
  return V(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th)).multiplyScalar(r);
}

/** rotation that brings local point p to world direction d with local north kept toward world up */
function faceTo(p: THREE.Vector3, d: THREE.Vector3): THREE.Quaternion {
  const up = V(0, 1, 0);
  const e = V().crossVectors(up, p).normalize(), n = V().crossVectors(p, e).normalize();
  const dd = d.clone().normalize();
  let u = up.clone().addScaledVector(dd, -up.dot(dd));
  if (u.lengthSq() < 1e-6) u = V(0, 0, -1);
  u.normalize();
  const r = V().crossVectors(u, dd).normalize();
  const ml = new THREE.Matrix4().makeBasis(e, n, p.clone().normalize());
  const mw = new THREE.Matrix4().makeBasis(r, u, dd);
  return new THREE.Quaternion().setFromRotationMatrix(mw.multiply(ml.transpose()));
}

interface Pose {
  focus: THREE.Vector3; dir: THREE.Vector3; up: THREE.Vector3; dist: number; nx: number; ny: number; fov: number;
  q: THREE.Quaternion;
  orbits: number; sats: number; nisar: number; craft: number; ribbons: number; hit: number;
  coverOn: number; cover: number; nu: number; place: number;
}

export function createLandingScene(canvas: HTMLCanvasElement, reduced: boolean): LandingHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.004, 400);
  const SUN = V(-0.78, 0.48, 0.4).normalize();
  const intro: Intro = reduced ? { ring: 1, globe: 1, orbits: 1, sats: 1, push: 1, trail: 1 } : { ring: 0, globe: 0, orbits: 0, sats: 0, push: 0, trail: 0 };
  const time = { value: 0 };

  /* ---- environment for the spacecraft's metal foil ------------------------ */
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.035, 0.045, 0.065), side: THREE.BackSide })));
    const sunP = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.2, 6.9) }));
    sunP.position.copy(SUN).multiplyScalar(60); sunP.lookAt(0, 0, 0); env.add(sunP);
    const earthP = new THREE.Mesh(new THREE.CircleGeometry(90, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.2, 0.32) }));
    earthP.position.y = -40; earthP.rotation.x = -Math.PI / 2; env.add(earthP);
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(90, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.05, 0.95) }));
    fill.position.set(40, 20, 50); fill.lookAt(0, 0, 0); env.add(fill);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
  }

  /* ---- globe -------------------------------------------------------------- */
  const loader = new THREE.TextureLoader();
  let dirty = true;
  const day = loader.load(dayUrl, () => { dirty = true; });
  const night = loader.load(nightUrl, () => { dirty = true; });
  [day, night].forEach((t) => { t.anisotropy = 8; });
  const globe = new THREE.Group();
  scene.add(globe);
  const placeLocal = { value: V(0, 1, 0) };
  const earthU = {
    uDay: { value: day }, uNight: { value: night }, uSun: { value: SUN }, uTime: time,
    uGlobe: { value: 0 }, uCover: { value: 0 }, uCoverOn: { value: 0 },
    uPlace: placeLocal, uPlaceOn: { value: 0 }, uHit: { value: V(0, 0, 0) }, uHitOn: { value: 0 },
  };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), new THREE.ShaderMaterial({
    uniforms: earthU, transparent: true, premultipliedAlpha: true,
    vertexShader: [
      'varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vL;',
      'void main(){ vUv = uv; vL = normalize(position); vN = normalize(mat3(modelMatrix) * normal);',
      '  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D uDay, uNight; uniform vec3 uSun, uPlace, uHit; uniform float uTime, uGlobe, uCover, uCoverOn, uPlaceOn, uHitOn;',
      'varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vL;',
      NOISE,
      'void main(){',
      '  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);',
      '  float ndl = dot(n, uSun);',
      '  float day = smoothstep(-0.10, 0.42, ndl);',
      '  vec3 tex = texture2D(uDay, vUv).rgb;',
      '  float lum = dot(tex, vec3(0.299, 0.587, 0.114));',
      '  float ocean = smoothstep(0.015, 0.07, tex.b - max(tex.r, tex.g));',
      '  vec3 grade = mix(vec3(lum), tex, 0.3) * vec3(0.9, 0.95, 1.04);',
      '  grade *= 0.85 + 0.3 * fbm(vL * 60.0);',                                 // fine grain hides texel blur up close
      '  float cl = smoothstep(0.56, 0.82, fbm(vL * 4.2 + vec3(0.0, uTime * 0.004, 3.0))) * 0.8 * smoothstep(1.2, 1.9, length(cameraPosition));',
      '  vec3 col = grade * (0.025 + 0.78 * day);',
      '  col = mix(col, vec3(0.70, 0.72, 0.76) * (0.02 + 0.5 * day), cl * 0.45);',
      '  vec3 hv = normalize(uSun + v);',
      '  col += vec3(0.98, 0.95, 0.9) * pow(max(dot(n, hv), 0.0), 60.0) * ocean * day * 0.35;',
      '  float lights = texture2D(uNight, vUv).r;',
      '  col += vec3(1.0, 0.86, 0.68) * pow(lights, 1.7) * (1.0 - smoothstep(-0.18, 0.08, ndl)) * (1.0 - cl) * 0.95;',
      '  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);',
      '  col += vec3(0.80, 0.82, 0.90) * fres * (0.04 + 0.22 * day);',
      // 12-day coverage: 173 tracks, each orbit shifted 12 stripes from the last
      '  float lat = asin(clamp(vL.y, -1.0, 1.0));',
      '  float L = mod(degrees(atan(vL.z, -vL.x)) + 180.0 + degrees(lat) * 0.22, 360.0);',
      '  float sw = 360.0 / 173.0, s = floor(L / sw), within = fract(L / sw);',
      '  float k = mod(s * 101.0, 173.0);',
      '  float polar = 1.0 - smoothstep(1.50, 1.53, abs(lat));',
      '  float rev = step(k + 0.5, uCover) * polar * uCoverOn;',
      '  float lead = smoothstep(uCover - 7.0, uCover - 0.5, k) * rev;',
      '  float landm = 1.0 - ocean;',
      '  col = mix(col, col * 0.55 + vec3(0.96, 0.93, 0.89) * (0.05 + 0.2 * landm) * (0.35 + 0.65 * day), rev * 0.75);',
      '  col += vec3(0.96, 0.93, 0.89) * smoothstep(0.08, 0.0, min(within, 1.0 - within)) * 0.10 * rev + vec3(0.83, 0.14, 0.25) * lead * 0.7;',
      // place marker: a fixed ring and a slow pulse
      '  float dp = distance(vL, uPlace);',
      '  float ring = smoothstep(0.0035, 0.0, abs(dp - 0.035)) + 0.6 * smoothstep(0.004, 0.0, abs(dp - 0.012));',
      '  float pr = fract(uTime * 0.35) * 0.16;',
      '  float pulse = smoothstep(0.006, 0.0, abs(dp - pr)) * (1.0 - pr / 0.16);',
      '  col += vec3(0.95, 0.2, 0.32) * (ring + pulse * 0.8) * uPlaceOn;',
      // radar footprint under NISAR
      '  float dh = distance(vW, uHit);',
      '  float fr = smoothstep(0.08, 0.0, abs(fract(dh * 60.0 - uTime * 0.6) - 0.5)) * exp(-dh * 30.0);',
      '  col += vec3(0.95, 0.2, 0.32) * (fr * 0.4 + 0.3 * exp(-dh * 55.0)) * uHitOn;',
      '  gl_FragColor = vec4(col * uGlobe, uGlobe);',
      '}',
    ].join('\n'),
  }));
  earth.renderOrder = -1;            // first, so lines behind the planet are hidden by its depth
  globe.add(earth);

  /* ---- limb ring: a billboard drawn exactly on the silhouette -------------- */
  const ringU = { uDraw: { value: 0 }, uPx: { value: 300 }, uOn: { value: 1 } };
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: ringU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform float uDraw, uPx, uOn; varying vec2 vUv;',
      'void main(){',
      '  vec2 p = (vUv - 0.5) * 2.6; float r = length(p);',
      '  float a = fract(0.25 - atan(p.y, p.x) / 6.2831853);',            // 0 at 12 o'clock, clockwise
      '  float drawn = smoothstep(uDraw, uDraw - 0.02, a);',
      '  float head = smoothstep(0.05, 0.0, abs(a - uDraw)) * step(uDraw, 0.999) * step(0.001, uDraw);',
      '  float w = 1.3 / uPx;',
      '  float core = exp(-pow((r - 1.0) / w, 2.0));',
      '  float glow = exp(-max(r - 1.0, 0.0) * 22.0) * step(1.0, r) * 0.22 + exp(-pow((r - 1.0) / (w * 6.0), 2.0)) * 0.25;',
      '  vec2 d = normalize(p + 1e-5);',
      '  float side = 0.28 + 0.72 * pow(max(dot(d, normalize(vec2(0.62, 0.78))), 0.0), 1.4);',
      '  float i = (core * 1.6 + glow * 1.3) * side * drawn + head * (core * 2.5 + glow);',
      '  gl_FragColor = vec4(vec3(0.96, 0.93, 0.89) * i * uOn, 1.0);',
      '}',
    ].join('\n'),
  }));
  ring.renderOrder = 5;
  scene.add(ring);

  /* ---- hairline orbits and satellites -------------------------------------- */
  interface Orb { a: number; e: number; m: THREE.Matrix4; th0: number; rate: number; ice: boolean }
  const orbs: Orb[] = [];
  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);
  const orbitU = { uDraw: { value: 0 }, uAlpha: { value: 1 }, uColor: { value: CREAM } };
  {
    const r = rng(2026), NORB = 58, SEG = 220;
    const pos: number[] = [], au: number[] = [], seed: number[] = [];
    for (let o = 0; o < NORB; o++) {
      const a = 1.16 + Math.pow(r(), 1.5) * 1.05;
      let e = r() < 0.22 ? 0.18 + r() * 0.4 : r() * 0.05;
      e = Math.min(e, 1 - 1.1 / a);
      const m = new THREE.Matrix4().makeRotationY(r() * Math.PI * 2)
        .multiply(new THREE.Matrix4().makeRotationX((r() - 0.5) * Math.PI))
        .multiply(new THREE.Matrix4().makeRotationY(r() * Math.PI * 2));
      const orb: Orb = { a, e, m, th0: r() * Math.PI * 2, rate: (0.16 + r() * 0.1) / Math.pow(a, 1.5), ice: r() < 0.16 };
      orbs.push(orb);
      const sd = r();
      const pt = (th: number) => V(a * (Math.cos(th) - e), 0, a * Math.sqrt(1 - e * e) * Math.sin(th)).applyMatrix4(m);
      for (let s = 0; s < SEG; s++) {
        const t0 = (s / SEG) * Math.PI * 2, t1 = ((s + 1) / SEG) * Math.PI * 2;
        const p0 = pt(t0), p1 = pt(t1);
        pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        au.push(s / SEG, (s + 1) / SEG); seed.push(sd, sd);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    const lines = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: orbitU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: [
        'attribute float aU, aSeed; varying float vU, vSeed, vFace;',
        'void main(){ vU = aU; vSeed = aSeed; vec4 w = modelMatrix * vec4(position, 1.0);',
        '  vFace = dot(normalize(w.xyz), normalize(cameraPosition));',
        '  gl_Position = projectionMatrix * viewMatrix * w; }',
      ].join('\n'),
      fragmentShader: [
        'uniform float uDraw, uAlpha; uniform vec3 uColor; varying float vU, vSeed, vFace;',
        'void main(){',
        '  float lp = clamp(uDraw * 1.7 - vSeed * 0.7, 0.0, 1.0);',
        '  if (vU > lp) discard;',
        '  float head = smoothstep(lp - 0.05, lp, vU) * (1.0 - step(0.999, lp));',
        '  float a = (0.13 + 0.10 * vSeed) * (0.45 + 0.55 * smoothstep(-0.6, 0.8, vFace)) + head * 0.7;',
        '  gl_FragColor = vec4(uColor * a * uAlpha, 1.0);',
        '}',
      ].join('\n'),
    }));
    lines.frustumCulled = false;
    orbitGroup.add(lines);
  }
  // satellites with short dotted trails
  const TRAIL = 6, NSAT = orbs.length * TRAIL;
  const satPos = new Float32Array(NSAT * 3), satA = new Float32Array(NSAT), satC = new Float32Array(NSAT * 3), satS = new Float32Array(NSAT);
  orbs.forEach((o, i) => {
    for (let j = 0; j < TRAIL; j++) {
      const k = i * TRAIL + j, c = o.ice ? STEEL : CREAM;
      satA[k] = j === 0 ? 1 : 0.55 * (1 - j / TRAIL);
      satS[k] = j === 0 ? 3.4 : 1.7;
      satC[k * 3] = c.r; satC[k * 3 + 1] = c.g; satC[k * 3 + 2] = c.b;
    }
  });
  const satGeo = new THREE.BufferGeometry();
  satGeo.setAttribute('position', new THREE.BufferAttribute(satPos, 3));
  satGeo.setAttribute('aA', new THREE.BufferAttribute(satA, 1));
  satGeo.setAttribute('aC', new THREE.BufferAttribute(satC, 3));
  satGeo.setAttribute('aS', new THREE.BufferAttribute(satS, 1));
  const satU = { uAlpha: { value: 0 }, uDpr: { value: 1 } };
  const pointsVS = [
    'attribute float aA, aS; attribute vec3 aC; uniform float uDpr; varying float vA; varying vec3 vC;',
    'void main(){ vA = aA; vC = aC; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * uDpr; gl_Position = projectionMatrix * mv; }',
  ].join('\n');
  const pointsFS = [
    'uniform float uAlpha; varying float vA; varying vec3 vC;',
    'void main(){ float d = length(gl_PointCoord - 0.5); float m = smoothstep(0.5, 0.2, d); gl_FragColor = vec4(vC * m * vA * uAlpha, 1.0); }',
  ].join('\n');
  const sats = new THREE.Points(satGeo, new THREE.ShaderMaterial({ uniforms: satU, vertexShader: pointsVS, fragmentShader: pointsFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sats.frustumCulled = false;
  orbitGroup.add(sats);

  // distant dust: barely visible, gives the camera moves a sense of depth
  {
    const r = rng(7), n = 360, p = new Float32Array(n * 3), a = new Float32Array(n), c = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, t = r() * Math.PI * 2, q = Math.sqrt(1 - u * u), d = 22 + r() * 60;
      p.set([Math.cos(t) * q * d, u * d, Math.sin(t) * q * d], i * 3);
      a[i] = 0.12 + r() * 0.3; s[i] = 1.2 + r() * 0.8; c.set([0.75, 0.78, 0.84], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aA', new THREE.BufferAttribute(a, 1));
    g.setAttribute('aC', new THREE.BufferAttribute(c, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    const dust = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uAlpha: { value: 1 }, uDpr: satU.uDpr }, vertexShader: pointsVS, fragmentShader: pointsFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(dust);
  }

  /* ---- NISAR: 747 km, 98.4° sun-synchronous orbit -------------------------- */
  const RN = 1 + 747 / 6371, INC = (98.4 * Math.PI) / 180, RAAN = 2.25;
  const nisarM = new THREE.Matrix4().makeRotationY(RAAN).multiply(new THREE.Matrix4().makeRotationX(INC));
  const nisarAt = (nu: number, out: THREE.Vector3) => out.set(Math.cos(nu) * RN, 0, Math.sin(nu) * RN).applyMatrix4(nisarM);
  const nisarVel = (nu: number, out: THREE.Vector3) => out.set(-Math.sin(nu), 0, Math.cos(nu)).applyMatrix4(nisarM).normalize();
  const nisarU = { uAlpha: { value: 0 }, uDraw: { value: 0 } };
  {
    const pos: number[] = [], au: number[] = [], SEG = 360;
    const p = V(), q = V();
    for (let s = 0; s < SEG; s++) {
      nisarAt((s / SEG) * Math.PI * 2, p); nisarAt(((s + 1) / SEG) * Math.PI * 2, q);
      pos.push(p.x, p.y, p.z, q.x, q.y, q.z); au.push(s / SEG, (s + 1) / SEG);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1));
    const l = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: nisarU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aU; varying float vU; void main(){ vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uAlpha, uDraw; varying float vU; void main(){ if (vU > uDraw) discard; gl_FragColor = vec4(vec3(0.83, 0.14, 0.25) * 0.85 * uAlpha, 1.0); }',
    }));
    l.frustumCulled = false;
    scene.add(l);
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  dotGeo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array([1]), 1));
  dotGeo.setAttribute('aC', new THREE.BufferAttribute(new Float32Array([0.96, 0.93, 0.89]), 3));
  dotGeo.setAttribute('aS', new THREE.BufferAttribute(new Float32Array([11]), 1));
  const dotU = { uAlpha: { value: 0 }, uDpr: satU.uDpr };
  const nisarDot = new THREE.Points(dotGeo, new THREE.ShaderMaterial({ uniforms: dotU, vertexShader: pointsVS, fragmentShader: pointsFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  nisarDot.frustumCulled = false; nisarDot.renderOrder = 6;
  scene.add(nisarDot);

  /* ---- the Petrova line: a crimson trail behind NISAR, widest at the spacecraft ---- */
  const TR_N = 200, TR_ARC = 2.5;
  const trPos = new Float32Array(TR_N * 6), trS = new Float32Array(TR_N * 2), trIdx: number[] = [];
  for (let i = 0; i < TR_N; i++) {
    trS[i * 2] = trS[i * 2 + 1] = i / (TR_N - 1);
    if (i < TR_N - 1) { const q = i * 2; trIdx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
  trGeo.setAttribute('aS', new THREE.BufferAttribute(trS, 1));
  trGeo.setIndex(trIdx);
  const trailU = { uDraw: { value: 0 }, uAlpha: { value: 0 } };
  const trail = new THREE.Mesh(trGeo, new THREE.ShaderMaterial({
    uniforms: trailU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uDraw, uAlpha; varying float vS; void main(){ if (vS > uDraw) discard; float a = (1.0 - smoothstep(0.7, 1.0, vS)) * uAlpha; gl_FragColor = vec4(0.827, 0.141, 0.247, a); }',
  }));
  trail.frustumCulled = false; trail.renderOrder = 5;
  scene.add(trail);
  const tp = V(), tv = V(), tc = V(), ts = V();

  /* ---- the spacecraft ------------------------------------------------------ */
  const CRAFT_S = 0.0045;
  const model = buildSatellite(SUN);
  model.craft.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  const craft = new THREE.Group();
  const craftInner = new THREE.Group();
  craftInner.add(model.craft);
  craft.add(craftInner);
  scene.add(craft);
  const CRAFT_C = V(2.2, 4.4, 0);                                     // visual centre in model metres
  const O = model.refCentre.clone();
  const dIn = V().subVectors(O, model.feed).normalize();
  const dOut = dIn.clone().sub(model.refNormal.clone().multiplyScalar(2 * dIn.dot(model.refNormal))).normalize();
  const craftBasis = new THREE.Matrix4();
  const placeCraft = (nu: number) => {
    const p = nisarAt(nu, V()), up = p.clone().normalize(), vel = nisarVel(nu, V());
    const side = V().crossVectors(up, vel).normalize();
    craftBasis.makeBasis(side, up, vel);
    craft.position.copy(p);
    craft.quaternion.setFromRotationMatrix(craftBasis);
  };
  // beam length to the ground, in model metres (constant on a circular orbit)
  placeCraft(0);
  craft.scale.setScalar(CRAFT_S);
  craft.updateMatrixWorld(true);
  const oW = craft.localToWorld(O.clone()), dW = dOut.clone().applyQuaternion(craft.quaternion);
  const bq = oW.dot(dW), disc = bq * bq - (oW.lengthSq() - 1);
  const LM = (disc > 0 ? -bq - Math.sqrt(disc) : 0.15) / CRAFT_S;
  const ribbonU = { uGrow: { value: 0 }, uOpacity: { value: 0 } };
  function ribbon(color: THREE.Color, lambda: number, amp: number, speed: number): THREE.Mesh {
    const ns = 600, nw = 2, pos: number[] = [], sw: number[] = [], idx: number[] = [];
    const e1 = V(0, 0, 1), e2 = V().crossVectors(e1, dOut).normalize(), halfW = 0.09;
    for (let i = 0; i <= ns; i++) for (let k = 0; k <= nw; k++) {
      const s = i / ns, w = (k / nw) * 2 - 1;
      const p = O.clone().addScaledVector(dOut, s * LM).addScaledVector(e2, w * halfW * (1 + s));
      pos.push(p.x, p.y, p.z); sw.push(s, w);
    }
    for (let i = 0; i < ns; i++) for (let k = 0; k < nw; k++) { const a = i * (nw + 1) + k, b = a + nw + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSW', new THREE.Float32BufferAttribute(sw, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: time, uColor: { value: color }, uSway: { value: e2 }, uLen: { value: LM }, uLambda: { value: lambda }, uAmp: { value: amp }, uSpeed: { value: speed }, uGrow: ribbonU.uGrow, uOpacity: ribbonU.uOpacity },
      vertexShader: [
        'attribute vec2 aSW; uniform float uTime, uLen, uLambda, uAmp, uSpeed; uniform vec3 uSway; varying vec2 vSW;',
        'void main(){ vSW = aSW;',
        '  float ph = 6.2831853 * (aSW.x * uLen / uLambda - uTime * uSpeed);',
        '  float env = smoothstep(0.0, 0.06, aSW.x) * (0.6 + 0.8 * aSW.x);',
        '  vec3 p = position + uSway * (uAmp * env * sin(ph));',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uGrow, uOpacity; varying vec2 vSW;',
        'void main(){ if (vSW.x > uGrow) discard;',
        '  float edge = 1.0 - vSW.y * vSW.y;',
        '  float head = smoothstep(uGrow - 0.06, uGrow, vSW.x);',
        '  float fade = smoothstep(0.0, 0.04, vSW.x) * (1.0 - smoothstep(0.9, 1.0, vSW.x));',
        '  gl_FragColor = vec4(uColor * edge * fade * (0.75 + head * 1.2) * uOpacity, 1.0); }',
      ].join('\n'),
    }));
    m.frustumCulled = false; m.renderOrder = 4;
    return m;
  }
  const LAMBDA_L = LM / 9;
  craftInner.add(ribbon(CRIMSON, LAMBDA_L, 1.15, 0.5));
  craftInner.add(ribbon(STEEL, LAMBDA_L * (9.4 / 24), 0.62, 0.9));
  const keyLight = new THREE.DirectionalLight(0xfff1dc, 3.0);
  keyLight.position.copy(SUN).multiplyScalar(10);
  const rim = new THREE.DirectionalLight(0x9cc0e0, 0.9); rim.position.set(6, -3, -8);
  scene.add(keyLight, rim, new THREE.AmbientLight(0x2a3240, 0.8));

  /* ---- terrain slab -------------------------------------------------------- */
  const slab = new THREE.Group();
  scene.add(slab);
  const blank = new THREE.DataTexture(new Uint8Array([12, 18, 26, 255]), 1, 1, THREE.RGBAFormat); blank.needsUpdate = true;
  const slabU = { uA: { value: blank as THREE.Texture }, uB: { value: blank as THREE.Texture }, uRelief: { value: blank as THREE.Texture }, uScan: { value: 0 }, uAmp: { value: 0.07 }, uOpacity: { value: 0 }, uLight: { value: V(-0.4, 0.8, 0.45).normalize() }, uTime: time };
  const slabMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 240, 150), new THREE.ShaderMaterial({
    uniforms: slabU, transparent: true, side: THREE.DoubleSide,
    vertexShader: [
      'uniform sampler2D uRelief; uniform float uAmp; varying vec2 vUv; varying vec3 vNl; varying float vH;',
      'float hAt(vec2 uv){ return texture2D(uRelief, vec2(uv.x, 1.0 - uv.y)).r; }',
      'void main(){ vUv = uv; float h = hAt(uv); vH = h;',
      '  vec2 e = vec2(1.0 / 180.0, 1.0 / 112.0);',
      '  float hx = (hAt(uv + vec2(e.x, 0.0)) - hAt(uv - vec2(e.x, 0.0))) * uAmp / (2.0 * e.x * 1.6);',
      '  float hy = (hAt(uv + vec2(0.0, e.y)) - hAt(uv - vec2(0.0, e.y))) * uAmp / (2.0 * e.y * 1.0);',
      '  vNl = normalize(normalMatrix * normalize(vec3(-hx, -hy, 1.0)));',
      '  vec3 p = position + vec3(0.0, 0.0, h * uAmp);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D uA, uB; uniform float uScan, uOpacity, uTime; uniform vec3 uLight; varying vec2 vUv; varying vec3 vNl; varying float vH;',
      'void main(){',
      '  vec2 t = vec2(vUv.x, 1.0 - vUv.y);',
      '  vec3 a = texture2D(uA, t).rgb, b = texture2D(uB, t).rgb;',
      '  float m = smoothstep(uScan - 0.002, uScan + 0.002, vUv.x);',
      '  vec3 col = mix(b, a * 0.82, m);',
      '  float l = 0.62 + 0.55 * max(dot(normalize(vNl), normalize(uLight)), 0.0);',
      '  col *= l;',
      '  float line = exp(-abs(vUv.x - uScan) * 260.0) * step(0.001, uScan) * step(uScan, 0.999);',
      '  col = mix(col, vec3(0.83, 0.14, 0.25), clamp(line * 1.6, 0.0, 1.0));',
      '  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));',
      '  col *= 0.75 + 0.25 * smoothstep(0.0, 0.05, edge);',
      '  gl_FragColor = vec4(col, uOpacity);',
      '}',
    ].join('\n'),
  }));
  slabMesh.renderOrder = 2;
  slab.add(slabMesh);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.06), new THREE.MeshBasicMaterial({ color: 0x010204, transparent: true, toneMapped: false }));
  base.position.z = -0.032;
  slab.add(base);
  const baseEdges = new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry), new THREE.LineBasicMaterial({ color: CREAM, transparent: true, opacity: 0.5 }));
  baseEdges.position.copy(base.position);
  slab.add(baseEdges);
  slab.visible = false;
  const slabTex = new Map<SceneId, { a: THREE.DataTexture; b: THREE.DataTexture; r: THREE.DataTexture }>();
  let slabShown: SceneId | null = null;
  const mkTex = (d: Uint8ClampedArray | Uint8Array, w: number, h: number, mip: boolean) => {
    const t = new THREE.DataTexture(new Uint8Array(d.buffer, d.byteOffset, d.byteLength), w, h, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.generateMipmaps = mip; t.anisotropy = 8; t.needsUpdate = true;
    return t;
  };

  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mats) ? mats : mats ? [mats] : []).forEach((m) => {
      if (m.blending !== THREE.AdditiveBlending) return;
      m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation;
      m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor;
      m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
    });
  });

  /* ---- camera rig ---------------------------------------------------------- */
  let cssW = 1, cssH = 1;
  const placeQ = new Map<number, THREE.Quaternion>();
  SLIDES.forEach((s, i) => { if (s.place) placeQ.set(i, faceTo(latLon(s.place.lat, s.place.lon), V(0.32, 0.42, 1))); });
  const TILT = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -0.32);
  const spinQ = (a: number) => TILT.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a));
  const NU_HERO = 3.55, NU_CLOSE = 3.3;
  const fit = (g: number) => { const t = Math.tan((30 * Math.PI) / 360); return 1 / (t * g * Math.min(1, cssW / cssH)); };
  // portrait framing in pixels: a globe of diameter D whose top sits at `top`
  const TAN15 = Math.tan((30 * Math.PI) / 360);
  const distFor = (D: number) => cssH / (TAN15 * D);
  const nyFor = (D: number, top: number) => 1 - (2 * (top + D / 2)) / cssH;
  const portraitGlobe = (wf: number, hf: number, topF: number) => {
    const D = Math.min(wf * cssW, hf * cssH), top = Math.max(76, topF * cssH);
    return { dist: distFor(D), ny: nyFor(D, top) };
  };
  const portrait = () => cssW / cssH < 0.85;
  const craftPos = V(), hitPos = V(), craftFrame = new THREE.Matrix4();
  const inCraft = (x: number, y: number, z: number) => V(x, y, z).applyMatrix4(new THREE.Matrix4().extractRotation(craftFrame)).normalize();

  function pose(i: number, u: number, t: number): Pose {
    const id = SLIDES[i].id, P = portrait(), spin = t * 0.025;
    const base: Pose = {
      focus: V(), dir: V(0.08, 0.16, 1).normalize(), up: V(0, 1, 0), dist: P ? portraitGlobe(0.74, 0.42, 0.09).dist : fit(0.44), nx: P ? 0 : 0.16, ny: P ? portraitGlobe(0.74, 0.42, 0.09).ny : 0.02, fov: 30,
      q: spinQ(spin), orbits: 1, sats: 1, nisar: 1, craft: 0, ribbons: 0, hit: 0, coverOn: 0, cover: 0, nu: NU_HERO - t * 0.008, place: 0,
    };
    switch (id) {
      case 'hero': return base;
      case 'craft': {
        const c = craftPos.clone();
        return { ...base, focus: c, up: c.clone().normalize(), dir: inCraft(0.75, 0.42, 1), dist: P ? 0.46 : 0.34 - u * 0.04, nx: P ? 0 : 0.28, ny: P ? 0.2 : -0.06, orbits: 0.12, sats: 0.3, nisar: 0.4, craft: 1, nu: NU_CLOSE, q: spinQ(spin) };
      }
      case 'waves': {
        const mid = craftPos.clone().lerp(hitPos, 0.5);
        return { ...base, focus: mid, up: craftPos.clone().normalize(), dir: inCraft(0.06, 0.1, 1), dist: P ? 0.74 : 0.58, nx: P ? 0 : 0.22, ny: P ? 0.1 : -0.1, orbits: 0.08, sats: 0.2, nisar: 0.3, craft: 1, ribbons: 0.12 + 0.88 * sstep(0, 0.55, u), hit: sstep(0.35, 0.7, u), nu: NU_CLOSE, q: spinQ(spin) };
      }
      case 'cover':
        return { ...base, dir: V(0.12, 0.62, 1).normalize(), dist: P ? portraitGlobe(0.84, 0.5, 0.1).dist : fit(0.6), nx: P ? 0 : 0.2, ny: P ? portraitGlobe(0.84, 0.5, 0.1).ny : 0, orbits: 0.25, sats: 0.5, nisar: 1, coverOn: 1, cover: coverCount(u), q: spinQ(spin + u * 2.4) };
      case 'outro':
        return { ...base, dist: P ? portraitGlobe(0.66, 0.38, 0.12).dist : fit(0.36), nx: 0, ny: P ? portraitGlobe(0.66, 0.38, 0.12).ny : 0.18 };
      default: {
        // place slides: the globe turns the place toward the viewer; the slab rises above it
        const q = placeQ.get(i)!;
        const pw = V(0.32, 0.42, 1).normalize();
        return { ...base, focus: pw.clone(), dir: V(0.05, 0.3, 1).normalize(), dist: P ? 2.5 : 1.9, nx: P ? 0.1 : -0.06, ny: P ? -0.42 : -0.42, orbits: 0.1, sats: 0.25, nisar: 0, q, place: 1, nu: NU_HERO - t * 0.008 };
      }
    }
  }
  const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
    focus: a.focus.clone().lerp(b.focus, k), dir: a.dir.clone().lerp(b.dir, k).normalize(), up: a.up.clone().lerp(b.up, k).normalize(),
    dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), k)), nx: lerp(a.nx, b.nx, k), ny: lerp(a.ny, b.ny, k), fov: lerp(a.fov, b.fov, k),
    q: a.q.clone().slerp(b.q, k),
    orbits: lerp(a.orbits, b.orbits, k), sats: lerp(a.sats, b.sats, k), nisar: lerp(a.nisar, b.nisar, k), craft: lerp(a.craft, b.craft, k),
    ribbons: lerp(a.ribbons, b.ribbons, k), hit: lerp(a.hit, b.hit, k), coverOn: lerp(a.coverOn, b.coverOn, k), cover: lerp(a.cover, b.cover, k),
    nu: lerp(a.nu, b.nu, k), place: lerp(a.place, b.place, k),
  });

  /* ---- frame -------------------------------------------------------------- */
  let film: FilmPos = { i: 0, u: 0, k: 0 };
  let px = 0, py = 0, pxT = 0, pyT = 0, last = 0, raf = 0, running = false;
  const right = V(), upv = V(), fwd = V(), tmp = V(), proj = V();
  let anchorCb: ((a: Anchor) => void) | null = null;

  function render(now: number): void {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!reduced) time.value += dt;
    const t = time.value;
    const kk = reduced ? (film.k < 0.5 ? 0 : 1) : ease(film.k);
    const sm = reduced ? 1 : 1 - Math.exp(-dt * 3);
    px += (pxT - px) * sm; py += (pyT - py) * sm;

    // craft position first: craft poses are built around it
    const pa0 = pose(film.i, film.u, t);
    const pb0 = film.i < SLIDES.length - 1 ? pose(film.i + 1, 0, t) : pa0;
    const nu = lerp(pa0.nu, pb0.nu, kk);
    placeCraft(nu);
    craftPos.copy(craft.position);
    craftFrame.makeRotationFromQuaternion(craft.quaternion);
    hitPos.copy(dOut).applyQuaternion(craft.quaternion).multiplyScalar(LM * CRAFT_S).add(craft.localToWorld(O.clone().multiplyScalar(1)).sub(craft.position).multiplyScalar(0).add(craftPos));
    const pa = pose(film.i, film.u, t);
    const pb = film.i < SLIDES.length - 1 ? pose(film.i + 1, 0, t) : pa;
    const P = mixPose(pa, pb, kk);

    // intro push-in
    const push = ease(intro.push);
    const dist = P.dist * lerp(1.32, 1, push);
    camera.fov = P.fov;
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
    const camPos = P.focus.clone().addScaledVector(P.dir, dist);
    fwd.copy(P.dir).multiplyScalar(-1);
    right.crossVectors(fwd, P.up).normalize();
    upv.crossVectors(right, fwd).normalize();
    const visH = 2 * dist * Math.tan((P.fov * Math.PI) / 360), visW = visH * camera.aspect;
    camPos.addScaledVector(right, px * 0.012 * dist).addScaledVector(upv, -py * 0.01 * dist);
    const target = P.focus.clone().addScaledVector(right, -P.nx * visW * 0.5).addScaledVector(upv, -P.ny * visH * 0.5);
    camera.position.copy(camPos);
    camera.up.copy(P.up);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    // globe
    globe.quaternion.copy(P.q);
    earthU.uGlobe.value = ease(intro.globe);
    earthU.uCoverOn.value = P.coverOn; earthU.uCover.value = P.cover;
    earthU.uHitOn.value = P.hit;

    // limb ring as a billboard on the silhouette circle
    const d = camPos.length(), rs = Math.sqrt(Math.max(1e-4, 1 - 1 / (d * d)));
    ring.position.copy(camPos).normalize().multiplyScalar(1 / d);
    ring.quaternion.copy(camera.quaternion);
    ring.scale.setScalar(rs * 2.6);
    ringU.uDraw.value = ease(intro.ring);
    ringU.uPx.value = Math.max(40, (rs / (2 * (d - 1 / d) * Math.tan((P.fov * Math.PI) / 360))) * cssH);
    ringU.uOn.value = 1 - 0.6 * P.place;

    // orbits and satellites
    orbitGroup.rotation.y = t * 0.012 + (1 - push) * -0.5;
    orbitU.uDraw.value = intro.orbits; orbitU.uAlpha.value = P.orbits;
    satU.uAlpha.value = intro.sats * P.sats;
    orbs.forEach((o, i) => {
      for (let j = 0; j < TRAIL; j++) {
        const th = o.th0 + t * o.rate - j * 0.03;
        tmp.set(o.a * (Math.cos(th) - o.e), 0, o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(th)).applyMatrix4(o.m);
        satPos.set([tmp.x, tmp.y, tmp.z], (i * TRAIL + j) * 3);
      }
    });
    (satGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    nisarU.uDraw.value = ease(clamp(intro.orbits * 1.4 - 0.2, 0, 1));
    nisarU.uAlpha.value = P.nisar;
    const dotP = craft.position;
    ((dotGeo.attributes.position as THREE.BufferAttribute).array as Float32Array).set([dotP.x, dotP.y, dotP.z]);
    (dotGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    dotU.uAlpha.value = clamp(intro.trail * 2, 0, 1) * P.nisar * (1 - P.craft);

    // the trail runs back along the orbit, over the planet's limb, and thins out
    const trOn = P.nisar * (1 - P.craft) * (1 - P.place);
    trail.visible = trOn > 0.01;
    if (trail.visible) {
      for (let i = 0; i < TR_N; i++) {
        const sN = i / (TR_N - 1), nuS = nu + sN * TR_ARC;
        nisarAt(nuS, tp); nisarVel(nuS, tv);
        tc.copy(camPos).sub(tp).normalize();
        ts.crossVectors(tv, tc).normalize();
        const w = 0.004 + 0.019 * Math.pow(1 - sN, 1.5);
        trPos[i * 6] = tp.x + ts.x * w; trPos[i * 6 + 1] = tp.y + ts.y * w; trPos[i * 6 + 2] = tp.z + ts.z * w;
        trPos[i * 6 + 3] = tp.x - ts.x * w; trPos[i * 6 + 4] = tp.y - ts.y * w; trPos[i * 6 + 5] = tp.z - ts.z * w;
      }
      (trGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      trailU.uDraw.value = ease(intro.trail);
      trailU.uAlpha.value = trOn;
    }

    // spacecraft
    craft.visible = P.craft > 0.01;
    craft.scale.setScalar(CRAFT_S * lerp(0.2, 1, ease(P.craft)));
    ribbonU.uGrow.value = P.ribbons; ribbonU.uOpacity.value = clamp(P.ribbons * 4, 0, 1);
    craft.updateMatrixWorld(true);
    earthU.uHit.value.copy(craft.localToWorld(O.clone().addScaledVector(dOut, LM)));

    // slab: sinks into the old place and rises from the next one
    const cur = SLIDES[film.i].place, nxt = SLIDES[film.i + 1]?.place;
    let w = 0, sid: SceneId | null = null, scan = 0;
    if (film.k < 0.5) { if (cur) { w = 1 - ease(film.k * 2.2); sid = cur.scene; scan = scanAt(film.u); } }
    else if (nxt) { w = ease((film.k - 0.5) * 2); sid = nxt.scene; scan = 0; }
    if (reduced) w = w > 0.5 ? 1 : 0;
    const tex = sid ? slabTex.get(sid) : undefined;
    slab.visible = !!tex && w > 0.002;
    if (tex && sid !== slabShown) { slabU.uA.value = tex.a; slabU.uB.value = tex.b; slabU.uRelief.value = tex.r; slabShown = sid; }
    if (slab.visible) {
      const pl = film.k < 0.5 ? cur! : nxt!;
      // where it presents: right of centre, tilted back toward the viewer
      const D = 1.0, sh = 2 * D * Math.tan((P.fov * Math.PI) / 360), swd = sh * camera.aspect;
      const portraitNow = portrait();
      const presentPos = camPos.clone().addScaledVector(fwd, D)
        .addScaledVector(right, (portraitNow ? 0 : 0.25) * swd)
        .addScaledVector(upv, (portraitNow ? -0.08 : 0.04) * sh);
      const presentQ = camera.quaternion.clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -0.95))
        .multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), portraitNow ? 0.06 : 0.14));
      const scale = (portraitNow ? 0.86 : 0.4) * swd / 1.6;
      // where it comes from: the place on the globe, lying on the surface
      const local = latLon(pl.lat, pl.lon);
      const from = local.clone().applyQuaternion(globe.quaternion);
      const fromQ = faceTo(V(0, 0, 1), from);
      const e = ease(w);
      const mid = from.clone().multiplyScalar(1.25).lerp(presentPos, 0.5).addScaledVector(upv, 0.12);
      const a1 = from.clone().lerp(mid, e), a2 = mid.clone().lerp(presentPos, e);
      slab.position.copy(a1.lerp(a2, e));
      slab.quaternion.copy(fromQ).slerp(presentQ, e);
      slab.scale.setScalar(lerp(0.03, scale, e));
      slabU.uOpacity.value = clamp(w * 3, 0, 1);
      (base.material as THREE.MeshBasicMaterial).opacity = clamp(w * 3, 0, 1);
      (baseEdges.material as THREE.LineBasicMaterial).opacity = clamp(w * 3, 0, 1) * 0.5;
      slabU.uScan.value = scan;
    }
    const pl2 = (film.k < 0.5 ? cur : nxt) ?? cur ?? nxt;
    if (pl2) placeLocal.value.copy(latLon(pl2.lat, pl2.lon));
    earthU.uPlaceOn.value = P.place;

    renderer.render(scene, camera);

    if (anchorCb) {
      proj.copy(craft.position).project(camera);
      const behind = craft.position.dot(camPos) < 0 && craft.position.clone().sub(camPos).length() > camPos.length();
      anchorCb({ x: (proj.x * 0.5 + 0.5) * cssW, y: (-proj.y * 0.5 + 0.5) * cssH, on: behind ? 0 : P.nisar * (1 - P.craft) * intro.sats });
    }
  }

  function loop(now: number): void {
    raf = 0;
    if (!running) return;
    render(now);
    dirty = false;
    raf = requestAnimationFrame(loop);
  }

  function resize(): void {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    cssW = r.width; cssH = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);
    satU.uDpr.value = dpr;
    dirty = true;
    if (!running) render(performance.now());
  }

  return {
    intro,
    get onAnchor() { return anchorCb; },
    set onAnchor(cb) { anchorCb = cb; },
    setFilm(f) { film = f; dirty = true; },
    setPointer(nx, ny) { pxT = clamp(nx, -1, 1); pyT = clamp(ny, -1, 1); },
    addSlab(r) {
      if (slabTex.has(r.id)) return;
      slabTex.set(r.id, { a: mkTex(r.a, r.w, r.h, true), b: mkTex(r.b, r.w, r.h, true), r: mkTex(r.relief, r.w / 4, Math.floor(r.h / 4), false) });
      dirty = true;
    },
    resize,
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    dispose() {
      running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      slabTex.forEach((x) => { x.a.dispose(); x.b.dispose(); x.r.dispose(); });
      day.dispose(); night.dispose();
      renderer.dispose();
    },
  };
}
