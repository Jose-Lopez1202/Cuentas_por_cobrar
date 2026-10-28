import { useMemo, useState, type FormEvent } from 'react';
import { TextArea } from '../ui-kit';
import { Modal } from './Modal';
import { CampoUsuarioActual } from './CampoUsuarioActual';
import { FormActionButtons } from './FormActionButtons';
import { apiClient, ApiError } from '../api';
import { hasErrors, type ValidationErrors } from '../validation';

interface TrazabilidadActionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  description?: string;
  endpoint: string;
  actionLabel: string;
  motivoLabel: string;
  motivoFieldName: string;
  motivoHelperText?: string;
}

/**
 * Modal genérico para acciones con trazabilidad obligatoria (reversar una
 * aplicación, anular un pago/nota/documento): pide el motivo
 * (mínimo 10 caracteres, igual que valida el backend) y hace POST al
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
  motivoLabel,
  motivoFieldName,
  motivoHelperText,
}: TrazabilidadActionModalProps) {
  const [motivo, setMotivo] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    if (motivo.trim().length < 10) next.motivo = 'Describe el motivo (mínimo 10 caracteres).';
    else if (motivo.length > 250) next.motivo = 'El motivo no puede superar 250 caracteres.';
    return next;
  }, [motivo]);

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

        <CampoUsuarioActual label="Responsable de la acción" />

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
