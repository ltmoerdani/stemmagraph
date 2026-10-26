/**
 * Unit test v404 AC1: tema poster data murni.
 *
 * Kontrak inti: default palette harus IDENTIK dengan konstanta S-10 di
 * palette.ts (anti-regresi visual), ketiga tema lengkap 7 token flat sRGB
 * tanpa dependency, dan resolvePosterPalette deterministik untuk tiap kind.
 */
import { describe, it, expect } from 'vitest';
import {
  PAGE_BG,
  NODE_FILL,
  NODE_BORDER,
  NAME_TEXT,
  CONNECTOR,
  TITLE_TEXT,
  TRIM_FRAME,
} from './palette';
import {
  DEFAULT_POSTER_PALETTE,
  BATIK_POSTER_PALETTE,
  SONGKET_POSTER_PALETTE,
  DEFAULT_POSTER_THEME,
  resolvePosterPalette,
  type PosterThemePalette,
} from './theme';

/** palette.ts direkonstruksi sebagai palette untuk perbandingan langsung. */
const LEGACY_IVORY: PosterThemePalette = {
  pageBg: PAGE_BG,
  nodeFill: NODE_FILL,
  nodeBorder: NODE_BORDER,
  nameText: NAME_TEXT,
  connector: CONNECTOR,
  titleText: TITLE_TEXT,
  trimFrame: TRIM_FRAME,
};

const ALL_PALETTES: Array<[string, PosterThemePalette]> = [
  ['default', DEFAULT_POSTER_PALETTE],
  ['batik', BATIK_POSTER_PALETTE],
  ['songket', SONGKET_POSTER_PALETTE],
];

const SEVEN_TOKEN_KEYS: Array<keyof PosterThemePalette> = [
  'pageBg',
  'nodeFill',
  'nodeBorder',
  'nameText',
  'connector',
  'titleText',
  'trimFrame',
];

describe('poster themes (v404 AC1)', () => {
  it('default palette copies the S-10 ivory values from palette.ts exactly', () => {
    expect(DEFAULT_POSTER_PALETTE).toEqual(LEGACY_IVORY);
  });

  it('every theme defines exactly the seven tokens', () => {
    for (const [label, palette] of ALL_PALETTES) {
      expect(Object.keys(palette).sort(), label).toEqual(
        [...SEVEN_TOKEN_KEYS].sort()
      );
    }
  });

  it('every token is a flat #RRGGBB sRGB hex (no alpha, no gradient)', () => {
    for (const [label, palette] of ALL_PALETTES) {
      for (const key of SEVEN_TOKEN_KEYS) {
        expect(palette[key], `${label}.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('batik and songket differ from the default on at least one token', () => {
    expect(BATIK_POSTER_PALETTE).not.toEqual(DEFAULT_POSTER_PALETTE);
    expect(SONGKET_POSTER_PALETTE).not.toEqual(DEFAULT_POSTER_PALETTE);
  });

  it('default theme id is "default" and resolves to the ivory palette', () => {
    expect(DEFAULT_POSTER_THEME).toBe('default');
    expect(resolvePosterPalette(DEFAULT_POSTER_THEME)).toBe(
      DEFAULT_POSTER_PALETTE
    );
  });

  it('resolvePosterPalette is deterministic and total over known kinds', () => {
    expect(resolvePosterPalette('batik')).toBe(BATIK_POSTER_PALETTE);
    expect(resolvePosterPalette('songket')).toBe(SONGKET_POSTER_PALETTE);
    // Dua panggilan identik mengembalikan objek yang sama (data murni).
    expect(resolvePosterPalette('batik')).toBe(resolvePosterPalette('batik'));
  });

  it('resolvePosterPalette throws on an unknown theme kind', () => {
    expect(() =>
      resolvePosterPalette('unknown' as never)
    ).toThrow(/Unknown poster theme/);
  });
});
