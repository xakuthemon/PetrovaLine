/*
 * TerraWaltz — application controller.
 * Owns the UI state (case, dates A and B, sensor, channel, band, layers) and
 * keeps the map, timeline, story, decoder, charts and decision desk in sync.
 */
(function () {
  'use strict';
  const TW = window.TW;
  const U = TW.util, h = U.h;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const EMBED = !!window.TW_EMBED;   // set by the single-file embed build: no downloads, no print dialog

  const state = {
    ci: 0, m: U.M_MAX, a: 0, mode: 'sar', pol: 'HH', band: 'L',
    layers: { clouds: true, change: false, labels: true, grid: true, roi: false },
    playing: false, speed: 1, chapter: 0,
  };
  let caseDef = null, scene = null, series = null;
  let map, sim, charts;
  let lastMonth = -1, previewPol = null;
  let storyObserver = null, suppressStory = 0, bandChapter = -1;
  const loaded = {};

  const sideScroll = $('#side-scroll');
  const desktopMq = window.matchMedia('(min-width: 901px)');

  /* ====================================================================== *
   * Rendering
   * ====================================================================== */
  const tA = () => U.T0 + state.a / 12;
  const tB = () => U.T0 + state.m / 12;

  /** Per-frame work: map pixels, playhead, readouts. */
  function renderFrame() {
    map.update({ tA: tA(), tB: tB(), mode: state.mode, pol: state.pol, band: state.band, layers: state.layers });
    charts.setTime(state.m);
    syncTimeline();
    const mo = Math.floor(state.m + 1e-6);
    if (mo !== lastMonth) { lastMonth = mo; updateKpis(); updateBrief(); if (state.mode === 'optical' && !previewPol) updatePolNote(); }
  }

  /** Discrete changes: buttons, notes, availability of controls. */
  function render() {
    lastMonth = -1;
    renderFrame();
    charts.setBaseline(state.a);
    syncControls();
    updatePolNote();
  }

  function syncControls() {
    const optical = state.mode === 'optical';
    $$('#seg-mode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.mode)));
    $$('#seg-pol button').forEach((b) => b.setAttribute('aria-pressed', String(!optical && b.dataset.v === state.pol)));
    $$('#seg-band button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.band)));
    $('#grp-pol').classList.toggle('dim', optical);
    $('#grp-band').classList.toggle('dim', optical);
    $$('#layer-toggles button').forEach((b) => {
      const k = b.dataset.layer;
      b.setAttribute('aria-pressed', String(!!state.layers[k]));
      const off = (k === 'clouds' && !optical) || (k === 'change' && (optical || state.pol === 'INSAR'));
      b.disabled = off;
      b.title = !off ? '' : k === 'clouds' ? 'Clouds only affect the optical sensor. Radar does not see them.' : 'Available for the HH, HV, VV and RGB channels.';
    });
    const play = $('#btn-play');
    play.setAttribute('aria-pressed', String(state.playing));
    play.setAttribute('aria-label', state.playing ? 'Pause the timeline' : 'Play the timeline');
    const pin = $('#btn-pin');
    const here = Math.round(state.m) === state.a;
    pin.textContent = here && state.a !== 0 ? 'Reset A to Jan 2020' : 'Set A to this date';
    pin.disabled = here && state.a === 0;
    $$('#movements button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.ci)));
  }

  const trackPos = (m) => 'calc(8px + (100% - 16px) * ' + (m / U.M_MAX).toFixed(4) + ')';
  function syncTimeline() {
    const range = $('#tl-range');
    range.value = Math.round(state.m);
    range.style.setProperty('--p', ((state.m / U.M_MAX) * 100).toFixed(2) + '%');
    range.setAttribute('aria-valuetext', U.monthLabel(Math.floor(state.m + 1e-6)));
    $('#tl-date').textContent = U.monthLabel(Math.floor(state.m + 1e-6));
    const flag = $('#tl-a');
    if (flag) flag.style.left = trackPos(state.a);
  }

  /* ====================================================================== *
   * Channel explanation (the tooltip that follows the channel buttons)
   * ====================================================================== */
  function updatePolNote() {
    const optical = state.mode === 'optical' && !previewPol;
    const pol = previewPol || state.pol;
    const name = $('#pol-note-name'), role = $('#pol-note-role'), text = $('#pol-note-text'), keys = $('#pol-note-keys'), here = $('#pol-note-here');
    keys.textContent = '';
    if (optical) {
      const sk = scene.sky(tB());
      name.textContent = 'Optical';
      role.textContent = 'Passive · reflected sunlight';
      text.textContent = 'A camera records sunlight reflected by the first thing it meets: cloud, smoke, treetops or ground. Without sunlight there is no image.';
      keys.appendChild(h('div', null, h('dt', { text: 'Blocked by' }), h('dd', { text: 'cloud, smoke, haze, night' })));
      here.textContent = sk.light < 0.05 ? 'On this date: polar night. The sensor records nothing.'
        : 'On this date: about ' + Math.round(U.clamp(sk.cover, 0.05, 0.95) * 100) + ' % cloud cover' + (sk.smoke > 0.3 ? ' and smoke haze.' : '.');
    } else {
      const info = TW.POL_INFO[pol];
      name.textContent = info.name;
      role.textContent = info.role;
      text.textContent = info.text + (pol === 'INSAR' ? ' At ' + TW.physics.BANDS[state.band].name + ' one cycle is ' + TW.physics.BANDS[state.band].fringe + ' cm.' : '');
      if (info.bright) keys.appendChild(h('div', null, h('dt', { text: pol === 'RGB' ? 'Colours' : 'Bright' }), h('dd', { text: info.bright })));
      if (info.dark) keys.appendChild(h('div', null, h('dt', { text: pol === 'RGB' ? '' : 'Dark' }), h('dd', { text: info.dark })));
      here.textContent = caseDef.polNotes[pol] || '';
    }
    $('#pol-note').classList.toggle('preview', !!previewPol);
  }

  /* ====================================================================== *
   * Story
   * ====================================================================== */
  function buildMovements() {
    const nav = $('#movements');
    TW.cases.forEach((c, i) => {
      const b = h('button.movement', { type: 'button', 'aria-pressed': 'false' },
        h('span.mv-num', { text: c.numeral }),
        h('span.mv-text', null, h('span.mv-title', { text: c.title }), h('span.mv-place', { text: c.tempo + ' · ' + c.short })));
      b.addEventListener('click', () => selectCase(i));
      nav.appendChild(b);
    });
  }

  function buildStory() {
    const head = $('#case-head');
    head.textContent = '';
    head.appendChild(h('p.case-tempo', null, h('span.case-num', { text: 'Movement ' + caseDef.numeral }), h('span.case-tempo-word', { text: caseDef.tempo })));
    head.appendChild(h('h1.case-title', { text: caseDef.title }));
    head.appendChild(h('p.case-place', null, caseDef.place, caseDef.tag ? h('span.case-tag', { text: caseDef.tag }) : null));
    head.appendChild(h('p.case-summary', { text: caseDef.summary }));
    head.appendChild(h('dl.kpis', { id: 'kpis' }));

    const list = $('#chapters');
    list.textContent = '';
    caseDef.chapters.forEach((ch, i) => {
      const li = h('li.chapter', { 'data-i': i },
        h('span.ch-marker', { 'aria-hidden': 'true', text: String(i + 1) }),
        h('div.ch-body', null,
          h('h3', null, h('button', { type: 'button', text: ch.title })),
          h('p', { text: ch.body }),
          h('p.ch-look', null, h('span', { text: 'Look for' }), ch.look),
          h('button.ch-show', { type: 'button', text: 'Show on map' })));
      li.querySelector('h3 button').addEventListener('click', () => applyChapter(i));
      li.querySelector('.ch-show').addEventListener('click', () => applyChapter(i));
      list.appendChild(li);
    });
    observeStory();
  }

  function observeStory() {
    if (storyObserver) storyObserver.disconnect();
    if (!window.IntersectionObserver) return;
    const inBand = new Set();
    storyObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => { const i = Number(e.target.dataset.i); if (e.isIntersecting) inBand.add(i); else inBand.delete(i); });
      if (!inBand.size) return;
      const i = Math.max.apply(null, Array.from(inBand));
      // act only when scrolling carries a different chapter into the reading band,
      // so layout shifts and manual choices are never overridden
      if (i === bandChapter) return;
      bandChapter = i;
      if (!suppressStory && i !== state.chapter) applyChapter(i);
    }, { root: desktopMq.matches ? sideScroll : null, rootMargin: '-28% 0px -62% 0px', threshold: 0 });
    $$('#chapters .chapter').forEach((li) => storyObserver.observe(li));
  }

  function applyChapter(i) {
    const ch = caseDef.chapters[i];
    if (!ch) return;
    const v = ch.view;
    setPlaying(false);
    state.chapter = i;
    state.mode = v.mode;
    if (v.pol) state.pol = v.pol;
    if (v.band) state.band = v.band;
    state.a = v.a; state.m = v.m;
    Object.assign(state.layers, v.layers || {});
    map.setSplit(v.split == null ? 0.5 : v.split);
    $$('#chapters .chapter').forEach((li, k) => li.classList.toggle('active', k === i));
    render();
    sim.refresh();
    if (v.focus) map.focusAnchor(v.focus[0], v.focus[1]);
  }

  function updateKpis() {
    const el = $('#kpis');
    if (!el || !scene) return;
    const sk = scene.sky(tB());
    const items = scene.kpi(tB()).concat([{
      k: 'Optical view on this date',
      v: sk.light < 0.05 ? 'no sunlight' : Math.round(U.clamp(sk.cover, 0.05, 0.95) * 100) + ' % cloud' + (sk.smoke > 0.3 ? ' + smoke' : ''),
    }]);
    el.textContent = '';
    items.forEach((it) => el.appendChild(h('div', null, h('dt', { text: it.k }), h('dd', { text: it.v }))));
  }

  /* ====================================================================== *
   * Decision desk
   * ====================================================================== */
  const ALERT_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l6.6 11.7H1.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.2v3.6M8 11.6v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function buildDecisions() {
    const d = caseDef.decision, root = $('#dec');
    root.textContent = '';
    const drivers = h('article.dec-block', null, h('h3', { text: 'Physical drivers hypothesis' }),
      h('ul.dec-list', null, d.drivers.map((x) => h('li', null,
        h('div.dec-item-head', null, h('strong', { text: x.t }), h('span.conf', { 'data-c': x.conf.toLowerCase(), text: x.conf + ' confidence' })),
        h('p', { text: x.d })))));
    const impacts = h('article.dec-block', null, h('h3', { text: 'Community & ecosystem impact' }),
      h('ul.dec-list', null, d.impacts.map((x) => h('li', null, h('div.dec-item-head', null, h('strong', { text: x.t })), h('p', { text: x.d })))));
    const b = d.brief;
    const brief = h('article.brief', { id: 'brief', 'data-level': b.level },
      h('header.brief-head', null,
        h('span.brief-kicker', { text: 'Policy brief · alert summary' }),
        h('span.alert', { 'data-level': b.level, html: ALERT_ICON + '<span>' + b.levelLabel + '</span>' })),
      h('h3.brief-title', { text: b.headline }),
      h('p.brief-meta', { id: 'brief-meta' }),
      h('dl.brief-figs', { id: 'brief-figs' }),
      h('h4', { text: 'Recommended actions' }),
      h('ol.brief-actions', null, b.actions.map((a) => h('li', { text: a }))),
      h('h4', { text: 'Monitoring request' }),
      h('p.brief-monitor', { text: b.monitor }),
      h('p.brief-caveat', { text: 'Figures come from the TerraWaltz simulated scenario and illustrate the method. Replace them with NISAR products before any decision.' }),
      h('div.brief-actions-row', null,
        h('button.btn.primary', { type: 'button', id: 'brief-copy', text: 'Copy brief' }),
        EMBED ? null : h('button.btn', { type: 'button', id: 'brief-download', text: 'Download .md' }),
        EMBED ? null : h('button.btn', { type: 'button', id: 'brief-print', text: 'Print / PDF' }),
        h('button.btn.quiet', { type: 'button', id: 'brief-view', text: 'View as text' }),
        h('span.brief-status', { id: 'brief-status', role: 'status' })));
    root.appendChild(drivers);
    root.appendChild(impacts);
    root.appendChild(brief);

    $('#brief-copy').addEventListener('click', copyBrief);
    $('#brief-view').addEventListener('click', () => openBriefText(false));
    if (!EMBED) {
      $('#brief-download').addEventListener('click', downloadBrief);
      $('#brief-print').addEventListener('click', () => window.print());
    }
  }

  function briefFigures() {
    return caseDef.decision.brief.figures(charts.valuesAt(state.m));
  }
  function updateBrief() {
    const figs = $('#brief-figs');
    if (!figs) return;
    figs.textContent = '';
    briefFigures().forEach((f) => figs.appendChild(h('div', null, h('dt', { text: f.k }), h('dd', { text: f.v }))));
    $('#brief-meta').textContent = caseDef.place + ' · window ' + U.monthLabel(state.a) + ' → ' + U.monthLabel(Math.floor(state.m + 1e-6));
  }

  function briefText() {
    const d = caseDef.decision, b = d.brief;
    const L = [];
    L.push('# Policy brief: ' + caseDef.title);
    L.push('');
    L.push('**Location:** ' + caseDef.place);
    L.push('**Alert level:** ' + b.levelLabel);
    L.push('**Observation window:** ' + U.monthLabel(state.a) + ' to ' + U.monthLabel(Math.floor(state.m + 1e-6)));
    L.push('**Source:** TerraWaltz simulated NISAR-like scenario (L-band 24 cm, S-band 9.4 cm)');
    L.push('');
    L.push('## Summary');
    L.push(b.headline + '.');
    L.push('');
    L.push('## Key figures');
    briefFigures().forEach((f) => L.push('- ' + f.k + ': ' + f.v));
    L.push('');
    L.push('## Physical drivers (hypothesis)');
    d.drivers.forEach((x) => L.push('- **' + x.t + '** (' + x.conf.toLowerCase() + ' confidence). ' + x.d));
    L.push('');
    L.push('## Community and ecosystem impact');
    d.impacts.forEach((x) => L.push('- **' + x.t + '.** ' + x.d));
    L.push('');
    L.push('## Recommended actions');
    b.actions.forEach((a, i) => L.push((i + 1) + '. ' + a));
    L.push('');
    L.push('## Monitoring request');
    L.push(b.monitor);
    L.push('');
    L.push('---');
    L.push('Caveat: figures come from a procedurally simulated teaching scenario, not from NISAR measurements. Replace them with mission products before any decision.');
    return L.join('\n');
  }
  function briefStatus(msg) {
    const el = $('#brief-status');
    if (!el) return;
    el.textContent = msg;
    clearTimeout(briefStatus.t);
    briefStatus.t = setTimeout(() => { el.textContent = ''; }, 2600);
  }
  function copyBrief() {
    const txt = briefText();
    const fallback = () => openBriefText(true);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => briefStatus('Copied'), fallback);
      } else fallback();
    } catch (e) { fallback(); }
  }
  function openBriefText(select) {
    const ta = $('#brief-text');
    ta.value = briefText();
    openModal('modal-brief');
    if (select) { ta.focus(); ta.select(); }
  }
  function downloadBrief() {
    try {
      const blob = new Blob([briefText()], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: 'terrawaltz-brief-' + caseDef.id + '.md' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      briefStatus('Downloaded');
    } catch (e) { openBriefText(true); }
  }

  /* ====================================================================== *
   * Timeline
   * ====================================================================== */
  function buildTimeline() {
    const years = $('#tl-years');
    years.textContent = '';
    for (let y = 0; y <= 6; y++) years.appendChild(h('span', { style: 'left:' + trackPos(y * 12), text: String(2020 + y) }));
    const ev = $('#tl-events');
    ev.textContent = '';
    ev.appendChild(h('span.tl-a', { id: 'tl-a', title: 'Date A (baseline)', text: 'A' }));
    caseDef.events.forEach((e) => {
      const b = h('button.tl-event' + (e.kind === 'mission' ? '.mission' : ''), { type: 'button', style: 'left:' + trackPos(e.m), 'aria-label': e.label },
        h('span.tl-event-tip', { text: e.label }));
      b.addEventListener('click', () => { setPlaying(false); state.m = e.m; render(); });
      ev.appendChild(b);
    });
  }

  let lastTick = 0;
  function setPlaying(on) {
    if (state.playing === on) return;
    state.playing = on;
    if (on) {
      if (state.m >= U.M_MAX - 0.01) state.m = state.a < U.M_MAX - 1 ? state.a : 0;
      lastTick = performance.now();
      requestAnimationFrame(tick);
    }
    syncControls();
  }
  function tick(now) {
    if (!state.playing) return;
    const dt = U.clamp((now - lastTick) / 1000, 0, 0.12);
    lastTick = now;
    state.m += dt * 7 * state.speed;
    if (state.m >= U.M_MAX) { state.m = U.M_MAX; renderFrame(); setPlaying(false); return; }
    renderFrame();
    requestAnimationFrame(tick);
  }

  /* ====================================================================== *
   * Case switching
   * ====================================================================== */
  function selectCase(i) {
    setPlaying(false);
    state.ci = i;
    const def = TW.cases[i];
    const run = () => {
      caseDef = def;
      scene = map.setCase(def);
      series = TW.scenes.buildSeries(scene);
      loaded[def.id] = true;
      charts.setCase(def, series);
      buildTimeline();
      buildStory();
      buildDecisions();
      state.chapter = -1;
      bandChapter = 0;
      suppressStory++;
      if (desktopMq.matches) sideScroll.scrollTop = 0;
      setTimeout(() => { suppressStory = Math.max(0, suppressStory - 1); }, 400);
      applyChapter(0);
      $('#map-loading').hidden = true;
    };
    $$('#movements button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    if (loaded[def.id] || !caseDef) run();
    else { $('#map-loading').hidden = false; setTimeout(run, 30); }
  }

  /* ====================================================================== *
   * Modals, toast, navigation
   * ====================================================================== */
  let lastFocus = null;
  function openModal(id) {
    const m = $('#' + id);
    lastFocus = document.activeElement;
    m.hidden = false;
    const card = m.querySelector('.modal-card');
    card.setAttribute('tabindex', '-1');
    card.scrollTop = 0; m.scrollTop = 0;
    card.focus({ preventScroll: true });
  }
  function closeModal(m) {
    m.hidden = true;
    if (m.id === 'modal-why') U.store.set('tw-onboarded', '1');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m); });
    m.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = $$('button, textarea, [href], input, select', m).filter((el) => !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    });
  });

  let toastTimer = 0;
  function toast(msg, actionLabel, action) {
    const el = $('#toast');
    el.textContent = '';
    el.appendChild(h('span', { text: msg }));
    if (actionLabel) {
      const b = h('button', { type: 'button', text: actionLabel });
      b.addEventListener('click', () => { el.hidden = true; action(); });
      el.appendChild(b);
    }
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
  }

  function goToSection(id) {
    const sec = $('#' + id);
    suppressStory++;
    setTimeout(() => { suppressStory = Math.max(0, suppressStory - 1); }, 1000);
    if (desktopMq.matches) sideScroll.scrollTo({ top: sec.offsetTop - 4, behavior: U.reducedMotion() ? 'auto' : 'smooth' });
    else sec.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function observeSections() {
    if (!window.IntersectionObserver) return;
    const vis = {};
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { vis[e.target.id] = e.isIntersecting; });
      const cur = ['sec-story', 'sec-physics', 'sec-signals', 'sec-decisions'].filter((id) => vis[id])[0];
      if (cur) $$('#side-nav button').forEach((b) => { if (b.dataset.target === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    }, { root: desktopMq.matches ? sideScroll : null, rootMargin: '-20% 0px -70% 0px' });
    $$('.sec').forEach((s) => io.observe(s));
    return io;
  }

  /* ====================================================================== *
   * Wiring
   * ====================================================================== */
  function wire() {
    $('#seg-mode').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      state.mode = b.dataset.v; render();
    });
    const segPol = $('#seg-pol');
    segPol.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      state.pol = b.dataset.v; state.mode = 'sar'; previewPol = null;
      setNoteOpen(true);
      render();
    });
    const preview = (e) => {
      const b = e.target.closest && e.target.closest('button');
      const v = b ? b.dataset.v : null;
      const next = v && (v !== state.pol || state.mode === 'optical') ? v : null;
      if (next !== previewPol) { previewPol = next; updatePolNote(); }
    };
    segPol.addEventListener('pointerover', preview);
    segPol.addEventListener('focusin', preview);
    segPol.addEventListener('pointerleave', () => { if (previewPol) { previewPol = null; updatePolNote(); } });
    segPol.addEventListener('focusout', () => { if (previewPol) { previewPol = null; updatePolNote(); } });

    $('#seg-band').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      state.band = b.dataset.v; if (state.mode === 'optical') state.mode = 'sar';
      render(); sim.refresh();
    });
    $('#layer-toggles').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const k = b.dataset.layer;
      state.layers[k] = !state.layers[k];
      render();
    });

    const range = $('#tl-range');
    range.addEventListener('input', () => { setPlaying(false); state.m = Number(range.value); renderFrame(); syncControls(); });
    $('#btn-play').addEventListener('click', () => setPlaying(!state.playing));
    $('#tl-speed').addEventListener('change', (e) => { state.speed = Number(e.target.value) || 1; });
    $('#btn-pin').addEventListener('click', () => {
      const here = Math.round(state.m);
      state.a = here === state.a ? 0 : here;
      render();
    });

    $('#btn-why').addEventListener('click', () => openModal('modal-why'));
    $('#side-nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) goToSection(b.dataset.target); });
    $('#pol-note-toggle').addEventListener('click', () => setNoteOpen($('#pol-note').classList.contains('collapsed')));

    document.addEventListener('keydown', (e) => {
      const open = $$('.modal').filter((m) => !m.hidden)[0];
      if (e.key === 'Escape' && open) { closeModal(open); return; }
      if (open) return;
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.getAttribute && t.getAttribute('role') === 'slider')) return;
      if (e.key === ' ' && tag !== 'BUTTON') { setPlaying(!state.playing); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        setPlaying(false);
        state.m = U.clamp(Math.round(state.m) + (e.key === 'ArrowRight' ? 1 : -1), 0, U.M_MAX);
        renderFrame(); syncControls(); e.preventDefault();
      } else if (/^[1-4]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) selectCase(Number(e.key) - 1);
    });

    let io = observeSections();
    const onMq = () => { observeStory(); if (io) io.disconnect(); io = observeSections(); };
    if (desktopMq.addEventListener) desktopMq.addEventListener('change', onMq);
  }

  function setNoteOpen(open) {
    $('#pol-note').classList.toggle('collapsed', !open);
    $('#pol-note-toggle').setAttribute('aria-expanded', String(open));
    U.store.set('tw-note', open ? '1' : '0');
  }

  /* ====================================================================== *
   * Boot
   * ====================================================================== */
  function boot() {
    buildMovements();
    map = TW.MapView($('#map-panel'), {
      onPick(inf) {
        sim.setFromPixel(inf.state, inf.cls);
        toast('Pixel sent to the Physics Decoder: ' + inf.cls.toLowerCase(), 'View', () => goToSection('sec-physics'));
      },
    });
    sim = TW.Simulator($('#sec-physics'), { getBand: () => state.band });
    charts = TW.Charts($('#sec-signals'), {
      onScrub(m) { setPlaying(false); state.m = m; renderFrame(); syncControls(); },
    });
    const noteOpen = U.store.get('tw-note');
    setNoteOpen(noteOpen == null ? window.innerWidth > 700 : noteOpen === '1');
    wire();
    selectCase(0);
    if (!U.store.get('tw-onboarded')) openModal('modal-why');
    window.TW.app = { state, selectCase, applyChapter, setPlaying, render };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
