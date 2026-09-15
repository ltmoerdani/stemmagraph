import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, RefreshCw, Send, UserPlus, Users, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getInvitationAdminApi } from '../../lib/adapters';
import type {
  CreatedInvitation,
  InvitationRecord,
  InvitationTypeValue,
  TreeMembershipRecord,
  TreeRoleValue,
} from '../../lib/adapters';
import { formatDate } from '../../lib/i18n';
import { useAuthStore } from '../../store/authStore';
import { buildInvitationShareText, buildWhatsAppUrl, normalizeWhatsAppPhone } from '../../lib/share/whatsapp';

/**
 * Owner panel for invitations and tree membership (P2-3 AC-6).
 *
 * Three blocks: create an invitation link (personal or family), the
 * invitation list with computed status and revoke, and the tree member
 * list with role management. The server owns every decision
 * (FORBIDDEN_TREE, TREE_LAST_OWNER_GUARD, INVITATION_* codes); this
 * component renders the honest server messages verbatim.
 *
 * Copy discipline (R-74.6): the invite text never promises full tree
 * access and never suggests the server sends anything. The channel field
 * records the owner's intent only; sharing happens outside the app.
 *
 * WhatsApp path (P2-4 AC-3, ADR 0005): when the channel is 'wa' the panel
 * shows an optional phone input plus a share button. The button creates
 * the invitation through the same P2-3 API (payload carries the channel
 * intent only), composes the four-field text client-side, and opens
 * wa.me in a new tab. The typed phone lives in local component state
 * only: it is never sent to the server, never persisted, and it dies
 * with the panel when the owner closes it (the parent unmounts us).
 */
