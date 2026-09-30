# Revisión e integración — CXC Documentos

Base utilizada: `develop` del ZIP recibido, correspondiente al repositorio actualizado que el usuario acababa de clonar y hacer `pull`.

## Resultado

El módulo de Documentos quedó integrado sobre la estructura actual de `develop` sin reemplazar los módulos de Organización, Cobranza, Crédito ni Pagos.

### CRUD integrados

- `CXC_DOCUMENTOS`: listar, consultar, crear, editar y eliminar.
- `CXC_DOCUMENTO_DETALLE`: listar por documento, crear, editar y eliminar.
- `CXC_DOCUMENTO_HISTORIAL`: listar por documento, crear, editar y eliminar.
- `CXC_TIPOS_DOCUMENTO`: listar, consultar, crear, editar y eliminar.
- `CXC_AJUSTES`: listar, consultar, crear, editar y eliminar.

### Catálogos auxiliares revisados

Los formularios de Documentos cuentan con catálogos de solo lectura para:

- Clientes (`CLIENTE`).
- Tipos de documento activos (`CXC_TIPOS_DOCUMENTO`, `TRIM(ESTADO) = 'A'`).
- Monedas (`MONEDA`).
- Empleados (`EMPLEADO`).
- Documentos de un cliente (`CXC_DOCUMENTOS`).

Los catálogos retornan una estructura común `{ id, label }`, consistente con los `Select` del frontend. No se modificó el repositorio de catálogos compartido por los demás módulos.

## Ajustes de integración realizados

- Se agregaron las rutas de Documentos a `client/src/app/routes.tsx` conservando todas las rutas actuales de `develop`.
- Se montó el router de Documentos en `server/src/modules/cxc/routes/index.ts` sin eliminar routers existentes.
- Se exportaron los contratos de Documentos desde `packages/contracts/src/modules/cxc/index.ts`.
- Se corrigió `packages/contracts/src/index.ts`, que en la base `develop` contenía marcadores de conflicto guardados como texto. Se conserva `./common/pagination`, que es la ubicación usada por la estructura actual.
- Se normalizó la lectura de `ESTADO` de Oracle con `trim()` y el catálogo de tipos activos con `TRIM(ESTADO) = 'A'` para evitar problemas típicos de columnas `CHAR` rellenadas con espacios.
- Se ajustaron los `binds` dinámicos de Oracle para que las actualizaciones compilen correctamente con los tipos de `oracledb`.
- En `CXC_DOCUMENTO_DETALLE`, el campo `TOTAL` se calcula al crear el detalle y ahora también se recalcula al editar cantidad o precio unitario cuando el cliente no envía un total explícito, evitando valores inconsistentes.
- La ruta raíz `/` se deja como está en `develop` (UI Kit). El módulo se prueba desde `/cxc/documentos/documentos`.

## Validación técnica

Se realizó validación estática de TypeScript sobre la integración:

- `@erp/contracts`: OK.
- Backend (`server`): OK.
- Frontend (`client`): OK.
- Marcadores `<<<<<<<`, `=======`, `>>>>>>>` en código fuente: ninguno después de la integración.

## Nota sobre Oracle

La revisión confirma consistencia de código, contratos, rutas y consultas con los nombres de tablas/columnas usados por el proyecto. El repositorio no incluye el DDL real de estas tablas en los scripts de instalación, por lo que la validación funcional final de inserts/updates/FK debe hacerse contra la base Oracle real.
