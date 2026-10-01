// Unit test geometry helpers poster (v201-i, karakterisasi first-hand).
//
// geometry.ts murni penuh (tanpa DOM, tanpa pdf-lib) sehingga semua export
// diuji langsung di Node: konstanta satuan, resolvePaper, measureNodes,
// computePlacement, mapper layout ke halaman, dan fitNameFont.
// Angka pecahan diverifikasi dengan toBeCloseTo (floating point mm/pt).

import { describe, expect, it } from 'vitest'
import {
  BLEED_MM,
  DEFAULT_PAPER_KIND,
  ISO_PAPER_SIZES_MM,
  POSTER_NAME_FONT_PT,
  POSTER_NAME_MIN_PT,
  POSTER_PAPER_PRESETS,
  POSTER_TITLE_FONT_PT,
  PT_PER_MM,
  SAFE_MARGIN_MM,
  computePlacement,
  fitNameFont,
  layoutScale,
  layoutToPageX,
  layoutToPageY,
  measureNodes,
  mmToPt,
  resolvePaper,
} from './geometry'
import type { PosterNodePosition } from './types'

function pos(x: number, y: number, width: number, height: number): PosterNodePosition {
  return { x, y, width, height }
}

describe('konstanta satuan dan kertas', () => {
  it('PT_PER_MM = 72/25.4', () => {
    expect(PT_PER_MM).toBeCloseTo(2.83464566929, 8)
  })

  it('BLEED_MM = 0.125 inci dalam mm', () => {
    expect(BLEED_MM).toBeCloseTo(3.175, 8)
  })

  it('SAFE_MARGIN_MM = 10', () => {
    expect(SAFE_MARGIN_MM).toBe(10)
  })

  it('ISO_PAPER_SIZES_MM presisi A4 sampai A0', () => {
    expect(ISO_PAPER_SIZES_MM.a4).toEqual([210, 297])
    expect(ISO_PAPER_SIZES_MM.a3).toEqual([297, 420])
    expect(ISO_PAPER_SIZES_MM.a2).toEqual([420, 594])
    expect(ISO_PAPER_SIZES_MM.a1).toEqual([594, 841])
    expect(ISO_PAPER_SIZES_MM.a0).toEqual([841, 1189])
  })

  it('DEFAULT_PAPER_KIND = a1', () => {
    expect(DEFAULT_PAPER_KIND).toBe('a1')
  })

  it('POSTER_PAPER_PRESETS lima kertas ISO portrait', () => {
    expect(POSTER_PAPER_PRESETS).toHaveLength(5)
    expect(POSTER_PAPER_PRESETS.map((p) => p.kind)).toEqual(['a4', 'a3', 'a2', 'a1', 'a0'])
    expect(POSTER_PAPER_PRESETS[0]).toEqual({ kind: 'a4', widthMm: 210, heightMm: 297 })
    expect(POSTER_PAPER_PRESETS[4]).toEqual({ kind: 'a0', widthMm: 841, heightMm: 1189 })
  })

  it('konstanta font judul dan nama', () => {
    expect(POSTER_NAME_FONT_PT).toBe(9)
    expect(POSTER_NAME_MIN_PT).toBe(4.5)
    expect(POSTER_TITLE_FONT_PT).toBe(22)
  })
})

describe('mmToPt', () => {
  it('konversi dasar 1 inci', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 8)
  })

  it('konversi lebar A4', () => {
    expect(mmToPt(210)).toBeCloseTo(595.27559055, 6)
  })

  it('nol tetap nol', () => {
    expect(mmToPt(0)).toBe(0)
  })
})

describe('resolvePaper', () => {
  it('kertas ISO a4 memakai tabel', () => {
    expect(resolvePaper('a4')).toEqual({ kind: 'a4', widthMm: 210, heightMm: 297 })
  })

  it('kertas ISO a0 memakai tabel', () => {
    expect(resolvePaper('a0')).toEqual({ kind: 'a0', widthMm: 841, heightMm: 1189 })
  })

  it('custom valid memakai dimensi yang diberi', () => {
    expect(resolvePaper('custom', { widthMm: 300, heightMm: 500 })).toEqual({
      kind: 'custom',
      widthMm: 300,
      heightMm: 500,
    })
  })

  it('custom tanpa dimensi ditolak', () => {
    expect(() => resolvePaper('custom')).toThrow()
  })

  it('custom lebar nol ditolak', () => {
    expect(() => resolvePaper('custom', { widthMm: 0, heightMm: 500 })).toThrow()
  })

  it('custom tinggi negatif ditolak', () => {
    expect(() => resolvePaper('custom', { widthMm: 300, heightMm: -1 })).toThrow()
  })
})

