/**
 * Harness benchmark render canvas v447 (test-only).
 *
 * Mengikuti pola infrastruktur __perf__ v177-i: pengukuran User Timing
 * (performance.mark/measure) di sekitar render callback, distribusi frame
 * time (rata-rata, p95, p99), hitungan long task di atas 50 ms, dan
 * usedJSHeapSize pasca GC manual tiga sampel median bila API tersedia.
 *
 * Timestamp frame memakai requestAnimationFrame bila ada (jalur runner
 * browser v177-ii). Di environment node murni rAF tidak tersedia sehingga
 * fallback ke performance.now(); jalur keduanya dicatat di hasil.
 */

/** Long task threshold sesuai spesifikasi: 50 ms. */
export const LONG_TASK_THRESHOLD_MS = 50;

/** Jumlah sampel heap sesuai spesifikasi: GC manual lalu baca 3 sampel. */
const HEAP_SAMPLES = 3;

/**
 * Timestamp frame: rAF bila tersedia, fallback performance.now().
 * Nilai kembali dalam milidetik (rAF memberi DOMHighResTimeStamp ms).
 */
const nextFrameTimestamp = (): Promise<number> => {
  const raf = (
    globalThis as {
      requestAnimationFrame?: ((cb: (ts: number) => void) => number) | undefined;
    }
  ).requestAnimationFrame;
  if (typeof raf === 'function') {
    return new Promise((resolve) => raf((ts: number) => resolve(ts)));
  }
  return Promise.resolve(performance.now());
};

/** Median daftar angka; null bila kosong. */
export const computeMedian = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Persentil p (0..100) dari daftar frame time; null bila kosong. */
export const computePercentile = (values: number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? null;
};

/** Rata-rata frame time; null bila kosong. */
export const computeAvg = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

interface MemoryLike {
  usedJSHeapSize: number;
}

/**
 * Sampel usedJSHeapSize pasca GC manual, median tiga baca.
 * Bila performance.memory tidak ada (node murni), coba
 * performance.measureMemory(); bila keduanya tidak ada, null.
 */
export const sampleHeapMedianBytes = async (): Promise<number | null> => {
  const perf = performance as Performance & {
    memory?: MemoryLike;
    measureMemory?: () => Promise<{ bytes: number }>;
  };
  const g = globalThis as { gc?: () => void };
  if (typeof perf.memory?.usedJSHeapSize === 'number') {
    g.gc?.();
    const samples: number[] = [];
    for (let i = 0; i < HEAP_SAMPLES; i += 1) {
      g.gc?.();
      samples.push(perf.memory.usedJSHeapSize);
    }
    return computeMedian(samples);
  }
  if (typeof perf.measureMemory === 'function') {
    try {
      g.gc?.();
      const result = await perf.measureMemory();
      return typeof result.bytes === 'number' ? result.bytes : null;
    } catch {
      return null;
    }
  }
  return null;
};

export interface RenderBenchmarkOptions {
  /** Nama unik untuk mark/measure User Timing. */
  label: string;
  /** Jumlah frame yang diukur. */
  frames: number;
  /** Frame pemanasan yang tidak dihitung (default 3, meredam bias JIT). */
  warmupFrames?: number;
  /** Render callback yang diukur tiap frame (sinkron). */
  renderFrame: () => void;
}

export interface RenderBenchmarkResult {
  label: string;
  frameTimesMs: number[];
  avgFrameMs: number | null;
  p95FrameMs: number | null;
  p99FrameMs: number | null;
  longTaskCount: number;
  measureCount: number;
  heapMedianBytes: number | null;
  timestampSource: 'requestAnimationFrame' | 'performance.now';
}

/**
 * Menjalankan benchmark: tiap frame dibungkus mark/measure User Timing
 * dengan timestamp frame dari rAF (fallback performance.now()). Frame
 * time = durasi measure callback; long task = frame di atas 50 ms.
 * Frame pemanasan dijalankan dulu tanpa dicatat supaya biaya JIT
 * (compile, inline cache) tidak membiaskan frame terukur.
 */
export const runRenderBenchmark = async (
  opts: RenderBenchmarkOptions
): Promise<RenderBenchmarkResult> => {
  const rafProbe = (
    globalThis as { requestAnimationFrame?: unknown }
  ).requestAnimationFrame;
  const timestampSource: RenderBenchmarkResult['timestampSource'] =
    typeof rafProbe === 'function' ? 'requestAnimationFrame' : 'performance.now';

  const frameTimesMs: number[] = [];
  let measureCount = 0;

  // Timestamp frame pertama menandakan sinkronisasi layar (jalur browser);
  // di node fallback ini langsung berupa performance.now().
  await nextFrameTimestamp();

  const warmup = opts.warmupFrames ?? 3;
  for (let i = 0; i < warmup; i += 1) {
    opts.renderFrame();
  }

  for (let i = 0; i < opts.frames; i += 1) {
    await nextFrameTimestamp();
    const startName = `${opts.label}:f${i}:start`;
    const endName = `${opts.label}:f${i}:end`;
    const measureName = `${opts.label}:f${i}`;
    performance.mark(startName);
    opts.renderFrame();
    performance.mark(endName);
    performance.measure(measureName, startName, endName);
    const entries = performance.getEntriesByName(measureName);
    const last = entries[entries.length - 1];
    if (last) {
      frameTimesMs.push(last.duration);
      measureCount += 1;
    }
  }

  // Bersihkan User Timing buffer supaya run berikutnya tidak menumpuk entri.
  for (let i = 0; i < opts.frames; i += 1) {
    performance.clearMarks(`${opts.label}:f${i}:start`);
    performance.clearMarks(`${opts.label}:f${i}:end`);
    performance.clearMeasures(`${opts.label}:f${i}`);
  }

  const heapMedianBytes = await sampleHeapMedianBytes();

  return {
    label: opts.label,
    frameTimesMs,
    avgFrameMs: computeAvg(frameTimesMs),
    p95FrameMs: computePercentile(frameTimesMs, 95),
    p99FrameMs: computePercentile(frameTimesMs, 99),
    longTaskCount: frameTimesMs.filter((t) => t > LONG_TASK_THRESHOLD_MS).length,
    measureCount,
    heapMedianBytes,
    timestampSource,
  };
};
