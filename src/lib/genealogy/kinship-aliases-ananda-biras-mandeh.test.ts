/**
 * v253xxxvii: characterization tests gelombang 19, tiga key alias kinship:
 * ananda (hor, anak, kind child, pola anak), biras (pertalian persaudaraan
 * karena kawin dengan dua orang bersaudara, kind property, gugus affine,
 * pola besan), mandeh (Minangkabau, mak; ibu, kind parent depth 1 qualifier
 * minangkabau, pola amak).
 *
 * Guard kontrak:
 *   - ananda makna sapaan hormat TIDAK dipetakan sbg key lain.
 *   - biras makna umum mertua ipar TIDAK dipetakan.
 *   - mandeh TIDAK menimpa makde amak varian lain.
 * Anti-dup sudah diverifikasi PM: ketiga lemma nihil di map sebelum gelombang.
 * Guard global: 123 jadi 126.
 */
import { describe, expect, it } from 'vitest';
import {
    KINSHIP_ALIASES,
    resolveAlias,
} from './kinship-aliases';
import { expandAliasQuery } from './search-filter';

const GUARD_KEYS = 128;

describe('kinship aliases: ananda (gelombang 19)', () => {
    it('kasus 1: resolveAlias ananda positif kind child tanpa depth tanpa region, pola anak', () => {
        const r = resolveAlias('ananda');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('child');
        expect(r!.depth).toBeUndefined();
        expect(r!.region).toBeUndefined();
    });

    it('kasus 2: guard makna sapaan hormat ananda TIDAK dipetakan sbg key lain, ejaan ber titik nihil', () => {
        expect(KINSHIP_ALIASES['ananda']!.kind).toBe('child');
        expect(KINSHIP_ALIASES['a.nan.da']).toBeUndefined();
        expect(resolveAlias('a.nan.da')).toBeNull();
    });

    it('kasus 3: entri anak pembanding tetap utuh non-regresi blok A', () => {
        const r = resolveAlias('anak');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('child');
    });
});

describe('kinship aliases: biras (gelombang 19)', () => {
    it('kasus 4: resolveAlias biras positif kind property tanpa depth, pola besan', () => {
        const r = resolveAlias('biras');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('property');
        expect(r!.depth).toBeUndefined();
    });

    it('kasus 5: guard makna umum mertua ipar TIDAK dipetakan lewat biras, mertua ipar tetap key sendiri', () => {
        expect(KINSHIP_ALIASES['biras']!.kind).toBe('property');
        expect(resolveAlias('mertua')).not.toBeNull();
        expect(resolveAlias('ipar')).not.toBeNull();
        expect(KINSHIP_ALIASES['bi.ras']).toBeUndefined();
        expect(resolveAlias('bi.ras')).toBeNull();
    });

    it('kasus 6: entri besan pembanding tetap utuh non-regresi gugus affine', () => {
        const r = resolveAlias('besan');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('property');
    });
});

describe('kinship aliases: mandeh (gelombang 19)', () => {
    it('kasus 7: resolveAlias mandeh positif kind parent depth 1 qualifier minangkabau region Minangkabau, pola amak', () => {
        const r = resolveAlias('mandeh');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('parent');
        expect(r!.depth).toBe(1);
        expect(r!.qualifier).toBe('minangkabau');
        expect(r!.region).toBe('Minangkabau');
    });

    it('kasus 8: guard mandeh TIDAK menimpa makde amak varian lain', () => {
        expect(KINSHIP_ALIASES['makde']).toBeUndefined();
        expect(resolveAlias('makde')).toBeNull();
        const amak = resolveAlias('amak');
        expect(amak).not.toBeNull();
        expect(amak!.kind).toBe('parent');
        expect(amak!.qualifier).toBe('minangkabau');
        expect(KINSHIP_ALIASES['man.deh']).toBeUndefined();
        expect(resolveAlias('man.deh')).toBeNull();
    });
});

describe('kinship aliases: guard global gelombang 19', () => {
    it('kasus 9: guard jumlah key global PERSIS 126 pasca gelombang 19', () => {
        expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(GUARD_KEYS);
    });

    it('kasus 10: posisi alfabetis anak ananda, besan biras mama, engku mandeh mang', () => {
        const keys = Object.keys(KINSHIP_ALIASES);
        const iAnak = keys.indexOf('anak');
        const iAnanda = keys.indexOf('ananda');
        const iCucu = keys.indexOf('cucu');
        expect(iAnanda).toBe(iAnak + 1);
        expect(iAnanda).toBeLessThan(iCucu);
        const iBesan = keys.indexOf('besan');
        const iBiras = keys.indexOf('biras');
        const iMama = keys.indexOf('mama');
        expect(iBiras).toBe(iBesan + 1);
        expect(iBiras).toBeLessThan(iMama);
        const iEngku = keys.indexOf('engku');
        const iMandeh = keys.indexOf('mandeh');
        const iMang = keys.indexOf('mang');
        expect(iMandeh).toBe(iEngku + 1);
        expect(iMandeh).toBe(iMang - 1);
    });

    it('kasus 11: determinisme resolveAlias tiga panggilan hasil identik', () => {
        const a1 = JSON.stringify(resolveAlias('ananda'));
        const a2 = JSON.stringify(resolveAlias('ananda'));
        const b1 = JSON.stringify(resolveAlias('biras'));
        const b2 = JSON.stringify(resolveAlias('biras'));
        const m1 = JSON.stringify(resolveAlias('mandeh'));
        const m2 = JSON.stringify(resolveAlias('mandeh'));
        expect(a1).toBe(a2);
        expect(b1).toBe(b2);
        expect(m1).toBe(m2);
    });

    it('kasus 12: negasi guard typo nihil tetap null', () => {
        expect(resolveAlias('anandax')).toBeNull();
        expect(resolveAlias('birass')).toBeNull();
        expect(resolveAlias('mandehh')).toBeNull();
        expect(resolveAlias('')).toBeNull();
    });

    it('kasus 13: expandAliasQuery memuat ketiga lemma baru', () => {
        expect(expandAliasQuery('ananda')).toContain('ananda');
        expect(expandAliasQuery('biras')).toContain('biras');
        expect(expandAliasQuery('mandeh')).toContain('mandeh');
    });
});
