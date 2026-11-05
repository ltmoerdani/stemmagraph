import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { withAtomicTransaction, createMemberAtomic, createEventAtomic } from './transaction-helper';

describe('AC4 Atomic Transaction Helper', () => {
  it('should execute transaction successfully and commit', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE family_member (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_tree_id TEXT,
        user_id TEXT,
        is_alive BOOLEAN,
        generation INTEGER,
        marital_status TEXT,
        photo_url TEXT,
        birth_place_id TEXT,
        death_place_id TEXT,
        birth_event_id TEXT,
        death_event_id TEXT,
        marriage_event_id TEXT,
        source_ids TEXT,
        calendar_system TEXT,
        created_at DATETIME,
        updated_at DATETIME
      );
    `);

    withAtomicTransaction(db, (tx) => {
      createMemberAtomic(db, {
        familyTreeId: 'tree-1',
        userId: 'user-1',
        generation: 1,
        maritalStatus: 'SINGLE'
      });
    });

    const count = db.prepare('SELECT COUNT(*) as cnt FROM family_member').get() as { cnt: number };
    expect(count.cnt).toBe(1);
    db.close();
  });

  it('should rollback transaction on error', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE family_member (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_tree_id TEXT,
        user_id TEXT,
        is_alive BOOLEAN,
        generation INTEGER,
        marital_status TEXT,
        photo_url TEXT,
        birth_place_id TEXT,
        death_place_id TEXT,
        birth_event_id TEXT,
        death_event_id TEXT,
        marriage_event_id TEXT,
        source_ids TEXT,
        calendar_system TEXT,
        created_at DATETIME,
        updated_at DATETIME
      );
    `);

    expect(() => {
      withAtomicTransaction(db, (tx) => {
        createMemberAtomic(db, {
          familyTreeId: 'tree-1',
          userId: 'user-1',
          generation: 1,
          maritalStatus: 'SINGLE'
        });
        throw new Error('Simulated failure in transaction');
      });
    }).toThrow('Simulated failure in transaction');

    const count = db.prepare('SELECT COUNT(*) as cnt FROM family_member').get() as { cnt: number };
    expect(count.cnt).toBe(0);
    db.close();
  });
});
