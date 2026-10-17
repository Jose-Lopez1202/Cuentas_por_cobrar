# Pruebas y auditoría con Playwright

Playwright maneja un navegador real. Aquí se usa para dos cosas:

1. **Pruebas E2E** (`e2e/*.spec.ts`): comprueban flujos concretos, por ejemplo que un formulario vacío explique por qué no se puede guardar.
2. **Auditoría de pantallas** (`e2e/auditoria-rutas.spec.ts`): abre **todas** las rutas de `client/src/app/routes.tsx` y revisa errores de JavaScript, pantalla de error, consola, desborde en móvil y accesibilidad (axe-core). Una pantalla nueva en el router se audita sola.

## Instalación (cada compañero, una sola vez)

Requisitos: Node 20+ y pnpm 9 (`npm install -g pnpm`).

```bash
git pull                              # trae lo último de la rama
pnpm install                          # instala dependencias (incluye Playwright, pero NO el navegador)
npx playwright install chromium       # descarga el navegador (~200 MB)
```

En Linux/CI agrega las dependencias del sistema: `npx playwright install --with-deps chromium`.

> `pnpm install` no descarga el navegador: es un paso aparte. Si falla la descarga, suele ser la red (VPN, proxy o firewall); prueba en otra red.

## Cómo ejecutar

| Comando | Qué hace |
| --- | --- |
| `pnpm test:e2e` | Corre todas las pruebas (E2E + auditoría). Levanta el cliente solo en `localhost:5173`. |
| `pnpm test:e2e:ui` | Modo visual: ves el navegador y cada paso. |
| `pnpm test:audit` | Solo la auditoría de pantallas. |
| `pnpm test:audit:strict` | Auditoría que **falla** ante errores de consola, accesibilidad o desborde. |
| `pnpm test:e2e:report` | Abre el reporte HTML de la última corrida (capturas, anotaciones, JSON de axe). |
| `pnpm audit:static` | Revisión sin navegador: tipos de los 3 paquetes y vulnerabilidades de dependencias. |
| `pnpm audit:full` | Todo lo anterior en cadena. |

Por defecto la API va **simulada** (listas vacías): no hace falta Oracle ni el servidor.
Para auditar contra datos reales, levanta el proyecto (`pnpm dev`) y corre:

```bash
# PowerShell
$env:E2E_REAL_API = "1"; pnpm test:audit
# bash
E2E_REAL_API=1 pnpm test:audit
```

## Cómo leer los resultados

- **Rojo (falla):** una excepción de JavaScript, la pantalla de error o una pantalla en blanco. Es un defecto real.
- **Anotaciones** (en el reporte HTML, dentro de cada prueba): errores de consola, problemas de accesibilidad y desborde móvil. En modo normal solo se informan; con `test:audit:strict` fallan.
- **Capturas:** cada pantalla adjunta su imagen en el reporte.

## Qué NO hace

Playwright no "lee" el código: ejecuta la aplicación como un usuario. La revisión del código se hace con `pnpm audit:static` (TypeScript y dependencias) y las pruebas de flujo se escriben en `e2e/`. Con la API simulada, las pantallas se ven vacías; para revisar datos reales usa `E2E_REAL_API=1`.

## Escribir una prueba nueva

Copia `e2e/condiciones-credito.spec.ts` como base. Convención: un archivo por pantalla o flujo, la API simulada con `page.route('**/api/cxc/**', ...)`.
