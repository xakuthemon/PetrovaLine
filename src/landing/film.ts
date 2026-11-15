/*
 * The landing film: a list of slides and the scroll map between them.
 * Each slide has a "hold" (the 3D stage rests on the slide while its inner
 * progress u runs 0 → 1) followed by a "travel" to the next slide (k 0 → 1).
 * Lengths are in viewport heights of scroll.
 */
import type { SceneId } from '../engine/scenes';

export type SlideId = 'hero' | 'craft' | 'waves' | 'cover' | 'water' | 'forest' | 'fault' | 'ice' | 'outro';

export interface Place {
  scene: SceneId;
  lat: number; lon: number;
  coords: string; where: string;
  /** before / after months (from Jan 2020); "after" is an interferogram when insar is set */
  a: number; b: number; insar?: boolean;
  caption: string;
}

export interface Slide {
  id: SlideId;
  name: string;
  hold: number;
  /** place slides: the simulated scene and where it is */
  place?: Place;
}

export const SLIDES: Slide[] = [
  { id: 'hero', name: 'Orbital choreography', hold: 0.5 },
  { id: 'craft', name: 'The spacecraft', hold: 0.9 },
  { id: 'waves', name: 'Two wavelengths', hold: 0.9 },
  { id: 'cover', name: 'Twelve days', hold: 1.3 },
  { id: 'water', name: 'Water', hold: 1.3, place: { scene: 'caspian', lat: 43.6, lon: 51.2, coords: '43.6° N · 51.2° E', where: 'Aktau, Caspian Sea', a: 0, b: 80, caption: 'new land' } },
  { id: 'forest', name: 'Forest', hold: 1.3, place: { scene: 'pantanal', lat: -17.8, lon: -57.5, coords: '17.8° S · 57.5° W', where: 'Pantanal, Brazil', a: 33, b: 40, caption: 'flooded' } },
  { id: 'fault', name: 'Fault', hold: 1.3, place: { scene: 'fault', lat: 37.6, lon: 36.9, coords: '37.6° N · 36.9° E', where: 'Kahramanmaraş, Türkiye', a: 36, b: 38, insar: true, caption: 'ground motion' } },
  { id: 'ice', name: 'Ice', hold: 1.3, place: { scene: 'glacier', lat: 69.2, lon: -49.8, coords: '69.2° N · 49.8° W', where: 'Jakobshavn, Greenland', a: 6, b: 78, caption: 'ice surface lost' } },
  { id: 'outro', name: 'Earth in motion', hold: 0.6 },
];

export const TRAVEL = 0.9;
export const LAST = SLIDES.length - 1;

/** total scroll length of the film, in viewport heights (the stage itself adds one more) */
export const FILM_VH = SLIDES.reduce((s, x) => s + x.hold, 0) + TRAVEL * LAST;

export interface FilmPos {
  /** current slide */
  i: number;
  /** progress through the slide's hold, 0..1 */
  u: number;
  /** progress of the travel toward slide i + 1, 0..1 (0 while holding) */
  k: number;
}

/** @param s scroll position in viewport heights */
export function locate(s: number): FilmPos {
  let pos = 0;
  for (let i = 0; i < SLIDES.length; i++) {
    const h = SLIDES[i].hold;
    if (s < pos + h) return { i, u: Math.max(0, (s - pos) / h), k: 0 };
    pos += h;
    if (i < LAST) {
      if (s < pos + TRAVEL) return { i, u: 1, k: (s - pos) / TRAVEL };
      pos += TRAVEL;
    }
  }
  return { i: LAST, u: 1, k: 0 };
}

/** scroll position (viewport heights) where slide i's hold begins */
export function slideStart(i: number): number {
  let pos = 0;
  for (let j = 0; j < i; j++) pos += SLIDES[j].hold + TRAVEL;
  return pos;
}

/** the slide that owns the screen: switches halfway through a travel */
export const activeSlide = (f: FilmPos): number => (f.k > 0.5 ? f.i + 1 : f.i);

const ease5 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));
const step = (a: number, b: number, x: number) => ease5(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** 12-day coverage: tracks flown so far (of 173) during the "cover" hold */
export const coverCount = (u: number): number => 4 + 169 * step(0.04, 0.92, u);
/** before → after scan across a place slab during its hold */
export const scanAt = (u: number): number => step(0.12, 0.85, u);
