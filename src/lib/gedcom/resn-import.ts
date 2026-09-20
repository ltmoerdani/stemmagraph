// Delegasi RESN import ke fungsi pure di privacy/resn (v128-ii-a).
import { resnToPrivacyStatus } from '../privacy/resn';

export function privacyStatusFromResn(resn: string | null | undefined): 'private' | null {
  return resnToPrivacyStatus(resn);
}
