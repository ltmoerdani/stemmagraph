// Test round-trip GEDCOM 7.0 atas fixture 11 kelas kasus (v118-a).
//
// Pendekatan: parser-serializer baris minimal yang hanya dipakai di berkas
// ini. Dokumen diurai menjadi pohon node, diserialisasi kembali, lalu
// dibandingkan byte-exact dengan fixture aslinya. Invariant semantik per
// kelas kasus ditegakkan terpisah dari perbandingan byte.

import { describe, expect, it } from 'vitest'
import {
  JUMLAH_KELAS_KASUS,
  ROUND_TRIP_FIXTURES,
  type RoundTripFixture,
} from './roundTripGedcom70.fixtures'

interface GedLine {
  level: number
  xref: string | null
  tag: string
  payload: string
}

function parseLine(raw: string): GedLine {
  const parts = raw.split(' ')
  const level = Number.parseInt(parts[0] ?? '', 10)
  expect(Number.isInteger(level)).toBe(true)
  let cursor = 1
  let xref: string | null = null
  if (parts[cursor]?.startsWith('@')) {
    xref = parts[cursor] as string
    cursor += 1
  }
  const tag = parts[cursor] as string
  cursor += 1
  const payload = parts.slice(cursor).join(' ')
  return { level, xref, tag, payload }
}

function parseDocument(text: string): GedLine[] {
  return text.split('\n').filter((raw) => raw.length > 0).map(parseLine)
}

function serializeLine(line: GedLine): string {
  const pieces = [String(line.level)]
  if (line.xref !== null) pieces.push(line.xref)
  pieces.push(line.tag)
  if (line.payload.length > 0) pieces.push(line.payload)
  return pieces.join(' ')
}

function serializeDocument(lines: GedLine[]): string {
  return lines.map(serializeLine).join('\n') + '\n'
}

function findLines(lines: GedLine[], tag: string): GedLine[] {
  return lines.filter((line) => line.tag === tag)
}

function payloadOf(lines: GedLine[], tag: string): string[] {
  return findLines(lines, tag).map((line) => line.payload)
}

function fixtureById(id: string): RoundTripFixture {
  const found = ROUND_TRIP_FIXTURES.find((item) => item.id === id)
  expect(found, `fixture ${id} harus ada`).toBeDefined()
  return found as RoundTripFixture
}

describe('fixture suite round-trip GEDCOM 7.0', () => {
  it('mencakup tepat 11 kelas kasus dengan id unik', () => {
    expect(ROUND_TRIP_FIXTURES).toHaveLength(JUMLAH_KELAS_KASUS)
    expect(ROUND_TRIP_FIXTURES).toHaveLength(11)
    const ids = ROUND_TRIP_FIXTURES.map((item) => item.id)
    expect(new Set(ids).size).toBe(11)
  })

  it('setiap fixture berawalan HEAD GEDC 7.0 dan diakhiri TRLR', () => {
    for (const fixture of ROUND_TRIP_FIXTURES) {
      const lines = parseDocument(fixture.gedcom)
      expect(lines[0]?.tag).toBe('HEAD')
      expect(lines.at(-1)?.tag).toBe('TRLR')
      const vers = lines.find((line) => line.tag === 'VERS')
      expect(vers?.payload).toBe('7.0')
    }
  })

  it('round-trip byte-exact untuk seluruh fixture', () => {
    for (const fixture of ROUND_TRIP_FIXTURES) {
      const reparsed = serializeDocument(parseDocument(fixture.gedcom))
      expect(reparsed, `round-trip ${fixture.id}`).toBe(fixture.gedcom)
    }
  })

  it('setiap invariant fixture tetap ada setelah round-trip', () => {
    for (const fixture of ROUND_TRIP_FIXTURES) {
      const reparsed = serializeDocument(parseDocument(fixture.gedcom))
      for (const invariant of fixture.invariant) {
        expect(reparsed).toContain(invariant)
      }
    }
  })
})

