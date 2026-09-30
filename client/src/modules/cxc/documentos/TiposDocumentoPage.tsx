import { useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import type { TipoDocumento } from '@erp/contracts';
import { TipoDocumentoForm } from './components/TipoDocumentoForm';

const PAGE_SIZE = 10;

export const TiposDocumentoPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; tipo?: TipoDocumento } | null>(null);
  const [tipoAEliminar, setTipoAEliminar] = useState<TipoDocumento | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<TipoDocumento>(
    '/cxc/tipos-documento',
    { page, limit: PAGE_SIZE, search },
  );

  const handleDelete = async () => {
    if (!tipoAEliminar) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/cxc/tipos-documento/${tipoAEliminar.idTipoDocumento}`);
      setTipoAEliminar(null);
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
          <h1 className="text-2xl font-bold text-slate-900">Tipos de Documento</h1>
          <p className="text-sm text-slate-500">Catálogo CXC_TIPOS_DOCUMENTO.</p>
        </div>
        <Button icon={Plus} onClick={() => setModalState({ mode: 'create' })}>
          Nuevo Tipo
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Search}
          placeholder="Buscar código, nombre o naturaleza..."
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
        emptyText="No hay tipos de documento registrados"
        columns={[
          { header: 'Código', accessorKey: 'codigo' },
          { header: 'Nombre', accessorKey: 'nombre' },
          { header: 'Naturaleza', accessorKey: 'naturaleza' },
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
                  onClick={() => setModalState({ mode: 'edit', tipo: row })}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setTipoAEliminar(row)}
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
        title={modalState?.mode === 'edit' ? 'Editar Tipo de Documento' : 'Nuevo Tipo de Documento'}
      >
        <TipoDocumentoForm
          tipo={modalState?.tipo}
          onCancel={() => setModalState(null)}
          onSuccess={() => { setModalState(null); refetch(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!tipoAEliminar}
        onClose={() => setTipoAEliminar(null)}
        onConfirm={handleDelete}
        title="Eliminar tipo de documento"
        description={`¿Eliminar ${tipoAEliminar?.nombre}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
    </div>
  );
};
