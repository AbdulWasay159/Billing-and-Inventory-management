// src/lib/auth/session.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

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

export interface SessionPayload {
  shopId: string;
  shopName: string;
  email: string;
  role: 'OWNER';
  expiresAt: number;
}

export async function createSessionToken(payload: Omit<SessionPayload, 'expiresAt'>): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
  return new SignJWT({ ...payload, expiresAt })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('tradestock_session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(payload: Omit<SessionPayload, 'expiresAt'>): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set('tradestock_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('tradestock_session');
}
