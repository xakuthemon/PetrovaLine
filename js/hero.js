/*
 * TerraWaltz — spacecraft hero: scroll-linked stations, CAD-style callouts,
 * pointer parallax and drag, and the editorial index below it.
 */
(function () {
  'use strict';
  const TW = (window.TW = window.TW || {});
  const U = TW.util, h = U.h;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const PARTS = [
    { id: 'reflector', code: 'A1', name: '12 m mesh reflector', spec: 'Gold-plated molybdenum wire mesh on a drum truss', dx: 84, dy: -58 },
    { id: 'boom', code: 'A2', name: '9 m deployed boom', spec: 'Carbon-fibre truss · two hinged segments', dx: -88, dy: -34 },
    { id: 'gps', code: 'A3', name: 'GPS antenna', spec: 'Orbit knowledge for interferometry', dx: -72, dy: -52 },
    { id: 'feed', code: 'B1', name: 'L / S-band feed aperture', spec: 'L 1.25 GHz · S 3.2 GHz · illuminates the reflector', dx: 92, dy: 46 },
    { id: 'ris', code: 'B2', name: 'Radar instrument structure', spec: 'L- and S-band electronics housing', dx: -96, dy: 30 },
    { id: 'bus', code: 'C1', name: 'I3K spacecraft bus', spec: 'ISRO I-3K platform under gold MLI foil', dx: 86, dy: 62 },
    { id: 'solar', code: 'C2', name: 'Solar arrays', spec: 'Two deployed photovoltaic wings', dx: 74, dy: -44 },
  ];
  const GEO = [
    { id: 'aktau', name: 'Aktau' },
    { id: 'karakol', name: 'Lake Karakol' },
    { id: 'sea', name: 'Caspian Sea' },
  ];
  const STATIONS = [
    { name: 'Overview', part: null },
    { name: 'Reflector', part: 'reflector' },
    { name: 'Feed', part: 'feed' },
    { name: 'Swath', part: null },
  ];
  const CARD_W = 214;

  function Hero(root, hooks) {
    const scroller = root, hero = $('#hero', root), stage = $('#hero-stage', root), canvas = $('#hero-canvas', root);
    const layer = $('#co-layer', root), lines = $('#co-lines', root);
    const hudStation = $('#hud-station', root), hudLook = $('#hud-look', root);
    let station = -1, manual = null, hover = null, listHover = null, shown = false, lastProg = 0;
    let cos = [], geos = [];
    const craft = TW.Spacecraft(canvas, { onFrame });

    if (!craft.ok) stage.classList.add('no-webgl');   // the copy still follows the scroll; a schematic stands in for the model

    /* ---- callouts ---------------------------------------------------------- */
    const NS = 'http://www.w3.org/2000/svg';
    cos = PARTS.map((p) => {
      const btn = h('button.co', { type: 'button', 'data-id': p.id, 'aria-label': p.name + '. ' + p.spec },
        h('i.co-pin'),
        h('span.co-card', null, h('span.co-code', { text: p.code }), h('span.co-name', { text: p.name }), h('span.co-spec', { text: p.spec })));
      const pl = document.createElementNS(NS, 'polyline');
      lines.appendChild(pl);
      layer.appendChild(btn);
      btn.addEventListener('pointerenter', () => { manual = p.id; sync(); });
      btn.addEventListener('pointerleave', () => { manual = null; sync(); });
      btn.addEventListener('focus', () => { manual = p.id; sync(); });
      btn.addEventListener('blur', () => { manual = null; sync(); });
      return { p, btn, pl, card: btn.querySelector('.co-card'), on: false };
    });
    geos = GEO.map((g) => {
      const el = h('span.geo', null, h('i'), g.name);
      layer.appendChild(el);
      return { g, el };
    });

    function active() { return manual || listHover || hover || (STATIONS[station] && STATIONS[station].part); }
    function sync() {
      const a = active();
      cos.forEach((c) => {
        const on = c.p.id === a;
        if (on !== c.on) { c.on = on; c.btn.classList.toggle('on', on); c.pl.classList.toggle('on', on); }
      });
      $$('.sub-list button', root).forEach((b) => b.classList.toggle('on', b.dataset.id === a));
    }

    function onFrame(prog) {
      lastProg = prog;
      const sz = craft.size();
      lines.setAttribute('viewBox', '0 0 ' + sz.w + ' ' + sz.h);
      const craftVis = 1 - U.smooth(2.25, 2.8, prog);
      layer.style.setProperty('--craft', craftVis.toFixed(3));
      layer.classList.toggle('far', prog > 2.55);
      cos.forEach((c) => {
        const s = craft.project(c.p.id);
        if (!s || !s.front) { c.btn.style.display = 'none'; c.pl.style.display = 'none'; return; }
        c.btn.style.display = ''; c.pl.style.display = '';
        let side = c.p.dx > 0 ? 1 : -1;
        const ax = Math.abs(c.p.dx), ay = c.p.dy;
        if (side > 0 && s.x + ax + CARD_W > sz.w - 8) side = -1;
        else if (side < 0 && s.x - ax - CARD_W < 8) side = 1;
        const x = Math.round(s.x), y = Math.round(s.y);
        c.btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        // keep the card inside the stage, then run the leader to whichever edge faces the pin
        const cardX = U.clamp(side > 0 ? x + ax + 8 : x - ax - 8 - CARD_W, 8, Math.max(8, sz.w - CARD_W - 8));
        const cardY = U.clamp(y + ay - 22, 36, Math.max(36, sz.h - 96));
        c.card.style.transform = 'translate(' + (cardX - x) + 'px,' + (cardY - y) + 'px)';
        if (c.on) {
          const ly = cardY + 22, endX = side > 0 ? cardX - 4 : cardX + CARD_W + 4;
          const kx = x + side * Math.min(Math.abs(ly - y), Math.abs(endX - x));
          c.pl.setAttribute('points', x + ',' + y + ' ' + kx + ',' + ly + ' ' + endX + ',' + ly);
        }
      });
      const geoVis = U.smooth(2.35, 2.9, prog);
      geos.forEach((o) => {
        const s = craft.project(o.g.id);
        if (!s || !s.front || geoVis < 0.01) { o.el.style.display = 'none'; return; }
        o.el.style.display = '';
        o.el.style.opacity = geoVis.toFixed(3);
        o.el.style.transform = 'translate(' + Math.round(s.x) + 'px,' + Math.round(s.y) + 'px)';
      });
    }

    /* ---- stations ---------------------------------------------------------- */
    function setStation(i) {
      if (i === station) return;
      station = i;
      $$('.hero-panel', root).forEach((p, k) => {
        const on = k === i;
        p.classList.toggle('on', on);
        if (on) p.removeAttribute('inert'); else p.setAttribute('inert', '');
      });
      $$('.hero-rail button', root).forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      hudStation.textContent = 'Station ' + String(i + 1).padStart(2, '0') + ' / 04 · ' + STATIONS[i].name;
      stage.dataset.station = String(i);
      sync();
    }
    const fit = () => { if (scroller.clientHeight > 0) scroller.style.setProperty('--view-h', scroller.clientHeight + 'px'); };
    const span = () => Math.max(1, hero.offsetHeight - scroller.clientHeight);
    function onScroll() {
      const top = scroller.scrollTop;
      const p = U.clamp(top / span(), 0, 1) * 3;
      setStation(Math.round(p));
      if (!craft.ok) return;
      craft.setProgress(p);
      if (shown && top < hero.offsetHeight - 40) craft.start(); else craft.stop();
    }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    $$('.hero-rail button', root).forEach((b, k) => b.addEventListener('click', () => {
      scroller.scrollTo({ top: (k / 3) * span(), behavior: U.reducedMotion() ? 'auto' : 'smooth' });
    }));
    $$('[data-scroll]', root).forEach((b) => b.addEventListener('click', () => {
      const t = $('#' + b.dataset.scroll, root);
      if (t) scroller.scrollTo({ top: t.offsetTop, behavior: U.reducedMotion() ? 'auto' : 'smooth' });
    }));

    /* ---- subsystem list (keyboard and pointer equivalent of the pins) ------ */
    const list = $('#sub-list', root);
    PARTS.forEach((p) => {
      const b = h('button', { type: 'button', 'data-id': p.id }, h('span.sub-code', { text: p.code }), h('span.sub-name', { text: p.name }));
      const on = () => { listHover = p.id; sync(); }, offFn = () => { listHover = null; sync(); };
      b.addEventListener('pointerenter', on); b.addEventListener('pointerleave', offFn);
      b.addEventListener('focus', on); b.addEventListener('blur', offFn);
      list.appendChild(h('li', null, b));
    });

    /* ---- pointer: parallax, hover pick, drag ------------------------------- */
    if (craft.ok) {
      let dragging = null, pickQueued = false, lastEvt = null;
      const ndc = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)]; };
      stage.addEventListener('pointermove', (e) => {
        const [nx, ny] = ndc(e);
        if (dragging) {
          craft.drag(e.clientX - dragging.x, e.clientY - dragging.y);
          dragging.x = e.clientX; dragging.y = e.clientY;
          return;
        }
        if (e.pointerType === 'touch') return;
        craft.setPointer(nx, ny);
        lastEvt = [nx, ny];
        if (!pickQueued && e.target === canvas) {
          pickQueued = true;
          requestAnimationFrame(() => {
            pickQueued = false;
            const part = lastProg < 2.5 ? craft.pick(lastEvt[0], lastEvt[1]) : null;
            if (part !== hover) { hover = part; canvas.style.cursor = part ? 'pointer' : ''; sync(); }
          });
        }
      });
      stage.addEventListener('pointerleave', () => { craft.setPointer(0, 0); if (hover) { hover = null; sync(); } });
      canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        dragging = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
        stage.classList.add('dragging');
      });
      const end = () => { dragging = null; stage.classList.remove('dragging'); };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      if (window.ResizeObserver) new ResizeObserver(() => craft.resize()).observe(stage);
      window.addEventListener('resize', () => craft.resize());
      hudLook.textContent = 'Look ' + U.fmt(craft.lookAngle, 1) + '°';
    }

    $$('[data-open-case]', root).forEach((el) => el.addEventListener('click', () => hooks.openCase(Number(el.dataset.openCase))));
    $$('[data-open-console]', root).forEach((el) => el.addEventListener('click', () => hooks.openCase(null)));
    $$('[data-open-why]', root).forEach((el) => el.addEventListener('click', () => hooks.openWhy()));

    window.addEventListener('resize', () => { fit(); onScroll(); });
    setStation(0);

    return {
      show() { shown = true; fit(); if (craft.ok) craft.resize(); onScroll(); },
      hide() { shown = false; if (craft.ok) craft.stop(); },
      ok: craft.ok,
    };
  }

  TW.Hero = Hero;
})();
