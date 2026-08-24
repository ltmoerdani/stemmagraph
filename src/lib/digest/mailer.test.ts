// Unit tests for the digest mailer (P2-7 AC-4).
// Covers: the disabled state (no SMTP_URL means refuse, no transport),
// the dry-run state (render + log, zero network), the from-address
// default and override, and the send failure path that fails closed.
// No test touches the network: the only transport-creating path is
// exercised through a refused SMTP host on the loopback interface.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { digestFrom, mailerDisabled, sendDigestEmail, smtpUrl } from './mailer';

const EMAIL = { to: 'member@example.com', subject: 'Stemmagraph weekly digest', body: 'Hi Rina,\n...footer' };

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  setEnv('SMTP_URL', undefined);
  setEnv('DIGEST_DRY_RUN', undefined);
  setEnv('DIGEST_FROM', undefined);
  vi.restoreAllMocks();
});

describe('the disabled state', () => {
  it('no SMTP_URL at all: disabled, and the send fails closed with no transport', async () => {
    setEnv('SMTP_URL', undefined);
    expect(mailerDisabled()).toBe(true);
    expect(smtpUrl()).toBe('');
    const result = await sendDigestEmail(EMAIL);
    expect(result).toEqual({ ok: false, dryRun: false, error: 'DIGEST_MAIL_DISABLED' });
  });

  it('a whitespace-only SMTP_URL counts as unset', () => {
    setEnv('SMTP_URL', '   ');
    expect(mailerDisabled()).toBe(true);
  });

  it('a set SMTP_URL enables the mailer', () => {
    setEnv('SMTP_URL', 'smtps://user:pass@smtp.example.com:465');
    expect(mailerDisabled()).toBe(false);
    expect(smtpUrl()).toBe('smtps://user:pass@smtp.example.com:465');
  });
});

describe('the dry-run state', () => {
  it('DIGEST_DRY_RUN=1 logs the rendered email and reports a dry-run success', async () => {
    setEnv('SMTP_URL', 'smtps://user:pass@smtp.example.com:465');
    setEnv('DIGEST_DRY_RUN', '1');
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await sendDigestEmail(EMAIL);
    expect(result).toEqual({ ok: true, dryRun: true });
    expect(logged).toHaveBeenCalledTimes(1);
    const line = logged.mock.calls[0]?.map(String).join(' ') ?? '';
    expect(line).toContain('[digest:dry-run]');
    expect(line).toContain('member@example.com');
    expect(line).toContain('Stemmagraph weekly digest');
  });

  it('dry-run never activates when SMTP_URL is empty (disabled wins)', async () => {
    setEnv('SMTP_URL', undefined);
    setEnv('DIGEST_DRY_RUN', '1');
    const result = await sendDigestEmail(EMAIL);
    expect(result).toEqual({ ok: false, dryRun: false, error: 'DIGEST_MAIL_DISABLED' });
  });
});

describe('addresses and failures', () => {
  it('from address defaults to no-reply@localhost and honors DIGEST_FROM', () => {
    setEnv('DIGEST_FROM', undefined);
    expect(digestFrom()).toBe('no-reply@localhost');
    setEnv('DIGEST_FROM', '  digests@stemmagraph.example  ');
    expect(digestFrom()).toBe('digests@stemmagraph.example');
  });

  it('a transport that refuses the connection reports an honest failure', async () => {
    // Port 9 (discard) on the loopback interface: nothing speaks SMTP
    // there, so the connection is refused quickly and deterministically.
    setEnv('SMTP_URL', 'smtp://127.0.0.1:9?connectionTimeout=250&socketTimeout=250');
    setEnv('DIGEST_DRY_RUN', undefined);
    const result = await sendDigestEmail(EMAIL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});
