import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, User, Calendar, MapPin, Briefcase, Phone, ShieldCheck } from 'lucide-react';
import type { FamilyMember } from '../../../types/family';
import { getConsentApi, type ConsentStateView } from '../../../lib/adapters';
import {
  findDuplicatePairs,
  DEDUP_REASON,
  type DedupCandidate,
  type DedupPersonInput,
} from '../../../lib/genealogy/dedup-detect';

const DEDUP_REASON_LABEL: Record<string, string> = {
  [DEDUP_REASON.SAME_FIRST_NAME]: 'Nama depan sama',
  [DEDUP_REASON.SAME_LAST_NAME]: 'Nama belakang sama',
  [DEDUP_REASON.SAME_BIRTH_YEAR]: 'Tahun lahir sama',
};

/** Ubah FamilyMember (nama satu string) menjadi input dedup (depan + belakang). */
function toDedupPerson(member: FamilyMember): DedupPersonInput {
  const parts = member.name.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ');
  return {
    id: member.id,
    firstName: firstName === '' ? undefined : firstName,
    lastName: lastName === '' ? undefined : lastName,
    birthDate: member.birthDate ? member.birthDate : undefined,
    birthPlace: member.birthPlace ? member.birthPlace : undefined,
    gender: member.gender,
  };
}

interface MemberEditModalProps {
  member: FamilyMember;
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: FamilyMember) => void;
}

