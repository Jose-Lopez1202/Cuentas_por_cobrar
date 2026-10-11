import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  todayIso,
  validateMoney,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { Anticipo, CatalogoOption } from '@erp/contracts';

export function AnticipoForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: Anticipo | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(item);
  const isLocked = isEditing && item?.estado !== 'DISPONIBLE';
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [pagos, setPagos] = useState<CatalogoOption[]>([]);
  const [idCliente, setCliente] = useState(item?.idCliente?.toString() ?? '');
  const [idPago, setPago] = useState(item?.idPago?.toString() ?? '');
  const [montoOriginal, setOriginal] = useState(item?.montoOriginal?.toString() ?? '');
  const [montoDisponible, setDisponible] = useState(item?.montoDisponible?.toString() ?? '');
  const [fecha, setFecha] = useState(item?.fecha?.slice(0, 10) ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    if (!idCliente) {
      setPagos([]);
      setPago('');
      return;
    }
    apiClient
      .get<CatalogoOption[]>(`/cxc/catalogos/pagos?idCliente=${idCliente}`)
      .then(setPagos)
      .catch(() => setPagos([]));
  }, [idCliente]);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const clienteErr = validateRequiredSelect(idCliente, 'un cliente');
    if (clienteErr) next.idCliente = clienteErr;

    const originalErr = validateMoney(montoOriginal, 'El monto original', { required: true, positive: true });
    if (originalErr) next.montoOriginal = originalErr;

    const disponibleErr = validateMoney(montoDisponible, 'El monto disponible', { required: true, min: 0 });
    if (disponibleErr) next.montoDisponible = disponibleErr;
    else if (montoOriginal && montoDisponible && Number(montoDisponible) > Number(montoOriginal)) {
      next.montoDisponible = 'El monto disponible no puede superar el monto original.';
    }

    const fechaErr = validateRequiredDate(fecha, 'La fecha', { notFuture: true, maxDate: todayIso() });
    if (fechaErr) next.fecha = fechaErr;

    return next;
  }, [idCliente, montoOriginal, montoDisponible, fecha]);

  const isFormValid = !hasErrors(validationErrors) && !isLocked;
  const errorFor = (field: string, value = '') =>
    errors[field] ?? (value ? validationErrors[field] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (isLocked) {
      setFormError('Este anticipo ya tiene aplicaciones o está anulado. Para corregirlo, reversa la aplicación o anúlalo desde la lista.');
      return;
    }
    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setBusy(true);
    const payload = {
      idCliente: Number(idCliente),
      idPago: idPago ? Number(idPago) : undefined,
      montoOriginal: Number(montoOriginal),
      montoDisponible: Number(montoDisponible),
      fecha,
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/anticipos/${item!.idAnticipo}`, payload);
      else await apiClient.post('/cxc/anticipos', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const x: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => { x[d.campo] = d.mensaje; });
        setErrors(x);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el anticipo');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este anticipo ya tiene aplicaciones o está anulado; su cabecera queda bloqueada para proteger la trazabilidad.
        </div>
      )}
      <Select
        label="Cliente"
        required
        value={idCliente}
        onChange={(e: any) => { setCliente(e.target.value); setPago(''); }}
        options={clientes.map((x) => ({ value: x.id, label: x.label }))}
        helperText="Selecciona el cliente propietario del anticipo."
        error={errorFor('idCliente')}
        isReadOnly={isLocked}
      />
      <Select
        label="Pago relacionado"
        value={idPago}
        onChange={(e: any) => setPago(e.target.value)}
        options={pagos.map((x) => ({ value: x.id, label: x.label }))}
        isReadOnly={!idCliente || isLocked}
        placeholder={idCliente ? 'Seleccionar pago (opcional)' : 'Selecciona un cliente primero'}
        helperText="Opcional; solo se muestran pagos del cliente seleccionado."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Monto original"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0.01}
          step="0.01"
          required
          value={montoOriginal}
          onChange={(e: any) => {
            setOriginal(e.target.value);
            if (!isEditing) setDisponible(e.target.value);
          }}
          helperText="Importe inicial del anticipo; mayor a 0."
          error={errorFor('montoOriginal', montoOriginal)}
          isReadOnly={isLocked}
        />
        <TextInput
          label="Monto disponible"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0}
          step="0.01"
          required
          value={montoDisponible}
          onChange={(e: any) => setDisponible(e.target.value)}
          isReadOnly={!isEditing || isLocked}
          helperText={
            isEditing
              ? 'Debe estar entre 0 y el monto original.'
              : 'Al crear inicia automáticamente igual al monto original.'
          }
          error={errorFor('montoDisponible', montoDisponible)}
        />
      </div>
      <TextInput
        label="Fecha"
        type="date"
        required
        max={todayIso()}
        value={fecha}
        onChange={(e: any) => setFecha(e.target.value)}
        helperText="Fecha real del anticipo; no puede ser futura."
        error={errorFor('fecha', fecha)}
        isReadOnly={isLocked}
      />
      {isEditing && (
        <TextInput label="Estado" value={item?.estado ?? ''} isReadOnly helperText="El estado lo administra el motor financiero (aplicar/reversar) o la anulación formal; no se edita aquí." />
      )}

      {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={busy}
        isEditing={isEditing}
        isFormValid={isFormValid} blockers={validationErrors} lockedReason={isLocked ? "El anticipo ya no está disponible, por lo que no admite cambios." : undefined}
        createLabel="Guardar anticipo"
      />
    </form>
  );
}
