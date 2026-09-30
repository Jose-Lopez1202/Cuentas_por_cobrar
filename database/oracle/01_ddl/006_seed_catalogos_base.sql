-- =============================================================================
-- MIGRACIÓN 006 — datos semilla para los catálogos base de CxC.
-- =============================================================================
-- Motivo: CXC_EMPRESAS, CXC_SUCURSALES, CXC_FORMAS_PAGO, CXC_TIPOS_DOCUMENTO
-- y CXC_CONDICIONES_CREDITO están vacías (SEGMENT CREATION DEFERRED). Sin
-- datos ahí, ningún formulario de Documentos/Pagos/Crédito tiene nada que
-- mostrar en sus selects — la app funciona pero no hay con qué operarla.
--
-- *** IMPORTANTE: estos son valores PLACEHOLDER, no datos reales del negocio.
-- Antes de salir a producción, edita el nombre/NIT de la empresa, el nombre
-- de la sucursal, y ajusta porcentajes de mora / días de crédito a la
-- política real de la empresa. Los nombres de formas de pago y tipos de
-- documento son razonablemente universales y probablemente no necesiten
-- cambio, pero revísalos igual. ***
--
-- Solo INSERT, ningún DDL. Cada INSERT valida por nombre/tabla vacía antes de
-- insertar, así que es seguro correrlo más de una vez o después de que ya
-- exista data real — no duplica nada.
-- =============================================================================

PROMPT Migración CxC 006 — seed de catálogos base: iniciando...

--------------------------------------------------------
-- 1. Empresa (una sola, ajustar nombre/NIT reales antes de producción)
--------------------------------------------------------
INSERT INTO "PROYECTOANALISIS"."CXC_EMPRESAS" ("NOMBRE", "NIT", "ESTADO")
SELECT 'Empresa Principal', NULL, 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_EMPRESAS");

PROMPT [1/5] CXC_EMPRESAS con 1 registro placeholder (si estaba vacía).

--------------------------------------------------------
-- 2. Sucursal (una sola, ligada a la primera empresa existente)
--------------------------------------------------------
INSERT INTO "PROYECTOANALISIS"."CXC_SUCURSALES" ("ID_EMPRESA", "NOMBRE", "DIRECCION", "ESTADO")
SELECT (SELECT MIN("ID_EMPRESA") FROM "PROYECTOANALISIS"."CXC_EMPRESAS"), 'Casa Matriz', NULL, 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_SUCURSALES")
   AND EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_EMPRESAS");

PROMPT [2/5] CXC_SUCURSALES con 1 registro placeholder (si estaba vacía).

--------------------------------------------------------
-- 3. Formas de pago (universales; REQUIERE_REFERENCIA = S para las que
--    normalmente dejan comprobante/boleta/número de transacción)
--------------------------------------------------------
INSERT INTO "PROYECTOANALISIS"."CXC_FORMAS_PAGO" ("NOMBRE", "REQUIERE_REFERENCIA", "ESTADO")
SELECT 'Efectivo', 'N', 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_FORMAS_PAGO" WHERE UPPER("NOMBRE") = 'EFECTIVO');

INSERT INTO "PROYECTOANALISIS"."CXC_FORMAS_PAGO" ("NOMBRE", "REQUIERE_REFERENCIA", "ESTADO")
SELECT 'Cheque', 'S', 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_FORMAS_PAGO" WHERE UPPER("NOMBRE") = 'CHEQUE');

INSERT INTO "PROYECTOANALISIS"."CXC_FORMAS_PAGO" ("NOMBRE", "REQUIERE_REFERENCIA", "ESTADO")
SELECT 'Transferencia Bancaria', 'S', 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_FORMAS_PAGO" WHERE UPPER("NOMBRE") = 'TRANSFERENCIA BANCARIA');

INSERT INTO "PROYECTOANALISIS"."CXC_FORMAS_PAGO" ("NOMBRE", "REQUIERE_REFERENCIA", "ESTADO")
SELECT 'Depósito Bancario', 'S', 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_FORMAS_PAGO" WHERE UPPER("NOMBRE") = 'DEPÓSITO BANCARIO');

INSERT INTO "PROYECTOANALISIS"."CXC_FORMAS_PAGO" ("NOMBRE", "REQUIERE_REFERENCIA", "ESTADO")
SELECT 'Tarjeta de Crédito/Débito', 'S', 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_FORMAS_PAGO" WHERE UPPER("NOMBRE") = 'TARJETA DE CRÉDITO/DÉBITO');

PROMPT [3/5] CXC_FORMAS_PAGO con 5 registros base (los que ya existían por nombre no se duplican).

--------------------------------------------------------
-- 4. Tipos de documento (los 2 tipos CARGO más comunes en CxC)
--------------------------------------------------------
INSERT INTO "PROYECTOANALISIS"."CXC_TIPOS_DOCUMENTO" ("CODIGO", "NOMBRE", "NATURALEZA", "ESTADO")
SELECT 'FACT', 'Factura', 'CARGO', 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_TIPOS_DOCUMENTO" WHERE "CODIGO" = 'FACT');

INSERT INTO "PROYECTOANALISIS"."CXC_TIPOS_DOCUMENTO" ("CODIGO", "NOMBRE", "NATURALEZA", "ESTADO")
SELECT 'NDEB', 'Nota de Débito', 'CARGO', 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_TIPOS_DOCUMENTO" WHERE "CODIGO" = 'NDEB');

PROMPT [4/5] CXC_TIPOS_DOCUMENTO con 2 registros base (los que ya existían por código no se duplican).

--------------------------------------------------------
-- 5. Condiciones de crédito (Contado + plazos comunes; AJUSTAR % de mora y
--    días de gracia a la política real de cobranza de la empresa)
--------------------------------------------------------
INSERT INTO "PROYECTOANALISIS"."CXC_CONDICIONES_CREDITO" ("DIAS_CREDITO", "PORCENTAJE_MORA", "DIAS_GRACIA", "ESTADO")
SELECT 0, 0, 0, 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_CONDICIONES_CREDITO" WHERE "DIAS_CREDITO" = 0);

INSERT INTO "PROYECTOANALISIS"."CXC_CONDICIONES_CREDITO" ("DIAS_CREDITO", "PORCENTAJE_MORA", "DIAS_GRACIA", "ESTADO")
SELECT 15, 2, 5, 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_CONDICIONES_CREDITO" WHERE "DIAS_CREDITO" = 15);

INSERT INTO "PROYECTOANALISIS"."CXC_CONDICIONES_CREDITO" ("DIAS_CREDITO", "PORCENTAJE_MORA", "DIAS_GRACIA", "ESTADO")
SELECT 30, 2, 5, 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_CONDICIONES_CREDITO" WHERE "DIAS_CREDITO" = 30);

INSERT INTO "PROYECTOANALISIS"."CXC_CONDICIONES_CREDITO" ("DIAS_CREDITO", "PORCENTAJE_MORA", "DIAS_GRACIA", "ESTADO")
SELECT 60, 2, 5, 'A' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM "PROYECTOANALISIS"."CXC_CONDICIONES_CREDITO" WHERE "DIAS_CREDITO" = 60);

PROMPT [5/5] CXC_CONDICIONES_CREDITO con 4 registros base (Contado/15/30/60 días).

COMMIT;

PROMPT Migración CxC 006 completada. Recuerda editar nombre/NIT de empresa, sucursal y porcentajes de mora antes de producción.
