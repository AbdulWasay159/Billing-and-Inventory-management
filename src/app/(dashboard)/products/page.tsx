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
  Calculator,
  ArrowRight,
} from 'lucide-react';
import {
  formatCurrency,
  formatQuantity,
  calculatePurchasePrice,
  calculateProfitMargin,
  calculateSellingPriceFromMargin,
} from '@/lib/utils';
import { Product, CustomFieldDefinition } from '@/types';
import { Modal, ConfirmModal } from '@/components/ui/modal';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomFieldDefinition[]>([]);
  const [protectedFields, setProtectedFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'lowStock' | 'outOfStock'>('all');

  // Modals state
  const [showAddRowConfirm, setShowAddRowConfirm] = useState(false);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [deleteRowProduct, setDeleteRowProduct] = useState<Product | null>(null);

  const [showAddColumnConfirm, setShowAddColumnConfirm] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [deleteColumnDef, setDeleteColumnDef] = useState<CustomFieldDefinition | null>(null);

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
  const [newPurchaseCost, setNewPurchaseCost] = useState('0');
  const [newMargin, setNewMargin] = useState('20');
  const [newSellingPrice, setNewSellingPrice] = useState('0');
  const [newPricingMode, setNewPricingMode] = useState<'margin' | 'price'>('margin');
  const [formError, setFormError] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Edit Product Modal State
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editUnit, setEditUnit] = useState('Pcs');
  const [editLowStock, setEditLowStock] = useState('5');
  const [editMrp, setEditMrp] = useState('0');
  const [editDiscount, setEditDiscount] = useState('0');
  const [editPurchaseCost, setEditPurchaseCost] = useState('0');
  const [editMargin, setEditMargin] = useState('0');
  const [editSellingPrice, setEditSellingPrice] = useState('0');
  const [editPricingMode, setEditPricingMode] = useState<'margin' | 'price'>('price');
  const [editFormError, setEditFormError] = useState<string | null>(null);

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

  // --- ADD ROW WORKFLOW ---
  const onConfirmAddRow = () => {
    setShowAddRowConfirm(false);
    setNewProductId(`HW-${String(products.length + 1).padStart(4, '0')}`);
    setNewName('');
    setNewSize('');
    setNewCompany('');
    setNewUnit('Pcs');
    setNewStock('0');
    setNewLowStock('5');
    setNewMrp('500');
    setNewDiscount('25');
    const cost = calculatePurchasePrice(500, 25); // 375
    setNewPurchaseCost(cost.toString());
    const initialMargin = 25;
    setNewMargin(initialMargin.toString());
    const sp = calculateSellingPriceFromMargin(cost, initialMargin);
    setNewSellingPrice(sp.toString());
    setNewPricingMode('margin');
    setFormError(null);
    setShowAddRowModal(true);
  };

  // Bidirectional calculations for New Product Form
  const handleNewMrpChange = (val: string) => {
    setNewMrp(val);
    const m = Number(val) || 0;
    const d = Number(newDiscount) || 0;
    const cost = calculatePurchasePrice(m, d);
    setNewPurchaseCost(cost.toString());
    if (newPricingMode === 'margin') {
      const mg = Number(newMargin) || 0;
      setNewSellingPrice(calculateSellingPriceFromMargin(cost, mg).toString());
    } else {
      const sp = Number(newSellingPrice) || 0;
      setNewMargin(calculateProfitMargin(cost, sp).profitMarginPercent.toString());
    }
  };

  const handleNewDiscountChange = (val: string) => {
    setNewDiscount(val);
    const m = Number(newMrp) || 0;
    const d = Number(val) || 0;
    const cost = calculatePurchasePrice(m, d);
    setNewPurchaseCost(cost.toString());
    if (newPricingMode === 'margin') {
      const mg = Number(newMargin) || 0;
      setNewSellingPrice(calculateSellingPriceFromMargin(cost, mg).toString());
    } else {
      const sp = Number(newSellingPrice) || 0;
      setNewMargin(calculateProfitMargin(cost, sp).profitMarginPercent.toString());
    }
  };

  const handleNewPurchaseCostChange = (val: string) => {
    setNewPurchaseCost(val);
    const cost = Number(val) || 0;
    if (newPricingMode === 'margin') {
      const mg = Number(newMargin) || 0;
      setNewSellingPrice(calculateSellingPriceFromMargin(cost, mg).toString());
    } else {
      const sp = Number(newSellingPrice) || 0;
      setNewMargin(calculateProfitMargin(cost, sp).profitMarginPercent.toString());
    }
  };

  const handleNewMarginChange = (val: string) => {
    setNewPricingMode('margin');
    setNewMargin(val);
    const mg = Number(val) || 0;
    const cost = Number(newPurchaseCost) || 0;
    if (mg >= 100) {
      setFormError('Gross profit margin cannot be 100% or greater.');
      return;
    }
    setFormError(null);
    setNewSellingPrice(calculateSellingPriceFromMargin(cost, mg).toString());
  };

  const handleNewSellingPriceChange = (val: string) => {
    setNewPricingMode('price');
    setNewSellingPrice(val);
    const sp = Number(val) || 0;
    const cost = Number(newPurchaseCost) || 0;
    setFormError(null);
    setNewMargin(calculateProfitMargin(cost, sp).profitMarginPercent.toString());
  };

  const handleSaveNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const sp = Number(newSellingPrice);
    if (isNaN(sp) || sp <= 0) {
      setFormError('Selling price must be greater than 0.');
      return;
    }

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
          stockQuantity: Number(newStock) || 0,
          lowStockLimit: Number(newLowStock) || 0,
          mrp: Number(newMrp) || 0,
          purchaseDiscountPercent: Number(newDiscount) || 0,
          customPurchasePrice: Number(newPurchaseCost) || 0,
          sellingPrice: sp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product');
      }

      setShowAddRowModal(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  // --- DELETE ROW WORKFLOW ---
  const handleConfirmDeleteRow = async () => {
    if (!deleteRowProduct) return;
    try {
      const res = await fetch(`/api/products/${deleteRowProduct.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete product');
      }
      setDeleteRowProduct(null);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- EDIT PRODUCT WORKFLOW ---
  const openEditModal = (p: Product) => {
    setEditProduct(p);
    setEditName(p.name);
    setEditSize(p.size || '');
    setEditCompany(p.companyBrand || '');
    setEditUnit(p.unit || 'Pcs');
    setEditLowStock(String(p.lowStockLimit));
    setEditMrp(String(p.mrp));
    setEditDiscount(String(p.purchaseDiscountPercent));
    setEditPurchaseCost(String(p.purchasePrice));
    setEditSellingPrice(String(p.sellingPrice));
    const mg = p.profitMarginPercent ?? calculateProfitMargin(p.purchasePrice, p.sellingPrice).profitMarginPercent;
    setEditMargin(String(mg));
    setEditPricingMode('price');
    setEditFormError(null);
  };

  // Bidirectional calculations for Edit Product Form
  const handleEditMrpChange = (val: string) => {
    setEditMrp(val);
    const m = Number(val) || 0;
    const d = Number(editDiscount) || 0;
    const cost = calculatePurchasePrice(m, d);
    setEditPurchaseCost(cost.toString());
    if (editPricingMode === 'margin') {
      const mg = Number(editMargin) || 0;
      setEditSellingPrice(calculateSellingPriceFromMargin(cost, mg).toString());
    } else {
      const sp = Number(editSellingPrice) || 0;
      setEditMargin(calculateProfitMargin(cost, sp).profitMarginPercent.toString());
    }
  };

  const handleEditDiscountChange = (val: string) => {
    setEditDiscount(val);
    const m = Number(editMrp) || 0;
    const d = Number(val) || 0;
    const cost = calculatePurchasePrice(m, d);
    setEditPurchaseCost(cost.toString());
    if (editPricingMode === 'margin') {
      const mg = Number(editMargin) || 0;
      setEditSellingPrice(calculateSellingPriceFromMargin(cost, mg).toString());
    } else {
      const sp = Number(editSellingPrice) || 0;
      setEditMargin(calculateProfitMargin(cost, sp).profitMarginPercent.toString());
    }
  };

  const handleEditPurchaseCostChange = (val: string) => {
    setEditPurchaseCost(val);
    const cost = Number(val) || 0;
    if (editPricingMode === 'margin') {
      const mg = Number(editMargin) || 0;
      setEditSellingPrice(calculateSellingPriceFromMargin(cost, mg).toString());
    } else {
      const sp = Number(editSellingPrice) || 0;
      setEditMargin(calculateProfitMargin(cost, sp).profitMarginPercent.toString());
    }
  };

  const handleEditMarginChange = (val: string) => {
    setEditPricingMode('margin');
    setEditMargin(val);
    const mg = Number(val) || 0;
    const cost = Number(editPurchaseCost) || 0;
    if (mg >= 100) {
      setEditFormError('Gross profit margin cannot be 100% or greater.');
      return;
    }
    setEditFormError(null);
    setEditSellingPrice(calculateSellingPriceFromMargin(cost, mg).toString());
  };

  const handleEditSellingPriceChange = (val: string) => {
    setEditPricingMode('price');
    setEditSellingPrice(val);
    const sp = Number(val) || 0;
    const cost = Number(editPurchaseCost) || 0;
    setEditFormError(null);
    setEditMargin(calculateProfitMargin(cost, sp).profitMarginPercent.toString());
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setEditFormError(null);

    const sp = Number(editSellingPrice);
    if (isNaN(sp) || sp <= 0) {
      setEditFormError('Selling price must be greater than 0.');
      return;
    }

    setSavingProduct(true);
    try {
      const res = await fetch(`/api/products/${editProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          size: editSize,
          companyBrand: editCompany,
          unit: editUnit,
          lowStockLimit: Number(editLowStock),
          mrp: Number(editMrp),
          purchaseDiscountPercent: Number(editDiscount),
          customPurchasePrice: Number(editPurchaseCost),
          sellingPrice: sp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update product');

      setEditProduct(null);
      fetchProducts();
    } catch (err: any) {
      setEditFormError(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  // --- ADD COLUMN WORKFLOW ---
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

  return (
    <div className="space-y-6 pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Product Master
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Spreadsheet-style inventory catalogue with bidirectional 5-tier pricing and gross margin controls
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddRowConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm shadow-blue-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>

          <button
            onClick={() => setShowAddColumnConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm transition-all"
          >
            <Columns className="w-4 h-4 text-violet-600" />
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
            className="w-full pl-10 pr-24 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs text-slate-900"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            Search
          </button>
        </form>

        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-medium self-start sm:self-auto shrink-0 shadow-inner">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterMode === 'all'
                ? 'bg-white text-blue-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => setFilterMode('lowStock')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterMode === 'lowStock'
                ? 'bg-amber-100 text-amber-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setFilterMode('outOfStock')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterMode === 'outOfStock'
                ? 'bg-rose-100 text-rose-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Main Spreadsheet Product Table */}
      <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-3.5 font-bold whitespace-nowrap uppercase tracking-wider text-[11px]">Product ID</th>
                <th className="py-3 px-3.5 font-bold min-w-[200px] uppercase tracking-wider text-[11px]">Product Name</th>
                <th className="py-3 px-3 font-semibold whitespace-nowrap uppercase tracking-wider text-[11px]">Size</th>
                <th className="py-3 px-3 font-semibold whitespace-nowrap uppercase tracking-wider text-[11px]">Brand</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap uppercase tracking-wider text-[11px]">Stock</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap uppercase tracking-wider text-[11px]">MRP</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap uppercase tracking-wider text-[11px]">Disc %</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap uppercase tracking-wider text-[11px]">Cost</th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap uppercase tracking-wider text-[11px]">Margin %</th>
                <th className="py-3 px-3.5 font-bold text-right whitespace-nowrap text-blue-700 bg-blue-50/50 uppercase tracking-wider text-[11px]">
                  Selling Price
                </th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap text-slate-400 uppercase tracking-wider text-[11px]">
                  Prev Rate
                </th>

                {/* Custom Columns */}
                {customColumns.map((col) => (
                  <th key={col.id} className="py-3 px-3 font-semibold whitespace-nowrap bg-slate-50 uppercase tracking-wider text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      <button
                        onClick={() => setDeleteColumnDef(col)}
                        title="Delete custom column"
                        className="p-0.5 text-slate-400 hover:text-rose-500 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}

                <th className="py-3 px-3 font-semibold text-center whitespace-nowrap uppercase tracking-wider text-[11px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                      className="hover:bg-slate-50/80 transition-colors font-mono"
                    >
                      <td className="py-2.5 px-3.5 font-bold text-blue-600">
                        <Link href={`/products/${p.id}`} className="hover:underline">
                          {p.productId}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3.5 font-sans font-medium text-slate-900">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {p.size || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {p.companyBrand || '—'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${
                          isOut
                            ? 'text-rose-600'
                            : isLow
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {formatQuantity(p.stockQuantity, p.unit)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        ₹{Number(p.mrp).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {p.purchaseDiscountPercent}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 font-medium">
                        ₹{Number(p.purchasePrice).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-violet-600">
                        {p.profitMarginPercent}%
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 bg-blue-50/40">
                        ₹{Number(p.sellingPrice).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 text-xs">
                        {p.previousSellingPrice !== null && p.previousSellingPrice !== undefined
                          ? `₹${Number(p.previousSellingPrice).toFixed(2)}`
                          : '—'}
                      </td>

                      {/* Custom column values */}
                      {customColumns.map((col) => (
                        <td key={col.id} className="py-2.5 px-3 text-slate-600">
                          {p.customFields?.[col.id] || '—'}
                        </td>
                      ))}

                      {/* Row Actions */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            title="Edit Product & Pricing"
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href={`/products/${p.id}`}
                            title="View Product History"
                            className="p-1 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => setDeleteRowProduct(p)}
                            title="Delete Product"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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

      {/* --- ADD ROW CONFIRMATION MODAL --- */}
      <ConfirmModal
        isOpen={showAddRowConfirm}
        onClose={() => setShowAddRowConfirm(false)}
        onConfirm={onConfirmAddRow}
        title="Add New Product Row"
        message="Are you sure you want to append a new item row to the product master catalogue?"
        confirmText="Proceed to Add"
      />

      {/* --- ADD COLUMN CONFIRMATION MODAL --- */}
      <ConfirmModal
        isOpen={showAddColumnConfirm}
        onClose={() => setShowAddColumnConfirm(false)}
        onConfirm={onConfirmAddColumn}
        title="Add Custom Product Column"
        message="Are you sure you want to add a new custom specification column to the entire product catalogue?"
        confirmText="Proceed to Add"
      />

      {/* --- DELETE ROW CONFIRMATION MODAL --- */}
      <ConfirmModal
        isOpen={Boolean(deleteRowProduct)}
        onClose={() => setDeleteRowProduct(null)}
        onConfirm={handleConfirmDeleteRow}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteRowProduct?.name}" (${deleteRowProduct?.productId})? Historical invoice lines will be preserved.`}
        confirmText="Delete Product"
        isDanger={true}
      />

      {/* --- ADD PRODUCT MODAL WITH BIDIRECTIONAL PRICING --- */}
      {showAddRowModal && (
        <Modal
          isOpen={showAddRowModal}
          onClose={() => setShowAddRowModal(false)}
          title="Add New Catalogue Item"
          maxWidth="lg"
        >
          <form onSubmit={handleSaveNewProduct} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product ID (Permanent Identifier) *
                </label>
                <input
                  type="text"
                  required
                  value={newProductId}
                  onChange={(e) => setNewProductId(e.target.value.toUpperCase())}
                  placeholder="e.g. HW-0010"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. CPVC Pipe 10ft"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Size / Dimension
                </label>
                <input
                  type="text"
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  placeholder="e.g. 1.5 inch or 10ft"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company / Brand
                </label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Astral, Jaquar"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measure</label>
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opening Stock Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={newLowStock}
                  onChange={(e) => setNewLowStock(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900 font-mono"
                />
              </div>
            </div>

            {/* Bidirectional 5-Tier Pricing Panel (Phase 8) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-violet-50/70 border border-blue-200/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  5-Tier Bidirectional Pricing Engine
                </span>
                <span className="text-[11px] font-semibold text-violet-700 bg-white px-2 py-0.5 rounded-full border border-violet-200 shadow-2xs">
                  Active Driver: {newPricingMode === 'margin' ? 'Profit Margin %' : 'Selling Price'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={newMrp}
                    onChange={(e) => handleNewMrpChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Purchase Disc %</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={newDiscount}
                    onChange={(e) => handleNewDiscountChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newPurchaseCost}
                    onChange={(e) => handleNewPurchaseCostChange(e.target.value)}
                    title="Auto-calculated from MRP & Disc %, or edit if supplier invoice differs"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-violet-800 mb-1">
                    Gross Margin % ⇄
                  </label>
                  <input
                    type="number"
                    step="any"
                    max="99.99"
                    value={newMargin}
                    onChange={(e) => handleNewMarginChange(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs border-2 rounded-lg bg-white font-mono font-bold text-slate-900 focus:outline-none ${
                      newPricingMode === 'margin' ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-slate-300'
                    }`}
                  />
                </div>

                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-[11px] font-bold text-blue-800 mb-1">
                    Selling Price (₹) ⇄
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={newSellingPrice}
                    onChange={(e) => handleNewSellingPriceChange(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs border-2 rounded-lg bg-white font-mono font-bold text-slate-900 focus:outline-none ${
                      newPricingMode === 'price' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300'
                    }`}
                  />
                </div>
              </div>

              {/* Real-time Math Summary */}
              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-blue-100">
                <span>
                  Net Profit: <strong className="font-mono text-slate-900">₹{(Number(newSellingPrice) - Number(newPurchaseCost)).toFixed(2)}</strong> / unit
                </span>
                <span>
                  Gross Margin: <strong className="font-mono text-violet-700">{Number(newMargin).toFixed(1)}%</strong> of selling rate
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRowModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProduct}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/25 transition-all disabled:opacity-50"
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
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data Type</label>
              <select
                value={newColumnType}
                onChange={(e: any) => setNewColumnType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all text-slate-900"
              >
                <option value="TEXT">Text (Letters & Numbers)</option>
                <option value="NUMBER">Number</option>
                <option value="DATE">Date</option>
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddColumnModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-sm shadow-violet-600/20 transition-all"
              >
                Save Column
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- EDIT PRODUCT MODAL WITH BIDIRECTIONAL PRICING --- */}
      {editProduct && (
        <Modal
          isOpen={Boolean(editProduct)}
          onClose={() => setEditProduct(null)}
          title={`Edit Product: ${editProduct.productId}`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveEditProduct} className="space-y-4">
            {editFormError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Size</label>
                <input
                  type="text"
                  value={editSize}
                  onChange={(e) => setEditSize(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                <input
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Low Stock Limit</label>
                <input
                  type="number"
                  min="0"
                  value={editLowStock}
                  onChange={(e) => setEditLowStock(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900 font-mono"
                />
              </div>
            </div>

            {/* Bidirectional 5-Tier Pricing Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-violet-50/70 border border-blue-200/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  Bidirectional Pricing & Gross Margin
                </span>
                <span className="text-[11px] font-semibold text-violet-700 bg-white px-2 py-0.5 rounded-full border border-violet-200 shadow-2xs">
                  Active Driver: {editPricingMode === 'margin' ? 'Profit Margin %' : 'Selling Price'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={editMrp}
                    onChange={(e) => handleEditMrpChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={editDiscount}
                    onChange={(e) => handleEditDiscountChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={editPurchaseCost}
                    onChange={(e) => handleEditPurchaseCostChange(e.target.value)}
                    title="Auto-calculated or manually override actual supplier cost"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-violet-800 mb-1">
                    Gross Margin % ⇄
                  </label>
                  <input
                    type="number"
                    step="any"
                    max="99.99"
                    value={editMargin}
                    onChange={(e) => handleEditMarginChange(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs border-2 rounded-lg bg-white font-mono font-bold text-slate-900 focus:outline-none ${
                      editPricingMode === 'margin' ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-slate-300'
                    }`}
                  />
                </div>

                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-[11px] font-bold text-blue-800 mb-1">
                    Selling Price (₹) ⇄ (Rate change will be logged in history)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={editSellingPrice}
                    onChange={(e) => handleEditSellingPriceChange(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs border-2 rounded-lg bg-white font-mono font-bold text-slate-900 focus:outline-none ${
                      editPricingMode === 'price' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300'
                    }`}
                  />
                </div>
              </div>

              {/* Real-time Math Summary */}
              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-blue-100">
                <span>
                  Net Profit: <strong className="font-mono text-slate-900">₹{(Number(editSellingPrice) - Number(editPurchaseCost)).toFixed(2)}</strong> / unit
                </span>
                <span>
                  Gross Margin: <strong className="font-mono text-violet-700">{Number(editMargin).toFixed(1)}%</strong> of selling rate
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditProduct(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProduct}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/25 transition-all disabled:opacity-50"
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