export const InvitationsPanel: React.FC<{ treeId: string; treeName: string; onClose: () => void }> = ({
  treeId,
  treeName,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const invitationsApi = getInvitationAdminApi();
  const user = useAuthStore((state) => state.user);

  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [members, setMembers] = useState<TreeMembershipRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  // Creation form state.
  const [inviteType, setInviteType] = useState<InvitationTypeValue>('personal');
  const [grantedRole, setGrantedRole] = useState<TreeRoleValue>('viewer');
  const [channel, setChannel] = useState<'manual' | 'wa' | 'email'>('manual');
  const [maxUses, setMaxUses] = useState('20');
  const [isCreating, setIsCreating] = useState(false);

  // WhatsApp share state. Local only: the phone number must never reach the
  // server, the URL bar outside wa.me, or any store. Unmounting the panel on
  // close throws this state away, which is the documented reset (P2-4).
  const [waPhone, setWaPhone] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const load = useCallback(async () => {
    if (!invitationsApi) return;
    try {
      const [invitationRows, memberRows] = await Promise.all([
        invitationsApi.listInvitations(treeId),
        invitationsApi.listTreeMembership(treeId),
      ]);
      setInvitations(invitationRows);
      setMembers(memberRows);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [invitationsApi, treeId]);

  useEffect(() => {
    if (!invitationsApi) return;
    let cancelled = false;
    (async () => {
      try {
        const [invitationRows, memberRows] = await Promise.all([
          invitationsApi.listInvitations(treeId),
          invitationsApi.listTreeMembership(treeId),
        ]);
        if (cancelled) return;
        setInvitations(invitationRows);
        setMembers(memberRows);
        setLoadFailed(false);
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invitationsApi, treeId]);

  // A personal invitation always grants viewer; editor needs family.
  const handleTypeChange = (next: InvitationTypeValue) => {
    setInviteType(next);
    if (next === 'personal') setGrantedRole('viewer');
  };

  const handleCreate = async () => {
    if (!invitationsApi) return;
    setIsCreating(true);
    setActionError(null);
    setCreated(null);
    setCopied(false);
    try {
      const input =
        inviteType === 'family'
          ? { type: inviteType, grantedRole, channel, maxUses: Number(maxUses) || undefined }
          : { type: inviteType, grantedRole: 'viewer' as const, channel };
      const record = await invitationsApi.createInvitation(treeId, input);
      setCreated(record);
      setInvitations(await invitationsApi.listInvitations(treeId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('invitePanel.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!invitationsApi) return;
    setActionError(null);
    try {
      await invitationsApi.revokeInvitation(invitationId);
      setInvitations(await invitationsApi.listInvitations(treeId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('invitePanel.revokeFailed'));
    }
  };

  const handleRoleChange = async (membershipId: string, role: TreeRoleValue) => {
    if (!invitationsApi) return;
    setActionError(null);
    try {
      await invitationsApi.updateTreeMembershipRole(treeId, membershipId, role);
      setMembers(await invitationsApi.listTreeMembership(treeId));
    } catch (err) {
      // TREE_LAST_OWNER_GUARD and friends arrive as honest server text.
      setActionError(err instanceof Error ? err.message : t('invitePanel.memberUpdateFailed'));
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!invitationsApi) return;
    setActionError(null);
    try {
      await invitationsApi.removeTreeMembership(treeId, membershipId);
      setMembers(await invitationsApi.listTreeMembership(treeId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('invitePanel.memberUpdateFailed'));
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // WhatsApp share (P2-4 AC-3): create the invitation, compose the share
  // text, open wa.me. The phone is validated first so a typo cannot burn
  // an invitation that could then never be shared. The phone itself never
  // leaves this component; the API payload holds the channel only.
  const handleWhatsAppShare = async () => {
    if (!invitationsApi) return;
    setActionError(null);
    setCreated(null);
    setCopied(false);

    const trimmedPhone = waPhone.trim();
    if (trimmedPhone !== '') {
      try {
        normalizeWhatsAppPhone(trimmedPhone);
      } catch {
        setActionError(t('invitePanel.waPhoneInvalid'));
        return;
      }
    }

    const inviterName = user?.name?.trim() ?? '';
    if (inviterName === '') {
      setActionError(t('invitePanel.createFailed'));
      return;
    }

    setIsSharing(true);
    try {
      const input =
        inviteType === 'family'
          ? { type: inviteType, grantedRole, channel: 'wa' as const, maxUses: Number(maxUses) || undefined }
          : { type: inviteType, grantedRole: 'viewer' as const, channel: 'wa' as const };
      // P2-3 API as-is: the URL comes from the server response, never rebuilt here.
      const record = await invitationsApi.createInvitation(treeId, input);
      setCreated(record);
      setInvitations(await invitationsApi.listInvitations(treeId));

      const shareText = buildInvitationShareText({
        inviterName,
        treeName,
        inviteUrl: record.url,
        message: t('invitePanel.waTemplate', { inviterName, treeName }),
      });
      // Empty phone falls back to wa.me's contact-picker form inside the
      // builder, so the owner picks the recipient in their own WhatsApp.
      window.open(buildWhatsAppUrl(trimmedPhone, shareText), '_blank', 'noopener,noreferrer');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('invitePanel.createFailed'));
    } finally {
      setIsSharing(false);
    }
  };

  const stateBadge = (state: InvitationRecord['state']) => {
    const palette: Record<InvitationRecord['state'], string> = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-700',
      exhausted: 'bg-gray-100 text-gray-700',
      revoked: 'bg-red-100 text-red-800',
      consumed: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${palette[state]}`}>
        {t(`invitePanel.state.${state}`)}
      </span>
    );
  };

  if (!invitationsApi) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <p className="text-sm text-gray-700">{t('invitePanel.unavailable')}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
          >
            {t('invitePanel.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="invitations-panel">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {t('invitePanel.title', { treeName })}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                void load();
              }}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              title={t('invitePanel.refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {actionError && (
            <div className="flex items-start space-x-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-sm text-red-800">{actionError}</p>
            </div>
          )}

          {/* Create invitation */}
          <section className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 flex items-center space-x-2 text-sm font-semibold text-gray-900">
              <Link2 className="h-4 w-4 text-blue-600" />
              <span>{t('invitePanel.createTitle')}</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-gray-700">
                {t('invitePanel.fieldType')}
                <select
                  value={inviteType}
                  onChange={(e) => handleTypeChange(e.target.value as InvitationTypeValue)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="personal">{t('invite.type.personal')}</option>
                  <option value="family">{t('invite.type.family')}</option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700">
                {t('invitePanel.fieldRole')}
                <select
                  value={grantedRole}
                  onChange={(e) => setGrantedRole(e.target.value as TreeRoleValue)}
                  disabled={inviteType === 'personal'}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-100"
                >
                  <option value="viewer">{t('invitePanel.role.viewer')}</option>
                  <option value="editor" disabled={inviteType === 'personal'}>
                    {t('invitePanel.role.editor')}
                  </option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700">
                {t('invitePanel.fieldChannel')}
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as 'manual' | 'wa' | 'email')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="manual">{t('invitePanel.channel.manual')}</option>
                  <option value="wa">{t('invitePanel.channel.wa')}</option>
                  <option value="email">{t('invitePanel.channel.email')}</option>
                </select>
              </label>
              {inviteType === 'family' && (
                <label className="text-xs font-medium text-gray-700">
                  {t('invitePanel.fieldMaxUses')}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                  />
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">{t('invitePanel.createHint')}</p>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="mt-3 flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              <span>{isCreating ? t('invitePanel.creating') : t('invitePanel.createAction')}</span>
            </button>

            {/* WhatsApp share block (P2-4 AC-3): optional phone, never stored. */}
            {channel === 'wa' && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3" data-testid="wa-share-block">
                <label className="text-xs font-medium text-gray-700">
                  {t('invitePanel.waPhoneLabel')}
                  <input
                    type="text"
                    inputMode="tel"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder={t('invitePanel.waPhonePlaceholder')}
                    autoComplete="off"
                    data-testid="wa-phone-input"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                  />
                </label>
                <p className="mt-1 text-xs text-gray-500">{t('invitePanel.waPhoneNote')}</p>
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  disabled={isSharing || isCreating}
                  data-testid="wa-share-button"
                  className="mt-2 flex items-center space-x-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>{isSharing ? t('invitePanel.creating') : t('invitePanel.waShareAction')}</span>
                </button>
              </div>
            )}

            {/* The full link appears exactly once, here. */}
            {created && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3" data-testid="created-invitation">
                <p className="flex items-center space-x-1 text-xs font-medium text-green-900">
                  <CheckCircle className="h-4 w-4" />
                  <span>{t('invitePanel.createdOnce')}</span>
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1 text-xs text-gray-800">
                    {created.url}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center space-x-1 rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copied ? t('invitePanel.copied') : t('invitePanel.copy')}</span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-green-800">{t('invitePanel.shareHint')}</p>
              </div>
            )}
          </section>

          {/* Invitation list */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">{t('invitePanel.listTitle')}</h3>
            {isLoading ? (
              <p className="py-4 text-center text-sm text-gray-500">{t('invitePanel.loading')}</p>
            ) : loadFailed ? (
              <p className="py-4 text-center text-sm text-red-600">{t('invitePanel.loadFailed')}</p>
            ) : invitations.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">{t('invitePanel.empty')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {t(`invite.type.${invitation.type}`)} · {t(`invitePanel.role.${invitation.grantedRole}`)} ·{' '}
                        <span className="font-mono text-xs text-gray-500">{invitation.tokenMasked}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('invitePanel.uses', { used: invitation.usedCount, max: invitation.maxUses })} ·{' '}
                        {t('invitePanel.expires', { date: formatDate(invitation.expiresAt, i18n.language) })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center space-x-2">
                      {stateBadge(invitation.state)}
                      {invitation.state === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(invitation.id)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          {t('invitePanel.revoke')}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Tree membership */}
          <section>
            <h3 className="mb-2 flex items-center space-x-2 text-sm font-semibold text-gray-900">
              <Users className="h-4 w-4 text-gray-600" />
              <span>{t('invitePanel.membersTitle')}</span>
            </h3>
            {isLoading ? (
              <p className="py-4 text-center text-sm text-gray-500">{t('invitePanel.loading')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {member.name}
                        {member.userStatus !== 'active' && (
                          <span className="ml-2 text-xs text-gray-500">({t(`invitePanel.userStatus.${member.userStatus}`)})</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-gray-500">{member.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center space-x-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as TreeRoleValue)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                        title={t('invitePanel.changeRole')}
                      >
                        <option value="owner">{t('invitePanel.role.owner')}</option>
                        <option value="editor">{t('invitePanel.role.editor')}</option>
                        <option value="viewer">{t('invitePanel.role.viewer')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        title={t('invitePanel.removeMember')}
                      >
                        {t('invitePanel.remove')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-gray-500">{t('invitePanel.membersHint')}</p>
          </section>
        </div>
      </div>
    </div>
  );
};
