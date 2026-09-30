import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Ban } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal, TrazabilidadActionModal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { NotaCredito } from '@erp/contracts';
import { NotaCreditoForm } from './components/NotaCreditoForm';

const PAGE_SIZE = 10;
const money = (value: unknown) => `Q ${Number(value ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const NotasCreditoPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; nota?: NotaCredito } | null>(null);
  const [notaAEliminar, setNotaAEliminar] = useState<NotaCredito | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState<NotaCredito | null>(null);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<NotaCredito>(
    '/cxc/notas-credito',
    { page, limit: PAGE_SIZE, search },
  );

  const handleDelete = async () => {
    if (!notaAEliminar) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await apiClient.delete(`/cxc/notas-credito/${notaAEliminar.idNotaCredito}`);
      setNotaAEliminar(null);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo eliminar la nota de crédito');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notas de Crédito</h1>
          <p className="text-sm text-slate-500">Las notas se registran como saldo a favor y reducen la deuda únicamente al aplicarse.</p>
        </div>
        <Button icon={Plus} onClick={() => setModalState({ mode: 'create' })}>Nueva Nota</Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        Registrar una NC no modifica el saldo de la factura. El movimiento financiero ocurre en “Aplicación Nota Crédito”.
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Search}
          placeholder="Buscar cliente, serie, número, estado..."
          value={search}
          onChange={(e: any) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-md"
        />
      </div>

      {(error || actionError) && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error || actionError}
        </p>
      )}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="No hay notas de crédito registradas"
        columns={[
          { header: 'ID', accessorKey: 'idNotaCredito' },
          { header: 'Cliente', cell: ({ row }: any) => row.nombreCliente || `Cliente #${row.idCliente}` },
          { header: 'Serie', accessorKey: 'serie', cell: ({ value }: any) => value || '—' },
          { header: 'Número', accessorKey: 'numero', cell: ({ value }: any) => value || '—' },
          { header: 'Fecha', accessorKey: 'fecha', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Monto', accessorKey: 'monto', cell: ({ value }: any) => money(value) },
          { header: 'Aplicado', accessorKey: 'montoAplicado', cell: ({ value }: any) => money(value) },
          { header: 'Disponible', accessorKey: 'montoDisponible', cell: ({ value }: any) => money(value) },
          { header: 'Estado', cell: ({ row }: any) => <StatusBadge status={row.estado} /> },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => {
              const locked = Number(row.montoAplicado ?? 0) > 0.005 || ['APLICADA', 'ANULADA'].includes(String(row.estado).toUpperCase());
              const anulable = Number(row.montoAplicado ?? 0) <= 0.005 && String(row.estado).toUpperCase() !== 'ANULADA';
              return (
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => setModalState({ mode: 'edit', nota: row })}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title={locked ? 'Ver nota bloqueada por aplicaciones' : 'Editar nota'}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => anulable && setAAnular(row)}
                    disabled={!anulable}
                    className={`p-1.5 rounded-md transition-colors ${anulable ? 'text-slate-400 hover:text-amber-700 hover:bg-amber-50' : 'text-slate-300 cursor-not-allowed'}`}
                    title={anulable ? 'Anular nota' : 'Una nota con aplicaciones o ya anulada no se puede anular de nuevo'}
                  >
                    <Ban size={15} />
                  </button>
                  <button
                    onClick={() => !locked && setNotaAEliminar(row)}
                    disabled={locked}
                    className={`p-1.5 rounded-md transition-colors ${locked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                    title={locked ? 'Una nota aplicada no se elimina; debe reversarse' : 'Eliminar nota pendiente'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            },
          },
        ]}
        paginationProps={{
          currentPage: meta.page,
          totalPages: meta.totalPages,
          onPageChange: setPage,
          showingText: `Mostrando ${data.length} de ${meta.total} registros`,
        }}
      />

      <Modal
        isOpen={!!modalState}
        onClose={() => setModalState(null)}
        title={modalState?.mode === 'edit' ? 'Editar Nota de Crédito' : 'Nueva Nota de Crédito'}
      >
        <NotaCreditoForm
          nota={modalState?.nota}
          onCancel={() => setModalState(null)}
          onSuccess={() => { setModalState(null); refetch(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!notaAEliminar}
        onClose={() => setNotaAEliminar(null)}
        onConfirm={handleDelete}
        title="Eliminar nota pendiente"
        description="Solo se elimina físicamente una nota sin aplicaciones. Las notas aplicadas deben reversarse/anularse."
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />

      {aAnular && (
        <TrazabilidadActionModal
          title={`Anular nota de crédito #${aAnular.idNotaCredito}`}
          description="La nota quedará marcada como anulada de forma permanente. Solo se puede anular una nota sin aplicaciones vigentes."
          endpoint={`/cxc/notas-credito/${aAnular.idNotaCredito}/anular`}
          actionLabel="Anular"
          empleadoLabel="Empleado que anula"
          empleadoFieldName="idEmpleadoAnulacion"
          motivoLabel="Motivo de la anulación"
          motivoFieldName="motivoAnulacion"
          onClose={() => setAAnular(null)}
          onSuccess={() => { setAAnular(null); refetch(); }}
        />
      )}
    </div>
  );
};
