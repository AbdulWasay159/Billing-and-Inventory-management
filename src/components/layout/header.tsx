// src/components/layout/header.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  X,
  Store,
  LayoutDashboard,
  Package,
  Boxes,
  Receipt,
  FileText,
  BarChart3,
  FileSpreadsheet,
  Settings,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Inventory', href: '/inventory', icon: Boxes },
  { label: 'Billing / POS', href: '/billing', icon: Receipt },
  { label: 'Invoice History', href: '/billing/history', icon: FileText },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Imports & Exports', href: '/imports-exports', icon: FileSpreadsheet },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <>
      <header className="h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Live Shop
            </span>
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-white truncate max-w-[200px] sm:max-w-md">
              TradeStock Hardware & Sanitary
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/billing"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Receipt className="w-4 h-4" />
            <span>New Bill</span>
          </Link>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-black/60 backdrop-blur-xs flex">
          <div className="w-72 max-w-[80vw] bg-slate-900 text-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-6 h-16 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Store className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-base text-white">TradeStock Pro</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-950/30"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </>
  );
}
