// Digest mailer for P2-7 (ADR 0008). The only module that touches the
// network, and only through nodemailer.
//
// Three honest states, no pretending:
//
//   - SMTP_URL empty: mailerDisabled() is true and no transport is ever
//     created. The scheduler never starts and the admin send endpoint
//     answers 503 instead of fabricating a send (fail closed).
//   - DIGEST_DRY_RUN=1: the email is rendered and logged, no network
//     call leaves the process. For development and QA rehearsal.
//   - otherwise: one createTransport per send from the SMTP_URL string
//     (smtp:// or smtps:// with optional user:pass). Family-scale
//     volumes make a pooled singleton needless machinery.
//
// The mailer never writes the database; advancing digestLastSentAt is
// the caller's job and happens only after a successful send.

import nodemailer from 'nodemailer';

export interface DigestEmail {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export type DigestSendResult =
  | { readonly ok: true; readonly dryRun: boolean }
  | { readonly ok: false; readonly dryRun: boolean; readonly error: string };

/** The trimmed SMTP_URL, empty string when unset. */
export function smtpUrl(): string {
  const value = process.env['SMTP_URL'];
  return typeof value === 'string' ? value.trim() : '';
}

/** True when no SMTP_URL is configured: the mailer must refuse to send. */
export function mailerDisabled(): boolean {
  return smtpUrl() === '';
}

function isDryRun(): boolean {
  return process.env['DIGEST_DRY_RUN'] === '1';
}

/** From address for digest email; DIGEST_FROM overrides the default. */
export function digestFrom(): string {
  return process.env['DIGEST_FROM']?.trim() || 'no-reply@localhost';
}

/**
 * Sends one digest email. Fails closed: no SMTP_URL means an error
 * result, never a silent skip that looks like success. With
 * DIGEST_DRY_RUN=1 the rendered email is logged and the result is an
 * honest dry-run success without any network traffic.
 */
export async function sendDigestEmail(email: DigestEmail): Promise<DigestSendResult> {
  if (mailerDisabled()) {
    return { ok: false, dryRun: false, error: 'DIGEST_MAIL_DISABLED' };
  }
  if (isDryRun()) {
    console.log(
      `[digest:dry-run] from=${digestFrom()} to=${email.to} subject=${JSON.stringify(email.subject)}\n${email.body}`,
    );
    return { ok: true, dryRun: true };
  }
  try {
    const transporter = nodemailer.createTransport(smtpUrl());
    await transporter.sendMail({
      from: digestFrom(),
      to: email.to,
      subject: email.subject,
      text: email.body,
    });
    return { ok: true, dryRun: false };
  } catch (e) {
    return { ok: false, dryRun: false, error: (e as Error).message };
  }
}
