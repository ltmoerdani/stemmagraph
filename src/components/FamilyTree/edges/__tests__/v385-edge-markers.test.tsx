/**
 * @vitest-environment jsdom
 *
 * v385 Edge Markers Arah Relasi: kontrak marker panah pada canvas silsilah.
 *
 * Semantik: konvensi top-down, panah menunjuk anak (parent-child);
 * pasangan dan sibling garis tanpa panah. Model hub GEDCOM 7 (FAMC/FAMS)
 * tidak mendefinisikan arah visual; preseden Gramps menjadikan arah panah
 * opsi pengguna.
 */
import { render } from '@testing-library/react';
import { MarkerType, Position, type EdgeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { MarriageEdge } from '../MarriageEdge';
import { ParentChildEdge } from '../ParentChildEdge';
import { SiblingEdge } from '../SiblingEdge';
import { parentChildMarkerEnd } from '../edgeMarkers';

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

describe('v385 edge markers arah relasi', () => {
  it('helper pure parentChildMarkerEnd menghasilkan kontrak v385', () => {
    const marker = parentChildMarkerEnd();
    expect(marker.type).toBe(MarkerType.ArrowClosed);
    expect(marker.color).toBeNull();
    expect(marker.width).toBe(18);
    expect(marker.height).toBe(18);
  });

  it('ParentChildEdge dengan markerEnd string url(#) merender atribut marker-end', () => {
    // Di runtime React Flow v12, objek EdgeMarker di spec dikonversi framework
    // menjadi string url(#markerId) sebelum sampai ke komponen custom edge.
    const { container } = render(
      <ParentChildEdge {...baseProps} markerEnd="url(#v385-test-marker)" />,
    );
    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).not.toBeNull();
    const markerAttr = path?.getAttribute('marker-end');
    expect(markerAttr).toBeTruthy();
    expect(markerAttr).toContain('url(#');
  });

  it('ParentChildEdge dengan objek EdgeMarker: komponen meneruskan apa adanya (kontrak v12)', () => {
    const { container } = render(
      <ParentChildEdge {...baseProps} markerEnd={parentChildMarkerEnd()} />,
    );
    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).not.toBeNull();
    // Penerusan apa adanya; konversi url(#id) adalah tanggung jawab React Flow.
    expect(path?.getAttribute('marker-end')).toBeTruthy();
  });

  it('MarriageEdge tanpa markerEnd: path tidak ber-atribut marker-end', () => {
    const { container } = render(<MarriageEdge {...baseProps} />);
    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('marker-end')).toBeNull();
  });

  it('SiblingEdge tanpa markerEnd: path tidak ber-atribut marker-end', () => {
    const { container } = render(<SiblingEdge {...baseProps} />);
    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('marker-end')).toBeNull();
  });

  it('ParentChildEdge tetap memakai className react-flow__edge-path (regresi styling)', () => {
    const { container } = render(
      <ParentChildEdge {...baseProps} markerEnd="url(#v385-test-marker)" />,
    );
    expect(
      container.querySelector('path.react-flow__edge-path'),
    ).not.toBeNull();
  });
});
