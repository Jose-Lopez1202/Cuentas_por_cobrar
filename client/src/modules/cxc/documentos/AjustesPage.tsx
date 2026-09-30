import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Search, Check, X as XIcon } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput, Select, TextArea } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { FormActionButtons } from '../../../shared/components/FormActionButtons';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import { hasErrors, validateRequiredSelect, validateMaxLength, type ValidationErrors } from '../../../shared/validation';
import type { Ajuste, DocumentoCatalogoOption } from '@erp/contracts';
import { AjusteForm } from './components/AjusteForm';

const PAGE_SIZE = 10;

function AprobacionModal({
  ajuste,
  accion,
  onClose,
  onSuccess,
}: {
  ajuste: Ajuste;
  accion: 'aprobar' | 'rechazar';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [empleados, setEmpleados] = useState<DocumentoCatalogoOption[]>([]);
  const [idEmpleadoAprobador, setIdEmpleadoAprobador] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient
      .get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/empleados')
      .then(setEmpleados)
      .catch(() => setEmpleados([]));
  }, []);

  const esSegundaAprobacion = accion === 'aprobar' && ajuste.estado === 'EN_2DA_APROBACION';

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const empleadoErr = validateRequiredSelect(idEmpleadoAprobador, `un empleado que ${accion}`);
    if (empleadoErr) next.idEmpleadoAprobador = empleadoErr;
    else if (esSegundaAprobacion && Number(idEmpleadoAprobador) === ajuste.idEmpleadoAprobador) {
      next.idEmpleadoAprobador = 'Debe ser un empleado distinto al que dio la primera aprobación.';
    }

    if (accion === 'rechazar') {
      if (motivoRechazo.trim().length < 5) next.motivoRechazo = 'Describe el motivo del rechazo (mínimo 5 caracteres).';
      else {
        const maxErr = validateMaxLength(motivoRechazo, 'El motivo', 250);
        if (maxErr) next.motivoRechazo = maxErr;
      }
    }
    return next;
  }, [idEmpleadoAprobador, motivoRechazo, accion, esSegundaAprobacion, ajuste.idEmpleadoAprobador]);

  const isFormValid = !hasErrors(validationErrors);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const payload =
        accion === 'aprobar'
          ? { idEmpleadoAprobador: Number(idEmpleadoAprobador) }
          : { idEmpleadoAprobador: Number(idEmpleadoAprobador), motivoRechazo: motivoRechazo.trim() };
      await apiClient.post(`/cxc/ajustes/${ajuste.idAjuste}/${accion}`, payload);
      onSuccess();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : `No se pudo ${accion} el ajuste`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={
        accion === 'aprobar'
          ? esSegundaAprobacion
            ? 'Segunda aprobación del ajuste'
            : 'Primera aprobación del ajuste'
          : 'Rechazar ajuste'
      }
      description={
        accion === 'aprobar'
          ? esSegundaAprobacion
            ? `Esta es la SEGUNDA y última aprobación (debe ser un empleado distinto de ${ajuste.nombreEmpleadoAprobador ?? 'quien dio la primera'}). Al confirmar, el ${ajuste.tipoAjuste === 'CREDITO' ? 'crédito reducirá' : 'débito aumentará'} el saldo del documento #${ajuste.idDocumento ?? '—'} por Q ${Number(ajuste.monto).toFixed(2)}.`
            : 'Esta es la primera de dos aprobaciones requeridas. Todavía no se mueve el saldo del documento; falta una segunda aprobación de un empleado distinto.'
          : 'El ajuste quedará rechazado de forma permanente y nunca afectará el saldo del documento.'
      }
      size="sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Select
          label={accion === 'aprobar' ? 'Empleado que aprueba' : 'Empleado que rechaza'}
          required
          value={idEmpleadoAprobador}
          onChange={(e: any) => setIdEmpleadoAprobador(e.target.value)}
          options={empleados.map((e) => ({ value: e.id, label: e.label }))}
          error={errors.idEmpleadoAprobador}
          helperText={esSegundaAprobacion ? 'Debe ser distinto al empleado que dio la primera aprobación.' : undefined}
        />

        {accion === 'rechazar' && (
          <TextArea
            label="Motivo del rechazo"
            required
            maxLength={250}
            rows={3}
            value={motivoRechazo}
            onChange={(e: any) => setMotivoRechazo(e.target.value)}
            error={errors.motivoRechazo}
            helperText="Obligatorio, mínimo 5 caracteres."
          />
        )}

        {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}

        <FormActionButtons
          onCancel={onClose}
          isSubmitting={busy}
          isEditing={false}
          isFormValid={isFormValid}
          createLabel={accion === 'aprobar' ? (esSegundaAprobacion ? 'Confirmar 2da aprobación' : 'Dar 1ra aprobación') : 'Rechazar'}
        />
      </form>
    </Modal>
  );
}

