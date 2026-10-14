import { Check, Minus } from 'lucide-react';
import type { RequisitoClave } from '@erp/contracts';

const NIVELES = [
  { texto: 'Muy débil', barra: 'bg-red-500', color: 'text-red-600' },
  { texto: 'Débil', barra: 'bg-orange-500', color: 'text-orange-600' },
  { texto: 'Aceptable', barra: 'bg-amber-500', color: 'text-amber-600' },
  { texto: 'Buena', barra: 'bg-lime-600', color: 'text-lime-700' },
  { texto: 'Excelente', barra: 'bg-emerald-600', color: 'text-emerald-700' },
];

/** Barra de seguridad y lista de requisitos en vivo, compartida por las pantallas que crean contraseñas. */
export function RequisitosClave({ valor, requisitos, nivel }: { valor: string; requisitos: RequisitoClave[]; nivel: number }) {
  return (
    <div className="mt-3">
      {valor && (
        <div aria-live="polite" className="mb-3">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < nivel ? NIVELES[nivel].barra : 'bg-slate-200'}`} />)}
          </div>
          <p className={`mt-1.5 text-xs font-medium ${NIVELES[nivel].color}`}>Seguridad: {NIVELES[nivel].texto}</p>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2" aria-label="Requisitos de la contraseña">
        {requisitos.map((r) => {
          const ok = Boolean(valor) && r.cumple;
          return (
            <li key={r.id} className={`flex items-center gap-2 text-xs ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
              {ok ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <Minus size={13} strokeWidth={3} aria-hidden="true" />}
              {r.texto}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
