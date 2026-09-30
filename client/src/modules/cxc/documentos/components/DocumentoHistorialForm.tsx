import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  todayIso,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { DocumentoHistorial, DocumentoCatalogoOption } from '@erp/contracts';

const ESTADOS_DOCUMENTO = ['PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO', 'ANULADO'] as const;
const estadoOptions = ESTADOS_DOCUMENTO.map((value) => ({
  value,
  label: value.charAt(0) + value.slice(1).toLowerCase(),
}));

interface Props {
  idDocumento: number;
  currentEstado: string;
  historial?: DocumentoHistorial | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const DocumentoHistorialForm = ({
  idDocumento,
  currentEstado,
  historial,
  onSuccess,
  onCancel,
}: Props) => {
  const isEditing = Boolean(historial);
  const [empleados, setEmpleados] = useState<DocumentoCatalogoOption[]>([]);
  const estadoAnterior = historial?.estadoAnterior ?? currentEstado;
  const [estadoNuevo, setEstadoNuevo] = useState(historial?.estadoNuevo ?? '');
  const [fecha, setFecha] = useState(historial?.fecha?.slice(0, 10) ?? todayIso());
  const [idEmpleado, setIdEmpleado] = useState(historial?.idEmpleado?.toString() ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/empleados')
      .then(setEmpleados)
      .catch(() => setEmpleados([]));
  }, []);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    if (!ESTADOS_DOCUMENTO.includes(estadoNuevo as (typeof ESTADOS_DOCUMENTO)[number])) {
      next.estadoNuevo = 'Selecciona un estado válido.';
    } else if (!isEditing && estadoNuevo === estadoAnterior) {
      next.estadoNuevo = 'El nuevo estado debe ser diferente al estado actual.';
    }

    const fechaErr = validateRequiredDate(fecha, 'La fecha', {
      notFuture: true,
      maxDate: todayIso(),
    });
    if (fechaErr) next.fecha = fechaErr;

    const empleadoErr = validateRequiredSelect(idEmpleado, 'un empleado');
    if (empleadoErr) next.idEmpleado = empleadoErr;

    return next;
  }, [estadoNuevo, estadoAnterior, fecha, idEmpleado, isEditing]);

  const isFormValid = !hasErrors(validationErrors);
  const errorFor = (field: string, value = '') =>
    errors[field] ?? (value ? validationErrors[field] : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    const payload = {
      estadoAnterior: estadoAnterior || undefined,
      estadoNuevo,
      fecha,
      idEmpleado: Number(idEmpleado),
    };

    try {
      if (isEditing) {
        await apiClient.patch(`/cxc/documentos/historial/${historial!.idHistorial}`, payload);
      } else {
        await apiClient.post(`/cxc/documentos/${idDocumento}/historial`, payload);
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el historial');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Estado anterior"
          value={estadoAnterior ?? ''}
          isReadOnly
          helperText="Se toma del estado actual del documento; no se captura manualmente."
        />
        <Select
          label="Estado nuevo"
          required
          value={estadoNuevo}
          onChange={(e: any) => setEstadoNuevo(e.target.value)}
          options={estadoOptions}
          helperText="Selecciona el nuevo estado; no admite texto libre."
          error={errorFor('estadoNuevo', estadoNuevo)}
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
          helperText="Fecha del cambio; no puede ser futura."
          error={errorFor('fecha', fecha)}
        />
        <Select
          label="Empleado"
          required
          value={idEmpleado}
          onChange={(e: any) => setIdEmpleado(e.target.value)}
          options={empleados.map((e) => ({ value: e.id, label: e.label }))}
          helperText="Empleado que registra el cambio de estado."
          error={errorFor('idEmpleado')}
        />
      </div>

      {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        isFormValid={isFormValid}
        createLabel="Agregar historial"
      />
    </form>
  );
};
