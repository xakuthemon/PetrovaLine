/*
 * Petrova Line — comparison-viewport engine.
 * Renders date A and date B of a scene into off-screen canvases and composites
 * them with a divider, pan / zoom, a graticule and place markers. The glass UI
 * around it is React; this class only owns pixels and pointer maths.
 */
import { clamp, reducedMotion } from './util';
import { BANDS, type BandId } from './physics';
import { CLASSES, getScene, makeState, W, H, N, type Scene, type SceneId, type SceneState } from './scenes';
import * as R from './render';
import type { Mechanism, Pol, SkyParams } from './render';

export type Channel = 'HH' | 'HV' | 'VV' | 'INSAR' | 'RGB';
export type Sensor = 'sar' | 'optical';

export interface MapParams {
  tA: number;
  tB: number;
  sensor: Sensor;
  channel: Channel;
  band: BandId;
  clouds: boolean;
  change: boolean;
  grid: boolean;
  places: boolean;
  mechanism: Mechanism | null;
}
export interface Place { anchor: string; label: string }

export interface ProbeInfo {
  x: number; y: number; i: number;
  side: 'A' | 'B';
  lat: number; lon: number;
  cls: string; clsA: string; clsB: string;
  sA: { HH: number; HV: number; VV: number };
  sB: { HH: number; HV: number; VV: number };
  state: { R: number; E: number; V: number; D: number };
  disp: number;
  coh: number;
  cloud: number;
  light: number;
  mech: { dominant: Mechanism; surface: number; volume: number; dbl: number };
}
export interface MapStats {
  /** share of the scene dominated by the selected mechanism at date B, or null */
  mechShare: number | null;
  /** mean interferometric coherence of the A→B pair */
  meanCoh: number;
  sky: SkyParams | null;
}
export interface MapHooks {
  onProbe?(info: ProbeInfo | null, px: number, py: number): void;
  onPick?(info: ProbeInfo): void;
  onStats?(s: MapStats): void;
  onDraw?(): void;
  onView?(kmPerPx: number, zoom: number): void;
}

const FONT = '500 12px Archivo, system-ui, sans-serif';

export class MapEngine {
  private ctx: CanvasRenderingContext2D;
  private offA = document.createElement('canvas');
  private offB = document.createElement('canvas');
  private ctxA: CanvasRenderingContext2D;
  private ctxB: CanvasRenderingContext2D;
  private imgA: ImageData;
  private imgB: ImageData;
  private SA: SceneState = makeState();
  private SB: SceneState = makeState();
  private dbA = new Float32Array(N);
  private dbB = new Float32Array(N);
  private scene: Scene | null = null;
  private places: Place[] = [];
  private P: MapParams | null = null;
  private keySA = ''; private keySB = ''; private keyIA = ''; private keyIB = ''; private keyStats = '';
  private skyA: SkyParams | null = null; private skyB: SkyParams | null = null;
  private stats: MapStats = { mechShare: null, meanCoh: 1, sky: null };
  private cssW = 1; private cssH = 1; private dpr = 1;
  private view = { s: 1, ox: 0, oy: 0 }; private minS = 1;
  private split = 0.5;
  private fly: { from: { s: number; ox: number; oy: number }; to: { s: number; ox: number; oy: number }; t0: number; dur: number } | null = null;
  private raf = 0; private needDraw = false; private dead = false;
  private pointers = new Map<number, [number, number]>();
  private drag: { x: number; y: number; ox: number; oy: number; moved: boolean } | null = null;
  private pinch: { d: number } | null = null;
  private ro: ResizeObserver | null = null;
  private off: Array<() => void> = [];

