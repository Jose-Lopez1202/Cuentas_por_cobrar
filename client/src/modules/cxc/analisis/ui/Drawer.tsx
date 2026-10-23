import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Panel lateral para el detalle de una fila: Escape cierra, el foco queda dentro y vuelve al cerrar. */
export function Drawer({ titulo, subtitulo, onCerrar, onVolver, children, ancho = 'max-w-3xl' }: {
  titulo: string;
  subtitulo?: ReactNode;
  onCerrar: () => void;
  /** Si hay un detalle previo, muestra el botón “Volver”. */
  onVolver?: () => void;
  children: ReactNode;
  ancho?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const previo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previo.current = document.activeElement as HTMLElement | null;
    const p = panel.current;
    window.requestAnimationFrame(() => p?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCerrar(); return; }
      if (e.key !== 'Tab' || !p) return;
      const f = Array.from(p.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!f.length) { e.preventDefault(); return; }
      const [a, z] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previo.current?.focus?.();
    };
  }, [onCerrar]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCerrar} aria-hidden="true" />
      <div
        ref={panel} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}
        className={`relative flex h-full w-full ${ancho} flex-col bg-slate-50 shadow-2xl outline-none`}
        style={{ animation: 'drawer-in 160ms ease-out' }}
      >
        <header className="flex items-start gap-3 border-b border-slate-200 bg-white px-5 py-4">
          {onVolver && (
            <button type="button" onClick={onVolver} aria-label="Volver al detalle anterior" className="mt-0.5 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-900">{titulo}</h2>
            {subtitulo && <div className="mt-0.5 text-[12.5px] text-slate-500">{subtitulo}</div>}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar detalle" className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
      </div>
      <style>{`@keyframes drawer-in{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion:reduce){[role=dialog]{animation:none!important}}`}</style>
    </div>,
    document.body,
  );
}

export function Pestanas<T extends string>({ valor, onCambiar, opciones }: {
  valor: T;
  onCambiar: (v: T) => void;
  opciones: Array<{ id: T; etiqueta: string; conteo?: number }>;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-slate-200">
      {opciones.map((o) => (
        <button
          key={o.id} type="button" role="tab" aria-selected={valor === o.id} onClick={() => onCambiar(o.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${valor === o.id ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          {o.etiqueta}{o.conteo !== undefined && <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">{o.conteo}</span>}
        </button>
      ))}
    </div>
  );
}
