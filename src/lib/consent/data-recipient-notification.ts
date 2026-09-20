/**
 * Modul pure pemberitahuan penerima data fase II (STG v127-ii).
 * Sumber: VISION-stemmagraph gap 3 (alur consent penuh) dan catatan
 * riset notes/289 (ICO backup beyond use, Recital 27 deceased, GDPR
 * Art. 44.7.a isi pemberitahuan, Art. 44.7.b exemption disproportionate
 * effort). Modul ini murni menilai apakah pemegang data wajib
 * memberitahu penerima data, dibebaskan, atau ditunda. Tanpa import
 * eksternal selain konstanta staleness dari backup-policy.
 */

import { BACKUP_STALENESS_THRESHOLD_DAYS } from './backup-policy';

/** Input penilaian pemberitahuan penerima data. Timestamp berformat ISO 8601. */
export interface DataRecipientNotificationInput {
  /** Jumlah penerima data yang terdampak. */
  recipientCount: number;
  /** Timestamp backup terakhir, opsional. Absen berarti tidak ada dasar penilaian usang. */
  lastBackupAt?: string;
  /** true bila subjek data sudah meninggal (Recital 27). */
  deceasedFlag: boolean;
  /** Titik waktu penilaian, agar fungsi deterministik. */
  nowIso: string;
}

/** Hasil penilaian untuk satu titik waktu. */
export interface Verdict {
  /** notify: wajib beritahu; exempt: dibebaskan; defer: ditunda. */
  decision: 'notify' | 'exempt' | 'defer';
  /** Alasan singkat, selalu terisi, merujuk dasar aturannya. */
  reason: string;
}

const MS_PER_DAY = 86_400_000;

/**
 * Nilai true bila backup terakhir sudah usang relatif terhadap nowIso.
 * Ambang hari diimpor dari backup-policy agar tidak ada konstanta ganda.
 * Timestamp yang rusak tidak dianggap usang di sini karena staleness
 * tidak dapat dibuktikan, berbeda dengan modul backup yang memilih sisi
 * konservatif untuk keamanan pemulihan.
 */
function isBackupStaleForNotification(lastBackupAt: string, nowIso: string): boolean {
  const lastMs = Date.parse(lastBackupAt);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(lastMs) || Number.isNaN(nowMs)) {
    return false;
  }
  const ageDays = Math.floor((nowMs - lastMs) / MS_PER_DAY);
  return ageDays >= BACKUP_STALENESS_THRESHOLD_DAYS;
}

/**
 * Nilai true bila jumlah penerima mencapai ambang upaya tidak proporsional.
 * Ambang 100 penerima (Art. 44.7.b): tepat 100 sudah memenuhi ambang,
 * di bawahnya pemberitahuan masih dianggap layak dilakukan.
 */
function reachesEffortThreshold(recipientCount: number): boolean {
  return recipientCount >= 100;
}

/**
 * Nilai keputusan pemberitahuan penerima data. Urutan prioritas:
 * (a) deceased exempt per Recital 27, (b) ambang effort exempt per
 * Art. 44.7.b, (c) backup usang ditunda, (d) sisanya notify per
 * Art. 44.7.a. Fungsi murni: input sama menghasilkan verdict sama.
 */
export function evaluateRecipientNotification(input: DataRecipientNotificationInput): Verdict {
  if (input.deceasedFlag) {
    return {
      decision: 'exempt',
      reason: 'Recital 27 GDPR: data pribadi orang yang sudah meninggal bukan subjek data GDPR, kewajiban pemberitahuan penerima data gugur',
    };
  }
  if (reachesEffortThreshold(input.recipientCount)) {
    return {
      decision: 'exempt',
      reason: 'Art. 44.7.b GDPR: pemberitahuan memerlukan upaya tidak proporsional karena jumlah penerima mencapai ambang 100 penerima',
    };
  }
  if (input.lastBackupAt !== undefined && isBackupStaleForNotification(input.lastBackupAt, input.nowIso)) {
    return {
      decision: 'defer',
      reason: 'Backup usang melebihi threshold BACKUP_STALENESS_THRESHOLD_DAYS, pemberitahuan ditunda sampai backup ditinjau ulang',
    };
  }
  return {
    decision: 'notify',
    reason: 'Art. 44.7.a GDPR: pemberitahuan wajib memuat data apa yang diberikan, tujuan pemberian, sumber data, dan hak subjek',
  };
}
