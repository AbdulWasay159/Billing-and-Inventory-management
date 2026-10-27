// src/app/(dashboard)/imports-exports/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCheck,
  RefreshCw,
  Info,
  Filter,
  Search,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { ImportPreviewRow, ImportSummary } from '@/types';
import { Modal, ConfirmModal } from '@/components/ui/modal';

export default function ImportsExportsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview Result
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [previewStats, setPreviewStats] = useState<{
    totalRows: number;
    newCount: number;
    updateCount: number;
    errorCount: number;
    duplicateIdsInFile: string[];
  } | null>(null);

  // Confirmation Modal
  const [showCommitConfirm, setShowCommitConfirm] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  // Filtered Export Modal State
  const [filterModalFormat, setFilterModalFormat] = useState<'xlsx' | 'csv' | null>(null);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [brandProductCount, setBrandProductCount] = useState<number | null>(null);
  const [loadingBrandCount, setLoadingBrandCount] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilterExportModal = async (format: 'xlsx' | 'csv') => {
    setFilterModalFormat(format);
    setBrandSearch('');
    setSelectedBrand('');
    setBrandProductCount(null);
    setLoadingBrands(true);
    try {
      const res = await fetch('/api/products/filters');
      if (res.ok) {
        const data = await res.json();
        setAvailableBrands(data.brands || []);
      }
    } catch (err) {
      console.error('Failed to load brands for export:', err);
    } finally {
      setLoadingBrands(false);
    }
  };

  const handleSelectBrandForExport = async (brand: string) => {
    setSelectedBrand(brand);
    setLoadingBrandCount(true);
    try {
      const res = await fetch(`/api/products?brand=${encodeURIComponent(brand)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        setBrandProductCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to load product count for brand:', err);
      setBrandProductCount(null);
    } finally {
      setLoadingBrandCount(false);
    }
  };

  const handleDownloadFiltered = () => {
    if (!filterModalFormat || !selectedBrand) return;
    const url = `/api/exports/products?format=${filterModalFormat}&brand=${encodeURIComponent(selectedBrand)}`;
    window.location.href = url;
    setFilterModalFormat(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError(null);
    setImportSummary(null);
    setParsing(true);

    try {
      const formData = new FormData();
      formData.append('file', selected);

      const res = await fetch('/api/imports/preview', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse file.');
      }

      setPreviewRows(data.previewRows || []);
      setPreviewStats({
        totalRows: data.totalRows,
        newCount: data.newCount,
        updateCount: data.updateCount,
        errorCount: data.errorCount,
        duplicateIdsInFile: data.duplicateIdsInFile || [],
      });
    } catch (err: any) {
      setError(err.message || 'Error parsing uploaded file.');
      setPreviewRows([]);
      setPreviewStats(null);
    } finally {
      setParsing(false);
    }
  };

  const handleExecuteCommit = async () => {
    setShowCommitConfirm(false);
    setCommitting(true);
    setError(null);

    try {
      const res = await fetch('/api/imports/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: previewRows }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to commit import');

      setImportSummary(data);
      setPreviewRows([]);
      setPreviewStats(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Error committing import.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Excel & CSV Data Center
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Bulk import, round-trip editing, and product exports matching permanent Product IDs
        </p>
      </div>

      {/* Export Section Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-[#3563e9] mb-2">
              <Download className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">
                Export to Excel (.xlsx)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Download product catalog with live Excel formulas for Purchase Price and Selling Price calculations.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href="/api/exports/products?format=xlsx"
              download
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#3563e9]/10 text-[#3563e9] border border-[#3563e9]/20 font-semibold text-xs hover:bg-[#3563e9]/15 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel Sheet</span>
            </a>
            <button
              onClick={() => openFilterExportModal('xlsx')}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-50 text-violet-700 border border-violet-200 font-semibold text-xs hover:bg-violet-100 transition-colors shadow-2xs"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Download by Filter</span>
            </button>
          </div>
        </div>

        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-[#3563e9] mb-2">
              <FileSpreadsheet className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">
                Export to CSV (.csv)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Plain text CSV export with calculated static values and formula injection protection.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href="/api/exports/products?format=csv"
              download
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#3563e9]/10 text-[#3563e9] border border-[#3563e9]/20 font-semibold text-xs hover:bg-[#3563e9]/15 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV File</span>
            </a>
            <button
              onClick={() => openFilterExportModal('csv')}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-50 text-violet-700 border border-violet-200 font-semibold text-xs hover:bg-violet-100 transition-colors shadow-2xs"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Download by Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Upload Dropzone Card */}
      <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <Upload className="w-5 h-5 text-[#3563e9]" />
          <span>Import Spreadsheet (16-Step Verification Pipeline)</span>
        </h2>

        {/* Important Business Rule Box (Section 9 & 10) */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Non-Negotiable Business Rules:</span>
          </div>
          <p>
            1. <strong>Product ID is the primary matching key.</strong> Existing Product IDs update existing records. Product names may duplicate, but Product IDs are unique.
          </p>
          <p>
            2. <strong>Target Stock Rule:</strong> The stock quantity in your spreadsheet is the <em>absolute current stock</em> (e.g. if DB has 50 and Excel says 100, the result will be 100, not 150).
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* File Dropzone */}
        <div className="border-2 border-dashed border-slate-300 hover:border-[#3563e9] rounded-2xl p-8 text-center transition-colors bg-slate-50/50">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileSelect}
            className="hidden"
            id="excel-file-upload"
          />
          <label htmlFor="excel-file-upload" className="cursor-pointer block space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#3563e9]/10 flex items-center justify-center text-[#3563e9] border border-[#3563e9]/20">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {file ? file.name : 'Click to select Excel (.xlsx) or CSV file'}
            </p>
            <p className="text-xs text-slate-400">
              {parsing ? 'Parsing and validating sheet...' : 'Drag and drop or browse from your computer'}
            </p>
          </label>
        </div>

        {/* Success Import Summary */}
        {importSummary && (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Import Successfully Completed!</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 text-slate-700">
              <p>
                Total Processed: <strong>{importSummary.totalRows} rows</strong>
              </p>
              <p>
                New Products: <strong>{importSummary.newProductsCount}</strong>
              </p>
              <p>
                Updated Products: <strong>{importSummary.updatedProductsCount}</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* --- PREVIEW AND CONFIRMATION TABLE --- */}
      {previewStats && (
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Import Preview & Verification
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review matched existing products vs new products before applying changes.
              </p>
            </div>

            {/* Stats badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                +{previewStats.newCount} New
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                ↺ {previewStats.updateCount} Updates
              </span>
              {previewStats.errorCount > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                  ⚠️ {previewStats.errorCount} Errors
                </span>
              )}

              <button
                onClick={() => setShowCommitConfirm(true)}
                disabled={committing || previewStats.errorCount > 0}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#3563e9] to-[#7656e8] hover:opacity-95 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#3563e9]/20 transition-all"
              >
                {committing ? 'Applying Upsert...' : 'Confirm & Apply Import'}
              </button>
            </div>
          </div>

          {previewStats.duplicateIdsInFile.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              Duplicate Product IDs detected within file:{' '}
              {previewStats.duplicateIdsInFile.join(', ')}. Please fix duplicate IDs before committing.
            </div>
          )}

          {/* Preview Rows Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-2.5 px-3 font-bold text-center w-10 uppercase tracking-wider text-[11px]">Row</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-20 uppercase tracking-wider text-[11px]">Type</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px]">Product ID</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Product Name</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Size</th>
                  <th className="py-2.5 px-3 font-semibold text-right uppercase tracking-wider text-[11px]">Target Stock</th>
                  <th className="py-2.5 px-3 font-semibold text-right uppercase tracking-wider text-[11px]">Stock Delta</th>
                  <th className="py-2.5 px-3 font-semibold text-right uppercase tracking-wider text-[11px]">Selling Price</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Validation Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {previewRows.map((r) => {
                  const hasError = r.errors.length > 0;

                  return (
                    <tr
                      key={r.rowNumber}
                      className={
                        hasError
                          ? 'bg-rose-50/50'
                          : r.isExisting
                          ? 'bg-blue-50/20'
                          : 'hover:bg-slate-50/50'
                      }
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-sans">{r.rowNumber}</td>
                      <td className="py-2 px-3 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            r.isExisting
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {r.isExisting ? 'Update' : 'New'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-[#3563e9]">
                        {r.productId}
                      </td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-900">
                        {r.name}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{r.size || '—'}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {r.targetStock} {r.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">
                        {r.isExisting ? (
                          <span
                            className={
                              (r.stockDelta || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }
                          >
                            {(r.stockDelta || 0) > 0 ? `+${r.stockDelta}` : r.stockDelta}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans">New</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">₹{r.sellingPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 font-sans text-[11px]">
                        {hasError ? (
                          <span className="text-rose-600 font-bold">{r.errors.join('; ')}</span>
                        ) : r.warnings.length > 0 ? (
                          <span className="text-amber-600">{r.warnings.join('; ')}</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">✓ Ready to upsert</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Section 10 requirement) */}
      <ConfirmModal
        isOpen={showCommitConfirm}
        onClose={() => setShowCommitConfirm(false)}
        onConfirm={handleExecuteCommit}
        title="Confirm Excel/CSV Import"
        message={`Do you want to proceed with importing ${previewStats?.totalRows || 0} rows (${previewStats?.newCount || 0} new products, ${previewStats?.updateCount || 0} existing updates)? Stock values in your file will overwrite current inventory to match target numbers.`}
        confirmText="Confirm & Apply"
        isLoading={committing}
      />

      {/* Brand-Filtered Export Modal (Phase 6 requirement) */}
      <Modal
        isOpen={Boolean(filterModalFormat)}
        onClose={() => setFilterModalFormat(null)}
        title={`Export to ${filterModalFormat === 'csv' ? 'CSV (.csv)' : 'Excel (.xlsx)'} by Brand`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Select a brand from your actual catalog. The exported spreadsheet will contain all matching products with permanent Product IDs and calculations intact.
          </p>

          {/* Search Brand */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder="Search available brands..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9]"
            />
          </div>

          {/* Brand List */}
          <div className="border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1 bg-slate-50/50">
            {loadingBrands ? (
              <p className="text-xs text-slate-400 p-3 text-center">Loading brands from catalogue...</p>
            ) : availableBrands.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 text-center">No brands found in catalogue.</p>
            ) : (
              availableBrands
                .filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()))
                .map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => handleSelectBrandForExport(brand)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                      selectedBrand === brand
                        ? 'bg-[#3563e9] text-white shadow-2xs'
                        : 'hover:bg-slate-200/60 text-slate-700'
                    }`}
                  >
                    <span>{brand}</span>
                    {selectedBrand === brand && (
                      <span className="text-[11px] font-semibold text-blue-100">Selected</span>
                    )}
                  </button>
                ))
            )}
          </div>

          {/* Selected Brand Feedback */}
          {selectedBrand && (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
              <div>
                <span className="font-semibold">Selected Brand:</span>{' '}
                <span className="font-bold">{selectedBrand}</span>
              </div>
              <div className="text-right">
                {loadingBrandCount ? (
                  <span className="text-blue-500">Counting...</span>
                ) : brandProductCount !== null ? (
                  <span className="font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    {brandProductCount} product{brandProductCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setFilterModalFormat(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedBrand}
              onClick={handleDownloadFiltered}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white transition-all shadow-sm ${
                selectedBrand
                  ? 'bg-gradient-to-r from-[#3563e9] to-[#7656e8] hover:opacity-95 shadow-blue-500/25'
                  : 'bg-slate-300 cursor-not-allowed opacity-60'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {filterModalFormat === 'csv' ? 'CSV' : 'Excel'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
