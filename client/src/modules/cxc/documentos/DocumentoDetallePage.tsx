import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { DataTable, StatusBadge, Button } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import type { Documento, DocumentoDetalle, DocumentoHistorial } from '@erp/contracts';
import { DocumentoDetalleForm } from './components/DocumentoDetalleForm';
import { DocumentoHistorialForm } from './components/DocumentoHistorialForm';

export const DocumentoDetallePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [documento, setDocumento] = useState<Documento | null>(null);
  const [detalles, setDetalles] = useState<DocumentoDetalle[]>([]);
  const [historial, setHistorial] = useState<DocumentoHistorial[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [detalleModal, setDetalleModal] = useState<{ mode: 'create' | 'edit'; detalle?: DocumentoDetalle } | null>(null);
  const [historialModal, setHistorialModal] = useState<{ mode: 'create' | 'edit'; historial?: DocumentoHistorial } | null>(null);
  const [detalleEliminar, setDetalleEliminar] = useState<DocumentoDetalle | null>(null);
  const [historialEliminar, setHistorialEliminar] = useState<DocumentoHistorial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([
      apiClient.get<Documento>(`/cxc/documentos/${id}`),
      apiClient.get<DocumentoDetalle[]>(`/cxc/documentos/${id}/detalles`),
      apiClient.get<DocumentoHistorial[]>(`/cxc/documentos/${id}/historial`),
    ])
      .then(([doc, det, hist]) => {
        setDocumento(doc);
        setDetalles(det);
        setHistorial(hist);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el documento'))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const deleteDetalle = async () => {
    if (!detalleEliminar) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/cxc/documentos/detalles/${detalleEliminar.idDetalle}`);
      setDetalleEliminar(null);
      cargar();
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteHistorial = async () => {
    if (!historialEliminar) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/cxc/documentos/historial/${historialEliminar.idHistorial}`);
      setHistorialEliminar(null);
      cargar();
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <p className="text-slate-400 text-center py-12">Cargando documento...</p>;
  }

  if (error || !documento) {
    return <p className="text-red-600 text-center py-12">{error ?? 'Documento no encontrado'}</p>;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/cxc/documentos/documentos')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={15} /> Volver a Documentos
      </button>

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {[documento.serie, documento.numeroDocumento].filter(Boolean).join('-')}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {documento.nombreCliente ?? `Cliente #${documento.idCliente}`} · {documento.nombreTipoDocumento ?? `Tipo #${documento.idTipoDocumento}`}
            </p>
          </div>
          <div className="flex items-center gap-2"><StatusBadge status={documento.estado} />{documento.condicion === 'VENCIDA' && <StatusBadge status="VENCIDA" />}</div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100 text-sm">
          <div>
            <p className="text-slate-400 text-xs uppercase font-semibold">NIT</p>
            <p className="font-bold text-slate-900 mt-1">{documento.nitCliente ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase font-semibold">Fecha</p>
            <p className="font-bold text-slate-900 mt-1">{formatDateGT(documento.fechaDocumento)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase font-semibold">Total</p>
            <p className="font-bold text-slate-900 mt-1">Q {Number(documento.total).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase font-semibold">Saldo</p>
            <p className="font-bold text-slate-900 mt-1">Q {Number(documento.saldo).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Detalle comercial</h2>
            <p className="text-sm text-slate-500">CXC_DOCUMENTO_DETALLE</p>
          </div>
          <Button icon={Plus} onClick={() => setDetalleModal({ mode: 'create' })}>
            Agregar Detalle
          </Button>
        </div>

        <DataTable
          data={detalles}
          emptyText="El documento no tiene detalle"
          columns={[
            { header: 'Código', accessorKey: 'codigoProducto' },
            { header: 'Descripción', accessorKey: 'descripcion' },
            { header: 'Cantidad', accessorKey: 'cantidad' },
            { header: 'Precio unitario', accessorKey: 'precioUnitario', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
            { header: 'Total', accessorKey: 'total', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
            {
              header: '',
              align: 'right',
              cell: ({ row }: any) => (
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => setDetalleModal({ mode: 'edit', detalle: row })}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDetalleEliminar(row)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Historial del documento</h2>
            <p className="text-sm text-slate-500">CXC_DOCUMENTO_HISTORIAL</p>
          </div>
          <Button icon={Plus} onClick={() => setHistorialModal({ mode: 'create' })}>
            Agregar Historial
          </Button>
        </div>

        <DataTable
          data={historial}
          emptyText="El documento no tiene historial"
          columns={[
            { header: 'Fecha', accessorKey: 'fecha', cell: ({ value }: any) => formatDateGT(value) },
            {
              header: 'Movimiento',
              cell: ({ row }: any) =>
                row.tipoEvento ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-slate-700">
                      {String(row.tipoEvento).replace(/_/g, ' ')}
                    </span>
                    {row.descripcion && (
                      <span className="text-[11px] text-slate-400 max-w-[220px] truncate" title={row.descripcion}>
                        {row.descripcion}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Manual</span>
                ),
            },
            {
              header: 'Monto',
              cell: ({ row }: any) =>
                row.monto != null ? (
                  <span className={row.naturaleza === 'CARGO' ? 'text-red-600' : 'text-emerald-600'}>
                    {row.naturaleza === 'CARGO' ? '+' : '-'} Q {Number(row.monto).toFixed(2)}
                  </span>
                ) : '—',
            },
            { header: 'Estado anterior', accessorKey: 'estadoAnterior', cell: ({ value }: any) => value ? <StatusBadge status={value} /> : '—' },
            { header: 'Estado nuevo', accessorKey: 'estadoNuevo', cell: ({ value }: any) => value ? <StatusBadge status={value} /> : '—' },
            { header: 'Empleado', accessorKey: 'nombreEmpleado' },
            {
              header: '',
              align: 'right',
              cell: ({ row }: any) =>
                row.tipoEvento ? null : (
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setHistorialModal({ mode: 'edit', historial: row })}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setHistorialEliminar(row)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ),
            },
          ]}
        />
      </section>

      <Modal
        isOpen={!!detalleModal}
        onClose={() => setDetalleModal(null)}
        title={detalleModal?.mode === 'edit' ? 'Editar Detalle' : 'Agregar Detalle'}
      >
        <DocumentoDetalleForm
          idDocumento={documento.idDocumento}
          detalle={detalleModal?.detalle}
          onCancel={() => setDetalleModal(null)}
          onSuccess={() => { setDetalleModal(null); cargar(); }}
        />
      </Modal>

      <Modal
        isOpen={!!historialModal}
        onClose={() => setHistorialModal(null)}
        title={historialModal?.mode === 'edit' ? 'Editar Historial' : 'Agregar Historial'}
      >
        <DocumentoHistorialForm
          idDocumento={documento.idDocumento}
          currentEstado={documento.estado}
          historial={historialModal?.historial}
          onCancel={() => setHistorialModal(null)}
          onSuccess={() => { setHistorialModal(null); cargar(); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!detalleEliminar}
        onClose={() => setDetalleEliminar(null)}
        onConfirm={deleteDetalle}
        title="Eliminar detalle"
        description="¿Eliminar esta línea del documento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />

      <ConfirmDialog
        isOpen={!!historialEliminar}
        onClose={() => setHistorialEliminar(null)}
        onConfirm={deleteHistorial}
        title="Eliminar historial"
        description="¿Eliminar este registro del historial? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
    </div>
  );
};
