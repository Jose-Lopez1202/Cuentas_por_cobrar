import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  validateMaxLength,
  validateRequired,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, Sucursal } from '@erp/contracts';

const ESTADOS_SUCURSAL = [
  { value: 'A', label: 'Activa' },
  { value: 'I', label: 'Inactiva' },
];

interface SucursalFormProps {
  sucursal?: Sucursal | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const SucursalForm = ({ sucursal, onSuccess, onCancel }: SucursalFormProps) => {
  const isEditing = Boolean(sucursal);
  const [empresas, setEmpresas] = useState<CatalogoOption[]>([]);
  const [idEmpresa, setIdEmpresa] = useState(sucursal?.idEmpresa?.toString() ?? '');
  const [nombre, setNombre] = useState(sucursal?.nombre ?? '');
  const [direccion, setDireccion] = useState(sucursal?.direccion ?? '');
  const [estado, setEstado] = useState(sucursal?.estado ?? 'A');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<CatalogoOption[]>('/cxc/empresas/options').then(setEmpresas).catch(() => setEmpresas([]));
  }, []);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const empresaErr = validateRequiredSelect(idEmpresa, 'una empresa');
    if (empresaErr) next.idEmpresa = empresaErr;
    const nombreErr = validateRequired(nombre, 'El nombre de la sucursal');
    if (nombreErr) next.nombre = nombreErr;
    const nombreMax = validateMaxLength(nombre, 'El nombre de la sucursal', 150);
    if (nombreMax) next.nombre = nombreMax;
    const dirMax = validateMaxLength(direccion, 'La dirección', 200);
    if (dirMax) next.direccion = dirMax;
    return next;
  }, [idEmpresa, nombre, direccion]);

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
      idEmpresa: Number(idEmpresa),
      nombre: nombre.trim(),
      direccion: direccion.trim() || undefined,
      estado,
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/sucursales/${sucursal!.idSucursal}`, payload);
      else await apiClient.post('/cxc/sucursales', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la sucursal');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Select
        label="Empresa"
        required
        value={idEmpresa}
        onChange={(e: any) => setIdEmpresa(e.target.value)}
        options={empresas.map((e) => ({ value: e.id, label: e.label }))}
        helperText="Selecciona la empresa propietaria de la sucursal."
        error={errors.idEmpresa}
      />

      <TextInput
        label="Nombre de la sucursal"
        required
        maxLength={150}
        value={nombre}
        onChange={(e: any) => setNombre(e.target.value)}
        error={errors.nombre ?? (nombre ? validationErrors.nombre : undefined)}
        helperText="Nombre visible de la sede; máximo 150 caracteres."
        placeholder="Ej. Sucursal Zona 9"
      />

      <TextInput
        label="Dirección"
        maxLength={200}
        value={direccion}
        onChange={(e: any) => setDireccion(e.target.value)}
        error={errors.direccion ?? (direccion ? validationErrors.direccion : undefined)}
        helperText="Dirección física; máximo 200 caracteres."
        placeholder="Opcional"
      />

      <Select
        label="Estado"
        required
        value={estado}
        onChange={(e: any) => setEstado(e.target.value)}
        options={ESTADOS_SUCURSAL}
        helperText="Las sucursales inactivas no deberían seleccionarse en procesos nuevos."
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
        createLabel="Crear sucursal"
      />
    </form>
  );
};
