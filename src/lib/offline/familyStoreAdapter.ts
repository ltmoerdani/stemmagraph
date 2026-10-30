import type { FamilyMember } from '../../types/family';
import type { MemberRelationship } from '../adapters';
import { putTreeLww, type LwwStatus } from './idb';

export interface SerializedMember {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SerializedRelationship {
  memberId: string;
  relatedId: string;
  type: string;
}

export interface SerializedTree {
  treeId: string;
  name: string;
  savedAt: string;
  members: SerializedMember[];
  relationships: SerializedRelationship[];
}

function serializeValue(val: unknown, fieldPath: string): unknown {
  if (val === undefined || val === null) {
    return val;
  }
  const t = typeof val;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    return val;
  }
  if (typeof val === 'function' || typeof val === 'symbol') {
    throw new Error(`serializable_violation: ${fieldPath}`);
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (val instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of val.entries()) {
      const sk = String(k);
      obj[sk] = serializeValue(v, `${fieldPath}.${sk}`);
    }
    return obj;
  }
  if (val instanceof Set) {
    const arr: unknown[] = [];
    let idx = 0;
    for (const item of val) {
      arr.push(serializeValue(item, `${fieldPath}[${idx}]`));
      idx++;
    }
    return arr;
  }
  if (Array.isArray(val)) {
    return val.map((item, idx) => serializeValue(item, `${fieldPath}[${idx}]`));
  }
  if (typeof val === 'object') {
    const plain: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      plain[k] = serializeValue(v, `${fieldPath}.${k}`);
    }
    return plain;
  }
  throw new Error(`serializable_violation: ${fieldPath}`);
}

export function serializeTree(
  treeId: string,
  name: string,
  members: readonly FamilyMember[],
  relationships: readonly MemberRelationship[]
): SerializedTree {
  const serializedMembers: SerializedMember[] = members.map((m, mIdx) => {
    const pathPrefix = `members[${mIdx}]`;
    if (!m || typeof m !== 'object') {
      throw new Error(`serializable_violation: ${pathPrefix}`);
    }
    const res: SerializedMember = {
      id: String(m.id),
      name: String(m.name),
    };
    for (const [k, v] of Object.entries(m)) {
      if (k === 'id' || k === 'name') continue;
      res[k] = serializeValue(v, `${pathPrefix}.${k}`);
    }
    return res;
  });

  const serializedRelationships: SerializedRelationship[] = relationships.map((r, rIdx) => {
    const pathPrefix = `relationships[${rIdx}]`;
    if (!r || typeof r !== 'object') {
      throw new Error(`serializable_violation: ${pathPrefix}`);
    }
    return {
      memberId: String(r.memberId),
      relatedId: String(r.relatedId),
      type: String(r.type),
    };
  });

  return {
    treeId: String(treeId),
    name: String(name),
    savedAt: new Date().toISOString(),
    members: serializedMembers,
    relationships: serializedRelationships,
  };
}

export function deserializeTree(raw: unknown): SerializedTree {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('invalid_shape');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.treeId !== 'string') {
    throw new Error('invalid_shape');
  }
  if (typeof obj.name !== 'string') {
    throw new Error('invalid_shape');
  }
  if (typeof obj.savedAt !== 'string') {
    throw new Error('invalid_shape');
  }

  if (!Array.isArray(obj.members)) {
    throw new Error('invalid_shape');
  }

  const members: SerializedMember[] = [];
  for (const m of obj.members) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      throw new Error('invalid_shape');
    }
    const mObj = m as Record<string, unknown>;
    if (typeof mObj.id !== 'string' || typeof mObj.name !== 'string') {
      throw new Error('invalid_shape');
    }
    const sm: SerializedMember = { id: mObj.id, name: mObj.name };
    for (const [k, v] of Object.entries(mObj)) {
      if (k === 'id' || k === 'name') continue;
      sm[k] = v;
    }
    members.push(sm);
  }

  if (!Array.isArray(obj.relationships)) {
    throw new Error('invalid_shape');
  }

  const relationships: SerializedRelationship[] = [];
  for (const r of obj.relationships) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      throw new Error('invalid_shape');
    }
    const rObj = r as Record<string, unknown>;
    if (
      typeof rObj.memberId !== 'string' ||
      typeof rObj.relatedId !== 'string' ||
      typeof rObj.type !== 'string'
    ) {
      throw new Error('invalid_shape');
    }
    relationships.push({
      memberId: rObj.memberId,
      relatedId: rObj.relatedId,
      type: rObj.type,
    });
  }

  return {
    treeId: obj.treeId,
    name: obj.name,
    savedAt: obj.savedAt,
    members,
    relationships,
  };
}

/**
 * v110: simpan pohon lewat jalur LWW. Status hasil:
 * 'written' tulis pertama tanpa backup; 'skipped_stale' existing lebih baru,
 * tulisan diabaikan; 'written_with_backup' incoming lebih baru atau sama,
 * record lama pindah ke slot backup satu generasi.
 */
export async function serializeAndStore(
  treeId: string,
  name: string,
  members: readonly FamilyMember[],
  relationships: readonly MemberRelationship[]
): Promise<LwwStatus> {
  const serialized = serializeTree(treeId, name, members, relationships);
  return putTreeLww(treeId, serialized, serialized.savedAt);
}
