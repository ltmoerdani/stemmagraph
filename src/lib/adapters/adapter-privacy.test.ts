// S-04: adapter tests untuk privacyStatus pada create/update member.
// Kasus 1: createMember tanpa privacyStatus => default 'shared'.
// Kasus 2: persist 'private' tersimpan lewat create lalu update.

import { describe, it, expect } from 'vitest';
import { MockAdapter } from './mock.adapter';

const TREE_ID = 'wijaya-family';

const baseInput = {
  name: 'Uji Privasi',
  gender: 'male' as const,
  birthDate: '1990-01-01',
};

describe('adapter privacyStatus (S-04)', () => {
  it("createMember tanpa privacyStatus => default 'shared'", async () => {
    const adapter = new MockAdapter();
    const created = await adapter.createMember(TREE_ID, baseInput);

    expect(created.privacyStatus).toBe('shared');

    const fetched = await adapter.getMember(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.privacyStatus).toBe('shared');
  });

  it("createMember privacyStatus 'private' tersimpan, update 'private' persist", async () => {
    const adapter = new MockAdapter();

    const createdPrivate = await adapter.createMember(TREE_ID, {
      ...baseInput,
      name: 'Uji Privat Buat',
      privacyStatus: 'private',
    });
    expect(createdPrivate.privacyStatus).toBe('private');

    const fetchedPrivate = await adapter.getMember(createdPrivate.id);
    expect(fetchedPrivate?.privacyStatus).toBe('private');

    const shared = await adapter.createMember(TREE_ID, baseInput);
    const updated = await adapter.updateMember(shared.id, { privacyStatus: 'private' });
    expect(updated.privacyStatus).toBe('private');

    const fetchedUpdated = await adapter.getMember(shared.id);
    expect(fetchedUpdated?.privacyStatus).toBe('private');
  });
});
