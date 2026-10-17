import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { clavePermitida, evaluarClave, fortalezaClave } from '@erp/contracts';
import { ApiError } from '../../shared/api';
import { useAuth } from '../../shared/auth/AuthContext';
import { AuthShell } from './AuthShell';
import { AuthAlert, AuthHeading, BotonPrincipal, Campo, useVisible } from './authUi';
import { RequisitosClave } from './RequisitosClave';

export default function CambiarClavePage() {
  const { estado, usuario, cambiarClave, logout } = useAuth();
  const navigate = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const { visible, alternar } = useVisible();
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errores, setErrores] = useState<{ actual?: string; confirmar?: string }>({});

  const requisitos = useMemo(() => evaluarClave(nueva, usuario?.username), [nueva, usuario?.username]);
  const nivel = fortalezaClave(nueva, usuario?.username);

  if (estado === 'anonimo') return <Navigate to="/login" replace />;
  if (!usuario) return null;
  const forzado = usuario.debeCambiarClave;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    const next: { actual?: string; confirmar?: string } = {};
    if (!actual) next.actual = 'Ingresa tu contraseña actual.';
    if (nueva && confirmar !== nueva) next.confirmar = 'Las contraseñas no coinciden.';
    if (!confirmar) next.confirmar = 'Confirma tu contraseña nueva.';
    setErrores(next); setErrorGeneral(null);
    if (Object.keys(next).length || !clavePermitida(nueva, usuario.username)) {
      if (!clavePermitida(nueva, usuario.username)) setErrorGeneral('La contraseña nueva aún no cumple todos los requisitos de la lista.');
      return;
    }
    if (nueva === actual) { setErrorGeneral('La contraseña nueva debe ser distinta de la actual.'); return; }
    setEnviando(true);
    try {
      await cambiarClave(actual, nueva);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WRONG_PASSWORD') setErrores({ actual: 'La contraseña actual no es correcta.' });
      else setErrorGeneral(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally { setEnviando(false); }
  };

  return (
    <AuthShell>
      <AuthHeading
        titulo={forzado ? 'Crea tu contraseña' : 'Cambiar contraseña'}
        texto={forzado
          ? `${usuario.nombre}, tu contraseña es temporal. Elige una nueva para continuar.`
          : 'Al cambiarla, cerraremos tus sesiones abiertas en otros equipos.'}
      />
      {errorGeneral && <AuthAlert tono="error">{errorGeneral}</AuthAlert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Campo label={forzado ? 'Contraseña temporal' : 'Contraseña actual'} name="actual" autoComplete="current-password" maxLength={128}
          value={actual} error={errores.actual} onChange={(v) => { setActual(v); setErrores((x) => ({ ...x, actual: undefined })); }}
          alternarVisible visible={visible} onAlternar={alternar} />
        <div>
          <Campo label="Contraseña nueva" name="nueva" autoComplete="new-password" maxLength={128} value={nueva} onChange={setNueva}
            alternarVisible visible={visible} onAlternar={alternar} />
          <RequisitosClave valor={nueva} requisitos={requisitos} nivel={nivel} />
        </div>
        <Campo label="Confirmar contraseña nueva" name="confirmar" autoComplete="new-password" maxLength={128} value={confirmar} error={errores.confirmar}
          onChange={(v) => { setConfirmar(v); setErrores((x) => ({ ...x, confirmar: undefined })); }} alternarVisible visible={visible} onAlternar={alternar} />
        <BotonPrincipal type="submit" cargando={enviando} textoCargando="Guardando…">Guardar contraseña</BotonPrincipal>
      </form>

      <div className="mt-6 text-sm">
        {forzado ? (
          <button type="button" onClick={() => logout()} className="font-medium text-slate-600 hover:text-slate-900 hover:underline">Cerrar sesión</button>
        ) : (
          <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 font-medium text-blue-800 hover:underline"><ArrowLeft size={15} aria-hidden="true" /> Volver</button>
        )}
      </div>
    </AuthShell>
  );
}
