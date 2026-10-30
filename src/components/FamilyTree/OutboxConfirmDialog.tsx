import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Dialog konfirmasi kirim outbox (GOAL v112 slice 3, bagian F).
 * Pola WAI-ARIA APG alertdialog: role alertdialog, aria-modal, judul dan
 * deskripsi dirujuk lewat aria-labelledby dan aria-describedby. Fokus awal
 * di tombol Batal, Escape membatalkan, klik pada overlay membatalkan,
 * fokus dikembalikan ke elemen pemanggil saat dialog ditutup (dengan guard
 * elemen masih ada di dokumen).
 */
interface OutboxConfirmDialogProps {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export const OutboxConfirmDialog: React.FC<OutboxConfirmDialogProps> = ({
  open,
  count,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation('common');
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      // Simpan elemen pemanggil sebelum fokus pindah ke dialog.
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      cancelRef.current?.focus();
      return;
    }
    // Tutup: kembalikan fokus ke pemanggil bila masih ada di dokumen.
    const opener = openerRef.current;
    if (opener && document.contains(opener)) {
      opener.focus();
    }
    openerRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onMouseDown={(event) => {
        // Interaksi di luar kotak dialog dianggap batal.
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="outbox-confirm-title"
        aria-describedby="outbox-confirm-desc"
        style={{ background: '#fff', padding: '1.5rem', borderRadius: 8, maxWidth: 420 }}
      >
        <h2 id="outbox-confirm-title">{t('offline.outbox.confirm', { count })}</h2>
        <p id="outbox-confirm-desc">{t('offline.outbox.confirm_desc')}</p>
        <button type="button" data-testid="outbox-cancel" ref={cancelRef} onClick={onCancel}>
          {t('offline.outbox.cancel')}
        </button>
        <button type="button" data-testid="outbox-confirm" onClick={onConfirm}>
          {t('offline.outbox.confirm_action')}
        </button>
      </div>
    </div>
  );
};
