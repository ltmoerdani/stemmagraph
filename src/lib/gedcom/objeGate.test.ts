import { describe, it } from 'vitest';
import { scanObjeGate } from './objeGate';

const HEAD = "0 HEAD\n1 GEDC\n2 VERS 7.0\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n";
const TRLR = "0 TRLR\n";

describe("scanObjeGate STG v467-A import gate OBJE", () => {
  it('kasus valid FILE plus FORM lolos', () => {
    const doc = HEAD + '0 @O1@ OBJE\n1 FILE https://contoh.id/foto.jpg\n2 FORM jpg\n' + TRLR;
    const got = scanObjeGate(doc);
    if (got.length > 0) throw new Error('valid harus lolos');
  });
  it('kasus OBJE tanpa FILE ditolak', () => {
    const doc = HEAD + '0 @O1@ OBJE\n1 TITL Tanpa File\n' + TRLR;
    const errs = scanObjeGate(doc);
    if (errs.length !== 1) throw new Error('harus satu error');
    const e = errs.at(0);
    if (e.code !== 'OBJE_NO_FILE') throw new Error('kode salah');
    if (e.line !== 6) throw new Error('baris salah');
    if (e.xref !== '@O1@') throw new Error('xref salah');
  });
  it('kasus FILE tanpa FORM ditolak', () => {
    const doc = HEAD + '0 @O1@ OBJE\n1 FILE https://contoh.id/foto.jpg\n' + TRLR;
    const errs = scanObjeGate(doc);
    const e = errs.at(0);
    if (errs.length !== 1) throw new Error('harus satu error');
    if (e.code !== 'FILE_NO_FORM') throw new Error('kode salah');
    if (e.line !== 7) throw new Error('baris salah');
    if (e.xref !== '@O1@') throw new Error('xref salah');
  });
  it('kasus dua FILE satu tanpa FORM', () => {
    const doc = HEAD + '0 @O1@ OBJE\n1 FILE https://contoh.id/a.jpg\n2 FORM jpg\n1 FILE https://contoh.id/b.png\n' + TRLR;
    const errs = scanObjeGate(doc);
    const e = errs.at(0);
    if (errs.length !== 1) throw new Error('harus satu error');
    if (e.code !== 'FILE_NO_FORM') throw new Error('kode salah');
    if (e.line !== 9) throw new Error('baris kedua FILE salah');
  });
  it('kasus pointer OBJE embedded tidak membuka record', () => {
    const doc = HEAD + '0 @I1@ INDI\n1 NAME A /B/\n1 OBJE @O1@\n' + TRLR;
    const got = scanObjeGate(doc);
    if (got.length > 0) throw new Error('pointer embedded harus lolos');
  });

  it('kasus FILE FORM di luar record OBJE diabaikan', () => {
    const doc = HEAD + '0 @S1@ SOUR\n1 FILE tanpa konteks\n' + TRLR;
    const got = scanObjeGate(doc);
    if (got.length > 0) throw new Error('FILE di luar OBJE harus diabaikan');
  });
  it('kasus record bergantian OBJE tanpa FILE tetap dilaporkan', () => {
    const doc = HEAD + '0 @O1@ OBJE\n1 TITL x\n0 @I1@ INDI\n1 NAME A /B/\n' + TRLR;
    const errs = scanObjeGate(doc);
    const e = errs.at(0);
    if (errs.length !== 1) throw new Error('harus satu error');
    if (e.code !== 'OBJE_NO_FILE') throw new Error('kode salah');
    if (e.line !== 6) throw new Error('baris salah');
    if (e.xref !== '@O1@') throw new Error('xref salah');
  });
});
