/**
 * Poster font registry (S-10).
 *
 * Fonts are LOCAL OFL-licensed Noto builds served from public/fonts, never
 * fetched from the internet at render time. In the browser the loader uses a
 * same-origin fetch; in Node (dev harness) it reads the files from disk.
 *
 * Every embedded font is subset at embed time, so the shipped PDF only
 * carries the glyphs it actually draws.
 */

/** Script bucket a character belongs to. */
export type PosterScript = 'latin' | 'javanese' | 'balinese';

/** Raw font bytes per script bucket. Optional buckets fall back to latin. */
export interface PosterFontBundle {
  latin: Uint8Array;
  javanese?: Uint8Array;
  balinese?: Uint8Array;
}

/** File names inside public/fonts (see docs/fonts-ofl.md). */
const FONT_FILES: Record<PosterScript, string> = {
  latin: 'NotoSans/NotoSans-Regular.ttf',
  javanese: 'NotoSansJavanese/NotoSansJavanese-Regular.ttf',
  balinese: 'NotoSansBalinese/NotoSansBalinese-Regular.ttf',
};

/** Javanese block: U+A980 to U+A9DF. */
function isJavanese(code: number): boolean {
  return code >= 0xa980 && code <= 0xa9df;
}

/** Balinese block: U+1B00 to U+1B7F. */
function isBalinese(code: number): boolean {
  return code >= 0x1b00 && code <= 0x1b7f;
}

/** Classifies one character into a script bucket (default: latin). */
export function classifyChar(ch: string): PosterScript {
  const code = ch.codePointAt(0) ?? 0;
  if (isJavanese(code)) return 'javanese';
  if (isBalinese(code)) return 'balinese';
  return 'latin';
}

/** Consecutive run of characters sharing one script bucket. */
export interface ScriptRun {
  script: PosterScript;
  text: string;
}

/** Splits a string into per-script runs for font selection. */
export function splitScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  for (const ch of Array.from(text)) {
    const script = classifyChar(ch);
    const last = runs[runs.length - 1];
    if (last && last.script === script) {
      last.text += ch;
    } else {
      runs.push({ script, text: ch });
    }
  }
  return runs;
}

/**
 * Loads the default font bundle in the BROWSER via a same-origin fetch of
 * the bundled assets under /fonts (no internet involved).
 *
 * The Node dev harness does not use this loader: it reads the same files
 * from disk and injects them through RenderPosterOptions.fonts.
 */
export async function loadPosterFonts(): Promise<PosterFontBundle> {
  const load = async (file: string): Promise<Uint8Array | undefined> => {
    try {
      const res = await fetch(`/fonts/${file}`);
      if (!res.ok) return undefined;
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      return undefined;
    }
  };

  const [latin, javanese, balinese] = await Promise.all([
    load(FONT_FILES.latin),
    load(FONT_FILES.javanese),
    load(FONT_FILES.balinese),
  ]);
  if (!latin) {
    throw new Error(
      'Poster font NotoSans-Regular.ttf not found under public/fonts'
    );
  }
  return {
    latin,
    javanese: javanese ?? undefined,
    balinese: balinese ?? undefined,
  };
}
