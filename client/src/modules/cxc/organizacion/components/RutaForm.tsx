import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  BUSINESS_DATE_MAX,
  BUSINESS_DATE_MIN,
  hasErrors,
  validateIdentifier,
  validateMaxLength,
  validateRequired,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, Ruta } from '@erp/contracts';

const ESTADOS_RUTA = ['PLANIFICADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'] as const;
const ESTADO_OPTIONS = ESTADOS_RUTA.map((e) => ({ value: e, label: e.replace('_', ' ') }));

interface RutaFormProps {
  ruta?: Ruta | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const RutaForm = ({ ruta, onSuccess, onCancel }: RutaFormProps) => {
  const isEditing = Boolean(ruta);
  const [empleados, setEmpleados] = useState<CatalogoOption[]>([]);
  const [codigoRuta, setCodigoRuta] = useState(ruta?.codigoRuta ?? '');
  const [nombre, setNombre] = useState(ruta?.nombre ?? '');
  const [idEmpleado, setIdEmpleado] = useState(ruta?.idEmpleado?.toString() ?? '');
  const [fecha, setFecha] = useState(ruta?.fecha?.slice(0, 10) ?? '');
  const [estado, setEstado] = useState(ruta?.estado ?? 'PLANIFICADA');
  const [observaciones, setObservaciones] = useState(ruta?.observaciones ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/empleados').then(setEmpleados).catch(() => setEmpleados([]));
  }, []);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    if (codigoRuta) {
      const codeErr = validateIdentifier(codigoRuta, 'El código de ruta');
      if (codeErr) next.codigoRuta = codeErr;
    }
    const nameErr = validateRequired(nombre, 'El nombre');
    if (nameErr) next.nombre = nameErr;
    const nameMax = validateMaxLength(nombre, 'El nombre', 150);
    if (nameMax) next.nombre = nameMax;
    const empErr = validateRequiredSelect(idEmpleado, 'un empleado responsable');
    if (empErr) next.idEmpleado = empErr;
    if (fecha) {
      const dateErr = validateRequiredDate(fecha, 'La fecha', {
        minDate: BUSINESS_DATE_MIN,
        maxDate: BUSINESS_DATE_MAX,
      });
      if (dateErr) next.fecha = dateErr;
    }
    if (observaciones.length > 500) next.observaciones = 'Las observaciones no pueden superar 500 caracteres.';
    return next;
  }, [codigoRuta, nombre, idEmpleado, fecha, observaciones]);

  const isFormValid = !hasErrors(validationErrors);

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
      codigoRuta: codigoRuta.trim().toUpperCase() || undefined,
      nombre: nombre.trim(),
      idEmpleado: Number(idEmpleado),
      fecha: fecha || undefined,
      estado,
      observaciones: observaciones.trim() || undefined,
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/rutas/${ruta!.idRuta}`, payload);
      else await apiClient.post('/cxc/rutas', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la ruta');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Código de ruta"
          restriction="identifier"
          uppercase
          maxLength={20}
          value={codigoRuta}
          onChange={(e: any) => setCodigoRuta(e.target.value)}
          error={errors.codigoRuta ?? (codigoRuta ? validationErrors.codigoRuta : undefined)}
          helperText="Código corto; admite letras, números, -, _ y /."
          placeholder="Ej. RT-001"
        />
        <TextInput
          label="Nombre"
          required
          maxLength={150}
          value={nombre}
          onChange={(e: any) => setNombre(e.target.value)}
          error={errors.nombre ?? (nombre ? validationErrors.nombre : undefined)}
          helperText="Nombre descriptivo de la ruta; máximo 150 caracteres."
          placeholder="Ej. Ruta Zona 9 - Miércoles"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Empleado responsable"
          required
          value={idEmpleado}
          onChange={(e: any) => setIdEmpleado(e.target.value)}
          options={empleados.map((e) => ({ value: e.id, label: e.label }))}
          helperText="Empleado asignado a la ruta."
          error={errors.idEmpleado}
        />
        <TextInput
          label="Fecha"
          type="date"
          min={BUSINESS_DATE_MIN}
          max={BUSINESS_DATE_MAX}
          value={fecha}
          onChange={(e: any) => setFecha(e.target.value)}
          error={errors.fecha ?? (fecha ? validationErrors.fecha : undefined)}
          helperText="Fecha planificada de la ruta."
        />
      </div>

      <Select
        label="Estado"
        required
        value={estado}
        onChange={(e: any) => setEstado(e.target.value)}
        options={ESTADO_OPTIONS}
        helperText="Selecciona un estado válido del ciclo de la ruta."
      />

      <TextArea
        label="Observaciones"
        maxLength={500}
        helperText="Indicaciones generales de la ruta; máximo 500 caracteres."
        value={observaciones}
        onChange={(e: any) => setObservaciones(e.target.value)}
        rows={3}
        error={errors.observaciones}
      />

      {formError && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {formError}
        </p>
      )}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        isFormValid={isFormValid}
        createLabel="Crear ruta"
      />
    </form>
  );
};
