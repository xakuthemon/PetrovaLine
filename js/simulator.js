/*
 * TerraWaltz — Radar Physics Decoder.
 * Two sliders (surface roughness, dielectric constant) drive the same
 * backscatter model as the map and a live ray diagram of where the pulse goes.
 */
(function () {
  'use strict';
  const TW = (window.TW = window.TW || {});
  const U = TW.util;
  const PH = TW.physics;

  const PRESETS = [
    { id: 'water', label: 'Calm water', rough: 0.03, eps: 80, stems: false, snow: false },
    { id: 'salt', label: 'Dry salt flat', rough: 0.14, eps: 3.5, stems: false, snow: false },
    { id: 'mud', label: 'Wet mudflat', rough: 0.3, eps: 38, stems: false, snow: false },
    { id: 'field', label: 'Ploughed field', rough: 0.72, eps: 14, stems: false, snow: false },
    { id: 'flood', label: 'Flooded forest', rough: 0.04, eps: 80, stems: true, snow: false },
    { id: 'city', label: 'City block', rough: 0.2, eps: 9, stems: true, snow: false, d: 2.2, v: 0 },
    { id: 'firn', label: 'Dry snow', rough: 0.3, eps: 1.8, stems: false, snow: true },
    { id: 'melt', label: 'Melting snow', rough: 0.12, eps: 5.5, stems: false, snow: true },
  ];

  const REGIMES = {
    specular: { name: 'Specular reflection', tone: 'dark',
      text: 'The surface is smooth compared with the wavelength, so it behaves like a mirror. Almost all the energy leaves in the forward direction, away from the satellite. The pixel is dark.' },
    diffuse: { name: 'Diffuse backscatter', tone: 'bright',
      text: 'Roughness close to the wavelength scatters energy in every direction, including back to the antenna. Wetter ground reflects more of it. The pixel is bright.' },
    double: { name: 'Double-bounce', tone: 'vbright',
      text: 'The pulse reflects off the smooth surface, then off a vertical stem or wall, and returns along its own path. A high dielectric contrast makes both reflections strong. The pixel is very bright in HH.' },
    volume: { name: 'Volume scattering', tone: 'bright',
      text: 'The pulse enters a porous layer and scatters many times off stems, branches or buried ice layers. Part of the energy changes polarisation, which is why HV responds.' },
    absorbed: { name: 'Absorption in wet snow', tone: 'dark',
      text: 'Liquid water raises the dielectric constant of snow and absorbs the pulse within centimetres. Very little is scattered back. The pixel turns dark.' },
  };

  function Simulator(root, hooks) {
    const canvas = root.querySelector('#sim-canvas');
    const ctx = canvas.getContext('2d');
    const elRough = root.querySelector('#sim-rough'), elEps = root.querySelector('#sim-eps');
    const outRough = root.querySelector('#sim-rough-out'), outEps = root.querySelector('#sim-eps-out');
    const elStems = root.querySelector('#sim-stems'), elSnow = root.querySelector('#sim-snow');
    const elPresets = root.querySelector('#sim-presets');
    const elRegime = root.querySelector('#sim-regime'), elRegimeText = root.querySelector('#sim-regime-text');
    const elBars = root.querySelector('#sim-bars'), elFacts = root.querySelector('#sim-facts');
    const elSource = root.querySelector('#sim-source');
    const swatch = root.querySelector('#sim-swatch'), sctx = swatch.getContext('2d');

    const st = { rough: 0.3, eps: 38, stems: false, snow: false, vOv: null, dOv: null, preset: 'mud' };
    let cw = 1, ch = 1, visible = true, raf = 0, model = null;
    const out3 = new Float32Array(3);
    const noise = U.rng(4242);
    const speck = new Float32Array(56 * 56);
    for (let i = 0; i < speck.length; i++) {
      let s = 0;
      for (let k = 0; k < 5; k++) s -= Math.log(noise() + 1e-6);
      speck[i] = 10 * Math.log10(s / 5);
    }

    function params() {
      const isS = hooks.getBand() === 'S';
      let V = 0, D = 0;
      if (st.snow) V = 0.95 * Math.exp(-Math.max(0, st.eps - 1.6) / 1.3);
      else if (st.stems) { V = 0.22; D = 1.1; }
      if (st.vOv != null) V = st.vOv;
      if (st.dOv != null) D = st.dOv;
      return { R: st.rough, E: st.eps, V, D, isS };
    }

    function compute() {
      const p = params();
      PH.sigma(p.R, p.E, p.V, p.D, p.isS, out3);
      const b = PH.breakdown(p.R, p.E, p.V, p.D, p.isS);
      const hh = PH.toDb(out3[0]), hv = PH.toDb(out3[1]), vv = PH.toDb(out3[2]);
      let regime;
      if (st.snow && p.V < 0.25 && hh < -15) regime = 'absorbed';
      else if (b.dbl >= b.surface && b.dbl >= b.volume && b.dbl > 0.01) regime = 'double';
      else if (b.volume > b.surface && b.volume > 0.012) regime = 'volume';
      else if (hh < -18.5) regime = 'specular';
      else regime = 'diffuse';
      model = { p, b, hh, hv, vv, regime };
    }

    function syncUi() {
      compute();
      const m = model;
      elRough.value = Math.round(st.rough * 100);
      elEps.value = st.eps;
      const lam = PH.BANDS[hooks.getBand()].lambda;
      outRough.textContent = U.fmt(st.rough * 6, 1) + ' cm rms · ' + (st.rough * 6 < lam / 16 ? 'smooth' : st.rough * 6 < lam / 6 ? 'intermediate' : 'rough') + ' at ' + lam + ' cm';
      outEps.textContent = 'ε = ' + U.fmt(st.eps, st.eps < 10 ? 1 : 0) + ' · ' + epsWord(st.eps, st.snow);
      elStems.setAttribute('aria-pressed', String(st.stems));
      elSnow.setAttribute('aria-pressed', String(st.snow));
      elPresets.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === st.preset)));
      const rg = REGIMES[m.regime];
      elRegime.textContent = rg.name;
      elRegime.dataset.tone = rg.tone;
      elRegimeText.textContent = rg.text;

      elBars.textContent = '';
      [['HH', m.hh], ['HV', m.hv], ['VV', m.vv]].forEach(([k, v]) => {
        const pct = U.clamp(((v + 36) / 36) * 100, 2, 100);
        elBars.appendChild(U.h('div.sim-bar', null,
          U.h('span.sim-bar-k', { text: k }),
          U.h('span.sim-bar-track', null, U.h('span.sim-bar-fill', { style: 'width:' + pct.toFixed(1) + '%' })),
          U.h('span.sim-bar-v', { text: U.fmt(v, 1) + ' dB' })));
      });
      elFacts.textContent = '';
      const pen = st.snow ? (m.p.V > 0.5 ? 'metres (dry snow is nearly transparent)' : 'centimetres (liquid water absorbs)') :
        st.eps > 40 ? 'millimetres' : st.eps > 12 ? 'a few centimetres' : 'tens of centimetres';
      [
        ['Reflected at the surface', Math.round(m.b.G * 100) + ' %'],
        ['Enters the material', Math.round((1 - m.b.G) * 100) + ' %'],
        ['Penetration depth', pen],
      ].forEach(([k, v]) => elFacts.appendChild(U.h('div.sim-fact', null, U.h('span', { text: k }), U.h('b', { text: v }))));
      drawSwatch(m.hh);
      draw(performance.now());
    }

    function epsWord(e, snow) {
      if (snow) return e < 2.4 ? 'dry snow' : e < 4 ? 'moist snow' : 'wet snow';
      return e < 2 ? 'air-dry powder' : e < 6 ? 'dry sand · salt' : e < 14 ? 'slightly moist soil' : e < 28 ? 'moist soil' : e < 55 ? 'wet mud' : 'open water';
    }

    function drawSwatch(db) {
      const im = sctx.createImageData(56, 56);
      for (let i = 0; i < speck.length; i++) {
        let g = ((db + speck[i] + 27) / 26) * 255;
        g = g < 0 ? 0 : g > 255 ? 255 : g;
        im.data[i * 4] = g * 0.93; im.data[i * 4 + 1] = g * 0.97; im.data[i * 4 + 2] = g; im.data[i * 4 + 3] = 255;
      }
      sctx.putImageData(im, 0, 0);
    }

    /* ---- diagram ----------------------------------------------------------- */
    function resize() {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = r.width; ch = r.height;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }
    const mix = (a, b, t) => 'rgb(' + Math.round(U.lerp(a[0], b[0], t)) + ',' + Math.round(U.lerp(a[1], b[1], t)) + ',' + Math.round(U.lerp(a[2], b[2], t)) + ')';
    function groundY(x) {
      const a = st.rough * 11;
      return ch * 0.66 + a * (0.5 * Math.sin(x * 0.09 + 1) + 0.3 * Math.sin(x * 0.23 + 2.1) + 0.2 * Math.sin(x * 0.47 + 0.4));
    }
    function arrow(x0, y0, x1, y1, color, width, alpha, dash) {
      if (alpha <= 0.02) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.setLineDash([]);
      const a = Math.atan2(y1 - y0, x1 - x0), s = 4 + width * 1.6;
      ctx.beginPath();
      ctx.moveTo(x1 + Math.cos(a) * s * 0.6, y1 + Math.sin(a) * s * 0.6);
      ctx.lineTo(x1 - Math.cos(a - 0.5) * s, y1 - Math.sin(a - 0.5) * s);
      ctx.lineTo(x1 - Math.cos(a + 0.5) * s, y1 - Math.sin(a + 0.5) * s);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function pulses(x0, y0, x1, y1, color, phase, n, alpha) {
      if (alpha <= 0.03) return;
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let k = 0; k < n; k++) {
        const f = (phase + k / n) % 1;
        const cx = x0 + dx * f, cy = y0 + dy * f;
        ctx.globalAlpha = alpha * Math.sin(Math.PI * f);
        ctx.beginPath(); ctx.moveTo(cx - nx * 7, cy - ny * 7); ctx.lineTo(cx + nx * 7, cy + ny * 7); ctx.stroke();
      }
      ctx.restore();
    }
    function label(txt, x, y, color, align) {
      ctx.save();
      ctx.font = '500 10.5px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = align || 'left';
      ctx.fillStyle = 'rgba(9,13,22,0.72)';
      const w = ctx.measureText(txt).width;
      const bx = align === 'right' ? x - w - 4 : align === 'center' ? x - w / 2 - 4 : x - 4;
      ctx.fillRect(bx, y - 10, w + 8, 14);
      ctx.fillStyle = color; ctx.fillText(txt, x, y);
      ctx.restore();
    }

    function draw(now) {
      if (!model || cw < 2) return;
      const m = model, b = m.b;
      const still = U.reducedMotion();
      const ph = still ? 0.35 : (now / 1700) % 1;
      ctx.clearRect(0, 0, cw, ch);
      const sky = ctx.createLinearGradient(0, 0, 0, ch * 0.66);
      sky.addColorStop(0, '#0a1120'); sky.addColorStop(1, '#101c30');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);

      // ground
      const gy0 = ch * 0.66;
      let gcol;
      if (st.snow) gcol = mix([226, 235, 244], [150, 172, 194], U.sat((st.eps - 1.6) / 4.5));
      else if (st.eps > 45) gcol = mix([70, 74, 66], [12, 80, 112], U.sat((st.eps - 45) / 30));
      else gcol = mix([164, 140, 98], [70, 74, 66], U.sat((st.eps - 3) / 38));
      ctx.beginPath(); ctx.moveTo(0, ch);
      for (let x = 0; x <= cw; x += 3) ctx.lineTo(x, groundY(x));
      ctx.lineTo(cw, groundY(cw)); ctx.lineTo(cw, ch); ctx.closePath();
      ctx.fillStyle = gcol; ctx.fill();
      const shade = ctx.createLinearGradient(0, gy0, 0, ch);
      shade.addColorStop(0, 'rgba(9,13,22,0)'); shade.addColorStop(1, 'rgba(9,13,22,0.62)');
      ctx.fillStyle = shade; ctx.fillRect(0, gy0 - 14, cw, ch - gy0 + 14);
      ctx.beginPath();
      for (let x = 0; x <= cw; x += 3) { const y = groundY(x); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = st.eps > 55 && !st.snow ? 'rgba(160,230,255,0.85)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5; ctx.stroke();
      if (st.snow) {                                     // buried ice layers
        ctx.strokeStyle = 'rgba(70,110,150,' + (0.25 + 0.5 * U.sat(m.p.V)) + ')'; ctx.lineWidth = 1.5;
        for (let k = 0; k < 14; k++) {
          const x = ((k * 61) % (cw - 40)) + 14, y = gy0 + 16 + ((k * 37) % Math.max(20, ch * 0.34 - 26));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y + ((k % 3) - 1) * 2); ctx.stroke();
        }
      }

      // geometry
      const sx = cw * 0.1, sy = ch * 0.12;
      const hx = cw * 0.44, hy = groundY(hx);
      const dx = hx - sx, dy = hy - sy, dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl;

      // stems (trunks, reeds, walls)
      const stemX = cw * 0.66;
      if (st.stems || m.p.D > 0.3) {
        ctx.save();
        ctx.strokeStyle = '#10b981'; ctx.lineCap = 'round';
        for (let k = 0; k < 5; k++) {
          const x = stemX + k * cw * 0.062, y = groundY(x), hgt = ch * (0.3 + 0.07 * ((k * 7) % 3));
          ctx.lineWidth = 3; ctx.globalAlpha = 0.95;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - hgt); ctx.stroke();
          ctx.globalAlpha = 0.28; ctx.fillStyle = '#10b981';
          ctx.beginPath(); ctx.ellipse(x, y - hgt, cw * 0.045, ch * 0.075, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // satellite
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(Math.atan2(uy, ux));
      ctx.fillStyle = '#c9d6e8'; ctx.fillRect(-9, -5, 14, 10);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(-9, -17, 5, 11); ctx.fillRect(-9, 6, 5, 11);
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(12, 0, 9, -1.1, 1.1); ctx.stroke();
      ctx.restore();

      // incident beam
      arrow(sx + ux * 22, sy + uy * 22, hx - ux * 3, hy - uy * 3, '#00f0ff', 2, 0.9);
      pulses(sx + ux * 22, sy + uy * 22, hx, hy, '#9ff7ff', ph, 3, 0.9);

      // transmitted (refracted) ray
      const n = Math.sqrt(Math.max(1, st.eps));
      const sinI = ux, sinT = sinI / n, cosT = Math.sqrt(1 - sinT * sinT);
      const depth = st.snow ? 10 + 64 * U.sat(m.p.V) : U.clamp(120 / (1 + st.eps / 2.2), 5, 62);
      arrow(hx, hy + 2, hx + sinT * depth, hy + 2 + cosT * depth, '#7c8aa5', 1.5, 0.35 + 0.6 * b.transmitted, [3, 4]);

      // specular (mirror) ray
      const spec = U.sat(b.specular / 0.64);
      const sl = 36 + cw * 0.3 * spec;
      arrow(hx, hy, hx + ux * sl, hy - uy * sl, '#8fa3bf', 1.5 + 3 * spec, 0.25 + 0.75 * spec);

      // diffuse fan
      const diff = U.sat(Math.sqrt(b.surface / 0.16));
      const thS = Math.atan2(uy, ux);                       // specular direction above ground: (ux, -uy)
      for (let k = 0; k < 9; k++) {
        const th = Math.PI * (0.1 + 0.8 * (k / 8));         // 18°..162° above the horizon
        const ex = Math.cos(th), ey = -Math.sin(th);
        const align = ex * ux + ey * -uy;                   // closeness to the mirror direction
        const lobe = (1 - m.b.Rm) * Math.pow(Math.max(0, align), 6) + m.b.Rm;
        const L = (10 + 60 * diff) * lobe;
        if (L > 6) arrow(hx, hy, hx + ex * L, hy + ey * L, '#5eead4', 1.2, 0.18 + 0.5 * diff * lobe);
      }
      void thS;

      // volume scatter sparkles
      if (m.p.V > 0.05) {
        ctx.save();
        ctx.fillStyle = '#a78bfa';
        const cnt = Math.round(5 + 16 * U.sat(m.p.V));
        for (let k = 0; k < cnt; k++) {
          const f = (ph + k / cnt) % 1;
          let x, y;
          if (st.snow) { x = hx - 30 + ((k * 53) % 90); y = hy + 12 + ((k * 29) % 46); }
          else { x = stemX - 10 + ((k * 47) % (cw * 0.3)); y = groundY(x) - ch * 0.28 - ((k * 31) % (ch * 0.14)); }
          ctx.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(Math.PI * 2 * f));
          ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // double-bounce path
      const dbl = U.sat(b.dbl / 0.3);
      if (m.p.D > 0.05) {
        const qx = stemX - cw * 0.085, qy = groundY(qx);
        const run = stemX - qx, rise = run * (uy / ux);     // mirror reflection up to the stem
        const tx = stemX, ty = qy - rise;
        const ox = qx - ux * dl * 0.74, oy = qy - uy * dl * 0.74;
        const a = 0.12 + 0.88 * dbl, wdt = 1.2 + 3.2 * dbl;
        arrow(ox, oy, qx - ux * 2, qy - uy * 2, '#00f0ff', 1.4, 0.5 * a + 0.2, [5, 4]);
        arrow(qx, qy, tx - 2, ty, '#f59e0b', wdt, a);
        arrow(tx, ty, tx - ux * dl * 0.7, ty - uy * dl * 0.7, '#f59e0b', wdt, a);
        if (dbl > 0.12) pulses(tx, ty, tx - ux * dl * 0.7, ty - uy * dl * 0.7, '#fcd34d', ph, 2, a);
        label('double-bounce', tx + 8, ty - 6, '#fcd34d');
      }

      // backscatter to the antenna
      const back = U.sat((m.hh + 32) / 30);
      const bw = 1 + 5 * back;
      const off = 9;
      arrow(hx - uy * off - ux * 6, hy + ux * off - uy * 6, sx + ux * 30 - uy * off, sy + uy * 30 + ux * off, '#f59e0b', bw, 0.2 + 0.8 * back);
      pulses(hx - uy * off, hy + ux * off, sx + ux * 30 - uy * off, sy + uy * 30 + ux * off, '#fcd34d', ph, 3, back);

      label('pulse', sx + ux * 60 + 8, sy + uy * 60 - 8, '#9ff7ff');
      label('echo to antenna ' + U.fmt(m.hh, 1) + ' dB', 10, Math.min(gy0 - 26, sy + uy * 78 + 44), '#fcd34d');
      if (spec > 0.2) label('mirrored away', hx + ux * sl + 4, hy - uy * sl - 6, '#b6c4d8', 'center');
      if (diff > 0.3) label('scattered', hx - 6, hy - 22 - 60 * diff, '#5eead4', 'center');
      label(st.snow ? 'into the snowpack' : 'into the ground', hx + sinT * depth + 8, hy + cosT * depth + 4, '#9aa8bf');
    }

    function loop(now) {
      raf = 0;
      if (!visible) return;
      draw(now);
      if (!U.reducedMotion()) raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && visible) raf = requestAnimationFrame(loop); }

    /* ---- wiring ------------------------------------------------------------ */
    PRESETS.forEach((p) => {
      const btn = U.h('button.chip', { type: 'button', 'data-id': p.id, 'aria-pressed': 'false', text: p.label });
      btn.addEventListener('click', () => applyPreset(p));
      elPresets.appendChild(btn);
    });
    function applyPreset(p) {
      st.rough = p.rough; st.eps = p.eps; st.stems = p.stems; st.snow = p.snow;
      st.vOv = p.v != null ? p.v : null; st.dOv = p.d != null ? p.d : null; st.preset = p.id;
      elSource.textContent = 'Preset: ' + p.label;
      syncUi();
    }
    function userEdit() { st.preset = null; st.vOv = null; st.dOv = null; elSource.textContent = 'Custom surface'; }
    elRough.addEventListener('input', () => { userEdit(); st.rough = elRough.value / 100; syncUi(); });
    elEps.addEventListener('input', () => { userEdit(); st.eps = Number(elEps.value); syncUi(); });
    elStems.addEventListener('click', () => { userEdit(); st.stems = !st.stems; if (st.stems) st.snow = false; syncUi(); });
    elSnow.addEventListener('click', () => { userEdit(); st.snow = !st.snow; if (st.snow) { st.stems = false; if (st.eps > 8) st.eps = 1.8; } syncUi(); });

    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    if (window.IntersectionObserver) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0.05 }).observe(canvas);
    }
    resize();
    applyPreset(PRESETS[2]);
    start();

    return {
      refresh: syncUi,
      /** Load a pixel picked on the map. */
      setFromPixel(state, cls) {
        const snowy = /snow|firn|ice|melt pond/i.test(cls) && !/sea ice|mélange/i.test(cls) && state.E < 20;
        st.rough = U.clamp(state.R, 0, 1); st.eps = U.clamp(state.E, 1, 80);
        st.snow = snowy; st.stems = !snowy && (state.D > 0.3 || state.V > 0.3);
        st.vOv = state.V; st.dOv = state.D; st.preset = null;
        elSource.textContent = 'From map pixel: ' + cls;
        syncUi();
      },
    };
  }

  TW.Simulator = Simulator;
})();
