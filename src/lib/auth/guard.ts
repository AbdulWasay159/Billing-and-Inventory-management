// src/lib/auth/guard.ts
import { NextResponse } from 'next/server';
import { verifySessionToken, SessionPayload } from './session';

export type AuthGuardResult =
  | { authorized: true; session: SessionPayload }
  | { authorized: false; response: NextResponse };

/**
 * Route-Level Authorization & IDOR Protection (Audit Finding #4)
 * Validates session token directly in the route handler, extracting shop context.
 */
export async function requireAuthenticatedShop(request: Request): Promise<AuthGuardResult> {
  let token: string | undefined;

  // 1. Check Authorization Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Fallback to cookie
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/tradestock_session=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      ),
    };
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Invalid or expired session.' },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session,
  };
}
