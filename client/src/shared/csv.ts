/** Descarga un arreglo de filas como CSV (UTF-8 con BOM para que Excel respete tildes). */
export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>): void {
  const escape = (cell: string | number | null | undefined) => {
    const text = String(cell ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const moneyGT = (value: unknown): string =>
  `Q ${Number(value ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
