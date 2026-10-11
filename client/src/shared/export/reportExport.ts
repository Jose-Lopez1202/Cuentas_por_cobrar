/**
 * Exportación unificada de reportes: CSV, Excel (.xlsx) y PDF con el mismo
 * contenido. Cada reporte describe UNA vez qué mostrar (ReportSpec) y de aquí
 * salen los tres formatos. jsPDF y ExcelJS se cargan solo al exportar para no
 * engordar el bundle inicial.
 */
import { downloadCsv } from '../csv';

export type ColumnType = 'text' | 'money' | 'int' | 'percent';

export interface ExportColumn {
  header: string;
  type?: ColumnType;
}

export type Cell = string | number | null | undefined;

export interface ExportSection {
  title: string;
  columns: ExportColumn[];
  rows: Cell[][];
  /** Fila de totales (misma cantidad de celdas que columns). */
  totals?: Cell[];
}

export interface ReportSpec {
  /** Nombre del archivo sin extensión. */
  filename: string;
  title: string;
  /** Línea bajo el título: período, filtros, etc. */
  subtitle?: string;
  /** Indicadores destacados: [etiqueta, valor ya formateado]. */
  summary?: Array<[string, string]>;
  sections: ExportSection[];
  orientation?: 'portrait' | 'landscape';
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const BRAND = { r: 29, g: 78, b: 216 }; // blue-700
const moneyFmt = (v: number) => `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatCell(value: Cell, type: ColumnType = 'text'): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  if (type === 'money') return moneyFmt(value);
  if (type === 'percent') return `${value.toLocaleString('es-GT', { maximumFractionDigits: 1 })} %`;
  if (type === 'int') return value.toLocaleString('es-GT', { maximumFractionDigits: 0 });
  return String(value);
}

/** Helvetica de jsPDF solo cubre Latin-1: cambia los símbolos que no cubre. */
export const pdfText = (text: string): string =>
  text.replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\u0000-ÿ]/g, '');

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const generatedAt = () => new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' });

// --- CSV -------------------------------------------------------------------

function exportCsv(spec: ReportSpec) {
  const rows: Array<Array<Cell>> = [[spec.title]];
  if (spec.subtitle) rows.push([spec.subtitle]);
  spec.summary?.forEach(([label, value]) => rows.push([label, value]));
  spec.sections.forEach((section) => {
    rows.push([], [section.title], section.columns.map((c) => c.header));
    section.rows.forEach((row) => rows.push(row.map((cell, i) => (typeof cell === 'number' && section.columns[i]?.type === 'money' ? cell.toFixed(2) : cell))));
    if (section.totals) rows.push(section.totals.map((cell, i) => (typeof cell === 'number' && section.columns[i]?.type === 'money' ? cell.toFixed(2) : cell)));
  });
  downloadCsv(`${spec.filename}.csv`, rows);
}

// --- Excel -----------------------------------------------------------------

async function exportXlsx(spec: ReportSpec) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ERP Universitario - Cuentas por Cobrar';
  wb.created = new Date();

  const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1D4ED8' } };
  const border = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };
  const fmtFor = (type?: ColumnType) =>
    type === 'money' ? '"Q" #,##0.00' : type === 'int' ? '#,##0' : type === 'percent' ? '0.0"%"' : undefined;

  const sheetName = (name: string, used: Set<string>) => {
    let base = name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || 'Hoja';
    let n = base; let i = 2;
    while (used.has(n.toLowerCase())) n = `${base.slice(0, 25)} ${i++}`;
    used.add(n.toLowerCase());
    return n;
  };
  const used = new Set<string>();

  const titleBlock = (ws: import('exceljs').Worksheet, span: number) => {
    ws.mergeCells(1, 1, 1, Math.max(span, 2));
    ws.getCell(1, 1).value = spec.title;
    ws.getCell(1, 1).font = { bold: true, size: 15, color: { argb: 'FF1D4ED8' } };
    ws.mergeCells(2, 1, 2, Math.max(span, 2));
    ws.getCell(2, 1).value = [spec.subtitle, `Generado: ${generatedAt()}`].filter(Boolean).join('  |  ');
    ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF64748B' } };
  };

  if (spec.summary?.length) {
    const ws = wb.addWorksheet(sheetName('Resumen', used));
    titleBlock(ws, 2);
    spec.summary.forEach(([label, value], i) => {
      const r = 4 + i;
      ws.getCell(r, 1).value = label; ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 2).value = value; ws.getCell(r, 2).alignment = { horizontal: 'right' };
    });
    ws.getColumn(1).width = 34; ws.getColumn(2).width = 28;
  }

  spec.sections.forEach((section) => {
    const ws = wb.addWorksheet(sheetName(section.title, used));
    titleBlock(ws, section.columns.length);
    ws.getCell(3, 1).value = section.title;
    ws.getCell(3, 1).font = { bold: true, size: 12 };

    const headerRow = ws.getRow(5);
    section.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = headerFill;
      cell.alignment = { horizontal: col.type && col.type !== 'text' ? 'right' : 'left', vertical: 'middle', wrapText: true };
    });
    headerRow.height = 22;

    const writeRow = (rowIndex: number, values: Cell[], bold = false) => {
      const row = ws.getRow(rowIndex);
      values.forEach((value, i) => {
        const col = section.columns[i];
        const cell = row.getCell(i + 1);
        cell.value = value === undefined ? null : value;
        const fmt = typeof value === 'number' ? fmtFor(col?.type) : undefined;
        if (fmt) cell.numFmt = fmt;
        if (typeof value === 'number') cell.alignment = { horizontal: 'right' };
        cell.border = { top: border, bottom: border, left: border, right: border };
        if (bold) { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; }
      });
    };
    section.rows.forEach((values, i) => writeRow(6 + i, values));
    if (section.totals) writeRow(6 + section.rows.length, section.totals, true);

    section.columns.forEach((col, i) => {
      const longest = Math.max(col.header.length, ...section.rows.map((r) => formatCell(r[i], col.type).length), section.totals ? formatCell(section.totals[i], col.type).length : 0);
      ws.getColumn(i + 1).width = Math.min(48, Math.max(11, longest + 3));
    });
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${spec.filename}.xlsx`);
}

