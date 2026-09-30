import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  todayIso,
  validateIdentifier,
  validateMoney,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { Recibo, CatalogoOption } from '@erp/contracts';

const ESTADOS_RECIBO = ['EMITIDO', 'CANCELADO'] as const;

export function ReciboForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: Recibo | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(item);
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [pagos, setPagos] = useState<CatalogoOption[]>([]);
  const [idCliente, setCliente] = useState(item?.idCliente?.toString() ?? '');
  const [idPago, setPago] = useState(item?.idPago?.toString() ?? '');
  const [numeroRecibo, setNumero] = useState(item?.numeroRecibo ?? '');
  const [fecha, setFecha] = useState(item?.fecha?.slice(0, 10) ?? '');
  const [monto, setMonto] = useState(item?.monto?.toString() ?? '');
  const [estado, setEstado] = useState(item?.estado ?? 'EMITIDO');
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

  const pagoSeleccionado = pagos.find((p) => String(p.id) === idPago);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};

    const clienteErr = validateRequiredSelect(idCliente, 'un cliente');
    if (clienteErr) next.idCliente = clienteErr;

    const pagoErr = validateRequiredSelect(idPago, 'un pago del cliente');
    if (pagoErr) next.idPago = pagoErr;

    if (numeroRecibo) {
      const numeroErr = validateIdentifier(numeroRecibo, 'El número de recibo');
      if (numeroErr) next.numeroRecibo = numeroErr;
    }

    const fechaErr = validateRequiredDate(fecha, 'La fecha', { notFuture: true, maxDate: todayIso() });
    if (fechaErr) next.fecha = fechaErr;

    const montoErr = validateMoney(monto, 'El monto', { required: true, positive: true });
    if (montoErr) next.monto = montoErr;
    else if (pagoSeleccionado?.monto !== undefined && Number(monto) > Number(pagoSeleccionado.monto)) {
      next.monto = `El monto del recibo no puede superar el pago seleccionado (${Number(pagoSeleccionado.monto).toFixed(2)}).`;
    }

    return next;
  }, [idCliente, idPago, numeroRecibo, fecha, monto, estado, pagoSeleccionado]);

  const isFormValid = !hasErrors(validationErrors);
  const errorFor = (field: string, value = '') =>
    errors[field] ?? (value ? validationErrors[field] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setBusy(true);
    const payload = {
      idCliente: Number(idCliente),
      idPago: Number(idPago),
      numeroRecibo: numeroRecibo.trim() || undefined,
      fecha,
      monto: Number(monto),
      estado,
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/recibos/${item!.idRecibo}`, payload);
      else await apiClient.post('/cxc/recibos', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const x: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => { x[d.campo] = d.mensaje; });
        setErrors(x);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el recibo');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Select
        label="Cliente"
        required
        value={idCliente}
        onChange={(e: any) => { setCliente(e.target.value); setPago(''); }}
        options={clientes.map((x) => ({ value: x.id, label: x.label }))}
        helperText="Selecciona el cliente al que pertenece el recibo."
        error={errorFor('idCliente')}
      />
      <Select
        label="Pago"
        required
        value={idPago}
        onChange={(e: any) => setPago(e.target.value)}
        options={pagos.map((x) => ({ value: x.id, label: x.label }))}
        isReadOnly={!idCliente}
        placeholder={idCliente ? 'Seleccionar pago' : 'Selecciona un cliente primero'}
        helperText="Solo se muestran pagos del cliente seleccionado."
        error={errorFor('idPago')}
      />
      <TextInput
        label="Número de recibo"
        restriction="identifier"
        uppercase
        maxLength={30}
        helperText="Correlativo del recibo; admite letras, números, -, _ y /."
        value={numeroRecibo}
        onChange={(e: any) => setNumero(e.target.value)}
        error={errorFor('numeroRecibo', numeroRecibo)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha"
          type="date"
          required
          max={todayIso()}
          value={fecha}
          onChange={(e: any) => setFecha(e.target.value)}
          helperText="Fecha de emisión; no puede ser futura."
          error={errorFor('fecha', fecha)}
        />
        <TextInput
          label="Monto"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0.01}
          step="0.01"
          required
          value={monto}
          onChange={(e: any) => setMonto(e.target.value)}
          helperText="Mayor a 0 y no puede superar el monto del pago seleccionado."
          error={errorFor('monto', monto)}
        />
      </div>
      <Select
        label="Estado"
        required
        value={estado}
        onChange={(e: any) => setEstado(e.target.value)}
        options={ESTADOS_RECIBO.map((value) => ({
          value,
          label: value.charAt(0) + value.slice(1).toLowerCase(),
        }))}
        helperText="Selecciona el estado actual del recibo."
      />

      {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={busy}
        isEditing={isEditing}
        isFormValid={isFormValid}
        createLabel="Guardar recibo"
      />
    </form>
  );
}
