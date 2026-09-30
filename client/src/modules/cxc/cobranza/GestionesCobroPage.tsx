import { useState } from 'react';
import { Plus, Pencil, Trash2, Phone } from 'lucide-react';
import { DataTable, Button, TextInput } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { GestionCobro } from '@erp/contracts';
import { GestionCobroForm } from './components/GestionCobroForm';

const PAGE_SIZE = 10;

export const GestionesCobroPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; gestion?: GestionCobro } | null>(null);
  const [gestionAEliminar, setGestionAEliminar] = useState<GestionCobro | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<GestionCobro>(
    '/cxc/gestiones-cobro',
    { page, limit: PAGE_SIZE, search },
  );

  const handleDelete = async () => {
    if (!gestionAEliminar) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/cxc/gestiones-cobro/${gestionAEliminar.idGestion}`);
      setGestionAEliminar(null);
      refetch();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'No se pudo eliminar la gestión');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestiones de Cobro</h1>
          <p className="text-sm text-slate-500">Registro de llamadas, visitas y contactos de cobranza.</p>
        </div>
        <Button icon={Plus} onClick={() => setModalState({ mode: 'create' })}>
          Nueva Gestión
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Phone}
          placeholder="Buscar por cliente, tipo o resultado..."
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
        emptyText="No hay gestiones de cobro registradas"
        columns={[
          { header: 'Fecha', accessorKey: 'fechaGestion', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Cliente', accessorKey: 'nombreCliente' },
          { header: 'Empleado', accessorKey: 'nombreEmpleado' },
          { header: 'Tipo', accessorKey: 'tipoGestion', cell: ({ value }: any) => value ?? '—' },
          {
            header: 'Compromiso',
            cell: ({ row }: any) =>
              row.montoCompromiso ? (
                <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-700">Q {Number(row.montoCompromiso).toFixed(2)}</span>
              ) : (
                '—'
              ),
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => (
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => setModalState({ mode: 'edit', gestion: row })}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setGestionAEliminar(row)}
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
        title={modalState?.mode === 'edit' ? 'Editar Gestión de Cobro' : 'Nueva Gestión de Cobro'}
      >
        <GestionCobroForm
          gestion={modalState?.gestion}
          onCancel={() => setModalState(null)}
          onSuccess={() => { setModalState(null); refetch(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!gestionAEliminar}
        onClose={() => { setGestionAEliminar(null); setDeleteError(null); }}
        onConfirm={handleDelete}
        title="Eliminar gestión de cobro"
        description={`¿Eliminar la gestión del ${formatDateGT(gestionAEliminar?.fechaGestion)} con ${gestionAEliminar?.nombreCliente}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
      {deleteError && (
        <p className="text-sm text-red-600 font-medium">{deleteError}</p>
      )}
    </div>
  );
};
