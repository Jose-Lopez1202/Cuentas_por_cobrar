import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { clavePermitida, evaluarClave, fortalezaClave } from '@erp/contracts';
import { ApiError, apiClient } from '../../shared/api';
import { AuthShell } from './AuthShell';
import { AuthAlert, AuthHeading, BotonPrincipal, Campo, useVisible } from './authUi';
import { RequisitosClave } from './RequisitosClave';

type Fase = 'verificando' | 'invalido' | 'formulario';

let tokenEnMemoria = '';

/** El token viaja en la URL del correo; se guarda en memoria y se borra de la barra de direcciones (y del historial). */
function leerTokenYLimpiar(): string {
  const token = new URLSearchParams(window.location.search).get('token');
  if (token) {
    tokenEnMemoria = token;
    window.history.replaceState(null, '', window.location.pathname);
  }
  return tokenEnMemoria;
}

export default function RestablecerClavePage() {
  const navigate = useNavigate();
  const [token] = useState(leerTokenYLimpiar);
  const [fase, setFase] = useState<Fase>(token ? 'verificando' : 'invalido');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const { visible, alternar } = useVisible();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorConfirmar, setErrorConfirmar] = useState<string | undefined>();

  useEffect(() => {
    if (!token) return;
    apiClient.post<{ valido: boolean }>('/auth/recuperar/verificar', { token }, { successMessage: false })
      .then((r) => setFase(r.valido ? 'formulario' : 'invalido'))
      .catch((err) => {
        setFase(err instanceof ApiError && err.status === 429 ? 'formulario' : 'invalido');
      });
  }, [token]);

  const requisitos = useMemo(() => evaluarClave(nueva), [nueva]);
  const nivel = fortalezaClave(nueva);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    if (!clavePermitida(nueva)) { setError('La contraseña nueva aún no cumple todos los requisitos de la lista.'); return; }
    if (confirmar !== nueva) { setErrorConfirmar('Las contraseñas no coinciden.'); return; }
    setErrorConfirmar(undefined);
    setEnviando(true);
    try {
      await apiClient.post('/auth/recuperar/restablecer', { token, claveNueva: nueva }, { successMessage: false });
      navigate('/login', { replace: true, state: { claveActualizada: true } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RECOVERY_LINK_INVALID') setFase('invalido');
      else setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (fase === 'verificando') {
    return (
      <AuthShell>
        <div role="status" className="flex items-center gap-3 text-sm text-slate-600"><Loader2 className="animate-spin" size={18} aria-hidden="true" /> Verificando el enlace…</div>
      </AuthShell>
    );
  }

  if (fase === 'invalido') {
    return (
      <AuthShell>
        <AuthHeading titulo="Enlace no válido" texto="El enlace de recuperación no es válido o ya venció. Los enlaces duran 30 minutos y solo pueden usarse una vez." />
        <Link to="/recuperar-clave" className="flex h-11 w-full items-center justify-center rounded-md bg-blue-800 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          Solicitar un enlace nuevo
        </Link>
        <p className="mt-5 text-sm"><Link to="/login" className="font-medium text-blue-800 hover:underline">Volver a iniciar sesión</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading titulo="Crear contraseña nueva" texto="Elige una contraseña segura. Al guardarla se cerrarán todas tus sesiones abiertas." />
      {error && <AuthAlert tono="error">{error}</AuthAlert>}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <Campo label="Contraseña nueva" name="nueva" autoComplete="new-password" maxLength={128} value={nueva} onChange={setNueva}
            alternarVisible visible={visible} onAlternar={alternar} autoFocus />
          <RequisitosClave valor={nueva} requisitos={requisitos} nivel={nivel} />
        </div>
        <Campo label="Confirmar contraseña" name="confirmar" autoComplete="new-password" maxLength={128} value={confirmar} error={errorConfirmar}
          onChange={(v) => { setConfirmar(v); setErrorConfirmar(undefined); }} alternarVisible visible={visible} onAlternar={alternar} />
        <BotonPrincipal type="submit" cargando={enviando} textoCargando="Guardando…">Guardar contraseña</BotonPrincipal>
      </form>
    </AuthShell>
  );
}