// --- PDF -------------------------------------------------------------------

export async function newPdfDocument(orientation: 'portrait' | 'landscape' = 'portrait') {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
  return { doc, autoTable };
}

/** Pie de página común: sistema, fecha de generación y número de página. */
export function drawPdfFooters(doc: import('jspdf').jsPDF, leftText = 'ERP Universitario - Cuentas por Cobrar') {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.line(40, h - 34, w - 40, h - 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfText(`${leftText}  |  Generado ${generatedAt()}`), 40, h - 20);
    doc.text(`Pagina ${i} de ${pages}`, w - 40, h - 20, { align: 'right' });
  }
}

async function exportPdf(spec: ReportSpec) {
  const orientation = spec.orientation ?? (spec.sections.some((s) => s.columns.length > 6) ? 'landscape' : 'portrait');
  const { doc, autoTable } = await newPdfDocument(orientation);
  const w = doc.internal.pageSize.getWidth();

  // Banda de título
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, w, 62, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(pdfText(spec.title), 40, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  if (spec.subtitle) doc.text(pdfText(spec.subtitle), 40, 48);

  let y = 82;

  // Indicadores
  if (spec.summary?.length) {
    const perRow = orientation === 'landscape' ? 5 : 3;
    const gap = 10;
    const boxW = (w - 80 - gap * (perRow - 1)) / perRow;
    spec.summary.forEach(([label, value], i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = 40 + col * (boxW + gap);
      const by = y + row * 46;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, by, boxW, 38, 4, 4, 'FD');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfText(label.toUpperCase()), x + 8, by + 14, { maxWidth: boxW - 16 });
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text(pdfText(value), x + 8, by + 30, { maxWidth: boxW - 16 });
    });
    y += Math.ceil(spec.summary.length / perRow) * 46 + 14;
  }

  spec.sections.forEach((section) => {
    const pageH = doc.internal.pageSize.getHeight();
    if (y > pageH - 120) { doc.addPage(); y = 50; }
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(pdfText(section.title), 40, y);

    const body = section.rows.map((row) => row.map((cell, i) => pdfText(formatCell(cell, section.columns[i]?.type))));
    const foot = section.totals ? [section.totals.map((cell, i) => pdfText(formatCell(cell, section.columns[i]?.type)))] : undefined;
    autoTable(doc, {
      startY: y + 8,
      head: [section.columns.map((c) => pdfText(c.header))],
      body: body.length ? body : [[{ content: 'Sin datos en el periodo', colSpan: section.columns.length, styles: { halign: 'center', textColor: [100, 116, 139] } }] as never],
      foot,
      showFoot: 'lastPage',
      theme: 'grid',
      margin: { left: 40, right: 40, bottom: 44 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, lineColor: [203, 213, 225], lineWidth: 0.4, textColor: [30, 41, 59] },
      headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(section.columns.map((c, i) => [i, { halign: c.type && c.type !== 'text' ? 'right' : 'left' }])),
    });
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 24;
  });

  drawPdfFooters(doc);
  doc.save(`${spec.filename}.pdf`);
}

export async function exportReport(format: ExportFormat, spec: ReportSpec): Promise<void> {
  if (format === 'csv') return exportCsv(spec);
  if (format === 'xlsx') return exportXlsx(spec);
  return exportPdf(spec);
}
