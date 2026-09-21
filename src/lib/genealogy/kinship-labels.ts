import type { KinshipKind } from './kinship-calc';

export const KINSHIP_LABELS: Record<KinshipKind, { id: string; en: string }> = {
  self: { id: 'anda', en: 'you' },
  partner: { id: 'pasangan', en: 'spouse' },
  parent: { id: 'orang tua', en: 'parent' },
  child: { id: 'anak', en: 'child' },
  sibling: { id: 'saudara', en: 'sibling' },
  grandparent: { id: 'kakek nenek', en: 'grandparent' },
  grandchild: { id: 'cucu', en: 'grandchild' },
  'parent-sibling': { id: 'om atau tante', en: 'uncle or aunt' },
  'sibling-child': { id: 'keponakan', en: 'nephew or niece' },
  cousin: { id: 'sepupu', en: 'cousin' },
  ancestor: { id: 'nenek moyang', en: 'ancestor' },
  descendant: { id: 'keturunan', en: 'descendant' },
  unrelated: { id: 'tidak berhubungan', en: 'unrelated' },
};

export function kinshipLabel(kind: KinshipKind, locale: 'id' | 'en'): string {
  const key: 'id' | 'en' = locale === 'en' ? 'en' : 'id';
  return KINSHIP_LABELS[kind][key];
}

export function kinshipLabelWithDepth(
  kind: KinshipKind,
  depth: number | undefined,
  locale: 'id' | 'en'
): string {
  const label = kinshipLabel(kind, locale);
  if (depth === undefined || depth <= 0) return label;
  const unit = locale === 'en' ? 'generations' : 'generasi';
  return `${label} (${depth} ${unit})`;
}