export const MemberEditModal: React.FC<MemberEditModalProps> = ({
  member,
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<FamilyMember>(member);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const consentApi = getConsentApi();
  const [consentState, setConsentState] = useState<ConsentStateView | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentScope, setConsentScope] = useState('');
  const [consentNote, setConsentNote] = useState('');
  const [consentActionError, setConsentActionError] = useState<string | null>(null);
  const [dedupMembers, setDedupMembers] = useState<FamilyMember[]>([]);
  const [dedupWarning, setDedupWarning] = useState<DedupCandidate[]>([]);
  const [dedupVisible, setDedupVisible] = useState(true);

  // Store dimuat dinamis (bukan import statis) supaya lingkungan test yang
  // tidak menyediakan modul store tetap bisa merender modal tanpa error;
  // kegagalan muat dianggap tidak ada data, peringatan dedup saja yang hilang.
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    import('../../../store/familyStore')
      .then((mod) => {
        if (active) setDedupMembers(mod.useFamilyStore.getState().members);
      })
      .catch(() => {
        if (active) setDedupMembers([]);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || dedupMembers.length === 0) {
      if (!isOpen) setDedupWarning([]);
      return;
    }
    const pairs = findDuplicatePairs(dedupMembers.map(toDedupPerson));
    setDedupWarning(pairs.slice(0, 3));
    setDedupVisible(true);
  }, [isOpen, dedupMembers]);

  const refreshConsent = React.useCallback(async () => {
    if (!consentApi) return;
    try {
      const state = await consentApi.getConsent(member.id);
      setConsentState(state);
    } catch (e) {
      setConsentError((e as Error).message);
    }
  }, [consentApi, member.id]);

  // Reset per-open consent state during render (the React-recommended
  // alternative to setState-in-effect); the effect below refetches.
  const [consentWasOpen, setConsentWasOpen] = useState(false);
  if (isOpen && !consentWasOpen) {
    setConsentWasOpen(true);
    setConsentState(null);
    setConsentError(null);
    setConsentScope('');
    setConsentNote('');
    setConsentActionError(null);
  } else if (!isOpen && consentWasOpen) {
    setConsentWasOpen(false);
  }

  useEffect(() => {
    if (!isOpen || !consentApi) return;
    let active = true;
    consentApi.getConsent(member.id)
      .then((state) => {
        if (active) setConsentState(state);
      })
      .catch((e) => {
        if (active) setConsentError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [isOpen, consentApi, member.id]);

  const handleConsentAction = async (action: 'grant' | 'revoke' | 'regrant') => {
    if (!consentApi || !consentScope.trim()) return;
    setConsentBusy(true);
    setConsentActionError(null);
    try {
      await consentApi.postConsent(
        member.id,
        action,
        consentScope.trim(),
        consentNote.trim() === '' ? undefined : consentNote.trim(),
      );
      setConsentScope('');
      setConsentNote('');
      await refreshConsent();
    } catch (e) {
      setConsentActionError((e as Error).message);
    } finally {
      setConsentBusy(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFormData(member);
      setErrors({});
    }
  }, [member, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.birthDate) {
      newErrors.birthDate = 'Birth date is required';
    }

    if (!formData.birthPlace?.trim()) {
      newErrors.birthPlace = 'Birth place is required';
    }

    if (!formData.gender) {
      newErrors.gender = 'Gender must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleInputChange = (field: keyof FamilyMember, value: string | boolean | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Member Profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Dedup warning: non-blocking, menyandingkan kandidat duplikat tanpa
            menghentikan alur simpan. Pengguna boleh menutup section ini. */}
        {dedupVisible && dedupWarning.length > 0 && (() => {
          const nameById = new Map(dedupMembers.map((m) => [m.id, m.name] as const));
          return (
            <div
              data-testid="dedup-warning"
              role="status"
              className="mx-6 mt-4 border border-amber-300 bg-amber-50 rounded-md p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-amber-800">
                  Kemungkinan data duplikat terdeteksi
                </h3>
                <button
                  type="button"
                  onClick={() => setDedupVisible(false)}
                  aria-label="Tutup peringatan duplikat"
                  className="text-amber-500 hover:text-amber-700 transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ul className="space-y-1">
                {dedupWarning.map((pair) => {
                  const nameA = nameById.get(pair.idA) ?? pair.idA;
                  const nameB = nameById.get(pair.idB) ?? pair.idB;
                  const reasons = pair.reasons
                    .map((r) => DEDUP_REASON_LABEL[r] ?? r)
                    .join(', ');
                  return (
                    <li
                      key={`${pair.idA}-${pair.idB}`}
                      data-testid="dedup-warning-row"
                      className="text-sm text-amber-900"
                    >
                      {nameA} dan {nameB}: skor {pair.score} ({reasons})
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-amber-700">
                Simpan tetap dapat dilanjutkan; periksa kembali bila data sudah benar.
              </p>
            </div>
          );
        })()}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div>
              <label htmlFor="member-name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                id="member-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter full name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Nickname */}
            <div>
              <label htmlFor="member-nickname" className="block text-sm font-medium text-gray-700 mb-1">
                Nickname
              </label>
              <input
                id="member-nickname"
                type="text"
                value={formData.nickname ?? ''}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                placeholder="Daily nickname"
              />
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="member-gender" className="block text-sm font-medium text-gray-700 mb-1">
                Gender *
              </label>
              <select
                id="member-gender"
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                  errors.gender ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {errors.gender && (
                <p className="mt-1 text-sm text-red-600">{errors.gender}</p>
              )}
            </div>

            {/* Generation */}
            <div>
              <label htmlFor="member-generation" className="block text-sm font-medium text-gray-700 mb-1">
                Generation
              </label>
              <input
                id="member-generation"
                type="number"
                min="1"
                max="10"
                value={formData.generation}
                onChange={(e) => handleInputChange('generation', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Privacy Status */}
            <div>
              <label htmlFor="member-privacy-status" className="block text-sm font-medium text-gray-700 mb-1">
                {t('memberEdit.privacyStatus', 'Privacy Status')}
              </label>
              <select
                id="member-privacy-status"
                value={formData.privacyStatus ?? 'shared'}
                onChange={(e) => handleInputChange('privacyStatus', e.target.value as 'shared' | 'private')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="shared">{t('memberEdit.privacyShared', 'Shared, include in public tree exports')}</option>
                <option value="private">{t('memberEdit.privacyPrivate', 'Private, redact in public tree exports')}</option>
              </select>
            </div>
          </div>

          {/* Birth Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-600" />
              Birth Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="member-birth-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Birth Date *
                </label>
                <input
                  id="member-birth-date"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                    errors.birthDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.birthDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.birthDate}</p>
                )}
              </div>

              <div>
                <label htmlFor="member-birth-place" className="block text-sm font-medium text-gray-700 mb-1">
                  Birth Place *
                </label>
                <input
                  id="member-birth-place"
                  type="text"
                  value={formData.birthPlace ?? ''}
                  onChange={(e) => handleInputChange('birthPlace', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                    errors.birthPlace ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="City/place of birth"
                />
                {errors.birthPlace && (
                  <p className="mt-1 text-sm text-red-600">{errors.birthPlace}</p>
                )}
              </div>
            </div>
          </div>

          {/* Life Status */}
          <div className="border-t pt-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center">
                <input
                  id="member-alive"
                  type="checkbox"
                  checked={formData.isAlive}
                  onChange={(e) => handleInputChange('isAlive', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="member-alive" className="ml-2 text-sm font-medium text-gray-700">
                  Living
                </label>
              </div>
            </div>

            {!formData.isAlive && (
              <div>
                <label htmlFor="member-death-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Death Date
                </label>
                <input
                  id="member-death-date"
                  type="date"
                  value={formData.deathDate ?? ''}
                  onChange={(e) => handleInputChange('deathDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 max-w-xs"
                />
              </div>
            )}
          </div>

          {/* Professional Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
              Professional Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="member-profession" className="block text-sm font-medium text-gray-700 mb-1">
                  Profession/Occupation
                </label>
                <input
                  id="member-profession"
                  type="text"
                  value={formData.profession ?? ''}
                  onChange={(e) => handleInputChange('profession', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="Occupation or profession"
                />
              </div>

              <div>
                <label htmlFor="member-education" className="block text-sm font-medium text-gray-700 mb-1">
                  Education
                </label>
                <input
                  id="member-education"
                  type="text"
                  value={formData.education ?? ''}
                  onChange={(e) => handleInputChange('education', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="Latest education"
                />
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-blue-600" />
              Location Information
            </h3>
            <div>
              <label htmlFor="member-location" className="block text-sm font-medium text-gray-700 mb-1">
                Current Location
              </label>
              <input
                id="member-location"
                type="text"
                value={formData.currentLocation ?? ''}
                onChange={(e) => handleInputChange('currentLocation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                placeholder="Current city/area of residence"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Phone className="w-5 h-5 mr-2 text-blue-600" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="member-phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="member-phone"
                  type="tel"
                  value={formData.phone ?? ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="+62812345678"
                />
              </div>

              <div>
                <label htmlFor="member-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="member-email"
                  type="email"
                  value={formData.email ?? ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="name@email.com"
                />
              </div>
            </div>
          </div>

          {/* Consent Ledger (S-06c) */}
          {consentApi && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" />
                {t('consent.title')}
              </h3>

              {consentError && (
                <p className="mb-3 text-sm text-red-600" role="alert">{consentError}</p>
              )}

              {consentState === null ? (
                <p className="text-sm text-gray-500">{t('consent.loading')}</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    {consentState.granted ? t('consent.grantedNow') : t('consent.revokedNow')}
                  </p>
                  {consentState.records.length === 0 ? (
                    <p className="text-sm text-gray-500 mb-4">{t('consent.empty')}</p>
                  ) : (
                    <ul className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                      {consentState.records.map((rec) => (
                        <li key={rec.id} className="text-sm border border-gray-200 rounded-md px-3 py-2">
                          <span className="font-medium">{rec.action}</span>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="text-gray-700">{rec.scope}</span>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="text-gray-500">{rec.at.slice(0, 10)}</span>
                          {rec.note && (
                            <p className="text-gray-500 mt-1">{rec.note}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="member-consent-scope" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('consent.scopeLabel')} *
                      </label>
                      <input
                        id="member-consent-scope"
                        type="text"
                        value={consentScope}
                        onChange={(e) => setConsentScope(e.target.value)}
                        disabled={consentBusy}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        placeholder={t('consent.scopePlaceholder')}
                      />
                    </div>
                    <div>
                      <label htmlFor="member-consent-note" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('consent.noteLabel')}
                      </label>
                      <input
                        id="member-consent-note"
                        type="text"
                        value={consentNote}
                        onChange={(e) => setConsentNote(e.target.value)}
                        disabled={consentBusy}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        placeholder={t('consent.notePlaceholder')}
                      />
                    </div>
                  </div>

                  {consentActionError && (
                    <p className="mt-2 text-sm text-red-600" role="alert">{consentActionError}</p>
                  )}

                  <div className="mt-3 flex space-x-3">
                    <button
                      type="button"
                      onClick={() => handleConsentAction('grant')}
                      disabled={consentBusy || !consentScope.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50"
                    >
                      {t('consent.grantAction')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConsentAction('revoke')}
                      disabled={consentBusy || !consentScope.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50"
                    >
                      {t('consent.revokeAction')}
                    </button>
                    {/* Regrant only when the last state is revoked: the reducer
                        (applyRecord) rejects regrant while granted or when the
                        member has no prior grant history. */}
                    {!consentState.granted && consentState.records.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleConsentAction('regrant')}
                        disabled={consentBusy || !consentScope.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                      >
                        {t('consent.regrantAction')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t pt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};