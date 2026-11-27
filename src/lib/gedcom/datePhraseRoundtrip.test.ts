// Unit round-trip PHRASE DATE GEDCOM 7 (v465 unit C2).
//
// Bentuk kanonik v7: phrase tanggal adalah substructure PHRASE di bawah
// DATE (payload DATE boleh kosong), bukan payload inline. Konvensi simpan
// aplikasi: teks phrase dijembatani ke bentuk INT inline (konvensi v459b)
// agar jalur raw exporter mempertahankan isi verbatim.
// Sumber spek: https://gedcom.io/terms/v7/type-Date.html

import { describe, expect, it } from 'vitest'
import { importIndividuals } from './importIndividuals'
import { exportGedcom70 } from './exportGedcom70'
import type { FamilyMemberRecord } from '../adapters/types'

const HEAD = ['0 HEAD', '1 GEDC', '2 VERS 7.0']
const EXPORTED_AT = new Date('2026-10-26T00:00:00Z')

function gedcomOf(lines: string[]): string {
  return [...HEAD, ...lines].join('\n')
}

describe('v465-C2 phrase DATE', () => {
  it('import DATE payload kosong + sub PHRASE menghasilkan INT konvensi', () => {
    const doc = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME Phrase /Kasis/',
      '1 BIRT',
      '2 DATE',
      '3 PHRASE sekitar waktu pindah desa',
    ])
    const result = importIndividuals(doc)
    const stored = result[0].birthDate as { originalDateString: string }
    expect(stored.originalDateString).toBe('INT sekitar waktu pindah desa')
  })

  it('import DATE INT inline tetap berjalan (regresi)', () => {
    const doc = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME Inline /Kasis/',
      '1 BIRT',
      '2 DATE INT musim tanam 1949',
    ])
    const result = importIndividuals(doc)
    const stored = result[0].birthDate as { originalDateString: string }
    expect(stored.originalDateString).toBe('INT musim tanam 1949')
  })

  it('round-trip import, export, import: isi phrase utuh', () => {
    const doc = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME Phrase /Kasis/',
      '1 BIRT',
      '2 DATE',
      '3 PHRASE sekitar waktu pindah desa',
    ])
    const imported = importIndividuals(doc)
    const stored = imported[0].birthDate as { originalDateString: string }
    const m: FamilyMemberRecord = {
      id: 'm1',
      treeId: 'tree-1',
      name: imported[0].name,
      birthDate: stored.originalDateString,
      gender: 'male',
      isAlive: true,
      generation: 1,
      maritalStatus: 'single',
    }
    const gedcom = exportGedcom70({
      members: [m],
      relationships: [],
      exportedAt: EXPORTED_AT,
    }).gedcom
    expect(gedcom).toContain('2 DATE INT sekitar waktu pindah desa')
    const second = importIndividuals(gedcom)
    const stored2 = second[0].birthDate as { originalDateString: string }
    expect(stored2.originalDateString).toBe('INT sekitar waktu pindah desa')
  })
})
