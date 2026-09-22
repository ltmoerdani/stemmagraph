import { useTranslation } from 'react-i18next';
import { useKinshipGraph } from '../../hooks/useKinshipGraph';
import { listRelationships } from '../../lib/genealogy/kinship-calc';
import { kinshipPhrase } from '../../lib/genealogy/kinship-phrase';

const MAX_ITEMS = 8;

/**
 * Sidebar kinship ringkas untuk detail anggota: daftar frasa kekerabatan
 * dari graph murni via hook useKinshipGraph, tanpa import server/prisma/API.
 *
 * Pure UI: hanya membaca graph + selectedMember dari hook dan locale dari
 * i18n (pola KinshipPanel). Maksimal MAX_ITEMS relasi tampil; kind
 * 'unrelated' disembunyikan; bila kosong tampil satu baris teks kosong.
 */
export function MemberDetailSidebarKinship() {
  const { graph, selectedMember } = useKinshipGraph();
  const { i18n } = useTranslation();
  const locale: 'id' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'id';

  if (!selectedMember) return null;

  const related = listRelationships(graph, selectedMember.id)
    .filter((rel) => rel.kind !== 'unrelated')
    .slice(0, MAX_ITEMS);

  return (
    <ul aria-label="member-kinship">
      {related.length === 0 ? (
        <li>{locale === 'en' ? 'no other relationships' : 'tidak ada hubungan lain'}</li>
      ) : (
        related.map((rel, idx) => (
          <li key={`${rel.kind}-${rel.depth}-${idx}`}>{kinshipPhrase(rel, locale)}</li>
        ))
      )}
    </ul>
  );
}
