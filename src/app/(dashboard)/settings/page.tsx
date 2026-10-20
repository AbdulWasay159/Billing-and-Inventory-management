// src/app/(dashboard)/settings/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, Store, Save, Columns, Plus, Trash2, CheckCircle2, Shield, User, ArrowRight } from 'lucide-react';
import { ShopProfile, CustomFieldDefinition } from '@/types';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { useShop } from '@/context/shop-context';

export default function SettingsPage() {
  const { shop, updateShop, refreshShop } = useShop();
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Custom Columns
  const [columns, setColumns] = useState<CustomFieldDefinition[]>([]);
  const [protectedFields, setProtectedFields] = useState<string[]>([]);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnType, setNewColumnType] = useState<'TEXT' | 'NUMBER' | 'DATE'>('TEXT');
  const [deleteCol, setDeleteCol] = useState<CustomFieldDefinition | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [profRes, colRes] = await Promise.all([
        fetch('/api/settings/profile'),
        fetch('/api/products/columns'),
      ]);

      if (profRes.ok) {
        const p = await profRes.json();
        setProfile(p);
      }
      if (colRes.ok) {
        const c = await colRes.json();
        setColumns(c.columns || []);
        setProtectedFields(c.protectedFields || []);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const updated = await updateShop(profile);
      setProfile(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddColumn = async (e: React.FormEvent) => {
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
      setNewColumnLabel('');
      fetchSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteColumn = async () => {
    if (!deleteCol) return;
    try {
      const res = await fetch(`/api/products/columns?id=${deleteCol.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete column');
      setDeleteCol(null);
      fetchSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Shop Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configure shop invoice header, business contact details, receipt notes, and custom catalog columns.
        </p>
      </div>

      {/* Responsibility Separation Callout (Phase 7) */}
      <div className="p-4 bg-gradient-to-r from-violet-50 via-blue-50 to-white border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-600 text-white shadow-xs">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Personal Account vs Shop Settings</h4>
            <p className="text-[11px] text-slate-600">
              Personal names, phone, and sign-in passwords are kept separate from store invoice headers.
            </p>
          </div>
        </div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors shadow-2xs self-start sm:self-auto shrink-0"
        >
          <span>Open Account Profile</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Shop settings updated successfully. All headers and invoice views synchronized.</span>
        </div>
      )}

      {/* Shop Profile & Receipt Customization */}
      {profile && (
        <form onSubmit={handleSaveProfile} className="card-3d bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" />
            <span>Store Profile & A4 Header Details</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shop Business Name (Displayed across website & printed invoices) *
              </label>
              <input
                type="text"
                required
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store Business Email (Printed on Invoice Header) *
              </label>
              <input
                type="email"
                required
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Phone Number
              </label>
              <input
                type="text"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={profile.currencySymbol || '₹'}
                onChange={(e) => setProfile({ ...profile, currencySymbol: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shop Physical Address (Printed on A4 Invoice Header)
              </label>
              <textarea
                rows={2}
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Shop No., Street Name, City, State, PIN"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Footer Terms / Note
              </label>
              <input
                type="text"
                value={profile.receiptFooterMessage || ''}
                onChange={(e) => setProfile({ ...profile, receiptFooterMessage: e.target.value })}
                placeholder="Goods once sold cannot be returned without original bill. Thank you!"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Store Details'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Custom Columns Management (Section 11) */}
      <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Columns className="w-5 h-5 text-violet-600" />
            <h2 className="font-bold text-base text-slate-900">
              Product Custom Columns
            </h2>
          </div>
          <button
            onClick={() => setShowAddColumnModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Column</span>
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Add dynamic attributes (e.g. Shelf Location, Distributor Code) across product catalogues and invoices.
        </p>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-3 uppercase tracking-wider text-[11px]">Column Label</th>
                <th className="py-2.5 px-3 uppercase tracking-wider text-[11px]">Field Key</th>
                <th className="py-2.5 px-3 uppercase tracking-wider text-[11px]">Data Type</th>
                <th className="py-2.5 px-3 uppercase tracking-wider text-[11px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {columns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No custom columns defined yet.
                  </td>
                </tr>
              ) : (
                columns.map((col) => {
                  const isProtected = protectedFields.includes(col.fieldKey);
                  return (
                    <tr key={col.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800">{col.label}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{col.fieldKey}</td>
                      <td className="py-3 px-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {col.dataType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isProtected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            <Shield className="w-3 h-3" />
                            System
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteCol(col)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Column"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Column Modal */}
      {showAddColumnModal && (
        <Modal
          isOpen={showAddColumnModal}
          onClose={() => setShowAddColumnModal(false)}
          title="Add New Custom Column"
          maxWidth="sm"
        >
          <form onSubmit={handleAddColumn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Column Label *</label>
              <input
                type="text"
                required
                value={newColumnLabel}
                onChange={(e) => setNewColumnLabel(e.target.value)}
                placeholder="e.g. Shelf Location"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data Type</label>
              <select
                value={newColumnType}
                onChange={(e: any) => setNewColumnType(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all text-slate-900"
              >
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
                <option value="DATE">Date</option>
              </select>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddColumnModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-sm shadow-violet-600/20 transition-all"
              >
                Add Column
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Column Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteCol)}
        onClose={() => setDeleteCol(null)}
        onConfirm={handleDeleteColumn}
        title="Delete Custom Column"
        message={`Do you really want to delete the complete column "${deleteCol?.label}"? All values stored in this custom column may be permanently lost.`}
        confirmText="Delete Column"
        isDanger={true}
      />
    </div>
  );
}