describe('measureNodes', () => {
  it('bounding box mencakup x,y sampai x+width,y+height', () => {
    const box = measureNodes([pos(10, 20, 100, 40), pos(50, 0, 30, 200)])
    expect(box.minX).toBe(10)
    expect(box.minY).toBe(0)
    expect(box.maxX).toBe(110)
    expect(box.maxY).toBe(200)
    expect(box.width).toBe(100)
    expect(box.height).toBe(200)
  })

  it('satu node menghasilkan box ukuran node', () => {
    const box = measureNodes([pos(5, 7, 11, 13)])
    expect(box).toEqual({ minX: 5, minY: 7, maxX: 16, maxY: 20, width: 11, height: 13 })
  })

  it('himpunan kosong ditolak', () => {
    expect(() => measureNodes([])).toThrow('Cannot measure an empty node set')
  })
})

describe('computePlacement', () => {
  const a4 = resolvePaper('a4')
  const content = { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 }

  it('skala dibatasi sisi lebar pada konten persegi di a4', () => {
    const placement = computePlacement(a4, content)
    const chrome = mmToPt(SAFE_MARGIN_MM + BLEED_MM)
    const gap = mmToPt(2)
    const availW = mmToPt(210) - 2 * chrome - 2 * gap
    const availH = mmToPt(297) - 2 * chrome - 2 * gap
    expect(placement.scale).toBeCloseTo(Math.min(availW, availH) / 100, 8)
    expect(placement.scale).toBeCloseTo(availW / 100, 8)
  })

  it('offset memusatkan konten di halaman', () => {
    const placement = computePlacement(a4, content)
    const drawnW = 100 * placement.scale
    const drawnH = 100 * placement.scale
    const leftPt = layoutToPageX(0, placement)
    const rightPt = layoutToPageX(100, placement)
    expect((leftPt + rightPt) / 2).toBeCloseTo(mmToPt(210) / 2, 6)
    expect(rightPt - leftPt).toBeCloseTo(drawnW, 8)
    const bottomPt = layoutToPageY(100, placement)
    const topPt = layoutToPageY(0, placement)
    expect((topPt + bottomPt) / 2).toBeCloseTo(mmToPt(297) / 2, 6)
    expect(topPt - bottomPt).toBeCloseTo(drawnH, 8)
  })

  it('extraTopMm menyusutkan tinggi tersedia dan membatasi skala', () => {
    // Konten tinggi (height-bound): availH adalah faktor pembatas skala,
    // sehingga extraTopMm benar-benar menurunkan skala hasil.
    const tall = { minX: 0, minY: 0, maxX: 100, maxY: 300, width: 100, height: 300 }
    const base = computePlacement(a4, tall)
    const withTop = computePlacement(a4, tall, { extraTopMm: 30 })
    expect(withTop.scale).toBeLessThan(base.scale)
    const chrome = mmToPt(SAFE_MARGIN_MM + BLEED_MM)
    const gap = mmToPt(2)
    const availH = mmToPt(297) - 2 * chrome - 2 * gap - mmToPt(30)
    expect(withTop.scale).toBeCloseTo(availH / 300, 8)
    expect(base.scale).toBeCloseTo((mmToPt(297) - 2 * chrome - 2 * gap) / 300, 8)
    // Konten persegi di A4 tetap width-bound: skala tidak berubah walau
    // tinggi tersedia menyusut (availH-withTop masih > availW).
    const squareBase = computePlacement(a4, content)
    const squareTop = computePlacement(a4, content, { extraTopMm: 30 })
    expect(squareTop.scale).toBe(squareBase.scale)
  })

  it('contentBoxPt adalah halaman dikurangi chrome dua sisi', () => {
    const placement = computePlacement(a4, content)
    const chrome = mmToPt(SAFE_MARGIN_MM + BLEED_MM)
    expect(placement.contentBoxPt).toEqual({
      x: chrome,
      y: chrome,
      width: mmToPt(210) - 2 * chrome,
      height: mmToPt(297) - 2 * chrome,
    })
    expect(placement.chromePt).toBeCloseTo(chrome, 8)
    expect(placement.bleedPt).toBeCloseTo(mmToPt(BLEED_MM), 8)
  })

  it('lebar konten nol ditolak', () => {
    expect(() =>
      computePlacement(a4, { minX: 0, minY: 0, maxX: 0, maxY: 10, width: 0, height: 10 }),
    ).toThrow('Layout bounding box must have positive width and height')
  })

  it('kertas terlalu kecil untuk chrome ditolak', () => {
    const tiny = { kind: 'custom' as const, widthMm: 5, heightMm: 5 }
    expect(() => computePlacement(tiny, content)).toThrow('Paper too small')
  })
})

