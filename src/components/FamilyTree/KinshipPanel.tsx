import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KinshipGraph } from '../../lib/genealogy/kinship';
import { listRelationships } from '../../lib/genealogy/kinship-calc';
import { kinshipLabelWithDepth } from '../../lib/genealogy/kinship-labels';
import { kinshipPhrase } from '../../lib/genealogy/kinship-phrase';

interface KinshipPanelProps {
  graph: KinshipGraph;
  fromId: string;
  getPersonName?: (id: string) => string;
}

/**
 * Panel daftar hubungan kekerabatan satu person dalam graph murni.
 * Hanya membaca listRelationships dan label i18n; tanpa store,
 * API, atau import dari sisi server.
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
        return (
          <li key={rel.personId}>
            <span>{name ?? rel.personId}</span>
            <span>{kinshipLabelWithDepth(rel.kind, rel.depth, locale)}</span>
            <span data-testid="kinship-phrase">({kinshipPhrase(rel, locale)})</span>
          </li>
        );
      })}
    </ul>
  );
};
