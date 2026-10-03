// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';

export async function GET() {
  const session = await authService.getCurrentSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, session });
}
