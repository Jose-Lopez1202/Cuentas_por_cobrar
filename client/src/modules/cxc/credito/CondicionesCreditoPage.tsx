import { useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
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
import type { CondicionCredito } from '@erp/contracts';
import { CondicionCreditoForm } from './components/CondicionCreditoForm';

const PAGE_SIZE = 10;

export const CondicionesCreditoPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [modalState, setModalState] = useState<{
    mode: 'create' | 'edit';
    condicion?: CondicionCredito;
  } | null>(null);

  const [condicionAEliminar, setCondicionAEliminar] =
    useState<CondicionCredito | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

  const { data, meta, isLoading, error, refetch } =
    usePaginatedList<CondicionCredito>(
      '/cxc/condiciones-credito',
      {
        page,
        limit: PAGE_SIZE,
        search,
      },
    );

  const handleDelete = async () => {
    if (!condicionAEliminar) return;

    setIsDeleting(true);

    try {
      await apiClient.delete(
        `/cxc/condiciones-credito/${condicionAEliminar.idCondicion}`,
      );

      setCondicionAEliminar(null);
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
            Condiciones de Crédito
          </h1>

          <p className="text-sm text-slate-500">
            Administración de días de crédito, porcentaje de mora y días
            de gracia.
          </p>
        </div>

        <Button
          icon={Plus}
          onClick={() =>
            setModalState({
              mode: 'create',
            })
          }
        >
          Nueva Condición
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Search}
          placeholder="Buscar condición..."
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
        emptyText="No hay condiciones de crédito registradas"
        columns={[
          {
            header: 'ID',
            accessorKey: 'idCondicion',
          },
          {
            header: 'Días de crédito',
            accessorKey: 'diasCredito',
          },
          {
            header: '% Mora',
            accessorKey: 'porcentajeMora',
            cell: ({ value }: any) =>
              `${Number(value).toFixed(2)}%`,
          },
          {
            header: 'Días de gracia',
            accessorKey: 'diasGracia',
          },
          {
            header: 'Estado',
            cell: ({ row }: any) => (
              <StatusBadge status={row.estado} />
            ),
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
                      condicion: row,
                    })
                  }
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>

                <button
                  onClick={() => setCondicionAEliminar(row)}
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
            ? 'Editar Condición de Crédito'
            : 'Nueva Condición de Crédito'
        }
      >
        <CondicionCreditoForm
          condicion={modalState?.condicion}
          onCancel={() => setModalState(null)}
          onSuccess={() => {
            setModalState(null);
            refetch();
          }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!condicionAEliminar}
        onClose={() => setCondicionAEliminar(null)}
        onConfirm={handleDelete}
        title="Eliminar condición de crédito"
        description={`¿Eliminar la condición de ${condicionAEliminar?.diasCredito ?? ''} días de crédito? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
    </div>
  );
};