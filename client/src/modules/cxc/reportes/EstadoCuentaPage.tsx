import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { DataTable, Select, StatusBadge } from '../../../shared/ui-kit';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { CatalogoOption, EstadoCuenta } from '@erp/contracts';

const money = (value: unknown) =>
  `Q ${Number(value ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const EstadoCuentaPage = () => {
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [idCliente, setIdCliente] = useState('');
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuenta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    if (!idCliente) {
      setEstadoCuenta(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    apiClient
      .get<EstadoCuenta>(`/cxc/reportes/estado-cuenta/${idCliente}`)
      .then(setEstadoCuenta)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el estado de cuenta'))
      .finally(() => setIsLoading(false));
  }, [idCliente]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Estado de Cuenta</h1>
        <p className="text-sm text-slate-500">Historial completo de documentos de un cliente, con su saldo actual y condición de vencimiento.</p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <Select
          label="Cliente"
          icon={Search}
          value={idCliente}
          onChange={(e: any) => setIdCliente(e.target.value)}
          options={clientes.map((c) => ({ value: c.id, label: c.label }))}
          placeholder="Selecciona un cliente"
          className="max-w-md"
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {estadoCuenta && (
        <>
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{estadoCuenta.nombreCliente}</h2>
                <p className="text-sm text-slate-500 mt-0.5">NIT: {estadoCuenta.nitCliente ?? '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100 text-sm">
              <div>
                <p className="text-slate-400 text-xs uppercase font-semibold">Total facturado</p>
                <p className="font-bold text-slate-900 mt-1">{money(estadoCuenta.totalFacturado)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase font-semibold">Saldo pendiente</p>
                <p className="font-bold text-slate-900 mt-1">{money(estadoCuenta.totalSaldoPendiente)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase font-semibold">Saldo vencido</p>
                <p className={`font-bold mt-1 ${estadoCuenta.totalVencido > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {money(estadoCuenta.totalVencido)}
                </p>
              </div>
            </div>
          </div>

          <DataTable
            isLoading={isLoading}
            data={estadoCuenta.documentos}
            emptyText="Este cliente no tiene documentos registrados"
            columns={[
              { header: 'Documento', accessorKey: 'referenciaDocumento' },
              { header: 'Tipo', accessorKey: 'nombreTipoDocumento', cell: ({ value }: any) => value ?? '—' },
              { header: 'Fecha', accessorKey: 'fechaDocumento', cell: ({ value }: any) => formatDateGT(value) },
              { header: 'Vencimiento', accessorKey: 'fechaVencimiento', cell: ({ value }: any) => formatDateGT(value) },
              { header: 'Total', accessorKey: 'total', cell: ({ value }: any) => money(value) },
              { header: 'Saldo', accessorKey: 'saldo', cell: ({ value }: any) => money(value) },
              {
                header: 'Estado',
                cell: ({ row }: any) => (
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={row.estado} />
                    {row.condicion === 'VENCIDA' && <StatusBadge status="VENCIDA" />}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      {!idCliente && !error && (
        <p className="text-sm text-slate-400 text-center py-12">Selecciona un cliente para ver su estado de cuenta.</p>
      )}
    </div>
  );
};
