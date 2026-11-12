/* TerraWaltz — shared math, seeded noise and small DOM helpers. */
(function () {
  'use strict';
  const TW = (window.TW = window.TW || {});

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    let t = (x - a) / (b - a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  };

  /** Deterministic PRNG (mulberry32). */
  function rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Integer lattice hash -> [0, 1). */
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /**
   * Fractal value-noise field, stretched to the full 0..1 range.
   * @param {number} fx  base frequency in cycles across the width
   * @param {object} o   { oct, gain, ridged, tile, aspect }
   */
  function fbmField(W, H, seed, fx, o) {
    o = o || {};
    const oct = o.oct || 4;
    const gain = o.gain || 0.5;
    const tile = !!o.tile;
    const out = new Float32Array(W * H);
    const r = rng(seed);
    let fy = fx * (o.aspect || H / W);
    if (tile) { fx = Math.max(1, Math.round(fx)); fy = Math.max(1, Math.round(fy)); }
    let amp = 1;
    const xi0 = new Int32Array(W), xi1 = new Int32Array(W), xt = new Float32Array(W);
    for (let k = 0; k < oct; k++) {
      const gx = tile ? fx : Math.ceil(fx) + 2;
      const gy = tile ? fy : Math.ceil(fy) + 2;
      const lat = new Float32Array(gx * gy);
      for (let i = 0; i < lat.length; i++) lat[i] = r();
      for (let x = 0; x < W; x++) {
        const p = (x / W) * fx;
        const i = Math.floor(p);
        const t = p - i;
        xi0[x] = tile ? i % gx : i;
        xi1[x] = tile ? (i + 1) % gx : i + 1;
        xt[x] = t * t * (3 - 2 * t);
      }
      for (let y = 0; y < H; y++) {
        const p = (y / H) * fy;
        const j = Math.floor(p);
        let t = p - j;
        t = t * t * (3 - 2 * t);
        const r0 = (tile ? j % gy : j) * gx;
        const r1 = (tile ? (j + 1) % gy : j + 1) * gx;
        const row = y * W;
        for (let x = 0; x < W; x++) {
          const s = xt[x];
          const a = lat[r0 + xi0[x]] + (lat[r0 + xi1[x]] - lat[r0 + xi0[x]]) * s;
          const b = lat[r1 + xi0[x]] + (lat[r1 + xi1[x]] - lat[r1 + xi0[x]]) * s;
          let v = a + (b - a) * t;
          if (o.ridged) v = 1 - Math.abs(2 * v - 1);
          out[row + x] += v * amp;
        }
      }
      amp *= gain;
      fx *= 2;
      fy *= 2;
    }
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < out.length; i++) { const v = out[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const inv = 1 / (mx - mn || 1);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) * inv;
    return out;
  }

  /** Distance from point p to segment a-b (all in the same units). */
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qy = ay + dy * t - py;
    return Math.sqrt(qx * qx + qy * qy);
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const T0 = 2020;          // timeline origin (January 2020)
  const M_MAX = 80;         // last month index (September 2026)

  const monthToYear = (m) => T0 + m / 12;
  function monthLabel(m) {
    const k = Math.round(m);
    return MONTHS[((k % 12) + 12) % 12] + ' ' + (T0 + Math.floor(k / 12));
  }

  function fmt(v, digits) {
    if (v == null || !isFinite(v)) return '–';
    const d = digits == null ? 1 : digits;
    const s = Math.abs(v).toFixed(d);
    return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
  }
  function fmtSigned(v, digits) {
    if (v == null || !isFinite(v)) return '–';
    const d = digits == null ? 1 : digits;
    const s = Math.abs(v).toFixed(d);
    if (Number(s) === 0) return s;
    return (v < 0 ? '−' : '+') + s;
  }

  /** Tiny element factory: h('div.cls', {attr}, children...) */
  function h(sel, attrs) {
    const parts = sel.split('.');
    const el = document.createElement(parts[0] || 'div');
    if (parts.length > 1) el.className = parts.slice(1).join(' ');
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach((n) => n && el.appendChild(typeof n === 'string' ? document.createTextNode(n) : n));
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  const reducedMotion = () =>
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  TW.util = {
    clamp, sat, lerp, smooth, rng, hash2, fbmField, segDist,
    MONTHS, T0, M_MAX, monthToYear, monthLabel, fmt, fmtSigned, h, store, reducedMotion,
  };
})();
