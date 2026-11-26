export type DateSlashErrorCode = 'DATE_SLASH_NOTATION';

export interface DateSlashError {
  code: DateSlashErrorCode;
  message: string;
  offset: number;
  payload: string;
}

export function detectDateSlash(payload: string | undefined): DateSlashError | null {
  if (payload === undefined) return null;
  const idx = payload.indexOf('/');
  if (idx === -1) return null;
  return {
    code: 'DATE_SLASH_NOTATION',
    message: `Payload DATE "${payload}" pada offset ${idx} ditolak: notasi tahun slash dihapus di GEDCOM 7, gunakan substructure PHRASE.`,
    offset: idx,
    payload,
  };
}
