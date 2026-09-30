import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, StatusBadge } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  todayIso,
  validateIdentifier,
  validateMoney,
  validateRequired,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, FormaPagoOption, Pago } from '@erp/contracts';

const REGISTRATION_STATES = [
  { value: 'NO_IDENTIFICADO', label: 'No identificado' },
  { value: 'NO_APLICADO', label: 'No aplicado' },
  { value: 'EN_CUENTA', label: 'En cuenta' },
];

export function PagoForm({
  pago,
  onSuccess,
  onCancel,
}: {
  pago?: Pago | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(pago);
  const hasApplications = Number(pago?.montoAplicado ?? 0) > 0.005;
  const terminalState = ['APLICADO', 'REVERSADO', 'ANULADO'].includes(String(pago?.estado ?? '').toUpperCase());
  const isLocked = hasApplications || terminalState;

  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [formas, setFormas] = useState<FormaPagoOption[]>([]);
  const [monedas, setMonedas] = useState<CatalogoOption[]>([]);
  const [bancos, setBancos] = useState<CatalogoOption[]>([]);

  const [idCliente, setIdCliente] = useState(pago?.idCliente?.toString() ?? '');
  const [idFormaPago, setIdFormaPago] = useState(pago?.idFormaPago?.toString() ?? '');
  const [idMoneda, setIdMoneda] = useState(pago?.idMoneda?.toString() ?? '');
  const [idBanco, setIdBanco] = useState(pago?.idBanco?.toString() ?? '');
  const [fechaPago, setFechaPago] = useState(pago?.fechaPago?.slice(0, 10) ?? todayIso());
  const [monto, setMonto] = useState(pago?.monto?.toString() ?? '');
  const [numeroReferencia, setNumeroReferencia] = useState(pago?.numeroReferencia ?? '');
  const [estado, setEstado] = useState(pago?.estado ?? 'NO_APLICADO');

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes'),
      apiClient.get<FormaPagoOption[]>('/cxc/catalogos/formas-pago'),
      apiClient.get<CatalogoOption[]>('/cxc/catalogos/monedas'),
      apiClient.get<CatalogoOption[]>('/cxc/catalogos/bancos'),
    ])
      .then(([clientesData, formasData, monedasData, bancosData]) => {
        setClientes(clientesData);
        setFormas(formasData);
        setMonedas(monedasData);
        setBancos(bancosData);
      })
      .catch(() => {
        setClientes([]);
        setFormas([]);
        setMonedas([]);
        setBancos([]);
      });
  }, []);

  const formaSeleccionada = formas.find((f) => String(f.id) === idFormaPago);
  const stateOptions = useMemo(() => {
    if (!estado || REGISTRATION_STATES.some((option) => option.value === estado)) return REGISTRATION_STATES;
    return [...REGISTRATION_STATES, { value: estado, label: estado.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) }];
  }, [estado]);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};

    const clienteErr = validateRequiredSelect(idCliente, 'un cliente');
    if (clienteErr) next.idCliente = clienteErr;

    const formaErr = validateRequiredSelect(idFormaPago, 'una forma de pago');
    if (formaErr) next.idFormaPago = formaErr;

    const monedaErr = validateRequiredSelect(idMoneda, 'una moneda');
    if (monedaErr) next.idMoneda = monedaErr;

    const fechaErr = validateRequiredDate(fechaPago, 'La fecha de pago', { notFuture: true, maxDate: todayIso() });
    if (fechaErr) next.fechaPago = fechaErr;

    const montoErr = validateMoney(monto, 'El monto', { required: true, positive: true });
    if (montoErr) next.monto = montoErr;

    if (formaSeleccionada?.requiereReferencia) {
      const refRequired = validateRequired(numeroReferencia, 'La referencia');
      if (refRequired) next.numeroReferencia = refRequired;
    }
    if (numeroReferencia) {
      const refErr = validateIdentifier(numeroReferencia, 'La referencia');
      if (refErr) next.numeroReferencia = refErr;
    }

    if (!['NO_IDENTIFICADO', 'NO_APLICADO', 'EN_CUENTA'].includes(estado) && !isLocked) {
      next.estado = 'Selecciona un estado válido para registrar el pago.';
    }

    return next;
  }, [idCliente, idFormaPago, idMoneda, fechaPago, monto, numeroReferencia, estado, formaSeleccionada, isLocked]);

  const isFormValid = !hasErrors(validationErrors) && !isLocked;
  const errorFor = (field: string, touchedValue = '') =>
    errors[field] ?? (touchedValue ? validationErrors[field] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isLocked) {
      setFormError('El pago ya tiene aplicaciones o está cerrado. Debe reversarse antes de modificarlo.');
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
      idFormaPago: Number(idFormaPago),
      idMoneda: Number(idMoneda),
      idBanco: idBanco ? Number(idBanco) : undefined,
      fechaPago,
      monto: Number(monto),
      numeroReferencia: numeroReferencia.trim() || undefined,
      estado,
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/pagos/${pago!.idPago}`, payload);
      else await apiClient.post('/cxc/pagos', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el pago');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {isEditing && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">Estado:</span>
            <StatusBadge status={pago?.estado} />
            <span className="ml-auto text-slate-600">
              Aplicado: <strong>Q {Number(pago?.montoAplicado ?? 0).toFixed(2)}</strong> · Disponible:{' '}
              <strong>Q {Number(pago?.montoDisponible ?? pago?.monto ?? 0).toFixed(2)}</strong>
            </span>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este pago ya tiene aplicaciones o está cerrado. Para corregirlo debe utilizarse el flujo de reversión.
        </div>
      )}

      <Select
        label="Cliente"
        required
        value={idCliente}
        onChange={(e: any) => setIdCliente(e.target.value)}
        options={clientes.map((x) => ({ value: x.id, label: x.label }))}
        helperText="Selecciona el cliente al que pertenece el pago."
        error={errorFor('idCliente')}
        isReadOnly={isLocked}
      />

      <Select
        label="Forma de pago"
        required
        value={idFormaPago}
        onChange={(e: any) => setIdFormaPago(e.target.value)}
        options={formas.map((x) => ({ value: x.id, label: x.label }))}
        helperText="La referencia será obligatoria si la forma de pago así lo requiere."
        error={errorFor('idFormaPago')}
        isReadOnly={isLocked}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Moneda"
          required
          value={idMoneda}
          onChange={(e: any) => setIdMoneda(e.target.value)}
          options={monedas.map((x) => ({ value: x.id, label: x.label }))}
          helperText="Selecciona una moneda del catálogo maestro."
          error={errorFor('idMoneda')}
          isReadOnly={isLocked}
        />
        <Select
          label="Banco"
          placeholder="Ninguno (opcional)"
          value={idBanco}
          onChange={(e: any) => setIdBanco(e.target.value)}
          options={bancos.map((x) => ({ value: x.id, label: x.label }))}
          helperText="Opcional. Solo aplica si el pago se recibió por transferencia/depósito bancario."
          error={errorFor('idBanco')}
          isReadOnly={isLocked}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha de pago"
          type="date"
          required
          max={todayIso()}
          value={fechaPago}
          onChange={(e: any) => setFechaPago(e.target.value)}
          helperText="Fecha real del pago; no puede ser futura."
          error={errorFor('fechaPago', fechaPago)}
          isReadOnly={isLocked}
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
          helperText="Monto recibido; mayor a 0 y máximo 2 decimales."
          error={errorFor('monto', monto)}
          isReadOnly={isLocked}
        />
      </div>

      <TextInput
        label="Número de referencia"
        restriction="identifier"
        uppercase
        maxLength={80}
        required={Boolean(formaSeleccionada?.requiereReferencia)}
        helperText={
          formaSeleccionada?.requiereReferencia
            ? 'Obligatoria para la forma de pago seleccionada.'
            : 'Referencia opcional del medio de pago.'
        }
        value={numeroReferencia}
        onChange={(e: any) => setNumeroReferencia(e.target.value)}
        error={errorFor('numeroReferencia', numeroReferencia)}
        isReadOnly={isLocked}
      />

      <Select
        label="Estado al registrar"
        required
        value={estado}
        onChange={(e: any) => setEstado(e.target.value)}
        options={stateOptions}
        helperText="Después de aplicar el pago, el estado lo administra automáticamente el motor financiero."
        error={errorFor('estado', estado)}
        isReadOnly={isLocked}
      />

      {formError && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {formError}
        </p>
      )}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={busy}
        isEditing={isEditing}
        isFormValid={isFormValid}
        createLabel="Guardar pago"
      />
    </form>
  );
}
