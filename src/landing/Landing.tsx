/*
 * The landing: a scroll-driven presentation over one WebGL stage. Scroll moves the
 * camera between slides; each slide's few words build in when it takes the screen.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import Lenis from 'lenis';
import { ArrowUpRight, ChevronDown, MonitorDown } from 'lucide-react';
import { createLandingScene, type LandingHandle } from '../three/landingScene';
import { SLIDES, FILM_VH, LAST, locate, slideStart, activeSlide, coverCount, scanAt, type Place } from './film';
import { loadSlab } from './slabData';
import { useMission } from '../state/mission';
import { useInstall } from '../hooks/useInstall';
import { lerp, monthLabel, reducedMotion } from '../engine/util';
import type { SceneId } from '../engine/scenes';
import { Mark, Wordmark } from '../brand/Logo';

/** words that rise out of a mask when the slide builds in */
function Words({ text }: { text: string }) {
  const w = text.split(' ');
  return (
    <>
      {w.map((x, i) => (
        <span key={i}><span className="rise-mask"><span data-w className="rise">{x}</span></span>{i < w.length - 1 ? ' ' : ''}</span>
      ))}
    </>
  );
}
const Dot = () => <span className="rise-mask"><span data-w className="rise text-crimson">.</span></span>;

/** a number that counts up when its slide builds in */
function Count({ value, dec = 0, sign = '' }: { value: number; dec?: number; sign?: string }) {
  return <span data-count={value} data-dec={dec} data-sign={sign}>{sign + value.toFixed(dec)}</span>;
}
function parseFigure(s: string): { sign: string; value: number; dec: number; unit: string } | null {
  const m = /^([−-]?)\s*(\d+(?:\.(\d+))?)\s*(.*)$/.exec(s.trim());
  return m ? { sign: m[1] ? '−' : '', value: parseFloat(m[2]), dec: m[3] ? m[3].length : 0, unit: m[4] } : null;
}
const Small = ({ children, className = '' }: { children: ReactNode; className?: string }) => <p data-f className={'text-[15px] text-cream/70 ' + className}>{children}</p>;

