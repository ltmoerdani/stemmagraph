/**
 * MemberPhotoControls (v398 AC5): unggah/ganti/hapus foto anggota di
 * MemberDetailSidebar, satu titik masuk. Dua langkah: pilih file lalu
 * preview konfirmasi (pola v386/v397) sebelum dikirim. Strip EXIF GPS
 * terjadi di client via preparePhotoForUpload (AC2) sebelum unggah.
 *
 * Adapter tanpa server (getMemberPhotoApi null): kontrol tidak dirender.
 * Guard role otoritatif di server (edit_member); error dirender jujur
 * per kode.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMemberPhotoApi } from '../../lib/adapters';
import { preparePhotoForUpload } from '../../lib/photo/photoClient';

interface Props {
  memberId: string;
  /** photoUrl eksisting; kehadiran menentukan label ganti vs unggah. */
  hasPhoto: boolean;
  /** Dipanggil setelah unggah/hapus sukses agar store ikut terbarui. */
  onUpdated: (photoUrl: string | null) => void;
}

/** Pesan clientError yang jujur untuk UI. */
function clientErrorCode(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  const known = ['EMPTY_FILE', 'TOO_LARGE', 'TOO_SMALL', 'NOT_AN_IMAGE'];
  return known.includes(msg) ? msg : 'API_ERROR';
}

export const MemberPhotoControls: React.FC<Props> = ({ memberId, hasPhoto, onUpdated }) => {
  const { t } = useTranslation();
  const [photoApi] = useState(() => getMemberPhotoApi());
  const fileRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lepas object URL lama tiap preview berganti dan saat unmount (memori).
  useEffect(() => {
    return () => {
      if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const onPickFile = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = ev.target.files?.[0] ?? null;
      ev.target.value = '';
      if (file === null) return;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const prepared = await preparePhotoForUpload(bytes);
        if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(prepared.blob);
        objectUrlRef.current = url;
        setPreviewUrl(url);
        setPendingBlob(prepared.blob);
      } catch (e) {
        setError(t(`memberPhoto.${clientErrorCode(e)}`));
      }
    },
    [t],
  );

  const clearPreview = useCallback(() => {
    if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setPreviewUrl(null);
    setPendingBlob(null);
  }, []);

  const applyUpload = useCallback(async () => {
    if (pendingBlob === null || photoApi === null) return;
    setBusy(true);
    setError(null);
    try {
      const type = pendingBlob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const bytes = new Uint8Array(await pendingBlob.arrayBuffer());
      const result = await photoApi.uploadMemberPhoto(memberId, bytes, type);
      clearPreview();
      setPendingBlob(null);
      onUpdated(result.photoUrl);
    } catch (e) {
      const code =
        e instanceof Error && typeof (e as { code?: string }).code === 'string'
          ? (e as { code: string }).code
          : clientErrorCode(e);
      setError(t(`memberPhoto.${code === 'NOT_FOUND' || code === 'UNAUTHORIZED' ? 'API_ERROR' : code}`));
    } finally {
      setBusy(false);
    }
  }, [clearPreview, memberId, onUpdated, pendingBlob, photoApi, t]);

  const removePhoto = useCallback(async () => {
    if (photoApi === null) return;
    setBusy(true);
    setError(null);
    try {
      await photoApi.deleteMemberPhoto(memberId);
      onUpdated(null);
    } catch (e) {
      setError(t(`memberPhoto.${clientErrorCode(e)}`));
    } finally {
      setBusy(false);
    }
  }, [memberId, onUpdated, photoApi, t]);

  if (photoApi === null) return null;

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPickFile}
        data-testid="member-photo-input"
      />
      {previewUrl !== null ? (
        <>
          <img
            src={previewUrl}
            alt="preview"
            className="w-24 h-24 rounded-full object-cover border-2 border-blue-500"
            data-testid="member-photo-preview"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={applyUpload}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              data-testid="member-photo-apply"
            >
              {busy ? t('memberPhoto.uploading') : t('memberPhoto.confirmApply')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={clearPreview}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
              data-testid="member-photo-cancel"
            >
              {t('memberPhoto.confirmCancel')}
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            data-testid="member-photo-pick"
          >
            {hasPhoto ? t('memberPhoto.change') : t('memberPhoto.upload')}
          </button>
          {hasPhoto && (
            <button
              type="button"
              disabled={busy}
              onClick={removePhoto}
              className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
              data-testid="member-photo-remove"
            >
              {busy ? t('memberPhoto.removing') : t('memberPhoto.remove')}
            </button>
          )}
        </div>
      )}
      {error !== null && (
        <p className="text-sm text-red-600" data-testid="member-photo-error">
          {error}
        </p>
      )}
    </div>
  );
};