describe('kelas kasus tanggal GEDCOM 7', () => {
  const kasusTanggal: Array<[string, string]> = [
    ['date-eksak', '2 OCT 1889'],
    ['date-from-to', 'FROM 1900 TO 1910'],
    ['date-bet-and', 'BET 1 JAN 1900 AND 31 DEC 1900'],
    ['date-abt', 'ABT 1885'],
    ['date-cal', 'CAL 1885'],
    ['date-est', 'EST 1885'],
  ]

  it.each(kasusTanggal)('%s mempertahankan payload DATE %s', (id, tanggal) => {
    const fixture = fixtureById(id)
    const lines = parseDocument(fixture.gedcom)
    expect(payloadOf(lines, 'DATE')).toEqual([tanggal])
  })

  it('phrase utuh dipertahankan apa adanya di dalam kurung', () => {
    const fixture = fixtureById('date-phrase')
    const lines = parseDocument(fixture.gedcom)
    const phrase = payloadOf(lines, 'DATE')[0]
    expect(phrase?.startsWith('(')).toBe(true)
    expect(phrase?.endsWith(')')).toBe(true)
    expect(phrase).toBe('(menurut batu nisan, terbaca samar)')
  })
})

describe('kelas kasus SEX M/F/X/U', () => {
  it('menyediakan tepat empat nilai SEX sesuai spek GEDCOM 7', () => {
    const fixture = fixtureById('sex-mf-x-u')
    const lines = parseDocument(fixture.gedcom)
    expect(payloadOf(lines, 'SEX')).toEqual(['M', 'F', 'X', 'U'])
  })
})

describe('kelas kasus @VOID@ CONT/CONC', () => {
  it('merekonstruksi teks NOTE dengan CONT sebagai baris baru dan CONC tersambung', () => {
    const fixture = fixtureById('void-cont-conc')
    const lines = parseDocument(fixture.gedcom)
    expect(payloadOf(lines, 'NOTE')).toEqual(['amanat @VOID@ dipertah'])
    expect(payloadOf(lines, 'CONT')).toEqual(['ANkan tanpa kehilangan tanda'])
    expect(payloadOf(lines, 'CONC')).toEqual(['baca dan barisnya'])

    const teks =
      payloadOf(lines, 'NOTE')[0] +
      '\n' +
      payloadOf(lines, 'CONT')[0] +
      payloadOf(lines, 'CONC')[0]
    expect(teks).toBe('amanat @VOID@ dipertah\nANkan tanpa kehilangan tandabaca dan barisnya')
    expect(teks).toContain('@VOID@')
  })
})

