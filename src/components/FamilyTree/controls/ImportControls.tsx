import React, { useRef, useState } from 'react';
import { Upload, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../../store/familyStore';
import { getAdapter, getCitationApi } from '../../../lib/adapters';
import { importIndividuals } from '../../../lib/gedcom/importIndividuals';
import { importFamilies } from '../../../lib/gedcom/importFamilies';
import { buildImportPlan } from '../../../lib/gedcom/importPlan';
import {
  applyImportPlan,
  type ImportApplyReport,
} from '../../../lib/gedcom/applyImportPlan';
import { extractGedcom } from '../../../lib/gedcom/importPipeline';
import { GEDCStruct, g7ConfGEDC } from '../../../lib/gedcom/vendor/gedcstruct.js';
import { buildCitationPlanFromRecords } from '../../../lib/gedcom/citationPlan';
import {
  applyCitationPlan,
  type CitationApplyReport,
} from '../../../lib/gedcom/citationApply';

/**
 * Import controls (S1F6-C): wires the pure import libs
 * (importIndividuals, importFamilies, buildImportPlan,
 * applyImportPlan, extractGedcom) to the active adapter.
 *
 * File kind is detected by content (ZIP magic), never by extension.
 * Every failure mode gets an honest visible message; nothing fails
 * silently. The success summary reports created members, created
 * relations, and skipped/failed counts as reported by applyImportPlan.
 */
export const ImportControls: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [report, setReport] = useState<ImportApplyReport | null>(null);
  const [citationSummary, setCitationSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation('common');
  const currentFamilyTreeId = useFamilyStore((s) => s.currentFamilyTreeId);
  const fetchMembers = useFamilyStore((s) => s.fetchMembers);

  const handleDropdownToggle = () => {
    setShowPanel(!showPanel);
  };

  const handleDropdownClose = () => {
    setShowPanel(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setShowPanel(false);
    }
  };

  const importFile = async (file: File) => {
    setIsImporting(true);
    setErrorKey(null);
    setReport(null);
    setCitationSummary(null);
    try {
      if (!currentFamilyTreeId) {
        setErrorKey('import.errors.noTree');
        return;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      let gedcom: string;
      let citationEntries: ReturnType<
        typeof buildCitationPlanFromRecords
      > = [];
      try {
        gedcom = extractGedcom(bytes).text;
      } catch (error) {
        console.error('GEDCOM extract failed:', error);
        setErrorKey('import.errors.unreadable');
        return;
      }

      // Citation plan entries come from a dedicated parse of the raw
      // GEDCOM text (vendor GEDCStruct, dialect g7ConfGEDC), split into
      // INDI/FAM records. Failure here must not block the import itself.
      try {
        const records = GEDCStruct.fromString(gedcom, g7ConfGEDC, (msg: string) =>
          console.info('GEDCOM parse:', msg),
        );
        const indiRecords = records.filter((r) => r?.tag === 'INDI');
        const famRecords = records.filter((r) => r?.tag === 'FAM');
        citationEntries = buildCitationPlanFromRecords(indiRecords, famRecords);
      } catch (error) {
        console.error('Citation plan build failed:', error);
        citationEntries = [];
      }

      const individuals = importIndividuals(gedcom, (msg) =>
        console.info('GEDCOM parse:', msg),
      );
      const families = importFamilies(gedcom, (msg) =>
        console.info('GEDCOM parse:', msg),
      );
      const plan = buildImportPlan(individuals, families);

      if (plan.members.length === 0) {
        setErrorKey('import.errors.empty');
        return;
      }

      const adapter = getAdapter();
      const treeId = currentFamilyTreeId;
      const applyReport = await applyImportPlan(plan, {
        treeId,
        createMember: (input) =>
          adapter
            .createMember(treeId, {
              name: input.name ?? '',
              gender: input.gender,
              birthDate: input.birthDate ?? '',
              deathDate: input.deathDate,
              birthPlace: input.birthPlace,
              privacyStatus: input.privacyStatus,
            })
            .then((record) => record.id),
        createRelation: (id, memberId, relatedId, type) =>
          adapter
            .createRelationship(id, memberId, relatedId, type)
            .then(() => undefined),
      });
      setReport(applyReport);

      // Citation phase: only meaningful on server-backed adapters
      // (getCitationApi returns null on mock/supabase). Runs after
      // applyImportPlan because citations need the new member DB ids.
      const citationApi = getCitationApi();
      let citationReport: CitationApplyReport | undefined;
      if (citationApi !== null) {
        const memberMap = new Map(
          applyReport.createdMembers
            .filter((m) => m.xref !== undefined)
            .map((m) => [m.xref, m.id]),
        );
        const resolveMember = (xref: string) =>
          memberMap.get(xref.replace(/^@|@$/g, ''));
        // FAM sitasi (MARR/DIV) membawa xref FAM; pasangan id DB diambil
        // dari data families hasil parse (husband/wife) lalu dipetakan ke
        // id DB lewat memberMap.
        const famMap = new Map(
          families
            .filter((f) => f.xref !== undefined)
            .map((f) => [f.xref, f]),
        );
        const resolveRelation = (xref: string): [string, string] | undefined => {
          const bare = xref.replace(/^@|@$/g, '');
          const fam = famMap.get(bare);
          if (fam === undefined) return undefined;
          const a =
            fam.husband !== undefined ? memberMap.get(fam.husband) : undefined;
          const b =
            fam.wife !== undefined ? memberMap.get(fam.wife) : undefined;
          if (a === undefined || b === undefined) return undefined;
          return [a, b] as [string, string];
        };
        citationReport = await applyCitationPlan(
          citationEntries,
          resolveMember,
          resolveRelation,
          {
            treeId,
            upsertSource: (tid, pointer) =>
              citationApi.upsertSource(tid, pointer),
            upsertCitation: (tid, spec) =>
              citationApi.upsertCitation(tid, spec),
          },
        );
        setCitationSummary(String(citationReport.createdCitations.length));
      }

      // Re-fetch so the tree view shows everything that landed.
      await fetchMembers(treeId);
    } catch (error) {
      console.error('GEDCOM import failed:', error);
      setErrorKey('import.errors.generic');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChosen = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void importFile(file);
  };

  return (
    <div className="relative">
      <button
        onClick={handleDropdownToggle}
        disabled={isImporting}
        className="flex items-center space-x-2 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        aria-label={t('import.button')}
        aria-expanded={showPanel}
        aria-haspopup="dialog"
        data-testid="import-button"
      >
        <Upload className="w-4 h-4" />
        <span>
          {isImporting ? t('import.busy') : t('import.button')}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ged,.gedzip"
        className="hidden"
        onChange={handleFileChosen}
        data-testid="import-file-input"
      />

      {showPanel && (
        <>
          {/* Accessible backdrop button for closing the panel */}
          <button
            type="button"
            className="fixed inset-0 z-40 bg-transparent border-none outline-hidden cursor-default"
            onClick={handleDropdownClose}
            onKeyDown={handleKeyDown}
            aria-label={t('import.close')}
            tabIndex={0}
          />
          <div
            className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2 px-3"
            role="dialog"
            aria-label={t('import.button')}
          >
            <p className="text-xs text-gray-500 mt-1">
              {t('import.hint')}
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || !currentFamilyTreeId}
              className="mt-2 w-full text-left px-3 py-2 text-sm rounded border border-gray-200 hover:bg-gray-50 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="import-choose-file"
            >
              <Upload className="w-4 h-4" />
              <span>{t('import.chooseFile')}</span>
            </button>

            {!currentFamilyTreeId && (
              <p className="mt-2 text-xs text-amber-700" role="alert">
                {t('import.errors.noTree')}
              </p>
            )}

            {errorKey && currentFamilyTreeId && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {t(errorKey)}
              </p>
            )}

            {report && (
              <div
                className="mt-2 text-xs text-gray-700 space-y-1"
                data-testid="import-summary"
              >
                <p className="font-semibold text-gray-800">
                  {t('import.summary.title')}
                </p>
                <p>
                  {t('import.summary.members', {
                    count: report.createdMembers.length,
                  })}
                </p>
                <p>
                  {t('import.summary.relations', {
                    count: report.createdRelations,
                  })}
                </p>
                {report.skippedRelations.length > 0 && (
                  <p>
                    {t('import.summary.skipped', {
                      count: report.skippedRelations.length,
                    })}
                  </p>
                )}
                {report.failedMembers.length > 0 && (
                  <p className="text-red-600">
                    {t('import.summary.failed', {
                      count: report.failedMembers.length,
                    })}
                  </p>
                )}
                {citationSummary !== null && (
                  <p data-testid="import-citation-summary">
                    {`Citations created: ${citationSummary}`}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
