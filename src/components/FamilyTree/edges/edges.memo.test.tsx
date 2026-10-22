/**
 * @vitest-environment jsdom
 *
 * S-04 pilar canvas kinerja: kontrak memoization komponen canvas.
 *
 * Latar: laporan A/B v177-ii (docs/perf/canvas-ab-report.md) membuktikan
 * culling onlyRenderVisibleElements tidak menaikkan FPS; biaya render
 * justru datang dari re-render edge saat node didrag. FamilyMemberNode
 * sudah memo sejak S-09; ketiga komponen edge wajib mengikuti supaya
 * drag satu node tidak merender ulang seluruh bracket/garis di canvas.
 */
import { render } from '@testing-library/react';
import { Position, type EdgeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { MarriageEdge } from './MarriageEdge';
import { ParentChildEdge } from './ParentChildEdge';
import { SiblingEdge } from './SiblingEdge';

const baseProps: EdgeProps = {
  id: 'edge-test',
  source: 'a',
  target: 'b',
  sourceX: 10,
  sourceY: 20,
  targetX: 110,
  targetY: 120,
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
};

describe('S-04 memoization komponen canvas', () => {
  it('ketiga komponen edge terbungkus React.memo', () => {
    expect(Object.getOwnPropertyNames(MarriageEdge)).toContain('$$typeof');
    expect(Object.getOwnPropertyNames(ParentChildEdge)).toContain('$$typeof');
    expect(Object.getOwnPropertyNames(SiblingEdge)).toContain('$$typeof');
  });

  it('ketiga komponen edge memiliki displayName', () => {
    expect(MarriageEdge.displayName).toBe('MarriageEdge');
    expect(ParentChildEdge.displayName).toBe('ParentChildEdge');
    expect(SiblingEdge.displayName).toBe('SiblingEdge');
  });

  it('render dasar MarriageEdge tanpa crash', () => {
    const { container } = render(<MarriageEdge {...baseProps} />);
    expect(container.querySelector('path')).not.toBeNull();
  });

  it('render dasar ParentChildEdge tanpa crash', () => {
    const { container } = render(<ParentChildEdge {...baseProps} />);
    expect(container.querySelector('path')).not.toBeNull();
  });

  it('render dasar SiblingEdge tanpa crash', () => {
    const { container } = render(<SiblingEdge {...baseProps} />);
    expect(container.querySelector('path')).not.toBeNull();
  });
});
