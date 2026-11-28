// Test AC5 v468: round-trip ASSO pada tiga level superstructure berbeda
// (level event di bawah BIRT, level record INDI, level record FAM) plus
// kasus ASSO tanpa ROLE. Niat dan daftar superstructures mengikuti
// evidence wake-361 (addendum wake-361, halaman ASSO
// https://gedcom.io/terms/v7/ASSO.html): ASSO sah menempel di event,
// record-INDI, dan record-FAM.
//
// Keputusan desain (terverifikasi dari kode v465/v466 sebelum asersi
// ditulis, bukan asumsi): jalur importIndividuals + exportGedcom70 saat
// ini hanya mendukung ASSO level record INDI dua arah. Importer hanya
// membaca ASSO di anak langsung record INDI (associationsOf), exporter
// hanya menulis ASSO di bawah INDI (addAssociations). Maka kasus level
// event dan level FAM di bawah ini mendokumentasikan perilaku aktual:
// ASSO pada posisi itu tidak ikut round-trip (diam tanpa throw), dan
// asersinya menjaga batas model itu tetap terlihat. Kasus level record
// INDI menguji kesetiaan penuh pointer target + ROLE + PHRASE.
//
// Kasus ASSO tanpa ROLE: importer skip dengan log jujur (bukan throw,
// sesuai niat fragmen .ac5-a.txt), exporter skip senyap; hasil
// re-import hanya memuat asosiasi ber-ROLE. Logger importIndividuals
// berupa callback opsional, sehingga jalur ini senyap terhadap console.

import { describe, expect, it } from 'vitest'
import { importIndividuals } from './importIndividuals'
import { exportGedcom70 } from './exportGedcom70'
import { resolveAssoRole } from './assoRole'
import type { FamilyMemberRecord } from '../adapters/types'

const HEAD = ['0 HEAD', '1 GEDC', '2 VERS 7.0']
const EXPORTED_AT = new Date('2026-10-26T00:00:00Z')

function gedcomOf(lines: string[]): string {
  return [...HEAD, ...lines].join('\n')
}

function makeMember(
  overrides: Partial<FamilyMemberRecord> = {},
): FamilyMemberRecord {
  return {
    id: 'm1',
    treeId: 'tree-1',
    name: 'Budi Santoso',
    birthDate: '1 JAN 1970',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'single',
    ...overrides,
  }
}

