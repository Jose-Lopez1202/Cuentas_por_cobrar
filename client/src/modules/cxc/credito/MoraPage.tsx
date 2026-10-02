import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import {
  DataTable,
  StatusBadge,
  Button,
  TextInput,
} from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { Mora } from '@erp/contracts';
import { MoraForm } from './components/MoraForm';

const PAGE_SIZE = 10;

export const MoraPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [modalState, setModalState] = useState<{
    mode: 'create' | 'edit';
    mora?: Mora;
  } | null>(null);

  const [moraAEliminar, setMoraAEliminar] =
    useState<Mora | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecalculando, setIsRecalculando] = useState(false);
  const [confirmRecalcularOpen, setConfirmRecalcularOpen] = useState(false);
  const [recalculoMensaje, setRecalculoMensaje] = useState<string | null>(null);

  const { data, meta, isLoading, error, refetch } =
    usePaginatedList<Mora>(
      '/cxc/mora',
      {
        page,
        limit: PAGE_SIZE,
        search,
      },
    );

  const handleRecalcular = async () => {
    setConfirmRecalcularOpen(false);
    setIsRecalculando(true);
    setRecalculoMensaje(null);
    try {
      const resultado = await apiClient.post<{ activas: number; cerradas: number }>('/cxc/mora/recalcular', {});
      setRecalculoMensaje(
        `Recalculado: ${resultado.activas} en mora activa, ${resultado.cerradas} cerradas por saldo pagado.`,
      );
      refetch();
    } catch (err) {
      setRecalculoMensaje(err instanceof ApiError ? err.message : 'No se pudo recalcular la mora');
    } finally {
      setIsRecalculando(false);
    }
  };

  const handleDelete = async () => {
    if (!moraAEliminar) return;

    setIsDeleting(true);

    try {
      await apiClient.delete(
        `/cxc/mora/${moraAEliminar.idMora}`,
      );

      setMoraAEliminar(null);
      refetch();
    } catch (err) {
      console.error(
        err instanceof ApiError ? err.message : err,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Mora
          </h1>

          <p className="text-sm text-slate-500">
            Administración de saldos vencidos, días y cargos por mora.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => setConfirmRecalcularOpen(true)}
            disabled={isRecalculando}
          >
            {isRecalculando ? 'Recalculando...' : 'Recalcular Mora'}
          </Button>
          <Button
            icon={Plus}
            onClick={() =>
              setModalState({
                mode: 'create',
              })
            }
          >
            Nueva Mora
          </Button>
        </div>
      </div>

      {recalculoMensaje && (
        <p className="text-sm text-blue-700 font-medium bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          {recalculoMensaje}
        </p>
      )}

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Search}
          placeholder="Buscar registro de mora..."
          value={search}
          onChange={(e: any) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="No hay registros de mora"
        columns={[
          {
            header: 'ID',
            accessorKey: 'idMora',
          },
          {
            header: 'Documento',
            accessorKey: 'idDocumento',
            cell: ({ value }: any) =>
              `Documento #${value}`,
          },
          {
            header: 'Días Mora',
            accessorKey: 'diasMora',
            cell: ({ value }: any) =>
              value ?? '-',
          },
          {
            header: 'Saldo Vencido',
            accessorKey: 'saldoVencido',
            cell: ({ value }: any) =>
              value === null || value === undefined
                ? '-'
                : Number(value).toLocaleString('es-GT', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
          },
          {
            header: '% Mora',
            accessorKey: 'porcentajeMora',
            cell: ({ value }: any) =>
              value === null || value === undefined
                ? '-'
                : `${Number(value).toFixed(2)}%`,
          },
          {
            header: 'Monto Mora',
            accessorKey: 'montoMora',
            cell: ({ value }: any) =>
              value === null || value === undefined
                ? '-'
                : Number(value).toLocaleString('es-GT', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
          },
          {
            header: 'Fecha Cálculo',
            accessorKey: 'fechaCalculo',
            cell: ({ value }: any) => formatDateGT(value, '-'),
          },
          {
            header: 'Estado',
            accessorKey: 'estado',
            cell: ({ value }: any) => {
              if (!value) return '—';

              if (value === 'ANULADA') {
                return (
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                    Anulada
                  </span>
                );
              }

              return <StatusBadge status={value} />;
            },
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => (
              <div className="flex justify-end gap-1">
                <button
                  onClick={() =>
                    setModalState({
                      mode: 'edit',
                      mora: row,
                    })
                  }
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>

                <button
                  onClick={() =>
                    setMoraAEliminar(row)
                  }
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
        title={
          modalState?.mode === 'edit'
            ? 'Editar Mora'
            : 'Nueva Mora'
        }
      >
        <MoraForm
          mora={modalState?.mora}
          onCancel={() => setModalState(null)}
          onSuccess={() => {
            setModalState(null);
            refetch();
          }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={confirmRecalcularOpen}
        onClose={() => setConfirmRecalcularOpen(false)}
        onConfirm={handleRecalcular}
        title="Confirmar recálculo de mora"
        description="¿Estás seguro de recalcular la mora? Se actualizarán los registros activos y se cerrarán los que ya no apliquen."
        confirmLabel="Sí, recalcular"
        variant="primary"
      />

      <ConfirmDialog
        isOpen={!!moraAEliminar}
        onClose={() => setMoraAEliminar(null)}
        onConfirm={handleDelete}
        title="Eliminar registro de mora"
        description={`¿Eliminar el registro de mora #${moraAEliminar?.idMora ?? ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
    </div>
  );
};