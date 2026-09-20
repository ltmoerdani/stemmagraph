// Unit test pemetaan RESN GEDCOM 7 ke privacyStatus (v128-i).
//
// Cakupan: kedua arah pemetaan, toleransi lowercase, default aman
// untuk input kosong dan malformed, round-trip, serta asimetri
// round-trip yang didokumentasikan sebagai intentional safe default.

import { describe, expect, it } from 'vitest'
import {
  privacyStatusToResn,
  RESN_LEVELS,
  resnToPrivacyStatus,
} from './resn'

describe('resnToPrivacyStatus', () => {
  it('memetakan CONFIDENTIAL ke private', () => {
    expect(resnToPrivacyStatus('CONFIDENTIAL')).toBe('private')
  })

  it('memetakan PRIVACY ke private', () => {
    expect(resnToPrivacyStatus('PRIVACY')).toBe('private')
  })

  it('memetakan LOCKED ke private', () => {
    expect(resnToPrivacyStatus('LOCKED')).toBe('private')
  })

  it('menerima lowercase secara toleran (confidential, privacy, locked)', () => {
    expect(resnToPrivacyStatus('confidential')).toBe('private')
    expect(resnToPrivacyStatus('privacy')).toBe('private')
    expect(resnToPrivacyStatus('locked')).toBe('private')
  })

  it('memetakan null ke null (status tidak diketahui)', () => {
    expect(resnToPrivacyStatus(null)).toBeNull()
  })

  it('memetakan undefined ke null (status tidak diketahui)', () => {
    expect(resnToPrivacyStatus(undefined)).toBeNull()
  })

  it('memetakan string kosong ke null', () => {
    expect(resnToPrivacyStatus('')).toBeNull()
  })
})

describe('privacyStatusToResn', () => {
  it('memetakan shared ke null (consent eksplisit, nihil RESN dioutput)', () => {
    expect(privacyStatusToResn('shared')).toBeNull()
  })

  it('memetakan private ke PRIVACY', () => {
    expect(privacyStatusToResn('private')).toBe('PRIVACY')
  })

  it('memetakan null ke PRIVACY (safe default, konsisten gate NULL living = redact)', () => {
    expect(privacyStatusToResn(null)).toBe('PRIVACY')
  })

  it('memetakan undefined ke PRIVACY (safe default)', () => {
    expect(privacyStatusToResn(undefined)).toBe('PRIVACY')
  })

  it('memetakan nilai sampah TOPSECRET ke PRIVACY (malformed tak melebarkan akses)', () => {
    expect(privacyStatusToResn('TOPSECRET')).toBe('PRIVACY')
  })
})

describe('round-trip dan konstanta', () => {
  it('round-trip private -> PRIVACY -> private stabil', () => {
    expect(resnToPrivacyStatus(privacyStatusToResn('private'))).toBe('private')
  })

  it('round-trip NULL -> PRIVACY -> private: asimetri eksplisit, safe default', () => {
    // NULL (belum dicatat) diekspor sebagai PRIVACY agar tidak melebarkan
    // akses; import baliknya wajar jatuh ke 'private', bukan NULL lagi.
    expect(privacyStatusToResn(null)).toBe('PRIVACY')
    expect(resnToPrivacyStatus(privacyStatusToResn(null))).toBe('private')
  })

  it('round-trip shared -> null -> null: asimetri eksplisit, komentar jujur', () => {
    // Consent 'shared' diekspor tanpa RESN; tidak ada cara merekonstruksi
    // consent dari berkas tanpa RESN, jadi import balik menghasilkan null
    // (pemanggil menulis NULL ke DB, direduksi untuk living, tak pernah bocor).
    expect(privacyStatusToResn('shared')).toBeNull()
    expect(resnToPrivacyStatus(privacyStatusToResn('shared'))).toBeNull()
  })

  it('RESN_LEVELS panjang 3 dan isi tepat sesuai enumset GEDCOM 7', () => {
    expect(RESN_LEVELS).toHaveLength(3)
    expect(RESN_LEVELS).toEqual(['CONFIDENTIAL', 'PRIVACY', 'LOCKED'])
  })

  it('determinisme: pemanggilan dua kali menghasilkan nilai sama', () => {
    for (const status of ['shared', 'private', null, undefined, 'TOPSECRET']) {
      expect(privacyStatusToResn(status)).toBe(privacyStatusToResn(status))
    }
    for (const resn of ['CONFIDENTIAL', 'PRIVACY', 'LOCKED', 'privacy', null, undefined, '']) {
      expect(resnToPrivacyStatus(resn)).toBe(resnToPrivacyStatus(resn))
    }
  })
})
