import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../shared/logger';

let transporter: Transporter | null = null;
const smtpConfigurado = () => Boolean(config.smtp.host);

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    // El enlace es sensible: nunca se envía por una conexión sin cifrar si el servidor la ofrece.
    requireTLS: !config.smtp.secure,
  });
  return transporter;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function plantilla(nombre: string, enlace: string, minutos: number) {
  const texto = [
    `Hola ${nombre},`,
    '',
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta del ERP.',
    `Usa este enlace (vence en ${minutos} minutos y solo sirve una vez):`,
    enlace,
    '',
    'Si no fuiste tú, ignora este mensaje: tu contraseña actual sigue siendo la misma.',
  ].join('\n');

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:28px 32px 8px"><div style="font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#64748b">ERP System</div>
<h1 style="margin:8px 0 0;font-size:20px;color:#0f172a">Restablecer contraseña</h1></td></tr>
<tr><td style="padding:12px 32px 0;font-size:14px;line-height:1.6;color:#334155">
<p style="margin:0 0 12px">Hola ${esc(nombre)},</p>
<p style="margin:0 0 20px">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Este enlace vence en <strong>${minutos} minutos</strong> y solo puede usarse una vez.</p>
<p style="margin:0 0 24px"><a href="${esc(enlace)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:8px">Crear nueva contraseña</a></p>
<p style="margin:0 0 6px;font-size:12px;color:#64748b">Si el botón no funciona, copia y pega esta dirección en tu navegador:</p>
<p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#475569">${esc(enlace)}</p></td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">Si no solicitaste este cambio, ignora este mensaje: tu contraseña actual no se modificó. Nunca compartas este enlace.</td></tr>
</table></td></tr></table></body></html>`;
  return { texto, html };
}

/**
 * Envía el enlace de recuperación. Sin SMTP configurado:
 *  - desarrollo: imprime el enlace en la consola del servidor (para poder probar el flujo),
 *  - producción: no envía nada y deja una advertencia en el log.
 */
export async function enviarCorreoRecuperacion(para: { email: string; nombre: string }, enlace: string, minutos: number): Promise<void> {
  if (!smtpConfigurado()) {
    if (config.isProduction) {
      logger.warn('auth_recuperacion_sin_smtp', { motivo: 'SMTP_HOST no está configurado: no se envió el correo' });
    } else {
      // eslint-disable-next-line no-console
      console.log(`\n[DESARROLLO] SMTP no configurado. Enlace de recuperación para ${para.email}:\n  ${enlace}\n`);
    }
    return;
  }
  const { texto, html } = plantilla(para.nombre, enlace, minutos);
  await getTransporter().sendMail({
    from: config.smtp.from,
    to: para.email,
    subject: 'Restablece tu contraseña del ERP',
    text: texto,
    html,
  });
}
