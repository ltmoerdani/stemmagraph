/**
 * Test modul pure purge-plan executor erasure fase I (STG v122-i).
 * Mencakup penyusunan plan, penerapan redaksi, cek jatuh tempo, dan
 * gerbang transisi COMPLETED, semua tanpa IO.
 */

import { describe, expect, it } from 'vitest';

import { ErasureError } from './erasure';
import {
  ERASURE_PURGE_FIELDS,
  applyErasurePurgePlan,
  assertErasurePurgeAllowed,
  buildErasurePurgePlan,
  isErasurePurgeDue,
  type ErasurePurgePlan,
} from './erasure-purge-plan';

const MEMBER_ID = 'fm-001';
const REQUESTED_AT = '2026-08-01T00:00:00.000Z';
const COMPLETED_AT = '2026-08-10T00:00:00.000Z';
const DUE_AT = '2026-08-31T00:00:00.000Z'; // requestedAt + 30 hari

function sampleMember(): Record<string, unknown> {
  return {
    id: 7,
    familyTreeId: 2,
    name: 'Sartono',
    birthDate: '1954-03-12',
    gender: 'MALE',
    isAlive: true,
    privacyStatus: 'ERASED',
    email: 'sartono@example.com',
    phone: '+628123456789',
    photoUrl: 'https://cdn.example.com/sartono.jpg',
    currentLocation: 'Yogyakarta',
    notes: 'Kakek dari ayah',
  };
}

function samplePlan(): ErasurePurgePlan {
  return buildErasurePurgePlan({ memberId: MEMBER_ID, completedAt: COMPLETED_AT, dueAt: DUE_AT });
}

describe('buildErasurePurgePlan', () => {
  it('menghasilkan fields eksak 5 field PII dengan urutan tetap', () => {
    const plan = samplePlan();
    expect(plan.fields).toEqual(['email', 'phone', 'photoUrl', 'currentLocation', 'notes']);
    expect(plan.fields).toHaveLength(5);
  });

  it('fields plan identik dengan konstanta target purge', () => {
    expect(samplePlan().fields).toEqual([...ERASURE_PURGE_FIELDS]);
  });

  it('menyimpan memberId, completedAt, dan dueAt apa adanya', () => {
    expect(samplePlan()).toMatchObject({
      memberId: MEMBER_ID,
      completedAt: COMPLETED_AT,
      dueAt: DUE_AT,
    });
  });

  it('menolak memberId kosong dengan Error biasa', () => {
    expect(() =>
      buildErasurePurgePlan({ memberId: '  ', completedAt: COMPLETED_AT, dueAt: DUE_AT }),
    ).toThrow(Error);
  });

  it('menolak completedAt bukan ISO dengan Error biasa', () => {
    expect(() =>
      buildErasurePurgePlan({ memberId: MEMBER_ID, completedAt: 'bukan-iso', dueAt: DUE_AT }),
    ).toThrow(Error);
  });

  it('menolak dueAt bukan ISO dengan Error biasa', () => {
    expect(() =>
      buildErasurePurgePlan({ memberId: MEMBER_ID, completedAt: COMPLETED_AT, dueAt: '' }),
    ).toThrow(Error);
  });
});

describe('applyErasurePurgePlan', () => {
  it('mengembalikan salinan baru dan tidak mengubah objek asli', () => {
    const member = sampleMember();
    const result = applyErasurePurgePlan(member, samplePlan());
    expect(result).not.toBe(member);
    expect(member.email).toBe('sartono@example.com');
    expect(member.phone).toBe('+628123456789');
    expect(member.notes).toBe('Kakek dari ayah');
  });

  it('meng-null-kan 5 field target dan membiarkan field lain utuh', () => {
    const result = applyErasurePurgePlan(sampleMember(), samplePlan()) as Record<string, unknown>;
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.photoUrl).toBeNull();
    expect(result.currentLocation).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.name).toBe('Sartono');
    expect(result.birthDate).toBe('1954-03-12');
    expect(result.gender).toBe('MALE');
    expect(result.isAlive).toBe(true);
    expect(result.privacyStatus).toBe('ERASED');
    expect(result.id).toBe(7);
  });

  it('menolak plan dengan field di luar daftar target purge', () => {
    const badPlan: ErasurePurgePlan = { ...samplePlan(), fields: ['name'] };
    expect(() => applyErasurePurgePlan(sampleMember(), badPlan)).toThrow(Error);
  });

  it('menolak plan tanpa fields sama sekali', () => {
    const emptyPlan: ErasurePurgePlan = { ...samplePlan(), fields: [] };
    expect(() => applyErasurePurgePlan(sampleMember(), emptyPlan)).toThrow(Error);
  });
});

describe('isErasurePurgeDue', () => {
  it('menganggap due tepat pada dueAt (boundary)', () => {
    expect(isErasurePurgeDue(DUE_AT, DUE_AT)).toBe(true);
  });

  it('belum due sebelum dueAt', () => {
    expect(isErasurePurgeDue(DUE_AT, '2026-08-30T23:59:59.000Z')).toBe(false);
  });

  it('due setelah dueAt lewat', () => {
    expect(isErasurePurgeDue(DUE_AT, '2026-09-01T00:00:00.000Z')).toBe(true);
  });

  it('menolak timestamp rusak dengan Error biasa', () => {
    expect(() => isErasurePurgeDue('xx', DUE_AT)).toThrow(Error);
    expect(() => isErasurePurgeDue(DUE_AT, 'xx')).toThrow(Error);
  });
});

describe('assertErasurePurgeAllowed', () => {
  it('menerima bila completedAt tidak lebih awal dari requestedAt meski dueAt belum lewat', () => {
    expect(() =>
      assertErasurePurgeAllowed({ requestedAt: REQUESTED_AT, completedAt: COMPLETED_AT, dueAt: DUE_AT }),
    ).not.toThrow();
  });

  it('menerima bila dueAt sudah lewat', () => {
    expect(() =>
      assertErasurePurgeAllowed({
        requestedAt: REQUESTED_AT,
        completedAt: '2026-09-05T00:00:00.000Z',
        dueAt: DUE_AT,
      }),
    ).not.toThrow();
  });

  it('menolak transisi ilegal dengan ErasureError', () => {
    expect(() =>
      assertErasurePurgeAllowed({
        requestedAt: COMPLETED_AT,
        completedAt: REQUESTED_AT,
        dueAt: DUE_AT,
      }),
    ).toThrow(ErasureError);
  });

  it('menolak timestamp rusak dengan Error biasa, bukan ErasureError', () => {
    const call = () =>
      assertErasurePurgeAllowed({ requestedAt: 'salah', completedAt: COMPLETED_AT, dueAt: DUE_AT });
    expect(call).toThrow(Error);
    expect(call).not.toThrow(ErasureError);
  });
});
