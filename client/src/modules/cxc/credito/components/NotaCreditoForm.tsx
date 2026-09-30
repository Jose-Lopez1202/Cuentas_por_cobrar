import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea, StatusBadge } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  todayIso,
  validateIdentifier,
  validateMaxLength,
  validateMoney,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, NotaCredito } from '@erp/contracts';

interface NotaCreditoFormProps {
  nota?: NotaCredito | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const NotaCreditoForm = ({ nota, onSuccess, onCancel }: NotaCreditoFormProps) => {
  const isEditing = !!nota;
  const hasApplications = Number(nota?.montoAplicado ?? 0) > 0.005;
  const terminalState = ['APLICADA', 'ANULADA'].includes(String(nota?.estado ?? '').toUpperCase());
  const isLocked = hasApplications || terminalState;

  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<CatalogoOption[]>([]);
  const [idCliente, setIdCliente] = useState(nota?.idCliente?.toString() ?? '');
  const [idDocumentoReferencia, setIdDocumentoReferencia] = useState(nota?.idDocumentoReferencia?.toString() ?? '');
  const [descripcion, setDescripcion] = useState(nota?.descripcion ?? '');
  const [serie, setSerie] = useState(nota?.serie ?? '');
  const [numero, setNumero] = useState(nota?.numero ?? '');
  const [fecha, setFecha] = useState(nota?.fecha?.slice(0, 10) ?? todayIso());
  const [monto, setMonto] = useState(nota?.monto?.toString() ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    if (!idCliente) {
      setDocumentos([]);
      return;
    }
    apiClient
      .get<CatalogoOption[]>(`/cxc/catalogos/clientes/${idCliente}/documentos-pendientes`)
      .then(setDocumentos)
      .catch(() => setDocumentos([]));
  }, [idCliente]);

  const selectedDocumento = documentos.find((d) => String(d.id) === idDocumentoReferencia);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const c = validateRequiredSelect(idCliente, 'un cliente');
    if (c) next.idCliente = c;

    if (serie) {
      const s = validateIdentifier(serie, 'La serie');
      if (s) next.serie = s;
    }
    if (numero) {
      const n = validateIdentifier(numero, 'El número');
      if (n) next.numero = n;
    }

    const f = validateRequiredDate(fecha, 'La fecha', { notFuture: true });
    if (f) next.fecha = f;

    const m = validateMoney(monto, 'El monto', { required: true, positive: true });
    if (m) next.monto = m;
    if (!m && selectedDocumento?.saldo !== undefined && Number(monto) > Number(selectedDocumento.saldo)) {
      next.monto = 'El monto no puede superar el saldo pendiente del documento seleccionado.';
    }

    const d = validateMaxLength(descripcion, 'La descripción', 250);
    if (d) next.descripcion = d;
    return next;
  }, [idCliente, serie, numero, fecha, monto, descripcion, selectedDocumento]);

  const isFormValid = !hasErrors(validationErrors) && !isLocked;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setFormError('La nota ya tiene aplicaciones o está cerrada. Debe reversarse antes de modificarla.');
      return;
    }

    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError(null);
    setIsSubmitting(true);
    const payload = {
      idCliente: Number(idCliente),
      idDocumentoReferencia: idDocumentoReferencia ? Number(idDocumentoReferencia) : null,
      descripcion: descripcion.trim() || null,
      serie: serie.trim().toUpperCase() || null,
      numero: numero.trim().toUpperCase() || null,
      fecha,
      monto: Number(monto),
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/notas-credito/${nota!.idNotaCredito}`, payload);
      else await apiClient.post('/cxc/notas-credito', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fe: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((x) => { fe[x.campo] = x.mensaje; });
        setErrors(fe);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la nota de crédito');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        La nota de crédito no reduce el saldo al registrarse. El efecto financiero ocurre únicamente cuando se aplica a un documento.
      </div>

      {isEditing && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">Estado:</span>
            <StatusBadge status={nota?.estado} />
            <span className="ml-auto text-slate-600">
              Aplicado: <strong>Q {Number(nota?.montoAplicado ?? 0).toFixed(2)}</strong> · Disponible:{' '}
              <strong>Q {Number(nota?.montoDisponible ?? nota?.monto ?? 0).toFixed(2)}</strong>
            </span>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta nota ya tiene aplicaciones o está cerrada. Su cabecera queda bloqueada para proteger la trazabilidad.
        </div>
      )}

      <Select
        label="Cliente"
        required
        value={idCliente}
        onChange={(e: any) => { setIdCliente(e.target.value); setIdDocumentoReferencia(''); }}
        options={clientes.map((c) => ({ value: c.id, label: c.label }))}
        error={errors.idCliente}
        placeholder="Seleccionar cliente"
        helperText="Cliente al que pertenece la nota de crédito."
        isReadOnly={isLocked}
      />

      <Select
        label="Documento de referencia"
        value={idDocumentoReferencia}
        onChange={(e: any) => setIdDocumentoReferencia(e.target.value)}
        options={documentos.map((d) => ({ value: d.id, label: d.label }))}
        placeholder={idCliente ? 'Seleccionar documento (opcional)' : 'Selecciona un cliente primero'}
        isReadOnly={!idCliente || isLocked}
        error={errors.idDocumentoReferencia}
        helperText="Opcional; solo se muestran documentos con saldo pendiente del cliente."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Serie"
          restriction="identifier"
          uppercase
          maxLength={30}
          value={serie}
          onChange={(e: any) => setSerie(e.target.value)}
          error={errors.serie}
          placeholder="Ej. NC"
          helperText="Código alfanumérico; admite -, _ y /."
          isReadOnly={isLocked}
        />
        <TextInput
          label="Número"
          restriction="identifier"
          uppercase
          maxLength={30}
          value={numero}
          onChange={(e: any) => setNumero(e.target.value)}
          error={errors.numero}
          placeholder="Ej. 000001"
          helperText="Referencia alfanumérica de la nota; máximo 30 caracteres."
          isReadOnly={isLocked}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha"
          type="date"
          required
          max={todayIso()}
          value={fecha}
          onChange={(e: any) => setFecha(e.target.value)}
          error={errors.fecha}
          helperText="Fecha real de emisión; no puede ser futura."
          isReadOnly={isLocked}
        />
        <TextInput
          label="Monto"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          step="0.01"
          min="0.01"
          required
          value={monto}
          onChange={(e: any) => setMonto(e.target.value)}
          error={errors.monto}
          placeholder="0.00"
          helperText={
            selectedDocumento?.saldo !== undefined
              ? `Máximo según saldo del documento: Q ${Number(selectedDocumento.saldo).toFixed(2)}.`
              : 'Monto positivo con máximo 2 decimales.'
          }
          isReadOnly={isLocked}
        />
      </div>

      <TextArea
        label="Descripción"
        maxLength={250}
        helperText="Motivo o detalle de la nota de crédito (máx. 250 caracteres)."
        value={descripcion}
        onChange={(e: any) => setDescripcion(e.target.value)}
        rows={3}
        error={errors.descripcion}
        placeholder="Motivo de la nota de crédito"
        isReadOnly={isLocked}
      />

      {formError && <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        createLabel="Crear nota de crédito"
        isFormValid={isFormValid}
      />
    </form>
  );
};