describe('kelas kasus FAMC dua level plus CHIL kronologis', () => {
  it('individu level dua terhubung ke FAMC kakek-nenek dan FAMS anak', () => {
    const fixture = fixtureById('famc-dua-level-chil-kronologis')
    const lines = parseDocument(fixture.gedcom)

    const famcPerIndi = new Map<string, string[]>()
    const famsPerIndi = new Map<string, string[]>()
    let currentIndi: string | null = null
    for (const line of lines) {
      if (line.level === 0 && line.xref !== null && line.tag === 'INDI') {
        currentIndi = line.xref
      } else if (line.level === 1 && currentIndi !== null) {
        if (line.tag === 'FAMC') {
          famcPerIndi.set(currentIndi, [...(famcPerIndi.get(currentIndi) ?? []), line.payload])
        }
        if (line.tag === 'FAMS') {
          famsPerIndi.set(currentIndi, [...(famsPerIndi.get(currentIndi) ?? []), line.payload])
        }
      }
    }

    // Level satu: anak pertama dan kedua lahir di FAM kakek-nenek (@F2@).
    expect(famcPerIndi.get('@I3@')).toEqual(['@F2@'])
    expect(famcPerIndi.get('@I4@')).toEqual(['@F2@'])
    // Keduanya melanjutkan garis lewat FAM inti (@F1@).
    expect(famsPerIndi.get('@I3@')).toEqual(['@F1@'])
    expect(famsPerIndi.get('@I4@')).toEqual(['@F1@'])
    // Level dua: cucu terhubung ke FAM orang tua saja.
    expect(famcPerIndi.get('@I5@')).toEqual(['@F1@'])
    expect(famsPerIndi.get('@I5@')).toBeUndefined()
  })

  it('urutan CHIL pada FAM kakek-nenek kronologis sesuai tanggal lahir', () => {
    const fixture = fixtureById('famc-dua-level-chil-kronologis')
    const lines = parseDocument(fixture.gedcom)

    const bulan: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    }
    const lahirPerIndi = new Map<string, string>()
    let currentIndi: string | null = null
    let padaBirt = false
    for (const line of lines) {
      if (line.level === 0) {
        padaBirt = false
        if (line.tag === 'INDI' && line.xref !== null) currentIndi = line.xref
      } else if (line.level === 1 && line.tag === 'BIRT') {
        padaBirt = true
      } else if (line.level === 2 && line.tag === 'DATE' && padaBirt && currentIndi !== null) {
        const [hari, bulanEn, tahun] = line.payload.split(' ')
        lahirPerIndi.set(currentIndi, `${tahun}-${bulan[bulanEn ?? '']}-${hari?.padStart(2, '0')}`)
        padaBirt = false
      }
    }

    const chilPerFam = new Map<string, string[]>()
    let currentFam: string | null = null
    for (const line of lines) {
      if (line.level === 0 && line.tag === 'FAM' && line.xref !== null) {
        currentFam = line.xref
      } else if (line.level === 1 && line.tag === 'CHIL' && currentFam !== null) {
        chilPerFam.set(currentFam, [...(chilPerFam.get(currentFam) ?? []), line.payload])
      }
    }

    // FAM inti (@F1@) membawakan cucu, FAM kakek-nenek (@F2@) dua anak.
    expect(chilPerFam.get('@F1@')).toEqual(['@I5@'])
    expect(chilPerFam.get('@F2@')).toEqual(['@I3@', '@I4@'])
    const lahirPertama = lahirPerIndi.get('@I3@') ?? ''
    const lahirKedua = lahirPerIndi.get('@I4@') ?? ''
    expect(lahirPertama < lahirKedua).toBe(true)
    expect(lahirPertama).toBe('1920-03-05')
    expect(lahirKedua).toBe('1923-06-09')
  })
})

describe('kelas kasus FAMS/FAMC back-reference dua arah', () => {
  it('setiap referensi INDI ke FAM berpasangan dengan referensi FAM ke INDI', () => {
    const fixture = fixtureById('fams-famc-dua-arah')
    const lines = parseDocument(fixture.gedcom)

    // Kumpulkan dua arah: INDI -> FAM (FAMS/FAMC) dan FAM -> INDI (HUSB/WIFE/CHIL).
    const indiKeFam = new Set<string>()
    const famKeIndi = new Set<string>()
    let recordXref: string | null = null
    let recordTag: string | null = null
    for (const line of lines) {
      if (line.level === 0 && line.xref !== null) {
        recordXref = line.xref
        recordTag = line.tag
      } else if (line.level === 1 && recordXref !== null) {
        if (recordTag === 'INDI' && (line.tag === 'FAMS' || line.tag === 'FAMC')) {
          indiKeFam.add(`${recordXref}>${line.payload}`)
        }
        if (recordTag === 'FAM' &&
            (line.tag === 'HUSB' || line.tag === 'WIFE' || line.tag === 'CHIL')) {
          famKeIndi.add(`${line.payload}>${recordXref}`)
        }
      }
    }

    expect(indiKeFam).toEqual(new Set(['@I1@>@F1@', '@I2@>@F1@', '@I3@>@F1@']))
    expect(famKeIndi).toEqual(new Set(['@I1@>@F1@', '@I2@>@F1@', '@I3@>@F1@']))
    // Dua arah simetris: himpunan sama persis.
    expect([...famKeIndi].sort()).toEqual([...indiKeFam].sort())
  })
})
