// Kontrak: kinshipAliasPhrase menerjemahkan frasa kekerabatan bebas (alias KBBI)
// menjadi label baku id atau en. Return null bila frasa tidak dikenali.
// Pure function, tanpa dependensi react, zustand, prisma, atau server.

import { resolveAlias } from './kinship-aliases';
import { kinshipLabel, kinshipLabelWithDepth } from './kinship-labels';

export function kinshipAliasPhrase(phrase: string, lang: 'id' | 'en'): string | null {
  const entry = resolveAlias(phrase);
  if (entry === null) return null;
  if (typeof entry.depth === 'number') {
    return kinshipLabelWithDepth(entry.kind, entry.depth, lang);
  }
  return kinshipLabel(entry.kind, lang);
}
