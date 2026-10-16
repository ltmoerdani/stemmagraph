// OG image rasterization for public share links (ADR 0010 upgrade path).
//
// The SVG builder stays pure and dependency-free; this module is the
// only place that knows about the native renderer. The binding is an
// optionalDependency: npm ci succeeds without it (platform bindings
// can be skipped), every raster call resolves it lazily via a dynamic
// import, and an unavailable binding surfaces as OgRasterUnavailable
// so the route can fall back to the existing SVG response instead of
// failing the request.

import { SHARE_OG_IMAGE_WIDTH, SHARE_OG_IMAGE_HEIGHT } from './og-image';

/** The SVG could not be rasterized because the binding is unusable. */
export class OgRasterUnavailable extends Error {
  constructor(reason: string) {
    super(`OG rasterization unavailable: ${reason}`);
    this.name = 'OgRasterUnavailable';
  }
}

/** Non-literal specifier keeps TS tooling happy when the optional dep is absent. */
const RESVG_SPECIFIER = '@resvg/resvg-js';

interface ResvgRenderOptions {
  fitTo?: { mode: 'width' | 'height' | 'original'; value?: number }
}

interface ResvgInstance {
  render(): { asPng(): Uint8Array }
}

interface ResvgCtor {
  new (svg: string, options?: ResvgRenderOptions): ResvgInstance
}

/**
 * Rasterizes one SVG document (the share OG builder output) to PNG
 * bytes at the shared 1200x630 Open Graph size. Lazy import means the
 * server and every existing test keep working on installs where the
 * optional native binding is missing or fails to load.
 */
export async function ogSvgToPng(svg: string): Promise<Uint8Array> {
  let Resvg: ResvgCtor;
  try {
    const mod = (await import(/* @vite-ignore */ RESVG_SPECIFIER)) as {
      Resvg: ResvgCtor
    };
    Resvg = mod.Resvg;
  } catch (e) {
    throw new OgRasterUnavailable(`binding @resvg/resvg-js could not load: ${(e as Error).message}`);
  }

  let png: Uint8Array;
  try {
    const instance = new Resvg(svg, {
      fitTo: { mode: 'width', value: SHARE_OG_IMAGE_WIDTH },
    });
    png = instance.render().asPng();
  } catch (e) {
    throw new OgRasterUnavailable(`render failed: ${(e as Error).message}`);
  }

  if (png.byteLength === 0) {
    throw new OgRasterUnavailable('render produced an empty image');
  }
  return png;
}

/** Dimensions asserted on raster output, re-exported for the route tests. */
export const OG_RASTER_WIDTH = SHARE_OG_IMAGE_WIDTH;
export const OG_RASTER_HEIGHT = SHARE_OG_IMAGE_HEIGHT;

/**
 * Resolves the SHARE_OG_FORMAT env value. Anything other than the
 * exact string 'png' keeps the v1 SVG behavior, so an unset or typo'd
 * value is byte-identical to the pre-raster route.
 */
export function resolveOgFormat(env: string | undefined): 'png' | 'svg' {
  return env === 'png' ? 'png' : 'svg';
}

export type OgImageResponse =
  | { kind: 'png'; contentType: 'image/png'; body: Buffer }
  | { kind: 'svg'; contentType: 'image/svg+xml'; body: string };

/**
 * Builds the og-image response body for one resolved format. When png
 * is requested but rasterization is unavailable, the honest fallback
 * (ADR 0010) is the unchanged SVG response with a warning, never a 500.
 */
export async function buildOgImageResponse(
  svg: string,
  format: 'png' | 'svg',
  raster: (input: string) => Promise<Uint8Array> = ogSvgToPng,
): Promise<OgImageResponse> {
  if (format === 'png') {
    try {
      const png = await raster(svg);
      return { kind: 'png', contentType: 'image/png', body: Buffer.from(png) };
    } catch (e) {
      if (!(e instanceof OgRasterUnavailable)) throw e;
      console.warn('[share] og raster unavailable, falling back to SVG:', e.message);
    }
  }
  return { kind: 'svg', contentType: 'image/svg+xml', body: svg };
}
