import React, { useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  validateGuatemalaNit,
  validateMaxLength,
  validateRequired,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { Empresa } from '@erp/contracts';

const ESTADOS_EMPRESA = [
  { value: 'A', label: 'Activa' },
  { value: 'I', label: 'Inactiva' },
];

interface EmpresaFormProps {
  empresa?: Empresa | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EmpresaForm = ({ empresa, onSuccess, onCancel }: EmpresaFormProps) => {
  const isEditing = Boolean(empresa);
  const [nombre, setNombre] = useState(empresa?.nombre ?? '');
  const [nit, setNit] = useState(empresa?.nit ?? '');
  const [estado, setEstado] = useState(empresa?.estado ?? 'A');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const nombreReq = validateRequired(nombre, 'El nombre');
    if (nombreReq) next.nombre = nombreReq;
    const nombreMax = validateMaxLength(nombre, 'El nombre', 150);
    if (nombreMax) next.nombre = nombreMax;
    if (nit) {
      const nitErr = validateGuatemalaNit(nit, 'El NIT');
      if (nitErr) next.nit = nitErr;
    }
    return next;
  }, [nombre, nit]);

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
      nombre: nombre.trim(),
      nit: nit.trim().toUpperCase() || undefined,
      estado,
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/empresas/${empresa!.idEmpresa}`, payload);
      else await apiClient.post('/cxc/empresas', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la empresa');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <TextInput
        label="Nombre"
        required
        maxLength={150}
        value={nombre}
        onChange={(e: any) => setNombre(e.target.value)}
        error={errors.nombre ?? (nombre ? validationErrors.nombre : undefined)}
        helperText="Razón social o nombre comercial; máximo 150 caracteres."
        placeholder="Ej. Distribuidora Central, S.A."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="NIT"
          restriction="nit"
          uppercase
          maxLength={20}
          value={nit}
          onChange={(e: any) => setNit(e.target.value)}
          error={errors.nit ?? (nit ? validationErrors.nit : undefined)}
          helperText="NIT guatemalteco, por ejemplo 1234567-8; también admite CF."
          placeholder="Ej. 1234567-8"
        />
        <Select
          label="Estado"
          required
          value={estado}
          onChange={(e: any) => setEstado(e.target.value)}
          options={ESTADOS_EMPRESA}
          helperText="Controla si la empresa se encuentra disponible para otros catálogos."
        />
      </div>

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
        createLabel="Crear empresa"
      />
    </form>
  );
};
