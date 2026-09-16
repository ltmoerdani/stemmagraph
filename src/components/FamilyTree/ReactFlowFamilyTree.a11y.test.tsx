/**
 * @vitest-environment jsdom
 *
 * S-08 a11y canvas: ReactFlow menerima prop nodesFocusable,
 * edgesFocusable, dan ariaLabelConfig yang dibangun dari
 * useTranslation('canvas'). Kunci mengikuti tipe AriaLabelConfig
 * @xyflow/system (11 kunci, ariaLiveMessage berupa fungsi).
 *
 * @xyflow/react di-stub supaya test fokus pada penerusan prop,
 * bukan pada render canvas penuh (selaras pola mock minimal
 * MemberEditModal.regrant.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import idCanvas from '../../lib/i18n/locales/id/canvas.json';
import enCanvas from '../../lib/i18n/locales/en/canvas.json';

const { capturedProps } = vi.hoisted(() => ({
  capturedProps: {} as Record<string, unknown>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      records: [],
      relationships: [],
      members: [],
      currentFamilyTreeId: null,
      fetchMembers: () => undefined,
    }),
}));

vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  const noop = () => undefined;
  const ReactFlowStub = (props: Record<string, unknown>) => {
    Object.assign(capturedProps, props);
    return React.createElement('div', { 'data-testid': 'rf-canvas' }, props.children as React.ReactNode);
  };
  return {
    ReactFlow: ReactFlowStub,
    ReactFlowProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReactFlow: () => ({ fitView: noop, getNodes: () => [], getEdges: () => [] }),
    useNodesState: () => [[], noop, noop],
    useEdgesState: () => [[], noop, noop],
    addEdge: (_connection: unknown, eds: unknown[]) => eds,
    Controls: () => null,
    MiniMap: () => null,
    Background: () => null,
    Panel: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    BackgroundVariant: 'background',
  };
});

const { ReactFlowFamilyTree } = await import('./ReactFlowFamilyTree');

beforeEach(() => {
  cleanup();
  for (const key of Object.keys(capturedProps)) {
    delete capturedProps[key];
  }
});

const EXPECTED_ARIA_KEYS = [
  'node.a11yDescription.default',
  'node.a11yDescription.keyboardDisabled',
  'node.a11yDescription.ariaLiveMessage',
  'edge.a11yDescription.default',
  'controls.ariaLabel',
  'controls.zoomIn.ariaLabel',
  'controls.zoomOut.ariaLabel',
  'controls.fitView.ariaLabel',
  'controls.interactive.ariaLabel',
  'minimap.ariaLabel',
  'handle.ariaLabel',
] as const;

describe('ReactFlowFamilyTree a11y props (S-08)', () => {
  it('meneruskan nodesFocusable dan edgesFocusable ke ReactFlow', () => {
    render(<ReactFlowFamilyTree members={[]} />);

    expect(capturedProps['nodesFocusable']).toBe(true);
    expect(capturedProps['edgesFocusable']).toBe(true);
  });

  it('meneruskan ariaLabelConfig dengan 11 kunci AriaLabelConfig @xyflow/system', () => {
    render(<ReactFlowFamilyTree members={[]} />);

    const ariaLabelConfig = capturedProps['ariaLabelConfig'] as Record<string, unknown>;
    expect(Object.keys(ariaLabelConfig).sort()).toEqual([...EXPECTED_ARIA_KEYS].sort());

    // Semua nilai berasal dari namespace canvas (mock t mengembalikan kunci).
    expect(ariaLabelConfig['node.a11yDescription.default']).toBe('a11y.node.default');
    expect(ariaLabelConfig['edge.a11yDescription.default']).toBe('a11y.edge.default');
    expect(ariaLabelConfig['controls.ariaLabel']).toBe('a11y.controls.ariaLabel');
    expect(ariaLabelConfig['minimap.ariaLabel']).toBe('a11y.minimap');
    expect(ariaLabelConfig['handle.ariaLabel']).toBe('a11y.handle');
  });

  it('ariaLiveMessage berupa fungsi yang menerima arah dan posisi node', () => {
    render(<ReactFlowFamilyTree members={[]} />);

    const ariaLabelConfig = capturedProps['ariaLabelConfig'] as Record<string, unknown>;
    const liveMessage = ariaLabelConfig['node.a11yDescription.ariaLiveMessage'];
    expect(typeof liveMessage).toBe('function');

    const translate = liveMessage as (args: { direction: string; x: number; y: number }) => string;
    expect(translate({ direction: 'up', x: 12, y: 34 })).toBe('a11y.node.ariaLiveMessage');
  });

  it('perilaku lain tidak berubah: proOptions hideAttribution tetap terkirim', () => {
    render(<ReactFlowFamilyTree members={[]} />);

    const proOptions = capturedProps['proOptions'] as Record<string, unknown>;
    expect(proOptions['hideAttribution']).toBe(true);
  });
});

describe('canvas.json a11y parity (en vs id)', () => {
  const leafKeys = (value: Record<string, unknown>, prefix = ''): string[] => {
    const out: string[] = [];
    for (const [key, entry] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (entry !== null && typeof entry === 'object') {
        out.push(...leafKeys(entry as Record<string, unknown>, path));
      } else {
        out.push(path);
      }
    }
    return out;
  };

  it('a11y punya 11 kunci daun di kedua locale, kunci sama persis', () => {
    const enKeys = leafKeys(enCanvas.a11y as Record<string, unknown>).sort();
    const idKeys = leafKeys(idCanvas.a11y as Record<string, unknown>).sort();

    expect(enKeys).toHaveLength(11);
    expect(idKeys).toHaveLength(11);
    expect(enKeys).toEqual(idKeys);
  });
});
