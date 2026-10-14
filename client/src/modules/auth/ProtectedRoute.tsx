import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { ROL_LABEL, type Rol } from '@erp/contracts';
import { useAuth } from '../../shared/auth/AuthContext';

/** Protege una pantalla: sin sesión va al login (y vuelve aquí al entrar); con clave temporal obliga a cambiarla. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { estado, usuario } = useAuth();
  const location = useLocation();

  if (estado === 'cargando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="animate-spin" size={28} aria-hidden="true" />
          <p className="text-sm">Verificando tu sesión…</p>
        </div>
      </div>
    );
  }
  if (estado === 'anonimo') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (usuario?.debeCambiarClave) {
    return <Navigate to="/cambiar-clave" replace />;
  }
  return <>{children}</>;
}

/** Limita una pantalla a ciertos roles; a los demás les explica por qué no pueden entrar. */
export function RequireRol({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { usuario } = useAuth();
  if (usuario && roles.includes(usuario.rol)) return <>{children}</>;
  return (
    <section role="alert" className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700" aria-hidden="true"><ShieldAlert size={24} /></span>
      <h1 className="text-lg font-bold text-slate-900">No tienes permiso para ver esta pantalla</h1>
      <p className="mt-2 text-sm text-slate-600">
        Esta sección es solo para: {roles.map((r) => ROL_LABEL[r]).join(', ')}. Tu rol actual es {usuario ? ROL_LABEL[usuario.rol] : 'desconocido'}.
        Si la necesitas, pídele a un administrador que cambie tu rol.
      </p>
    </section>
  );
}
