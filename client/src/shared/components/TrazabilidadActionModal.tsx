import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Select, TextArea } from '../ui-kit';
import { Modal } from './Modal';
import { FormActionButtons } from './FormActionButtons';
import { apiClient, ApiError } from '../api';
import { hasErrors, type ValidationErrors } from '../validation';
import type { CatalogoOption } from '@erp/contracts';

interface TrazabilidadActionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  description?: string;
  endpoint: string;
  actionLabel: string;
  empleadoLabel: string;
  empleadoFieldName: string;
  motivoLabel: string;
  motivoFieldName: string;
  motivoHelperText?: string;
}

/**
 * Modal genérico para acciones con trazabilidad obligatoria (reversar una
 * aplicación, anular un pago/nota/documento): pide empleado responsable +
 * motivo (mínimo 10 caracteres, igual que valida el backend) y hace POST al
 * endpoint indicado. Compartido por las 6 pantallas que necesitan esto en
 * vez de repetir el mismo formulario seis veces.
 */
export function TrazabilidadActionModal({
  onClose,
  onSuccess,
  title,
  description,
  endpoint,
  actionLabel,
  empleadoLabel,
  empleadoFieldName,
  motivoLabel,
  motivoFieldName,
  motivoHelperText,
}: TrazabilidadActionModalProps) {
  const [empleados, setEmpleados] = useState<CatalogoOption[]>([]);
  const [idEmpleado, setIdEmpleado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/empleados').then(setEmpleados).catch(() => setEmpleados([]));
  }, []);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    if (!idEmpleado) next.idEmpleado = `Selecciona ${empleadoLabel.toLowerCase()}.`;
    if (motivo.trim().length < 10) next.motivo = 'Describe el motivo (mínimo 10 caracteres).';
    else if (motivo.length > 250) next.motivo = 'El motivo no puede superar 250 caracteres.';
    return next;
  }, [idEmpleado, motivo, empleadoLabel]);

  const isFormValid = !hasErrors(validationErrors);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      await apiClient.post(endpoint, {
        [empleadoFieldName]: Number(idEmpleado),
        [motivoFieldName]: motivo.trim(),
      });
      onSuccess();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : `No se pudo completar: ${actionLabel.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={title} description={description} size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Select
          label={empleadoLabel}
          required
          value={idEmpleado}
          onChange={(e: any) => setIdEmpleado(e.target.value)}
          options={empleados.map((e) => ({ value: e.id, label: e.label }))}
          error={errors.idEmpleado}
        />

        <TextArea
          label={motivoLabel}
          required
          maxLength={250}
          rows={3}
          value={motivo}
          onChange={(e: any) => setMotivo(e.target.value)}
          error={errors.motivo}
          helperText={motivoHelperText ?? 'Obligatorio, mínimo 10 caracteres.'}
        />

        {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}

        <FormActionButtons
          onCancel={onClose}
          isSubmitting={busy}
          isEditing={false}
          isFormValid={isFormValid}
          blockers={validationErrors}
          createLabel={actionLabel}
        />
      </form>
    </Modal>
  );
}
