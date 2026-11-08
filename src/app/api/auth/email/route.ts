// src/app/api/auth/email/route.ts
import { NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

/** Change the signed-in owner's login email (requires the current password). */
export async function PATCH(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const { newEmail, currentPassword } = await request.json();
    const { email, token } = await authService.changeEmail(
      {
        shopId: auth.session.shopId,
        shopName: auth.session.shopName,
        email: auth.session.email,
        role: 'OWNER',
      },
      newEmail,
      currentPassword
    );

    const res = NextResponse.json({ success: true, email });
    res.cookies.set('tradestock_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
