/**
 * Crea un usuario del sistema (la contraseña se guarda como hash, nunca en claro).
 *
 *   pnpm --filter @erp/server create-user -- --username admin --nombre "Administrador" --rol ADMIN
 *
 * Opciones:
 *   --username   (obligatorio) letras, números, punto, guion o guion bajo
 *   --nombre     (obligatorio) nombre para mostrar
 *   --rol        ADMIN | OPERADOR | CONSULTA   (por defecto OPERADOR)
 *   --email      opcional
 *   --empleado   ID_EMPLEADO a enlazar (opcional)
 *   --password   opcional; si se omite se genera una contraseña temporal aleatoria
 *
 * El usuario queda obligado a cambiar la contraseña en su primer ingreso.
 */
import 'dotenv/config';
import { ROLES, clavePermitida, type Rol } from '@erp/contracts';
import { initOraclePool, closeOraclePool } from '../src/config/database';
import { generarClaveTemporal, hashPassword } from '../src/modules/auth/password';
import * as repo from '../src/modules/auth/auth.repository';

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  }
  return out;
}

async function main() {
  const a = args();
  const username = (a.username ?? '').trim();
  const nombre = (a.nombre ?? '').trim();
  const rol = (a.rol ?? 'OPERADOR').toUpperCase() as Rol;

  if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) throw new Error('--username es obligatorio: 3 a 50 caracteres (letras, números, punto, guion o guion bajo).');
  if (!nombre) throw new Error('--nombre es obligatorio.');
  if (!ROLES.includes(rol)) throw new Error(`--rol debe ser uno de: ${ROLES.join(', ')}.`);

  const temporal = !a.password;
  const password = a.password ?? generarClaveTemporal();
  if (!clavePermitida(password, username)) throw new Error('La contraseña no cumple la política (10+ caracteres, mayúscula, minúscula, número y símbolo).');

  await initOraclePool();
  try {
    if (await repo.findUsuarioByUsername(username)) throw new Error(`Ya existe un usuario "${username}".`);
    const id = await repo.crearUsuario({
      username, nombre, rol, email: a.email ?? null,
      idEmpleado: a.empleado ? Number(a.empleado) : null,
      passwordHash: await hashPassword(password),
    });
    console.log('\nUsuario creado correctamente');
    console.log(`  ID:       ${id}`);
    console.log(`  Usuario:  ${username}`);
    console.log(`  Rol:      ${rol}`);
    if (temporal) console.log(`  Clave temporal: ${password}   <- cópiala ahora; no se vuelve a mostrar`);
    console.log('  Deberá cambiar la contraseña en su primer ingreso.\n');
  } finally {
    await closeOraclePool();
  }
}

main().catch((err) => {
  console.error(`\nNo se pudo crear el usuario: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
