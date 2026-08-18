import React, { useState } from 'react';
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
import { useFamilyStore } from '../../../store/familyStore';
import { getAdapter } from '../../../lib/adapters';
import { exportGedcom70 } from '../../../lib/gedcom/exportGedcom70';
import { exportGedzip } from '../../../lib/gedcom/exportGedzip';

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
  // Canonical adapter-layer data (not the legacy merged UI shape) so the
  // GEDCOM export reads exactly what the backend stores.
  const records = useFamilyStore((s) => s.records);
  const relationships = useFamilyStore((s) => s.relationships);
  const currentFamilyTreeId = useFamilyStore((s) => s.currentFamilyTreeId);

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
      const { gedcom } = exportGedcom70({ members: records, relationships });
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
      const result = exportGedzip({ members: records, relationships });
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
            className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2"
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
            
            <button
              onClick={() => {
                exportAsGedcom();
                handleDropdownClose();
              }}
              disabled={isExporting}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2 disabled:opacity-50"
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
              disabled={isExporting}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2 disabled:opacity-50"
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