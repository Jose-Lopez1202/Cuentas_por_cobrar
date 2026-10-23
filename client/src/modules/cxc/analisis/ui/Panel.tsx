import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

/** Tarjeta de un visual: título, subtítulo y acciones en la cabecera, contenido debajo. */
export function Panel({ titulo, subtitulo, acciones, children, className = '', cuerpoClassName = '', cargando }: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  cuerpoClassName?: string;
  cargando?: boolean;
}) {
  return (
    <section className={`flex flex-col rounded-lg border border-slate-200 bg-white ${className}`} aria-label={titulo}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold text-slate-800">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{subtitulo}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {cargando && <Loader2 size={14} className="animate-spin text-slate-400" aria-label="Actualizando" />}
          {acciones}
        </div>
      </header>
      <div className={`flex-1 p-4 ${cuerpoClassName}`}>{children}</div>
    </section>
  );
}

export function ErrorCaja({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        {mensaje}
        {onReintentar && <button type="button" onClick={onReintentar} className="ml-2 font-semibold underline underline-offset-2">Reintentar</button>}
      </div>
    </div>
  );
}

export function Vacio({ texto, detalle }: { texto: string; detalle?: string }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-slate-600">{texto}</p>
      {detalle && <p className="mt-1 max-w-sm text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}

export function Esqueleto({ alto = 'h-40' }: { alto?: string }) {
  return <div className={`animate-pulse rounded bg-slate-100 ${alto}`} aria-hidden="true" />;
}

/** Encabezado de pantalla: título, descripción y acciones (exportar, actualizar). */
export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion: string; acciones?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
        <p className="mt-0.5 max-w-3xl text-[13px] text-slate-500">{descripcion}</p>
      </div>
      {acciones && <div className="flex items-center gap-2">{acciones}</div>}
    </div>
  );
}
