import PDFDocument from 'pdfkit';

const BRAND = '#4f46e5';
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';

// Stream a professional invoice PDF to the HTTP response.
export function streamInvoicePdf(res, { invoice, items, client, user }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  const money = (n) =>
    '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Header
  doc.fillColor(BRAND).fontSize(26).text('FreelanceFlow', 50, 50);
  doc.fillColor(MUTED).fontSize(10).text('Freelance Business Management', 50, 80);

  doc.fillColor(INK).fontSize(22).text('INVOICE', 400, 50, { align: 'right' });
  doc
    .fillColor(MUTED)
    .fontSize(10)
    .text(`#${invoice.invoice_number}`, 400, 80, { align: 'right' })
    .text(`Issued: ${invoice.issue_date}`, 400, 95, { align: 'right' })
    .text(`Due: ${invoice.due_date || '—'}`, 400, 110, { align: 'right' });

  // From / Bill To
  doc.moveTo(50, 140).lineTo(545, 140).strokeColor(LINE).stroke();

  doc.fillColor(MUTED).fontSize(9).text('FROM', 50, 155);
  doc.fillColor(INK).fontSize(11).text(user.name, 50, 168).text(user.email, 50, 183);

  doc.fillColor(MUTED).fontSize(9).text('BILL TO', 320, 155);
  doc.fillColor(INK).fontSize(11).text(client.name, 320, 168);
  let by = 183;
  if (client.company) { doc.fontSize(10).fillColor(MUTED).text(client.company, 320, by); by += 14; }
  if (client.email) { doc.fontSize(10).fillColor(MUTED).text(client.email, 320, by); by += 14; }

  // Table header
  const top = 240;
  doc.rect(50, top, 495, 24).fill(BRAND);
  doc.fillColor('#ffffff').fontSize(10);
  doc.text('DESCRIPTION', 60, top + 7);
  doc.text('HOURS', 330, top + 7, { width: 60, align: 'right' });
  doc.text('RATE', 400, top + 7, { width: 60, align: 'right' });
  doc.text('AMOUNT', 470, top + 7, { width: 65, align: 'right' });

  // Rows
  let y = top + 24;
  doc.fontSize(10);
  items.forEach((it, i) => {
    if (i % 2 === 1) doc.rect(50, y, 495, 22).fill('#f9fafb');
    doc.fillColor(INK);
    doc.text(it.description, 60, y + 6, { width: 260 });
    doc.text(Number(it.hours).toFixed(2), 330, y + 6, { width: 60, align: 'right' });
    doc.text(money(it.rate), 400, y + 6, { width: 60, align: 'right' });
    doc.text(money(it.amount), 470, y + 6, { width: 65, align: 'right' });
    y += 22;
  });

  // Totals
  doc.moveTo(330, y + 10).lineTo(545, y + 10).strokeColor(LINE).stroke();
  doc.fillColor(MUTED).fontSize(10).text('Subtotal', 400, y + 20, { width: 60, align: 'right' });
  doc.fillColor(INK).text(money(invoice.subtotal), 470, y + 20, { width: 65, align: 'right' });

  doc.fillColor(INK).fontSize(13).text('Total', 400, y + 44, { width: 60, align: 'right' });
  doc.fillColor(BRAND).fontSize(13).text(money(invoice.total), 470, y + 44, { width: 65, align: 'right' });

  // Footer
  doc.fillColor(MUTED).fontSize(9)
    .text('Thank you for your business!', 50, 760, { align: 'center', width: 495 });

  doc.end();
}
