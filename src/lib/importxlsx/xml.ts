/**
 * v397 XLSX Import Fase 1: parser XML minimal, implementasi sendiri
 * tanpa dependency (kontrak AC1).
 *
 * Cakupan sengaja sempit untuk kebutuhan XLSX terkontrol (Excel
 * modern, LibreOffice, Google Sheets): tag pembuka dan penutup, tag
 * self-closing, atribut ber-kutip tunggal atau ganda, teks, entity
 * dasar (amp, lt, gt, quot, apos, numeric), serta pelewatkan XML
 * declaration, komentar, processing instruction, dan DOCTYPE.
 * CDATA dan prefix namespace eksotis di luar scope fase 1; nama tag
 * dengan prefix tetap dibaca dan konsumen memakai localName().
 * Tag self-closing memancarkan onStartTag lalu onEndTag supaya
 * konsumen memakai sarang simetris.
 */

export interface MiniXmlHandlers {
  onStartTag(name: string, attrs: Record<string, string>): void;
  onEndTag(name: string): void;
  onText(text: string): void;
}

/** Decodes the five XML named entities plus numeric references. */
export function decodeXmlEntities(input: string): string {
  if (!input.includes('&')) return input;
  return input.replace(/&(#x?[0-9A-Fa-f]+|amp|lt|gt|quot|apos);/g, (all, body: string) => {
    if (body === 'amp') return '&';
    if (body === 'lt') return '<';
    if (body === 'gt') return '>';
    if (body === 'quot') return '"';
    if (body === 'apos') return "'";
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isNaN(code) ? all : String.fromCodePoint(code);
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? all : String.fromCodePoint(code);
    }
    return all;
  });
}

/** Returns the tag or attribute name after any namespace prefix colon. */
export function localName(qualified: string): string {
  const idx = qualified.indexOf(':');
  return idx === -1 ? qualified : qualified.slice(idx + 1);
}

/**
 * Parses a whole XML document string through the handler callbacks.
 * Throws an Error on structurally impossible input (unexpected close
 * tag or truncated document mid-tag) so callers surface an honest
 * unreadable-file failure instead of partial silent data.
 */
export function parseMiniXml(input: string, handlers: MiniXmlHandlers): void {
  let i = 0;
  const n = input.length;
  const openStack: string[] = [];

  const skipUntil = (needle: string, from: number): number => {
    const hit = input.indexOf(needle, from);
    if (hit === -1) throw new Error('parseMiniXml: truncated markup');
    return hit + needle.length;
  };

  let textStart = 0;
  const flushText = (upto: number) => {
    if (upto > textStart) {
      handlers.onText(decodeXmlEntities(input.slice(textStart, upto)));
    }
  };

  while (i < n) {
    const lt = input.indexOf('<', i);
    if (lt === -1) {
      flushText(n);
      return;
    }
    flushText(lt);
    textStart = lt;

    if (input.startsWith('<?', lt)) {
      i = skipUntil('?>', lt + 2);
      textStart = i;
      continue;
    }
    if (input.startsWith('<!--', lt)) {
      i = skipUntil('-->', lt + 4);
      textStart = i;
      continue;
    }
    if (input.startsWith('<!', lt)) {
      // DOCTYPE and other constructs: no internal DTD subsets are
      // expected in XLSX parts; scan to the matching close bracket.
      let depth = 0;
      let j = lt + 2;
      for (; j < n; j += 1) {
        const ch = input[j];
        if (ch === '[') depth += 1;
        else if (ch === ']') depth -= 1;
        else if (ch === '>' && depth <= 0) break;
      }
      if (j >= n) throw new Error('parseMiniXml: truncated markup');
      i = j + 1;
      textStart = i;
      continue;
    }

    const gt = findTagEnd(input, lt);
    if (gt === -1) throw new Error('parseMiniXml: truncated tag');
    const inner = input.slice(lt + 1, gt);
    if (inner.startsWith('/')) {
      const closing = inner.slice(1).trim();
      const opened = openStack.pop();
      if (opened !== closing) {
        throw new Error(`parseMiniXml: tag penutup ${closing} tidak cocok dengan ${opened ?? 'nis'} yang terbuka`);
      }
      handlers.onEndTag(closing);
    } else {
      const selfClosing = inner.endsWith('/');
      const body = selfClosing ? inner.slice(0, -1) : inner;
      const { name, attrs } = readStartTag(body);
      handlers.onStartTag(name, attrs);
      if (selfClosing) {
        handlers.onEndTag(name);
      } else {
        openStack.push(name);
      }
    }
    i = gt + 1;
    textStart = i;
  }
}

/** Finds the '>' that closes a start or end tag, honoring quoted attribute values. */
function findTagEnd(input: string, from: number): number {
  let quote: string | null = null;
  for (let j = from + 1; j < input.length; j += 1) {
    const ch = input[j];
    if (quote !== null) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return j;
    }
  }
  return -1;
}

/** Reads "name a="1" b='2'" (without angle brackets) into name plus attrs. */
function readStartTag(body: string): { name: string; attrs: Record<string, string> } {
  const attrs: Record<string, string> = {};
  const tagMatch = /^\s*([^\s/]+)\s*/.exec(body);
  if (tagMatch === null) throw new Error('parseMiniXml: malformed tag');
  const name = tagMatch[1];
  let rest = body.slice(tagMatch[0].length);
  const attrRe = /^([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')\s*/;
  while (rest.length > 0) {
    const m = attrRe.exec(rest);
    if (m === null) break;
    const attrName = m[1];
    const rawValue = m[3] !== undefined ? m[3] : m[4];
    attrs[attrName] = decodeXmlEntities(rawValue);
    rest = rest.slice(m[0].length);
  }
  return { name, attrs };
}
