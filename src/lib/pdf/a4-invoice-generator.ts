// src/lib/pdf/a4-invoice-generator.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, ShopProfile } from '@/types';
import { paginateInvoiceItems } from '@/lib/utils';

export function generateA4InvoicePdf(invoice: Invoice, shop: ShopProfile): jsPDF {
  // A4 dimensions in mm: 210 x 297
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Strict 20 items per page pagination
  const pages = paginateInvoiceItems(invoice.items, 20);
  const totalPages = pages.length;

  pages.forEach((pageChunk, pageIdx) => {
    if (pageIdx > 0) {
      doc.addPage('a4', 'portrait');
    }

    const marginX = 14;
    let currentY = 16;

    // Header Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(shop.name.toUpperCase(), marginX, currentY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // Slate-600
    currentY += 5;
    if (shop.address) {
      doc.text(shop.address, marginX, currentY);
      currentY += 4;
    }
    if (shop.phone) {
      doc.text(`Phone: ${shop.phone}  |  Email: ${shop.email}`, marginX, currentY);
      currentY += 5;
    }

    // Divider line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY, 210 - marginX, currentY);
    currentY += 6;

    // Invoice Meta Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    const invoiceTitle = pageChunk.isFirstPage
      ? `TAX INVOICE / CASH MEMO`
      : `TAX INVOICE: ${invoice.invoiceNumber} (Continuation)`;
    doc.text(invoiceTitle, marginX, currentY);

    doc.setFontSize(10);
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 210 - marginX - 50, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Date: ${new Date(invoice.billDate).toLocaleDateString('en-IN')}`, 210 - marginX - 50, currentY);

    if (invoice.customerName) {
      doc.text(`Customer: ${invoice.customerName}`, marginX, currentY);
      currentY += 4;
    }
    if (invoice.customerPhone) {
      doc.text(`Phone: ${invoice.customerPhone}`, marginX, currentY);
      currentY += 4;
    }

    currentY += 2;

    // Table of Items (Exactly up to 20 items on this page)
    const tableData = pageChunk.items.map((item, idx) => {
      const serialNo = pageChunk.startIndex + idx + 1;
      return [
        serialNo.toString(),
        item.productIdSnapshot,
        item.productNameSnapshot,
        item.sizeSnapshot || '—',
        item.quantity.toString(),
        item.unitSnapshot,
        `₹${Number(item.sellingPriceSnapshot).toFixed(2)}`,
        `₹${Number(item.lineTotal).toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      head: [['#', 'Item Code', 'Description of Goods', 'Size', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 'auto', halign: 'left' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 14, halign: 'right' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 26, halign: 'right' },
      },
      styles: {
        fontSize: 8,
        cellPadding: 1.8,
        overflow: 'ellipsize',
      },
      didDrawPage: () => {
        // Footer section inside page bounds
        const pageBottomY = 278;

        doc.setDrawColor(203, 213, 225);
        doc.line(marginX, pageBottomY - 14, 210 - marginX, pageBottomY - 14);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);

        // Page Subtotal
        doc.text(
          `Page ${pageChunk.pageNumber} Subtotal: ₹${pageChunk.pageSubtotal.toFixed(2)}`,
          marginX,
          pageBottomY - 9
        );

        // If last page, print Grand Total and Payment Details
        if (pageChunk.isLastPage) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(`GRAND TOTAL: ₹${Number(invoice.finalTotal).toFixed(2)}`, 210 - marginX - 55, pageBottomY - 9);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(
            `Payment: ${invoice.paymentMode}  |  Items: ${invoice.items.length}`,
            210 - marginX - 55,
            pageBottomY - 5
          );
        } else {
          doc.setFont('helvetica', 'italic');
          doc.text(`Continued on page ${pageChunk.pageNumber + 1}...`, 210 - marginX - 55, pageBottomY - 9);
        }

        // Receipt Footer Note
        if (shop.receiptFooterMessage) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.text(shop.receiptFooterMessage, marginX, pageBottomY - 4);
        }

        // Page Numbering
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(
          `Page ${pageChunk.pageNumber} of ${totalPages}`,
          105,
          pageBottomY,
          { align: 'center' }
        );
      },
    });
  });

  return doc;
}
