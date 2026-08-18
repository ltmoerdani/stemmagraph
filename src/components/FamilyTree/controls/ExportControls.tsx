import React, { useMemo, useState } from 'react';
import {
  Download,
  FileArchive,
  FileImage,
  FileJson,
  FileText,
  Printer,
  ChevronDown
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../../store/familyStore';
import { getAdapter } from '../../../lib/adapters';
import { exportGedcom70, type ExportPrivacyMode } from '../../../lib/gedcom/exportGedcom70';
import { exportGedzip } from '../../../lib/gedcom/exportGedzip';
import { buildExportPrivacyReport } from '../../../lib/privacy/exportPrivacyGate';

/** MIME type used when saving .ged downloads (de facto standard). */
const GEDCOM_MIME = 'application/x-gedcom';

/**
 * MIME type used when saving .gedzip downloads. GEDZIP has no IANA
 * registration, so the generic ZIP type is the safest hint.
 */
const GEDZIP_MIME = 'application/zip';

/** Builds the <tree-name>-<yyyymmdd><ext> download filename. */
function gedcomFileName(
  treeName: string | undefined,
  now: Date,
  ext: string = '.ged'
): string {
  const safeName = (treeName ?? 'family-tree')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'family-tree';
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${safeName}-${yyyy}${mm}${dd}${ext}`;
}

/** Triggers a browser download for an in-memory blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export const ExportControls: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  // Privacy mode for the GEDCOM/GEDZIP paths (S-06 Wave 1). Default is
  // the clean share export; the full archive requires an explicit
  // checkbox confirmation before its download buttons unlock.
  const [privacyMode, setPrivacyMode] = useState<ExportPrivacyMode>('clean');
  const [confirmFullArchive, setConfirmFullArchive] = useState(false);
  const { t } = useTranslation();
  // Canonical adapter-layer data (not the legacy merged UI shape) so the
  // GEDCOM export reads exactly what the backend stores.
  const records = useFamilyStore((s) => s.records);
  const relationships = useFamilyStore((s) => s.relationships);
  const currentFamilyTreeId = useFamilyStore((s) => s.currentFamilyTreeId);

  // Gate report computed from the same records the export will read, so
  // the counts the user sees before downloading match the output.
  const privacyReport = useMemo(
    () => buildExportPrivacyReport(records),
    [records]
  );
  const fullArchiveUnlocked = privacyMode === 'clean' || confirmFullArchive;

  const selectPrivacyMode = (mode: ExportPrivacyMode) => {
    setPrivacyMode(mode);
    // Leaving full-archive mode revokes the confirmation on purpose:
    // re-entering must require a fresh explicit opt-in.
    if (mode === 'clean') setConfirmFullArchive(false);
  };

  // Tree name only feeds the download filename; lookup failures fall
  // back to the default name instead of blocking the export.
  const resolveTreeName = async (): Promise<string | undefined> => {
    if (!currentFamilyTreeId) return undefined;
    try {
      const tree = await getAdapter().getTree(currentFamilyTreeId);
      return tree?.name;
    } catch {
      return undefined;
    }
  };

  const exportAsGedcom = async () => {
    setIsExporting(true);
    try {
      const treeName = await resolveTreeName();
      const { gedcom } = exportGedcom70({
        members: records,
        relationships,
        privacyMode,
      });
      const blob = new Blob([gedcom], { type: `${GEDCOM_MIME}; charset=utf-8` });
      downloadBlob(blob, gedcomFileName(treeName, new Date()));
    } catch (error) {
      console.error('GEDCOM export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsGedzip = async () => {
    setIsExporting(true);
    try {
      const treeName = await resolveTreeName();
      const now = new Date();
      const result = exportGedzip({
        members: records,
        relationships,
        privacyMode,
      });
      if (result.ok) {
        const blob = new Blob([result.zip], { type: GEDZIP_MIME });
        downloadBlob(blob, gedcomFileName(treeName, now, '.gedzip'));
        return;
      }
      // The guard refused the archive (content beyond the classic ZIP
      // limits). Tell the user plainly, then deliver the plain GEDCOM
      // instead of failing silently.
      console.warn('GEDZIP export blocked by guard:', result.error);
      window.alert(
        'This tree is too large for a GEDZIP archive (over the ZIP 4 GB ' +
        'limit). Downloading the plain GEDCOM (.ged) file instead.'
      );
      const blob = new Blob([result.gedcom], {
        type: `${GEDCOM_MIME}; charset=utf-8`,
      });
      downloadBlob(blob, gedcomFileName(treeName, now));
    } catch (error) {
      console.error('GEDZIP export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsImage = async (format: 'png' | 'jpg') => {
    setIsExporting(true);
    try {
      const reactFlowElement = document.querySelector('.react-flow') as HTMLElement;
      if (!reactFlowElement) return;

      const canvas = await html2canvas(reactFlowElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
      });

      const link = document.createElement('a');
      link.download = `family-tree.${format}`;
      link.href = canvas.toDataURL(`image/${format}`, 0.9);
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPDF = async () => {
    setIsExporting(true);
    try {
      const reactFlowElement = document.querySelector('.react-flow') as HTMLElement;
      if (!reactFlowElement) return;

      const canvas = await html2canvas(reactFlowElement, {
        backgroundColor: '#ffffff',
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('family-tree.pdf');
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDropdownToggle = () => {
    setShowDropdown(!showDropdown);
  };

  const handleDropdownClose = () => {
    setShowDropdown(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleDropdownToggle}
        disabled={isExporting}
        className="flex items-center space-x-2 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        aria-label="Export family tree"
        aria-expanded={showDropdown}
        aria-haspopup="menu"
      >
        <Download className="w-4 h-4" />
        <span>{isExporting ? 'Exporting...' : 'Export'}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {showDropdown && (
        <>
          {/* Accessible backdrop button for closing dropdown */}
          <button 
            type="button"
            className="fixed inset-0 z-40 bg-transparent border-none outline-hidden cursor-default"
            onClick={handleDropdownClose}
            onKeyDown={handleKeyDown}
            aria-label="Close export menu"
            tabIndex={0}
          />
          <div 
            className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2"
            role="menu"
            aria-label="Export options"
          >
            <button
              onClick={() => {
                exportAsImage('png');
                handleDropdownClose();
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2"
              role="menuitem"
            >
              <FileImage className="w-4 h-4" />
              <span>Export as PNG</span>
            </button>
            
            <button
              onClick={() => {
                exportAsImage('jpg');
                handleDropdownClose();
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2"
              role="menuitem"
            >
              <FileImage className="w-4 h-4" />
              <span>Export as JPG</span>
            </button>
            
            <button
              onClick={() => {
                exportAsPDF();
                handleDropdownClose();
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2"
              role="menuitem"
            >
              <FileText className="w-4 h-4" />
              <span>Export as PDF</span>
            </button>

            {/* Privacy mode for the GEDCOM/GEDZIP exports (S-06 Wave 1):
                the gate report is shown BEFORE any download starts, and
                the full archive stays locked behind an explicit
                checkbox confirmation. */}
            <div
              className="mt-2 mx-2 px-2 py-2 border-t border-gray-100"
              role="group"
              aria-label={t('export.privacy.title')}
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('export.privacy.title')}
              </p>

              <label className="flex items-start gap-2 mt-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-privacy-mode"
                  value="clean"
                  checked={privacyMode === 'clean'}
                  onChange={() => selectPrivacyMode('clean')}
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  {t('export.privacy.modeClean')}
                </span>
              </label>
              {privacyMode === 'clean' && (
                <p
                  className="text-xs text-gray-500 pl-6 mt-1"
                  data-testid="export-privacy-report"
                >
                  {t('export.privacy.report', {
                    total: privacyReport.total,
                    redacted: privacyReport.livingRedacted,
                    full: privacyReport.livingFull,
                    deceased: privacyReport.deceased,
                  })}
                  <br />
                  {t('export.privacy.cleanNote')}
                </p>
              )}

              <label className="flex items-start gap-2 mt-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-privacy-mode"
                  value="full"
                  checked={privacyMode === 'full'}
                  onChange={() => selectPrivacyMode('full')}
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  {t('export.privacy.modeFull')}
                </span>
              </label>
              {privacyMode === 'full' && (
                <div className="pl-6 mt-1">
                  <p className="text-xs text-amber-700">
                    {t('export.privacy.warning')}
                  </p>
                  <label className="flex items-start gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmFullArchive}
                      onChange={(e) => setConfirmFullArchive(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-gray-600">
                      {t('export.privacy.confirmLabel')}
                    </span>
                  </label>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                exportAsGedcom();
                handleDropdownClose();
              }}
              disabled={isExporting || !fullArchiveUnlocked}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              role="menuitem"
            >
              <FileJson className="w-4 h-4" />
              <span>Export as GEDCOM 7.0 (.ged)</span>
            </button>

            <button
              onClick={() => {
                exportAsGedzip();
                handleDropdownClose();
              }}
              disabled={isExporting || !fullArchiveUnlocked}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              role="menuitem"
            >
              <FileArchive className="w-4 h-4" />
              <span>Export as GEDZIP (.gedzip)</span>
            </button>
            
            <hr className="my-2" />
            
            <button
              onClick={() => {
                handlePrint();
                handleDropdownClose();
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2"
              role="menuitem"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};