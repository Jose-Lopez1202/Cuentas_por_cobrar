import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, AlertTriangle } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { PromesaPago } from '@erp/contracts';
import { PromesaPagoForm } from './components/PromesaPagoForm';

const PAGE_SIZE = 10;

export const PromesasPagoPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; promesa?: PromesaPago } | null>(null);
  const [promesaAEliminar, setPromesaAEliminar] = useState<PromesaPago | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<PromesaPago>(
    '/cxc/promesas-pago',
    { page, limit: PAGE_SIZE, search },
  );

  const handleDelete = async () => {
    if (!promesaAEliminar) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/cxc/promesas-pago/${promesaAEliminar.idPromesa}`);
      setPromesaAEliminar(null);
      refetch();
    } catch (err) {
      console.error(err instanceof ApiError ? err.message : err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promesas de Pago</h1>
          <p className="text-sm text-slate-500">Compromisos de pago acordados con clientes en gestión.</p>
        </div>
        <Button icon={Plus} onClick={() => setModalState({ mode: 'create' })}>
          Nueva Promesa
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Search}
          placeholder="Buscar por cliente o estado..."
          value={search}
          onChange={(e: any) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="No hay promesas de pago registradas"
        columns={[
          { header: 'Cliente', accessorKey: 'nombreCliente' },
          { header: 'Fecha promesa', accessorKey: 'fechaPromesa', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Fecha compromiso', accessorKey: 'fechaCompromiso', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Monto', accessorKey: 'montoComprometido', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
          {
            header: 'Estado',
            cell: ({ row }: any) => (
              <div className="flex items-center gap-1.5">
                <StatusBadge status={row.estado} />
                {row.estaVencida && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600"
                    title="La fecha comprometida ya pasó sin marcarse cumplida o incumplida"
                  >
                    <AlertTriangle size={12} />
                    Vencida
                  </span>
                )}
              </div>
            ),
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => (
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => setModalState({ mode: 'edit', promesa: row })}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setPromesaAEliminar(row)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ),
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
        title={modalState?.mode === 'edit' ? 'Editar Promesa de Pago' : 'Nueva Promesa de Pago'}
      >
        <PromesaPagoForm
          promesa={modalState?.promesa}
          onCancel={() => setModalState(null)}
          onSuccess={() => { setModalState(null); refetch(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!promesaAEliminar}
        onClose={() => setPromesaAEliminar(null)}
        onConfirm={handleDelete}
        title="Eliminar promesa de pago"
        description={`¿Eliminar la promesa de ${promesaAEliminar?.nombreCliente}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
    </div>
  );
};
