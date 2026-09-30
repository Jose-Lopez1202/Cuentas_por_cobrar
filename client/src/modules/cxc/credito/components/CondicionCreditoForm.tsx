import React, { useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  validatePercentage,
  validateRequiredNumber,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CondicionCredito } from '@erp/contracts';

interface CondicionCreditoFormProps {
  condicion?: CondicionCredito | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ESTADO_OPTIONS = [
  { value: 'A', label: 'Activo' },
  { value: 'I', label: 'Inactivo' },
];

export const CondicionCreditoForm = ({ condicion, onSuccess, onCancel }: CondicionCreditoFormProps) => {
  const isEditing = !!condicion;
  const [diasCredito, setDiasCredito] = useState(condicion?.diasCredito?.toString() ?? '');
  const [porcentajeMora, setPorcentajeMora] = useState(condicion?.porcentajeMora?.toString() ?? '');
  const [diasGracia, setDiasGracia] = useState(condicion?.diasGracia?.toString() ?? '');
  const [estado, setEstado] = useState(condicion?.estado ?? 'A');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validate = (): ValidationErrors => {
    const next: ValidationErrors = {};
    const dc = validateRequiredNumber(diasCredito, 'Los días de crédito', { integer: true, min: 0, max: 3650 });
    if (dc) next.diasCredito = dc;
    const pm = validatePercentage(porcentajeMora, 'El porcentaje de mora', { required: true, decimalPlaces: 4 });
    if (pm) next.porcentajeMora = pm;
    const dg = validateRequiredNumber(diasGracia, 'Los días de gracia', { integer: true, min: 0, max: 365 });
    if (dg) next.diasGracia = dg;
    return next;
  };

  const isFormValid = useMemo(() => !hasErrors(validate()), [diasCredito, porcentajeMora, diasGracia, estado]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (hasErrors(validationErrors)) { setErrors(validationErrors); return; }
    setErrors({}); setFormError(null); setIsSubmitting(true);
    const payload = { diasCredito: Number(diasCredito), porcentajeMora: Number(porcentajeMora), diasGracia: Number(diasGracia), estado: estado as 'A' | 'I' };
    try {
      if (isEditing) await apiClient.patch(`/cxc/condiciones-credito/${condicion!.idCondicion}`, payload);
      else await apiClient.post('/cxc/condiciones-credito', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => { fieldErrors[d.campo] = d.mensaje; });
        setErrors(fieldErrors);
      } else setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la condición de crédito');
    } finally { setIsSubmitting(false); }
  };

  return <form onSubmit={handleSubmit} className="flex flex-col gap-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Días de crédito" type="number" restriction="integer" required min="0" max="3650" value={diasCredito} onChange={(e: any) => setDiasCredito(e.target.value)} error={errors.diasCredito} placeholder="Ej. 30" helperText="Solo números enteros entre 0 y 3650 días." />
      <TextInput label="Porcentaje de mora" type="number" restriction="decimal" decimalPlaces={4} step="0.0001" min="0" max="100" required value={porcentajeMora} onChange={(e: any) => setPorcentajeMora(e.target.value)} error={errors.porcentajeMora} placeholder="Ej. 2.5" helperText="Porcentaje entre 0 y 100; máximo 4 decimales." />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Días de gracia" type="number" restriction="integer" min="0" max="365" required value={diasGracia} onChange={(e: any) => setDiasGracia(e.target.value)} error={errors.diasGracia} placeholder="Ej. 5" helperText="Solo números enteros entre 0 y 365 días." />
      <Select label="Estado" required value={estado} onChange={(e: any) => setEstado(e.target.value)} options={ESTADO_OPTIONS} error={errors.estado} helperText="Define si la condición puede utilizarse actualmente." />
    </div>
    {formError && <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
    <FormActionButtons onCancel={onCancel} isSubmitting={isSubmitting} isEditing={isEditing} createLabel="Crear condición" isFormValid={isFormValid} />
  </form>;
};
