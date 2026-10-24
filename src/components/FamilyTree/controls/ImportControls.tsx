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
import {
  buildUndoPlan,
  type UndoPlan,
} from '../../../lib/gedcom/importUndoPlan';
import {
  executeUndoPlan,
  type UndoExecuteReport,
} from '../../../lib/gedcom/executeUndoPlan';
import { extractGedcom } from '../../../lib/gedcom/importPipeline';
import { GEDCStruct, g7ConfGEDC } from '../../../lib/gedcom/vendor/gedcstruct.js';
import { buildCitationPlanFromRecords } from '../../../lib/gedcom/citationPlan';
import {
  applyCitationPlan,
  type CitationApplyReport,
} from '../../../lib/gedcom/citationApply';
import {
  previewCsvImport,
  generateCsvTemplate,
  type CsvImportPreview,
} from '../../../lib/importcsv/validateCsv';

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
  const [undoPlan, setUndoPlan] = useState<UndoPlan | null>(null);
  const [undoSummary, setUndoSummary] = useState<UndoExecuteReport | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvErrorKey, setCsvErrorKey] = useState<string | null>(null);
  const [csvSummary, setCsvSummary] = useState<{
    ok: number;
    fail: number;
  } | null>(null);
  const [isCsvImporting, setIsCsvImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
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
    setUndoPlan(null);
    setUndoSummary(null);
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
      // Snapshot pra-import (v377): id anggota yang sudah ada di pohon
      // sebelum applyImportPlan; dasar buildUndoPlan memisahkan karya
      // import dari data lama. Gagal snapshot tidak memblokir import,
      // hanya undo yang tidak ditawarkan (tanpa bukti pra-import,
      // membalik import berisiko menyentuh data lama).
      let existingIds: string[] | null = null;
      try {
        existingIds = (await adapter.listMembers(treeId)).map(
          (member) => member.id,
        );
      } catch (error) {
        console.error('Undo snapshot failed:', error);
      }
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
      // Rencana undo (v377): hanya karya import terakhir yang boleh
      // dibalik; plan dipakai tombol undo di panel ringkasan. Tanpa
      // snapshot pra-import, undo tidak ditawarkan sama sekali.
      if (existingIds !== null) {
        setUndoPlan(buildUndoPlan({ report: applyReport, existingIds }));
      }

      // Citation phase: only meaningful on server-backed adapters
      // (getCitationApi returns null on mock/supabase). Runs after
      // applyImportPlan because citations need the new member DB ids.
      const citationApi = getCitationApi();
      let citationReport: CitationApplyReport | undefined;
      if (citationApi !== null) {
        // Keys bare (strip @ dua sisi): xref dari parser sudah tanpa @,
        // tapi payload SOUR bisa membawa bentuk @I1@; lookup resolver
        // memakai bare, jadi build map harus konsisten bare juga.
        const memberMap = new Map<string, string>();
        for (const m of applyReport.createdMembers) {
          if (m.xref !== undefined) {
            memberMap.set(m.xref.replace(/^@|@$/g, ''), m.id);
          }
        }
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

  // v386 CSV: baca file, validasi murni, tampilkan preview. Import
  // baru jalan setelah konfirmasi eksplisit pengguna (dua langkah).
  const handleCsvChosen = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvErrorKey(null);
    setCsvSummary(null);
    setCsvPreview(null);
    setCsvFileName(file.name);
    try {
      const text = await file.text();
      const preview = previewCsvImport(text);
      setCsvPreview(preview);
    } catch (error) {
      console.error('CSV read failed:', error);
      setCsvErrorKey('import.csv.errors.unreadable');
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  // v386 CSV: konfirmasi preview menjadi create member per baris valid
  // via adapter existing. Gagal per baris dihitung jujur; sisa baris
  // tetap dicoba. Setelah selesai: refresh pohon.
  const handleCsvConfirm = async () => {
    if (!currentFamilyTreeId || !csvPreview || isCsvImporting) return;
    setIsCsvImporting(true);
    setCsvErrorKey(null);
    try {
      const adapter = getAdapter();
      const treeId = currentFamilyTreeId;
      let ok = 0;
      let fail = 0;
      for (const draft of csvPreview.valid) {
        try {
          await adapter.createMember(treeId, {
            name: draft.name,
            nickname: draft.nickname,
            marga: draft.marga,
            gender: draft.gender,
            birthDate: draft.birthDate,
            deathDate: draft.deathDate,
            birthPlace: draft.birthPlace,
            isAlive: draft.isAlive,
            generation: draft.generation,
            maritalStatus: draft.maritalStatus,
          });
          ok += 1;
        } catch (error) {
          console.error('CSV member create failed:', error);
          fail += 1;
        }
      }
      setCsvSummary({ ok, fail });
      setCsvPreview(null);
      setCsvFileName(null);
      await fetchMembers(treeId);
    } catch (error) {
      console.error('CSV import failed:', error);
      setCsvErrorKey('import.csv.errors.generic');
    } finally {
      setIsCsvImporting(false);
    }
  };

  const handleCsvCancel = () => {
    setCsvPreview(null);
    setCsvFileName(null);
    setCsvErrorKey(null);
  };

  const handleCsvTemplateDownload = () => {
    const csv = generateCsvTemplate();
    const blob = new Blob(['\ufeff' + csv], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'stemmagraph-member-template.csv';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Undo import terakhir (v377): eksekusi plan lewat io adapter, lalu
  // refresh tampilan. Tombol disabled saat berjalan (anti klik ganda).
  // executeUndoPlan tidak pernah melempar; kegagalan per entri atau
  // invalidInput dilaporkan jujur lewat undoSummary.
  const handleUndo = async () => {
    if (!currentFamilyTreeId || !undoPlan || !undoPlan.safe || isUndoing) {
      return;
    }
    setIsUndoing(true);
    try {
      const adapter = getAdapter();
      const treeId = currentFamilyTreeId;
      const undoReport = await executeUndoPlan(undoPlan, treeId, {
        listRelationships: (tid) => adapter.listRelationships(tid),
        deleteRelationship: (id) => adapter.deleteRelationship(id),
        deleteMember: (id) => adapter.deleteMember(id),
      });
      setUndoSummary(undoReport);
      setUndoPlan(null);
      await fetchMembers(treeId);
    } catch (error) {
      console.error('Import undo failed:', error);
      setErrorKey('import.errors.generic');
    } finally {
      setIsUndoing(false);
    }
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

            {/* v386 CSV import: pilih file, unduh template, preview,
                konfirmasi. Dua langkah dengan preview agar pengguna
                melihat valid/invalid sebelum data dibuat. */}
            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="text-xs font-semibold text-gray-700">
                {t('import.csv.title')}
              </p>
              <button
                onClick={handleCsvTemplateDownload}
                className="mt-1 w-full text-left px-3 py-2 text-sm rounded border border-gray-200 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                data-testid="import-csv-template"
              >
                <Upload className="w-4 h-4" />
                <span>{t('import.csv.template')}</span>
              </button>
              <button
                onClick={() => csvInputRef.current?.click()}
                disabled={isCsvImporting || !currentFamilyTreeId}
                className="mt-1 w-full text-left px-3 py-2 text-sm rounded border border-gray-200 hover:bg-gray-50 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="import-csv-choose"
              >
                <Upload className="w-4 h-4" />
                <span>{t('import.csv.choose')}</span>
              </button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvChosen}
                data-testid="import-csv-input"
              />

              {csvErrorKey && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {t(csvErrorKey)}
                </p>
              )}

              {csvPreview && (
                <div
                  className="mt-2 text-xs text-gray-700 space-y-1"
                  data-testid="import-csv-preview"
                >
                  <p className="font-semibold text-gray-800">
                    {t('import.csv.preview.title', { file: csvFileName ?? '' })}
                  </p>
                  <p>
                    {t('import.csv.preview.valid', {
                      count: csvPreview.valid.length,
                    })}
                  </p>
                  {csvPreview.invalid.length > 0 && (
                    <div>
                      <p className="text-amber-700">
                        {t('import.csv.preview.invalid', {
                          count: csvPreview.invalid.length,
                        })}
                      </p>
                      <ul className="mt-1 max-h-32 overflow-y-auto">
                        {csvPreview.invalid.slice(0, 20).map((bad) => (
                          <li key={bad.row} className="text-amber-700">
                            {t('import.csv.preview.rowItem', {
                              row: bad.row,
                              reason: bad.reason,
                            })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex space-x-2 pt-1">
                    <button
                      onClick={() => {
                        void handleCsvConfirm();
                      }}
                      disabled={
                        isCsvImporting || csvPreview.valid.length === 0
                      }
                      className="px-3 py-1.5 text-sm rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="import-csv-confirm"
                    >
                      {isCsvImporting
                        ? t('import.csv.busy')
                        : t('import.csv.confirm')}
                    </button>
                    <button
                      onClick={handleCsvCancel}
                      disabled={isCsvImporting}
                      className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                      data-testid="import-csv-cancel"
                    >
                      {t('import.csv.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {csvSummary && (
                <div
                  className="mt-2 text-xs text-gray-700 space-y-1"
                  data-testid="import-csv-summary"
                >
                  <p>
                    {t('import.csv.summary', {
                      ok: csvSummary.ok,
                      fail: csvSummary.fail,
                    })}
                  </p>
                </div>
              )}
            </div>

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

            {/* Undo import terakhir (v377): tombol hanya bila plan aman
                dan ada karya untuk dibalik; tanpa karya tidak ada tombol. */}
            {undoPlan &&
              undoPlan.safe &&
              (undoPlan.memberIdsToDelete.length > 0 ||
                undoPlan.relationCountToReverse > 0) &&
              !undoSummary && (
                <button
                  onClick={() => {
                    void handleUndo();
                  }}
                  disabled={isUndoing}
                  className="mt-2 w-full text-left px-3 py-2 text-sm rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={t('import.undo.button')}
                  data-testid="import-undo-button"
                >
                  {isUndoing ? t('import.undo.busy') : t('import.undo.button')}
                </button>
              )}

            {/* Plan konflik existing-tree: tanpa tombol, pesan jujur. */}
            {undoPlan && !undoPlan.safe && (
              <p
                className="mt-2 text-xs text-amber-700"
                role="alert"
                data-testid="import-undo-unsafe"
              >
                {t('import.undo.unsafe', {
                  count: undoPlan.conflicts.length,
                })}
              </p>
            )}

            {/* Ringkasan undo: jumlah yang terhapus, plus pesan gagal
                jujur bila ada kegagalan per entri atau invalidInput. */}
            {undoSummary && (
              <div
                className="mt-2 text-xs text-gray-700 space-y-1"
                data-testid="import-undo-summary"
              >
                <p>
                  {t('import.undo.done', {
                    members: undoSummary.deletedMemberIds.length,
                    relations: undoSummary.removedRelationIds.length,
                  })}
                </p>
                {(undoSummary.invalidInput ||
                  undoSummary.failedMembers.length > 0 ||
                  undoSummary.failedRelations.length > 0) && (
                  <p className="text-red-600" role="alert">
                    {t('import.undo.failed')}
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
