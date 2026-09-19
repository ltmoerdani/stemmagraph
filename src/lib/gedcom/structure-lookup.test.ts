import { describe, expect, it } from 'vitest';
import { isExtension, lookupStructure, payloadType } from './structure-lookup';

const INDI = 'https://gedcom.io/terms/v7/record-INDI';
const FAM = 'https://gedcom.io/terms/v7/record-FAM';

describe('structure-lookup', () => {
  it('lookupStructure INDI SEX terdefinisi dengan payload type-Enum', () => {
    const entry = lookupStructure(INDI, 'SEX');
    expect(entry).toBeDefined();
    expect(entry?.payload).toBe('https://gedcom.io/terms/v7/type-Enum');
  });

  it('lookupStructure INDI MARR undefined (ilegal)', () => {
    expect(lookupStructure(INDI, 'MARR')).toBeUndefined();
  });

  it('root dokumen HEAD terdefinisi dengan kardinalitas {1:1}', () => {
    const entry = lookupStructure('', 'HEAD');
    expect(entry).toBeDefined();
    expect(entry?.cardinality).toBe('{1:1}');
  });

  it('root dokumen SEX undefined', () => {
    expect(lookupStructure('', 'SEX')).toBeUndefined();
  });

  it('lookupStructure FAM MARR terdefinisi', () => {
    const entry = lookupStructure(FAM, 'MARR');
    expect(entry).toBeDefined();
    expect(entry?.cardinality).toBe('{0:M}');
  });

  it('lookupStructure INDI BIRT payload Y|<NULL>', () => {
    const entry = lookupStructure(INDI, 'BIRT');
    expect(entry).toBeDefined();
    expect(entry?.payload).toBe('Y|<NULL>');
  });

  it('lookupStructure INDI _FOO undefined DAN isExtension true', () => {
    expect(lookupStructure(INDI, '_FOO')).toBeUndefined();
    expect(isExtension('_FOO')).toBe(true);
  });

  it('isExtension SEX false', () => {
    expect(isExtension('SEX')).toBe(false);
  });

  it('payloadType DATE berisi type-Date', () => {
    expect(payloadType('https://gedcom.io/terms/v7/DATE')).toBe(
      'https://gedcom.io/terms/v7/type-Date',
    );
  });

  it('lookupStructure INDI NAME terdefinisi', () => {
    const entry = lookupStructure(INDI, 'NAME');
    expect(entry).toBeDefined();
    expect(entry?.uri).toBe('https://gedcom.io/terms/v7/INDI-NAME');
  });
});
