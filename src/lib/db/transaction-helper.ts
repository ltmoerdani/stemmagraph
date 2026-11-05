import Database from 'better-sqlite3';

export function withAtomicTransaction(db: Database.Database, fn: (tx: Database.Transaction) => void): void {
  const tx = db.transaction((error?: Error) => {
    if (error) {
      tx.rollback();
    } else {
      tx.commit();
    }
  });
  try {
    fn(tx);
    tx.commit();
  } catch (e) {
    tx.rollback();
    throw e;
  }
}

export function createMemberAtomic(
  db: Database.Database,
  data: { familyTreeId: string; userId: string; [key: string]: any }
): any {
  const stmt = db.prepare(
    `INSERT INTO family_member (family_tree_id, user_id, is_alive, generation, marital_status, 
     photo_url, birth_place_id, death_place_id, birth_event_id, death_event_id, marriage_event_id, 
     source_ids, calendar_system, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  );
  return stmt.run(
    data.familyTreeId,
    data.userId,
    data.isAlive ?? true,
    data.generation || 1,
    data.maritalStatus || 'SINGLE',
    data.photoUrl || null,
    data.birthPlaceId || null,
    data.deathPlaceId || null,
    data.birthEventId || null,
    data.deathEventId || null,
    data.marriageEventId || null,
    JSON.stringify(data.sourceIds || []),
    data.calendarSystem || 'GREGORIAN'
  );
}

export function createEventAtomic(
  db: Database.Database,
  data: { familyTreeId: string; userId: string; eventType: string; date: string; place?: string; sourceIds?: string[]; calendarSystem?: string }
): any {
  if (!data.eventType || !data.date) {
    throw new Error('Event type and date are required');
  }
  const stmt = db.prepare(
    `INSERT INTO life_event (family_tree_id, user_id, event_type, date, place, source_ids, calendar_system, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  );
  return stmt.run(
    data.familyTreeId,
    data.userId,
    data.eventType,
    data.date,
    data.place || null,
    JSON.stringify(data.sourceIds || []),
    data.calendarSystem || 'GREGORIAN'
  );
}
