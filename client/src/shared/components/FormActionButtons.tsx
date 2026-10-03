import { useEffect, useRef, useState } from 'react';
<<<<<<< HEAD
import { Save, X } from 'lucide-react';
import { Button } from '../ui-kit';
=======
import { createPortal } from 'react-dom';
import { Save, X } from 'lucide-react';
import { Button } from '../ui-kit';
import { ConfirmDialog } from './ConfirmDialog';
>>>>>>> origin/develop

interface FormActionButtonsProps {
  onCancel: () => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
  createLabel?: string;
  editLabel?: string;
  savingLabel?: string;
  /** Validez de negocio calculada por el formulario. */
  isFormValid?: boolean;
<<<<<<< HEAD
=======
  /** Textos de la confirmación previa a guardar (tienen valores por defecto). */
  confirmTitle?: string;
  confirmMessage?: string;
  confirmLabel?: string;
  /** true = guarda directo, sin pedir confirmación. */
  skipConfirm?: boolean;
>>>>>>> origin/develop
}

export function FormActionButtons({
  onCancel,
  isSubmitting = false,
  isEditing = false,
  createLabel = 'Guardar',
  editLabel = 'Guardar cambios',
  savingLabel = 'Guardando...',
  isFormValid,
<<<<<<< HEAD
}: FormActionButtonsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [htmlValid, setHtmlValid] = useState(false);
=======
  confirmTitle,
  confirmMessage,
  confirmLabel,
  skipConfirm = false,
}: FormActionButtonsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [htmlValid, setHtmlValid] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmedRef = useRef(false);
  const submittingRef = useRef(isSubmitting);
  submittingRef.current = isSubmitting;
>>>>>>> origin/develop

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

<<<<<<< HEAD
=======
  // Intercepta el submit (botón o Enter): primero pregunta, luego deja pasar.
  useEffect(() => {
    const form = containerRef.current?.closest('form');
    if (!form || skipConfirm) return;

    const onSubmit = (event: Event) => {
      if (confirmedRef.current) {
        confirmedRef.current = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!submittingRef.current) setConfirmOpen(true);
    };

    form.addEventListener('submit', onSubmit, true);
    return () => form.removeEventListener('submit', onSubmit, true);
  }, [skipConfirm]);

  // Escape cierra solo la confirmación, no el modal del formulario que está debajo.
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setConfirmOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [confirmOpen]);

  const handleConfirm = () => {
    setConfirmOpen(false);
    const form = containerRef.current?.closest('form');
    if (!form) return;
    confirmedRef.current = true;
    form.requestSubmit();
    confirmedRef.current = false;
  };

>>>>>>> origin/develop
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
<<<<<<< HEAD
=======

      {/* Portal: fuera del <form>, así sus botones nunca disparan un submit. */}
      {createPortal(
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
          title={confirmTitle ?? (isEditing ? 'Confirmar cambios' : 'Confirmar registro')}
          description={
            confirmMessage ??
            (isEditing
              ? '¿Estás seguro de que deseas guardar los cambios realizados?'
              : '¿Estás seguro de que deseas guardar esta información?')
          }
          confirmLabel={confirmLabel ?? (isEditing ? 'Sí, guardar cambios' : 'Sí, guardar')}
          variant="primary"
        />,
        document.body,
      )}
>>>>>>> origin/develop
    </div>
  );
}
