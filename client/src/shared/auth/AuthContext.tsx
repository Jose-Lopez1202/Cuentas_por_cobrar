import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SesionRespuesta, UsuarioSesion } from '@erp/contracts';
import { apiClient, authEvents, refreshAccessToken, setAccessToken } from '../api';

type Estado = 'cargando' | 'anonimo' | 'autenticado';

interface AuthContextValue {
  estado: Estado;
  usuario: UsuarioSesion | null;
  /** Mensaje para mostrar en el login cuando la sesión terminó sola (inactividad, expiración...). */
  avisoSesion: string | null;
  login: (username: string, password: string) => Promise<UsuarioSesion>;
  logout: () => Promise<void>;
  cambiarClave: (claveActual: string, claveNueva: string) => Promise<UsuarioSesion>;
  limpiarAviso: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Minutos sin tocar la pantalla antes de cerrar la sesión (el servidor aplica el mismo límite). */
const IDLE_MINUTES = 30;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [avisoSesion, setAviso] = useState<string | null>(null);
  const lastActivity = useRef(Date.now());

  const aplicar = useCallback((s: SesionRespuesta) => {
    setAccessToken(s.accessToken);
    setUsuario(s.usuario);
    setEstado('autenticado');
    lastActivity.current = Date.now();
    return s.usuario;
  }, []);

  const terminar = useCallback((aviso: string | null) => {
    setAccessToken(null);
    setUsuario(null);
    setEstado('anonimo');
    if (aviso) setAviso(aviso);
  }, []);

  // Al abrir la aplicación: intenta recuperar la sesión con la cookie de renovación.
  useEffect(() => {
    let cancelado = false;
    refreshAccessToken().then((s) => {
      if (cancelado) return;
      if (s) aplicar(s as SesionRespuesta);
      else setEstado('anonimo');
    });
    return () => { cancelado = true; };
  }, [aplicar]);

  // El cliente API avisa cuando el servidor ya no reconoce la sesión.
  useEffect(() => {
    const perdida = () => terminar('Tu sesión terminó. Inicia sesión de nuevo para continuar.');
    const cambioClave = () => setUsuario((u) => (u ? { ...u, debeCambiarClave: true } : u));
    authEvents.addEventListener('session-lost', perdida);
    authEvents.addEventListener('password-change-required', cambioClave);
    return () => {
      authEvents.removeEventListener('session-lost', perdida);
      authEvents.removeEventListener('password-change-required', cambioClave);
    };
  }, [terminar]);

  // Cierre por inactividad.
  useEffect(() => {
    if (estado !== 'autenticado') return;
    const marcar = () => { lastActivity.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, marcar, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_MINUTES * 60_000) {
        apiClient.post('/auth/logout', {}, { successMessage: false }).catch(() => undefined);
        terminar(`Cerramos tu sesión tras ${IDLE_MINUTES} minutos sin actividad.`);
      }
    }, 30_000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, marcar));
      window.clearInterval(timer);
    };
  }, [estado, terminar]);

  const login = useCallback(async (username: string, password: string) => {
    const s = await apiClient.post<SesionRespuesta>('/auth/login', { username, password }, { successMessage: false });
    setAviso(null);
    return aplicar(s);
  }, [aplicar]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout', {}, { successMessage: false });
    } catch {
      // Aunque el servidor no responda, la sesión local debe cerrarse.
    }
    terminar(null);
  }, [terminar]);

  const cambiarClave = useCallback(async (claveActual: string, claveNueva: string) => {
    const s = await apiClient.post<SesionRespuesta>('/auth/cambiar-clave', { claveActual, claveNueva }, { successMessage: 'Contraseña actualizada correctamente.' });
    return aplicar(s);
  }, [aplicar]);

  const value = useMemo<AuthContextValue>(() => ({
    estado, usuario, avisoSesion, login, logout, cambiarClave, limpiarAviso: () => setAviso(null),
  }), [estado, usuario, avisoSesion, login, logout, cambiarClave]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
