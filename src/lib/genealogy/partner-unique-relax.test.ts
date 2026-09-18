import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makePartnerRelation } from './relationship'

const REPO_ROOT = new URL('../../../', import.meta.url)
const SCHEMA_PATH = join(REPO_ROOT.pathname, 'prisma/schema.prisma')
const MIGRATION_DIR = 'prisma/migrations/20260919000000_v121_partner_unique_relax'
const MIGRATION_PATH = join(REPO_ROOT.pathname, MIGRATION_DIR, 'migration.sql')

const OLD_UNIQUE_INDEX = 'FamilyRelationship_memberId_relatedId_type_key'
const NEW_PLAIN_INDEX = 'FamilyRelationship_memberId_relatedId_type_idx'

/** DDL tabel FamilyRelationship, disederhanakan dari migration init 20260616. */
const TABLE_DDL = `
CREATE TABLE "FamilyRelationship" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "treeId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "relatedId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FamilyRelationship_memberId_relatedId_type_key"
  ON "FamilyRelationship"("memberId", "relatedId", "type");
CREATE INDEX "FamilyRelationship_treeId_idx" ON "FamilyRelationship"("treeId");
`

function hasSqlite3Cli(): boolean {
  try {
    execFileSync('sqlite3', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const sqliteAvailable = hasSqlite3Cli()

/** Jalankan SQL ke satu berkas sqlite; input dikirim lewat stdin. */
function runSql(dbFile: string, sql: string): void {
  execFileSync('sqlite3', [dbFile], { input: sql })
}

/** Buat DB sementara dengan tabel + unique index lama, lalu terapkan migration. */
function makeRelaxedDb(): string {
  const dir = mkdtempSync(join(tmpdir(), 'stg-v121-'))
  const dbFile = join(dir, 'test.db')
  runSql(dbFile, TABLE_DDL)
  const migration = readFileSync(MIGRATION_PATH, 'utf8')
  runSql(dbFile, migration)
  return dbFile
}

function scalar(dbFile: string, sql: string): string {
  return execFileSync('sqlite3', [dbFile], { input: sql, encoding: 'utf8' }).trim()
}

function insertRelationship(
  dbFile: string,
  id: string,
  treeId: string,
  memberId: string,
  relatedId: string,
): void {
  runSql(
    dbFile,
    `INSERT INTO "FamilyRelationship" ("id", "treeId", "memberId", "relatedId", "type")
     VALUES ('${id}', '${treeId}', '${memberId}', '${relatedId}', 'PARTNER');`,
  )
}

describe('STG v121-i: PARTNER unique relax (migration nyata via sqlite3)', () => {
  it.skipIf(!sqliteAvailable)('same pair p1-p2 boleh jadi PARTNER di dua keluarga beda', () => {
    const dbFile = makeRelaxedDb()

    // Domain level: dua relasi berbeda untuk pasangan yang sama.
    const fam1 = makePartnerRelation('p1', 'p2')
    const fam2 = makePartnerRelation('p1', 'p2')
    expect(fam1).not.toBe(fam2)

    insertRelationship(dbFile, 'r1', 'tree-1', fam1.partners[0], fam1.partners[1])
    insertRelationship(dbFile, 'r2', 'tree-2', fam2.partners[0], fam2.partners[1])

    expect(scalar(dbFile, 'SELECT COUNT(*) FROM "FamilyRelationship";')).toBe('2')
  })

  it.skipIf(!sqliteAvailable)('pasangan berbeda p1-p2 vs p1-p3 tetap tersimpan normal', () => {
    const dbFile = makeRelaxedDb()

    const first = makePartnerRelation('p1', 'p2')
    const second = makePartnerRelation('p1', 'p3')
    insertRelationship(dbFile, 'r1', 'tree-1', first.partners[0], first.partners[1])
    insertRelationship(dbFile, 'r2', 'tree-1', second.partners[0], second.partners[1])

    expect(scalar(dbFile, 'SELECT COUNT(*) FROM "FamilyRelationship";')).toBe('2')
  })

  it.skipIf(!sqliteAvailable)('unique index lama hilang, plain index menggantikan', () => {
    const dbFile = makeRelaxedDb()

    expect(
      scalar(dbFile, `SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='${OLD_UNIQUE_INDEX}';`),
    ).toBe('0')

    const indexSql = scalar(
      dbFile,
      `SELECT sql FROM sqlite_master WHERE type='index' AND name='${NEW_PLAIN_INDEX}';`,
    )
    expect(indexSql).toContain(`CREATE INDEX "${NEW_PLAIN_INDEX}"`)
    expect(indexSql).not.toContain('UNIQUE')
  })
})

describe('STG v121-i: schema.prisma selaras dengan migration', () => {
  it('FamilyRelationship memakai @@index, tanpa @@unique pada triple sama', () => {
    const schema = readFileSync(SCHEMA_PATH, 'utf8')
    const modelBody = schema.split('model FamilyRelationship')[1]?.split('}')[0] ?? ''

    expect(modelBody).toContain('@@index([memberId, relatedId, type])')
    expect(modelBody).not.toContain('@@unique([memberId, relatedId, type])')
  })
})
