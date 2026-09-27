import { useTranslation } from 'react-i18next';
import { useKinshipGraph } from '../../hooks/useKinshipGraph';
import { listRelationships } from '../../lib/genealogy/kinship-calc';
import { kinshipPhrase } from '../../lib/genealogy/kinship-phrase';
import { aliasDisplay } from '../../lib/genealogy/kinship-alias-note';
import { inlawDisplayForPhrase } from '../../lib/genealogy/kinship-inlaw-display';

const MAX_ITEMS = 8;

/**
 * Sidebar kinship ringkas untuk detail anggota: daftar frasa kekerabatan
 * dari graph murni via hook useKinshipGraph, tanpa import server/prisma/API.
 *
 * Pure UI: hanya membaca graph + selectedMember dari hook dan locale dari
 * i18n (pola KinshipPanel). Maksimal MAX_ITEMS relasi tampil; kind
 * 'unrelated' disembunyikan; bila kosong tampil satu baris teks kosong.
 *
 * v179-i: frasa yang dikenali aliasDisplay ditampilkan sebagai label baku
 * plus satu span catatan alias (note, lalu region, lalu register). Frasa
 * yang tidak dikenali tampil apa adanya tanpa span tambahan.
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
        related.map((rel, idx) => {
          const frasa = kinshipPhrase(rel, locale);
          const alias = aliasDisplay(frasa, locale);
          if (alias === null) {
            const inlaw = inlawDisplayForPhrase(frasa, locale);
            if (inlaw !== null) {
              return (
                <li key={`${rel.kind}-${rel.depth}-${idx}`}>
                  {inlaw.label}
                  {inlaw.note !== null && (
                    <span data-testid="member-kinship-inlaw-note">{inlaw.note}</span>
                  )}
                </li>
              );
            }
            return <li key={`${rel.kind}-${rel.depth}-${idx}`}>{frasa}</li>;
          }
          const teksCatatan = alias.note ?? alias.region ?? alias.register;
          return (
            <li key={`${rel.kind}-${rel.depth}-${idx}`}>
              {alias.label}
              {teksCatatan !== null && (
                <span data-testid="member-kinship-alias-note">{teksCatatan}</span>
              )}
            </li>
          );
        })
      )}
    </ul>
  );
}
