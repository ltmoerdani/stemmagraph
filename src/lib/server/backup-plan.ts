export function buildBackupPath(dir: string, now: Date): string {
	const yyyy = String(now.getUTCFullYear()).padStart(4, '0');
	const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(now.getUTCDate()).padStart(2, '0');
	const hh = String(now.getUTCHours()).padStart(2, '0');
	const mi = String(now.getUTCMinutes()).padStart(2, '0');
	const ss = String(now.getUTCSeconds()).padStart(2, '0');
	return `${dir}/.backup/stemmagraph-${yyyy}${mm}${dd}-${hh}${mi}${ss}.db`;
}

export function selectBackupsToKeep(list: string[], keep: number): string[] {
	const sorted = [...list].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
	return sorted.slice(0, Math.max(0, keep));
}
