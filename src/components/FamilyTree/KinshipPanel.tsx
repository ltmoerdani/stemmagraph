import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KinshipGraph } from '../../lib/genealogy/kinship';
import { listRelationships } from '../../lib/genealogy/kinship-calc';
import { kinshipLabelWithDepth } from '../../lib/genealogy/kinship-labels';
import { kinshipPhrase } from '../../lib/genealogy/kinship-phrase';
import { aliasDisplay } from '../../lib/genealogy/kinship-alias-note';
import { inlawDisplayForPhrase } from '../../lib/genealogy/kinship-inlaw-display';

interface KinshipPanelProps {
  graph: KinshipGraph;
  fromId: string;
  getPersonName?: (id: string) => string;
}

/**
 * Panel daftar hubungan kekerabatan satu person dalam graph murni.
 * Hanya membaca listRelationships dan label i18n; tanpa store,
 * API, atau import dari sisi server.
 *
 * v180-ii: frasa yang dikenali aliasDisplay tampil sebagai label baku
 * plus satu span catatan alias (note, lalu region, lalu register).
 * Bila alias nihil, cek inlawDisplayForPhrase: label in-law plus span
 * catatan in-law. Sisanya frasa polos apa adanya. Pola prioritas tiga
 * lapis persis MemberDetailSidebarKinship.
 */
export const KinshipPanel: React.FC<KinshipPanelProps> = ({
  graph,
  fromId,
  getPersonName,
}) => {
  const { i18n } = useTranslation();
  const locale: 'id' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'id';

  const related = listRelationships(graph, fromId).filter(
    (rel) => rel.kind !== 'unrelated',
  );

  if (related.length === 0) {
    return (
      <ul aria-label="kinship">
        <li>
          {locale === 'en' ? 'no other relationships' : 'tidak ada hubungan lain'}
        </li>
      </ul>
    );
  }

  return (
    <ul aria-label="kinship">
      {related.map((rel) => {
        const name = getPersonName ? getPersonName(rel.personId) : undefined;
        const frasa = kinshipPhrase(rel, locale);
        const alias = aliasDisplay(frasa, locale);
        if (alias === null) {
          const inlaw = inlawDisplayForPhrase(frasa, locale);
          if (inlaw !== null) {
            return (
              <li key={rel.personId}>
                <span>{name ?? rel.personId}</span>
                <span>{kinshipLabelWithDepth(rel.kind, rel.depth, locale)}</span>
                <span>{inlaw.label}</span>
                {inlaw.note !== null && (
                  <span data-testid="kinship-inlaw-note">{inlaw.note}</span>
                )}
              </li>
            );
          }
          return (
            <li key={rel.personId}>
              <span>{name ?? rel.personId}</span>
              <span>{kinshipLabelWithDepth(rel.kind, rel.depth, locale)}</span>
              <span data-testid="kinship-phrase">({frasa})</span>
            </li>
          );
        }
        const teksCatatan = alias.note ?? alias.region ?? alias.register;
        return (
          <li key={rel.personId}>
            <span>{name ?? rel.personId}</span>
            <span>{kinshipLabelWithDepth(rel.kind, rel.depth, locale)}</span>
            <span>{alias.label}</span>
            {teksCatatan !== null && (
              <span data-testid="kinship-alias-note">{teksCatatan}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
