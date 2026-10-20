// src/app/api/settings/profile/route.ts
import { NextResponse } from 'next/server';
import { getShopRepository } from '@/lib/db/connection-router';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

export async function GET(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const shopRepo = getShopRepository();
    const profile = await shopRepo.getProfile();
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const shopRepo = getShopRepository();
    const updated = await shopRepo.updateProfile(body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
