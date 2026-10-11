import { useEffect, useState } from 'react';
import { DataTable, Select, StatusBadge } from '../../../shared/ui-kit';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import { moneyGT } from '../../../shared/csv';
import type { LibroVentasReporte } from '@erp/contracts';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const LibroVentasPage = () => {
  const hoy = new Date();
  const [anio, setAnio] = useState(String(hoy.getFullYear()));
  const [mes, setMes] = useState(String(hoy.getMonth() + 1));
  const [reporte, setReporte] = useState<LibroVentasReporte | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true); setError(null);
    apiClient.get<LibroVentasReporte>(`/cxc/reportes/libro-ventas?anio=${anio}&mes=${mes}`)
      .then(setReporte)
      .catch((err) => { setReporte(null); setError(err instanceof ApiError ? err.message : 'No se pudo cargar el libro de ventas'); })
      .finally(() => setIsLoading(false));
  }, [anio, mes]);

  const anios = Array.from({ length: 6 }, (_, i) => String(hoy.getFullYear() - i));

  const getSpec = (): ReportSpec | null => {
    if (!reporte) return null;
    const t = reporte.totales;
    return {
      filename: `libro-ventas-${anio}-${mes.padStart(2, '0')}`,
      title: 'Libro de Ventas',
      subtitle: `${MESES[Number(mes) - 1]} ${anio}  |  Facturas FEL emitidas`,
      orientation: 'landscape',
      summary: [['Facturas', String(t.facturas)], ['Anuladas', String(t.anuladas)], ['Base gravada', moneyGT(t.baseGravada)], ['IVA debito fiscal', moneyGT(t.iva)], ['Total ventas', moneyGT(t.total)]],
      sections: [{
        title: 'Facturas del mes',
        columns: [{ header: 'Fecha' }, { header: 'Serie-Numero' }, { header: 'NIT' }, { header: 'Cliente' }, { header: 'Estado' }, { header: 'Base gravada', type: 'money' }, { header: 'IVA', type: 'money' }, { header: 'Total', type: 'money' }],
        rows: reporte.filas.map((f) => [formatDateGT(f.fecha), `${f.serie}-${f.numero}`, f.nitReceptor, f.nombreReceptor, f.estado, f.baseGravada, f.iva, f.total]),
        totals: ['TOTALES', '', '', '', '', t.baseGravada, t.iva, t.total],
      }],
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Libro de Ventas</h1>
          <p className="text-sm text-slate-500">Facturas FEL emitidas en el mes, con base gravada e IVA. Las anuladas se listan con valores en cero.</p>
        </div>
        <ExportMenu getSpec={getSpec} disabledReason={!reporte || reporte.filas.length === 0 ? 'No hay facturas en este mes para exportar' : undefined} />
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm grid grid-cols-2 gap-4 max-w-md">
        <Select label="Mes" value={mes} placeholder="" onChange={(e: any) => setMes(e.target.value)}
          options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))} helperText="Mes del libro." />
        <Select label="Año" value={anio} placeholder="" onChange={(e: any) => setAnio(e.target.value)}
          options={anios.map((a) => ({ value: a, label: a }))} helperText="Año fiscal." />
      </div>

      {error && <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {reporte && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ['Facturas', String(reporte.totales.facturas)],
            ['Anuladas', String(reporte.totales.anuladas)],
            ['Base gravada', moneyGT(reporte.totales.baseGravada)],
            ['IVA débito fiscal', moneyGT(reporte.totales.iva)],
            ['Total ventas', moneyGT(reporte.totales.total)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      <DataTable
        isLoading={isLoading}
        data={reporte?.filas ?? []}
        emptyText="No hay facturas emitidas en este mes"
        columns={[
          { header: 'Fecha', accessorKey: 'fecha', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Serie-Número', cell: ({ row }: any) => `${row.serie}-${row.numero}` },
          { header: 'NIT', accessorKey: 'nitReceptor' },
          { header: 'Cliente', accessorKey: 'nombreReceptor' },
          { header: 'Estado', cell: ({ row }: any) => <StatusBadge status={row.estado} /> },
          { header: 'Base gravada', accessorKey: 'baseGravada', align: 'right', cell: ({ value }: any) => moneyGT(value) },
          { header: 'IVA', accessorKey: 'iva', align: 'right', cell: ({ value }: any) => moneyGT(value) },
          { header: 'Total', accessorKey: 'total', align: 'right', cell: ({ value }: any) => <span className="font-semibold">{moneyGT(value)}</span> },
        ]}
      />
    </div>
  );
};
