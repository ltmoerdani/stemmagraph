// v241-i: field marga opsional pada FamilyMember (fase I, lapisan data).
// Memakai MockAdapter; nihil dependensi DB.
import { describe, it, expect } from 'vitest';
import { MockAdapter } from './mock.adapter';
import type { CreateMemberInput } from './types';

const TREE = 'wijaya-family';

const base = (name: string): CreateMemberInput => ({
  name,
  gender: 'male',
  birthDate: '1990-01-01',
});

describe('marga field (mock adapter)', () => {
  it('createMember dengan marga terisi memuat marga di record', async () => {
    const adapter = new MockAdapter();
    const m = await adapter.createMember(TREE, { ...base('Tigor'), marga: 'Siregar' });
    expect(m.marga).toBe('Siregar');
  });

  it('createMember tanpa marga menghasilkan marga undefined, bukan error', async () => {
    const adapter = new MockAdapter();
    const m = await adapter.createMember(TREE, base('Tanpa Marga'));
    expect(m.marga).toBeUndefined();
    expect(m.name).toBe('Tanpa Marga');
  });

  it('getMember memuat marga', async () => {
    const adapter = new MockAdapter();
    const created = await adapter.createMember(TREE, { ...base('Poltak'), marga: 'Simanjuntak' });
    const found = await adapter.getMember(created.id);
    expect(found).not.toBeNull();
    expect(found?.marga).toBe('Simanjuntak');
  });

  it('updateMember mengisi marga yang semula kosong', async () => {
    const adapter = new MockAdapter();
    const created = await adapter.createMember(TREE, base('Isi Marga'));
    expect(created.marga).toBeUndefined();
    const updated = await adapter.updateMember(created.id, { marga: 'Nasution' });
    expect(updated.marga).toBe('Nasution');
    expect((await adapter.getMember(created.id))?.marga).toBe('Nasution');
  });

  it('updateMember mengubah marga yang sudah ada', async () => {
    const adapter = new MockAdapter();
    const created = await adapter.createMember(TREE, { ...base('Ubah Marga'), marga: 'Harahap' });
    const updated = await adapter.updateMember(created.id, { marga: 'Lubis' });
    expect(updated.marga).toBe('Lubis');
  });

  it('updateMember dengan marga undefined tidak merusak field lain', async () => {
    const adapter = new MockAdapter();
    const created = await adapter.createMember(TREE, {
      ...base('Utuh'),
      nickname: 'Tuh',
      birthPlace: 'Medan',
    });
    const updated = await adapter.updateMember(created.id, { marga: undefined, notes: 'catatan' });
    expect(updated.name).toBe('Utuh');
    expect(updated.nickname).toBe('Tuh');
    expect(updated.birthPlace).toBe('Medan');
    expect(updated.birthDate).toBe('1990-01-01');
    expect(updated.notes).toBe('catatan');
    expect(updated.marga).toBeUndefined();
  });

  it('listMembers memuat marga untuk dua member berbeda', async () => {
    const adapter = new MockAdapter();
    const a = await adapter.createMember(TREE, { ...base('List A'), marga: 'Pane' });
    const b = await adapter.createMember(TREE, { ...base('List B'), marga: 'Sitompul' });
    const list = await adapter.listMembers(TREE);
    expect(list.find(m => m.id === a.id)?.marga).toBe('Pane');
    expect(list.find(m => m.id === b.id)?.marga).toBe('Sitompul');
  });

  it('input literal tanpa marga valid terhadap CreateMemberInput', async () => {
    const input: CreateMemberInput = { name: 'Literal', gender: 'female', birthDate: '2000-02-02' };
    expect('marga' in input).toBe(false);
    const adapter = new MockAdapter();
    const m = await adapter.createMember(TREE, input);
    expect(m.marga).toBeUndefined();
    expect(m.gender).toBe('female');
  });
});
