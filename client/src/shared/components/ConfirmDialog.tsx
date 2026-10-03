<<<<<<< HEAD
=======
import { useEffect } from 'react';
>>>>>>> origin/develop
import { Modal } from './Modal';
import { Button } from '../ui-kit';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

/**
 * Confirmación estandarizada para acciones irreversibles (eliminar empresa,
 * eliminar ruta, eliminar gestión, eliminar convenio, etc.). Reutilizar en
 * vez de un window.confirm() nativo o un modal de confirmación distinto
 * por pantalla.
 */
export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) => {
<<<<<<< HEAD
=======
  // Escape cierra solo esta confirmación, no el modal de formulario que esté debajo.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (!isLoading) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, isLoading, onClose]);

>>>>>>> origin/develop
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600">{description}</p>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancelar
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={isLoading}>
          {isLoading ? 'Procesando...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};