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
import type { AplicacionAnticipo, CatalogoOption } from '@erp/contracts';

export function AplicacionAnticipoForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: AplicacionAnticipo | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(item);
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [anticipos, setAnticipos] = useState<CatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<CatalogoOption[]>([]);
  const [empleados, setEmpleados] = useState<CatalogoOption[]>([]);
  const [idCliente, setIdCliente] = useState('');
  const [idAnticipo, setIdAnticipo] = useState(item?.idAnticipo?.toString() ?? '');
  const [idDocumento, setIdDocumento] = useState(item?.idDocumento?.toString() ?? '');
  const [idEmpleado, setIdEmpleado] = useState(item?.idEmpleado?.toString() ?? '');
  const [fechaAplicacion, setFecha] = useState(item?.fechaAplicacion?.slice(0, 10) ?? todayIso());
  const [montoAplicado, setMonto] = useState(item?.montoAplicado?.toString() ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(() => setClientes([]));
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/empleados').then(setEmpleados).catch(() => setEmpleados([]));
  }, []);

  useEffect(() => {
    if (!idCliente) {
      setAnticipos([]);
      setDocumentos([]);
      return;
    }
    Promise.all([
      apiClient.get<CatalogoOption[]>(`/cxc/catalogos/clientes/${idCliente}/anticipos-disponibles`),
      apiClient.get<CatalogoOption[]>(`/cxc/catalogos/clientes/${idCliente}/documentos-pendientes`),
    ])
      .then(([anticiposData, documentosData]) => {
        setAnticipos(anticiposData);
        setDocumentos(documentosData);
      })
      .catch(() => {
        setAnticipos([]);
        setDocumentos([]);
      });
  }, [idCliente]);

  const anticipoSeleccionado = anticipos.find((a) => String(a.id) === idAnticipo);
  const documentoSeleccionado = documentos.find((d) => String(d.id) === idDocumento);
  const maxAplicable = Math.min(
    anticipoSeleccionado?.saldo ?? Number.POSITIVE_INFINITY,
    documentoSeleccionado?.saldo ?? Number.POSITIVE_INFINITY,
  );

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};

    const clienteErr = validateRequiredSelect(idCliente, 'un cliente');
    if (clienteErr) next.idCliente = clienteErr;

    const anticipoErr = validateRequiredSelect(idAnticipo, 'un anticipo disponible');
    if (anticipoErr) next.idAnticipo = anticipoErr;

    const documentoErr = validateRequiredSelect(idDocumento, 'un documento pendiente del cliente');
    if (documentoErr) next.idDocumento = documentoErr;

    const empleadoErr = validateRequiredSelect(idEmpleado, 'el empleado que aplica el anticipo');
    if (empleadoErr) next.idEmpleado = empleadoErr;

    const fechaErr = validateRequiredDate(fechaAplicacion, 'La fecha de aplicación', {
      notFuture: true,
      maxDate: todayIso(),
    });
    if (fechaErr) next.fechaAplicacion = fechaErr;

    const montoErr = validateMoney(montoAplicado, 'El monto aplicado', { required: true, positive: true });
    if (montoErr) next.montoAplicado = montoErr;
    else if (Number.isFinite(maxAplicable) && Number(montoAplicado) > maxAplicable) {
      next.montoAplicado = `El monto no puede superar Q ${maxAplicable.toFixed(2)}, según el disponible del anticipo y el saldo del documento.`;
    }

    return next;
  }, [idCliente, idAnticipo, idDocumento, idEmpleado, fechaAplicacion, montoAplicado, maxAplicable]);

  const isFormValid = !hasErrors(validationErrors);
  const errorFor = (field: string, value = '') => errors[field] ?? (value ? validationErrors[field] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }

    setBusy(true);
    setErrors({});
    const payload = {
      idAnticipo: Number(idAnticipo),
      idDocumento: Number(idDocumento),
      idEmpleado: Number(idEmpleado),
      fechaAplicacion,
      montoAplicado: Number(montoAplicado),
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/aplicaciones-anticipo/${item!.idAplicacionAnticipo}`, payload);
      else await apiClient.post('/cxc/aplicaciones-anticipo', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la aplicación');
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
        onChange={(e: any) => {
          setIdCliente(e.target.value);
          setIdAnticipo('');
          setIdDocumento('');
        }}
        options={clientes.map((c) => ({ value: c.id, label: c.label }))}
        placeholder="Seleccionar cliente"
        helperText="El cliente determina qué anticipos y documentos pendientes pueden elegirse."
        error={errorFor('idCliente')}
      />

      <Select
        label="Anticipo"
        required
        value={idAnticipo}
        onChange={(e: any) => setIdAnticipo(e.target.value)}
        options={anticipos.map((x) => ({ value: x.id, label: x.label }))}
        isReadOnly={!idCliente}
        placeholder={idCliente ? 'Seleccionar anticipo disponible' : 'Selecciona un cliente primero'}
        helperText="Solo se muestran anticipos del cliente con monto disponible."
        error={errorFor('idAnticipo')}
      />

      <Select
        label="Documento"
        required
        value={idDocumento}
        onChange={(e: any) => setIdDocumento(e.target.value)}
        options={documentos.map((x) => ({ value: x.id, label: x.label }))}
        isReadOnly={!idCliente}
        placeholder={idCliente ? 'Seleccionar documento pendiente' : 'Selecciona un cliente primero'}
        helperText="Solo se muestran documentos con saldo pendiente del mismo cliente."
        error={errorFor('idDocumento')}
      />

      <Select
        label="Empleado"
        required
        value={idEmpleado}
        onChange={(e: any) => setIdEmpleado(e.target.value)}
        options={empleados.map((x) => ({ value: x.id, label: x.label }))}
        helperText="Empleado responsable de registrar la aplicación."
        error={errorFor('idEmpleado')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha de aplicación"
          type="date"
          required
          max={todayIso()}
          value={fechaAplicacion}
          onChange={(e: any) => setFecha(e.target.value)}
          helperText="Fecha real de la aplicación; no puede ser futura."
          error={errorFor('fechaAplicacion', fechaAplicacion)}
        />
        <TextInput
          label="Monto aplicado"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0.01}
          max={Number.isFinite(maxAplicable) ? maxAplicable : undefined}
          step="0.01"
          required
          value={montoAplicado}
          onChange={(e: any) => setMonto(e.target.value)}
          helperText={
            Number.isFinite(maxAplicable)
              ? `Máximo aplicable: Q ${maxAplicable.toFixed(2)} (menor entre disponible del anticipo y saldo del documento).`
              : 'Mayor a 0, máximo 2 decimales.'
          }
          error={errorFor('montoAplicado', montoAplicado)}
        />
      </div>

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
        createLabel="Guardar aplicación"
      />
    </form>
  );
}
