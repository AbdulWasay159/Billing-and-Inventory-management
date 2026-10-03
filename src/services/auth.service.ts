// src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import { getShopRepository } from '@/lib/db/connection-router';
import { setSessionCookie, clearSessionCookie, getSession, createSessionToken, SessionPayload } from '@/lib/auth/session';

// In production, users are stored in the platform/control DB (Section 3 & 4)
const DEFAULT_OWNER = {
  email: 'owner@tradestock.com',
  passwordHash: bcrypt.hashSync('password123', 10),
  shopId: 'shop_001',
  shopName: 'TradeStock Hardware & Sanitary',
};

export class AuthService {
  private shopRepo = getShopRepository();

  async login(email: string, password: string): Promise<{ success: boolean; error?: string; session?: SessionPayload; token?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // Validate email
    if (cleanEmail !== DEFAULT_OWNER.email.toLowerCase()) {
      return { success: false, error: 'Invalid email or password.' };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, DEFAULT_OWNER.passwordHash);
    if (!isPasswordValid) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const shopProfile = await this.shopRepo.getProfile();

    const sessionData = {
      shopId: shopProfile.id || DEFAULT_OWNER.shopId,
      shopName: shopProfile.name || DEFAULT_OWNER.shopName,
      email: cleanEmail,
      role: 'OWNER' as const,
    };

    const token = await createSessionToken(sessionData);
    await setSessionCookie(sessionData);

    return {
      success: true,
      token,
      session: {
        ...sessionData,
        expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      },
    };
  }

  async logout(): Promise<void> {
    await clearSessionCookie();
  }

  async getCurrentSession(): Promise<SessionPayload | null> {
    return getSession();
  }
}

export const authService = new AuthService();
