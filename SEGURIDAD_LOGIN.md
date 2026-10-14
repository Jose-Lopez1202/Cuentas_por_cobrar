# Login y seguridad de acceso

## Puesta en marcha (una sola vez)

1. **Base de datos:** ejecutar `database/oracle/01_ddl/008_seguridad_login.sql` (crea `SEG_USUARIOS`, `SEG_SESIONES` y `SEG_BITACORA_ACCESO`).
2. **Secreto de firma:** agregar `JWT_SECRET` a `server/.env` (mínimo 32 caracteres aleatorios). Sin él el servidor no arranca.
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
3. **Primer administrador:**
   ```bash
   pnpm --filter @erp/server create-user -- --username admin --nombre "Administrador" --rol ADMIN
   ```
   Imprime una **contraseña temporal** (se muestra una sola vez). En el primer ingreso el sistema obliga a cambiarla.
4. Abrir el cliente en `http://localhost:5173` (usar `localhost`, no `127.0.0.1`, para que la cookie de sesión viaje).

## Gestión de usuarios (pantalla de administrador)

Un usuario con rol `ADMIN` ve en el menú lateral **Administración → Usuarios y accesos** (`/admin/usuarios`):

- **Crear usuarios** (usuario, nombre, correo opcional, rol). El sistema genera una contraseña temporal que se muestra **una sola vez**; el usuario debe cambiarla en su primer ingreso.
- **Editar** nombre, correo, rol y estado (activo/inactivo). Cambiar el rol o desactivar la cuenta cierra sus sesiones al instante.
- **Restablecer contraseña** (nueva clave temporal + cierre de sus sesiones), **desbloquear** cuentas bloqueadas por intentos fallidos y **cerrar sesiones** abiertas.
- **Bitácora de accesos**: ingresos, fallos, bloqueos y toda acción administrativa (con quién la hizo).
- Salvaguardas: nadie puede quitarse a sí mismo el rol ADMIN ni desactivarse, y siempre debe quedar al menos un administrador activo.

API: `/api/admin/usuarios` (solo `ADMIN`). El comando `create-user` sigue disponible para crear el primer administrador (`--username`, `--rol`, `--email`, `--empleado` opcionales).

## Recuperación de contraseña (por correo)

1. En el login, «¿Olvidaste tu contraseña?» pide el usuario o el correo. La respuesta es **siempre la misma** exista o no la cuenta, y el trabajo se hace después de responder (no se puede averiguar qué cuentas existen ni por el mensaje ni por el tiempo).
2. Si hay **una sola** cuenta activa con ese usuario/correo, se envía un enlace con un token aleatorio de 256 bits. En la base solo se guarda su hash SHA-256 (`SEG_RECUPERACION`). Vence a los 30 min, sirve **una sola vez** y pedir otro invalida el anterior.
3. La pantalla `/restablecer-clave` valida el enlace, borra el token de la barra de direcciones y pide la contraseña nueva (misma política que el resto). Una clave débil **no gasta** el enlace.
4. Al guardar se cierran **todas** las sesiones del usuario, se levanta cualquier bloqueo y queda registrado en la bitácora.
5. Límites: 5 solicitudes por IP / 15 min y 3 por usuario-correo / hora.

**Puesta en marcha:** ejecutar `database/oracle/01_ddl/009_recuperacion_clave.sql` y configurar en `server/.env` `APP_URL` y el servidor de correo (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; ver `.env.example`). Sin `SMTP_HOST`, en desarrollo el enlace se imprime en la consola del servidor para poder probar; en producción no se envía nada y queda una advertencia en el log. Las cuentas sin correo registrado siguen dependiendo de un administrador.

## Roles

| Rol | Permisos |
| --- | --- |
| `ADMIN` | Todo. |
| `OPERADOR` | Todo en Cuentas por Cobrar. |
| `CONSULTA` | Solo lectura: el servidor rechaza cualquier POST/PATCH/DELETE. |

## Medidas de seguridad implementadas

- **Contraseñas:** hash `scrypt` con sal única por usuario (N=32768); nunca se guardan ni se registran en claro. Verificación en tiempo constante.
- **Política de contraseña** (cliente y servidor): 10+ caracteres, mayúscula, minúscula, número, símbolo, sin usuario ni palabras comunes ni 4 caracteres repetidos.
- **Tokens:** *access token* JWT de 15 min (HS256 fijo, verifica emisor, audiencia y expiración; rechaza `alg:none`) guardado **solo en memoria**; *refresh token* opaco en cookie `HttpOnly` + `SameSite=Strict` + `Secure` (en producción), limitada a `/api/auth`. En BD solo se guarda su hash SHA-256.
- **Rotación y detección de robo:** cada renovación cambia el token; si uno ya usado reaparece, se revocan **todas** las sesiones del usuario.
- **Sesión:** vence a las 10 h como máximo y a los 30 min sin actividad (cliente y servidor). Cerrar sesión o cambiar la clave la revoca de inmediato.
- **Fuerza bruta:** límite por IP y por usuario (429 con cuenta regresiva) y bloqueo de la cuenta 15 min tras 5 fallos. Mensajes genéricos y tiempos parejos (hash señuelo) para no revelar qué usuarios existen.
- **CSRF / CORS:** cookie `SameSite=Strict`, verificación de `Origin` en `/api/auth/*` y CORS solo para orígenes de la lista blanca.
- **Clave temporal:** mientras no se cambie, el servidor bloquea toda la API (403 `PASSWORD_CHANGE_REQUIRED`).
- **Auditoría:** `SEG_BITACORA_ACCESO` registra ingresos, fallos, bloqueos, cierres de sesión, cambios de clave y reutilización de tokens (con IP y navegador).
- Todo `/api/cxc` exige sesión válida; `/api/auth` responde con `Cache-Control: no-store`.

## Variables (server/.env)

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `JWT_SECRET` | — (obligatoria) | Firma de access tokens. |
| `ACCESS_TOKEN_MINUTES` | 15 | Vida del access token. |
| `SESSION_MAX_HOURS` | 10 | Duración máxima de una sesión. |
| `SESSION_IDLE_MINUTES` | 30 | Inactividad permitida. |
| `MAX_FAILED_ATTEMPTS` / `LOCK_MINUTES` | 5 / 15 | Bloqueo de cuenta. |
| `NODE_ENV=production` | — | Activa cookies `Secure` (requiere HTTPS). |

## Para producción

- Servir todo por **HTTPS** y poner `NODE_ENV=production`.
- Si hay un proxy inverso, configurar `trust proxy` en Express para que la IP registrada sea la real.
- Los limitadores de intentos están en memoria (una instancia). Con varias instancias hay que moverlos a un almacén compartido.
- Recuperación de contraseña: hoy la restablece un administrador; no hay correo de recuperación.

## Pruebas

`e2e/login.spec.ts` cubre redirección sin sesión, validaciones, credenciales incorrectas, bloqueo con cuenta regresiva, ingreso correcto y cambio forzado de clave. Para auditar contra la API real: `E2E_REAL_API=1 E2E_USER=... E2E_PASSWORD=... pnpm test:audit`.
