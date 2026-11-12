/*
 * TerraWaltz — synchronized time-series charts (SVG small multiples).
 * Three stacked charts share the 2020–2026 time axis, a playhead tied to the
 * map timeline, a hover crosshair, and click / drag scrubbing.
 */
(function () {
  'use strict';
  const TW = (window.TW = window.TW || {});
  const U = TW.util;
  const NS = 'http://www.w3.org/2000/svg';

  // Validated on the panel surface (#111827): see README, "Chart colours".
  const COLORS = {
    back: ['#0FA3BD', '#8F7FEF'],
    area: ['#0FA573', '#C2842A'],
    disp: ['#8F7FEF'],
  };
  const ORDER = ['back', 'area', 'disp'];
  const M = { l: 40, r: 14, t: 10, b: 18 };
  const PH = 112;

  function svg(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function niceTicks(lo, hi, n) {
    const span = hi - lo || 1;
    const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    const t0 = Math.floor(lo / step) * step, t1 = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = t0; v <= t1 + step * 0.01; v += step) ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    return { ticks, lo: t0, hi: t1, step };
  }
  const tickFmt = (v, step) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(step < 1 ? 1 : 0);

  function Charts(root, hooks) {
    const host = root.querySelector('#charts');
    const tip = root.querySelector('#chart-tip');
    const tableHost = root.querySelector('#chart-table');
    let def = null, data = null, events = [];
    let plots = [];
    let width = 0, curM = 0, baseM = 0;

    function build() {
      host.textContent = '';
      plots = [];
      if (!def) return;
      width = Math.max(260, Math.floor(host.getBoundingClientRect().width));
      const pw = width - M.l - M.r, ph = PH - M.t - M.b;
      const xOf = (m) => M.l + (m / U.M_MAX) * pw;

      ORDER.forEach((key, ci) => {
        const cd = def.charts[key];
        const series = cd.series.map((s, k) => ({ name: s.name, color: COLORS[key][k], v: data[s.key] }));
        let lo = Infinity, hi = -Infinity;
        series.forEach((s) => s.v.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; }));
        if (key !== 'back') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
        const pad = (hi - lo) * 0.08 || 1;
        const nt = niceTicks(lo - (key === 'back' ? pad : 0), hi + (key === 'back' ? pad : 0), 3);
        const yOf = (v) => M.t + (1 - (v - nt.lo) / (nt.hi - nt.lo)) * ph;

        const fig = U.h('figure.chart');
        const vals = U.h('div.ch-vals');
        const valEls = series.map((s) => {
          const b = U.h('b', { text: '–' });
          vals.appendChild(U.h('span.ch-val', null, U.h('i.ch-key', { style: 'background:' + s.color }),
            U.h('span.ch-name', { text: s.name }), b, U.h('span.ch-unit', { text: cd.unit })));
          return b;
        });
        fig.appendChild(U.h('figcaption', null, U.h('span.ch-title', { text: cd.title }), vals));

        const el = svg('svg', { width, height: PH, viewBox: '0 0 ' + width + ' ' + PH, role: 'img',
          'aria-label': cd.title + ', ' + cd.unit + ', monthly from January 2020 to September 2026' });
        // grid + y ticks
        nt.ticks.forEach((v) => {
          const y = Math.round(yOf(v)) + 0.5;
          el.appendChild(svg('line', { x1: M.l, x2: width - M.r, y1: y, y2: y, class: v === 0 && key !== 'back' ? 'ch-zero' : 'ch-grid' }));
          const tx = svg('text', { x: M.l - 6, y: y + 3.5, class: 'ch-tick', 'text-anchor': 'end' });
          tx.textContent = tickFmt(v, nt.step);
          el.appendChild(tx);
        });
        // x ticks (years)
        for (let yr = 0; yr <= 6; yr++) {
          const x = Math.round(xOf(yr * 12)) + 0.5;
          el.appendChild(svg('line', { x1: x, x2: x, y1: M.t, y2: PH - M.b, class: 'ch-grid ch-grid-x' }));
          const tx = svg('text', { x: x + (yr === 0 ? 0 : 0), y: PH - 4, class: 'ch-tick', 'text-anchor': yr === 0 ? 'start' : 'middle' });
          tx.textContent = String(2020 + yr);
          el.appendChild(tx);
        }
        // events
        events.forEach((ev) => {
          const x = Math.round(xOf(ev.m)) + 0.5;
          const g = svg('g', { class: 'ch-event' + (ev.kind === 'mission' ? ' mission' : '') });
          g.appendChild(svg('line', { x1: x, x2: x, y1: M.t, y2: PH - M.b }));
          g.appendChild(svg('path', { d: 'M' + (x - 3.5) + ' ' + (M.t - 1) + 'h7l-3.5 5z' }));
          const t = svg('title'); t.textContent = ev.label; g.appendChild(t);
          el.appendChild(g);
        });
        // series
        series.forEach((s, k) => {
          let d = '';
          s.v.forEach((v, m) => { d += (m ? 'L' : 'M') + xOf(m).toFixed(1) + ' ' + yOf(v).toFixed(1); });
          if (series.length === 1) {
            const base = yOf(Math.max(nt.lo, Math.min(nt.hi, 0)));
            el.appendChild(svg('path', { d: d + 'L' + xOf(U.M_MAX).toFixed(1) + ' ' + base.toFixed(1) + 'L' + xOf(0).toFixed(1) + ' ' + base.toFixed(1) + 'Z', fill: s.color, 'fill-opacity': 0.1, stroke: 'none' }));
          }
          el.appendChild(svg('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'ch-line s' + k }));
        });
        // baseline A marker, playhead, hover crosshair
        const base = svg('g', { class: 'ch-base' });
        base.appendChild(svg('line', { x1: 0, x2: 0, y1: M.t, y2: PH - M.b }));
        const bt = svg('text', { x: 3, y: M.t + 9, class: 'ch-base-t' }); bt.textContent = 'A'; base.appendChild(bt);
        el.appendChild(base);
        const cross = svg('line', { x1: 0, x2: 0, y1: M.t, y2: PH - M.b, class: 'ch-cross', visibility: 'hidden' });
        el.appendChild(cross);
        const head = svg('g', { class: 'ch-head' });
        head.appendChild(svg('line', { x1: 0, x2: 0, y1: M.t - 2, y2: PH - M.b }));
        const dots = series.map((s) => { const c = svg('circle', { r: 4, fill: s.color, class: 'ch-dot' }); head.appendChild(c); return c; });
        el.appendChild(head);
        const hit = svg('rect', { x: M.l, y: 0, width: pw, height: PH, fill: 'transparent', class: 'ch-hit' });
        el.appendChild(hit);
        fig.appendChild(el);
        host.appendChild(fig);

        const plot = { key, cd, series, xOf, yOf, el, valEls, head, dots, cross, base, hit };
        plots.push(plot);
        bindHover(plot);
      });
      buildTable();
      place();
    }

    function sample(arr, m) {
      if (!(m > 0)) return arr[0];
      const i = Math.floor(m), f = m - i;
      if (i >= arr.length - 1) return arr[arr.length - 1];
      return arr[i] + (arr[i + 1] - arr[i]) * f;
    }

    function place() {
      plots.forEach((p) => {
        const x = p.xOf(curM);
        p.head.querySelector('line').setAttribute('x1', x); p.head.querySelector('line').setAttribute('x2', x);
        p.series.forEach((s, k) => {
          const v = sample(s.v, curM);
          p.dots[k].setAttribute('cx', x); p.dots[k].setAttribute('cy', p.yOf(v));
          p.valEls[k].textContent = U.fmt(v, p.cd.digits);
        });
        p.base.setAttribute('transform', 'translate(' + p.xOf(baseM).toFixed(1) + ',0)');
      });
    }

    function bindHover(plot) {
      let down = false;
      const mAt = (e) => {
        const r = plot.el.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * width;
        return U.clamp(Math.round(((x - M.l) / (width - M.l - M.r)) * U.M_MAX), 0, U.M_MAX);
      };
      const show = (e) => {
        const m = mAt(e);
        plots.forEach((p) => { const x = p.xOf(m); p.cross.setAttribute('x1', x); p.cross.setAttribute('x2', x); p.cross.setAttribute('visibility', 'visible'); });
        tip.textContent = '';
        tip.appendChild(U.h('div.tip-date', { text: U.monthLabel(m) }));
        plot.series.forEach((s) => {
          tip.appendChild(U.h('div.tip-row', null, U.h('i.tip-key', { style: 'background:' + s.color }),
            U.h('b', { text: U.fmt(s.v[m], plot.cd.digits) + ' ' + plot.cd.unit }), U.h('span', { text: s.name })));
        });
        const ev = events.filter((q) => q.m === m)[0];
        if (ev) tip.appendChild(U.h('div.tip-event', { text: ev.label }));
        tip.hidden = false;
        const hr = host.parentNode.getBoundingClientRect(), fr = plot.el.getBoundingClientRect();
        const tx = fr.left - hr.left + (plot.xOf(m) / width) * fr.width;
        const tw = tip.offsetWidth;
        tip.style.left = U.clamp(tx + 12 + tw > hr.width ? tx - tw - 12 : tx + 12, 0, Math.max(0, hr.width - tw)) + 'px';
        tip.style.top = (fr.top - hr.top + 6) + 'px';
        return m;
      };
      plot.hit.addEventListener('pointermove', (e) => { const m = show(e); if (down) hooks.onScrub(m); });
      plot.hit.addEventListener('pointerdown', (e) => { down = true; plot.hit.setPointerCapture(e.pointerId); hooks.onScrub(show(e)); });
      const up = () => { down = false; };
      plot.hit.addEventListener('pointerup', up);
      plot.hit.addEventListener('pointercancel', up);
      plot.hit.addEventListener('pointerleave', () => {
        if (down) return;
        tip.hidden = true;
        plots.forEach((p) => p.cross.setAttribute('visibility', 'hidden'));
      });
    }

    function buildTable() {
      tableHost.textContent = '';
      const cols = [];
      ORDER.forEach((key) => def.charts[key].series.forEach((s) => cols.push({ name: s.name + ' (' + def.charts[key].unit + ')', v: data[s.key], digits: def.charts[key].digits })));
      const table = U.h('table');
      table.appendChild(U.h('thead', null, U.h('tr', null, [U.h('th', { text: 'Month', scope: 'col' })].concat(cols.map((c) => U.h('th', { text: c.name, scope: 'col' }))))));
      const body = U.h('tbody');
      for (let m = 0; m <= U.M_MAX; m += 3) {
        body.appendChild(U.h('tr', null, [U.h('th', { text: U.monthLabel(m), scope: 'row' })].concat(cols.map((c) => U.h('td', { text: U.fmt(c.v[m], c.digits) })))));
      }
      table.appendChild(body);
      tableHost.appendChild(table);
    }

    let rt = 0;
    function onResize() {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const w = Math.max(260, Math.floor(host.getBoundingClientRect().width));
        if (def && Math.abs(w - width) > 2) build();
      }, 80);
    }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(host);

    return {
      setCase(caseDef, series) { def = caseDef; data = series; events = caseDef.events; build(); },
      setTime(m) { curM = m; place(); },
      setBaseline(m) { baseM = m; place(); },
      valuesAt(m) {
        const out = {};
        for (const k in data) if (data[k][0] != null) { out[k] = sample(data[k], m); out[k + '_0'] = data[k][0]; }
        return out;
      },
    };
  }

  TW.Charts = Charts;
})();
