import React, { useMemo, useState } from 'react';
import { useFamilyStore } from '../../store/familyStore';
import {
  validateAssoForm,
  buildAssociation,
  assoLabel,
  ASSO_ROLE_OPTIONS,
  type AssoFormInput,
} from '../../lib/gedcom/assoForm';
import type { ParsedAssociation } from '../../lib/gedcom/assoRole';
import type { FamilyMember } from '../../types/family';

/**
 * Editor asosiasi ASSO di sidebar detail anggota (v468).
 *
 * AC1: picker hanya berisi member existing di pohon aktif, tanpa opsi
 * menciptakan person baru.
 * AC2: ROLE wajib, simpan ditolak dengan pesan error jelas.
 * AC3: mode orang di luar pohon menulis @VOID@ + PHRASE nama, ROLE
 * OTHER + PHRASE peran, meniru contoh resmi spek GEDCOM 7.
 * AC4: xref tidak pernah ditampilkan, label selalu nama person.
 */
export const AssociationEditor: React.FC<{ member: FamilyMember }> = ({ member }) => {
  const members = useFamilyStore((s) => s.members);

  const [form, setForm] = useState<AssoFormInput>({
    person: null,
    outsideTree: false,
    outsideName: '',
    role: '',
    rolePhrase: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<ParsedAssociation[] | null>(null);

  const options = useMemo(
    () => members.filter((m) => m.id !== member.id),
    [members, member.id],
  );

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.id, m.name));
    return (id: string) => map.get(id);
  }, [members]);

  const handleSave = () => {
    const res = validateAssoForm(form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    const asso = buildAssociation(form);
    setSaved((prev) => (prev === null ? [asso] : [...prev, asso]));
    setForm({ person: null, outsideTree: false, outsideName: '', role: '', rolePhrase: '' });
  }

  const handleRemove = (index: number) => {
    setSaved((prev) => (prev === null ? null : prev.filter((_, i) => i !== index)));
  };

  const existing = (member.associations ?? []) as ParsedAssociation[];
  const all = [...existing, ...(saved ?? [])];

  return (
    <div className="mb-8" data-testid="association-editor">
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Associations</h4>
      {all.length > 0 && (
        <ul className="space-y-2 mb-4">
          {all.map((asso, i) => (
            <li key={`${asso.xref ?? 'void'}-${asso.role}-${i}`} className="flex items-center justify-between text-sm">
              <span>
                {assoLabel(asso, nameById)}
                <span className="text-gray-500"> ({asso.role})</span>
                {asso.role === 'OTHER' && asso.phrase && asso.xref !== null && (
                  <span className="text-gray-500">: {asso.phrase}</span>
                )}
              </span>
              {saved !== null && saved.includes(asso) && (
                <button type="button" onClick={() => handleRemove(i)} className="text-red-600 hover:text-red-800" aria-label="Remove association">Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <label className="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={form.outsideTree}
            onChange={(e) => setForm({ ...form, outsideTree: e.target.checked, person: null })}
            data-testid="asso-outside-tree"
          />
          <span>Person is outside the tree (no record)</span>
        </label>
        {form.outsideTree ? (
          <input
            type="text"
            value={form.outsideName}
            onChange={(e) => setForm({ ...form, outsideName: e.target.value })}
            placeholder="Name of the person"
            data-testid="asso-outside-name"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        ) : (
          <select
            value={form.person === null ? '' : form.person.id}
            onChange={(e) => {
              const found = members.find((m) => m.id === e.target.value);
              setForm({ ...form, person: found ? { id: found.id, name: found.name } : null });
            }}
            data-testid="asso-person-picker"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Select a person in the tree</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as AssoFormInput['role'] })}
          data-testid="asso-role-select"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Select a role</option>
          {ASSO_ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {form.role === 'OTHER' && (
          <input
            type="text"
            value={form.rolePhrase}
            onChange={(e) => setForm({ ...form, rolePhrase: e.target.value })}
            placeholder="Describe the role"
            data-testid="asso-role-phrase"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        )}
        <button
          type="button"
          onClick={handleSave}
          data-testid="asso-save"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
        >
          Add association
        </button>
        {errors.length > 0 && (
          <ul className="text-sm text-red-600" data-testid="asso-errors" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
