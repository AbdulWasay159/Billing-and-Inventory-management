// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.SESSION_SECRET;

if (isProduction && (!rawSecret || rawSecret.trim().length < 32 || rawSecret.includes('super-secure-production-secret-key'))) {
  throw new Error(
    'FATAL SECURITY CONFIGURATION: A cryptographically random SESSION_SECRET of at least 32 characters must be configured in production environments.'
  );
}

const SECRET_KEY = rawSecret && rawSecret.trim().length >= 32
  ? rawSecret
  : 'tradestock-pro-dev-fallback-secret-key-minimum-32-chars';

const key = new TextEncoder().encode(SECRET_KEY);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let token = request.cookies.get('tradestock_session')?.value;
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  let isValidSession = false;
  if (token) {
    try {
      await jwtVerify(token, key, { algorithms: ['HS256'] });
      isValidSession = true;
    } catch (e: any) {
      console.error('[Middleware Auth Error]:', e?.message, 'Token received:', token?.substring(0, 15));
      isValidSession = false;
    }
  }

  // API Routes: allow /api/auth/* always; require session for other API routes
  if (pathname.startsWith('/api')) {
    if (!isValidSession && !pathname.startsWith('/api/auth')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Redirect unauthenticated web page requests to /login
  if (!isValidSession && pathname !== '/login') {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated user away from /login to /dashboard
  if (isValidSession && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  // Root redirect
  if (pathname === '/') {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = isValidSession ? '/dashboard' : '/login';
    return NextResponse.redirect(targetUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|logo.svg).*)'],
};
