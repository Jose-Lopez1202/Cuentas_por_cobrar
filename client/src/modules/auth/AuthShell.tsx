import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';

const MODULOS = [
  { nombre: 'Compras', detalle: 'Órdenes y proveedores' },
  { nombre: 'Inventario', detalle: 'Existencias y movimientos' },
  { nombre: 'Cuentas por Pagar', detalle: 'Obligaciones y pagos' },
  { nombre: 'Cuentas por Cobrar', detalle: 'Facturación, cartera y cobranza' },
  { nombre: 'Bancos', detalle: 'Conciliación y tesorería' },
];

export const Marca = ({ claro = false }: { claro?: boolean }) => (
  <div className="flex items-center gap-3">
    <span className={`flex h-9 w-9 items-center justify-center rounded-md text-base font-bold ${claro ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`} aria-hidden="true">E</span>
    <span className="leading-tight">
      <span className={`block text-[15px] font-semibold tracking-tight ${claro ? 'text-white' : 'text-slate-900'}`}>ERP System</span>
      <span className={`block text-[11px] ${claro ? 'text-slate-400' : 'text-slate-500'}`}>Gestión empresarial</span>
    </span>
  </div>
);

/** Pantalla dividida sobria: identidad corporativa a la izquierda, formulario a la derecha. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0e2238] p-12 text-white lg:flex xl:p-16">
        <div className="auth-pattern absolute inset-0" aria-hidden="true" />
        <div className="absolute inset-y-0 right-0 w-px bg-white/10" aria-hidden="true" />

        <div className="relative"><Marca claro /></div>

        <div className="relative max-w-md">
          <h2 className="text-[28px] font-semibold leading-snug tracking-tight">
            Una sola plataforma para la operación administrativa y financiera.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Información centralizada, procesos con trazabilidad y control de accesos por rol.
          </p>

          <dl className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {MODULOS.map((m) => (
              <div key={m.nombre} className="flex items-baseline justify-between gap-6 py-3">
                <dt className="text-sm font-medium text-white">{m.nombre}</dt>
                <dd className="text-right text-xs text-slate-400">{m.detalle}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-slate-400">
          <Lock size={13} aria-hidden="true" />
          <span>Acceso restringido a personal autorizado. La actividad queda registrada.</span>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col px-6 sm:px-12">
        <div className="pt-8 lg:hidden"><Marca /></div>
        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[400px]">{children}</div>
        </div>
        <footer className="pb-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} ERP System · ¿Problemas para ingresar? Contacta al administrador del sistema.
        </footer>
      </main>
    </div>
  );
}
