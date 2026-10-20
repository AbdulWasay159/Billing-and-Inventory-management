// src/components/layout/sidebar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Receipt,
  FileText,
  BarChart3,
  FileSpreadsheet,
  Settings,
  User,
  LogOut,
  Store,
} from 'lucide-react';
import { useShop } from '@/context/shop-context';

const CORE_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Inventory', href: '/inventory', icon: Boxes },
  { label: 'Billing / POS', href: '/billing', icon: Receipt },
  { label: 'Invoice History', href: '/billing/history', icon: FileText },
];

const TOOLS_NAV_ITEMS = [
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Imports & Exports', href: '/imports-exports', icon: FileSpreadsheet },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Shop Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { shop } = useShop();

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
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200/90 text-slate-700 select-none shadow-xs">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200/80 bg-white">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-600/25">
          <Store className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-base tracking-tight text-slate-900 truncate">TradeStock Pro</h1>
          <p className="text-[11px] text-slate-500 font-medium truncate">
            {shop?.name || 'Inventory & Billing'}
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Core Operations
        </div>
        {CORE_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Insights & Administration
        </div>
        {TOOLS_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                isActive
                  ? item.href === '/profile'
                    ? 'bg-violet-50 text-violet-700 font-semibold border-r-2 border-violet-600 shadow-xs'
                    : 'bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive
                    ? item.href === '/profile'
                      ? 'text-violet-600'
                      : 'text-blue-600'
                    : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/60 space-y-2">
        <Link
          href="/profile"
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-xs transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            SO
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
              Owner Account
            </p>
            <p className="text-[11px] text-slate-500 truncate">Manage Profile</p>
          </div>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-600" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
