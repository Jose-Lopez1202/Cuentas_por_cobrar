import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, FileType2 } from 'lucide-react';
import { Button } from '../ui-kit';
import { exportReport, type ExportFormat, type ReportSpec } from '../export/reportExport';

interface ExportMenuProps {
  /** Devuelve el contenido a exportar, o null si todavía no hay datos. */
  getSpec: () => ReportSpec | null;
  /** Motivo por el que no se puede exportar (se muestra como ayuda). */
  disabledReason?: string;
}

const OPTIONS: Array<{ format: ExportFormat; label: string; hint: string; icon: typeof FileText }> = [
  { format: 'pdf', label: 'PDF', hint: 'Documento listo para imprimir', icon: FileText },
  { format: 'xlsx', label: 'Excel (.xlsx)', hint: 'Una hoja por tabla, con formato', icon: FileSpreadsheet },
  { format: 'csv', label: 'CSV', hint: 'Texto plano para otros sistemas', icon: FileType2 },
];

/** Menú único "Exportar" para todos los reportes: PDF, Excel y CSV. */
export const ExportMenu = ({ getSpec, disabledReason }: ExportMenuProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const disabled = Boolean(disabledReason);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const run = async (format: ExportFormat) => {
    const spec = getSpec();
    if (!spec) return;
    setBusy(format); setError(null); setOpen(false);
    try {
      await exportReport(format, spec);
    } catch (err) {
      setError(err instanceof Error ? `No se pudo exportar: ${err.message}` : 'No se pudo exportar el reporte');
    } finally { setBusy(null); }
  };

  return (
    <div className="relative inline-flex flex-col items-end gap-1" ref={ref}>
      <Button variant="secondary" icon={Download} disabled={disabled || busy !== null} onClick={() => setOpen((o) => !o)}
        title={disabledReason ?? 'Exportar el reporte'} aria-haspopup="menu" aria-expanded={open}>
        {busy ? 'Generando...' : <span className="inline-flex items-center gap-1">Exportar <ChevronDown size={14} /></span>}
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-30 w-64 rounded-lg border border-slate-200 bg-white shadow-lg p-1">
          {OPTIONS.map(({ format, label, hint, icon: Icon }) => (
            <button key={format} type="button" role="menuitem" onClick={() => run(format)}
              className="w-full flex items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-50">
              <Icon size={18} className="mt-0.5 text-slate-500" />
              <span><span className="block text-sm font-semibold text-slate-900">{label}</span><span className="block text-xs text-slate-500">{hint}</span></span>
            </button>
          ))}
        </div>
      )}
      {disabledReason && <span className="text-[11px] text-slate-500 max-w-[16rem] text-right">{disabledReason}</span>}
      {error && <span role="alert" className="text-xs text-red-600 font-medium max-w-[16rem] text-right">{error}</span>}
    </div>
  );
};
