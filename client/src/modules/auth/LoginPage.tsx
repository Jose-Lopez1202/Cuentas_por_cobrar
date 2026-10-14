import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../shared/api';
import { useAuth } from '../../shared/auth/AuthContext';
import { AuthShell } from './AuthShell';
import { AuthAlert, AuthHeading, BotonPrincipal, Campo, useVisible } from './authUi';

const USER_KEY = 'erp.ultimoUsuario';

const readRemembered = (): string => {
  try { return localStorage.getItem(USER_KEY) ?? ''; } catch { return ''; }
};
const writeRemembered = (value: string | null) => {
  try { if (value) localStorage.setItem(USER_KEY, value); else localStorage.removeItem(USER_KEY); } catch { /* sin almacenamiento: no pasa nada */ }
};

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function LoginPage() {
  const { estado, usuario, login, avisoSesion, limpiarAviso } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; claveActualizada?: boolean } | null;
  const from = state?.from;

  const recordado = useRef(readRemembered());
  const [username, setUsername] = useState(recordado.current);
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(Boolean(recordado.current));
  const { visible, alternar } = useVisible();
  const [mayusculas, setMayusculas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<{ username?: string; password?: string }>({});
  const [espera, setEspera] = useState(0);
  const [sacudir, setSacudir] = useState(0);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => { (recordado.current ? passRef : userRef).current?.focus(); }, []);

  // Cuenta regresiva cuando el servidor limita los intentos.
  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  if (estado === 'autenticado' && usuario) {
    return <Navigate to={usuario.debeCambiarClave ? '/cambiar-clave' : from ?? '/'} replace />;
  }

  const validar = () => {
    const next: { username?: string; password?: string } = {};
    if (!username.trim()) next.username = 'Ingresa tu usuario.';
    if (!password) next.password = 'Ingresa tu contraseña.';
    setErrores(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || espera > 0) return;
    setError(null);
    limpiarAviso();
    if (!validar()) { setSacudir((n) => n + 1); return; }
    setEnviando(true);
    try {
      const u = await login(username.trim(), password);
      writeRemembered(recordar ? username.trim() : null);
      navigate(u.debeCambiarClave ? '/cambiar-clave' : from ?? '/', { replace: true });
    } catch (err) {
      setPassword('');
      setSacudir((n) => n + 1);
      if (err instanceof ApiError && err.status === 429) {
        setEspera(err.retryAfter ?? 60);
        setError('Demasiados intentos fallidos. Por seguridad, espera antes de volver a intentarlo.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Usuario o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.');
      } else if (err instanceof ApiError && err.status === 408) {
        setError(err.message);
      } else if (err instanceof TypeError) {
        setError('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      }
      passRef.current?.focus();
    } finally {
      setEnviando(false);
    }
  };

  const detectarMayusculas = (e: KeyboardEvent<HTMLInputElement>) => setMayusculas(e.getModifierState('CapsLock'));
  const bloqueado = espera > 0;

  return (
    <AuthShell>
      <AuthHeading titulo="Iniciar sesión" texto="Ingresa con las credenciales asignadas por tu organización." />

      {state?.claveActualizada && !error && <AuthAlert tono="ok">Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.</AuthAlert>}
      {avisoSesion && !error && <AuthAlert tono="aviso">{avisoSesion}</AuthAlert>}
      {error && (
        <AuthAlert tono="error" sacudir={sacudir}>
          {error}
          {bloqueado && <strong className="mt-1 block">Podrás intentarlo en {mmss(espera)}</strong>}
        </AuthAlert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Campo
          label="Usuario" id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={50}
          inputRef={userRef} value={username} error={errores.username}
          onChange={(v) => { setUsername(v); if (errores.username) setErrores((x) => ({ ...x, username: undefined })); }}
          onBlur={() => !username.trim() && setErrores((x) => ({ ...x, username: 'Ingresa tu usuario.' }))}
        />

        <div>
          <Campo
            label="Contraseña" id="login-password" name="password" autoComplete="current-password" maxLength={128}
            inputRef={passRef} value={password} error={errores.password}
            alternarVisible visible={visible} onAlternar={alternar}
            onChange={(v) => { setPassword(v); if (errores.password) setErrores((x) => ({ ...x, password: undefined })); }}
            onKeyUp={detectarMayusculas} onKeyDown={detectarMayusculas} onBlur={() => setMayusculas(false)}
          />
          {mayusculas && !errores.password && (
            <p role="status" className="mt-1.5 text-xs font-medium text-amber-700">Tienes activadas las mayúsculas (Bloq Mayús).</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="flex cursor-pointer select-none items-center gap-2 text-slate-700">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-800" />
            Recordar mi usuario
          </label>
          <Link to="/recuperar-clave" className="font-medium text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <BotonPrincipal type="submit" cargando={enviando} textoCargando="Verificando…" disabled={bloqueado}>
          {bloqueado ? <>Intenta en {mmss(espera)}</> : <>Iniciar sesión</>}
        </BotonPrincipal>
      </form>

      <p className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        Por seguridad, la sesión se cierra automáticamente tras 30 minutos sin actividad.
      </p>
    </AuthShell>
  );
}
