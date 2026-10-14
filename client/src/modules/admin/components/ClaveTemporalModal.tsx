import { useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { Modal } from '../../../shared/components';
import { Button } from '../../../shared/ui-kit';

/** Muestra la contraseña temporal UNA sola vez: el servidor no la guarda en claro. */
export function ClaveTemporalModal({ username, clave, motivo, onClose }: {
  username: string;
  clave: string;
  motivo: 'creado' | 'restablecida';
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [errorCopia, setErrorCopia] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(clave);
      setCopiado(true);
      setErrorCopia(false);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErrorCopia(true);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeOnBackdrop={false}
      title={motivo === 'creado' ? 'Usuario creado' : 'Contraseña restablecida'}
      description={`Entrégale estos datos a ${username} por un medio seguro.`}
    >
      <div className="space-y-4">
        <dl className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Usuario</dt>
            <dd className="font-semibold text-slate-900">{username}</dd>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <dt className="text-slate-500">Contraseña temporal</dt>
            <dd className="select-all rounded-md bg-white px-2.5 py-1 font-mono text-[15px] font-bold tracking-wide text-slate-900 ring-1 ring-slate-200">{clave}</dd>
          </div>
        </dl>

        <div className="flex gap-2">
          <Button type="button" variant="secondary" icon={copiado ? Check : Copy} onClick={copiar}>
            {copiado ? 'Copiada' : 'Copiar contraseña'}
          </Button>
        </div>
        {errorCopia && <p role="alert" className="text-xs font-medium text-red-600">No se pudo copiar automáticamente: selecciónala y cópiala a mano.</p>}

        <div role="note" className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <strong>Se muestra solo esta vez.</strong> El sistema no la guarda en texto legible, así que no podrás volver a verla.
            Si se pierde, usa «Restablecer contraseña». En su primer ingreso, {username} deberá crear una contraseña propia.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button type="button" onClick={onClose}>Ya la guardé, cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}
