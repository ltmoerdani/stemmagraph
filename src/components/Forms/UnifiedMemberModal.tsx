import React, { useState, useRef } from 'react';
import { X, AlertCircle, CheckCircle, Clock, User, Calendar, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FamilyMember } from '../../types/family';
import { useFamilyStore } from '../../store/familyStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { getChangeReviewApi } from '../../lib/adapters';

const buildInitialFormData = (editingMember?: FamilyMember): FormData => {
  if (!editingMember) return initialFormData;
  return {
    name: editingMember.name ?? '',
    nickname: editingMember.nickname ?? '',
    gender: (editingMember.gender ?? 'male') as FormData['gender'],
    birthDate: editingMember.birthDate ?? '',
    birthPlace: editingMember.birthPlace ?? '',
    isAlive: editingMember.isAlive ?? true,
    deathDate: editingMember.deathDate ?? '',
    role: 'myself',
  };
};

interface RelationshipContext {
  relationshipType: string;
  targetMemberId: string;
}

interface UnifiedMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMember?: FamilyMember;
  familyTreeName?: string;
  isFirstMember?: boolean;
  relationshipContext?: RelationshipContext;
  /** S-14 U3: beri tahu pemanggil id anggota baru untuk reveal di canvas. */
  onMemberAdded?: (memberId: string) => void;
}

interface FormData {
  name: string;
  nickname: string;
  gender: 'male' | 'female';
  birthDate: string;
  birthPlace: string;
  isAlive: boolean;
  deathDate: string;
  role?: 'myself' | 'parent' | 'grandparent' | 'other'; // Only for first member
}

const initialFormData: FormData = {
  name: '',
  nickname: '',
  gender: 'male',
  birthDate: '',
  birthPlace: '',
  isAlive: true,
  deathDate: '',
  role: 'myself'
};