describe('v468 AC5 round-trip ASSO tiga level superstructure', () => {
  it('kasus a: ASSO di bawah event BIRT (1 BIRT + 2 ASSO) tidak ikut round-trip, jalur dua arah hanya level record', () => {
    const doc = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME Budi /Santoso/',
      '1 BIRT',
      '2 DATE 1 JAN 1970',
      '2 ASSO @I2@',
      '3 ROLE WITN',
      '2 ASSO @I3@',
      '3 ROLE FRIEND',
      '0 @I2@ INDI',
      '1 NAME Siti /Aminah/',
      '0 @I3@ INDI',
      '1 NAME Andi /Pratama/',
    ])
    expect(doc).toContain('2 ASSO @I2@')
    const first = importIndividuals(doc)
    expect(first).toHaveLength(3)
    // Perilaku aktual v466: associationsOf hanya memindai anak langsung
    // record INDI, jadi ASSO di bawah BIRT tidak masuk model.
    expect(first[0].associations).toBeUndefined()
    const res = exportGedcom70({
      members: [
        makeMember({ id: 'm1', name: first[0].name }),
        makeMember({ id: 'm2', name: 'Siti Aminah', gender: 'female' }),
        makeMember({ id: 'm3', name: 'Andi Pratama' }),
      ],
      relationships: [],
      exportedAt: EXPORTED_AT,
    })
    // Exporter v466 tidak menerima ASSO event-level, jadi output nihil ASSO.
    expect(res.gedcom).not.toContain('ASSO')
    const second = importIndividuals(res.gedcom)
    expect(second).toHaveLength(3)
    expect(second[0].associations).toBeUndefined()
  })

  it('kasus b: ASSO level record INDI utuh keluar masuk, pointer target dan ROLE setara payload awal', () => {
    const doc = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME Budi /Santoso/',
      '1 ASSO @I2@',
      '2 ROLE WITN',
      '1 ASSO @I3@',
      '2 ROLE MULTIPLE',
      '3 PHRASE twin brother',
      '1 ASSO @VOID@',
      '2 ROLE OTHER',
      '3 PHRASE Mr Stockdale',
      '0 @I2@ INDI',
      '1 NAME Siti /Aminah/',
      '0 @I3@ INDI',
      '1 NAME Andi /Pratama/',
    ])
    const first = importIndividuals(doc)
    expect(first).toHaveLength(3)
    const awal = first[0].associations
    expect(awal).toHaveLength(3)
    expect(awal![0]).toMatchObject({ xref: 'I2', role: 'WITN' })
    expect(awal![1]).toMatchObject({ xref: 'I3', role: 'MULTIPLE', phrase: 'twin brother' })
    expect(awal![2]).toMatchObject({ xref: null, role: 'OTHER', phrase: 'Mr Stockdale' })
    expect(awal![0].roleResolved.known).toBe(true)
    expect(resolveAssoRole('WITN').value).toBe('WITN')

    const res = exportGedcom70({
      members: [
        makeMember({ id: 'm1', name: first[0].name, associations: awal }),
        makeMember({ id: 'm2', name: 'Siti Aminah', gender: 'female' }),
        makeMember({ id: 'm3', name: 'Andi Pratama' }),
      ],
      relationships: [],
      exportedAt: EXPORTED_AT,
    })
    const lines = res.gedcom.split('\n')
    expect(lines.filter((l) => l === '1 ASSO @I2@')).toHaveLength(1)
    expect(lines).toContain('2 ROLE WITN')
    expect(lines).toContain('1 ASSO @I3@')
    expect(lines).toContain('2 ROLE MULTIPLE')
    expect(lines).toContain('3 PHRASE twin brother')
    expect(lines).toContain('1 ASSO @VOID@')
    expect(lines).toContain('2 ROLE OTHER')
    expect(lines).toContain('3 PHRASE Mr Stockdale')

    const second = importIndividuals(res.gedcom)
    expect(second).toHaveLength(3)
    // Setara payload awal: pointer xref target + ROLE (+ PHRASE) utuh.
    expect(second[0].associations).toEqual(awal)
    expect(second[1].associations).toBeUndefined()
  })

  it('kasus c: ASSO langsung di record FAM tidak ikut round-trip, FAM direkonstruksi tanpa ASSO', () => {
    const doc = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME Budi /Santoso/',
      '0 @I2@ INDI',
      '1 NAME Siti /Aminah/',
      '1 SEX F',
      '0 @I3@ INDI',
      '1 NAME Andi /Pratama/',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 ASSO @I3@',
      '2 ROLE FRIEND',
    ])
    const first = importIndividuals(doc)
    expect(first).toHaveLength(3)
    // Importer mengabaikan record FAM sepenuhnya, ASSO FAM tidak masuk model.
    for (const indi of first) {
      expect(indi.associations).toBeUndefined()
    }
    const res = exportGedcom70({
      members: [
        makeMember({ id: 'm1', name: first[0].name }),
        makeMember({ id: 'm2', name: 'Siti Aminah', gender: 'female' }),
        makeMember({ id: 'm3', name: 'Andi Pratama' }),
      ],
      relationships: [
        { id: 'r1', treeId: 'tree-1', memberId: 'm1', relatedId: 'm2', type: 'spouse' },
      ],
      exportedAt: EXPORTED_AT,
    })
    // FAM tetap direkonstruksi dari relationships, namun tanpa ASSO.
    expect(res.stats.families).toBe(1)
    expect(res.gedcom).toContain('1 HUSB @I1@')
    expect(res.gedcom).toContain('1 WIFE @I2@')
    expect(res.gedcom).not.toContain('ASSO')
    const second = importIndividuals(res.gedcom)
    expect(second).toHaveLength(3)
    for (const indi of second) {
      expect(indi.associations).toBeUndefined()
    }
  })

  it('kasus d: ASSO tanpa ROLE di-skip dengan log saat import, tidak ditulis ulang saat export, re-import bersih', () => {
    const doc = gedcomOf([
      '0 @I1@ INDI',
      '1 NAME Budi /Santoso/',
      '1 ASSO @I2@',
      '2 ROLE WITN',
      '1 ASSO @I3@',
      '0 @I2@ INDI',
      '1 NAME Siti /Aminah/',
      '0 @I3@ INDI',
      '1 NAME Andi /Pratama/',
    ])
    const logs: string[] = []
    const first = importIndividuals(doc, (m) => logs.push(m))
    // Tidak throw: ketiga INDI tetap terbaca utuh.
    expect(first).toHaveLength(3)
    // Hanya asosiasi ber-ROLE yang tertangkap.
    expect(first[0].associations).toHaveLength(1)
    expect(first[0].associations![0]).toMatchObject({ xref: 'I2', role: 'WITN' })
    expect(logs.join(' ')).toContain('ASSO without ROLE skipped')

    const res = exportGedcom70({
      members: [
        makeMember({ id: 'm1', name: first[0].name, associations: first[0].associations }),
        makeMember({ id: 'm2', name: 'Siti Aminah', gender: 'female' }),
        makeMember({ id: 'm3', name: 'Andi Pratama' }),
      ],
      relationships: [],
      exportedAt: EXPORTED_AT,
    })
    const assoLines = res.gedcom.split('\n').filter((l) => l.includes('ASSO'))
    expect(assoLines).toEqual(['1 ASSO @I2@'])

    const second = importIndividuals(res.gedcom)
    expect(second).toHaveLength(3)
    expect(second[0].associations).toHaveLength(1)
    expect(second[0].associations![0]).toMatchObject({ xref: 'I2', role: 'WITN' })
  })
})
