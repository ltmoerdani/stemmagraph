// Unit tests for the pure digest panel view state (P2-7 U5).
// Covers: the unavailable/loadFailed/loading/empty/ready priority
// order, the honest-empty contract for malformed previews, and the
// optimistic toggle undo rule.

import { describe, expect, it } from 'vitest';
import type { DigestPreview } from '../adapters/types';
import { optInAfterSave, resolveDigestPanelView } from './panelState';

const preview = (overrides: Partial<DigestPreview> = {}): DigestPreview => ({
  window: { startAt: '2026-08-17T00:00:00.000Z', endAt: '2026-08-24T00:00:00.000Z' },
  optIn: false,
  empty: false,
  subject: 'Your week on FamilyTree',
  body: 'person_added: 2\nphoto_uploaded: 1',
  ...overrides,
});

describe('resolveDigestPanelView: priority order', () => {
  it('returns unavailable when the adapter has no server backend, whatever else is set', () => {
    const view = resolveDigestPanelView({
      apiAvailable: false,
      loadFailed: true,
      preview: preview(),
    });
    expect(view).toEqual({ state: 'unavailable' });
  });

  it('returns loadFailed when the preview request rejected, even with a stale preview present', () => {
    const view = resolveDigestPanelView({ apiAvailable: true, loadFailed: true, preview: preview() });
    expect(view).toEqual({ state: 'loadFailed' });
  });

  it('returns loading before the first preview arrives', () => {
    const view = resolveDigestPanelView({ apiAvailable: true, loadFailed: false, preview: null });
    expect(view).toEqual({ state: 'loading' });
  });
});

describe('resolveDigestPanelView: empty and ready', () => {
  it('returns empty when the server marked the window empty', () => {
    const view = resolveDigestPanelView({
      apiAvailable: true,
      loadFailed: false,
      preview: preview({ empty: true, subject: null, body: null }),
    });
    expect(view).toEqual({ state: 'empty' });
  });

  it('returns empty for a malformed preview: non-empty digest with a null body', () => {
    const view = resolveDigestPanelView({
      apiAvailable: true,
      loadFailed: false,
      preview: preview({ subject: 'Your week on FamilyTree', body: null }),
    });
    expect(view).toEqual({ state: 'empty' });
  });

  it('returns empty for a malformed preview: non-empty digest with a null subject', () => {
    const view = resolveDigestPanelView({
      apiAvailable: true,
      loadFailed: false,
      preview: preview({ subject: null, body: 'person_added: 2' }),
    });
    expect(view).toEqual({ state: 'empty' });
  });

  it('returns ready carrying exactly the preview subject and body', () => {
    const view = resolveDigestPanelView({
      apiAvailable: true,
      loadFailed: false,
      preview: preview(),
    });
    expect(view).toEqual({
      state: 'ready',
      subject: 'Your week on FamilyTree',
      body: 'person_added: 2\nphoto_uploaded: 1',
    });
  });

  it('keeps the ready view when the caller has not opted in (preview renders before consent)', () => {
    const view = resolveDigestPanelView({
      apiAvailable: true,
      loadFailed: false,
      preview: preview({ optIn: false }),
    });
    expect(view.state).toBe('ready');
  });
});

describe('optInAfterSave', () => {
  it('adopts the server value on success, even when it differs from what was on screen', () => {
    expect(optInAfterSave(false, { ok: true, optIn: true })).toBe(true);
    expect(optInAfterSave(true, { ok: true, optIn: false })).toBe(false);
  });

  it('reverts to the previous value on rejection, undoing the optimistic flip', () => {
    expect(optInAfterSave(false, { ok: false })).toBe(false);
    expect(optInAfterSave(true, { ok: false })).toBe(true);
  });
});
