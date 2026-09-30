import { useState } from 'react';
import { Plus, Search, Undo2 } from 'lucide-react';
import { DataTable, Button, TextInput, StatusBadge } from '../../../shared/ui-kit';
import { Modal, TrazabilidadActionModal } from '../../../shared/components';
import { usePaginatedList } from '../../../shared/hooks';
import { formatDateGT } from '../../../shared/date';
import type { AplicacionNotaCredito } from '@erp/contracts';
import { AplicacionNotaCreditoForm } from './components/AplicacionNotaCreditoForm';

const PAGE_SIZE = 10;
const money = (value: unknown) => `Q ${Number(value ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const AplicacionesNotaCreditoPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [aReversar, setAReversar] = useState<AplicacionNotaCredito | null>(null);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<AplicacionNotaCredito>(
    '/cxc/aplicaciones-nota-credito',
    { page, limit: PAGE_SIZE, search },
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aplicaciones de Nota de Crédito</h1>
          <p className="text-sm text-slate-500">La NC reduce el saldo únicamente cuando se aplica al documento.</p>
        </div>
        <Button icon={Plus} onClick={() => setOpen(true)}>Nueva Aplicación</Button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Una aplicación confirmada es inmutable. Para corregirla, reversa la aplicación con motivo y trazabilidad.
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Search}
          placeholder="Buscar aplicación..."
          value={search}
          onChange={(e: any) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="No hay aplicaciones de notas de crédito registradas"
        columns={[
          { header: 'ID', accessorKey: 'idAplicacionNc' },
          { header: 'Nota de Crédito', cell: ({ row }: any) => `NC #${row.idNotaCredito}` },
          { header: 'Documento', cell: ({ row }: any) => `Documento #${row.idDocumento}` },
          { header: 'Monto Aplicado', accessorKey: 'montoAplicado', cell: ({ value }: any) => money(value) },
          { header: 'Fecha de Aplicación', accessorKey: 'fechaAplicacion', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Empleado', cell: ({ row }: any) => row.nombreEmpleado || (row.idEmpleado ? `#${row.idEmpleado}` : '—') },
          {
            header: 'Estado',
            cell: ({ row }: any) => (
              <div className="flex flex-col gap-0.5">
                <StatusBadge status={row.estado} />
                {row.estado === 'REVERSADA' && row.nombreEmpleadoReversa && (
                  <span className="text-[11px] text-slate-400">por {row.nombreEmpleadoReversa}</span>
                )}
              </div>
            ),
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) =>
              row.estado === 'CONFIRMADA' ? (
                <button
                  onClick={() => setAReversar(row)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md transition-colors"
                >
                  <Undo2 size={13} /> Reversar
                </button>
              ) : null,
          },
        ]}
        paginationProps={{
          currentPage: meta.page,
          totalPages: meta.totalPages,
          onPageChange: setPage,
          showingText: `Mostrando ${data.length} de ${meta.total} registros`,
        }}
      />

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Nueva Aplicación de Nota de Crédito">
        <AplicacionNotaCreditoForm
          aplicacion={null}
          onCancel={() => setOpen(false)}
          onSuccess={() => { setOpen(false); refetch(); }}
        />
      </Modal>

      {aReversar && (
        <TrazabilidadActionModal
          title={`Reversar aplicación #${aReversar.idAplicacionNc}`}
          description={`Se le devolverá ${money(aReversar.montoAplicado)} al saldo del documento y al disponible de la nota de crédito.`}
          endpoint={`/cxc/aplicaciones-nota-credito/${aReversar.idAplicacionNc}/reversar`}
          actionLabel="Reversar"
          empleadoLabel="Empleado que reversa"
          empleadoFieldName="idEmpleadoReversa"
          motivoLabel="Motivo de la reversa"
          motivoFieldName="motivoReversa"
          onClose={() => setAReversar(null)}
          onSuccess={() => { setAReversar(null); refetch(); }}
        />
      )}
    </div>
  );
};
