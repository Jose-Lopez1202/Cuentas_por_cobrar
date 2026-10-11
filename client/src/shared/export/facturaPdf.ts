import type { FacturaFelDetalle } from '@erp/contracts';
import { drawPdfFooters, newPdfDocument, pdfText } from './reportExport';

const money = (v: number) => `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (iso: string | null) => {
  if (!iso) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/** Representación impresa de la factura FEL (formato carta, una o más páginas). */
export async function downloadFacturaPdf(f: FacturaFelDetalle): Promise<void> {
  const { doc, autoTable } = await newPdfDocument('portrait');
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const left = 40;
  const right = w - 40;
  const anulada = f.estado === 'ANULADA';

  // --- Encabezado ---
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, w, 86, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(pdfText(f.nombreEmisor), left, 34, { maxWidth: 330 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`NIT emisor: ${f.nitEmisor}`, left, 54);
  doc.text('Documento Tributario Electronico (simulado)', left, 70);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('FACTURA', right, 30, { align: 'right' });
  doc.setFontSize(10.5);
  doc.text(`Serie: ${f.serieFel}`, right, 48, { align: 'right' });
  doc.text(`Numero: ${f.numeroFel}`, right, 64, { align: 'right' });

  // --- Receptor y fechas ---
  let y = 112;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEPTOR', left, y);
  doc.text('DATOS DE EMISION', 340, y);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(pdfText(f.nombreReceptor), left, y + 16, { maxWidth: 280 });
  doc.text(`NIT: ${f.nitReceptor}`, left, y + 32);
  doc.text(`Fecha de emision: ${fecha(f.fechaEmision)}`, 340, y + 16);
  doc.text(`Fecha de certificacion: ${fecha(f.fechaCertificacion)}`, 340, y + 32);
  doc.text(`Estado: ${anulada ? 'ANULADA' : 'CERTIFICADA'}`, 340, y + 48);

  // --- Autorización ---
  y += 70;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(left, y, right - left, 40, 4, 4, 'FD');
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('NUMERO DE AUTORIZACION (UUID)', left + 10, y + 15);
  doc.setTextColor(15, 23, 42);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(f.uuidAutorizacion, left + 10, y + 32);

  // --- Detalle ---
  autoTable(doc, {
    startY: y + 56,
    head: [['#', 'Descripcion', 'Cantidad', 'Precio unitario', 'Total']],
    body: f.lineas.map((l, i) => [String(i + 1), pdfText(l.descripcion), String(l.cantidad), money(l.precioUnitario), money(l.total)]),
    theme: 'grid',
    margin: { left, right: 40, bottom: 60 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, lineColor: [203, 213, 225], lineWidth: 0.4, textColor: [30, 41, 59] },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 26, halign: 'center' }, 2: { halign: 'right', cellWidth: 60 }, 3: { halign: 'right', cellWidth: 90 }, 4: { halign: 'right', cellWidth: 90 } },
  });

  // --- Totales ---
  let ty = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  if (ty > h - 150) { doc.addPage(); ty = 60; }
  const boxX = right - 210;
  const row = (label: string, value: string, bold = false, yy = 0) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(15, 23, 42);
    doc.text(label, boxX, yy);
    doc.text(value, right, yy, { align: 'right' });
  };
  row('Base sin IVA', money(f.subtotalGravado), false, ty);
  row('IVA (12%)', money(f.iva), false, ty + 18);
  doc.setDrawColor(15, 23, 42);
  doc.line(boxX, ty + 26, right, ty + 26);
  row('TOTAL', money(f.total), true, ty + 44);

  if (anulada) {
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(pdfText(`ANULADA el ${fecha(f.fechaAnulacion)}: ${f.motivoAnulacion ?? ''}`), left, ty + 4, { maxWidth: boxX - left - 20 });
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(`UUID de anulacion: ${f.uuidAnulacion ?? ''}`, left, ty + 30, { maxWidth: boxX - left - 20 });
  }

  // --- Marca de agua y aviso ---
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.08 }));
    doc.setTextColor(anulada ? 185 : 29, anulada ? 28 : 78, anulada ? 28 : 216);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(80);
    doc.text(anulada ? 'ANULADA' : 'SIMULACION', w / 2, h / 2, { align: 'center', angle: 35 });
    doc.restoreGraphicsState();
  }
  drawPdfFooters(doc, 'Factura simulada: sin validez fiscal, no certificada por la SAT');
  doc.save(`factura-${f.serieFel}-${f.numeroFel}.pdf`);
}
