import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Ban } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal, TrazabilidadActionModal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { Anticipo } from '@erp/contracts';
import { AnticipoForm } from './components/AnticipoForm';

const money = (value: unknown) =>
  `Q ${Number(value ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const AnticiposPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; item?: Anticipo } | null>(null);
  const [del, setDel] = useState<Anticipo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState<Anticipo | null>(null);
  const { data, meta, isLoading, error, refetch } = usePaginatedList<Anticipo>('/cxc/anticipos', { page, limit: 10, search });

  const remove = async () => {
    if (!del) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/cxc/anticipos/${del.idAnticipo}`);
      setDel(null);
      refetch();
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : 'No se pudo eliminar el anticipo');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Anticipos</h1>
          <p className="text-sm text-slate-500">Un anticipo disponible se aplica contra un documento; para corregirlo se reversa la aplicación o se anula con trazabilidad.</p>
        </div>
        <Button icon={Plus} onClick={() => setModal({ mode: 'create' })}>Nuevo</Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <TextInput icon={Search} placeholder="Buscar..." value={search} onChange={(e: any) => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
      </div>

      {(error || deleteError) && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error || deleteError}</p>}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="No hay registros"
        columns={[
          { header: 'ID', accessorKey: 'idAnticipo' },
          { header: 'Cliente', accessorKey: 'nombreCliente' },
          { header: 'Pago', cell: ({ row }: any) => (row.idPago ? row.referenciaPago || `Pago #${row.idPago}` : 'Sin pago') },
          { header: 'Original', accessorKey: 'montoOriginal', cell: ({ value }: any) => money(value) },
          { header: 'Disponible', accessorKey: 'montoDisponible', cell: ({ value }: any) => money(value) },
          { header: 'Fecha', accessorKey: 'fecha', cell: ({ value }: any) => formatDateGT(value) },
          {
            header: 'Estado',
            cell: ({ row }: any) => (
              <div className="flex flex-col gap-0.5">
                <StatusBadge status={row.estado} />
                {row.estado === 'CANCELADO' && row.nombreEmpleadoAnulacion && (
                  <span className="text-[11px] text-slate-400">por {row.nombreEmpleadoAnulacion}</span>
                )}
              </div>
            ),
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => {
              const anulable = row.estado === 'DISPONIBLE';
              return (
                <div className="flex justify-end gap-1">
                  <button onClick={() => setModal({ mode: 'edit', item: row })} className="p-1.5 text-slate-400 hover:text-blue-600" title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => anulable && setAAnular(row)}
                    disabled={!anulable}
                    className={`p-1.5 rounded-md ${anulable ? 'text-slate-400 hover:text-amber-700 hover:bg-amber-50' : 'text-slate-300 cursor-not-allowed'}`}
                    title={anulable ? 'Anular anticipo' : 'Solo un anticipo disponible y sin aplicaciones se puede anular'}
                  >
                    <Ban size={15} />
                  </button>
                  <button onClick={() => setDel(row)} className="p-1.5 text-slate-400 hover:text-red-600" title="Eliminar">
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

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Editar' : 'Nuevo registro'}>
        <AnticipoForm item={modal?.item} onCancel={() => setModal(null)} onSuccess={() => { setModal(null); refetch(); }} />
      </Modal>

      <ConfirmDialog
        isOpen={!!del}
        onClose={() => { setDel(null); setDeleteError(null); }}
        onConfirm={remove}
        title="Eliminar registro"
        description="Solo se elimina físicamente un anticipo disponible sin aplicaciones ni anulación. ¿Seguro que deseas eliminarlo?"
        confirmLabel="Eliminar"
        isLoading={deleting}
      />

      {aAnular && (
        <TrazabilidadActionModal
          title={`Anular anticipo #${aAnular.idAnticipo}`}
          description="El anticipo quedará marcado como anulado de forma permanente y su disponible pasará a Q 0.00. Solo se puede anular un anticipo sin aplicaciones vigentes."
          endpoint={`/cxc/anticipos/${aAnular.idAnticipo}/anular`}
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
