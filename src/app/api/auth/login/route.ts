// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const result = await authService.login(email, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Authentication failed.' }, { status: 401 });
    }

    const res = NextResponse.json({ 
      success: true, 
      session: result.session, 
      token: (result as any).token 
    });

    if ((result as any).token) {
      res.cookies.set('tradestock_session', (result as any).token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return res;
  } catch (err: any) {
    console.error('[API Auth Login Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
