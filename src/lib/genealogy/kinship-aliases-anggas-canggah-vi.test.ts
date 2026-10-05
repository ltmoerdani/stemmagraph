import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, resolveAlias } from './kinship-aliases'

// Evidence v240-i: tiga halaman resmi KBBI VI dibuka 4 Okt 2026 (laporan Sena sesi 227).
// anggas1 generasi keenam atau keturunan kelima; homonim anggas2 karang buatan (Mdr)
// dan anggas3 tali perut (Jw) tidak dipakai. canggah2 = piut, cucu dari cucu.
// piut satu makna tanpa sub-entri miut.
describe('kinship-aliases anggas dan canggah basis KBBI VI (v240-i)', () => {
  it('anggas positif: kind descendant depth 5', () => {
    const r = resolveAlias('anggas')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('descendant')
    expect(r?.depth).toBe(5)
  })

  it('anggas: normalisasi kapital dan spasi', () => {
    expect(resolveAlias('Anggas')?.depth).toBe(5)
    expect(resolveAlias('ANGGAS')?.kind).toBe('descendant')
    expect(resolveAlias('  anggas  ')?.depth).toBe(5)
  })

  it('note anggas memuat jangkar KBBI VI dan penanda homonim karang serta tali perut', () => {
    const note = KINSHIP_ALIASES['anggas'].note ?? ''
    expect(note).toContain('KBBI VI')
    expect(note).toContain('generasi keenam')
    expect(note).toContain('keturunan kelima')
    expect(note).toContain('karang')
    expect(note).toContain('tali perut')
  })

  it('canggah tetap kind descendant depth 4', () => {
    const r = resolveAlias('canggah')
    expect(r?.kind).toBe('descendant')
    expect(r?.depth).toBe(4)
  })

  it('note canggah memuat piut dan cucu dari cucu, note lama hilang', () => {
    const note = KINSHIP_ALIASES['canggah'].note ?? ''
    expect(note).toContain('KBBI VI')
    expect(note).toContain('piut')
    expect(note).toContain('cucu dari cucu')
    expect(note).not.toContain('padanan tidak langsung')
  })

  it('piut tetap kind descendant depth 4', () => {
    expect(resolveAlias('piut')).toEqual({ kind: 'descendant', depth: 4 })
  })

  it('cicit tetap kind descendant depth 3', () => {
    expect(resolveAlias('cicit')).toEqual({ kind: 'descendant', depth: 3 })
  })

  it('urutan kedalaman keturunan: cicit 3, piut dan canggah 4, anggas 5', () => {
    const depths = ['cicit', 'piut', 'canggah', 'anggas'].map(
      (k) => KINSHIP_ALIASES[k].depth,
    )
    expect(depths).toEqual([3, 4, 4, 5])
  })

  it('regensi: kakek, nenek, aki, datuk, eyang tidak berubah', () => {
    expect(KINSHIP_ALIASES['kakek']).toEqual({ kind: 'grandparent' })
    expect(KINSHIP_ALIASES['nenek']).toEqual({ kind: 'grandparent' })
    expect(KINSHIP_ALIASES['aki']).toEqual({ kind: 'grandparent', region: 'Sunda' })
    expect(KINSHIP_ALIASES['datuk']).toMatchObject({
      kind: 'grandparent',
      region: 'Melayu',
    })
    expect(KINSHIP_ALIASES['eyang']).toEqual({
      kind: 'grandparent',
      qualifier: 'jw',
      region: 'Jawa',
      register: 'hormat',
    })
  })

  it.each(['miut', 'ranggas', 'anggasan', 'anggas2', 'anggas3'])(
    'lemma tak dikenal %j tidak membentuk alias',
    (phrase) => {
      expect(resolveAlias(phrase)).toBeNull()
      expect(KINSHIP_ALIASES[phrase]).toBeUndefined()
    },
  )

  it.each(['anggas', 'canggah', 'piut'])(
    'struktur record %s konsisten: kind string, depth angka, note bila ada berupa string',
    (key) => {
      const e = KINSHIP_ALIASES[key]
      expect(typeof e.kind).toBe('string')
      expect(typeof e.depth).toBe('number')
      if (e.note !== undefined) {
        expect(typeof e.note).toBe('string')
        expect(e.note.length).toBeGreaterThan(0)
      }
    },
  )

  it('anggas dan canggah tidak memuat qualifier, region, atau register', () => {
    for (const key of ['anggas', 'canggah']) {
      const e = KINSHIP_ALIASES[key]
      expect(e.qualifier).toBeUndefined()
      expect(e.region).toBeUndefined()
      expect(e.register).toBeUndefined()
    }
  })
})
