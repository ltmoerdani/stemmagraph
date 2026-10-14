import { describe, expect, it } from 'vitest';
import { buildBackupPath, selectBackupsToKeep } from './backup-plan';

describe('buildBackupPath', () => {
	it('format timestamp zero-padded lengkap', () => {
		expect(buildBackupPath('/data', new Date(Date.UTC(2026, 0, 5, 3, 7, 9)))).toBe(
			'/data/.backup/stemmagraph-20260105-030709.db',
		);
	});

	it('zero-pad semua komponen dua digit kecuali tahun', () => {
		expect(buildBackupPath('/d', new Date(Date.UTC(2026, 10, 30, 23, 59, 59)))).toBe(
			'/d/.backup/stemmagraph-20261130-235959.db',
		);
	});

	it('pola nama file stemmagraph-<YYYYMMDD>-<HHmmss>.db', () => {
		const nama = buildBackupPath('/x', new Date(Date.UTC(2026, 5, 15, 2, 0, 0))).split('/').pop();
		expect(nama).toMatch(/^stemmagraph-\d{8}-\d{6}\.db$/);
	});

	it('folder .backup jadi segmen terakhir sebelum nama file', () => {
		const segmen = buildBackupPath('/a/b/c', new Date(0)).split('/');
		expect(segmen[segmen.length - 2]).toBe('.backup');
	});

	it('deterministik untuk Date yang sama', () => {
		const now = new Date(Date.UTC(2026, 8, 1, 12, 34, 56));
		expect(buildBackupPath('/d', now)).toBe(buildBackupPath('/d', now));
	});
});

describe('selectBackupsToKeep', () => {
	const lima = [
		'/d/.backup/stemmagraph-20260101-000000.db',
		'/d/.backup/stemmagraph-20260102-000000.db',
		'/d/.backup/stemmagraph-20260103-000000.db',
		'/d/.backup/stemmagraph-20260104-000000.db',
		'/d/.backup/stemmagraph-20260105-000000.db',
	];

	it('retention keep=3 dari 5 input ambil 3 leksikografis terbaru', () => {
		expect(selectBackupsToKeep(lima, 3)).toEqual([
			'/d/.backup/stemmagraph-20260105-000000.db',
			'/d/.backup/stemmagraph-20260104-000000.db',
			'/d/.backup/stemmagraph-20260103-000000.db',
		]);
	});

	it('retention pada input acak deterministik tetap N terbaru', () => {
		const acak = [lima[2], lima[0], lima[4], lima[1], lima[3]];
		expect(selectBackupsToKeep(acak, 2)).toEqual([
			'/d/.backup/stemmagraph-20260105-000000.db',
			'/d/.backup/stemmagraph-20260104-000000.db',
		]);
	});

	it('keep >= panjang list mengembalikan semua', () => {
		expect(selectBackupsToKeep(lima, 5)).toHaveLength(5);
		expect(selectBackupsToKeep(lima, 99)).toEqual([...lima].reverse());
	});

	it('keep=0 mengembalikan list kosong', () => {
		expect(selectBackupsToKeep(lima, 0)).toEqual([]);
	});

	it('list kosong mengembalikan list kosong', () => {
		expect(selectBackupsToKeep([], 3)).toEqual([]);
	});

	it('nama identik stabil di posisi teratas hasil', () => {
		const hasil = selectBackupsToKeep([lima[0], lima[0], lima[1]], 3);
		expect(hasil[0]).toBe(lima[1]);
		expect(hasil[1]).toBe(lima[0]);
		expect(hasil[2]).toBe(lima[0]);
		expect(hasil).toHaveLength(3);
	});

	it('tidak memutasi input', () => {
		const salinan = [...lima];
		selectBackupsToKeep(lima, 2);
		expect(lima).toEqual(salinan);
	});

	it('nol fs: hasil murni fungsi dari argumen', () => {
		expect(selectBackupsToKeep([lima[3], lima[4]], 1)).toEqual([lima[4]]);
		expect(buildBackupPath('/d', new Date(1700000000000))).toBe(
			buildBackupPath('/d', new Date(1700000000000)),
		);
	});
});