describe('mapper layout ke halaman', () => {
  const a4 = resolvePaper('a4')
  const placement = computePlacement(a4, {
    minX: 0,
    minY: 0,
    maxX: 100,
    maxY: 100,
    width: 100,
    height: 100,
  })

  it('layoutToPageX linear terhadap offset dan skala', () => {
    expect(layoutToPageX(0, placement)).toBeCloseTo(placement.offsetXPt, 8)
    expect(layoutToPageX(40, placement)).toBeCloseTo(placement.offsetXPt + 40 * placement.scale, 8)
  })

  it('layoutToPageY membalik sumbu Y ke arah halaman', () => {
    expect(layoutToPageY(0, placement)).toBeCloseTo(
      placement.pageHeightPt - placement.offsetYPt,
      8,
    )
    expect(layoutToPageY(10, placement)).toBeLessThan(layoutToPageY(0, placement))
  })

  it('layoutScale mengalikan dengan skala penempatan', () => {
    expect(layoutScale(7, placement)).toBeCloseTo(7 * placement.scale, 8)
    expect(layoutScale(0, placement)).toBe(0)
  })
})

describe('fitNameFont', () => {
  const linear = (text: string, sizePt: number) => text.length * 10 * (sizePt / 9)

  it('nama muat tetap di ukuran dasar tanpa clamp', () => {
    const fit = fitNameFont('Ani', linear, 100)
    expect(fit).toEqual({ sizePt: 9, clamped: false, overflow: false })
  })

  it('nama panjang mengecil dalam dekremen 0.5 pt sampai muat', () => {
    // linear('Ani', 9pt) = 30pt; box 28pt memaksa decrement 9 → 8.5 → 8
    // (8.5pt = 28.33pt masih lebar; 8pt = 26.67pt muat).
    const fit = fitNameFont('Ani', linear, 28)
    expect(fit.clamped).toBe(true)
    expect(fit.overflow).toBe(false)
    expect(fit.sizePt).toBe(8)
  })

  it('nama sangat panjang mengunci di minPt dengan overflow', () => {
    // Box 10pt: bahkan di minPt 4.5pt ('Ani' = 15pt) masih overflow.
    const fit = fitNameFont('Ani', linear, 10)
    expect(fit).toEqual({ sizePt: 4.5, clamped: true, overflow: true })
  })

  it('minPt kustom non kelipatan 0.5 dikembalikan saat loop melampaui', () => {
    // Box 27.8pt: loop 9 → 8.5 (28.33pt, masih lebar) → 8.0; 8.0 < minPt 8.2
    // sehingga dikembalikan ke 8.2pt; measure(8.2pt) = 27.33pt tetap muat.
    const fit = fitNameFont('Ani', linear, 27.8, 9, 8.2)
    expect(fit.clamped).toBe(true)
    expect(fit.sizePt).toBe(8.2)
    expect(fit.overflow).toBe(false)
  })

  it('basePt kustom dipakai sebagai titik awal', () => {
    const fit = fitNameFont('Ani', linear, 1000, 22, 4.5)
    expect(fit).toEqual({ sizePt: 22, clamped: false, overflow: false })
  })

  it('lebar box pas batas dianggap muat (bukan lebih besar)', () => {
    const fit = fitNameFont('Ani', linear, 90)
    expect(fit).toEqual({ sizePt: 9, clamped: false, overflow: false })
  })
})
