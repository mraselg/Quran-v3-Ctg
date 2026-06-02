import type { MeasureRequest, MeasureResponse } from './textMeasureWorker';

let worker: Worker | null = null;
const callbacks = new Map<string, (res: MeasureResponse) => void>();

export function initMeasureWorker() {
  if (typeof window === 'undefined') return;
  if (!worker) {
    worker = new Worker(new URL('./textMeasureWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<MeasureResponse>) => {
      const cb = callbacks.get(e.data.id);
      if (cb) {
        cb(e.data);
        callbacks.delete(e.data.id);
      }
    };
  }
}

export function measureAreaTextAsync(
  text: string, widthPx: number, heightPx: number, 
  fontFamily: string, fontPx: number, leadingMult: number
): Promise<MeasureResponse> {
  return new Promise((resolve) => {
    if (!worker) initMeasureWorker();
    const id = Math.random().toString(36).substring(7);
    callbacks.set(id, resolve);
    worker!.postMessage({
      id, text, widthPx, heightPx, fontFamily, fontPx, leadingMult
    } satisfies MeasureRequest);
  });
}
