// Shared collator for user-visible name sorting across the app.
// Indonesian locale, base sensitivity (case and diacritics fold together),
// numeric mode so "Anak 2" sorts before "Anak 10".
const nameCollator = new Intl.Collator('id', {
  sensitivity: 'base',
  numeric: true,
});

export const compareNames = (a: string, b: string): number =>
  nameCollator.compare(a, b);
