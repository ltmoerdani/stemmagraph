/**
 * @vitest-environment jsdom
 *
 * GOAL v446 fase 1 AC5: guard test memoisasi canvas (salvase PM).
 * Blueprint: notes/riset-wake307-evidence-v446-guard-test-2026-11-13.md
 * (react.dev memo Object.is, useCallback stability, xyflow testing).
 *
 * Tiga kelompok guard:
 * 1. Struktural: 10 komponen dibungkus React.memo (8 fase 1 v446 +
 *    ReactFlowFamilyTree + TreeCanvas fase 2 v450). Gagal bila memo dihapus.
 * 2. Perilaku: komponen memo skip re-render saat props identik (Object.is).
 * 3. Callback stability: handler useCallback referensi stabil antar render.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { memo, useCallback } from 'react';
import { render, cleanup } from '@testing-library/react';

const DIR = join(__dirname, '..');

const MEMOIZED_FILES = [
  'EditableMemberCard.tsx',
  'FamilyTreeConnections.tsx',
  'MemberCard.tsx',
  'NewFamilyTreeCanvas.tsx',
  'ReactFlowTreeView.tsx',
  'controls/ExportControls.tsx',
  'controls/FamilyTreeControls.tsx',
  'controls/ImportControls.tsx',
  'ReactFlowFamilyTree.tsx',
  'TreeCanvas.tsx',
];

// Catatan fase 2 v450: ReactFlowFamilyTree.tsx dan TreeCanvas.tsx sudah masuk
// daftar guard (total 10 file). Wrap memo keduanya selesai di fase 2, test
// struktural akan gagal bila memo dihapus kembali.

afterEach(cleanup);

// 1. Guard struktural: memo wajib ada di tiap file fase 1
for (const file of MEMOIZED_FILES) {
  it(`struktural: ${file} dibungkus memo()`, () => {
    const code = readFileSync(join(DIR, file), 'utf8');
    expect(code).toMatch(/memo\s*\(/);
  });
}

// 2. Guard perilaku: kontrak Object.is dari react.dev memo
const renderSpy = vi.fn();

const GuardNode = memo(function GuardNode({ label }: { label: string }) {
  renderSpy();
  return <div>{label}</div>;
});

// 3. Guard callback stability via komponen probe (handler dicatat tiap render)
function CallbackProbe({ onRender }: { onRender: (h: () => void) => void }): JSX.Element {
  const handler = useCallback(() => {
    /* stabil, dep kosong */
  }, []);
  onRender(handler);
  return null;
}

describe('v446 memo guard', () => {
  it('perilaku: memo skip re-render props identik, render ulang saat prop berubah', () => {
    renderSpy.mockClear();
    const { rerender } = render(<GuardNode label="a" />);
    rerender(<GuardNode label="a" />);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    rerender(<GuardNode label="b" />);
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it('callback: useCallback referensi stabil antar render (dep konstan)', () => {
    const refs: Array<() => void> = [];
    const { rerender } = render(<CallbackProbe onRender={(h) => refs.push(h)} />);
    rerender(<CallbackProbe onRender={(h) => refs.push(h)} />);
    expect(refs.length).toBe(2);
    expect(Object.is(refs[0], refs[1])).toBe(true);
  });
});
