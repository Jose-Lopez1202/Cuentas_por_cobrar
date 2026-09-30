import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Eye, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal, TrazabilidadActionModal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { Documento } from '@erp/contracts';
import { DocumentoForm } from './components/DocumentoForm';

const PAGE_SIZE = 10;

export const DocumentosPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; documento?: Documento } | null>(null);
  const [documentoAEliminar, setDocumentoAEliminar] = useState<Documento | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aAnular, setAAnular] = useState<Documento | null>(null);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<Documento>(
    '/cxc/documentos',
    { page, limit: PAGE_SIZE, search },
  );

  const handleDelete = async () => {
    if (!documentoAEliminar) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/cxc/documentos/${documentoAEliminar.idDocumento}`);
      setDocumentoAEliminar(null);
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
          <h1 className="text-2xl font-bold text-slate-900">Documentos CxC</h1>
          <p className="text-sm text-slate-500">Cabecera de documentos que generan o afectan la deuda del cliente.</p>
        </div>
        <Button icon={Plus} onClick={() => setModalState({ mode: 'create' })}>
          Nuevo Documento
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Search}
          placeholder="Buscar cliente, NIT, serie, número o estado..."
          value={search}
          onChange={(e: any) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-md"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="No hay documentos registrados"
        columns={[
          { header: 'Cliente', accessorKey: 'nombreCliente' },
          {
            header: 'Documento',
            cell: ({ row }: any) => [row.serie, row.numeroDocumento].filter(Boolean).join('-'),
          },
          { header: 'Tipo', accessorKey: 'nombreTipoDocumento' },
          { header: 'Vencimiento', accessorKey: 'fechaVencimiento', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Total', accessorKey: 'total', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
          { header: 'Saldo', accessorKey: 'saldo', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
          {
            header: 'Estado',
            cell: ({ row }: any) => <StatusBadge status={row.estado} />,
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => {
              const anulable = !['ANULADO', 'ANULADA', 'PAGADO', 'PAGADA'].includes(String(row.estado).toUpperCase());
              return (
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => navigate(`/cxc/documentos/documentos/${row.idDocumento}`)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                    title="Ver detalle"
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    onClick={() => setModalState({ mode: 'edit', documento: row })}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => !anulable ? undefined : setAAnular(row)}
                    disabled={!anulable}
                    className={`p-1.5 rounded-md transition-colors ${anulable ? 'text-slate-400 hover:text-amber-700 hover:bg-amber-50' : 'text-slate-300 cursor-not-allowed'}`}
                    title={anulable ? 'Anular documento' : 'No se puede anular un documento pagado o ya anulado'}
                  >
                    <Ban size={15} />
                  </button>
                  <button
                    onClick={() => setDocumentoAEliminar(row)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Eliminar"
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
        title={modalState?.mode === 'edit' ? 'Editar Documento' : 'Nuevo Documento'}
        size="lg"
      >
        <DocumentoForm
          documento={modalState?.documento}
          onCancel={() => setModalState(null)}
          onSuccess={() => { setModalState(null); refetch(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!documentoAEliminar}
        onClose={() => setDocumentoAEliminar(null)}
        onConfirm={handleDelete}
        title="Eliminar documento"
        description={`¿Eliminar el documento ${documentoAEliminar?.serie ?? ''}-${documentoAEliminar?.numeroDocumento ?? ''}? Solo se permitirá si no tiene movimientos financieros.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />

      {aAnular && (
        <TrazabilidadActionModal
          title={`Anular documento ${[aAnular.serie, aAnular.numeroDocumento].filter(Boolean).join('-')}`}
          description="El saldo pendiente del documento se llevará a cero. No se revierten los pagos/notas/anticipos ya aplicados a él."
          endpoint={`/cxc/documentos/${aAnular.idDocumento}/anular`}
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
