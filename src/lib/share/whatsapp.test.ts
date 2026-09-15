// Unit tests for the pure WhatsApp share module (P2-4 AC-5).
// Covers: phone normalization per the wa.me grammar (separators stripped,
// digits only, no trunk zero, 6..15 digits), the URL builder with and
// without a phone, exact percent-encoding of the text, and the four-field
// share text composer with its stable order. Every case is locale
// independent: no locale-sensitive formatting is used, only string
// comparison of ASCII fixtures and fixed Unicode code points.

import { describe, expect, it } from 'vitest';
import {
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
  WHATSAPP_PHONE_INVALID_CODE,
  WHATSAPP_TEXT_EMPTY_CODE,
  WhatsAppShareError,
  buildInvitationShareText,
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
} from './whatsapp';

// ─── Helpers ─────────────────────────────────────────────

/** Runs fn and returns the thrown value, or null when nothing was thrown. */
function captureError(fn: () => unknown): unknown {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

function expectPhoneInvalid(fn: () => unknown): void {
  const error = captureError(fn);
  expect(error).toBeInstanceOf(WhatsAppShareError);
  expect((error as WhatsAppShareError).code).toBe(WHATSAPP_PHONE_INVALID_CODE);
}

function expectTextEmpty(fn: () => unknown): void {
  const error = captureError(fn);
  expect(error).toBeInstanceOf(WhatsAppShareError);
  expect((error as WhatsAppShareError).code).toBe(WHATSAPP_TEXT_EMPTY_CODE);
}

const SHARE_INPUT = {
  inviterName: 'Laksana',
  treeName: 'Moesdar Family',
  inviteUrl: 'https://stemmagraph.example/register/abc123',
  message: 'You are invited to view our family tree.',
};

// ─── normalizeWhatsAppPhone ──────────────────────────────

describe('normalizeWhatsAppPhone', () => {
  it('keeps a clean international number unchanged', () => {
    expect(normalizeWhatsAppPhone('628123456789')).toBe('628123456789');
  });

  it('normalizes "+62 812-3456-789" into wa.me digits', () => {
    expect(normalizeWhatsAppPhone('+62 812-3456-789')).toBe('628123456789');
  });

  it('strips spaces, brackets, dots, and hyphens anywhere in the input', () => {
    expect(normalizeWhatsAppPhone('(62) 812.3456-789')).toBe('628123456789');
  });

  it('rejects letters with WHATSAPP_PHONE_INVALID', () => {
    expectPhoneInvalid(() => normalizeWhatsAppPhone('62 812-A567 89'));
  });

  it('rejects a trunk-style leading zero', () => {
    expectPhoneInvalid(() => normalizeWhatsAppPhone('08123456789'));
  });

  it('rejects numbers shorter than 6 digits but accepts exactly 6', () => {
    expectPhoneInvalid(() => normalizeWhatsAppPhone('62812'));
    expect(normalizeWhatsAppPhone('628123')).toBe('628123');
    expect(PHONE_MIN_DIGITS).toBe(6);
  });

  it('rejects numbers longer than 15 digits but accepts exactly 15', () => {
    expectPhoneInvalid(() => normalizeWhatsAppPhone('6281234567890123'));
    expect(normalizeWhatsAppPhone('628123456789012')).toBe('628123456789012');
    expect(PHONE_MAX_DIGITS).toBe(15);
  });
});

// ─── buildWhatsAppUrl ────────────────────────────────────

describe('buildWhatsAppUrl', () => {
  it('builds a direct chat URL when a phone is given', () => {
    expect(buildWhatsAppUrl('+62 812-3456-789', 'hello there')).toBe(
      'https://wa.me/628123456789?text=hello%20there',
    );
  });

  it('falls back to the contact-picker form for null, undefined, and blank phones without throwing', () => {
    expect(buildWhatsAppUrl(null, 'hello')).toBe('https://wa.me/?text=hello');
    expect(buildWhatsAppUrl(undefined, 'hello')).toBe('https://wa.me/?text=hello');
    expect(buildWhatsAppUrl('   ', 'hello')).toBe('https://wa.me/?text=hello');
  });

  it('percent-encodes spaces, unicode, ampersand, and percent exactly', () => {
    // encodeURIComponent reference values, written out literally so a
    // regression in the encoding strategy cannot pass by accident.
    expect(buildWhatsAppUrl('628123456789', 'Smith & family % (tree) café 🌳')).toBe(
      'https://wa.me/628123456789?text=Smith%20%26%20family%20%25%20(tree)%20caf%C3%A9%20%F0%9F%8C%B3',
    );
  });

  it('throws WHATSAPP_TEXT_EMPTY for blank text and trims surrounding whitespace otherwise', () => {
    expectTextEmpty(() => buildWhatsAppUrl('628123456789', '   '));
    expect(buildWhatsAppUrl('628123456789', '  hi  ')).toBe('https://wa.me/628123456789?text=hi');
  });
});

// ─── buildInvitationShareText ────────────────────────────

describe('buildInvitationShareText', () => {
  it('composes exactly four lines in the stable order inviter, tree, url, message', () => {
    const text = buildInvitationShareText(SHARE_INPUT);
    const lines = text.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(SHARE_INPUT.inviterName);
    expect(lines[1]).toBe(SHARE_INPUT.treeName);
    expect(lines[2]).toBe(SHARE_INPUT.inviteUrl);
    expect(lines[3]).toBe(SHARE_INPUT.message);
  });

  it('trims every field and adds no decoration', () => {
    const text = buildInvitationShareText({
      inviterName: '  Raka  ',
      treeName: 'Moesdar Family',
      inviteUrl: '  https://stemmagraph.example/register/abc123  ',
      message: ' Join us. ',
    });
    expect(text).toBe(
      'Raka\nMoesdar Family\nhttps://stemmagraph.example/register/abc123\nJoin us.',
    );
  });

  it('throws WHATSAPP_TEXT_EMPTY when any of the four fields is empty', () => {
    for (const key of Object.keys(SHARE_INPUT) as Array<keyof typeof SHARE_INPUT>) {
      const broken = { ...SHARE_INPUT, [key]: '   ' };
      expectTextEmpty(() => buildInvitationShareText(broken));
    }
  });

  it('carries no phone, email, or recipient field into the composed text', () => {
    const text = buildInvitationShareText(SHARE_INPUT);
    expect(text).not.toContain('628123456789');
    expect(text).not.toContain('@');
    expect(text).not.toContain('whatsapp');
  });
});
