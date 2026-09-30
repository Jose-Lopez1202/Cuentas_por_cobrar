import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Ban } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal, TrazabilidadActionModal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { Pago } from '@erp/contracts';
import { PagoForm } from './components/PagoForm';

const money = (value: unknown) => `Q ${Number(value ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PagosPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; item?: Pago } | null>(null);
  const [del, setDel] = useState<Pago | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState<Pago | null>(null);
  const { data, meta, isLoading, error, refetch } = usePaginatedList<Pago>('/cxc/pagos', { page, limit: 10, search });

  const remove = async () => {
    if (!del) return;
    setDeleting(true);
    setActionError(null);
    try {
      await apiClient.delete(`/cxc/pagos/${del.idPago}`);
      setDel(null);
      refetch();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'No se pudo eliminar el pago');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pagos</h1>
          <p className="text-sm text-slate-500">Registro de pagos recibidos. El saldo de una factura cambia únicamente al aplicar el pago.</p>
        </div>
        <Button icon={Plus} onClick={() => setModal({ mode: 'create' })}>Nuevo Pago</Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        Un pago registrado puede permanecer sin aplicar o en cuenta. La aplicación es la operación que reduce el saldo del documento.
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <TextInput
          icon={Search}
          placeholder="Buscar cliente, referencia, estado o ID..."
          value={search}
          onChange={(e: any) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-md"
        />
      </div>

      {(error || actionError) && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error || actionError}</p>}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="No hay pagos registrados"
        columns={[
          { header: 'ID', accessorKey: 'idPago' },
          { header: 'Cliente', cell: ({ row }: any) => row.nombreCliente || `Cliente #${row.idCliente}` },
          { header: 'Fecha', accessorKey: 'fechaPago', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Monto', accessorKey: 'monto', cell: ({ value }: any) => money(value) },
          { header: 'Aplicado', accessorKey: 'montoAplicado', cell: ({ value }: any) => money(value) },
          { header: 'Disponible', accessorKey: 'montoDisponible', cell: ({ value }: any) => money(value) },
          { header: 'Referencia', accessorKey: 'numeroReferencia', cell: ({ value }: any) => value || '—' },
          { header: 'Estado', accessorKey: 'estado', cell: ({ value }: any) => value ? <StatusBadge status={value} /> : '—' },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => {
              const locked = Number(row.montoAplicado ?? 0) > 0.005 || ['APLICADO', 'REVERSADO', 'ANULADO'].includes(String(row.estado).toUpperCase());
              const anulable = Number(row.montoAplicado ?? 0) <= 0.005 && String(row.estado).toUpperCase() !== 'ANULADO';
              return (
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => setModal({ mode: 'edit', item: row })}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                    title={locked ? 'Ver pago bloqueado por movimientos' : 'Editar pago'}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => anulable && setAAnular(row)}
                    disabled={!anulable}
                    className={`p-1.5 rounded-md ${anulable ? 'text-slate-400 hover:text-amber-700 hover:bg-amber-50' : 'text-slate-300 cursor-not-allowed'}`}
                    title={anulable ? 'Anular pago' : 'Un pago con aplicaciones o ya anulado no se puede anular de nuevo'}
                  >
                    <Ban size={15} />
                  </button>
                  <button
                    onClick={() => !locked && setDel(row)}
                    disabled={locked}
                    className={`p-1.5 rounded-md ${locked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                    title={locked ? 'Un pago aplicado no se elimina; debe reversarse' : 'Eliminar pago sin aplicar'}
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

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Editar Pago' : 'Nuevo Pago'}>
        <PagoForm pago={modal?.item} onCancel={() => setModal(null)} onSuccess={() => { setModal(null); refetch(); }} />
      </Modal>

      <ConfirmDialog
        isOpen={!!del}
        onClose={() => setDel(null)}
        onConfirm={remove}
        title="Eliminar pago sin aplicar"
        description="Solo se elimina físicamente un pago que no tenga aplicaciones. Los pagos aplicados deben reversarse."
        confirmLabel="Eliminar"
        isLoading={deleting}
      />

      {aAnular && (
        <TrazabilidadActionModal
          title={`Anular pago #${aAnular.idPago}`}
          description="El pago quedará marcado como anulado de forma permanente. Solo se puede anular un pago sin aplicaciones vigentes."
          endpoint={`/cxc/pagos/${aAnular.idPago}/anular`}
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
