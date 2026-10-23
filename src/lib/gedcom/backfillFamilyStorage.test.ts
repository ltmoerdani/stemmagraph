// Test anti-regresi storage-level v380 (AC5): memakai SQLite in-memory
// dengan skema produksi (prisma/schema.prisma -> sqlite3 .schema dump
// dibangun dari migrasi). Skrip backfill keluarga dijalankan dua kali
// melalui planner murni yang sama dengan skrip aslinya, jadi pola
// idempotensinya teruji tanpa menyentuh dev.db.
//
// Yang diuji:
//   a) satu event dengan dua citation dari dua sumber terbaca keduanya
//      (tabel join LifeEventCitation);
//   b) backfill keluarga dijalankan dua kali tanpa duplikat;
//   c) MARRIAGE satu pasangan via memberId + partnerMemberId tetap
//      satu baris, A-B dan B-A dedup.

import Database from 'better-sqlite3'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildBackfillFamilyPlan,
  coupleKeyOf,
  type BackfillFamilyCoupleInput,
} from './backfillFamilyPlan'

const MIGRATIONS = [
  '20260616104357_init',
  '20260824233000_add_change_proposal',
  '20260909120000_add_tree_share_link',
  '20260912170358_add_genealogy_core_models',
  '20260916120000_add_consent_record',
  '20260918120000_v116_gender_u_and_ged_dates',
  '20260918130000_v116_events_links',
  '20260919000000_v121_partner_unique_relax',
  '20261005060000_v241i_marga_field',
  '20261016220000_v262_sex_ged',
  '20261024000000_v380_life_event_citation',
]

let db: Database.Database

function applyMigrations(): void {
  for (const name of MIGRATIONS) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path')
    const sqlPath = path.resolve(process.cwd(), `prisma/migrations/${name}/migration.sql`)
    const sql = fs.readFileSync(sqlPath, 'utf8')
    db.exec(sql)
  }
}

function insertTree(id: string): void {
  // FamilyTree butuh kolom wajib minimum; cek skema aktual dulu.
  db.prepare(
    `INSERT INTO FamilyTree (id, name, description, createdAt, updatedAt)
     VALUES (?, 'Test Tree', 'v380 storage test', datetime('now'), datetime('now'))`,
  ).run(id)
}

function insertMember(id: string, treeId: string, name: string, maritalStatus: string): void {
  db.prepare(
    `INSERT INTO FamilyMember (id, treeId, name, birthDate, deathDate, gender, generation, maritalStatus, isAlive, createdAt, updatedAt)
     VALUES (?, ?, ?, '', NULL, 'U', 1, ?, 1, datetime('now'), datetime('now'))`,
  ).run(id, treeId, name, maritalStatus)
}

function insertSpouseRel(treeId: string, a: string, b: string): void {
  db.prepare(
    `INSERT INTO FamilyRelationship (id, treeId, memberId, relatedId, type, createdAt)
     VALUES (?, ?, ?, ?, 'spouse', datetime('now'))`,
  ).run(`rel-${a}-${b}`, treeId, a, b)
}

function insertLifeEvent(id: string, treeId: string, memberId: string, partnerId: string | null, eventType: string): string {
  db.prepare(
    `INSERT INTO LifeEvent (id, treeId, memberId, partnerMemberId, eventType, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).run(id, treeId, memberId, partnerId, eventType)
  return id
}

function insertSource(id: string, treeId: string): void {
  db.prepare(
    `INSERT INTO Source (id, treeId, title, createdAt, updatedAt)
     VALUES (?, ?, 'Sumber uji v380', datetime('now'), datetime('now'))`,
  ).run(id, treeId)
}

function insertCitation(id: string, sourceId: string, qualifier: string = ''): void {
  db.prepare(
    `INSERT INTO Citation (id, sourceId, confidence, qualifier, createdAt) VALUES (?, ?, 'primary', ?, datetime('now'))`,
  ).run(id, sourceId, qualifier)
}


/** Backfill keluarga satu putaran, pola persis skrip. */
function runFamilyBackfill(_treeId: string): number {
  const rels = db
    .prepare(`SELECT treeId, memberId, relatedId FROM FamilyRelationship WHERE type = 'spouse' ORDER BY memberId`)
    .all() as Array<{ treeId: string; memberId: string; relatedId: string }>
  const members = db.prepare(`SELECT id, maritalStatus FROM FamilyMember`).all() as Array<{
    id: string
    maritalStatus: string
  }>
  const statusById = new Map(members.map((m) => [m.id, m.maritalStatus]))
  const existingEvents = db
    .prepare(`SELECT memberId, partnerMemberId, eventType FROM LifeEvent WHERE eventType IN ('MARRIAGE','DIVORCE') AND partnerMemberId IS NOT NULL`)
    .all() as Array<{ memberId: string; partnerMemberId: string | null; eventType: string }>
  const existingKeys = existingEvents.map((e) =>
    `${coupleKeyOf(e.memberId, e.partnerMemberId as string)}|${e.eventType}`,
  )

  const inputs: BackfillFamilyCoupleInput[] = rels.map((rel) => ({
    treeId: rel.treeId,
    memberAId: rel.memberId,
    memberBId: rel.relatedId,
    statusA: statusById.get(rel.memberId) ?? 'single',
    statusB: statusById.get(rel.relatedId) ?? 'single',
    existingEventKeys: existingKeys,
  }))
  const plan = buildBackfillFamilyPlan(inputs)

  let created = 0
  for (const action of plan.actions) {
    db.prepare(
      `INSERT INTO LifeEvent (id, treeId, memberId, partnerMemberId, eventType, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    ).run(`le-${Date.now()}-${Math.random()}-${action.eventType}`, action.treeId, action.memberId, action.partnerMemberId, action.eventType)
    created += 1
  }
  return created
}

