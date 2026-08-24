// Pure view state for the digest settings panel (P2-7 U5, ADR 0008).
//
// The React component stays a thin shell: every branch it renders is
// decided here in plain functions, so the honest-unavailable and
// honest-empty rules are unit-tested instead of buried in JSX. No
// React, no network, no imports beyond the adapter type.

import type { DigestPreview } from '../adapters/types';

/** Which section the panel renders, resolved from raw panel state. */
export type DigestPanelView =
  | { readonly state: 'unavailable' }
  | { readonly state: 'loading' }
  | { readonly state: 'loadFailed' }
  | { readonly state: 'empty' }
  | { readonly state: 'ready'; readonly subject: string; readonly body: string };

export interface DigestPanelInput {
  /**
   * False when the active adapter has no server backend
   * (getDigestApi() returned null: mock or supabase).
   */
  readonly apiAvailable: boolean;
  /** True when the preview request rejected. */
  readonly loadFailed: boolean;
  /** Last successfully loaded preview, null before the first load. */
  readonly preview: DigestPreview | null;
}

/**
 * Resolves the panel view. Priority order, first match wins:
 *
 * 1. unavailable: no server backend, so the panel shows the honest
 *    note instead of a fake toggle.
 * 2. loadFailed: the request rejected; a stale preview is hidden
 *    rather than shown as fresh.
 * 3. loading: request in flight and nothing loaded yet.
 * 4. empty: the server found nothing in the window (preview.empty),
 *    or the preview violates the server contract by carrying a null
 *    subject or body on a non-empty digest. Both render the honest
 *    empty state; content is never fabricated.
 * 5. ready: subject and body are present, render the preview.
 */
export function resolveDigestPanelView(input: DigestPanelInput): DigestPanelView {
  if (!input.apiAvailable) return { state: 'unavailable' };
  if (input.loadFailed) return { state: 'loadFailed' };
  if (input.preview === null) return { state: 'loading' };
  const { subject, body } = input.preview;
  if (input.preview.empty || subject === null || body === null) return { state: 'empty' };
  return { state: 'ready', subject, body };
}

/** Result of one PUT /digest/preferences attempt, component-shaped. */
export type DigestPreferenceSaveResult =
  | { readonly ok: true; readonly optIn: boolean }
  | { readonly ok: false };

/**
 * Decides the switch position after a save attempt. On success the
 * server value wins, because the server row is the source of truth.
 * On rejection the switch snaps back to the value it came from: the
 * optimistic flip is undone, never left lying on screen.
 */
export function optInAfterSave(
  previousOptIn: boolean,
  result: DigestPreferenceSaveResult,
): boolean {
  return result.ok ? result.optIn : previousOptIn;
}
