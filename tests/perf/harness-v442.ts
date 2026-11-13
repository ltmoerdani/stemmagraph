/**
 * Helper bersama runner perf v442 (test-only).
 *
 * Pola diambil dari canvas-drag.pwtest.ts v395: sampling rAF, drag node
 * kontinu, pan/zoom kontinu. Tambah v442: pembacaan initial load dari
 * host bench dan pembukaan host dengan mode visibility opsional.
 */
import type { Page } from '@playwright/test';

export const BENCH_HOST_URL = 'http://localhost:5201/tests/perf/host/canvas-bench.html';

export interface FrameDeltas {
  deltas: number[];
}

/** Sampling delta rAF selama durationMs; timestamp dari callback rAF. */
export const collectFrameStats = async (page: Page, durationMs: number): Promise<FrameDeltas> =>
  page.evaluate(
    (dur) =>
      new Promise<{ deltas: number[] }>((resolve) => {
        const deltas: number[] = [];
        const start = performance.now();
        let last = start;
        const tick = (now: number) => {
          deltas.push(now - last);
          last = now;
          if (now - start < dur) {
            requestAnimationFrame(tick);
          } else {
            resolve({ deltas });
          }
        };
        requestAnimationFrame(tick);
      }),
    durationMs,
  );

/** Buka host bench dan tunggu sinyal __perfReady; kembalikan load ms. */
export const openBenchHost = async (
  page: Page,
  nodes: number,
  mode?: 'on' | 'off',
): Promise<number> => {
  const modeParam = mode ? `&perfVisibility=${mode}` : '';
  await page.goto(`${BENCH_HOST_URL}?nodes=${nodes}${modeParam}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => (window as unknown as { __perfReady?: boolean }).__perfReady === true,
    undefined,
    { timeout: 90_000 },
  );
  return page.evaluate(() => (window as unknown as { __perfLoadMs?: number }).__perfLoadMs ?? 0);
};

/**
 * Sampel usedJSHeapSize pasca GC manual via CDP HeapProfiler (AC3).
 * Mengembalikan daftar byte sebanyak `samples`; 0 berarti metric
 * tidak tersedia (non-chromium). Session CDP di-detach setelah selesai.
 */
export const sampleHeapAfterGc = async (page: Page, samples = 3): Promise<number[]> => {
  const values: number[] = [];
  let cdp: { send: (m: string) => Promise<unknown>; detach: () => Promise<void> } | null = null;
  try {
    cdp = await page.context().newCDPSession(page);
  } catch {
    return values;
  }
  for (let i = 0; i < samples; i += 1) {
    try {
      await cdp.send('HeapProfiler.collectGarbage');
    } catch {
      break;
    }
    await page.waitForTimeout(250);
    const bytes = await page.evaluate(
      () =>
        (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
        0,
    );
    values.push(bytes);
  }
  await cdp.detach().catch(() => undefined);
  return values;
};

/**
 * Probe beginFrame CDP (HeadlessExperimental) sekali di awal (AC3).
 * Mengembalikan true bila domain tersedia; false berarti mode headless
 * yang dipakai tidak mendukung beginFrame dan pengukuran tetap via rAF.
 */
export const probeBeginFrame = async (page: Page): Promise<boolean> => {
  let cdp: { send: (m: string) => Promise<unknown>; detach: () => Promise<void> };
  try {
    cdp = await page.context().newCDPSession(page);
  } catch {
    return false;
  }
  let ok = false;
  try {
    await cdp.send('HeadlessExperimental.beginFrame', { noDisplayUpdates: true });
    ok = true;
  } catch {
    ok = false;
  }
  await cdp.detach().catch(() => undefined);
  return ok;
};

/** Titik awal drag: node target bila ketemu, cadangan node pertama, pane terakhir. */
export const grabPoint = async (
  page: Page,
  selector?: string,
): Promise<{ x: number; y: number } | null> => {
  const target = selector
    ? page.locator(selector).first()
    : page.locator('.react-flow__node').first();
  const box = await target.boundingBox().catch(() => null);
  if (box) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const pane = page.locator('.react-flow__pane').first();
  const paneBox = await pane.boundingBox().catch(() => null);
  if (paneBox) {
    return { x: paneBox.x + paneBox.width / 2, y: paneBox.y + paneBox.height / 2 };
  }
  return null;
};

/** Drag satu node kontinu sampai deadline, gerak bolak-balik kecil. */
export const dragNodeContinuous = async (
  page: Page,
  start: { x: number; y: number },
  durationMs: number,
): Promise<void> => {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const deadline = Date.now() + durationMs;
  let i = 0;
  while (Date.now() < deadline) {
    const offset = i % 20 < 10 ? (i % 10) * 4 : (10 - (i % 10)) * 4;
    await page.mouse.move(start.x + offset, start.y + offset / 2, { steps: 2 });
    i += 1;
  }
  await page.mouse.up();
};

/** Zoom wheel kontinu in-out sampai deadline (React Flow: wheel = zoom). */
export const zoomContinuous = async (page: Page, durationMs: number): Promise<void> => {
  const pane = page.locator('.react-flow__pane').first();
  const box = await pane.boundingBox().catch(() => null);
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    for (let i = 0; i < 10 && Date.now() < deadline; i += 1) {
      await page.mouse.wheel(0, 120);
    }
    for (let i = 0; i < 10 && Date.now() < deadline; i += 1) {
      await page.mouse.wheel(0, -120);
    }
  }
};
