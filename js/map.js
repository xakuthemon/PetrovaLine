/*
 * TerraWaltz — map view.
 * Renders date A and date B of the active scene into off-screen canvases and
 * composites them on screen with a before/after divider, pan / zoom, a pixel
 * probe, a graticule and points of interest.
 */
(function () {
  'use strict';
  const TW = (window.TW = window.TW || {});
  const U = TW.util;
  const { W, H, N, CLASSES } = TW.scenes;
  const R = TW.render;

  function MapView(root, hooks) {
    const stage = root.querySelector('#map-stage');
    const canvas = root.querySelector('#map-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const poiLayer = root.querySelector('#map-pois');
    const swipeEl = root.querySelector('#swipe');
    const handle = root.querySelector('#swipe-handle');
    const chipA = root.querySelector('#chip-a');
    const chipB = root.querySelector('#chip-b');
    const probeEl = root.querySelector('#probe');
    const readout = root.querySelector('#map-readout');
    const scaleBar = root.querySelector('#scale-bar');
    const scaleLabel = root.querySelector('#scale-label');
    const legend = root.querySelector('#map-legend');
    const loading = root.querySelector('#map-loading');

    const offA = document.createElement('canvas'), offB = document.createElement('canvas');
    offA.width = offB.width = W; offA.height = offB.height = H;
    const ctxA = offA.getContext('2d'), ctxB = offB.getContext('2d');
    const imgA = ctxA.createImageData(W, H), imgB = ctxB.createImageData(W, H);
    const SA = TW.scenes.makeState(), SB = TW.scenes.makeState();
    const dbA = new Float32Array(N), dbB = new Float32Array(N);

    let scene = null, caseDef = null;
    let P = { tA: 2020, tB: 2026, mode: 'sar', pol: 'HH', band: 'L', layers: {} };
    let keySA = '', keySB = '', keyIA = '', keyIB = '';
    let skyA = null, skyB = null;
    let cssW = 1, cssH = 1, dpr = 1;
    let view = { s: 1, ox: 0, oy: 0 }, minS = 1;
    let split = 0.5;
    let pois = [];
    let fly = null, raf = 0, needDraw = false;

    /* ---- data → pixels ---------------------------------------------------- */
    function refresh() {
      if (!scene) return;
      const optical = P.mode === 'optical';
      const insar = !optical && P.pol === 'INSAR';
      const kA = scene.id + '|' + P.tA + '|' + (optical ? 'o' : 's');
      const kB = scene.id + '|' + P.tB + '|' + (optical ? 'o' : 's');
      let aChanged = false, bChanged = false;
      if (kA !== keySA) { scene.compute(P.tA, SA, optical, 1); keySA = kA; aChanged = true; }
      if (kB !== keySB) { scene.compute(P.tB, SB, optical, 1); keySB = kB; bChanged = true; }

      const style = optical ? 'opt|' + (P.layers.clouds ? 1 : 0) : (insar ? 'HH' : P.pol) + '|' + P.band;
      const iA = kA + '|' + style;
      if (iA !== keyIA || aChanged) {
        if (optical) skyA = R.optical(scene, SA, P.tA, !!P.layers.clouds, imgA.data);
        else R.sar(scene, SA, insar ? 'HH' : P.pol, P.band, imgA.data, dbA);
        ctxA.putImageData(imgA, 0, 0);
        keyIA = iA;
        aChanged = true;
      }
      const styleB = optical ? style : P.pol + '|' + P.band + '|' + (P.layers.change ? 1 : 0);
      const iB = kB + '|' + styleB + (insar || P.layers.change ? '|' + kA : '');
      if (iB !== keyIB || bChanged || ((insar || P.layers.change) && aChanged)) {
        if (optical) skyB = R.optical(scene, SB, P.tB, !!P.layers.clouds, imgB.data);
        else if (insar) R.insar(scene, SA, SB, P.band, imgB.data, dbB, P.tA, P.tB);
        else {
          R.sar(scene, SB, P.pol, P.band, imgB.data, dbB);
          if (P.layers.change) R.changeOverlay(imgB.data, dbA, dbB);
        }
        ctxB.putImageData(imgB, 0, 0);
        keyIB = iB;
      }
      updateChips();
      updateLegend();
      requestDraw();
    }

    function updateChips() {
      const mA = Math.round((P.tA - U.T0) * 12), mB = (P.tB - U.T0) * 12;
      const insar = P.mode !== 'optical' && P.pol === 'INSAR';
      chipA.querySelector('.chip-date').textContent = U.monthLabel(mA);
      chipB.querySelector('.chip-date').textContent = U.monthLabel(Math.floor(mB + 1e-6));
      chipA.querySelector('.chip-kind').textContent = insar ? 'Reference amplitude' : P.mode === 'optical' ? 'Optical' : 'SAR ' + P.pol;
      chipB.querySelector('.chip-kind').textContent = insar
        ? (scene.insar === 'repeat12' ? 'Interferogram · 12-day pair' : 'Interferogram A → B')
        : P.mode === 'optical' ? 'Optical' : 'SAR ' + P.pol;
    }

    function updateLegend() {
      legend.textContent = '';
      const h = U.h;
      if (P.mode === 'optical') {
        const sk = skyB || { cover: 0, light: 1, smoke: 0 };
        const bits = [];
        if (sk.light < 0.05) bits.push('polar night · no sunlight');
        else if (sk.light < 0.95) bits.push('twilight');
        if (P.layers.clouds) {
          bits.push('cloud cover ' + Math.round(sk.cover * 100) + ' %');
          if (sk.smoke > 0.2) bits.push('smoke haze');
        } else bits.push('clouds removed · ideal clear sky');
        legend.appendChild(h('div.lg-title', { text: 'Optical · reflected sunlight' }));
        legend.appendChild(h('div.lg-sub', { text: bits.join(' · ') }));
        return;
      }
      if (P.pol === 'INSAR') {
        const b = TW.physics.BANDS[P.band];
        const stops = [];
        for (let k = 0; k <= 12; k++) {
          const q = Math.min(255, Math.round((k / 12) * 255)) * 3;
          stops.push('rgb(' + R.RAINBOW[q] + ',' + R.RAINBOW[q + 1] + ',' + R.RAINBOW[q + 2] + ') ' + ((k / 12) * 100).toFixed(1) + '%');
        }
        legend.appendChild(h('div.lg-title', { text: 'Wrapped phase · one cycle = ' + b.fringe + ' cm line-of-sight' }));
        legend.appendChild(h('div.lg-bar', { style: 'background:linear-gradient(90deg,' + stops.join(',') + ')' }));
        legend.appendChild(h('div.lg-ticks', null, h('span', { text: '0' }), h('span', { text: 'λ/4' }), h('span', { text: 'λ/2 = ' + b.fringe + ' cm' })));
        legend.appendChild(h('div.lg-sub', { text: 'Grey = decorrelated (no usable phase)' }));
        return;
      }
      if (P.pol === 'RGB') {
        legend.appendChild(h('div.lg-title', { text: 'Polarimetric composite' }));
        legend.appendChild(h('div.lg-chips', null,
          h('span.lg-chip', null, h('i', { style: 'background:#ff5a6e' }), 'HH'),
          h('span.lg-chip', null, h('i', { style: 'background:#4ade80' }), 'HV'),
          h('span.lg-chip', null, h('i', { style: 'background:#60a5fa' }), 'VV')));
      } else {
        const pd = R.POL[P.pol];
        legend.appendChild(h('div.lg-title', { text: 'Backscatter σ⁰ ' + P.pol + ' · ' + TW.physics.BANDS[P.band].name }));
        legend.appendChild(h('div.lg-bar', { style: 'background:linear-gradient(90deg,#000,rgb(' + Math.round(255 * pd.tint[0]) + ',' + Math.round(255 * pd.tint[1]) + ',' + Math.round(255 * pd.tint[2]) + '))' }));
        legend.appendChild(h('div.lg-ticks', null, h('span', { text: pd.lo + ' dB' }), h('span', { text: 'weak → strong return' }), h('span', { text: pd.hi + ' dB' })));
      }
      if (P.layers.change) {
        legend.appendChild(h('div.lg-chips', null,
          h('span.lg-chip', null, h('i', { style: 'background:#00f0ff' }), 'brighter since A'),
          h('span.lg-chip', null, h('i', { style: 'background:#f59e0b' }), 'darker since A')));
      }
    }

    /* ---- view transform ---------------------------------------------------- */
    function resize() {
      const r = stage.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const oldCx = (cssW / 2 - view.ox) / view.s, oldCy = (cssH / 2 - view.oy) / view.s;
      const rel = view.s / minS;
      cssW = r.width; cssH = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      minS = Math.max(cssW / W, cssH / H);
      view.s = minS * (isFinite(rel) && rel >= 1 ? rel : 1);
      view.ox = cssW / 2 - oldCx * view.s; view.oy = cssH / 2 - oldCy * view.s;
      if (!isFinite(view.ox)) { view.ox = (cssW - W * view.s) / 2; view.oy = (cssH - H * view.s) / 2; }
      clampView();
      requestDraw();
    }
    function clampView() {
      view.s = U.clamp(view.s, minS, minS * 8);
      view.ox = U.clamp(view.ox, cssW - W * view.s, 0);
      view.oy = U.clamp(view.oy, cssH - H * view.s, 0);
    }
    function zoomAt(px, py, factor) {
      const s2 = U.clamp(view.s * factor, minS, minS * 8);
      const k = s2 / view.s;
      view.ox = px - (px - view.ox) * k; view.oy = py - (py - view.oy) * k; view.s = s2;
      clampView();
      requestDraw();
    }
    function flyTo(u, v, zoom) {
      const s2 = minS * U.clamp(zoom || 1, 1, 8);
      const target = { s: s2, ox: cssW / 2 - u * W * s2, oy: cssH / 2 - v * H * s2 };
      target.ox = U.clamp(target.ox, cssW - W * s2, 0);
      target.oy = U.clamp(target.oy, cssH - H * s2, 0);
      if (U.reducedMotion()) { view = target; fly = null; requestDraw(); return; }
      fly = { from: { s: view.s, ox: view.ox, oy: view.oy }, to: target, t0: performance.now(), dur: 700 };
      requestDraw();
    }

    /* ---- drawing ----------------------------------------------------------- */
    function requestDraw() {
      needDraw = true;
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      raf = 0;
      if (fly) {
        let k = (now - fly.t0) / fly.dur;
        if (k >= 1) { view = { s: fly.to.s, ox: fly.to.ox, oy: fly.to.oy }; fly = null; }
        else {
          k = k < 0 ? 0 : k;
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          // interpolate the scene-space centre and the zoom so the motion reads as one move
          const s = fly.from.s * Math.pow(fly.to.s / fly.from.s, e);
          const c0x = (cssW / 2 - fly.from.ox) / fly.from.s, c0y = (cssH / 2 - fly.from.oy) / fly.from.s;
          const c1x = (cssW / 2 - fly.to.ox) / fly.to.s, c1y = (cssH / 2 - fly.to.oy) / fly.to.s;
          view.s = s;
          view.ox = cssW / 2 - (c0x + (c1x - c0x) * e) * s;
          view.oy = cssH / 2 - (c0y + (c1y - c0y) * e) * s;
          clampView();
          needDraw = true;
        }
      }
      if (needDraw) { needDraw = false; draw(); }
      if (fly && !raf) raf = requestAnimationFrame(frame);
    }

    function draw() {
      if (!scene) return;
      const sx = Math.round(split * cssW);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = view.s < 4;
      ctx.imageSmoothingQuality = 'high';
      const dw = W * view.s, dh = H * view.s;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, cssH); ctx.clip();
      ctx.drawImage(offA, view.ox, view.oy, dw, dh); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, cssW - sx, cssH); ctx.clip();
      ctx.drawImage(offB, view.ox, view.oy, dw, dh); ctx.restore();

      if (P.layers.grid) drawGraticule();
      if (P.layers.roi) drawRoi();

      swipeEl.style.transform = 'translateX(' + sx + 'px)';
      positionPois();
      updateScale();
    }

    function niceStep(span, target) {
      const raw = span / target;
      const steps = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
      for (let k = 0; k < steps.length; k++) if (steps[k] >= raw) return steps[k];
      return 1;
    }
    function drawGraticule() {
      const b = scene.bounds;
      const lonAt = (px) => b.west + ((px - view.ox) / (W * view.s)) * (b.east - b.west);
      const latAt = (py) => b.north - ((py - view.oy) / (H * view.s)) * (b.north - b.south);
      const lon0 = lonAt(0), lon1 = lonAt(cssW), lat0 = latAt(0), lat1 = latAt(cssH);
      const st = niceStep(lon1 - lon0, 5), dg = st < 0.02 ? 3 : 2;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,240,255,0.16)';
      ctx.fillStyle = 'rgba(190,235,245,0.85)';
      ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3;
      ctx.beginPath();
      for (let lon = Math.ceil(lon0 / st) * st; lon < lon1; lon += st) {
        const x = Math.round(((lon - b.west) / (b.east - b.west)) * W * view.s + view.ox) + 0.5;
        ctx.moveTo(x, 0); ctx.lineTo(x, cssH);
        ctx.fillText(Math.abs(lon).toFixed(dg) + '°' + (lon < 0 ? 'W' : 'E'), x + 4, 13);
      }
      for (let lat = Math.ceil(lat1 / st) * st; lat < lat0; lat += st) {
        const y = Math.round(((b.north - lat) / (b.north - b.south)) * H * view.s + view.oy) + 0.5;
        ctx.moveTo(0, y); ctx.lineTo(cssW, y);
        if (y > 118 && y < cssH - 72) ctx.fillText(Math.abs(lat).toFixed(dg) + '°' + (lat < 0 ? 'S' : 'N'), cssW - 58, y - 4);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    function drawRoi() {
      const r = scene.roi;
      const x = r.x0 * view.s + view.ox, y = r.y0 * view.s + view.oy;
      const w = (r.x1 - r.x0) * view.s, hh = (r.y1 - r.y0) * view.s;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeRect(x + 1, y + 1, w, hh);
      ctx.strokeStyle = '#00f0ff'; ctx.strokeRect(x, y, w, hh);
      ctx.setLineDash([]);
      ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 4;
      ctx.fillStyle = '#9ff7ff';
      ctx.fillText('CHART SAMPLE AREA', x + 2, y - 5);
      ctx.shadowBlur = 0;
    }

    function updateScale() {
      const kmPerPx = scene.widthKm / (W * view.s);
      const opts = [0.25, 0.5, 1, 2, 5, 10, 20];
      let L = opts[0];
      for (let k = 0; k < opts.length; k++) { L = opts[k]; if (opts[k] / kmPerPx >= 64) break; }
      scaleBar.style.width = Math.round(L / kmPerPx) + 'px';
      scaleLabel.textContent = (L < 1 ? L * 1000 + ' m' : L + ' km');
    }

    /* ---- points of interest ------------------------------------------------ */
    function buildPois() {
      poiLayer.textContent = '';
      pois = [];
      if (!caseDef) return;
      caseDef.pois.forEach((p) => {
        const a = scene.anchors[p.anchor];
        if (!a) return;
        const el = U.h('button.poi', { type: 'button', 'aria-label': p.label + '. ' + p.note },
          U.h('span.poi-dot'), U.h('span.poi-label', { text: p.label }), U.h('span.poi-note', { text: p.note }));
        el.addEventListener('click', () => flyTo(a[0], a[1], Math.max(2.2, view.s / minS)));
        poiLayer.appendChild(el);
        pois.push({ el, u: a[0], v: a[1] });
      });
      positionPois();
    }
    function positionPois() {
      const show = !!P.layers.labels;
      poiLayer.hidden = !show;
      if (!show) return;
      for (let k = 0; k < pois.length; k++) {
        const p = pois[k];
        const x = p.u * W * view.s + view.ox, y = p.v * H * view.s + view.oy;
        const vis = x > 8 && x < cssW - 8 && y > 8 && y < cssH - 8;
        p.el.style.display = vis ? '' : 'none';
        if (vis) {
          p.el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
          p.el.classList.toggle('flip', x > cssW - 190);
          p.el.classList.toggle('up', y > cssH - 120);
        }
      }
    }

    /* ---- probe ------------------------------------------------------------- */
    function infoAt(px, py) {
      const x = Math.floor((px - view.ox) / view.s), y = Math.floor((py - view.oy) / view.s);
      if (x < 0 || y < 0 || x >= W || y >= H) return null;
      const i = y * W + x, b = scene.bounds;
      const side = px < split * cssW ? 'A' : 'B';
      const S = side === 'A' ? SA : SB;
      const out = {
        x, y, i, side,
        lat: b.north - ((y + 0.5) / H) * (b.north - b.south),
        lon: b.west + ((x + 0.5) / W) * (b.east - b.west),
        cls: CLASSES[S.K[i]] || 'Surface', clsA: CLASSES[SA.K[i]], clsB: CLASSES[SB.K[i]],
        sA: R.expected(scene, SA, i, P.band), sB: R.expected(scene, SB, i, P.band),
        state: { R: S.R[i], E: S.E[i], V: S.V[i], D: S.D[i] },
        disp: R.pairDisplacement(scene, SA, SB, i),
        coh: R.pairCoherence(scene, SA, SB, i, P.band === 'S', Math.abs(P.tB - P.tA)),
        cloud: P.mode === 'optical' && P.layers.clouds ? R.cloudAlpha(scene, x, y, side === 'A' ? P.tA : P.tB) : 0,
        light: P.mode === 'optical' ? (side === 'A' ? skyA : skyB).light : 1,
      };
      return out;
    }
    const coord = (lat, lon) =>
      Math.abs(lat).toFixed(3) + '°' + (lat < 0 ? 'S' : 'N') + '  ' + Math.abs(lon).toFixed(3) + '°' + (lon < 0 ? 'W' : 'E');

    function showProbe(px, py) {
      const inf = infoAt(px, py);
      if (!inf) { hideProbe(); return; }
      const h = U.h;
      probeEl.textContent = '';
      readout.textContent = coord(inf.lat, inf.lon);
      const dateTxt = inf.side + ' · ' + (inf.side === 'A' ? chipA : chipB).querySelector('.chip-date').textContent;
      probeEl.appendChild(h('div.pr-head', null, h('span.pr-side', { text: dateTxt }), h('span.pr-coord', { text: coord(inf.lat, inf.lon) })));
      if (P.mode === 'optical') {
        let txt = inf.cls, sub = 'Radar would see: ' + inf.cls.toLowerCase();
        if (inf.light < 0.05) txt = 'Darkness · no sunlight to reflect';
        else if (inf.cloud > 0.5) txt = 'Cloud · surface hidden';
        else if (inf.cloud > 0.15) txt = 'Thin cloud · surface blurred';
        else sub = 'Clear view on this pass';
        probeEl.appendChild(h('div.pr-class', { text: txt }));
        probeEl.appendChild(h('div.pr-sub', { text: sub }));
      } else if (P.pol === 'INSAR') {
        probeEl.appendChild(h('div.pr-class', { text: inf.clsB }));
        if (inf.side === 'A') {
          probeEl.appendChild(h('div.pr-row', null, h('span', { text: 'σ⁰ HH (reference)' }), h('b', { text: U.fmt(inf.sA.HH, 1) + ' dB' })));
        } else {
          const usable = inf.coh > 0.3;
          probeEl.appendChild(h('div.pr-row', null, h('span', { text: 'LOS displacement' }), h('b', { text: usable ? U.fmtSigned(inf.disp, 1) + ' cm' : 'not measurable' })));
          probeEl.appendChild(h('div.pr-row', null, h('span', { text: 'Coherence' }), h('b', { text: U.fmt(inf.coh, 2) + (usable ? '' : ' · decorrelated') })));
          if (usable) {
            const fr = Math.abs(inf.disp) / TW.physics.BANDS[P.band].fringe;
            probeEl.appendChild(h('div.pr-sub', { text: '= ' + U.fmt(fr, 1) + ' colour cycles at ' + TW.physics.BANDS[P.band].name }));
          }
        }
      } else {
        const pol = P.pol === 'RGB' ? 'HH' : P.pol;
        const a = inf.sA[pol], b = inf.sB[pol];
        probeEl.appendChild(h('div.pr-class', { text: inf.cls }));
        if (P.pol === 'RGB') {
          const s = inf.side === 'A' ? inf.sA : inf.sB;
          ['HH', 'HV', 'VV'].forEach((k) => probeEl.appendChild(h('div.pr-row', null, h('span', { text: 'σ⁰ ' + k }), h('b', { text: U.fmt(s[k], 1) + ' dB' }))));
        } else {
          probeEl.appendChild(h('div.pr-row', null, h('span', { text: 'σ⁰ ' + pol + ' at A' }), h('b', { text: U.fmt(a, 1) + ' dB' })));
          probeEl.appendChild(h('div.pr-row', null, h('span', { text: 'σ⁰ ' + pol + ' at B' }), h('b', { text: U.fmt(b, 1) + ' dB' })));
          probeEl.appendChild(h('div.pr-row.pr-delta', null, h('span', { text: 'Change A → B' }), h('b', { text: U.fmtSigned(b - a, 1) + ' dB' })));
        }
        if (inf.clsA !== inf.clsB) probeEl.appendChild(h('div.pr-sub', { text: 'Was: ' + inf.clsA.toLowerCase() }));
      }
      probeEl.appendChild(h('div.pr-hint', { text: 'Click to send this pixel to the Physics Decoder' }));
      probeEl.hidden = false;
      const pw = probeEl.offsetWidth, ph = probeEl.offsetHeight;
      let lx = px + 16, ly = py + 16;
      if (lx + pw > cssW - 8) lx = px - pw - 16;
      if (ly + ph > cssH - 8) ly = py - ph - 16;
      probeEl.style.transform = 'translate(' + Math.max(8, lx) + 'px,' + Math.max(8, ly) + 'px)';
    }
    function hideProbe() { probeEl.hidden = true; readout.textContent = caseDef ? caseDef.place.split(' · ')[0] : ''; }

    /* ---- interaction ------------------------------------------------------- */
    const pointers = new Map();
    let drag = null, pinch = null;
    const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      const [x, y] = local(e);
      pointers.set(e.pointerId, [x, y]);
      fly = null;
      if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        pinch = { d: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) };
        drag = null;
      } else drag = { x, y, ox: view.ox, oy: view.oy, moved: false };
    });
    canvas.addEventListener('pointermove', (e) => {
      const [x, y] = local(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [x, y]);
      if (pinch && pointers.size === 2) {
        const pts = Array.from(pointers.values());
        const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        zoomAt((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, d / (pinch.d || d));
        pinch.d = d;
        return;
      }
      if (drag) {
        const dx = x - drag.x, dy = y - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved) {
          view.ox = drag.ox + dx; view.oy = drag.oy + dy;
          clampView(); hideProbe(); requestDraw();
          stage.classList.add('panning');
        }
        return;
      }
      if (e.pointerType !== 'touch') showProbe(x, y);
    });
    function endPointer(e) {
      const [x, y] = local(e);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && !drag.moved && e.type === 'pointerup') {
        const inf = infoAt(x, y);
        if (inf) { if (e.pointerType === 'touch') showProbe(x, y); if (hooks.onPick) hooks.onPick(inf); }
      }
      drag = null;
      stage.classList.remove('panning');
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', () => { if (!drag) hideProbe(); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [x, y] = local(e);
      fly = null;
      zoomAt(x, y, Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });
    canvas.addEventListener('dblclick', (e) => { const [x, y] = local(e); zoomAt(x, y, 1.8); });

    // before / after divider
    function setSplit(v, silent) {
      split = U.clamp(v, 0.02, 0.98);
      handle.setAttribute('aria-valuenow', Math.round(split * 100));
      requestDraw();
      if (!silent && hooks.onSplit) hooks.onSplit(split);
    }
    let sw = false;
    swipeEl.addEventListener('pointerdown', (e) => { sw = true; swipeEl.setPointerCapture(e.pointerId); stage.classList.add('swiping'); e.preventDefault(); });
    swipeEl.addEventListener('pointermove', (e) => { if (sw) setSplit(local(e)[0] / cssW); });
    const swEnd = () => { sw = false; stage.classList.remove('swiping'); };
    swipeEl.addEventListener('pointerup', swEnd);
    swipeEl.addEventListener('pointercancel', swEnd);
    swipeEl.addEventListener('dblclick', () => setSplit(0.5));
    handle.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.1 : 0.02;
      if (e.key === 'ArrowLeft') { setSplit(split - step); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setSplit(split + step); e.preventDefault(); }
      else if (e.key === 'Home') { setSplit(0.02); e.preventDefault(); }
      else if (e.key === 'End') { setSplit(0.98); e.preventDefault(); }
    });

    root.querySelector('#zoom-in').addEventListener('click', () => zoomAt(cssW / 2, cssH / 2, 1.5));
    root.querySelector('#zoom-out').addEventListener('click', () => zoomAt(cssW / 2, cssH / 2, 1 / 1.5));
    root.querySelector('#zoom-reset').addEventListener('click', () => flyTo(0.5, 0.5, 1));

    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    window.addEventListener('resize', resize);

    /* ---- public API -------------------------------------------------------- */
    return {
      setCase(def) {
        loading.hidden = false;
        caseDef = def;
        scene = TW.scenes.getScene(def.id);
        keySA = keySB = keyIA = keyIB = '';
        resize();
        view.s = minS; view.ox = (cssW - W * minS) / 2; view.oy = (cssH - H * minS) / 2;
        buildPois();
        hideProbe();
        loading.hidden = true;
        return scene;
      },
      update(params) { P = params; refresh(); },
      setSplit(v) { setSplit(v, true); },
      getSplit: () => split,
      flyTo,
      focusAnchor(name, zoom) { const a = scene && scene.anchors[name]; if (a) flyTo(a[0], a[1], zoom || 1); },
      resize,
      stats: () => ({ cssW, cssH, scale: view.s / minS }),
    };
  }

  TW.MapView = MapView;
})();