export const AjustesPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; ajuste?: Ajuste } | null>(null);
  const [ajusteAEliminar, setAjusteAEliminar] = useState<Ajuste | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aprobacion, setAprobacion] = useState<{ ajuste: Ajuste; accion: 'aprobar' | 'rechazar' } | null>(null);

  const { data, meta, isLoading, error, refetch } = usePaginatedList<Ajuste>(
    '/cxc/ajustes',
    { page, limit: PAGE_SIZE, search },
  );

  const handleDelete = async () => {
    if (!ajusteAEliminar) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/cxc/ajustes/${ajusteAEliminar.idAjuste}`);
      setAjusteAEliminar(null);
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
          <h1 className="text-2xl font-bold text-slate-900">Ajustes de Cartera</h1>
          <p className="text-sm text-slate-500">
            Un ajuste nace pendiente y requiere dos aprobaciones de empleados distintos; solo mueve el saldo del documento tras la segunda.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setModalState({ mode: 'create' })}>
          Nuevo Ajuste
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput
          icon={Search}
          placeholder="Buscar cliente, tipo, motivo, estado o documento..."
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
        emptyText="No hay ajustes registrados"
        columns={[
          { header: 'Cliente', accessorKey: 'nombreCliente' },
          { header: 'Documento', accessorKey: 'idDocumento', cell: ({ value }: any) => value ?? '—' },
          { header: 'Tipo', accessorKey: 'tipoAjuste' },
          { header: 'Monto', accessorKey: 'monto', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
          { header: 'Fecha', accessorKey: 'fecha', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Solicitó', accessorKey: 'nombreEmpleado' },
          {
            header: 'Estado',
            cell: ({ row }: any) => (
              <div className="flex flex-col gap-0.5">
                <StatusBadge status={row.estado} />
                {row.estado === 'RECHAZADO' && row.motivoRechazo && (
                  <span className="text-[11px] text-slate-400 max-w-[180px] truncate" title={row.motivoRechazo}>
                    {row.motivoRechazo}
                  </span>
                )}
                {row.estado === 'EN_2DA_APROBACION' && row.nombreEmpleadoAprobador && (
                  <span className="text-[11px] text-slate-400">1ra aprobación: {row.nombreEmpleadoAprobador}</span>
                )}
                {row.estado === 'APROBADO' && (
                  <span className="text-[11px] text-slate-400">
                    {row.nombreEmpleadoAprobador ?? '—'} y {row.nombreEmpleadoAprobador2 ?? '—'}
                  </span>
                )}
              </div>
            ),
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => {
              const aprobable = row.estado === 'PENDIENTE' || row.estado === 'EN_2DA_APROBACION';
              return aprobable ? (
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => setAprobacion({ ajuste: row, accion: 'aprobar' })}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                    title={row.estado === 'EN_2DA_APROBACION' ? 'Dar 2da aprobación' : 'Dar 1ra aprobación'}
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => setAprobacion({ ajuste: row, accion: 'rechazar' })}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Rechazar"
                  >
                    <XIcon size={15} />
                  </button>
                  {row.estado === 'PENDIENTE' && (
                    <>
                      <button
                        onClick={() => setModalState({ mode: 'edit', ajuste: row })}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setAjusteAEliminar(row)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              ) : null;
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
        title={modalState?.mode === 'edit' ? 'Editar Ajuste' : 'Nuevo Ajuste'}
      >
        <AjusteForm
          ajuste={modalState?.ajuste}
          onCancel={() => setModalState(null)}
          onSuccess={() => { setModalState(null); refetch(); }}
        />
      </Modal>

      {aprobacion && (
        <AprobacionModal
          ajuste={aprobacion.ajuste}
          accion={aprobacion.accion}
          onClose={() => setAprobacion(null)}
          onSuccess={() => { setAprobacion(null); refetch(); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!ajusteAEliminar}
        onClose={() => setAjusteAEliminar(null)}
        onConfirm={handleDelete}
        title="Eliminar ajuste"
        description={`¿Eliminar el ajuste #${ajusteAEliminar?.idAjuste}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
    </div>
  );
};
