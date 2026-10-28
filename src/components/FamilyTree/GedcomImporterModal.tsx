import React, { useRef, useState, useEffect } from 'react';
import { Upload, X, CheckCircle2, AlertTriangle, FileText, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../store/familyStore';
import { getAdapter } from '../../lib/adapters';
import { importIndividuals } from '../../lib/gedcom/importIndividuals';
import { importFamilies } from '../../lib/gedcom/importFamilies';
import { buildImportPlan } from '../../lib/gedcom/importPlan';
import { applyImportPlan, type ImportApplyReport } from '../../lib/gedcom/applyImportPlan';
import { extractGedcom } from '../../lib/gedcom/importPipeline';


interface GedcomImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GedcomImporterModal: React.FC<GedcomImporterModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('common');
  const currentFamilyTreeId = useFamilyStore((s) => s.currentFamilyTreeId);
  const fetchMembers = useFamilyStore((s) => s.fetchMembers);

  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    fileName: string;
    bytes: Uint8Array;
    gedcomText: string;
    individualsCount: number;
    familiesCount: number;
    notesCount: number;
    problemLines: { line: number; reason: string }[];
  } | null>(null);

  const [isApplying, setIsApplying] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [applyReport, setApplyReport] = useState<ImportApplyReport | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isApplying) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isApplying, onClose]);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setErrorMsg(null);
    setApplyReport(null);

    const nameLower = file.name.toLowerCase();
    if (!nameLower.endsWith('.ged') && !nameLower.endsWith('.gdz')) {
      setErrorMsg(t('import.gedcom.errors.invalidExtension', 'Ekstensi file harus .ged atau .gdz'));
      return;
    }
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(t('import.gedcom.errors.tooLarge', 'Ukuran file melebihi batas maksimal 15MB'));
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let gedcomText = '';
      try {
        const extracted = extractGedcom(bytes);
        gedcomText = extracted.text;
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal membaca arsip GEDCOM/GEDZIP');
        return;
      }

      let individualsCount = 0;
      let familiesCount = 0;
      let notesCount = 0;
      const problemLines: { line: number; reason: string }[] = [];

      try {
        const individuals = importIndividuals(gedcomText);
        const families = importFamilies(gedcomText);
        individualsCount = individuals.length;
        familiesCount = families.length;

        const lines = gedcomText.split(/\r?\n/);
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('1 NOTE') || trimmed.startsWith('2 NOTE')) {
            notesCount++;
          }
        });

        lines.forEach((line, idx) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 0 && /^[0-9]+$/.test(parts[0])) {
            const level = parseInt(parts[0], 10);
            if (level > 0 && parts.length < 2) {
              problemLines.push({
                line: idx + 1,
                reason: 'Struktur baris tidak lengkap (level tanpa tag)',
              });
            }
          }
        });
      } catch {
        setErrorMsg(t('import.gedcom.errors.parseFailed', 'Gagal mem-parsing isi file GEDCOM'));
        return;
      }

      setPreviewData({
        fileName: file.name,
        bytes,
        gedcomText,
        individualsCount,
        familiesCount,
        notesCount,
        problemLines,
      });
    } catch {
      setErrorMsg(t('import.gedcom.errors.readFailed', 'Gagal membaca file'));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileProcess(file);
  };

  const handleApplyImport = async () => {
    if (!previewData || !currentFamilyTreeId || isApplying) return;
    setIsApplying(true);
    setErrorMsg(null);
    setProgressText(t('import.gedcom.progress.parsing', 'Menyiapkan plan impor...'));

    try {
      const individuals = importIndividuals(previewData.gedcomText);
      const families = importFamilies(previewData.gedcomText);
      const plan = buildImportPlan(individuals, families);

      if (plan.members.length === 0) {
        setErrorMsg(t('import.gedcom.errors.empty', 'Tidak ada individu valid ditemukan dalam file GEDCOM'));
        setIsApplying(false);
        setProgressText('');
        return;
      }

      setProgressText(t('import.gedcom.progress.writing', 'Menerapkan data ke database pohon...'));
      const adapter = getAdapter();
      const treeId = currentFamilyTreeId;

      const report = await applyImportPlan(plan, {
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
          adapter.createRelationship(id, memberId, relatedId, type).then(() => undefined),
      });

      setApplyReport(report);
      setProgressText(t('import.gedcom.progress.done', 'Impor selesai dengan sukses!'));
      await fetchMembers(treeId);
    } catch (err) {
      console.error('GEDCOM apply failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat menerapkan impor');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gedcom-importer-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h2 id="gedcom-importer-title" className="text-lg font-bold text-gray-900">
              {t('import.gedcom.title', 'Impor GEDCOM Silsilah (.ged / .gdz)')}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isApplying}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label={t('common.close', 'Tutup')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700 text-sm" role="alert">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {!previewData && !applyReport && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                isDragging ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/30'
              }`}
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {t('import.gedcom.dropTitle', 'Seret & letakkan file GEDCOM di sini')}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {t('import.gedcom.dropSubtitle', 'Mendukung format file .ged dan arsip terkompresi .gdz (maks 15MB)')}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ged,.gdz"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileProcess(f);
                }}
                aria-label={t('import.gedcom.fileInput', 'Pilih file GEDCOM')}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {t('import.gedcom.browse', 'Pilih dari Komputer')}
              </button>
            </div>
          )}

          {previewData && !applyReport && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-emerald-900 truncate max-w-xs">
                    {previewData.fileName}
                  </span>
                  <button
                    onClick={() => setPreviewData(null)}
                    className="text-xs text-emerald-700 hover:underline font-medium"
                  >
                    {t('import.gedcom.chooseAnother', 'Ganti File')}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-xs">
                    <div className="text-2xl font-bold text-emerald-700">{previewData.individualsCount}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-0.5">
                      {t('import.gedcom.stats.individuals', 'Individu')}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-xs">
                    <div className="text-2xl font-bold text-emerald-700">{previewData.familiesCount}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-0.5">
                      {t('import.gedcom.stats.families', 'Famili')}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-xs">
                    <div className="text-2xl font-bold text-emerald-700">{previewData.notesCount}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-0.5">
                      {t('import.gedcom.stats.notes', 'Catatan')}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-xs">
                    <div className={`text-2xl font-bold ${previewData.problemLines.length > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                      {previewData.problemLines.length}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-0.5">
                      {t('import.gedcom.stats.problems', 'Baris Bermasalah')}
                    </div>
                  </div>
                </div>
              </div>

              {previewData.problemLines.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    {t('import.gedcom.problemsTitle', 'Peringatan Struktur Baris')}
                  </div>
                  <ul className="text-xs text-amber-800 space-y-1 max-h-24 overflow-y-auto">
                    {previewData.problemLines.map((p, i) => (
                      <li key={i} className="flex items-center space-x-2">
                        <span className="font-mono bg-amber-200/60 px-1.5 py-0.5 rounded text-[11px]">Baris {p.line}</span>
                        <span>{p.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div aria-live="polite" className="sr-only">
                {progressText}
              </div>

              {isApplying && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center space-x-3 text-blue-800">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="text-sm font-medium">{progressText}</div>
                </div>
              )}

              {!isApplying && (
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPreviewData(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    {t('common.cancel', 'Batal')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApplyImport()}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm transition-colors flex items-center space-x-2 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <span>{t('import.gedcom.applyButton', 'Terapkan Impor ke Pohon')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {applyReport && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {t('import.gedcom.successTitle', 'Impor Silsilah Berhasil!')}
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {t('import.gedcom.successSubtitle', 'Data silsilah telah berhasil dimasukkan ke dalam basis data pohon aktif.')}
              </p>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 max-w-md mx-auto text-left text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Individu Dibuat:</span>
                  <span className="font-bold text-gray-900">{applyReport.createdMembers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Relasi Dibuat:</span>
                  <span className="font-bold text-gray-900">{applyReport.createdRelations}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm transition-colors"
                >
                  {t('common.done', 'Selesai')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};