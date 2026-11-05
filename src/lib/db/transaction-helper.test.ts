import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { withAtomicTransaction, withAtomicTransactionImmediate } from './transaction-helper';

describe('AC4 Atomic Transaction Helper', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE family_member (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_tree_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE genealogy_event (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_tree_id TEXT NOT NULL,
        member_id INTEGER NOT NULL REFERENCES family_member(id),
        kind TEXT NOT NULL,
        date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('commit: semua baris tersisa saat fn sukses', () => {
    const insertMember = db.prepare(
      'INSERT INTO family_member (family_tree_id, user_id, name) VALUES (?, ?, ?)'
    );
    const insertEvent = db.prepare(
      'INSERT INTO genealogy_event (family_tree_id, member_id, kind, date) VALUES (?, ?, ?, ?)'
    );

    withAtomicTransaction(db, () => {
      const info = insertMember.run('tree-1', 'user-1', 'Kakek');
      insertEvent.run('tree-1', info.lastInsertRowid, 'BIRT', '1920-01-01');
    });

    const memberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM family_member').get() as { cnt: number }).cnt;
    const eventCount = (db.prepare('SELECT COUNT(*) AS cnt FROM genealogy_event').get() as { cnt: number }).cnt;
    expect(memberCount).toBe(1);
    expect(eventCount).toBe(1);
  });

  it('rollback: nol baris tersisa saat fn gagal di tengah jalan', () => {
    const insertMember = db.prepare(
      'INSERT INTO family_member (family_tree_id, user_id, name) VALUES (?, ?, ?)'
    );
    const insertEvent = db.prepare(
      'INSERT INTO genealogy_event (family_tree_id, member_id, kind, date) VALUES (?, ?, ?, ?)'
    );

    expect(() => {
      withAtomicTransaction(db, () => {
        const info = insertMember.run('tree-1', 'user-1', 'Kakek');
        insertEvent.run('tree-1', info.lastInsertRowid, 'BIRT', '1920-01-01');
        throw new Error('Simulated failure in transaction');
      });
    }).toThrow('Simulated failure in transaction');

    const memberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM family_member').get() as { cnt: number }).cnt;
    const eventCount = (db.prepare('SELECT COUNT(*) AS cnt FROM genealogy_event').get() as { cnt: number }).cnt;
    expect(memberCount).toBe(0);
    expect(eventCount).toBe(0);
  });

  it('nested: transaksi di dalam transaksi menjadi SAVEPOINT bukan BEGIN baru', () => {
    const insertMember = db.prepare(
      'INSERT INTO family_member (family_tree_id, user_id, name) VALUES (?, ?, ?)'
    );

    withAtomicTransaction(db, () => {
      insertMember.run('tree-1', 'user-1', 'Outer');
      // Nested call: better-sqlite3 otomatis SAVEPOINT, bukan BEGIN baru
      expect(db.inTransaction).toBe(true);
      withAtomicTransaction(db, () => {
        insertMember.run('tree-1', 'user-1', 'Inner');
        expect(db.inTransaction).toBe(true);
      });
      expect(db.inTransaction).toBe(true); // masih transaksi outer
    });

    const memberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM family_member').get() as { cnt: number }).cnt;
    expect(memberCount).toBe(2);
    expect(db.inTransaction).toBe(false); // koneksi bersih pasca commit
  });

  it('immediate: tulis multi-entitas pakai BEGIN IMMEDIATE, rollback bersih', () => {
    const insertMember = db.prepare(
      'INSERT INTO family_member (family_tree_id, user_id, name) VALUES (?, ?, ?)'
    );
    const insertEvent = db.prepare(
      'INSERT INTO genealogy_event (family_tree_id, member_id, kind, date) VALUES (?, ?, ?, ?)'
    );

    expect(() => {
      withAtomicTransactionImmediate(db, () => {
        const info = insertMember.run('tree-1', 'user-1', 'Kakek');
        insertEvent.run('tree-1', info.lastInsertRowid, 'DEAT', '2001-02-03');
        throw new Error('gagal setelah dua tulisan');
      });
    }).toThrow('gagal setelah dua tulisan');

    const memberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM family_member').get() as { cnt: number }).cnt;
    const eventCount = (db.prepare('SELECT COUNT(*) AS cnt FROM genealogy_event').get() as { cnt: number }).cnt;
    expect(memberCount).toBe(0);
    expect(eventCount).toBe(0);
    expect(db.inTransaction).toBe(false); // koneksi bersih pasca rollback
  });

  it('sinkron penuh: callback async dilarang (komit prematur)', () => {
    const insertMember = db.prepare(
      'INSERT INTO family_member (family_tree_id, user_id, name) VALUES (?, ?, ?)'
    );

    // Callback async mengembalikan Promise; transaksi sudah commit sebelum
    // tulisan dalam Promise jalan. Helper tidak boleh menyembunyikan ini.
    const insertSpy = vi.fn(() => insertMember.run('tree-1', 'user-1', 'Async'));
    withAtomicTransaction(db, insertSpy);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const memberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM family_member').get() as { cnt: number }).cnt;
    expect(memberCount).toBe(1);
  });
});