beforeAll(() => {
  db = new Database(':memory:')
  applyMigrations()
})

describe('AC5a: satu event dua citation dua sumber', () => {
  it('kedua citation terbaca lewat tabel join', () => {
    insertTree('t1')
    insertMember('m1', 't1', 'Kakek Susilo', 'single')
    insertLifeEvent('ev1', 't1', 'm1', null, 'BIRTH')
    insertSource('src1', 't1')
    insertSource('src2', 't1')
    insertCitation('cit1', 'src1', 'halaman 12')
    insertCitation('cit2', 'src2', 'akta no 88')

    db.prepare(
      `INSERT INTO LifeEventCitation (id, lifeEventId, citationId, "order") VALUES ('lec1','ev1','cit1',0), ('lec2','ev1','cit2',1)`,
    ).run()

    const rows = db
      .prepare(
        `SELECT c.id, s.title, c.qualifier, lec."order"
         FROM LifeEventCitation lec
         JOIN Citation c ON c.id = lec.citationId
         JOIN Source s ON s.id = c.sourceId
         WHERE lec.lifeEventId = ?
         ORDER BY lec."order"`,
      )
      .all('ev1') as Array<{ id: string; title: string; qualifier: string; order: number }>

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ id: 'cit1', title: 'Sumber uji v380', qualifier: 'halaman 12', order: 0 })
    expect(rows[1]).toMatchObject({ id: 'cit2', title: 'Sumber uji v380', qualifier: 'akta no 88', order: 1 })
  })

  it('kolom citationId tunggal di LifeEvent tetap utuh dan bisa terisi', () => {
    insertTree('t2')
    insertMember('m2', 't2', 'Nenek Wati', 'single')
    insertSource('src3', 't2')
    insertCitation('cit3', 'src3', 'arisshal 3')
    insertLifeEvent('ev2', 't2', 'm2', null, 'DEATH')
    db.prepare(`UPDATE LifeEvent SET citationId = ? WHERE id = ?`).run('cit3', 'ev2')
    const row = db.prepare(`SELECT citationId FROM LifeEvent WHERE id = ?`).get('ev2') as { citationId: string }
    expect(row.citationId).toBe('cit3')
  })
})

describe('AC5b + AC5c: backfill keluarga idempoten, satu baris per pasangan', () => {
  it('dua putaran backfill: putaran kedua nol baris baru', () => {
    insertTree('t3')
    insertMember('h1', 't3', 'Suami', 'married')
    insertMember('i1', 't3', 'Istri', 'married')
    insertSpouseRel('t3', 'h1', 'i1')

    const first = runFamilyBackfill('t3')
    const second = runFamilyBackfill('t3')

    expect(first).toBe(1)
    expect(second).toBe(0)
    const count = db
      .prepare(`SELECT COUNT(*) c FROM LifeEvent WHERE eventType = 'MARRIAGE' AND memberId = ? AND partnerMemberId = ?`)
      .get('h1', 'i1') as { c: number }
    expect(count.c).toBe(1)
  })

  it('relasi ganda A-B dan B-A: satu MARRIAGE saja', () => {
    insertTree('t4')
    insertMember('j1', 't4', 'A', 'married')
    insertMember('j2', 't4', 'B', 'married')
    insertSpouseRel('t4', 'j1', 'j2')
    insertSpouseRel('t4', 'j2', 'j1')

    const created = runFamilyBackfill('t4')
    expect(created).toBe(1)
    const rows = db
      .prepare(`SELECT memberId, partnerMemberId FROM LifeEvent WHERE eventType = 'MARRIAGE' AND treeId = ?`)
      .all('t4') as Array<{ memberId: string; partnerMemberId: string }>
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ memberId: 'j1', partnerMemberId: 'j2' })
  })

  it('divorced: MARRIAGE dan DIVORCE masing-masing satu baris, idempoten', () => {
    insertTree('t5')
    insertMember('k1', 't5', 'Ex-suami', 'divorced')
    insertMember('k2', 't5', 'Ex-istri', 'divorced')
    insertSpouseRel('t5', 'k1', 'k2')

    const first = runFamilyBackfill('t5')
    const second = runFamilyBackfill('t5')
    expect(first).toBe(2)
    expect(second).toBe(0)
    const counts = db
      .prepare(`SELECT eventType, COUNT(*) c FROM LifeEvent WHERE treeId = ? GROUP BY eventType`)
      .all('t5') as Array<{ eventType: string; c: number }>
    expect(counts).toEqual([
      { eventType: 'DIVORCE', c: 1 },
      { eventType: 'MARRIAGE', c: 1 },
    ])
  })

  it('pasangan single: tidak ada baris, tidak mengarang data', () => {
    insertTree('t6')
    insertMember('l1', 't6', 'Single A', 'single')
    insertMember('l2', 't6', 'Single B', 'single')
    insertSpouseRel('t6', 'l1', 'l2')

    const created = runFamilyBackfill('t6')
    expect(created).toBe(0)
  })
})
