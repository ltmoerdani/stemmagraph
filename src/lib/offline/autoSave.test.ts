import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FamilyShape {
  isLoading: boolean;
  currentFamilyTreeId: string | null;
  members: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
}

const { mockSerializeAndStore, familyMock, dashMock } = vi.hoisted(() => {
  return {
    mockSerializeAndStore: vi.fn(),
    familyMock: {
      state: null as FamilyShape | null,
      listeners: new Set<(s: FamilyShape) => void>(),
    },
    dashMock: {
      familyTrees: [] as Array<{ id: string; name: string }>,
    },
  };
});

vi.mock('./familyStoreAdapter', () => ({
  serializeAndStore: mockSerializeAndStore,
}));

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: {
    getState: () => familyMock.state,
    subscribe: (listener: (s: FamilyShape) => void) => {
      familyMock.listeners.add(listener);
      return () => {
        familyMock.listeners.delete(listener);
      };
    },
  },
}));

vi.mock('../../store/dashboardStore', () => ({
  useDashboardStore: {
    getState: () => ({ familyTrees: dashMock.familyTrees }),
  },
}));

import { subscribeAutoSave } from './autoSave';

function setFamilyState(patch: Partial<FamilyShape>): void {
  familyMock.state = {
    isLoading: false,
    currentFamilyTreeId: 'tree-1',
    members: [],
    relationships: [],
    ...familyMock.state,
    ...patch,
  } as FamilyShape;
  for (const listener of familyMock.listeners) {
    listener(familyMock.state);
  }
}

describe('subscribeAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSerializeAndStore.mockReset();
    mockSerializeAndStore.mockResolvedValue(undefined);
    dashMock.familyTrees = [{ id: 'tree-1', name: 'Keluarga Besar' }];
    familyMock.state = {
      isLoading: false,
      currentFamilyTreeId: 'tree-1',
      members: [],
      relationships: [],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounce: dua perubahan beruntun memicu tepat satu panggilan setelah 1500ms', () => {
    const unsub = subscribeAutoSave();

    setFamilyState({ members: [{ id: 'm1', name: 'A' }] });
    setFamilyState({
      members: [
        { id: 'm1', name: 'A' },
        { id: 'm2', name: 'B' },
      ],
    });

    expect(mockSerializeAndStore).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1499);
    expect(mockSerializeAndStore).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockSerializeAndStore).toHaveBeenCalledTimes(1);
    expect(mockSerializeAndStore).toHaveBeenCalledWith('tree-1', 'Keluarga Besar', [
      { id: 'm1', name: 'A' },
      { id: 'm2', name: 'B' },
    ], []);

    unsub();
  });

  it('guard: tidak menulis saat currentFamilyTreeId kosong atau null', () => {
    const unsub = subscribeAutoSave();

    setFamilyState({ currentFamilyTreeId: '' });
    vi.advanceTimersByTime(1500);
    expect(mockSerializeAndStore).not.toHaveBeenCalled();

    setFamilyState({ currentFamilyTreeId: null });
    vi.advanceTimersByTime(1500);
    expect(mockSerializeAndStore).not.toHaveBeenCalled();

    unsub();
  });

  it('guard: tidak menulis saat isLoading true', () => {
    const unsub = subscribeAutoSave();

    setFamilyState({ isLoading: true, members: [{ id: 'm1', name: 'A' }] });
    vi.advanceTimersByTime(1500);
    expect(mockSerializeAndStore).not.toHaveBeenCalled();

    unsub();
  });

  it('unsubscribe: setelah cleanup, perubahan state tidak memicu simpan', () => {
    const unsub = subscribeAutoSave();
    unsub();

    setFamilyState({ members: [{ id: 'm9', name: 'Z' }] });
    vi.advanceTimersByTime(1500);
    expect(mockSerializeAndStore).not.toHaveBeenCalled();
  });
});
