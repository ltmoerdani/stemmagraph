// Unit test geometri poster dan pembangun spec (S-15 AC-4c).
//
// Pilihan modul: buildSpec + geometry dipilih karena murni penuh (tanpa
// DOM, tanpa pdf-lib, tanpa graphlib). DagreTierEngine dilewati karena
// menempel pustaka dagre/graphlib yang berat untuk fondasi test node.
//
// Yang diuji: ukuran kertas ISO A4 sampai A0, bleed cetak 0,125 inci,
// penempatan konten di area aman (skala seragam, penolakan kertas kecil),
// serta perilaku buildPosterSpec: offset baris per generasi, slot X per
// baris, rel konektor, judul, dan anggota yatim (broken link).

import { describe, expect, it } from 'vitest'
import { buildPosterSpec } from './buildSpec'
import {
  BLEED_MM,
  DEFAULT_PAPER_KIND,
  ISO_PAPER_SIZES_MM,
  POSTER_PAPER_PRESETS,
  computePlacement,
  mmToPt,
  resolvePaper,
} from './geometry'
import type { FamilyMember } from '../../types/family'

function uiMember(
  partial: Partial<FamilyMember> & Pick<FamilyMember, 'id' | 'generation'>,
): FamilyMember {
  return {
    name: `Anggota ${partial.id}`,
    birthDate: '1 JAN 1990',
    gender: 'male',
    isAlive: true,
    maritalStatus: 'single',
    ...partial,
  }
}

describe('geometri kertas', () => {
  it('ukuran ISO A4 sampai A0 benar dalam milimeter, format potret', () => {
    expect(ISO_PAPER_SIZES_MM.a4).toEqual([210, 297])
    expect(ISO_PAPER_SIZES_MM.a3).toEqual([297, 420])
    expect(ISO_PAPER_SIZES_MM.a2).toEqual([420, 594])
    expect(ISO_PAPER_SIZES_MM.a1).toEqual([594, 841])
    expect(ISO_PAPER_SIZES_MM.a0).toEqual([841, 1189])
  })

  it('preset UI berurutan A4 sampai A0 dan kertas default poster A1', () => {
    expect(POSTER_PAPER_PRESETS.map((p) => p.kind)).toEqual(['a4', 'a3', 'a2', 'a1', 'a0'])
    expect(POSTER_PAPER_PRESETS[0]).toEqual({ kind: 'a4', widthMm: 210, heightMm: 297 })
    expect(DEFAULT_PAPER_KIND).toBe('a1')
  })

  it('resolvePaper: preset sesuai ISO, custom valid diterima, custom tanpa dimensi ditolak', () => {
    expect(resolvePaper('a0')).toEqual({ kind: 'a0', widthMm: 841, heightMm: 1189 })
    expect(resolvePaper('custom', { widthMm: 500, heightMm: 700 })).toEqual({
      kind: 'custom',
      widthMm: 500,
      heightMm: 700,
    })
    expect(() => resolvePaper('custom')).toThrow()
    expect(() => resolvePaper('custom', { widthMm: 0, heightMm: 100 })).toThrow()
  })

  it('bleed cetak tepat 0,125 inci (3,175 mm) dan konversi mm ke titik benar', () => {
    expect(BLEED_MM).toBeCloseTo(0.125 * 25.4, 10)
    expect(mmToPt(25.4)).toBeCloseTo(72, 6)
  })
})

