/*
 * The landing: a scroll-driven presentation over one WebGL stage.
 * Scroll moves the camera between slides; each slide's text builds in like a
 * keynote slide when it takes the screen.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import Lenis from 'lenis';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { createLandingScene, type LandingHandle } from '../three/landingScene';
import { SLIDES, FILM_VH, LAST, locate, slideStart, activeSlide, coverCount, scanAt, type Place } from './film';
import { loadSlab } from './slabData';
import { useMission } from '../state/mission';
import { lerp, monthLabel, reducedMotion } from '../engine/util';
import type { SceneId } from '../engine/scenes';
import { OrbitMark } from '../components/MissionCapsule';

/* ---- text helpers ---------------------------------------------------------- */

/** words that rise out of a mask when the slide builds in */
function Words({ text }: { text: string }) {
  const w = text.split(' ');
  return (
    <>
      {w.map((x, i) => (
        <span key={i}>
          <span className="rise-mask"><span data-w className="rise">{x}</span></span>
          {i < w.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

/** a number that counts up when its slide builds in */
function Count({ value, dec = 0, sign = '' }: { value: number; dec?: number; sign?: string }) {
  return <span data-count={value} data-dec={dec} data-sign={sign}>{sign + value.toFixed(dec)}</span>;
}

function parseFigure(s: string): { sign: string; value: number; dec: number; unit: string } | null {
  const m = /^([−-]?)\s*(\d+(?:\.(\d+))?)\s*(.*)$/.exec(s.trim());
  if (!m) return null;
  return { sign: m[1] ? '−' : '', value: parseFloat(m[2]), dec: m[3] ? m[3].length : 0, unit: m[4] };
}

const Eyebrow = ({ children, dot = false }: { children: ReactNode; dot?: boolean }) => (
  <p data-f className="eyebrow flex items-center gap-3">{dot && <i className="h-[6px] w-[6px] flex-none rounded-full bg-kapton" />}{children}</p>
);

function Cta({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" data-f onClick={onClick} className="cta group">
      <span>{children}</span>
      <ArrowUpRight size={18} strokeWidth={1.5} className="transition-transform duration-500 group-hover:rotate-45" />
    </button>
  );
}

/* ---- the page -------------------------------------------------------------- */

export default function Landing() {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const anchor = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLSpanElement>(null);
  const passRef = useRef<HTMLSpanElement>(null);
  const dateRefs = useRef<Record<number, { label: HTMLSpanElement | null; bar: HTMLSpanElement | null }>>({});
  const sceneRef = useRef<LandingHandle | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const introRef = useRef<gsap.core.Timeline | null>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [figures, setFigures] = useState<Partial<Record<SceneId, string>>>({});
  const [noGl, setNoGl] = useState(false);
  const setMode = useMission((s) => s.setMode);
  const reduced = useRef(reducedMotion()).current;

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const top = (slideStart(Math.max(0, Math.min(LAST, i))) + 0.02) * el.clientHeight;
    if (lenisRef.current) lenisRef.current.scrollTo(top, { duration: 1.9, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
    else el.scrollTo({ top });
  };
  const openConsole = (id?: SceneId) => {
    if (id) useMission.getState().setCase(id);
    setMode('console');
  };

  /* stage, scroll and intro */
  useEffect(() => {
    const el = scroller.current!, cv = canvas.current!;
    const scene = createLandingScene(cv, reduced);
    sceneRef.current = scene;
    if (!scene) setNoGl(true);

    const update = () => {
      const vh = el.clientHeight || 1;
      const f = locate(el.scrollTop / vh);
      scene?.setFilm(f);
      const a = activeSlide(f);
      if (a !== activeRef.current) { activeRef.current = a; setActive(a); }
      // live readouts
      const id = SLIDES[f.i].id;
      const n = id === 'cover' ? coverCount(f.u) : f.i > 3 ? 173 : 4;
      if (dayRef.current) dayRef.current.textContent = String(Math.max(1, Math.ceil((n / 173) * 12))).padStart(2, '0');
      if (passRef.current) passRef.current.textContent = String(Math.round(n)).padStart(3, '0');
      const pl = SLIDES[f.i].place;
      const r = dateRefs.current[f.i];
      if (pl && r) {
        const s = f.k > 0 ? 1 : scanAt(f.u);
        if (r.label) r.label.textContent = monthLabel(Math.round(lerp(pl.a, pl.b, s)));
        if (r.bar) r.bar.style.transform = 'scaleX(' + s.toFixed(4) + ')';
      }
      if (el.scrollTop > 4 && introRef.current && introRef.current.progress() < 1) introRef.current.progress(1);
    };

    let lenis: Lenis | null = null;
    const tick = (t: number) => lenis?.raf(t * 1000);
    if (!reduced) {
      lenis = new Lenis({ wrapper: el, content: content.current!, lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
      lenisRef.current = lenis;
      lenis.on('scroll', update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    } else {
      el.addEventListener('scroll', update, { passive: true });
    }
    update();

    const ro = new ResizeObserver(() => { scene?.resize(); update(); });
    ro.observe(cv);
    scene?.resize();
    scene?.start();

    const onMove = (e: PointerEvent) => scene?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener('pointermove', onMove, { passive: true });

    if (scene) {
      scene.onAnchor = (p) => {
        const node = anchor.current;
        if (!node) return;
        const on = activeRef.current === 0 ? p.on : 0;
        node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        node.style.opacity = on.toFixed(3);
      };
      if (!reduced) {
        const it = scene.intro;
        introRef.current = gsap.timeline({ delay: 0.1 })
          .to(it, { push: 1, duration: 3.4, ease: 'expo.out' }, 0)
          .to(it, { ring: 1, duration: 2.1, ease: 'power3.inOut' }, 0)
          .to(it, { globe: 1, duration: 2.2, ease: 'power2.out' }, 0.25)
          .to(it, { orbits: 1, duration: 2.8, ease: 'power2.out' }, 0.7)
          .to(it, { sats: 1, duration: 1.2, ease: 'power1.out' }, 1.9);
      }
    }

    // render the simulated scenes for the place slides, one after another, off the main thread
    let alive = true;
    const t = window.setTimeout(() => {
      SLIDES.filter((s) => s.place).forEach((s) => {
        loadSlab(s.place!.scene).then((r) => {
          if (!alive) return;
          sceneRef.current?.addSlab(r);
          setFigures((f) => ({ ...f, [r.id]: r.figure }));
        }).catch(() => undefined);
      });
    }, reduced ? 0 : 1600);

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = activeRef.current;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && tag !== 'BUTTON')) { e.preventDefault(); goTo(i + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); goTo(LAST); }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      alive = false;
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('scroll', update);
      ro.disconnect();
      introRef.current?.kill();
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenisRef.current = null;
      scene?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* keynote builds: the outgoing slide clears, the incoming one builds */
  const shown = useRef<number | null>(null);
  useLayoutEffect(() => {
    const prev = shown.current;
    shown.current = active;
    const out = prev !== null ? sections.current[prev] : null;
    const inn = sections.current[active];
    const q = (n: HTMLElement | null | undefined, s: string) => (n ? Array.from(n.querySelectorAll<HTMLElement>(s)) : []);
    const to = (t: HTMLElement[], v: gsap.TweenVars) => { if (t.length) gsap.to(t, v); };
    const fromTo = (t: HTMLElement[], a: gsap.TweenVars, v: gsap.TweenVars) => { if (t.length) gsap.fromTo(t, a, v); };
    if (out && out !== inn) {
      gsap.killTweensOf([out, ...q(out, '[data-w],[data-f],[data-l]')]);
      if (reduced) gsap.set(out, { autoAlpha: 0 });
      else {
        to(q(out, '[data-w]'), { yPercent: -110, duration: 0.5, ease: 'power3.in', stagger: 0.015 });
        to(q(out, '[data-f],[data-l]'), { autoAlpha: 0, y: -14, duration: 0.35, ease: 'power2.in' });
        gsap.to(out, { autoAlpha: 0, duration: 0.2, delay: 0.5 });
      }
    }
    if (!inn) return;
    gsap.killTweensOf([inn, ...q(inn, '[data-w],[data-f],[data-l]')]);
    gsap.set(inn, { autoAlpha: 1 });
    const first = prev === null;
    const d0 = first ? 0.75 : 0.18;
    if (reduced) {
      const w = q(inn, '[data-w]'), f = q(inn, '[data-f],[data-l]');
      if (w.length) gsap.set(w, { yPercent: 0 });
      if (f.length) gsap.set(f, { autoAlpha: 1, y: 0, scaleX: 1, scaleY: 1 });
      return;
    }
    fromTo(q(inn, '[data-w]'), { yPercent: 112, rotate: 3 }, { yPercent: 0, rotate: 0, duration: 1.15, ease: 'expo.out', stagger: 0.05, delay: d0 });
    fromTo(q(inn, '[data-f]'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, delay: d0 + 0.3 });
    fromTo(q(inn, '[data-l]'), { autoAlpha: 1, scaleX: 0, scaleY: 0 }, { scaleX: 1, scaleY: 1, duration: 1.1, ease: 'expo.inOut', stagger: 0.08, delay: d0 + 0.2 });
    q(inn, '[data-count]').forEach((n, i) => {
      const to = parseFloat(n.dataset.count || '0'), dec = parseInt(n.dataset.dec || '0', 10), sign = n.dataset.sign || '';
      const o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', delay: d0 + 0.25 + i * 0.12, onUpdate: () => { n.textContent = sign + o.v.toFixed(dec); } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, figures]);

  const reg = (i: number) => (n: HTMLElement | null) => { sections.current[i] = n; };
  const slide = 'slide absolute inset-0 flex';
  const pad = { paddingLeft: 'max(24px, env(safe-area-inset-left, 0px), 5vw)', paddingRight: 'max(24px, env(safe-area-inset-right, 0px), 5vw)' };

  const placeSlide = (i: number, word: string, p: Place) => {
    const fig = figures[p.scene] ? parseFigure(figures[p.scene]!) : null;
    return (
      <section key={i} ref={reg(i)} className={slide + ' flex-col justify-start pb-12 pt-[18vh] max-sm:pt-[14vh] md:justify-center md:pt-0'} style={pad} aria-label={word}>
        <div className="max-w-[560px]">
          <Eyebrow>{p.coords}</Eyebrow>
          <h2 className="display mt-5 text-[clamp(72px,11vw,184px)]"><Words text={word} /><span className="rise-mask"><span data-w className="rise gold-text">.</span></span></h2>
          <p data-f className="mt-5 flex items-baseline gap-3">
            <span className="display text-[clamp(38px,4.4vw,68px)]">{fig ? <><Count value={fig.value} dec={fig.dec} sign={fig.sign} /><span className="ml-2 text-[0.5em] tracking-normal text-lens/70">{fig.unit}</span></> : <span className="text-lens/40">…</span>}</span>
          </p>
          <p data-f className="mt-1 max-w-[30ch] text-[15px] leading-snug text-lens/65">{p.caption}</p>
          <div data-f className="mt-8 flex max-w-[340px] items-center gap-3 font-mono text-[11px] tabular-nums text-lens/70">
            <span>{monthLabel(p.a)}</span>
            <span className="relative h-px flex-1 bg-lens/20">
              <span ref={(n) => { (dateRefs.current[i] ||= { label: null, bar: null }).bar = n; }} className="absolute inset-0 origin-left bg-kapton" style={{ transform: 'scaleX(0)' }} />
            </span>
            <span ref={(n) => { (dateRefs.current[i] ||= { label: null, bar: null }).label = n; }} className="min-w-[64px] text-right text-lens">{monthLabel(p.a)}</span>
          </div>
          <div data-f className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="eyebrow text-lens/45">{p.where} · simulated</span>
            <button type="button" onClick={() => openConsole(p.scene)} className="link-u text-[13px] text-lens/85">Open in console <ArrowUpRight size={14} strokeWidth={1.6} /></button>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div ref={scroller} className="landing absolute inset-0 overflow-y-auto overflow-x-hidden" tabIndex={-1}>
      <div ref={content} style={{ height: (FILM_VH + 1) * 100 + '%' }}>
        <div className="stage sticky top-0 h-screen overflow-hidden [height:100dvh]">
          <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          {noGl && <div className="absolute inset-0 grid place-items-center"><div className="h-[46vmin] w-[46vmin] rounded-full border border-kapton/50 shadow-[0_0_80px_-20px_rgba(228,198,143,0.5)]" /></div>}

          <div className={'scrim pointer-events-none absolute inset-0 z-[5] transition-opacity duration-1000 ' + (SLIDES[active].place ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
          <div className={'scrim-low pointer-events-none absolute inset-0 z-[5] transition-opacity duration-1000 md:hidden ' + (active > 0 && active < 4 ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />

          {/* NISAR label riding the spacecraft */}
          <div ref={anchor} className="pointer-events-none absolute left-0 top-0 z-10 opacity-0 max-sm:hidden" aria-hidden="true">
            <div className="flex -translate-y-1/2 items-center gap-3 pl-[7px]">
              <span className="h-[11px] w-[11px] -translate-x-1/2 rounded-full border border-kapton/80" />
              <span className="h-px w-12 bg-kapton/60" />
              <span className="flex flex-col gap-1.5 whitespace-nowrap">
                <span className="eyebrow text-lens/90">NISAR · sun-synchronous</span>
                <span className="font-mono text-[10px] tracking-[0.2em] text-lens/45">747 KM · 98.4°</span>
              </span>
            </div>
          </div>

          {/* ---------------- slides ---------------- */}
          <section ref={reg(0)} className={slide + ' flex-col justify-between pb-[6vh] pt-[15vh] max-md:justify-end max-md:pt-0'} style={pad} aria-label="TerraWaltz">
            <div className="max-md:mt-auto">
              <Eyebrow dot>A new perspective on a moving planet</Eyebrow>
              <h1 className="display mt-6 text-[clamp(50px,7.4vw,128px)]">
                <span className="block"><Words text="Nothing on Earth" /></span>
                <span className="block"><Words text="stands" /> <span className="rise-mask"><span data-w className="rise gold-text">still.</span></span></span>
              </h1>
            </div>
            <div className="mt-8 flex flex-col-reverse gap-8 md:mt-10 md:flex-row md:items-end md:justify-between md:gap-10">
              <dl className="flex gap-0">
                {([[2, 'bands', 'L + S radar'], [12, 'days', 'Repeat cycle'], [1, 'planet', 'Land and ice']] as const).map(([n, u, c]) => (
                  <div key={u} className="relative pl-5 pr-6 sm:pr-9">
                    <span data-l className="absolute left-0 top-0 h-full w-px origin-top bg-lens/25" />
                    <dt className="sr-only">{u}</dt>
                    <dd data-f className="display flex items-baseline text-[clamp(44px,4.6vw,76px)] leading-none"><Count value={n} /><span className="ml-1 text-[0.36em] tracking-[-0.02em] text-lens/75">{u}</span></dd>
                    <dd data-f className="eyebrow mt-4 text-[9.5px] text-lens/45">{c}</dd>
                  </div>
                ))}
              </dl>
              <div className="max-w-[520px]">
                <p className="text-[clamp(24px,2.3vw,38px)] font-light leading-[1.1] tracking-[-0.035em] max-md:hidden"><Words text="Earth is always dancing." /></p>
                <div className="flex flex-wrap items-center gap-6 md:mt-7">
                  <Cta onClick={() => openConsole()}>Explore the radar console</Cta>
                  <button type="button" data-f onClick={() => goTo(1)} className="link-u text-[14px] text-lens/80 max-sm:hidden">Watch the mission <ArrowDown size={15} strokeWidth={1.5} /></button>
                </div>
              </div>
            </div>
          </section>

          <section ref={reg(1)} className={slide + ' flex-col justify-end pb-[10vh] md:justify-center md:pb-0'} style={pad} aria-label="The spacecraft">
            <div className="max-w-[460px]">
              <Eyebrow>The spacecraft</Eyebrow>
              <p className="display mt-4 text-[clamp(110px,15vw,250px)] leading-[0.85]"><Words text="12 m" /></p>
              <p data-f className="mt-6 max-w-[26ch] text-[clamp(17px,1.4vw,21px)] leading-snug text-lens/70">Gold mesh reflector, folded for launch and opened in orbit.</p>
            </div>
          </section>

          <section ref={reg(2)} className={slide + ' flex-col justify-end pb-[9vh] md:justify-center md:pb-0'} style={pad} aria-label="Two wavelengths">
            <div className="max-w-[520px]">
              <Eyebrow>Two radars, one pass</Eyebrow>
              <div className="mt-6 flex flex-col gap-5">
                {([['24', 'L-band · 1.25 GHz', 'text-lband', 'bg-lband'], ['9.4', 'S-band · 3.2 GHz', 'text-sband', 'bg-sband']] as const).map(([v, l, tc, bc]) => (
                  <div key={l} className="flex items-end gap-5">
                    <p className={'display text-[clamp(84px,10vw,168px)] leading-[0.82] ' + tc}><Words text={v} /></p>
                    <div className="pb-2">
                      <p data-f className="display text-[clamp(28px,2.6vw,42px)] leading-none">cm</p>
                      <p data-f className="eyebrow mt-3 flex items-center gap-2 text-[9.5px] text-lens/55"><i className={'h-[2px] w-5 rounded-full ' + bc} />{l}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p data-f className="mt-8 max-w-[30ch] text-[clamp(16px,1.3vw,19px)] leading-snug text-lens/65">The long wave reaches under the canopy. The short wave reads the surface.</p>
            </div>
          </section>

          <section ref={reg(3)} className={slide + ' flex-col justify-end pb-[8vh] md:justify-center md:pb-0'} style={pad} aria-label="Twelve days">
            <div className="max-w-[520px]">
              <Eyebrow>Repeat orbit</Eyebrow>
              <p className="display mt-4 text-[clamp(96px,12vw,200px)] leading-[0.85]"><Words text="12 days" /></p>
              <p data-f className="mt-6 font-mono text-[12px] tracking-[0.18em] text-lens/70">DAY <span ref={dayRef} className="text-kapton">01</span> · PASS <span ref={passRef} className="text-lens">004</span> / 173</p>
              <p data-f className="mt-4 max-w-[30ch] text-[clamp(16px,1.3vw,19px)] leading-snug text-lens/65">Nearly all of Earth's land and ice, mapped twice every cycle.</p>
            </div>
          </section>

          {SLIDES.map((s, i) => (s.place ? placeSlide(i, s.name, s.place) : null))}

          <section ref={reg(LAST)} className={slide + ' flex-col items-center justify-end pb-[9vh] text-center'} style={pad} aria-label="Earth in motion">
            <h2 className="display max-w-[14ch] text-[clamp(46px,6.4vw,112px)]"><Words text="Earth is always" /> <span className="rise-mask"><span data-w className="rise gold-text">dancing.</span></span></h2>
            <div className="mt-9 flex flex-col items-center gap-5">
              <Cta onClick={() => openConsole()}>Open the radar console</Cta>
              <p data-f className="eyebrow text-[9.5px] text-lens/40">Scenes and figures are simulated for demonstration</p>
            </div>
          </section>

          {/* ---------------- chrome ---------------- */}
          <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between pt-5" style={pad}>
            <button type="button" onClick={() => goTo(0)} className="flex items-center gap-2.5 text-[15px] font-medium tracking-[-0.01em] text-lens" aria-label="TerraWaltz, back to the start">
              <OrbitMark className="h-7 w-7" />TerraWaltz
            </button>
            <button type="button" onClick={() => openConsole()} className="pill-light">Console <ArrowUpRight size={15} strokeWidth={1.6} /></button>
          </header>

          <p className="pointer-events-none absolute bottom-[12vh] z-20 hidden origin-bottom-left -rotate-90 font-mono text-[10px] tracking-[0.3em] text-lens/40 lg:block" style={{ left: 'calc(max(24px, 2vw) + 12px)' }}>
            {String(active + 1).padStart(2, '0')} / {SLIDES[active].name.toUpperCase()}
          </p>

          <nav aria-label="Slides" className="absolute top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2.5 max-sm:hidden" style={{ right: 'max(14px, env(safe-area-inset-right, 0px), 1.6vw)' }}>
            {SLIDES.map((s, i) => (
              <button key={s.id} type="button" onClick={() => goTo(i)} aria-label={s.name} aria-current={active === i ? 'step' : undefined} className="group grid h-4 w-4 place-items-center">
                <span className={'block w-[3px] rounded-full transition-all duration-500 ' + (active === i ? 'h-4 bg-kapton' : 'h-[3px] bg-lens/35 group-hover:bg-lens/70')} />
              </button>
            ))}
          </nav>

          <div className={'pointer-events-none absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-2 transition-opacity duration-700 md:flex ' + (active === 0 ? 'opacity-100' : 'opacity-0')} aria-hidden="true">
            <span className="eyebrow text-[9px] text-lens/45">Scroll</span>
            <span className="scroll-cue h-9 w-px overflow-hidden bg-lens/15"><span className="block h-1/2 w-full bg-kapton" /></span>
          </div>
        </div>
      </div>
    </div>
  );
}
