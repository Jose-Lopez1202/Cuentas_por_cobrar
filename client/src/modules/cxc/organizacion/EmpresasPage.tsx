import { useState } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import type { Empresa } from '@erp/contracts';
import { EmpresaForm } from './components/EmpresaForm';

const PAGE_SIZE = 10;

export const EmpresasPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; empresa?: Empresa } | null>(null);
  const [empresaAEliminar, setEmpresaAEliminar] = useState<Empresa | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<Empresa>(
    '/cxc/empresas',
    { page, limit: PAGE_SIZE, search },
  );

  const handleDelete = async () => {
    if (!empresaAEliminar) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/cxc/empresas/${empresaAEliminar.idEmpresa}`);
      setEmpresaAEliminar(null);
      refetch();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'No se pudo eliminar la empresa');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500">Catálogo de empresas registradas en el sistema.</p>
        </div>
        <Button icon={Plus} onClick={() => setModalState({ mode: 'create' })}>
          Nueva Empresa
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Building2}
          placeholder="Buscar por nombre o NIT..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
        emptyText="No hay empresas registradas"
        columns={[
          { header: 'Nombre', accessorKey: 'nombre' },
          { header: 'NIT', accessorKey: 'nit', cell: ({ value }: any) => value ?? '—' },
          {
            header: 'Estado',
            cell: ({ row }: any) => (
              <StatusBadge status={row.estado} label={row.estado === 'A' ? 'Activa' : 'Inactiva'} />
            ),
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => (
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => setModalState({ mode: 'edit', empresa: row })}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setEmpresaAEliminar(row)}
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
        title={modalState?.mode === 'edit' ? 'Editar Empresa' : 'Nueva Empresa'}
      >
        <EmpresaForm
          empresa={modalState?.empresa}
          onCancel={() => setModalState(null)}
          onSuccess={() => { setModalState(null); refetch(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!empresaAEliminar}
        onClose={() => { setEmpresaAEliminar(null); setDeleteError(null); }}
        onConfirm={handleDelete}
        title="Eliminar empresa"
        description={`¿Eliminar la empresa "${empresaAEliminar?.nombre}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
      {deleteError && (
        <p className="text-sm text-red-600 font-medium">{deleteError}</p>
      )}
    </div>
  );
};
