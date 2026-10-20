// src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import { getShopRepository, isPrismaConfigured } from '@/lib/db/connection-router';
import { prisma } from '@/lib/db/prisma';
import {
  setSessionCookie,
  clearSessionCookie,
  getSession,
  createSessionToken,
  SessionPayload,
} from '@/lib/auth/session';

export class AuthService {
  private shopRepo = getShopRepository();

  /**
   * Database-Backed Authentication (Section 3, 4 & Audit Finding #3)
   */
  async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; session?: SessionPayload; token?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    let user: {
      id: string;
      email: string;
      passwordHash: string;
      name: string;
      role: string;
      isActive: boolean;
    } | null = null;

    if (isPrismaConfigured()) {
      // Query PostgreSQL users table
      user = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      // Auto-bootstrap initial owner if users table is empty
      if (!user) {
        const userCount = await prisma.user.count();
        if (userCount === 0 && cleanEmail === 'owner@tradestock.com') {
          const defaultHash = await bcrypt.hash('password123', 10);
          user = await prisma.user.create({
            data: {
              email: cleanEmail,
              name: 'Shop Owner',
              passwordHash: defaultHash,
              role: 'OWNER',
              isActive: true,
            },
          });
        }
      }
    } else {
      // Local fallback development mode
      const { LocalDatabaseManager } = await import('@/lib/db/local-adapter');
      const localDb = LocalDatabaseManager.getInstance();
      const localUser = localDb.getUserByEmail(cleanEmail);
      if (localUser) {
        user = {
          id: localUser.id,
          email: localUser.email,
          passwordHash: localUser.passwordHash,
          name: localUser.name,
          role: localUser.role,
          isActive: localUser.isActive,
        };
      } else if (cleanEmail === 'owner@tradestock.com') {
        const defaultHash = bcrypt.hashSync('password123', 10);
        user = {
          id: 'user_owner_001',
          email: cleanEmail,
          passwordHash: defaultHash,
          name: 'Shop Owner',
          role: 'OWNER',
          isActive: true,
        };
      }
    }

    if (!user) {
      return { success: false, error: 'Invalid email or password.' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Account is deactivated. Please contact support.' };
    }

    // Secure password comparison
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const shopProfile = await this.shopRepo.getProfile();

    const sessionData = {
      shopId: shopProfile.id || 'shop_001',
      shopName: shopProfile.name || 'TradeStock Hardware & Sanitary',
      email: user.email,
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

  async getUserProfile(email: string): Promise<{
    id: string;
    email: string;
    name: string;
    phone?: string;
    role: string;
  } | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (isPrismaConfigured()) {
      const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    } else {
      const { LocalDatabaseManager } = await import('@/lib/db/local-adapter');
      const localDb = LocalDatabaseManager.getInstance();
      const user = localDb.getUserByEmail(cleanEmail);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      };
    }
  }

  async updateUserProfile(
    email: string,
    updates: { name?: string; phone?: string }
  ): Promise<{
    id: string;
    email: string;
    name: string;
    phone?: string;
    role: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    if (isPrismaConfigured()) {
      const user = await prisma.user.update({
        where: { email: cleanEmail },
        data: {
          name: updates.name ? updates.name.trim() : undefined,
        },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: updates.phone,
        role: user.role,
      };
    } else {
      const { LocalDatabaseManager } = await import('@/lib/db/local-adapter');
      const localDb = LocalDatabaseManager.getInstance();
      const updated = localDb.updateUser(cleanEmail, {
        name: updates.name ? updates.name.trim() : undefined,
        phone: updates.phone !== undefined ? updates.phone.trim() : undefined,
      });
      if (!updated) throw new Error('User account not found.');
      return {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        role: updated.role,
      };
    }
  }

  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!currentPassword || !newPassword) {
      throw new Error('Current password and new password are required.');
    }
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    let user: { passwordHash: string } | null = null;
    if (isPrismaConfigured()) {
      user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    } else {
      const { LocalDatabaseManager } = await import('@/lib/db/local-adapter');
      const localDb = LocalDatabaseManager.getInstance();
      user = localDb.getUserByEmail(cleanEmail);
    }

    if (!user) {
      throw new Error('User account not found.');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect.');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    if (isPrismaConfigured()) {
      await prisma.user.update({
        where: { email: cleanEmail },
        data: { passwordHash: newHash },
      });
    } else {
      const { LocalDatabaseManager } = await import('@/lib/db/local-adapter');
      const localDb = LocalDatabaseManager.getInstance();
      localDb.updateUser(cleanEmail, { passwordHash: newHash });
    }

    return { success: true, message: 'Password updated successfully.' };
  }
}

export const authService = new AuthService();
