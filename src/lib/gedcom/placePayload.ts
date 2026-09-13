export function placePayload(raw: string): string | undefined {
  let out = raw.trim();
  out = out.replace(/\s+/g, ' ');
  out = out.replace(/[\p{Cc}\p{Cf}]/gu, '');
  out = out.replace(/@/g, '@@');
  if (out === '') return undefined;
  return out;
}
