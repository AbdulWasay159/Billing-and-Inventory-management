// src/app/(dashboard)/products/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  Columns,
  History,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { formatCurrency, formatQuantity, calculatePurchasePrice, calculateProfitMargin } from '@/lib/utils';
import { Product, CustomFieldDefinition } from '@/types';
import { Modal, ConfirmModal } from '@/components/ui/modal';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomFieldDefinition[]>([]);
  const [protectedFields, setProtectedFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'lowStock' | 'outOfStock'>('all');

  // Modals state for Section 11 requirements
  const [showAddRowConfirm, setShowAddRowConfirm] = useState(false);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [deleteRowProduct, setDeleteRowProduct] = useState<Product | null>(null);

  const [showAddColumnConfirm, setShowAddColumnConfirm] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [deleteColumnDef, setDeleteColumnDef] = useState<CustomFieldDefinition | null>(null);

  // Edit Product Modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // New Product Form State
  const [newProductId, setNewProductId] = useState('');
  const [newName, setNewName] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newUnit, setNewUnit] = useState('Pcs');
  const [newStock, setNewStock] = useState('0');
  const [newLowStock, setNewLowStock] = useState('5');
  const [newMrp, setNewMrp] = useState('0');
  const [newDiscount, setNewDiscount] = useState('0');
  const [newSellingPrice, setNewSellingPrice] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // New Column Form State
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnType, setNewColumnType] = useState<'TEXT' | 'NUMBER' | 'DATE'>('TEXT');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterMode === 'lowStock') params.set('lowStock', 'true');
      if (filterMode === 'outOfStock') params.set('outOfStock', 'true');
      params.set('limit', '100');

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchColumns = async () => {
    try {
      const res = await fetch('/api/products/columns');
      const data = await res.json();
      setCustomColumns(data.columns || []);
      setProtectedFields(data.protectedFields || []);
    } catch (err) {
      console.error('Error fetching columns:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [filterMode]);

  useEffect(() => {
    fetchColumns();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  // --- ADD ROW WORKFLOW (SECTION 11) ---
  const onConfirmAddRow = () => {
    setShowAddRowConfirm(false);
    // Suggest next product ID
    setNewProductId(`HW-${String(products.length + 1).padStart(4, '0')}`);
    setNewName('');
    setNewSize('');
    setNewCompany('');
    setNewUnit('Pcs');
    setNewStock('0');
    setNewLowStock('5');
    setNewMrp('0');
    setNewDiscount('0');
    setNewSellingPrice('0');
    setFormError(null);
    setShowAddRowModal(true);
  };

  const handleSaveNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavingProduct(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: newProductId,
          name: newName,
          size: newSize,
          companyBrand: newCompany,
          unit: newUnit,
          stockQuantity: Number(newStock),
          lowStockLimit: Number(newLowStock),
          mrp: Number(newMrp),
          purchaseDiscountPercent: Number(newDiscount),
          sellingPrice: Number(newSellingPrice),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');

      setShowAddRowModal(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  // --- DELETE ROW WORKFLOW (SECTION 11 & 25) ---
  const handleConfirmDeleteRow = async () => {
    if (!deleteRowProduct) return;
    try {
      const res = await fetch(`/api/products/${deleteRowProduct.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete row');
      }
      setDeleteRowProduct(null);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- ADD COLUMN WORKFLOW (SECTION 11) ---
  const onConfirmAddColumn = () => {
    setShowAddColumnConfirm(false);
    setNewColumnLabel('');
    setShowAddColumnModal(true);
  };

  const handleSaveNewColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newColumnLabel, dataType: newColumnType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add column');

      setShowAddColumnModal(false);
      fetchColumns();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- DELETE COLUMN WORKFLOW (SECTION 11) ---
  const handleConfirmDeleteColumn = async () => {
    if (!deleteColumnDef) return;
    try {
      const res = await fetch(`/api/products/columns?id=${deleteColumnDef.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete column');
      }
      setDeleteColumnDef(null);
      fetchColumns();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- EDIT PRODUCT WORKFLOW ---
  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setSavingProduct(true);
    try {
      const res = await fetch(`/api/products/${editProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProduct.name,
          size: editProduct.size,
          companyBrand: editProduct.companyBrand,
          unit: editProduct.unit,
          lowStockLimit: Number(editProduct.lowStockLimit),
          mrp: Number(editProduct.mrp),
          purchaseDiscountPercent: Number(editProduct.purchaseDiscountPercent),
          sellingPrice: Number(editProduct.sellingPrice),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update product');

      setEditProduct(null);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  // Live calculation helpers for new product form
  const previewPurchaseCost = calculatePurchasePrice(Number(newMrp), Number(newDiscount));
  const { profitMarginPercent: previewMargin } = calculateProfitMargin(
    previewPurchaseCost,
    Number(newSellingPrice)
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Product Master
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Spreadsheet-style inventory management with 5-tier pricing
          </p>
        </div>

        {/* Section 11: Add Row and Add Column Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddRowConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>

          <button
            onClick={() => setShowAddColumnConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition-colors"
          >
            <Columns className="w-4 h-4 text-indigo-500" />
            <span>Add Column</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Product ID, Item Name, Brand, Size..."
            className="w-full pl-10 pr-20 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium"
          >
            Search
          </button>
        </form>

        <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 text-xs font-medium self-start sm:self-auto shrink-0">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterMode === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => setFilterMode('lowStock')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterMode === 'lowStock'
                ? 'bg-amber-100 text-amber-900 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setFilterMode('outOfStock')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterMode === 'outOfStock'
                ? 'bg-rose-100 text-rose-900 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Main Spreadsheet Product Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 select-none">
              <tr>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap">Product ID</th>
                <th className="py-3 px-3.5 font-bold min-w-[200px]">Product Name</th>
                <th className="py-3 px-3 font-semibold whitespace-nowrap">Size</th>
                <th className="py-3 px-3 font-semibold whitespace-nowrap">Brand</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Current Stock</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">MRP</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Disc %</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Purchase Cost</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Margin %</th>
                <th className="py-3 px-3.5 font-bold text-right whitespace-nowrap text-indigo-700 dark:text-indigo-400">
                  Selling Price
                </th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap text-slate-400">
                  Prev Rate
                </th>

                {/* Dynamic Custom Columns */}
                {customColumns.map((col) => (
                  <th key={col.id} className="py-3 px-3 font-semibold whitespace-nowrap bg-indigo-50/40 dark:bg-indigo-950/20">
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      <button
                        onClick={() => setDeleteColumnDef(col)}
                        title="Delete this custom column"
                        className="p-0.5 text-slate-400 hover:text-rose-500 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}

                <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={12 + customColumns.length} className="py-12 text-center text-slate-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={12 + customColumns.length} className="py-12 text-center text-slate-400">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.stockQuantity <= p.lowStockLimit && p.stockQuantity > 0;
                  const isOut = p.stockQuantity <= 0;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors font-mono"
                    >
                      <td className="py-2.5 px-3.5 font-bold text-indigo-700 dark:text-indigo-400">
                        {p.productId}
                      </td>
                      <td className="py-2.5 px-3.5 font-sans font-medium text-slate-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {p.size || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {p.companyBrand || '—'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${
                          isOut
                            ? 'text-rose-600'
                            : isLow
                            ? 'text-amber-600'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatQuantity(p.stockQuantity, p.unit)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                        ₹{Number(p.mrp).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                        {p.purchaseDiscountPercent}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                        ₹{Number(p.purchasePrice).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                        {p.profitMarginPercent}%
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 dark:text-white bg-indigo-50/20 dark:bg-indigo-950/10">
                        ₹{Number(p.sellingPrice).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 text-xs">
                        {p.previousSellingPrice !== null && p.previousSellingPrice !== undefined
                          ? `₹${Number(p.previousSellingPrice).toFixed(2)}`
                          : '—'}
                      </td>

                      {/* Custom column values */}
                      {customColumns.map((col) => (
                        <td key={col.id} className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {p.customFields?.[col.id] || '—'}
                        </td>
                      ))}

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap font-sans">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/products/${p.id}`}
                            title="View Details & Price History"
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => setEditProduct(p)}
                            title="Edit Product"
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteRowProduct(p)}
                            title="Delete Row"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- CONFIRMATION MODALS (MANDATORY SECTION 11) --- */}

      {/* 1. Add Row Confirmation */}
      <ConfirmModal
        isOpen={showAddRowConfirm}
        onClose={() => setShowAddRowConfirm(false)}
        onConfirm={onConfirmAddRow}
        title="Add New Row"
        message="Do you really want to add a new row?"
        confirmText="Add Row"
      />

      {/* 2. Delete Row Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteRowProduct)}
        onClose={() => setDeleteRowProduct(null)}
        onConfirm={handleConfirmDeleteRow}
        title="Delete Row"
        message={`Do you really want to delete the complete row for "${deleteRowProduct?.name}" (${deleteRowProduct?.productId})? Note: This row will be archived to preserve invoice history.`}
        confirmText="Delete Row"
        isDanger={true}
      />

      {/* 3. Add Column Confirmation */}
      <ConfirmModal
        isOpen={showAddColumnConfirm}
        onClose={() => setShowAddColumnConfirm(false)}
        onConfirm={onConfirmAddColumn}
        title="Add New Column"
        message="Do you really want to add a new column?"
        confirmText="Add Column"
      />

      {/* 4. Delete Column Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteColumnDef)}
        onClose={() => setDeleteColumnDef(null)}
        onConfirm={handleConfirmDeleteColumn}
        title="Delete Column"
        message={`Do you really want to delete the complete column "${deleteColumnDef?.label}"? Warning: All data stored in this custom column may be permanently removed.`}
        confirmText="Delete Column"
        isDanger={true}
      />

      {/* --- ADD ROW MODAL --- */}
      {showAddRowModal && (
        <Modal
          isOpen={showAddRowModal}
          onClose={() => setShowAddRowModal(false)}
          title="Add New Product Row"
          maxWidth="lg"
        >
          <form onSubmit={handleSaveNewProduct} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product ID / Item Code * (Permanent Unique)
                </label>
                <input
                  type="text"
                  required
                  value={newProductId}
                  onChange={(e) => setNewProductId(e.target.value.toUpperCase())}
                  placeholder="e.g. HW-0001"
                  className="w-full px-3 py-2 text-sm font-mono border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. CPVC Elbow 90 Degree"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Size (Flexible text e.g. 1.5 inch, 4 inch)
                </label>
                <input
                  type="text"
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  placeholder="e.g. 1 inch or 0.5 inch x 2 inch"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Company / Brand
                </label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Astral, Jaquar, Havells"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
                >
                  <option value="Pcs">Pieces (Pcs)</option>
                  <option value="Nos">Numbers (Nos)</option>
                  <option value="Mtr">Meters (Mtr)</option>
                  <option value="Ft">Feet (Ft)</option>
                  <option value="Kg">Kilograms (Kg)</option>
                  <option value="Ltr">Litres (Ltr)</option>
                  <option value="Roll">Rolls</option>
                  <option value="Box">Box</option>
                  <option value="Set">Set</option>
                  <option value="Pair">Pair</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Opening Stock Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Low Stock Limit Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={newLowStock}
                  onChange={(e) => setNewLowStock(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">MRP (₹)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={newMrp}
                  onChange={(e) => setNewMrp(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purchase Trade Discount %
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  required
                  value={newDiscount}
                  onChange={(e) => setNewDiscount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-700 mb-1">
                  Selling Price * (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={newSellingPrice}
                  onChange={(e) => setNewSellingPrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold border-2 border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Live Pricing Breakdown Preview */}
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-slate-500">Auto Purchase Cost:</span>{' '}
                <strong className="font-mono text-slate-900">₹{previewPurchaseCost.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Profit Margin:</span>{' '}
                <strong className="font-mono text-emerald-700">{previewMargin}%</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRowModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProduct}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                {savingProduct ? 'Saving...' : 'Save Product Row'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- ADD COLUMN MODAL --- */}
      {showAddColumnModal && (
        <Modal
          isOpen={showAddColumnModal}
          onClose={() => setShowAddColumnModal(false)}
          title="Add Custom Product Column"
          maxWidth="sm"
        >
          <form onSubmit={handleSaveNewColumn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Column Label / Header Name *
              </label>
              <input
                type="text"
                required
                value={newColumnLabel}
                onChange={(e) => setNewColumnLabel(e.target.value)}
                placeholder="e.g. Shelf Location, Supplier Code"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data Type</label>
              <select
                value={newColumnType}
                onChange={(e: any) => setNewColumnType(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
              >
                <option value="TEXT">Text (Letters & Numbers)</option>
                <option value="NUMBER">Number</option>
                <option value="DATE">Date</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddColumnModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Save Column
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- EDIT PRODUCT MODAL --- */}
      {editProduct && (
        <Modal
          isOpen={Boolean(editProduct)}
          onClose={() => setEditProduct(null)}
          title={`Edit Product: ${editProduct.productId}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEditProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={editProduct.name}
                  onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Size</label>
                <input
                  type="text"
                  value={editProduct.size}
                  onChange={(e) => setEditProduct({ ...editProduct, size: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Brand</label>
                <input
                  type="text"
                  value={editProduct.companyBrand}
                  onChange={(e) => setEditProduct({ ...editProduct, companyBrand: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">MRP (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={editProduct.mrp}
                  onChange={(e) => setEditProduct({ ...editProduct, mrp: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Discount %</label>
                <input
                  type="number"
                  step="any"
                  value={editProduct.purchaseDiscountPercent}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      purchaseDiscountPercent: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-indigo-700 mb-1">
                  Selling Price (₹) — Note: Changing will save previous rate in history
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editProduct.sellingPrice}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, sellingPrice: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-sm font-bold border-2 border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditProduct(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProduct}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                {savingProduct ? 'Saving...' : 'Update Product'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
