import { useState } from 'react';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import type { Sucursal } from '@erp/contracts';
import { SucursalForm } from './components/SucursalForm';

const PAGE_SIZE = 10;

export const SucursalesPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; sucursal?: Sucursal } | null>(null);
  const [sucursalAEliminar, setSucursalAEliminar] = useState<Sucursal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<Sucursal>(
    '/cxc/sucursales',
    { page, limit: PAGE_SIZE, search },
  );

  const handleDelete = async () => {
    if (!sucursalAEliminar) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/cxc/sucursales/${sucursalAEliminar.idSucursal}`);
      setSucursalAEliminar(null);
      refetch();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'No se pudo eliminar la sucursal');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sucursales</h1>
          <p className="text-sm text-slate-500">Catálogo de sucursales por empresa.</p>
        </div>
        <Button icon={Plus} onClick={() => setModalState({ mode: 'create' })}>
          Nueva Sucursal
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={MapPin}
          placeholder="Buscar por sucursal o empresa..."
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
        emptyText="No hay sucursales registradas"
        columns={[
          { header: 'Sucursal', accessorKey: 'nombre' },
          { header: 'Empresa', accessorKey: 'nombreEmpresa' },
          { header: 'Dirección', accessorKey: 'direccion', cell: ({ value }: any) => value ?? '—' },
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
                  onClick={() => setModalState({ mode: 'edit', sucursal: row })}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setSucursalAEliminar(row)}
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
        title={modalState?.mode === 'edit' ? 'Editar Sucursal' : 'Nueva Sucursal'}
      >
        <SucursalForm
          sucursal={modalState?.sucursal}
          onCancel={() => setModalState(null)}
          onSuccess={() => { setModalState(null); refetch(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!sucursalAEliminar}
        onClose={() => { setSucursalAEliminar(null); setDeleteError(null); }}
        onConfirm={handleDelete}
        title="Eliminar sucursal"
        description={`¿Eliminar la sucursal "${sucursalAEliminar?.nombre}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
      {deleteError && (
        <p className="text-sm text-red-600 font-medium">{deleteError}</p>
      )}
    </div>
  );
};
