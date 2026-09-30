import { useEffect, useRef, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '../ui-kit';

interface FormActionButtonsProps {
  onCancel: () => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
  createLabel?: string;
  editLabel?: string;
  savingLabel?: string;
  /** Validez de negocio calculada por el formulario. */
  isFormValid?: boolean;
}

export function FormActionButtons({
  onCancel,
  isSubmitting = false,
  isEditing = false,
  createLabel = 'Guardar',
  editLabel = 'Guardar cambios',
  savingLabel = 'Guardando...',
  isFormValid,
}: FormActionButtonsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [htmlValid, setHtmlValid] = useState(false);

  useEffect(() => {
    const form = containerRef.current?.closest('form');
    if (!form) return;

    let frameId: number | null = null;
    const updateValidity = () => setHtmlValid(form.checkValidity());
    const scheduleValidity = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateValidity);
    };

    scheduleValidity();
    form.addEventListener('input', scheduleValidity);
    form.addEventListener('change', scheduleValidity);

    const observer = new MutationObserver(scheduleValidity);
    observer.observe(form, { childList: true, subtree: true, attributes: true });

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      form.removeEventListener('input', scheduleValidity);
      form.removeEventListener('change', scheduleValidity);
      observer.disconnect();
    };
  }, []);

  const isComplete = htmlValid && isFormValid !== false;
  const submitLabel = isSubmitting
    ? savingLabel
    : isEditing
      ? editLabel
      : createLabel;

  return (
    <div
      ref={containerRef}
      className="flex justify-end gap-2 pt-2 border-t border-slate-100"
      aria-label="Acciones del formulario"
    >
      <Button
        type="button"
        variant="danger"
        icon={X}
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancelar
      </Button>

      <Button
        type="submit"
        variant={isComplete ? 'success' : 'primary'}
        icon={Save}
        disabled={isSubmitting || !isComplete}
        aria-label={submitLabel}
        title={isComplete ? 'Formulario válido: listo para guardar' : 'Revisa los campos obligatorios y sus reglas'}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
