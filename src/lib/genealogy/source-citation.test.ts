import { describe, expect, it } from 'vitest'

import { makeEvent } from './genealogical-event'
import {
  buildCitationsForMember,
  isQuayLevel,
  isSourceCategory,
  makeCitation,
  makeSource,
  sourQuayLines,
  QUAY_LEVELS,
  SOURCE_CATEGORIES,
  type GenealogicalCitation,
  type GenealogicalSource,
} from './source-citation'

const sumberAkta = (): GenealogicalSource =>
  makeSource({
    id: 'src-akta-01',
    title: 'Akta Kelahiran No. 12/1901 Notariat Bandung',
    category: 'birth',
    reference: 'Arsip Kota Bandung, lembar 3',
    author: 'Notariat Bandung',
  })

const eventBirt = () =>
  makeEvent({ id: 'evt-birt-1', kind: 'BIRT', date: '12 Agustus 1901', place: 'Bandung' })

const eventDeat = () =>
  makeEvent({ id: 'evt-deat-1', kind: 'DEAT', date: '2 Februari 1970' })

const eventMarr = () =>
  makeEvent({ id: 'evt-marr-1', kind: 'MARR', date: '10 Mei 1925' })

const memberDenganSumber = () => ({
  id: 'mem-001',
  sourceIds: ['src-akta-01', 'src-hilang'],
})

describe('makeSource (v419 AC2)', () => {
  it('membuat sumber lengkap dengan id, title, category, reference, dan author', () => {
    const source = sumberAkta()
    expect(source).toEqual({
      id: 'src-akta-01',
      title: 'Akta Kelahiran No. 12/1901 Notariat Bandung',
      category: 'birth',
      reference: 'Arsip Kota Bandung, lembar 3',
      author: 'Notariat Bandung',
      note: undefined,
    })
  })

  it('default category other bila tidak diberikan', () => {
    const source = makeSource({ id: 'src-x', title: 'Catatan keluarga' })
    expect(source.category).toBe('other')
  })

  it.each(['', '   ', undefined])('menolak id kosong %j', (id) => {
    expect(() => makeSource({ id: id as string, title: 'Judul' })).toThrow(/id sumber wajib/i)
  })

  it.each(['', '   ', undefined])('menolak title kosong %j', (title) => {
    expect(() => makeSource({ id: 'src-y', title: title as string })).toThrow(/title sumber wajib/i)
  })

  it('menolak category di luar SOURCE_CATEGORIES dengan pesan jelas', () => {
    expect(() =>
      makeSource({ id: 'src-z', title: 'Judul', category: 'arsip-langka' as never }),
    ).toThrow(/category sumber tidak dikenal/)
  })

  it('SOURCE_CATEGORIES berisi 6 kategori tanpa kode komersial', () => {
    expect(SOURCE_CATEGORIES).toHaveLength(6)
    expect(isSourceCategory('census')).toBe(true)
    expect(isSourceCategory('CENSUS')).toBe(false)
  })
})

