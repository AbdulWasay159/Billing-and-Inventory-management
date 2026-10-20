// src/context/shop-context.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ShopProfile } from '@/types';

interface ShopContextType {
  shop: ShopProfile | null;
  loading: boolean;
  refreshShop: () => Promise<void>;
  updateShop: (updates: Partial<ShopProfile>) => Promise<ShopProfile>;
}

const ShopContext = createContext<ShopContextType>({
  shop: null,
  loading: true,
  refreshShop: async () => {},
  updateShop: async () => {
    throw new Error('ShopContext not initialized');
  },
});

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/profile');
      if (res.ok) {
        const data = await res.json();
        setShop(data);
      }
    } catch (err) {
      console.error('Failed to load shop settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  const updateShop = useCallback(async (updates: Partial<ShopProfile>): Promise<ShopProfile> => {
    const res = await fetch('/api/settings/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update shop settings');
    }

    const updated: ShopProfile = await res.json();
    setShop(updated);
    return updated;
  }, []);

  return (
    <ShopContext.Provider value={{ shop, loading, refreshShop: fetchShop, updateShop }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  return useContext(ShopContext);
}
