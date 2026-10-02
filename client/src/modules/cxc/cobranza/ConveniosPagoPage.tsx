import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search, Eye, RefreshCw } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { ConvenioPago } from '@erp/contracts';
import { ConvenioPagoForm } from './components/ConvenioPagoForm';

const PAGE_SIZE = 10;

export const ConveniosPagoPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [convenioAEliminar, setConvenioAEliminar] = useState<ConvenioPago | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecalculando, setIsRecalculando] = useState(false);
  const [confirmRecalcularOpen, setConfirmRecalcularOpen] = useState(false);
  const [recalculoMensaje, setRecalculoMensaje] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<ConvenioPago>(
    '/cxc/convenios-pago',
    { page, limit: PAGE_SIZE, search },
  );

  const handleDelete = async () => {
    if (!convenioAEliminar) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/cxc/convenios-pago/${convenioAEliminar.idConvenio}`);
      setConvenioAEliminar(null);
      refetch();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'No se pudo eliminar el convenio');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRecalcular = async () => {
    setConfirmRecalcularOpen(false);
    setIsRecalculando(true);
    setRecalculoMensaje(null);
    try {
      const resultado = await apiClient.post<{ actualizados: number }>('/cxc/convenios-pago/recalcular', {});
      setRecalculoMensaje(`${resultado.actualizados} convenio(s) marcado(s) como INCUMPLIDO por cuotas vencidas sin pagar.`);
      refetch();
    } catch (err) {
      setRecalculoMensaje(err instanceof ApiError ? err.message : 'No se pudo recalcular');
    } finally {
      setIsRecalculando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Convenios de Pago</h1>
          <p className="text-sm text-slate-500">Planes de pago a cuotas acordados con clientes en mora. Pagar una cuota reduce el saldo real de los documentos que cubre el convenio.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={RefreshCw} onClick={() => setConfirmRecalcularOpen(true)} disabled={isRecalculando}>
            {isRecalculando ? 'Recalculando...' : 'Recalcular incumplimiento'}
          </Button>
          <Button icon={Plus} onClick={() => setIsCreateOpen(true)}>
            Nuevo Convenio
          </Button>
        </div>
      </div>

      {recalculoMensaje && (
        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">{recalculoMensaje}</p>
      )}

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
        emptyText="No hay convenios de pago registrados"
        onRowClick={(row: ConvenioPago) => navigate(`/cxc/cobranza/convenios-pago/${row.idConvenio}`)}
        columns={[
          { header: 'Cliente', accessorKey: 'nombreCliente' },
          { header: 'Fecha', accessorKey: 'fechaConvenio', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Monto deuda', accessorKey: 'montoDeuda', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
          { header: 'Cuotas', accessorKey: 'numeroCuotas', align: 'center' },
          {
            header: 'Estado',
            cell: ({ row }: any) => <StatusBadge status={row.estado} />,
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => (
              <div className="flex justify-end gap-1">
                <button
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/cxc/cobranza/convenios-pago/${row.idConvenio}`); }}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Ver cuotas"
                >
                  <Eye size={15} />
                </button>
                <button
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); setConvenioAEliminar(row); }}
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

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nuevo Convenio de Pago" size="lg">
        <ConvenioPagoForm
          onCancel={() => setIsCreateOpen(false)}
          onSuccess={() => { setIsCreateOpen(false); refetch(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={confirmRecalcularOpen}
        onClose={() => setConfirmRecalcularOpen(false)}
        onConfirm={handleRecalcular}
        title="Confirmar recálculo"
        description="¿Estás seguro de recalcular el incumplimiento? Los convenios con cuotas vencidas sin pagar se marcarán como INCUMPLIDO."
        confirmLabel="Sí, recalcular"
        variant="primary"
      />

      <ConfirmDialog
        isOpen={!!convenioAEliminar}
        onClose={() => { setConvenioAEliminar(null); setDeleteError(null); }}
        onConfirm={handleDelete}
        title="Eliminar convenio de pago"
        description={
          deleteError ??
          `¿Eliminar el convenio de ${convenioAEliminar?.nombreCliente}? Solo se permite si ninguna cuota tiene pagos registrados; si ya tiene pagos, cámbialo a CANCELADO en su lugar.`
        }
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
    </div>
  );
};