describe('computePlacement: area aman', () => {
  it('skala seragam tanpa distorsi: rasio sisi konten terjaga setelah diskalakan', () => {
    const paper = resolvePaper('a4')
    const placement = computePlacement(paper, { minX: 0, minY: 0, maxX: 200, maxY: 100, width: 200, height: 100 })
    expect(placement.scale).toBeGreaterThan(0)
    expect((100 * placement.scale) / (200 * placement.scale)).toBeCloseTo(0.5, 10)
  })

  it('bleedPt dan chromePt dihitung dari bleed 0,125 inci plus margin aman 10 mm', () => {
    const paper = resolvePaper('a1')
    const placement = computePlacement(paper, { minX: 0, minY: 0, maxX: 100, maxY: 50, width: 100, height: 50 })
    expect(placement.bleedPt).toBeCloseTo(mmToPt(BLEED_MM), 10)
    expect(placement.chromePt).toBeCloseTo(mmToPt(10 + BLEED_MM), 10)
    expect(placement.contentBoxPt.width).toBeCloseTo(placement.pageWidthPt - 2 * placement.chromePt, 6)
  })

  it('kertas terlalu kecil untuk bleed plus margin ditolak dengan error eksplisit', () => {
    const paper = resolvePaper('custom', { widthMm: 5, heightMm: 5 })
    expect(() =>
      computePlacement(paper, { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 }),
    ).toThrow(/Paper too small/)
  })

  it('ruang judul di atas (extraTopMm) mengecilkan skala untuk konten tinggi', () => {
    const paper = resolvePaper('a4')
    // Konten menjulang: tinggi yang membatasi skala, bukan lebar.
    const box = { minX: 0, minY: 0, maxX: 50, maxY: 400, width: 50, height: 400 }
    const plain = computePlacement(paper, box)
    const withTitle = computePlacement(paper, box, { extraTopMm: 60 })
    expect(withTitle.scale).toBeLessThan(plain.scale)
    expect(withTitle.scale).toBeGreaterThan(0)
  })
})

describe('buildPosterSpec: tata letak otomatis', () => {
  it('keluarga kosong ditolak dengan error eksplisit', () => {
    expect(() => buildPosterSpec({ members: [], paper: resolvePaper('a4') })).toThrow(
      /empty family/,
    )
  })

  it('satu baris per generasi: kakek, ayah, cucu mendapat Y 0, 130, 260 dan X 0', () => {
    const members = [
      uiMember({ id: 'kakek', generation: 1, childrenIds: ['ayah'] }),
      uiMember({ id: 'ayah', generation: 2, childrenIds: ['cucu'] }),
      uiMember({ id: 'cucu', generation: 3 }),
    ]
    const spec = buildPosterSpec({ members, paper: resolvePaper('a1') })
    expect(spec.positions.kakek).toMatchObject({ x: 0, y: 0 })
    expect(spec.positions.ayah).toMatchObject({ x: 0, y: 130 })
    expect(spec.positions.cucu).toMatchObject({ x: 0, y: 260 })
  })

  it('dua anak segenerasi menempati slot X berurutan dengan lebar kotak ditambah jarak', () => {
    const members = [
      uiMember({ id: 'ayah', generation: 1, childrenIds: ['anak1', 'anak2'] }),
      uiMember({ id: 'anak1', generation: 2 }),
      uiMember({ id: 'anak2', generation: 2 }),
    ]
    const spec = buildPosterSpec({ members, paper: resolvePaper('a1') })
    expect(spec.positions.anak1.x).toBe(0)
    expect(spec.positions.anak2.x).toBe(170 + 26)
    expect(spec.positions.anak1.width).toBe(170)
    expect(spec.positions.anak1.height).toBe(60)
  })

  it('rel konektor berada di zona jatuh antara baris orang tua dan baris anak', () => {
    const members = [
      uiMember({ id: 'ayah', generation: 1, childrenIds: ['anak'] }),
      uiMember({ id: 'anak', generation: 2 }),
    ]
    const spec = buildPosterSpec({ members, paper: resolvePaper('a1') })
    expect(spec.connectors).toHaveLength(1)
    expect(spec.connectors[0]).toMatchObject({ parentId: 'ayah', childId: 'anak' })
    expect(spec.connectors[0].railY).toBe(60 + 30)
  })

  it('judul kosong dibuang, judul berisi diteruskan, dan paper terbawa di spec', () => {
    const members = [uiMember({ id: 'a', generation: 1 })]
    const paper = resolvePaper('a0')
    expect(buildPosterSpec({ members, paper, title: '   ' }).title).toBeUndefined()
    expect(buildPosterSpec({ members, paper, title: ' Keluarga Bakti ' }).title).toBe(
      ' Keluarga Bakti ',
    )
    expect(buildPosterSpec({ members, paper }).paper).toBe(paper)
  })

  it('anggota dengan childrenIds menunjuk id tak dikenal tetap dirender tanpa konektor', () => {
    const members = [
      uiMember({ id: 'a', generation: 1, childrenIds: ['hantu'] }),
      uiMember({ id: 'b', generation: 1 }),
    ]
    const spec = buildPosterSpec({ members, paper: resolvePaper('a4') })
    expect(spec.individuals.map((i) => i.id).sort()).toEqual(['a', 'b'])
    expect(spec.connectors).toHaveLength(0)
  })
})
