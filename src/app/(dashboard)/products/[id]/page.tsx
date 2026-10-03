// src/app/(dashboard)/products/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  History,
  TrendingUp,
  Receipt,
  AlertTriangle,
  Clock,
  Calendar,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { Product, PriceHistory, ProductSalesSummary } from '@/types';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [salesSummary, setSalesSummary] = useState<ProductSalesSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const [prodRes, salesRes] = await Promise.all([
          fetch(`/api/products/${id}`),
          fetch(`/api/analytics/products?productId=${id}`),
        ]);

        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProduct(prodData.product);
          setPriceHistory(prodData.priceHistory || []);
        }

        if (salesRes.ok) {
          const salesData = await salesRes.json();
          setSalesSummary(salesData);
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading product details...</div>;
  }

  if (!product) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-500">Product not found.</p>
        <Link href="/products" className="text-indigo-600 font-semibold hover:underline">
          Return to Products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Button */}
      <Link
        href="/products"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Product Master</span>
      </Link>

      {/* Header Info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {product.productId}
            </span>
            <span className="text-xs text-slate-400 font-medium">{product.companyBrand}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {product.name}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Size: <strong className="text-slate-700 dark:text-slate-300">{product.size || 'Standard'}</strong> | Unit:{' '}
            <strong className="text-slate-700 dark:text-slate-300">{product.unit}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Available Stock</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {formatQuantity(product.stockQuantity, product.unit)}
            </p>
          </div>
        </div>
      </div>

      {/* 5-Tier Pricing Matrix Card (Section 7) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span>5-Tier Pricing Breakdown</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 block mb-1">1. MRP</span>
            <strong className="text-lg font-mono text-slate-900 dark:text-white">
              ₹{Number(product.mrp).toFixed(2)}
            </strong>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 block mb-1">2. Discount %</span>
            <strong className="text-lg font-mono text-slate-900 dark:text-white">
              {product.purchaseDiscountPercent}%
            </strong>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 block mb-1">3. Purchase Cost</span>
            <strong className="text-lg font-mono text-slate-900 dark:text-white">
              ₹{Number(product.purchasePrice).toFixed(2)}
            </strong>
          </div>

          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40">
            <span className="text-xs text-amber-700 dark:text-amber-400 block mb-1">
              4. Previous Rate
            </span>
            <strong className="text-lg font-mono text-amber-800 dark:text-amber-300">
              {product.previousSellingPrice !== null && product.previousSellingPrice !== undefined
                ? `₹${Number(product.previousSellingPrice).toFixed(2)}`
                : '—'}
            </strong>
          </div>

          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <span className="text-xs text-indigo-700 dark:text-indigo-400 font-bold block mb-1">
              5. Current Rate
            </span>
            <strong className="text-xl font-mono text-indigo-700 dark:text-indigo-300 font-bold">
              ₹{Number(product.sellingPrice).toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>
            Profit Markup: <strong>₹{(product.sellingPrice - product.purchasePrice).toFixed(2)}</strong> ({product.profitMarginPercent}%)
          </span>
          <span className="text-slate-400">
            Note: No separate profit reports are generated, adhering to business specs.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price History Timeline (Section 24) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>Price Change History Log</span>
          </h2>

          {priceHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No historical price changes recorded yet. Rates are at initial setting.
            </div>
          ) : (
            <div className="space-y-3">
              {priceHistory.map((ph) => (
                <div
                  key={ph.id}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-white">
                      Selling Rate: ₹{Number(ph.oldSellingPrice).toFixed(2)} →{' '}
                      <span className="text-indigo-600 font-bold">
                        ₹{Number(ph.newSellingPrice).toFixed(2)}
                      </span>
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Purchase: ₹{Number(ph.oldPurchasePrice).toFixed(2)} → ₹
                      {Number(ph.newPurchasePrice).toFixed(2)} ({ph.changeReason || 'Manual edit'})
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(ph.changedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product-Wise Sales History (Section 20) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-500" />
              <span>Product-Wise Sales History</span>
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              Sold: {salesSummary?.totalQuantitySold || 0} {product.unit}
            </span>
          </div>

          {!salesSummary?.invoices || salesSummary.invoices.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No completed bills contain this product yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {salesSummary.invoices.map((inv) => (
                <Link
                  key={inv.invoiceId}
                  href={`/invoices/${inv.invoiceId}`}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-indigo-600">{inv.invoiceNumber}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(inv.date).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800 dark:text-white">
                      {inv.quantity} {product.unit} @ ₹{inv.sellingPrice.toFixed(2)}
                    </p>
                    <p className="font-bold text-slate-900 dark:text-white font-mono">
                      ₹{inv.lineTotal.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