describe('makeCitation (v419 AC2)', () => {
  it('membuat sitasi lengkap dengan quay eksplisit', () => {
    const citation = makeCitation({
      id: 'cit-1',
      sourceId: 'src-akta-01',
      memberId: 'mem-001',
      eventId: 'evt-birt-1',
      eventKind: 'BIRT',
      quay: 2,
      page: 'lembar 3',
    })
    expect(citation).toEqual({
      id: 'cit-1',
      sourceId: 'src-akta-01',
      memberId: 'mem-001',
      eventId: 'evt-birt-1',
      eventKind: 'BIRT',
      quay: 2,
      page: 'lembar 3',
      note: undefined,
    })
  })

  it('default quay 3 (bukti langsung) bila tidak diberikan', () => {
    const citation = makeCitation({
      id: 'cit-2',
      sourceId: 'src-akta-01',
      memberId: 'mem-001',
      eventId: 'evt-deat-1',
      eventKind: 'DEAT',
    })
    expect(citation.quay).toBe(3)
  })

  it.each(['BIRT', 'DEAT', 'MARR'] as const)('menerima eventKind %s', (kind) => {
    const citation = makeCitation({
      id: 'cit-k-' + kind,
      sourceId: 'src-akta-01',
      memberId: 'mem-001',
      eventId: 'evt-x',
      eventKind: kind,
    })
    expect(citation.eventKind).toBe(kind)
  })

  it('menolak eventKind di luar EVENT_KINDS', () => {
    expect(() =>
      makeCitation({
        id: 'cit-bad',
        sourceId: 'src-akta-01',
        memberId: 'mem-001',
        eventId: 'evt-x',
        eventKind: 'BAPM',
      }),
    ).toThrow(/eventKind sitasi tidak dikenal/)
  })

  it.each([4, -1, 1.5, NaN])('menolak quay tidak valid %j', (quay) => {
    expect(() =>
      makeCitation({
        id: 'cit-q',
        sourceId: 'src-akta-01',
        memberId: 'mem-001',
        eventId: 'evt-x',
        eventKind: 'MARR',
        quay: quay as never,
      }),
    ).toThrow(/quay sitasi/)
  })

  it.each(['', '   ', undefined])('menolak sourceId kosong %j', (sourceId) => {
    expect(() =>
      makeCitation({
        id: 'cit-s',
        sourceId: sourceId as string,
        memberId: 'mem-001',
        eventId: 'evt-x',
        eventKind: 'BIRT',
      }),
    ).toThrow(/sourceId sitasi wajib/i)
  })

  it('QUAY_LEVELS tepat 0 sampai 3 dan isQuayLevel konsisten', () => {
    expect(QUAY_LEVELS).toEqual([0, 1, 2, 3])
    expect(isQuayLevel(0)).toBe(true)
    expect(isQuayLevel(3)).toBe(true)
    expect(isQuayLevel('3')).toBe(false)
  })
})

describe('buildCitationsForMember (v419 AC2)', () => {
  it('memetakan event BIRT/DEAT/MARR dikali sourceId valid menjadi citation', () => {
    const citations = buildCitationsForMember(
      memberDenganSumber(),
      [eventBirt(), eventDeat(), eventMarr()],
      [sumberAkta()],
    )
    expect(citations).toHaveLength(3)
    expect(citations.map((c: GenealogicalCitation) => c.eventKind)).toEqual(['BIRT', 'DEAT', 'MARR'])
    expect(citations.every((c: GenealogicalCitation) => c.sourceId === 'src-akta-01')).toBe(true)
    expect(citations.every((c: GenealogicalCitation) => c.memberId === 'mem-001')).toBe(true)
    expect(citations[0]?.id).toBe('cit-mem-001-birt-src-akta-01')
  })

  it('melewatkan sourceId yang tidak ada di katalog sources (tanpa citation menggantung)', () => {
    const citations = buildCitationsForMember(
      memberDenganSumber(),
      [eventBirt()],
      [sumberAkta()],
    )
    expect(citations).toHaveLength(1)
    expect(citations[0]?.id).toBe('cit-mem-001-birt-src-akta-01')
  })

  it('member tanpa sourceIds menghasilkan daftar kosong tanpa error', () => {
    const citations = buildCitationsForMember({ id: 'mem-002' }, [eventBirt()], [sumberAkta()])
    expect(citations).toEqual([])
  })

  it('options.quay diteruskan ke semua citation hasil', () => {
    const citations = buildCitationsForMember(
      memberDenganSumber(),
      [eventDeat()],
      [sumberAkta()],
      { quay: 1 },
    )
    expect(citations[0]?.quay).toBe(1)
  })

  it('sourQuayLines menghasilkan baris pola SOUR/QUAY GEDCOM 7, PAGE hanya bila ada', () => {
    const denganPage = makeCitation({
      id: 'cit-p',
      sourceId: 'src-akta-01',
      memberId: 'mem-001',
      eventId: 'evt-birt-1',
      eventKind: 'BIRT',
      quay: 3,
      page: 'lembar 3',
    })
    expect(sourQuayLines(denganPage)).toEqual([
      '1 SOUR @src-akta-01@',
      '2 QUAY 3',
      '2 PAGE lembar 3',
    ])

    const tanpaPage = makeCitation({
      id: 'cit-np',
      sourceId: 'src-akta-01',
      memberId: 'mem-001',
      eventId: 'evt-deat-1',
      eventKind: 'DEAT',
      quay: 0,
    })
    expect(sourQuayLines(tanpaPage)).toEqual(['1 SOUR @src-akta-01@', '2 QUAY 0'])
  })
})
