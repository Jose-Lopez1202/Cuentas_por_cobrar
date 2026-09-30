import { useState } from 'react';
import { Plus, Search, Undo2 } from 'lucide-react';
import { DataTable, Button, TextInput, StatusBadge } from '../../../shared/ui-kit';
import { Modal, TrazabilidadActionModal } from '../../../shared/components';
import { usePaginatedList } from '../../../shared/hooks';
import { formatDateGT } from '../../../shared/date';
import type { AplicacionAnticipo } from '@erp/contracts';
import { AplicacionAnticipoForm } from './components/AplicacionAnticipoForm';

const money = (value: unknown) =>
  `Q ${Number(value ?? 0).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const AplicacionesAnticipoPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [aReversar, setAReversar] = useState<AplicacionAnticipo | null>(null);

  const { data, meta, isLoading, error, refetch } =
    usePaginatedList<AplicacionAnticipo>('/cxc/aplicaciones-anticipo', {
      page,
      limit: 10,
      search,
    });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aplicaciones de Anticipo</h1>
          <p className="text-sm text-slate-500">
            Aplicar un anticipo reduce el saldo del documento y su propio disponible dentro de una transacción segura.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setModal(true)}>
          Nueva Aplicación
        </Button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Una aplicación confirmada es inmutable. Para corregirla, reversa la aplicación con motivo y trazabilidad.
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <TextInput
          icon={Search}
          placeholder="Buscar por anticipo, documento o ID..."
          value={search}
          onChange={(e: any) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-md"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="No hay aplicaciones de anticipo registradas"
        columns={[
          { header: 'ID', accessorKey: 'idAplicacionAnticipo' },
          { header: 'Anticipo', cell: ({ row }: any) => `Anticipo #${row.idAnticipo}` },
          { header: 'Documento', cell: ({ row }: any) => `Documento #${row.idDocumento}` },
          {
            header: 'Fecha',
            accessorKey: 'fechaAplicacion',
            cell: ({ value }: any) => formatDateGT(value),
          },
          {
            header: 'Monto aplicado',
            accessorKey: 'montoAplicado',
            cell: ({ value }: any) => money(value),
          },
          {
            header: 'Empleado',
            cell: ({ row }: any) => row.nombreEmpleado || (row.idEmpleado ? `#${row.idEmpleado}` : '—'),
          },
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

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Nueva Aplicación de Anticipo">
        <AplicacionAnticipoForm
          item={null}
          onCancel={() => setModal(false)}
          onSuccess={() => {
            setModal(false);
            refetch();
          }}
        />
      </Modal>

      {aReversar && (
        <TrazabilidadActionModal
          title={`Reversar aplicación #${aReversar.idAplicacionAnticipo}`}
          description={`Se le devolverá ${money(aReversar.montoAplicado)} al saldo del documento y al disponible del anticipo.`}
          endpoint={`/cxc/aplicaciones-anticipo/${aReversar.idAplicacionAnticipo}/reversar`}
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