export const UnifiedMemberModal: React.FC<UnifiedMemberModalProps> = ({
  isOpen,
  onClose,
  editingMember,
  familyTreeName,
  isFirstMember = false,
  relationshipContext,
  onMemberAdded
}) => {
  const { t } = useTranslation();
  const { addMember, updateMember, addMemberWithRelationship, currentFamilyTreeId } = useFamilyStore();
  // P2-5 U5d: the caller's role on the active tree comes from the dashboard
  // records; mock and supabase trees carry no role, so the direct write path
  // stays the default there.
  const treeRole = useDashboardStore(
    (state) => state.familyTrees.find((tree) => tree.id === currentFamilyTreeId)?.role ?? null,
  );
  const changeApi = getChangeReviewApi();
  const isProposeFlow = Boolean(editingMember) && currentFamilyTreeId !== null && treeRole === 'editor' && changeApi !== null;
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [error, setError] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [proposeSent, setProposeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form state when the modal opens or the editing target changes.
  // Using the setState-during-render pattern (guarded by a ref) avoids
  // cascading renders from a syncing effect.
  const prevSignature = useRef<string | null>(null);
  const signature = `${isOpen ? 'open' : 'closed'}:${editingMember?.id ?? 'new'}`;
  if (prevSignature.current !== signature) {
    prevSignature.current = signature;
    setFormData(buildInitialFormData(editingMember));
    setError('');
    setReasonNote('');
    setProposeSent(false);
  }

  if (!isOpen) return null;

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Full name is required');
      return false;
    }

    if (formData.name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return false;
    }

    if (formData.birthDate) {
      const birthDate = new Date(formData.birthDate);
      if (isNaN(birthDate.getTime())) {
        setError('Invalid birth date format');
        return false;
      }
    }

    if (!formData.isAlive && formData.deathDate) {
      const deathDate = new Date(formData.deathDate);
      const birthDate = new Date(formData.birthDate);
      if (birthDate > deathDate) {
        setError('Death date cannot be earlier than birth date');
        return false;
      }
    }

    // The proposal contract demands prose: 3 to 500 trimmed characters, the
    // same bound the server enforces on reasonNote.
    if (isProposeFlow) {
      const note = reasonNote.trim();
      if (note.length < 3 || note.length > 500) {
        setError(t('changeReview.reasonNoteRequired'));
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const memberData: Partial<FamilyMember> = {
        name: formData.name.trim(),
        nickname: formData.nickname.trim() || undefined,
        gender: formData.gender,
        birthDate: formData.birthDate || undefined,
        birthPlace: formData.birthPlace.trim() || undefined,
        isAlive: formData.isAlive,
        deathDate: !formData.isAlive ? formData.deathDate || undefined : undefined
      };

      if (editingMember) {
        if (isProposeFlow && changeApi && currentFamilyTreeId) {
          // Editor path (P2-5): the edit becomes a proposal for the owner
          // gate. afterJson carries the form's member fields only, every
          // key inside the MEMBER_PROPOSAL_FIELDS contract, so the accept
          // flow applies exactly this slice to the live record.
          const afterJson: Record<string, unknown> = {
            name: formData.name.trim(),
            nickname: formData.nickname.trim() || null,
            gender: formData.gender,
            birthDate: formData.birthDate || null,
            birthPlace: formData.birthPlace.trim() || null,
            isAlive: formData.isAlive,
            deathDate: !formData.isAlive ? formData.deathDate || null : null,
          };
          await changeApi.createChangeProposal(currentFamilyTreeId, {
            targetType: 'member',
            targetId: editingMember.id,
            afterJson,
            reasonNote: reasonNote.trim(),
          });
          // Keep the modal open: the sent banner is the confirmation the
          // editor needs before closing.
          setProposeSent(true);
          return;
        }
        // Owner path: update the live record directly.
        await updateMember(editingMember.id, memberData);
      } else {
        // Add new member with proper generation logic for new family trees
        const newMember: FamilyMember = {
          id: `member-${crypto.randomUUID()}`,
          name: formData.name.trim(),
          nickname: formData.nickname.trim() || undefined,
          gender: formData.gender,
          birthDate: formData.birthDate,
          birthPlace: formData.birthPlace.trim() || undefined,
          isAlive: formData.isAlive,
          deathDate: !formData.isAlive ? formData.deathDate || undefined : undefined,
          // Smart generation assignment based on role for first member
          generation: isFirstMember ? getGenerationFromRole(formData.role) : 1,
          maritalStatus: 'single' // Default marital status
        };
        let addedId: string | undefined;
        if (relationshipContext) {
          // S-14 U2: route through the relationship path so the parent or
          // spouse edge is really created; generation is recomputed by the
          // store from the target member.
          addedId = await addMemberWithRelationship(
            newMember,
            relationshipContext.relationshipType,
            relationshipContext.targetMemberId,
          );
        } else {
          addedId = await addMember(newMember);
        }
        // S-14 fix (QA put-1 T1): pakai id balikan store (id adapter) agar
        // effect reveal menemukan anggota di store; id lokal newMember tidak
        // pernah ada di store dan memutus rantai reveal.
        if (addedId) onMemberAdded?.(addedId);
      }
      
      // Close modal and reset form
      handleClose();
      
    } catch (err) {
      console.error('Error saving member:', err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : isProposeFlow
            ? t('changeReview.proposeFailed')
            : 'Failed to save member data. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to determine generation based on role
  const getGenerationFromRole = (role?: string): number => {
    switch (role) {
      case 'grandparent': return 1;
      case 'parent': return 2;
      case 'myself': return 3;
      default: return 1; // Default to root generation
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setFormData(initialFormData);
      setError('');
      setReasonNote('');
      setProposeSent(false);
    }
  };

  const getModalTitle = () => {
    if (editingMember) return 'Edit Family Member';
    if (isFirstMember) return 'First Family Member';
    return 'Add Family Member';
  };

  const getModalSubtitle = () => {
    if (isFirstMember && familyTreeName) return familyTreeName;
    if (editingMember) return 'Edit family member details';
    return 'Enter new member details';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{getModalTitle()}</h2>
              <p className="text-sm text-gray-500">{getModalSubtitle()}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* First Member Context */}
          {isFirstMember && (
            <div className="mb-6 text-center">
              <p className="text-gray-700 mb-4">
                Who will be the <strong>"root"</strong> of this family tree?
              </p>
            </div>
          )}

          {/* P2-5 U5d: editors edit through the owner gate, not a direct write. */}
          {isProposeFlow && !proposeSent && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">{t('changeReview.proposeBanner')}</p>
            </div>
          )}

          {proposeSent && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-green-800 text-sm">{t('changeReview.proposeSent')}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div className="md:col-span-2">
                <label htmlFor="member-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="member-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    error && !formData.name.trim() ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., John Smith, Jane Doe"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              {/* Nickname */}
              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-2">
                  Nickname
                </label>
                <input
                  id="nickname"
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => updateFormData({ nickname: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nickname or alias"
                  disabled={isSubmitting}
                />
              </div>

              {/* Gender */}
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </legend>
                <div className="flex space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="male"
                      checked={formData.gender === 'male'}
                      onChange={(e) => updateFormData({ gender: e.target.value as 'male' | 'female' })}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700">Male</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="female"
                      checked={formData.gender === 'female'}
                      onChange={(e) => updateFormData({ gender: e.target.value as 'male' | 'female' })}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700">Female</span>
                  </label>
                </div>
              </fieldset>

              {/* Birth Date */}
              <div>
                <label htmlFor="birth-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Birth Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="birth-date"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => updateFormData({ birthDate: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                </div>
                
                {/* Birth year only checkbox removed - not in core data */}
              </div>

              {/* Birth Place */}
              <div>
                <label htmlFor="birth-place" className="block text-sm font-medium text-gray-700 mb-2">
                  Birth Place
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="birth-place"
                    type="text"
                    value={formData.birthPlace}
                    onChange={(e) => updateFormData({ birthPlace: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="City/Town"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Living Status */}
              <fieldset className="md:col-span-2">
                <legend className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </legend>
                <div className="flex space-x-4 mb-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.isAlive}
                      onChange={() => updateFormData({ isAlive: true, deathDate: '' })}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700">Living</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={!formData.isAlive}
                      onChange={() => updateFormData({ isAlive: false })}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700">Deceased</span>
                  </label>
                </div>

                {/* Death Date */}
                {!formData.isAlive && (
                  <div>
                    <label htmlFor="death-date" className="block text-sm font-medium text-gray-700 mb-2">
                      Death Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="death-date"
                        type="date"
                        value={formData.deathDate}
                        onChange={(e) => updateFormData({ deathDate: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}
              </fieldset>

              {/* Role Selection - Only for First Member */}
              {isFirstMember && (
                <div className="md:col-span-2">
                  <fieldset>
                    <legend className="block text-sm font-medium text-gray-700 mb-3">
                      Role:
                    </legend>
                    <div className="space-y-3">
                      {[
                        { value: 'myself', label: 'Myself', desc: 'I will be the center of the family tree' },
                        { value: 'parent', label: 'My parent', desc: 'Father or mother as the family root' },
                        { value: 'grandparent', label: 'Grandparent', desc: 'Oldest known generation' },
                        { value: 'other', label: 'Other', desc: 'Another family member' }
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                            formData.role === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}
                          aria-label={`${option.label}: ${option.desc}`}
                        >
                          <input
                            type="radio"
                            name="role"
                            value={option.value}
                            checked={formData.role === option.value}
                            onChange={(e) => updateFormData({ role: e.target.value as FormData['role'] })}
                            className="mt-1 text-blue-600 focus:ring-blue-500"
                            disabled={isSubmitting}
                            aria-describedby={`role-desc-${option.value}`}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{option.label}</div>
                            <div className="text-sm text-gray-500" id={`role-desc-${option.value}`}>{option.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}
            </div>

            {/* Reason note: only on the editor propose path (P2-5 U5d). */}
            {isProposeFlow && !proposeSent && (
              <div>
                <label htmlFor="reason-note" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('changeReview.reasonNoteLabel')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reason-note"
                  value={reasonNote}
                  onChange={(e) => {
                    setReasonNote(e.target.value);
                    setError('');
                  }}
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('changeReview.reasonNotePlaceholder')}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSubmitting || proposeSent || !formData.name.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2 min-w-30 justify-center"
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>
                  {(() => {
                    if (isSubmitting) return 'SAVING...';
                    if (isProposeFlow) return t('changeReview.submitPropose');
                    if (editingMember) return 'UPDATE';
                    return 'SAVE';
                  })()}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
