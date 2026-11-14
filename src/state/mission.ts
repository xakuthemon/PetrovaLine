/*
 * Petrova Line — the single mission state every control reads and writes.
 */
import { create } from 'zustand';
import { clamp, M_MAX } from '../engine/util';
import type { BandId } from '../engine/physics';
import type { SceneId } from '../engine/scenes';
import type { Channel, MapStats, ProbeInfo, Sensor } from '../engine/mapEngine';
import type { Mechanism } from '../engine/render';
import { caseById } from '../data/cases';

export type Mode = 'story' | 'console';
export const MODES: Mode[] = ['story', 'console'];

export interface MissionState {
  mode: Mode;
  caseId: SceneId;
  /** bumps on every case change: drives the retarget lock-on animation */
  retarget: number;
  /** baseline month (date A) and current month (date B), 0 = Jan 2020 … 80 = Sep 2026 */
  a: number;
  m: number;
  sensor: Sensor;
  channel: Channel;
  band: BandId;
  split: number;
  sweep: boolean;
  playing: boolean;
  speed: number;
  mechanism: Mechanism | null;
  clouds: boolean;
  change: boolean;
  drawerOpen: boolean;
  exportOpen: boolean;
  aboutOpen: boolean;
  /** place names drawn on the map */
  labels: boolean;
  /** pixel under the cursor, and the pixel pinned by a click */
  probe: ProbeInfo | null;
  pinned: ProbeInfo | null;
  stats: MapStats;

  setMode(mode: Mode): void;
  setCase(id: SceneId): void;
  setM(m: number): void;
  setA(a: number): void;
  setSensor(s: Sensor): void;
  setChannel(c: Channel): void;
  setBand(b: BandId): void;
  setSplit(v: number): void;
  toggleSweep(): void;
  setPlaying(p: boolean): void;
  setSpeed(s: number): void;
  setMechanism(m: Mechanism | null): void;
  toggle(key: 'clouds' | 'change' | 'drawerOpen' | 'labels'): void;
  setExportOpen(o: boolean): void;
  setAboutOpen(o: boolean): void;
  setDrawer(o: boolean): void;
  setProbe(p: ProbeInfo | null): void;
  setPinned(p: ProbeInfo | null): void;
  setStats(s: MapStats): void;
}

function readHash(): Mode {
  try {
    const h = window.location.hash.replace('#', '');
    if (h === 'console') return 'console';
  } catch { /* hash unavailable */ }
  return 'story';
}
function writeHash(mode: Mode): void {
  try {
    if (window.location.hash !== '#' + mode) window.location.hash = mode;
  } catch { /* hash unavailable */ }
}

const first = caseById('caspian');

export const useMission = create<MissionState>((set, get) => ({
  mode: readHash(),
  caseId: 'caspian',
  retarget: 0,
  a: first.defaults.a,
  m: first.defaults.m,
  sensor: 'sar',
  channel: first.defaults.channel,
  band: 'L',
  split: first.defaults.split,
  sweep: false,
  playing: false,
  speed: 1,
  mechanism: null,
  clouds: true,
  change: false,
  drawerOpen: typeof window === 'undefined' ? true : window.innerWidth >= 1024,
  exportOpen: false,
  aboutOpen: false,
  labels: false,
  probe: null,
  pinned: null,
  stats: { mechShare: null, meanCoh: 1, sky: null },

  setMode(mode) {
    if (mode !== 'console') set({ playing: false, sweep: false });
    set({ mode });
    writeHash(mode);
  },
  setCase(id) {
    const d = caseById(id).defaults;
    set((s) => ({
      caseId: id, retarget: s.retarget + 1, a: d.a, m: d.m, channel: d.channel, split: d.split, sensor: 'sar',
      mechanism: null, pinned: null, probe: null, playing: false, sweep: false, change: false,
    }));
  },
  setM(m) { set({ m: clamp(m, 0, M_MAX) }); },
  setA(a) { set({ a: clamp(Math.round(a), 0, M_MAX) }); },
  setSensor(sensor) { set({ sensor, ...(sensor === 'optical' ? { mechanism: null, sweep: false } : {}) }); },
  setChannel(channel) { set({ channel, sensor: 'sar' }); },
  setBand(band) { set({ band, sensor: 'sar' }); },
  setSplit(v) { set({ split: clamp(v, 0.02, 0.98) }); },
  toggleSweep() { set((s) => ({ sweep: !s.sweep, sensor: 'sar' })); },
  setPlaying(playing) {
    if (playing && get().m >= M_MAX - 0.01) set({ m: get().a < M_MAX - 1 ? get().a : 0 });
    set({ playing });
  },
  setSpeed(speed) { set({ speed }); },
  setMechanism(mechanism) { set({ mechanism, ...(mechanism ? { sensor: 'sar' as Sensor } : {}) }); },
  toggle(key) { set((s) => ({ [key]: !s[key] }) as Partial<MissionState>); },
  setExportOpen(exportOpen) { set({ exportOpen }); },
  setAboutOpen(aboutOpen) { set({ aboutOpen }); },
  setDrawer(drawerOpen) { set({ drawerOpen }); },
  setProbe(probe) { set({ probe }); },
  setPinned(pinned) { set({ pinned }); },
  setStats(stats) { set({ stats }); },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const mode = readHash();
    if (mode !== useMission.getState().mode) useMission.getState().setMode(mode);
  });
}

export const tOf = (month: number): number => 2020 + month / 12;

// exposed for automated checks
if (typeof window !== 'undefined') {
  const w = window as unknown as { __petrova: typeof useMission; __terrawaltz: typeof useMission };
  w.__petrova = useMission;
  w.__terrawaltz = useMission;
}
