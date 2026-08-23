// Pure WhatsApp share composition for P2-4 (ADR 0005).
//
// This module is intentionally free of I/O: no DOM (no window.open here,
// the component owns that call), no server, no store, no Node built-ins,
// and no new dependencies. It only turns validated strings into a wa.me
// URL and a share text, so the browser bundle and the unit suite can both
// import it safely. The binding design record is
// docs/decisions/0005-whatsapp-share-v1-client-side.md.

// ─── Error codes (pattern of src/lib/invitations) ────────
//
// Failures throw one coded error instead of returning sentinel strings,
// so callers cannot accidentally forward an invalid value into a URL.

export const WHATSAPP_PHONE_INVALID_CODE = 'WHATSAPP_PHONE_INVALID' as const;
export const WHATSAPP_TEXT_EMPTY_CODE = 'WHATSAPP_TEXT_EMPTY' as const;

export class WhatsAppShareError extends Error {
  constructor(
    message: string,
    public readonly code: typeof WHATSAPP_PHONE_INVALID_CODE | typeof WHATSAPP_TEXT_EMPTY_CODE,
  ) {
    super(message);
    this.name = 'WhatsAppShareError';
  }
}

function throwPhoneInvalid(reason: string): never {
  throw new WhatsAppShareError(
    `Invalid WhatsApp phone number: ${reason}`,
    WHATSAPP_PHONE_INVALID_CODE,
  );
}

function throwTextEmpty(): never {
  throw new WhatsAppShareError(
    'Share text must not be empty',
    WHATSAPP_TEXT_EMPTY_CODE,
  );
}

// ─── Phone normalization (wa.me Help Center grammar) ──────
//
// wa.me wants the number in full international form: country code plus
// subscriber number, digits only. The owner may type "+62 812-3456-789";
// the URL needs "628123456789". Separator characters are stripped first,
// then the residue must be pure digits, must not start with a trunk "0",
// and must land inside the E.164 length bounds (6..15 digits).

/** Characters treated as pure formatting noise and removed before judging the digits. */
const PHONE_SEPARATORS = /[\s+()[\]{}\-./\\]/g;

export const PHONE_MIN_DIGITS = 6;
export const PHONE_MAX_DIGITS = 15;

/**
 * Normalizes a hand-typed phone number into wa.me digits.
 *
 * Strips spaces, a leading plus, brackets, hyphens, dots, and slashes,
 * then enforces: digits only, no leading zero, and 6..15 digits total.
 * Anything else throws WhatsAppShareError with code WHATSAPP_PHONE_INVALID.
 */
export function normalizeWhatsAppPhone(raw: string): string {
  if (typeof raw !== 'string') {
    throwPhoneInvalid('expected a string');
  }
  const digits = raw.replace(PHONE_SEPARATORS, '');
  if (digits.length === 0) {
    throwPhoneInvalid('no digits found');
  }
  if (!/^\d+$/.test(digits)) {
    throwPhoneInvalid('only digits are allowed after removing spaces, plus, brackets, hyphens, and dots');
  }
  if (digits.startsWith('0')) {
    throwPhoneInvalid('must be in full international form without a leading zero');
  }
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    throwPhoneInvalid(`must be ${PHONE_MIN_DIGITS} to ${PHONE_MAX_DIGITS} digits, got ${digits.length}`);
  }
  return digits;
}

// ─── URL builder ──────────────────────────────────────────

/**
 * Builds the click-to-chat URL for the owner's own WhatsApp.
 *
 * With a phone:  https://wa.me/<normalized>?text=<encoded>
 * Without one:   https://wa.me/?text=<encoded>  (WhatsApp opens its
 * contact picker; the owner chooses the recipient in their own app).
 *
 * The text is trimmed, must be non-empty afterwards, and is encoded with
 * encodeURIComponent. An invalid phone throws instead of producing a
 * broken chat link.
 */
export function buildWhatsAppUrl(phone: string | null | undefined, text: string): string {
  if (typeof text !== 'string' || text.trim() === '') {
    throwTextEmpty();
  }
  const encoded = encodeURIComponent(text.trim());
  const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
  if (trimmedPhone === '') {
    return `https://wa.me/?text=${encoded}`;
  }
  return `https://wa.me/${normalizeWhatsAppPhone(trimmedPhone)}?text=${encoded}`;
}

// ─── Share text composer ──────────────────────────────────

/** The four fields a v1 share text may carry, and nothing else (ADR 0005, R-74.8). */
export interface InvitationShareTextInput {
  /** Display name of the account that created the invitation. */
  inviterName: string;
  /** Name of the tree the invitation opens. */
  treeName: string;
  /** Full invitation URL (register link) created by the P2-3 flow. */
  inviteUrl: string;
  /** Consent-honest template sentence from i18n, already interpolated. */
  message: string;
}

/**
 * Composes the minimized share text: exactly the four inputs, in the
 * stable order inviter name, tree name, invitation URL, template
 * sentence, one per line. No email, no phone, no role, no recipient
 * name, no extra decoration (ADR 0005 minimization clause). An empty
 * field after trim throws WhatsAppShareError with code WHATSAPP_TEXT_EMPTY,
 * because a four-field text with a hole in it is a bug, not a variant.
 */
export function buildInvitationShareText(input: InvitationShareTextInput): string {
  const fields: Array<[key: keyof InvitationShareTextInput, value: string]> = [
    ['inviterName', input.inviterName],
    ['treeName', input.treeName],
    ['inviteUrl', input.inviteUrl],
    ['message', input.message],
  ];
  const parts: string[] = [];
  for (const [key, value] of fields) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new WhatsAppShareError(
        `Share text field "${key}" must not be empty`,
        WHATSAPP_TEXT_EMPTY_CODE,
      );
    }
    parts.push(value.trim());
  }
  return parts.join('\n');
}
