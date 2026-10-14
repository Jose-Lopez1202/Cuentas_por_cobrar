import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';

/** Piezas compartidas de las pantallas de acceso (login, recuperación y cambio de contraseña). */

export const AuthHeading = ({ titulo, texto }: { titulo: string; texto?: ReactNode }) => (
  <div className="mb-7">
    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
    {texto && <p className="mt-2 text-sm leading-relaxed text-slate-600">{texto}</p>}
  </div>
);

const TONOS = {
  error: { caja: 'border-red-200 bg-red-50 text-red-800', Icono: AlertCircle },
  aviso: { caja: 'border-amber-200 bg-amber-50 text-amber-900', Icono: TriangleAlert },
  ok: { caja: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icono: CheckCircle2 },
} as const;

export function AuthAlert({ tono, children, sacudir }: { tono: keyof typeof TONOS; children: ReactNode; sacudir?: number }) {
  const { caja, Icono } = TONOS[tono];
  return (
    <div key={sacudir} role={tono === 'error' ? 'alert' : 'status'} className={`${tono === 'error' ? 'auth-shake ' : ''}mb-5 flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm ${caja}`}>
      <Icono size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  error?: string;
  ayuda?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  /** Muestra el botón para ver/ocultar el texto (campos de contraseña). */
  alternarVisible?: boolean;
  visible?: boolean;
  onAlternar?: () => void;
}

export function Campo({ label, value, onChange, error, ayuda, inputRef, alternarVisible, visible, onAlternar, id, type = 'text', ...resto }: CampoProps) {
  const auto = useId();
  const inputId = id ?? `campo-${auto.replace(/:/g, '')}`;
  const errorId = `${inputId}-error`;
  const ayudaId = `${inputId}-ayuda`;
  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-800">{label}</label>
      <div className="relative">
        <input
          {...resto}
          ref={inputRef} id={inputId} value={value} onChange={(e) => onChange(e.target.value)}
          type={alternarVisible ? (visible ? 'text' : 'password') : type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : ayuda ? ayudaId : undefined}
          className={`h-11 w-full rounded-md border bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${alternarVisible ? 'pr-11' : ''} ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 hover:border-slate-400 focus:border-blue-700 focus:ring-blue-100'}`}
        />
        {alternarVisible && (
          <button type="button" onClick={onAlternar} aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={visible}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
        )}
      </div>
      {error
        ? <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
        : ayuda && <div id={ayudaId} className="mt-1.5 text-xs text-slate-500">{ayuda}</div>}
    </div>
  );
}

export function BotonPrincipal({ cargando, textoCargando, children, ...props }: { cargando?: boolean; textoCargando?: string; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-800 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
    >
      {cargando ? (<><Loader2 size={17} className="animate-spin" aria-hidden="true" /> {textoCargando ?? 'Procesando…'}</>) : children}
    </button>
  );
}

/** Estado local para alternar la visibilidad de varios campos de contraseña a la vez. */
export const useVisible = () => {
  const [visible, setVisible] = useState(false);
  return { visible, alternar: () => setVisible((v) => !v) };
};
