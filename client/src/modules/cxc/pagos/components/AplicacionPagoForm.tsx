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
import type { AplicacionPago, CatalogoOption } from '@erp/contracts';

export function AplicacionPagoForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: AplicacionPago | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(item);
  const [pagos, setPagos] = useState<CatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<CatalogoOption[]>([]);
  const [empleados, setEmpleados] = useState<CatalogoOption[]>([]);
  const [idPago, setIdPago] = useState(item?.idPago?.toString() ?? '');
  const [idDocumento, setIdDocumento] = useState(item?.idDocumento?.toString() ?? '');
  const [fechaAplicacion, setFecha] = useState(item?.fechaAplicacion?.slice(0, 10) ?? todayIso());
  const [montoAplicado, setMonto] = useState(item?.montoAplicado?.toString() ?? '');
  const [idEmpleado, setEmp] = useState(item?.idEmpleado?.toString() ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get<CatalogoOption[]>('/cxc/catalogos/pagos'),
      apiClient.get<CatalogoOption[]>('/cxc/catalogos/empleados'),
    ])
      .then(([pagosData, empleadosData]) => {
        setPagos(pagosData);
        setEmpleados(empleadosData);
      })
      .catch(() => {
        setPagos([]);
        setEmpleados([]);
      });
  }, []);

  const pagoSeleccionado = pagos.find((p) => String(p.id) === idPago);
  const idClientePago = pagoSeleccionado?.idCliente;

  useEffect(() => {
    if (!idClientePago) {
      setDocumentos([]);
      return;
    }

    apiClient
      .get<CatalogoOption[]>(`/cxc/catalogos/clientes/${idClientePago}/documentos-pendientes`)
      .then((data) => {
        setDocumentos(data);
        if (!data.some((doc) => String(doc.id) === idDocumento)) {
          setIdDocumento('');
        }
      })
      .catch(() => {
        setDocumentos([]);
        setIdDocumento('');
      });
  }, [idClientePago]);

  const documentoSeleccionado = documentos.find((d) => String(d.id) === idDocumento);
  const maxAplicable = Math.min(
    pagoSeleccionado?.saldo ?? Number.POSITIVE_INFINITY,
    documentoSeleccionado?.saldo ?? Number.POSITIVE_INFINITY,
  );

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};

    const pagoErr = validateRequiredSelect(idPago, 'un pago');
    if (pagoErr) next.idPago = pagoErr;

    const documentoErr = validateRequiredSelect(idDocumento, 'un documento pendiente del cliente');
    if (documentoErr) next.idDocumento = documentoErr;

    const empleadoErr = validateRequiredSelect(idEmpleado, 'el empleado que aplica el pago');
    if (empleadoErr) next.idEmpleado = empleadoErr;

    const fechaErr = validateRequiredDate(fechaAplicacion, 'La fecha de aplicación', {
      notFuture: true,
      maxDate: todayIso(),
    });
    if (fechaErr) next.fechaAplicacion = fechaErr;

    const montoErr = validateMoney(montoAplicado, 'El monto aplicado', {
      required: true,
      positive: true,
    });
    if (montoErr) next.montoAplicado = montoErr;
    else if (Number.isFinite(maxAplicable) && Number(montoAplicado) > maxAplicable) {
      next.montoAplicado = `El monto no puede superar Q ${maxAplicable.toFixed(2)}, según el disponible del pago y el saldo del documento.`;
    }

    return next;
  }, [idPago, idDocumento, idEmpleado, fechaAplicacion, montoAplicado, maxAplicable]);

  const isFormValid = !hasErrors(validationErrors);
  const errorFor = (field: string, value = '') =>
    errors[field] ?? (value ? validationErrors[field] : undefined);

  const handlePagoChange = (value: string) => {
    setIdPago(value);
    setIdDocumento('');
  };

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
      idPago: Number(idPago),
      idDocumento: Number(idDocumento),
      fechaAplicacion,
      montoAplicado: Number(montoAplicado),
      idEmpleado: Number(idEmpleado),
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/aplicaciones-pago/${item!.idAplicacion}`, payload);
      else await apiClient.post('/cxc/aplicaciones-pago', payload);
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
        label="Pago"
        required
        value={idPago}
        onChange={(e: any) => handlePagoChange(e.target.value)}
        options={pagos.map((x) => ({ value: x.id, label: x.label }))}
        helperText="El pago determina el cliente y limita los documentos que pueden seleccionarse."
        error={errorFor('idPago')}
      />

      <Select
        label="Documento"
        required
        value={idDocumento}
        onChange={(e: any) => setIdDocumento(e.target.value)}
        options={documentos.map((x) => ({ value: x.id, label: x.label }))}
        isReadOnly={!idClientePago}
        placeholder={idClientePago ? 'Seleccionar documento pendiente' : 'Selecciona un pago primero'}
        helperText="Solo se muestran documentos con saldo pendiente del mismo cliente del pago."
        error={errorFor('idDocumento')}
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
          helperText={Number.isFinite(maxAplicable) ? `Máximo aplicable: Q ${maxAplicable.toFixed(2)} (menor entre disponible del pago y saldo del documento).` : "Mayor a 0, máximo 2 decimales."}
          error={errorFor('montoAplicado', montoAplicado)}
        />
      </div>

      <Select
        label="Empleado"
        required
        value={idEmpleado}
        onChange={(e: any) => setEmp(e.target.value)}
        options={empleados.map((x) => ({ value: x.id, label: x.label }))}
        helperText="Empleado responsable de registrar la aplicación."
        error={errorFor('idEmpleado')}
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
        createLabel="Guardar aplicación"
      />
    </form>
  );
}
