/**
 * @vitest-environment jsdom
 *
 * Test UI AssociationEditor (v468): AC1 picker INDI existing tanpa opsi
 * person baru, AC2 simpan tanpa ROLE ditolak dengan pesan jelas, AC3 mode
 * orang luar pohon menghasilkan ASSO VOID + PHRASE nama dan ROLE OTHER
 * + PHRASE peran, AC4 label memakai nama tanpa xref tampil.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AssociationEditor } from './AssociationEditor';
import type { FamilyMember } from '../../types/family';

const mocks = vi.hoisted(() => ({
  members: [] as FamilyMember[],
}));

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: (sel: (s: { members: FamilyMember[] }) => FamilyMember[]) =>
    sel({ members: mocks.members }),
}));

function member(id: string, name: string): FamilyMember {
  return { id, name } as unknown as FamilyMember;
}

const BUDI = member('m1', 'Budi Santoso');
const SITI = member('m2', 'Siti Aminah');
const AHMAD = member('m3', 'Ahmad Hidayat');

beforeEach(() => {
  mocks.members = [BUDI, SITI, AHMAD];
  cleanup();
});

describe('AssociationEditor (v468)', () => {
  it('AC1: picker hanya member existing, tanpa opsi person baru', () => {
    render(<AssociationEditor member={BUDI} />);
    const picker = screen.getByTestId('asso-person-picker') as HTMLSelectElement;
    const labels = [...picker.options].map((o) => o.textContent);
    expect(labels).toContain('Siti Aminah');
    expect(labels).toContain('Ahmad Hidayat');
    expect(labels).not.toContain('Budi Santoso');
    expect(labels.join(' ')).not.toMatch(/new person|create/i);
    expect(picker.options).toHaveLength(3);
  });

  it('AC2: simpan tanpa ROLE ditolak dengan pesan error jelas', () => {
    render(<AssociationEditor member={BUDI} />);
    const picker = screen.getByTestId('asso-person-picker');
    fireEvent.change(picker, { target: { value: 'm2' } });
    fireEvent.click(screen.getByTestId('asso-save'));
    const errs = screen.getByTestId('asso-errors');
    expect(errs.textContent).toContain('Role is required');
  });

  it('AC2: pilih person dan ROLE lulus, asosiasi tersimpan berlabel nama', () => {
    render(<AssociationEditor member={BUDI} />);
    fireEvent.change(screen.getByTestId('asso-person-picker'), { target: { value: 'm2' } });
    fireEvent.change(screen.getByTestId('asso-role-select'), { target: { value: 'WITN' } });
    fireEvent.click(screen.getByTestId('asso-save'));
    expect(screen.queryByTestId('asso-errors')).toBeNull();
    const list = screen.getByTestId('association-editor');
    expect(list.textContent).toContain('Siti Aminah');
    expect(list.textContent).toContain('WITN');
    expect(list.textContent).not.toContain('@');
  });

  it('AC3: mode luar pohon meniru contoh spek VOID + PHRASE nama, ROLE OTHER + PHRASE peran', () => {
    render(<AssociationEditor member={BUDI} />);
    fireEvent.click(screen.getByTestId('asso-outside-tree'));
    fireEvent.change(screen.getByTestId('asso-outside-name'), { target: { value: 'Mr Stockdale' } });
    fireEvent.change(screen.getByTestId('asso-role-select'), { target: { value: 'OTHER' } });
    fireEvent.change(screen.getByTestId('asso-role-phrase'), { target: { value: 'Teacher' } });
    fireEvent.click(screen.getByTestId('asso-save'));
    expect(screen.queryByTestId('asso-errors')).toBeNull();
    const list = screen.getByTestId('association-editor');
    expect(list.textContent).toContain('Mr Stockdale');
    expect(list.textContent).toContain('OTHER');
    expect(list.textContent).not.toContain('@VOID@');
  });

  it('AC3: mode luar pohon tanpa nama ditolak', () => {
    render(<AssociationEditor member={BUDI} />);
    fireEvent.click(screen.getByTestId('asso-outside-tree'));
    fireEvent.change(screen.getByTestId('asso-role-select'), { target: { value: 'OTHER' } });
    fireEvent.change(screen.getByTestId('asso-role-phrase'), { target: { value: 'Teacher' } });
    fireEvent.click(screen.getByTestId('asso-save'));
    expect(screen.getByTestId('asso-errors').textContent).toContain('outside the tree');
  });

  it('AC4: xref id member tidak pernah tampil sebagai label', () => {
    render(<AssociationEditor member={BUDI} />);
    fireEvent.change(screen.getByTestId('asso-person-picker'), { target: { value: 'm3' } });
    fireEvent.change(screen.getByTestId('asso-role-select'), { target: { value: 'FRIEND' } });
    fireEvent.click(screen.getByTestId('asso-save'));
    const list = screen.getByTestId('association-editor');
    expect(list.textContent).toContain('Ahmad Hidayat');
    expect(list.textContent).not.toContain('m3');
  });

  it('AC2: role OTHER tanpa phrase peran ditolak di UI', () => {
    render(<AssociationEditor member={BUDI} />);
    fireEvent.change(screen.getByTestId('asso-person-picker'), { target: { value: 'm2' } });
    fireEvent.change(screen.getByTestId('asso-role-select'), { target: { value: 'OTHER' } });
    fireEvent.click(screen.getByTestId('asso-save'));
    expect(screen.getByTestId('asso-errors').textContent).toContain('OTHER requires a phrase');
  });
});
