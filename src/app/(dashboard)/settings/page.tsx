// src/app/(dashboard)/settings/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Store, Save, Columns, Plus, Trash2, CheckCircle2, Shield } from 'lucide-react';
import { ShopProfile, CustomFieldDefinition } from '@/types';
import { Modal, ConfirmModal } from '@/components/ui/modal';

export default function SettingsPage() {
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
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      if (!res.ok) throw new Error('Failed to save profile');
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Shop Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configure shop invoice header, contact details, receipt notes, and custom columns
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Shop settings updated successfully.</span>
        </div>
      )}

      {/* Shop Profile & Receipt Customization */}
      {profile && (
        <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-indigo-600" />
            <span>Store Profile & A4 Header</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Shop Business Name
              </label>
              <input
                type="text"
                required
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Owner Email (Unique)
              </label>
              <input
                type="email"
                required
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={profile.currencySymbol || '₹'}
                onChange={(e) => setProfile({ ...profile, currencySymbol: e.target.value })}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Shop Physical Address (Printed on A4 Invoice Header)
              </label>
              <textarea
                rows={2}
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Receipt Footer Terms / Note
              </label>
              <input
                type="text"
                value={profile.receiptFooterMessage || ''}
                onChange={(e) => setProfile({ ...profile, receiptFooterMessage: e.target.value })}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Store Details'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Custom Columns Management (Section 11) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Columns className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-base text-slate-900 dark:text-white">
              Product Custom Columns
            </h2>
          </div>
          <button
            onClick={() => setShowAddColumnModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Column</span>
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Add dynamic fields (e.g. Shelf Location, Distributor Code) without modifying database schemas.
        </p>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600">
              <tr>
                <th className="py-2.5 px-3">Column Label</th>
                <th className="py-2.5 px-3">Field Key</th>
                <th className="py-2.5 px-3">Data Type</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Protected system columns preview */}
              <tr>
                <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                  Product ID, Name, Size, Stock, Pricing
                </td>
                <td className="py-2 px-3 font-mono text-slate-400">Canonical Columns</td>
                <td className="py-2 px-3 text-slate-500">System Built-in</td>
                <td className="py-2 px-3 text-center">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" />
                    Protected
                  </span>
                </td>
                <td className="py-2 px-3 text-center text-slate-400 text-[11px] italic">Locked</td>
              </tr>

              {/* Dynamic user custom columns */}
              {columns.map((col) => (
                <tr key={col.id}>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                    {col.label}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-indigo-600">{col.fieldKey}</td>
                  <td className="py-2.5 px-3 text-slate-500">{col.dataType}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      Custom
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => setDeleteCol(col)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
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
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data Type</label>
              <select
                value={newColumnType}
                onChange={(e: any) => setNewColumnType(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
              >
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
                <option value="DATE">Date</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddColumnModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg"
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
