// src/app/api/auth/profile/route.ts
import { NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

export async function GET(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const profile = await authService.getUserProfile(auth.session.email);
    if (!profile) {
      // Session points at an account that no longer exists under that email
      // (e.g. the login email was changed on another device): force a fresh sign-in.
      const res = NextResponse.json(
        { error: 'Your session is out of date. Please sign in again.', reauth: true },
        { status: 401 }
      );
      res.cookies.delete('tradestock_session');
      return res;
    }
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
    const updated = await authService.updateUserProfile(auth.session.email, {
      name: body.name,
      phone: body.phone,
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;
    const result = await authService.changePassword(
      auth.session.email,
      currentPassword,
      newPassword
    );
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
