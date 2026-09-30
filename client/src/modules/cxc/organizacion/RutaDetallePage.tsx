import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { DataTable, StatusBadge, Button } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { apiClient, ApiError } from '../../../shared/api';
import type { Ruta, RutaDetalle } from '@erp/contracts';
import { RutaDetalleForm } from './components/RutaDetalleForm';

export const RutaDetallePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const idRuta = Number(id);

  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [paradas, setParadas] = useState<RutaDetalle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; parada?: RutaDetalle } | null>(null);
  const [paradaAEliminar, setParadaAEliminar] = useState<RutaDetalle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const cargar = () => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      apiClient.get<Ruta>(`/cxc/rutas/${idRuta}`),
      apiClient.get<RutaDetalle[]>(`/cxc/rutas/${idRuta}/detalle`),
    ])
      .then(([rutaData, paradasData]) => {
        setRuta(rutaData);
        setParadas(paradasData);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la ruta');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idRuta]);

  const handleDelete = async () => {
    if (!paradaAEliminar) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/cxc/rutas/detalle/${paradaAEliminar.idRutaDetalle}`);
      setParadaAEliminar(null);
      cargar();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'No se pudo eliminar la parada');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/cxc/organizacion/rutas')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a Rutas
      </button>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {ruta ? `Ruta: ${ruta.nombre}` : 'Ruta'}
          </h1>
          <p className="text-sm text-slate-500">
            {ruta ? `Responsable: ${ruta.nombreEmpleado ?? '—'} · Estado: ${ruta.estado}` : 'Paradas de la ruta.'}
          </p>
        </div>
        <Button icon={Plus} onClick={() => setModalState({ mode: 'create' })}>
          Agregar Parada
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <DataTable
        isLoading={isLoading}
        data={paradas}
        emptyText="Esta ruta todavía no tiene paradas registradas"
        columns={[
          { header: 'Orden', accessorKey: 'ordenVisita', cell: ({ value }: any) => value ?? '—' },
          { header: 'Cliente', accessorKey: 'nombreCliente' },
          { header: 'Dirección', accessorKey: 'direccion', cell: ({ value }: any) => value ?? '—' },
          { header: 'Hora', accessorKey: 'horaVisita', cell: ({ value }: any) => value ?? '—' },
          {
            header: 'Monto pendiente',
            align: 'right',
            cell: ({ row }: any) => (row.montoPendiente ? `Q ${Number(row.montoPendiente).toFixed(2)}` : '—'),
          },
          {
            header: 'Estado visita',
            cell: ({ row }: any) => (row.estadoVisita ? <StatusBadge status={row.estadoVisita} /> : '—'),
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => (
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => setModalState({ mode: 'edit', parada: row })}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setParadaAEliminar(row)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        isOpen={!!modalState}
        onClose={() => setModalState(null)}
        title={modalState?.mode === 'edit' ? 'Editar Parada' : 'Nueva Parada'}
      >
        <RutaDetalleForm
          idRuta={idRuta}
          parada={modalState?.parada}
          onCancel={() => setModalState(null)}
          onSuccess={() => { setModalState(null); cargar(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!paradaAEliminar}
        onClose={() => { setParadaAEliminar(null); setDeleteError(null); }}
        onConfirm={handleDelete}
        title="Eliminar parada"
        description={`¿Eliminar la parada de "${paradaAEliminar?.nombreCliente}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
      {deleteError && (
        <p className="text-sm text-red-600 font-medium">{deleteError}</p>
      )}
    </div>
  );
};
