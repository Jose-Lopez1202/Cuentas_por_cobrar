import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { ApiError, apiClient } from '../../shared/api';
import { AuthShell } from './AuthShell';
import { AuthAlert, AuthHeading, BotonPrincipal, Campo } from './authUi';

const volver = (
  <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
    <ArrowLeft size={15} aria-hidden="true" /> Volver a iniciar sesión
  </Link>
);

export default function RecuperarClavePage() {
  const [identificador, setIdentificador] = useState('');
  const [errorCampo, setErrorCampo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || espera > 0) return;
    setError(null);
    if (!identificador.trim()) { setErrorCampo('Ingresa tu usuario o tu correo electrónico.'); return; }
    setErrorCampo(undefined);
    setEnviando(true);
    try {
      const r = await apiClient.post<{ mensaje: string }>('/auth/recuperar', { identificador: identificador.trim() }, { successMessage: false });
      setEnviado(r.mensaje);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setEspera(err.retryAfter ?? 60);
      setError(err instanceof ApiError ? err.message : 'No pudimos procesar la solicitud. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <AuthShell>
        <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-800" aria-hidden="true"><MailCheck size={22} /></span>
        <AuthHeading titulo="Revisa tu correo" texto={enviado} />
        <ul className="mb-7 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>El enlace vence en 30 minutos y solo puede usarse una vez.</li>
          <li>Si no lo ves, revisa la carpeta de correo no deseado.</li>
          <li>Si tu cuenta no tiene un correo registrado, pide a un administrador que restablezca tu contraseña.</li>
        </ul>
        {volver}
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading titulo="Recuperar contraseña" texto="Escribe tu usuario o el correo asociado a tu cuenta y te enviaremos un enlace para crear una contraseña nueva." />
      {error && <AuthAlert tono="error">{error}{espera > 0 && <strong className="mt-1 block">Podrás intentarlo en {Math.ceil(espera / 60)} min</strong>}</AuthAlert>}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Campo
          label="Usuario o correo electrónico" name="identificador" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={150}
          value={identificador} error={errorCampo} autoFocus
          onChange={(v) => { setIdentificador(v); setErrorCampo(undefined); }}
        />
        <BotonPrincipal type="submit" cargando={enviando} textoCargando="Enviando…" disabled={espera > 0}>Enviar enlace</BotonPrincipal>
      </form>
      <div className="mt-6">{volver}</div>
    </AuthShell>
  );
}
