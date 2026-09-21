import { describe, expect, it } from 'vitest';
import {
  resolveInitialPrivacyStatus,
  type LivingPrivacyInput,
} from './living-privacy';

describe('resolveInitialPrivacyStatus', () => {
  it('privacyStatus eksplisit shared menang utuh', () => {
    const input: LivingPrivacyInput = {
      privacyStatus: 'shared',
      livingSuggested: false,
    };
    expect(resolveInitialPrivacyStatus(input)).toBe('shared');
  });

  it('privacyStatus eksplisit private menang utuh', () => {
    const input: LivingPrivacyInput = {
      privacyStatus: 'private',
      livingSuggested: false,
    };
    expect(resolveInitialPrivacyStatus(input)).toBe('private');
  });

  it('konflik: explicit shared tetap menang meski livingSuggested true', () => {
    const input: LivingPrivacyInput = {
      privacyStatus: 'shared',
      livingSuggested: true,
    };
    expect(resolveInitialPrivacyStatus(input)).toBe('shared');
  });

  it('konflik: explicit private tetap menang meski livingSuggested false', () => {
    const input: LivingPrivacyInput = {
      privacyStatus: 'private',
      livingSuggested: true,
    };
    expect(resolveInitialPrivacyStatus(input)).toBe('private');
  });

  it('privacyStatus kosong plus livingSuggested true menjadi private (safe default anggap-hidup)', () => {
    const input: LivingPrivacyInput = { livingSuggested: true };
    expect(resolveInitialPrivacyStatus(input)).toBe('private');
  });

  it('privacyStatus kosong plus livingSuggested false menghasilkan undefined', () => {
    const input: LivingPrivacyInput = { livingSuggested: false };
    expect(resolveInitialPrivacyStatus(input)).toBeUndefined();
  });

  it('privacyStatus kosong plus livingSuggested kosong menghasilkan undefined', () => {
    const input: LivingPrivacyInput = {};
    expect(resolveInitialPrivacyStatus(input)).toBeUndefined();
  });

  it('privacyStatus string kosong dari pemanggil runtime diperlakukan kosong, livingSuggested tetap bekerja', () => {
    // Tipe LivingPrivacyInput tidak mengizinkan string kosong, tapi pemanggil
    // JavaScript murni bisa saja mengirimnya. Perilaku runtime harus aman.
    const input = {
      privacyStatus: '',
      livingSuggested: true,
    } as unknown as LivingPrivacyInput;
    expect(resolveInitialPrivacyStatus(input)).toBe('private');
  });

  it('privacyStatus string kosong tanpa sinyal lain menghasilkan undefined', () => {
    const input = {
      privacyStatus: '',
    } as unknown as LivingPrivacyInput;
    expect(resolveInitialPrivacyStatus(input)).toBeUndefined();
  });

  it('kasus nyata: GEDCOM tanpa tag DEAT, assessImportPrivacy menandai livingSuggested true, plan tanpa privacyStatus', () => {
    const input: LivingPrivacyInput = { livingSuggested: true };
    expect(resolveInitialPrivacyStatus(input)).toBe('private');
  });

  it('kasus nyata: individu dengan catatan kematian, livingSuggested false, biarkan NULL untuk export gate', () => {
    const input: LivingPrivacyInput = { livingSuggested: false };
    expect(resolveInitialPrivacyStatus(input)).toBeUndefined();
  });

  it('kasus nyata: plan import membawa privacyStatus private untuk anak yang dilindungi, nilai itu dipakai apa pun sinyal hidup', () => {
    const input: LivingPrivacyInput = {
      privacyStatus: 'private',
      livingSuggested: true,
    };
    expect(resolveInitialPrivacyStatus(input)).toBe('private');
  });
});
