import React, { useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  validateIdentifier,
  validateMaxLength,
  validateRequired,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { TipoDocumento } from '@erp/contracts';

interface Props {
  tipo?: TipoDocumento | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TipoDocumentoForm = ({ tipo, onSuccess, onCancel }: Props) => {
  const isEditing = Boolean(tipo);
  const [codigo, setCodigo] = useState(tipo?.codigo ?? '');
  const [nombre, setNombre] = useState(tipo?.nombre ?? '');
  const [naturaleza, setNaturaleza] = useState(tipo?.naturaleza ?? '');
  const [estado, setEstado] = useState(tipo?.estado ?? 'A');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const codigoReq = validateRequired(codigo, 'El código');
    if (codigoReq) next.codigo = codigoReq;
    else {
      const codigoErr = validateIdentifier(codigo, 'El código');
      if (codigoErr) next.codigo = codigoErr;
    }

    const nombreReq = validateRequired(nombre, 'El nombre');
    if (nombreReq) next.nombre = nombreReq;
    const nombreMax = validateMaxLength(nombre, 'El nombre', 80);
    if (nombreMax) next.nombre = nombreMax;

    if (naturaleza && !['CARGO', 'CREDITO'].includes(naturaleza)) {
      next.naturaleza = 'Selecciona CARGO o CREDITO.';
    }
    return next;
  }, [codigo, nombre, naturaleza]);

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
      codigo: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      naturaleza: naturaleza || undefined,
      estado,
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/tipos-documento/${tipo!.idTipoDocumento}`, payload);
      else await apiClient.post('/cxc/tipos-documento', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el tipo de documento');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Código"
          required
          restriction="identifier"
          uppercase
          maxLength={20}
          helperText="Código corto y único; admite letras, números, -, _ y /."
          value={codigo}
          onChange={(e: any) => setCodigo(e.target.value)}
          error={errors.codigo ?? (codigo ? validationErrors.codigo : undefined)}
        />
        <Select
          label="Estado"
          required
          value={estado}
          onChange={(e: any) => setEstado(e.target.value)}
          options={[
            { value: 'A', label: 'Activo' },
            { value: 'I', label: 'Inactivo' },
          ]}
          helperText="Los tipos inactivos no deben mostrarse en documentos nuevos."
        />
      </div>

      <TextInput
        label="Nombre"
        required
        maxLength={80}
        helperText="Nombre descriptivo que verá el usuario; máximo 80 caracteres."
        value={nombre}
        onChange={(e: any) => setNombre(e.target.value)}
        error={errors.nombre ?? (nombre ? validationErrors.nombre : undefined)}
      />

      <Select
        label="Naturaleza"
        value={naturaleza}
        onChange={(e: any) => setNaturaleza(e.target.value)}
        placeholder="Seleccionar naturaleza (opcional)"
        options={[
          { value: 'CARGO', label: 'Cargo' },
          { value: 'CREDITO', label: 'Crédito' },
        ]}
        helperText="Cargo aumenta la deuda; Crédito la disminuye. No se captura texto libre."
        error={errors.naturaleza}
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
        createLabel="Crear tipo"
      />
    </form>
  );
};
