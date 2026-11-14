/*
 * Main-thread side of the slab renderer: one worker, one request at a time, cached results.
 */
import type { SceneId } from '../engine/scenes';
import type { SlabResult } from './slab.worker';
import SlabWorker from './slab.worker?worker&inline';

export type { SlabResult };

const cache = new Map<SceneId, Promise<SlabResult>>();
let worker: Worker | null = null;
let chain: Promise<unknown> = Promise.resolve();

function run(id: SceneId): Promise<SlabResult> {
  if (!worker) worker = new SlabWorker();
  const w = worker;
  return new Promise<SlabResult>((resolve, reject) => {
    const done = (ev: MessageEvent<SlabResult>) => { if (ev.data.id !== id) return; w.removeEventListener('message', done); resolve(ev.data); };
    w.addEventListener('message', done);
    w.addEventListener('error', (e) => reject(e), { once: true });
    w.postMessage({ id });
  });
}

/** Render (once) the before / after images and relief for a scene. Requests run one after another. */
export function loadSlab(id: SceneId): Promise<SlabResult> {
  let p = cache.get(id);
  if (!p) {
    p = chain.then(() => run(id));
    chain = p.catch(() => undefined);
    cache.set(id, p);
  }
  return p;
}
