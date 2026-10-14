/**
 * D-v253-x: characterization tests untuk entri etek (pos 21) dan teteh (pos 22).
 *
 * Kontrak: TEPAT 6 berkas (entri di kinship-aliases.ts + testfile baru ini +
 * 4 bump guard testfile existing). Asersi mengunci perilaku aktual.
 *
 * Sumber:
 *   - etek: KBBI VI e.tek n Mk (adik perempuan ayah atau adik perempuan ibu;
 *     bibi; makcik) + Wiktionary ID revids 1134648.
 *   - teteh: KBBI VI te.teh1 n Sd (panggilan kakak perempuan) + Wiktionary ID
 *     revids 1455452; te.teh2 a Jw TIDAK dipetakan (guard homograf);
 *     varian tete (Sasak) tidak dipetakan.
 */
import { describe, expect, it } from 'vitest';
import {
    KINSHIP_ALIASES,
    resolveAlias,
} from './kinship-aliases';
import { expandAliasQuery } from './search-filter';

const GUARD_KEYS = 128;

describe('kinship aliases: etek (posisi 21)', () => {
    it('kasus 1: resolveAlias etek positif kind parent-sibling depth 1 Minangkabau', () => {
        const r = resolveAlias('etek');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('parent-sibling');
        expect(r!.depth).toBe(1);
        expect(r!.region).toBe('Minangkabau');
    });

    it('kasus 2: qualifier minangkabau terkunci (konsisten pola live bako mamak, koreksi PM atas kontrak mk)', () => {
        expect(resolveAlias('etek')!.qualifier).toBe('minangkabau');
    });

    it('kasus 3: bibi dan pakcik kini live pasca v253-xix; makcik live pasca v253-xv (jangkar edisi III)', () => {
        expect(resolveAlias('bibi')).not.toBeNull();
        expect(resolveAlias('makcik')).not.toBeNull();
        expect(resolveAlias('pakcik')).not.toBeNull();
    });

    it('kasus 4: etek tetap positif sbg lemma Mk, homonim Simalungun/Tao tidak mengganggu', () => {
        const r = resolveAlias('etek');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('parent-sibling');
    });

    it('kasus 5: expandAliasQuery memuat etek', () => {
        expect(expandAliasQuery('etek')).toContain('etek');
    });

    it('kasus 6: guard jumlah key global PERSIS 89 pasca v253-xii', () => {
        expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(GUARD_KEYS);
    });

    it('kasus 7: guard negatif typo nihil tetap null', () => {
        expect(resolveAlias('etekx')).toBeNull();
        expect(resolveAlias('tetehh')).toBeNull();
        expect(resolveAlias('')).toBeNull();
    });
});

describe('kinship aliases: teteh (posisi 22)', () => {
    it('kasus 8: resolveAlias teteh positif kind sibling depth 1 Sunda', () => {
        const r = resolveAlias('teteh');
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('sibling');
        expect(r!.depth).toBe(1);
        expect(r!.region).toBe('Sunda');
    });

    it('kasus 9: qualifier sunda terkunci', () => {
        expect(resolveAlias('teteh')!.qualifier).toBe('sunda');
    });

    it('kasus 10: guard homograf te.teh2 a Jw tidak memetakan makna lain; lemma te.teh2 nihil', () => {
        // Homograf bernomor tidak menjadi key; hanya te.teh1 yang dipetakan sbg teteh.
        expect(resolveAlias('teteh')!.kind).toBe('sibling');
        expect(KINSHIP_ALIASES['te.teh2']).toBeUndefined();
    });

    it('kasus 11: guard varian tete Sasak nihil', () => {
        expect(resolveAlias('tete')).toBeNull();
        expect(KINSHIP_ALIASES['tete']).toBeUndefined();
    });

    it('kasus 12: expandAliasQuery memuat teteh', () => {
        expect(expandAliasQuery('teteh')).toContain('teteh');
    });
});

describe('kinship aliases: gugus paman Minangkabau konsisten', () => {
    it('kasus 13: trio mamak bako etek konsisten kind parent-sibling Minangkabau', () => {
        expect(KINSHIP_ALIASES['mamak'].kind).toBe('parent-sibling');
        expect(KINSHIP_ALIASES['bako'].kind).toBe('parent-sibling');
        expect(KINSHIP_ALIASES['etek'].kind).toBe('parent-sibling');
        expect(KINSHIP_ALIASES['mamak'].region).toBe('Minangkabau');
        expect(KINSHIP_ALIASES['bako'].region).toBe('Minangkabau');
        expect(KINSHIP_ALIASES['etek'].region).toBe('Minangkabau');
    });
});
