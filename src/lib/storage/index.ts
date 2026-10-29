// src/lib/storage/index.ts
import fs from 'fs';
import path from 'path';
import { StorageService } from './storage-interface';

const STORAGE_ROOT = path.join(process.cwd(), '.tradestock-storage');

export class LocalStorageService implements StorageService {
  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async uploadInvoicePdf(shopId: string, invoiceNumber: string, pdfBuffer: Uint8Array): Promise<string> {
    const shopDir = path.join(STORAGE_ROOT, 'shops', shopId, 'invoices');
    this.ensureDir(shopDir);
    const filePath = path.join(shopDir, `${invoiceNumber}.pdf`);
    fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
    return `/api/invoices/download?shop=${encodeURIComponent(shopId)}&file=${encodeURIComponent(invoiceNumber)}.pdf`;
  }

  async getInvoicePdfUrl(shopId: string, invoiceNumber: string): Promise<string | null> {
    const filePath = path.join(STORAGE_ROOT, 'shops', shopId, 'invoices', `${invoiceNumber}.pdf`);
    if (fs.existsSync(filePath)) {
      return `/api/invoices/download?shop=${encodeURIComponent(shopId)}&file=${encodeURIComponent(invoiceNumber)}.pdf`;
    }
    return null;
  }

  async uploadExport(shopId: string, fileName: string, fileBuffer: Uint8Array): Promise<string> {
    const shopDir = path.join(STORAGE_ROOT, 'shops', shopId, 'exports');
    this.ensureDir(shopDir);
    const filePath = path.join(shopDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));
    return `/api/exports/download?shop=${encodeURIComponent(shopId)}&file=${encodeURIComponent(fileName)}`;
  }
}

/**
 * Production Google Cloud Storage Service (Section 17, 30 & Audit Finding #8/#16)
 * Structure: Bucket: <bucket-name>/shops/<shop-id>/invoices/<year>/<month>/<invoiceNumber>.pdf
 * Provides strict shop-level isolation and signed URL resolution.
 */
export class GoogleCloudStorageService implements StorageService {
  private bucketName: string;
  private fallbackLocalStorage: LocalStorageService;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME || 'trade-stock-files';
    this.fallbackLocalStorage = new LocalStorageService();
  }

  private getObjectPath(shopId: string, invoiceNumber: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `shops/${shopId}/invoices/${year}/${month}/${invoiceNumber}.pdf`;
  }

  async uploadInvoicePdf(shopId: string, invoiceNumber: string, pdfBuffer: Uint8Array): Promise<string> {
    const objectPath = this.getObjectPath(shopId, invoiceNumber);

    // If Google Cloud credentials are configured in environment
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT_ID) {
      try {
        // Dynamic import to avoid build errors if GCP SDK is optional in dev
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage();
        const bucket = storage.bucket(this.bucketName);
        const file = bucket.file(objectPath);

        await file.save(Buffer.from(pdfBuffer), {
          contentType: 'application/pdf',
          resumable: false,
          metadata: {
            cacheControl: 'private, max-age=3600',
            metadata: { shopId, invoiceNumber },
          },
        });

        // Generate V4 signed URL for secure download (expires in 24 hours)
        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 24 * 60 * 60 * 1000,
        });

        return signedUrl;
      } catch (err) {
        console.warn('[GCS Storage] Native GCP upload failed, using local storage fallback:', err);
      }
    }

    // Dev/Offline fallback with correct object path tracking
    return this.fallbackLocalStorage.uploadInvoicePdf(shopId, invoiceNumber, pdfBuffer);
  }

  async getInvoicePdfUrl(shopId: string, invoiceNumber: string): Promise<string | null> {
    const objectPath = this.getObjectPath(shopId, invoiceNumber);

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT_ID) {
      try {
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage();
        const file = storage.bucket(this.bucketName).file(objectPath);
        const [exists] = await file.exists();
        if (!exists) return null;

        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });
        return signedUrl;
      } catch (err) {
        console.warn('[GCS Storage] Failed to generate signed URL:', err);
      }
    }

    return this.fallbackLocalStorage.getInvoicePdfUrl(shopId, invoiceNumber);
  }

  async uploadExport(shopId: string, fileName: string, fileBuffer: Uint8Array): Promise<string> {
    const objectPath = `shops/${shopId}/exports/${fileName}`;

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT_ID) {
      try {
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage();
        const file = storage.bucket(this.bucketName).file(objectPath);

        await file.save(Buffer.from(fileBuffer), {
          contentType: fileName.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          resumable: false,
        });

        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 24 * 60 * 60 * 1000,
        });
        return signedUrl;
      } catch (err) {
        console.warn('[GCS Storage] Native GCP export upload failed, using local fallback:', err);
      }
    }

    return this.fallbackLocalStorage.uploadExport(shopId, fileName, fileBuffer);
  }
}

const localStorageInstance: StorageService = new LocalStorageService();
const gcsStorageInstance: StorageService = new GoogleCloudStorageService();

export function getStorageService(): StorageService {
  const provider = (process.env.STORAGE_PROVIDER || process.env.STORAGE_BACKEND || '').toLowerCase();
  if (provider === 'gcs') {
    return gcsStorageInstance;
  }
  return localStorageInstance;
}
