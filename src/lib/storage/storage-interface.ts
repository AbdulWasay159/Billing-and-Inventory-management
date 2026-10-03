// src/lib/storage/storage-interface.ts

export interface StorageService {
  uploadInvoicePdf(shopId: string, invoiceNumber: string, pdfBuffer: Uint8Array): Promise<string>;
  getInvoicePdfUrl(shopId: string, invoiceNumber: string): Promise<string | null>;
  uploadExport(shopId: string, fileName: string, fileBuffer: Uint8Array): Promise<string>;
}
