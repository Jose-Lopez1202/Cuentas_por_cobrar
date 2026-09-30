import { useEffect, useState } from 'react';
import { DataTable } from '../../../shared/ui-kit';
import { apiClient, ApiError } from '../../../shared/api';
import type { AntiguedadSaldosReporte } from '@erp/contracts';

const money = (value: unknown) =>
  `Q ${Number(value ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const AntiguedadSaldosPage = () => {
  const [reporte, setReporte] = useState<AntiguedadSaldosReporte | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    apiClient
      .get<AntiguedadSaldosReporte>('/cxc/reportes/antiguedad-saldos')
      .then(setReporte)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el reporte'))
      .finally(() => setIsLoading(false));
  }, []);

  const totales = reporte?.totales;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Antigüedad de Saldos</h1>
        <p className="text-sm text-slate-500">
          Saldo pendiente de cada cliente, agrupado por cuántos días lleva vencido. Solo incluye documentos con saldo, sin contar pagados ni anulados.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {totales && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[
            { label: 'Corriente', value: totales.corriente, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { label: '1-30 días', value: totales.dias1a30, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
            { label: '31-60 días', value: totales.dias31a60, tone: 'text-orange-700 bg-orange-50 border-orange-200' },
            { label: '61-90 días', value: totales.dias61a90, tone: 'text-red-700 bg-red-50 border-red-200' },
            { label: '+90 días', value: totales.mas90, tone: 'text-red-800 bg-red-100 border-red-300' },
            { label: 'Total cartera', value: totales.total, tone: 'text-slate-900 bg-slate-100 border-slate-300' },
          ].map((bucket) => (
            <div key={bucket.label} className={`rounded-lg border px-3 py-2.5 ${bucket.tone}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{bucket.label}</p>
              <p className="text-sm font-bold mt-0.5">{money(bucket.value)}</p>
            </div>
          ))}
        </div>
      )}

      <DataTable
        isLoading={isLoading}
        data={reporte?.clientes ?? []}
        emptyText="No hay saldos pendientes"
        columns={[
          { header: 'Cliente', accessorKey: 'nombreCliente' },
          { header: 'Corriente', accessorKey: 'corriente', align: 'right', cell: ({ value }: any) => money(value) },
          { header: '1-30 días', accessorKey: 'dias1a30', align: 'right', cell: ({ value }: any) => money(value) },
          { header: '31-60 días', accessorKey: 'dias31a60', align: 'right', cell: ({ value }: any) => money(value) },
          { header: '61-90 días', accessorKey: 'dias61a90', align: 'right', cell: ({ value }: any) => money(value) },
          { header: '+90 días', accessorKey: 'mas90', align: 'right', cell: ({ value }: any) => (Number(value) > 0 ? <span className="text-red-600 font-semibold">{money(value)}</span> : money(value)) },
          { header: 'Total', accessorKey: 'total', align: 'right', cell: ({ value }: any) => <span className="font-semibold">{money(value)}</span> },
        ]}
      />
    </div>
  );
};
