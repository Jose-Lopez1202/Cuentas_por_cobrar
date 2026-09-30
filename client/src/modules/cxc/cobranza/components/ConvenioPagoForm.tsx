import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea, Checkbox } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import { todayIso, validateRequiredSelect, validateRequiredDate, validateMoney, validateRequiredNumber, validateMaxLength, hasErrors, type ValidationErrors } from '../../../../shared/validation';
import type { CatalogoOption, ConvenioPago } from '@erp/contracts';

interface ConvenioPagoFormProps { convenio?: ConvenioPago | null; onSuccess: () => void; onCancel: () => void; }
const ESTADOS_CONVENIO_PAGO = ['ACTIVO', 'CUMPLIDO', 'INCUMPLIDO', 'CANCELADO'] as const;
const ESTADO_OPTIONS = ESTADOS_CONVENIO_PAGO.map((e) => ({ value: e, label: e }));
const MAX_CUOTAS = 60;

export const ConvenioPagoForm = ({ convenio, onSuccess, onCancel }: ConvenioPagoFormProps) => {
  const isEditing = !!convenio;
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [documentosPendientes, setDocumentosPendientes] = useState<CatalogoOption[]>([]);
  const [montosIncluidos, setMontosIncluidos] = useState<Record<number, string>>({});
  const [idCliente, setIdCliente] = useState(convenio?.idCliente?.toString() ?? '');
  const [fechaConvenio, setFechaConvenio] = useState(convenio?.fechaConvenio?.slice(0, 10) ?? '');
  const [montoDeuda, setMontoDeuda] = useState(convenio?.montoDeuda?.toString() ?? '');
  const [numeroCuotas, setNumeroCuotas] = useState(convenio?.numeroCuotas?.toString() ?? '');
  const [estado, setEstado] = useState(convenio?.estado ?? 'ACTIVO');
  const [observaciones, setObservaciones] = useState(convenio?.observaciones ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(() => setClientes([])); }, []);

  useEffect(() => {
    if (isEditing || !idCliente) { setDocumentosPendientes([]); setMontosIncluidos({}); return; }
    apiClient
      .get<CatalogoOption[]>(`/cxc/catalogos/clientes/${idCliente}/documentos-pendientes`)
      .then(setDocumentosPendientes)
      .catch(() => setDocumentosPendientes([]));
    setMontosIncluidos({});
  }, [idCliente, isEditing]);

  const documentosIncluidos = Object.keys(montosIncluidos).map(Number).filter((id) => montosIncluidos[id] !== undefined);
  const sumaIncluida = documentosIncluidos.reduce((acc, id) => acc + (Number(montosIncluidos[id]) || 0), 0);

  const toggleDocumento = (doc: CatalogoOption, checked: boolean) => {
    setMontosIncluidos((prev) => {
      const next = { ...prev };
      if (checked) next[Number(doc.id)] = String(doc.saldo ?? 0);
      else delete next[Number(doc.id)];
      return next;
    });
  };

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const clienteErr = validateRequiredSelect(idCliente, 'un cliente'); if (clienteErr) next.idCliente = clienteErr;
    const fechaErr = validateRequiredDate(fechaConvenio, 'La fecha del convenio', { notFuture: true }); if (fechaErr) next.fechaConvenio = fechaErr;
    const montoErr = validateMoney(montoDeuda, 'El monto de la deuda', { required: true, positive: true }); if (montoErr) next.montoDeuda = montoErr;
    const cuotasErr = validateRequiredNumber(numeroCuotas, 'El número de cuotas', { integer: true, min: 1, max: MAX_CUOTAS }); if (cuotasErr) next.numeroCuotas = cuotasErr;
    const obsErr = validateMaxLength(observaciones, 'Observaciones', 500); if (obsErr) next.observaciones = obsErr;
    if (!isEditing) {
      if (documentosIncluidos.length === 0) {
        next.documentos = 'Selecciona al menos un documento que cubra el convenio.';
      } else if (!montoErr && Math.abs(sumaIncluida - Number(montoDeuda)) > 0.005) {
        next.documentos = `La suma de los montos incluidos (Q ${sumaIncluida.toFixed(2)}) debe ser igual al monto de la deuda (Q ${Number(montoDeuda || 0).toFixed(2)}).`;
      }
    }
    return next;
  }, [idCliente, fechaConvenio, montoDeuda, numeroCuotas, observaciones, isEditing, documentosIncluidos.length, sumaIncluida]);
  const isFormValid = !hasErrors(validationErrors);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null);
    if (!isFormValid) { setErrors(validationErrors); return; }
    setErrors({}); setIsSubmitting(true);
    const payload = isEditing
      ? { estado, observaciones: observaciones.trim() || undefined }
      : {
          idCliente: Number(idCliente),
          fechaConvenio,
          montoDeuda: Number(montoDeuda),
          numeroCuotas: Number(numeroCuotas),
          estado,
          observaciones: observaciones.trim() || undefined,
          documentos: documentosIncluidos.map((id) => ({ idDocumento: id, montoIncluido: Number(montosIncluidos[id]) })),
        };
    try {
      if (isEditing) await apiClient.patch(`/cxc/convenios-pago/${convenio!.idConvenio}`, payload); else await apiClient.post('/cxc/convenios-pago', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {}; (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => { fieldErrors[d.campo] = d.mensaje; }); setErrors(fieldErrors);
      } else setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el convenio');
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Select label="Cliente" required value={idCliente} onChange={(e: any) => setIdCliente(e.target.value)} options={clientes.map((c) => ({ value: c.id, label: c.label }))} error={errors.idCliente} isReadOnly={isEditing} helperText={isEditing ? 'El cliente queda fijo porque el convenio ya tiene plan de cuotas.' : 'Cliente con quien se formaliza el convenio.'} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput label="Fecha del convenio" type="date" required max={todayIso()} value={fechaConvenio} onChange={(e: any) => setFechaConvenio(e.target.value)} error={errors.fechaConvenio} isReadOnly={isEditing} helperText={isEditing ? 'La fecha original no cambia al editar.' : 'Fecha real del acuerdo; no puede ser futura.'} />
        <TextInput label="Monto de la deuda" type="number" restriction="decimal" decimalPlaces={2} step="0.01" min="0.01" required value={montoDeuda} onChange={(e: any) => setMontoDeuda(e.target.value)} error={errors.montoDeuda} isReadOnly={isEditing} helperText={isEditing ? 'El monto queda fijo porque ya generó las cuotas.' : 'Debe coincidir con la suma de los documentos que selecciones abajo.'} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput label="Número de cuotas" type="number" restriction="integer" min="1" max={String(MAX_CUOTAS)} step="1" required value={numeroCuotas} onChange={(e: any) => setNumeroCuotas(e.target.value)} error={errors.numeroCuotas} isReadOnly={isEditing} helperText={isEditing ? 'No se modifica porque el plan de cuotas ya existe.' : `Solo enteros entre 1 y ${MAX_CUOTAS}; las cuotas se generan automáticamente.`} />
        <Select label="Estado" required value={estado} onChange={(e: any) => setEstado(e.target.value)} options={ESTADO_OPTIONS} helperText="El sistema también lo cambia solo: CUMPLIDO al pagar todas las cuotas, INCUMPLIDO al recalcular con cuotas vencidas." />
      </div>

      {!isEditing && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-700">
            Documentos que cubre el convenio <span className="text-red-500">*</span>
          </label>
          {!idCliente ? (
            <p className="text-xs text-slate-400">Selecciona un cliente primero.</p>
          ) : documentosPendientes.length === 0 ? (
            <p className="text-xs text-slate-400">Este cliente no tiene documentos con saldo pendiente.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {documentosPendientes.map((doc) => {
                const checked = montosIncluidos[Number(doc.id)] !== undefined;
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox checked={checked} onChange={(e: any) => toggleDocumento(doc, e.target.checked)} />
                    <span className="flex-1 text-sm text-slate-700">{doc.label}</span>
                    {checked && (
                      <TextInput
                        type="number"
                        restriction="decimal"
                        decimalPlaces={2}
                        step="0.01"
                        min="0.01"
                        max={String(doc.saldo ?? 0)}
                        value={montosIncluidos[Number(doc.id)]}
                        onChange={(e: any) => setMontosIncluidos((prev) => ({ ...prev, [Number(doc.id)]: e.target.value }))}
                        className="w-32"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className={`text-xs ${errors.documentos ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
            {errors.documentos ?? `Suma incluida: Q ${sumaIncluida.toFixed(2)} de Q ${Number(montoDeuda || 0).toFixed(2)}`}
          </p>
        </div>
      )}

      <TextArea label="Observaciones" value={observaciones} onChange={(e: any) => setObservaciones(e.target.value)} rows={3} maxLength={500} error={errors.observaciones} helperText="Condiciones o notas adicionales del acuerdo; máximo 500 caracteres." />
      {formError && <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
      <FormActionButtons onCancel={onCancel} isSubmitting={isSubmitting} isEditing={isEditing} createLabel="Crear convenio" isFormValid={isFormValid} />
    </form>
  );
};
