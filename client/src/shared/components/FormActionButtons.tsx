import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Save, X } from 'lucide-react';
import { Button } from '../ui-kit';
import { ConfirmDialog } from './ConfirmDialog';

interface FormActionButtonsProps {
  onCancel: () => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
  createLabel?: string;
  editLabel?: string;
  savingLabel?: string;
  /** Validez de negocio calculada por el formulario. */
  isFormValid?: boolean;
  /** Textos de la confirmación previa a guardar (tienen valores por defecto). */
  confirmTitle?: string;
  confirmMessage?: string;
  confirmLabel?: string;
  /** true = guarda directo, sin pedir confirmación. */
  skipConfirm?: boolean;
  /** Errores de validación del formulario (campo → mensaje); se listan como motivo del bloqueo. */
  blockers?: Record<string, string | undefined>;
  /** Motivo adicional cuando el formulario está bloqueado por una regla que no es de un campo. */
  lockedReason?: string;
  /** Formularios en línea (no modales) no tienen nada que cancelar. */
  hideCancel?: boolean;
}

function labelOf(el: HTMLElement): string {
  const id = el.id;
  const label = id ? el.ownerDocument.querySelector(`label[for="${id}"]`) : null;
  return (label?.textContent ?? el.getAttribute('aria-label') ?? '').replace(/\*/g, '').trim();
}

/** Motivos por los que los campos del formulario no permiten guardar. */
function collectNativeReasons(form: HTMLFormElement): string[] {
  const reasons: string[] = [];
  form.querySelectorAll<HTMLInputElement>('input, select, textarea').forEach((el) => {
    if (el.disabled || el.type === 'hidden' || el.checkValidity()) return;
    const label = labelOf(el) || 'Un campo';
    const v = el.validity;
    if (v.valueMissing) reasons.push(el.tagName === 'SELECT' ? `Debes seleccionar ${label.toLowerCase()}.` : `${label} es obligatorio.`);
    else if (v.customError && el.validationMessage) reasons.push(el.validationMessage);
    else if (v.patternMismatch) reasons.push(`${label} no tiene un formato válido.`);
    else if (v.rangeUnderflow || v.rangeOverflow) reasons.push(`${label} está fuera del rango permitido.`);
    else reasons.push(`${label} no es válido.`);
  });
  return reasons;
}

export function FormActionButtons({
  onCancel,
  isSubmitting = false,
  isEditing = false,
  createLabel = 'Guardar',
  editLabel = 'Guardar cambios',
  savingLabel = 'Guardando...',
  isFormValid,
  confirmTitle,
  confirmMessage,
  confirmLabel,
  skipConfirm = false,
  blockers,
  lockedReason,
  hideCancel = false,
}: FormActionButtonsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [htmlValid, setHtmlValid] = useState(false);
  const [nativeReasons, setNativeReasons] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmedRef = useRef(false);
  const submittingRef = useRef(isSubmitting);
  submittingRef.current = isSubmitting;

  useEffect(() => {
    const form = containerRef.current?.closest('form');
    if (!form) return;

    let frameId: number | null = null;
    const updateValidity = () => {
      setHtmlValid(form.checkValidity());
      setNativeReasons(collectNativeReasons(form));
    };
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

  const isComplete = htmlValid && isFormValid !== false;
  const blockerReasons = Object.values(blockers ?? {}).filter((m): m is string => Boolean(m));
  const reasons = Array.from(new Set([
    ...(lockedReason ? [lockedReason] : []),
    ...blockerReasons,
    ...nativeReasons,
  ]));
  if (!isComplete && reasons.length === 0) {
    reasons.push('Hay datos que no cumplen las reglas del formulario; revisa los campos y sus ayudas.');
  }
  const submitLabel = isSubmitting
    ? savingLabel
    : isEditing
      ? editLabel
      : createLabel;

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-2 pt-2 border-t border-slate-100"
      aria-label="Acciones del formulario"
    >
      {!isComplete && !isSubmitting && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertCircle size={14} aria-hidden="true" /> No se puede guardar todavía porque:
          </p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      )}
      <div className="flex justify-end gap-2">
      {!hideCancel && (
        <Button
          type="button"
          variant="danger"
          icon={X}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      )}

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
    </div>
  );
}