export default function Landing({ hold = false }: { hold?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const anchor = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLSpanElement>(null);
  const dateRefs = useRef<Record<number, { label: HTMLSpanElement | null; bar: HTMLSpanElement | null }>>({});
  const sceneRef = useRef<LandingHandle | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const introRef = useRef<gsap.core.Timeline | null>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [figures, setFigures] = useState<Partial<Record<SceneId, string>>>({});
  const [noGl, setNoGl] = useState(false);
  const setMode = useMission((s) => s.setMode);
  const { canInstall, install } = useInstall();
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
      const n = SLIDES[f.i].id === 'cover' ? coverCount(f.u) : f.i > 3 ? 173 : 4;
      if (dayRef.current) dayRef.current.textContent = String(Math.max(1, Math.ceil((n / 173) * 12)));
      const pl = SLIDES[f.i].place, r = dateRefs.current[f.i];
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
        node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        node.style.opacity = (activeRef.current === 0 ? p.on : 0).toFixed(3);
      };
      if (!reduced) {
        const it = scene.intro;
        introRef.current = gsap.timeline({ paused: true })
          .to(it, { push: 1, duration: 3.4, ease: 'expo.out' }, 0)
          .to(it, { ring: 1, duration: 2.1, ease: 'power3.inOut' }, 0)
          .to(it, { globe: 1, duration: 2.2, ease: 'power2.out' }, 0.2)
          .to(it, { trail: 1, duration: 1.8, ease: 'power3.inOut' }, 0.5)
          .to(it, { orbits: 1, duration: 2.8, ease: 'power2.out' }, 0.8)
          .to(it, { sats: 1, duration: 1.2, ease: 'power1.out' }, 1.6);
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
    }, reduced ? 0 : 2400);

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

  // the intro waits for the launch screen
  useEffect(() => { if (!hold) introRef.current?.play(); }, [hold]);

  /* builds: the outgoing slide clears, the incoming one builds */
  const shown = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (hold) return;
    const prev = shown.current;
    shown.current = active;
    const out = prev !== null ? sections.current[prev] : null;
    const inn = sections.current[active];
    const q = (n: HTMLElement | null | undefined, s: string) => (n ? Array.from(n.querySelectorAll<HTMLElement>(s)) : []);
    const to = (t: HTMLElement[], v: gsap.TweenVars) => { if (t.length) gsap.to(t, v); };
    const fromTo = (t: HTMLElement[], a: gsap.TweenVars, v: gsap.TweenVars) => { if (t.length) gsap.fromTo(t, a, v); };
    if (out && out !== inn) {
      gsap.killTweensOf([out, ...q(out, '[data-w],[data-f]')]);
      if (reduced) gsap.set(out, { autoAlpha: 0 });
      else {
        to(q(out, '[data-w]'), { yPercent: -110, duration: 0.5, ease: 'power3.in', stagger: 0.015 });
        to(q(out, '[data-f]'), { autoAlpha: 0, y: -12, duration: 0.35, ease: 'power2.in' });
        gsap.to(out, { autoAlpha: 0, duration: 0.2, delay: 0.5 });
      }
    }
    if (!inn) return;
    gsap.killTweensOf([inn, ...q(inn, '[data-w],[data-f]')]);
    gsap.set(inn, { autoAlpha: 1 });
    if (reduced) {
      const w = q(inn, '[data-w]'), f = q(inn, '[data-f]');
      if (w.length) gsap.set(w, { yPercent: 0 });
      if (f.length) gsap.set(f, { autoAlpha: 1, y: 0 });
      return;
    }
    const d0 = prev === null ? 0.45 : 0.18;
    fromTo(q(inn, '[data-w]'), { yPercent: 112, rotate: 2 }, { yPercent: 0, rotate: 0, duration: 1.15, ease: 'expo.out', stagger: 0.06, delay: d0 });
    fromTo(q(inn, '[data-f]'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, delay: d0 + 0.3 });
    q(inn, '[data-count]').forEach((n, i) => {
      const to2 = parseFloat(n.dataset.count || '0'), dec = parseInt(n.dataset.dec || '0', 10), sign = n.dataset.sign || '';
      const o = { v: 0 };
      gsap.to(o, { v: to2, duration: 1.5, ease: 'power3.out', delay: d0 + 0.2 + i * 0.12, onUpdate: () => { n.textContent = sign + o.v.toFixed(dec); } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, figures, hold]);

  const reg = (i: number) => (n: HTMLElement | null) => { sections.current[i] = n; };
  const slide = 'slide absolute inset-0 flex';
  const pad = { paddingLeft: 'max(24px, env(safe-area-inset-left, 0px), 6vw)', paddingRight: 'max(24px, env(safe-area-inset-right, 0px), 6vw)' };

  const placeSlide = (i: number, word: string, p: Place) => {
    const fig = figures[p.scene] ? parseFigure(figures[p.scene]!) : null;
    return (
      <section key={i} ref={reg(i)} className={slide + ' flex-col justify-start pb-12 pt-[15vh] wide:justify-center wide:pt-0 short:pt-[80px]'} style={pad} aria-label={word}>
        <div className="max-w-[640px]">
          <Small>{p.where}</Small>
          <h2 className="display mt-3 whitespace-nowrap text-[clamp(76px,10.5vw,176px)] short:text-[64px]"><Words text={word} /><Dot /></h2>
          <p data-f className="display num mt-5 flex items-baseline gap-2 text-[clamp(40px,4.4vw,70px)] short:mt-2 short:text-[34px]">
            {fig ? <><Count value={fig.value} dec={fig.dec} sign={fig.sign} /><span className="text-[0.46em] font-medium tracking-normal text-cream/75">{fig.unit}</span></> : <span className="text-cream/30">…</span>}
          </p>
          <Small className="mt-1">{p.caption}</Small>
          <div data-f className="num mt-7 flex max-w-[320px] items-center gap-3 text-[13px] text-cream/70 short:mt-3">
            <span>{monthLabel(p.a)}</span>
            <span className="relative h-[2px] flex-1 rounded-full bg-cream/15">
              <span ref={(n) => { (dateRefs.current[i] ||= { label: null, bar: null }).bar = n; }} className="absolute inset-0 origin-left rounded-full bg-crimson" style={{ transform: 'scaleX(0)' }} />
            </span>
            <span ref={(n) => { (dateRefs.current[i] ||= { label: null, bar: null }).label = n; }} className="min-w-[66px] text-right font-semibold text-cream">{monthLabel(p.a)}</span>
          </div>
          <button type="button" data-f onClick={() => openConsole(p.scene)} className="btn btn-ghost mt-7 short:mt-3">Explore <ArrowUpRight size={16} strokeWidth={1.8} /></button>
        </div>
      </section>
    );
  };

  return (
    <div ref={scroller} className="landing absolute inset-0 overflow-y-auto overflow-x-hidden" tabIndex={-1}>
      <div ref={content} style={{ height: (FILM_VH + 1) * 100 + '%' }}>
        <div className="stage sticky top-0 h-screen overflow-hidden [height:100dvh]">
          <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          {noGl && <div className="absolute inset-0 grid place-items-center"><Mark className="w-[min(70vw,520px)] opacity-80" /></div>}
          <div className={'scrim pointer-events-none absolute inset-0 z-[5] transition-opacity duration-1000 ' + (SLIDES[active].place ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
          <div className={'scrim-low pointer-events-none absolute inset-0 z-[5] transition-opacity duration-1000 wide:hidden ' + (active > 0 && active < 4 ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />

          {/* NISAR tag riding the spacecraft */}
          <div ref={anchor} className="pointer-events-none absolute left-0 top-0 z-10 opacity-0 max-sm:hidden" aria-hidden="true">
            <span className="absolute left-4 top-0 -translate-y-1/2 whitespace-nowrap text-[13px] font-medium text-cream/85">NISAR</span>
          </div>

          {/* 1 · title */}
          <section ref={reg(0)} className={slide + ' flex-col justify-end pb-[11vh] wide:justify-center wide:pb-[8vh] short:pb-[8vh]'} style={pad} aria-label="Petrova Line">
            <h1 className="display max-w-[11ch] text-[clamp(52px,7.4vw,128px)] short:text-[44px]">
              <span className="block"><Words text="Nothing on Earth" /></span>
              <span className="block"><Words text="stands still" /><Dot /></span>
            </h1>
            <div className="mt-9 flex flex-wrap items-center gap-3 short:mt-5">
              <button type="button" data-f onClick={() => openConsole()} className="btn btn-cream h-12 px-6 text-[15px]">Open the app <ArrowUpRight size={18} strokeWidth={1.8} /></button>
            </div>
          </section>

          {/* 2 · spacecraft */}
          <section ref={reg(1)} className={slide + ' flex-col justify-end pb-[11vh] wide:justify-center wide:pb-0'} style={pad} aria-label="The spacecraft">
            <div>
              <p className="display text-[clamp(110px,15vw,250px)] leading-[0.85] short:text-[96px]"><Words text="12 m" /></p>
              <Small className="mt-4">mesh reflector</Small>
            </div>
          </section>

          {/* 3 · two wavelengths */}
          <section ref={reg(2)} className={slide + ' flex-col justify-end pb-[10vh] wide:justify-center wide:pb-0'} style={pad} aria-label="Two wavelengths">
            <div className="flex flex-col gap-5 short:gap-2">
              {([['24', 'L-band', 'text-crimson'], ['9.4', 'S-band', 'text-steel']] as const).map(([v, l, tc]) => (
                <div key={l} className="flex items-end gap-4">
                  <p className={'display text-[clamp(84px,10vw,168px)] leading-[0.82] short:text-[72px] ' + tc}><Words text={v} /></p>
                  <div className="pb-1.5">
                    <p data-f className="display text-[clamp(26px,2.6vw,42px)] leading-none">cm</p>
                    <p data-f className="mt-2 text-[14px] text-cream/70">{l}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4 · repeat cycle */}
          <section ref={reg(3)} className={slide + ' flex-col justify-end pb-[10vh] wide:justify-center wide:pb-0'} style={pad} aria-label="Twelve days">
            <div>
              <p className="display text-[clamp(96px,12vw,200px)] leading-[0.85] short:text-[80px]"><Words text="12 days" /></p>
              <Small className="num mt-4">Day <span ref={dayRef} className="font-semibold text-cream">1</span></Small>
            </div>
          </section>

          {SLIDES.map((s, i) => (s.place ? placeSlide(i, s.name, s.place) : null))}

          {/* 9 · end */}
          <section ref={reg(LAST)} className={slide + ' flex-col items-center justify-end pb-[9vh] text-center short:pb-[6vh]'} style={pad} aria-label="Petrova Line">
            <p data-f className="text-[clamp(22px,3.4vw,46px)] text-cream"><Wordmark /></p>
            <p data-f className="mt-4 font-mono text-[clamp(13px,1.3vw,16px)] tracking-[0.12em] text-cream/75">λ 25.984 µm</p>
            <button type="button" data-f onClick={() => openConsole()} className="btn btn-cream mt-9 h-12 px-6 text-[15px] short:mt-5">Open the app <ArrowUpRight size={18} strokeWidth={1.8} /></button>
            <p data-f className="mt-5 text-[12.5px] text-fog">Simulated radar scenes · NASA Blue Marble imagery</p>
          </section>

          {/* chrome */}
          <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 pt-[calc(env(safe-area-inset-top,0px)+18px)]" style={pad}>
            <button type="button" onClick={() => goTo(0)} className="flex items-center gap-3 text-cream" aria-label="Petrova Line, back to the start">
              <Mark className="h-[22px] w-auto" /><Wordmark className="text-[11.5px] max-[380px]:hidden" />
            </button>
            <div className="flex items-center gap-1.5">
              {canInstall && <button type="button" className="icon-btn" onClick={install} aria-label="Install the app" title="Install the app"><MonitorDown size={18} strokeWidth={1.7} /></button>}
              <button type="button" onClick={() => openConsole()} className="btn btn-cream">Open app <ArrowUpRight size={16} strokeWidth={1.8} /></button>
            </div>
          </header>

          <nav aria-label="Slides" className="absolute top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 max-sm:hidden short:hidden" style={{ right: 'max(14px, env(safe-area-inset-right, 0px), 1.6vw)' }}>
            {SLIDES.map((s, i) => (
              <button key={s.id} type="button" onClick={() => goTo(i)} aria-label={s.name} aria-current={active === i ? 'step' : undefined} title={s.name} className="group grid h-4 w-4 place-items-center">
                <span className={'block w-[3px] rounded-full transition-all duration-500 ' + (active === i ? 'h-4 bg-crimson' : 'h-[3px] bg-cream/35 group-hover:bg-cream/70')} />
              </button>
            ))}
          </nav>

          <button type="button" onClick={() => goTo(1)} aria-label="Next slide"
            className={'absolute bottom-[calc(env(safe-area-inset-bottom,0px)+18px)] left-1/2 z-20 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full text-cream/70 transition-opacity duration-700 hover:text-cream max-md:hidden ' + (active === 0 && !hold ? 'opacity-100' : 'pointer-events-none opacity-0')}>
            <ChevronDown size={22} strokeWidth={1.6} className="animate-bounce [animation-duration:2.2s]" />
          </button>
        </div>
      </div>
    </div>
  );
}