  constructor(private canvas: HTMLCanvasElement, private hooks: MapHooks = {}) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.offA.width = this.offB.width = W;
    this.offA.height = this.offB.height = H;
    this.ctxA = this.offA.getContext('2d')!;
    this.ctxB = this.offB.getContext('2d')!;
    this.imgA = this.ctxA.createImageData(W, H);
    this.imgB = this.ctxB.createImageData(W, H);
    this.bind();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
    }
    this.resize();
  }

  destroy(): void {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.off.forEach((f) => f());
  }

  /* ---- scene ------------------------------------------------------------- */
  setCase(id: SceneId, places: Place[]): void {
    this.scene = getScene(id);
    this.places = places;
    this.keySA = this.keySB = this.keyIA = this.keyIB = this.keyStats = '';
    this.resize();
    this.view = { s: this.minS, ox: (this.cssW - W * this.minS) / 2, oy: (this.cssH - H * this.minS) / 2 };
    this.fly = null;
    if (this.P) this.refresh();
  }

  update(p: MapParams): void {
    this.P = p;
    this.refresh();
  }

  private refresh(): void {
    const scene = this.scene, P = this.P;
    if (!scene || !P) return;
    const optical = P.sensor === 'optical';
    const insar = !optical && P.channel === 'INSAR';
    const kA = scene.id + '|' + P.tA + '|' + (optical ? 'o' : 's');
    const kB = scene.id + '|' + P.tB + '|' + (optical ? 'o' : 's');
    let aChanged = false, bChanged = false;
    if (kA !== this.keySA) { scene.compute(P.tA, this.SA, optical, 1); this.keySA = kA; aChanged = true; }
    if (kB !== this.keySB) { scene.compute(P.tB, this.SB, optical, 1); this.keySB = kB; bChanged = true; }
    const mech = optical ? null : P.mechanism;
    let share: number | null = this.stats.mechShare;

    const style = optical ? 'opt|' + (P.clouds ? 1 : 0) : (insar ? 'HH' : P.channel) + '|' + P.band + '|' + (mech || '-');
    const iA = kA + '|' + style;
    if (iA !== this.keyIA || aChanged) {
      if (optical) this.skyA = R.optical(scene, this.SA, P.tA, P.clouds, this.imgA.data);
      else {
        R.sar(scene, this.SA, (insar ? 'HH' : P.channel) as Pol, P.band, this.imgA.data, this.dbA);
        if (mech) R.mechanismOverlay(this.imgA.data, this.SA, P.band, mech);
      }
      this.ctxA.putImageData(this.imgA, 0, 0);
      this.keyIA = iA;
      aChanged = true;
    }
    const styleB = optical ? style : P.channel + '|' + P.band + '|' + (P.change ? 1 : 0) + '|' + (mech || '-');
    const iB = kB + '|' + styleB + (insar || P.change ? '|' + kA : '');
    if (iB !== this.keyIB || bChanged || ((insar || P.change) && aChanged)) {
      if (optical) { this.skyB = R.optical(scene, this.SB, P.tB, P.clouds, this.imgB.data); share = null; }
      else {
        if (insar) R.insar(scene, this.SA, this.SB, P.band, this.imgB.data, this.dbB, P.tA, P.tB);
        else {
          R.sar(scene, this.SB, P.channel as Pol, P.band, this.imgB.data, this.dbB);
          if (P.change && !mech) R.changeOverlay(this.imgB.data, this.dbA, this.dbB);
        }
        share = mech ? R.mechanismOverlay(this.imgB.data, this.SB, P.band, mech) : null;
      }
      this.ctxB.putImageData(this.imgB, 0, 0);
      this.keyIB = iB;
    }
    // pair statistics for the coherence gauge (coarse grid)
    const kS = kA + '|' + kB + '|' + P.band + '|' + (optical ? 1 : 0) + '|' + (mech || '-') + '|' + (P.clouds ? 1 : 0);
    if (kS !== this.keyStats) {
      this.keyStats = kS;
      let sum = 0, n = 0;
      const dt = Math.abs(P.tB - P.tA), isS = P.band === 'S';
      for (let y = 3; y < H; y += 6) for (let x = 3; x < W; x += 6) { sum += R.pairCoherence(scene, this.SA, this.SB, y * W + x, isS, dt); n++; }
      this.stats = { mechShare: share, meanCoh: sum / n, sky: optical ? this.skyB : null };
      this.hooks.onStats?.(this.stats);
    }
    this.requestDraw();
  }

  /* ---- view -------------------------------------------------------------- */
  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const cx = (this.cssW / 2 - this.view.ox) / this.view.s, cy = (this.cssH / 2 - this.view.oy) / this.view.s;
    const rel = this.view.s / this.minS;
    this.cssW = r.width; this.cssH = r.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.minS = Math.max(this.cssW / W, this.cssH / H);
    this.view.s = this.minS * (isFinite(rel) && rel >= 1 ? rel : 1);
    this.view.ox = this.cssW / 2 - cx * this.view.s;
    this.view.oy = this.cssH / 2 - cy * this.view.s;
    if (!isFinite(this.view.ox)) { this.view.ox = (this.cssW - W * this.view.s) / 2; this.view.oy = (this.cssH - H * this.view.s) / 2; }
    this.clampView();
    this.requestDraw();
  }
  private clampView(): void {
    const v = this.view;
    v.s = clamp(v.s, this.minS, this.minS * 8);
    v.ox = clamp(v.ox, this.cssW - W * v.s, 0);
    v.oy = clamp(v.oy, this.cssH - H * v.s, 0);
  }
  zoomAt(px: number, py: number, factor: number): void {
    const v = this.view;
    const s2 = clamp(v.s * factor, this.minS, this.minS * 8), k = s2 / v.s;
    v.ox = px - (px - v.ox) * k; v.oy = py - (py - v.oy) * k; v.s = s2;
    this.clampView();
    this.requestDraw();
  }
  zoomBy(factor: number): void { this.fly = null; this.zoomAt(this.cssW / 2, this.cssH / 2, factor); }
  flyTo(u: number, v: number, zoom: number): void {
    const s2 = this.minS * clamp(zoom || 1, 1, 8);
    const to = { s: s2, ox: clamp(this.cssW / 2 - u * W * s2, this.cssW - W * s2, 0), oy: clamp(this.cssH / 2 - v * H * s2, this.cssH - H * s2, 0) };
    if (reducedMotion()) { this.view = to; this.fly = null; this.requestDraw(); return; }
    this.fly = { from: { ...this.view }, to, t0: performance.now(), dur: 900 };
    this.requestDraw();
  }
  focusAnchor(name: string, zoom: number): void {
    const a = this.scene?.anchors[name];
    if (a) this.flyTo(a[0], a[1], zoom);
  }
  resetView(): void { this.flyTo(0.5, 0.5, 1); }
  setSplit(v: number): void { this.split = clamp(v, 0.02, 0.98); this.requestDraw(); }
  getSplit(): number { return this.split; }
  size(): { w: number; h: number } { return { w: this.cssW, h: this.cssH }; }

  /* ---- drawing ----------------------------------------------------------- */
  private requestDraw(): void {
    this.needDraw = true;
    if (!this.raf && !this.dead) this.raf = requestAnimationFrame(this.frame);
  }
  private frame = (now: number): void => {
    this.raf = 0;
    const f = this.fly;
    if (f) {
      let k = (now - f.t0) / f.dur;
      if (k >= 1) { this.view = { ...f.to }; this.fly = null; }
      else {
        k = k < 0 ? 0 : k;
        const e = 1 - Math.pow(1 - k, 3);
        const s = f.from.s * Math.pow(f.to.s / f.from.s, e);
        const c0x = (this.cssW / 2 - f.from.ox) / f.from.s, c0y = (this.cssH / 2 - f.from.oy) / f.from.s;
        const c1x = (this.cssW / 2 - f.to.ox) / f.to.s, c1y = (this.cssH / 2 - f.to.oy) / f.to.s;
        this.view.s = s;
        this.view.ox = this.cssW / 2 - (c0x + (c1x - c0x) * e) * s;
        this.view.oy = this.cssH / 2 - (c0y + (c1y - c0y) * e) * s;
        this.clampView();
      }
      this.needDraw = true;
    }
    if (this.needDraw) { this.needDraw = false; this.draw(); }
    if (this.fly && !this.raf && !this.dead) this.raf = requestAnimationFrame(this.frame);
  };

  private draw(): void {
    const scene = this.scene, P = this.P;
    if (!scene || !P) return;
    const { ctx, cssW, cssH, view } = this;
    const sx = Math.round(this.split * cssW);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = view.s < 4;
    ctx.imageSmoothingQuality = 'high';
    const dw = W * view.s, dh = H * view.s;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, cssH); ctx.clip();
    ctx.drawImage(this.offA, view.ox, view.oy, dw, dh); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, cssW - sx, cssH); ctx.clip();
    ctx.drawImage(this.offB, view.ox, view.oy, dw, dh); ctx.restore();
    if (P.grid) this.drawGraticule();
    if (P.places) this.drawPlaces();
    this.hooks.onDraw?.();
    this.hooks.onView?.(scene.widthKm / (W * view.s), view.s / this.minS);
  }

  private drawGraticule(): void {
    const { ctx, cssW, cssH, view } = this, b = this.scene!.bounds;
    const lonAt = (px: number) => b.west + ((px - view.ox) / (W * view.s)) * (b.east - b.west);
    const latAt = (py: number) => b.north - ((py - view.oy) / (H * view.s)) * (b.north - b.south);
    const lon0 = lonAt(0), lon1 = lonAt(cssW), lat0 = latAt(0), lat1 = latAt(cssH);
    const raw = (lon1 - lon0) / 6;
    const st = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1].find((q) => q >= raw) || 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(242,238,230,0.09)';
    ctx.beginPath();
    for (let lon = Math.ceil(lon0 / st) * st; lon < lon1; lon += st) {
      const x = Math.round(((lon - b.west) / (b.east - b.west)) * W * view.s + view.ox) + 0.5;
      ctx.moveTo(x, 0); ctx.lineTo(x, cssH);
    }
    for (let lat = Math.ceil(lat1 / st) * st; lat < lat0; lat += st) {
      const y = Math.round(((b.north - lat) / (b.north - b.south)) * H * view.s + view.oy) + 0.5;
      ctx.moveTo(0, y); ctx.lineTo(cssW, y);
    }
    ctx.stroke();
  }

  private drawPlaces(): void {
    const { ctx, cssW, cssH, view } = this, scene = this.scene!;
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    for (const p of this.places) {
      const a = scene.anchors[p.anchor];
      if (!a) continue;
      const x = Math.round(a[0] * W * view.s + view.ox), y = Math.round(a[1] * H * view.s + view.oy);
      if (x < 10 || y < 10 || x > cssW - 10 || y > cssH - 10) continue;
      ctx.fillStyle = 'rgba(23,24,36,0.9)';
      ctx.strokeStyle = '#F4ECE3';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const label = p.label, w = ctx.measureText(label).width;
      const left = x + 12 + w > cssW - 8;
      const tx = left ? x - 10 - w : x + 10;
      ctx.fillStyle = 'rgba(23,24,36,0.72)';
      ctx.fillRect(tx - 5, y - 9, w + 10, 18);
      ctx.fillStyle = 'rgba(244,236,227,0.95)';
      ctx.fillText(label, tx, y + 0.5);
    }
  }

  /** Copy a magnified patch of the composited view (used by the glass divider lens). */
  drawLens(target: CanvasRenderingContext2D, cssX: number, cssY: number, size: number, zoom: number): void {
    const src = size / zoom, d = this.dpr;
    target.imageSmoothingEnabled = true;
    target.clearRect(0, 0, target.canvas.width, target.canvas.height);
    target.drawImage(this.canvas, (cssX - src / 2) * d, (cssY - src / 2) * d, src * d, src * d, 0, 0, target.canvas.width, target.canvas.height);
  }

  /* ---- probe ------------------------------------------------------------- */
  infoAt(px: number, py: number): ProbeInfo | null {
    const { view } = this;
    const x = Math.floor((px - view.ox) / view.s), y = Math.floor((py - view.oy) / view.s);
    return this.infoAtScene(x, y, px < this.split * this.cssW ? 'A' : 'B');
  }
  /** Probe one scene pixel on the date-A or date-B side. */
  infoAtScene(x: number, y: number, side: 'A' | 'B'): ProbeInfo | null {
    const scene = this.scene, P = this.P;
    if (!scene || !P || x < 0 || y < 0 || x >= W || y >= H) return null;
    const { SA, SB } = this;
    const i = y * W + x, b = scene.bounds;
    const S = side === 'A' ? SA : SB;
    const optical = P.sensor === 'optical';
    const sky = side === 'A' ? this.skyA : this.skyB;
    return {
      x, y, i, side,
      lat: b.north - ((y + 0.5) / H) * (b.north - b.south),
      lon: b.west + ((x + 0.5) / W) * (b.east - b.west),
      cls: CLASSES[S.K[i]] || 'Surface', clsA: CLASSES[SA.K[i]], clsB: CLASSES[SB.K[i]],
      sA: R.expected(scene, SA, i, P.band), sB: R.expected(scene, SB, i, P.band),
      state: { R: S.R[i], E: S.E[i], V: S.V[i], D: S.D[i] },
      disp: R.pairDisplacement(scene, SA, SB, i),
      coh: R.pairCoherence(scene, SA, SB, i, P.band === 'S', Math.abs(P.tB - P.tA)),
      cloud: optical && P.clouds ? R.cloudAlpha(scene, x, y, side === 'A' ? P.tA : P.tB) : 0,
      light: optical && sky ? sky.light : 1,
      mech: R.mechanismAt(S, i, P.band),
    };
  }
  /** Probe at a named place on the date-B side (the default "active pixel region"). */
  infoAtAnchor(name: string): ProbeInfo | null {
    const a = this.scene?.anchors[name];
    return a ? this.infoAtScene(Math.round(a[0] * (W - 1)), Math.round(a[1] * (H - 1)), 'B') : null;
  }
  /** Screen position of the divider, for overlays. */
  splitX(): number { return Math.round(this.split * this.cssW); }
  fringe(): number { return this.P ? BANDS[this.P.band].fringe : BANDS.L.fringe; }

  /* ---- pointer ----------------------------------------------------------- */
  private local(e: PointerEvent | WheelEvent | MouseEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  private bind(): void {
    const c = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      c.addEventListener(t, f as EventListener, o);
      this.off.push(() => c.removeEventListener(t, f as EventListener, o));
    };
    on('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const [x, y] = this.local(e);
      this.pointers.set(e.pointerId, [x, y]);
      this.fly = null;
      if (this.pointers.size === 2) {
        const p = Array.from(this.pointers.values());
        this.pinch = { d: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) };
        this.drag = null;
      } else this.drag = { x, y, ox: this.view.ox, oy: this.view.oy, moved: false };
    });
    on('pointermove', (e) => {
      const [x, y] = this.local(e);
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, [x, y]);
      if (this.pinch && this.pointers.size === 2) {
        const p = Array.from(this.pointers.values());
        const d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
        this.zoomAt((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2, d / (this.pinch.d || d));
        this.pinch.d = d;
        return;
      }
      const dr = this.drag;
      if (dr) {
        const dx = x - dr.x, dy = y - dr.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) dr.moved = true;
        if (dr.moved) {
          this.view.ox = dr.ox + dx; this.view.oy = dr.oy + dy;
          this.clampView();
          this.hooks.onProbe?.(null, x, y);
          this.requestDraw();
        }
        return;
      }
      if (e.pointerType !== 'touch') this.hooks.onProbe?.(this.infoAt(x, y), x, y);
    });
    const end = (e: PointerEvent) => {
      const [x, y] = this.local(e);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.drag && !this.drag.moved && e.type === 'pointerup') {
        const inf = this.infoAt(x, y);
        if (inf) this.hooks.onPick?.(inf);
      }
      this.drag = null;
    };
    on('pointerup', end);
    on('pointercancel', end);
    on('pointerleave', (e) => { if (!this.drag) this.hooks.onProbe?.(null, ...this.local(e)); });
    on('wheel', (e) => {
      e.preventDefault();
      const [x, y] = this.local(e);
      this.fly = null;
      this.zoomAt(x, y, Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });
    on('dblclick', (e) => { const [x, y] = this.local(e); this.zoomAt(x, y, 1.8); });
  }
}

/** Small SAR thumbnail of a scene at one date (used by the case switcher). Heavy on first call per scene. */
const thumbState: { S: SceneState | null; img: Uint8ClampedArray | null; db: Float32Array | null } = { S: null, img: null, db: null };
export function renderThumb(id: SceneId, t: number, target: HTMLCanvasElement): void {
  const scene = getScene(id);
  if (!thumbState.S) { thumbState.S = makeState(); thumbState.img = new Uint8ClampedArray(N * 4); thumbState.db = new Float32Array(N); }
  scene.compute(t, thumbState.S, false, 1);
  R.sar(scene, thumbState.S, 'HH', 'L', thumbState.img!, thumbState.db!);
  const full = document.createElement('canvas');
  full.width = W; full.height = H;
  const fc = full.getContext('2d')!;
  fc.putImageData(new ImageData(thumbState.img!, W, H), 0, 0);
  const tc = target.getContext('2d')!;
  tc.imageSmoothingQuality = 'high';
  // crop to the target aspect around the centre
  const ta = target.width / target.height, sa = W / H;
  const sw = ta > sa ? W : H * ta, sh = ta > sa ? W / ta : H;
  tc.drawImage(full, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, target.width, target.height);
}
