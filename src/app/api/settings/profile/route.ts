// src/app/api/settings/profile/route.ts
import { NextResponse } from 'next/server';
import { getShopRepository } from '@/lib/db/connection-router';

export async function GET() {
  try {
    const shopRepo = getShopRepository();
    const profile = await shopRepo.getProfile();
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const shopRepo = getShopRepository();
    const updated = await shopRepo.updateProfile(body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
