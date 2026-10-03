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
    return `/api/invoices/download?shop=${shopId}&file=${invoiceNumber}.pdf`;
  }

  async getInvoicePdfUrl(shopId: string, invoiceNumber: string): Promise<string | null> {
    const filePath = path.join(STORAGE_ROOT, 'shops', shopId, 'invoices', `${invoiceNumber}.pdf`);
    if (fs.existsSync(filePath)) {
      return `/api/invoices/download?shop=${shopId}&file=${invoiceNumber}.pdf`;
    }
    return null;
  }

  async uploadExport(shopId: string, fileName: string, fileBuffer: Uint8Array): Promise<string> {
    const shopDir = path.join(STORAGE_ROOT, 'shops', shopId, 'exports');
    this.ensureDir(shopDir);
    const filePath = path.join(shopDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));
    return `/api/exports/download?shop=${shopId}&file=${fileName}`;
  }
}

/**
 * Production Google Cloud Storage implementation placeholder
 * Matches Section 17 & 30:
 * Bucket: trade-stock-files/shops/<shop-id>/invoices/<year>/<month>/<invoiceNumber>.pdf
 */
export class GoogleCloudStorageService implements StorageService {
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME || 'trade-stock-files';
  }

  async uploadInvoicePdf(shopId: string, invoiceNumber: string, _pdfBuffer: Uint8Array): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const objectPath = `shops/${shopId}/invoices/${year}/${month}/${invoiceNumber}.pdf`;
    return `https://storage.googleapis.com/${this.bucketName}/${objectPath}`;
  }

  async getInvoicePdfUrl(_shopId: string, _invoiceNumber: string): Promise<string | null> {
    return null;
  }

  async uploadExport(shopId: string, fileName: string, _fileBuffer: Uint8Array): Promise<string> {
    const objectPath = `shops/${shopId}/exports/${fileName}`;
    return `https://storage.googleapis.com/${this.bucketName}/${objectPath}`;
  }
}

const storageServiceInstance: StorageService = new LocalStorageService();

export function getStorageService(): StorageService {
  if (process.env.STORAGE_PROVIDER === 'gcs') {
    return new GoogleCloudStorageService();
  }
  return storageServiceInstance;
}
