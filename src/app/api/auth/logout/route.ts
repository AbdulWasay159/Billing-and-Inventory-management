// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';

export async function POST() {
  await authService.logout();
  return NextResponse.json({ success: true });
}
