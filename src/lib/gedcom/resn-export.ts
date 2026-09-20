// Delegasi RESN export ke fungsi pure di privacy/resn (v128-ii-a).
import { privacyStatusToResn } from '../privacy/resn';

export function resnTagForStatus(status: string | null | undefined): 'PRIVACY' | null {
  return privacyStatusToResn(status);
}
