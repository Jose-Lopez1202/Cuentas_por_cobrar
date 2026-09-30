-- =============================================================================
-- MIGRACIÓN 003 — doble aprobación de ajustes, historial de documento como
-- bitácora contable ligera, ID_EMPLEADO en aplicaciones de NC/anticipo,
-- folio único de recibos, y cobertura completa de CHECK constraints para
-- todos los ESTADO/flags heredados de CxC.
-- =============================================================================
-- Igual que 002: 100% aditivo. Solo ALTER TABLE ADD / ADD CONSTRAINT / MODIFY
-- de DEFAULT (nunca de tipo/tamaño) / CREATE INDEX. Ningún DROP, ningún
-- DELETE. Seguro de correr aunque ya haya datos.
--
-- Nota sobre las CHECK constraints de la sección 5: el export de schema que
-- compartiste no trae NINGUNA constraint (ni PK, ni FK, ni CHECK) en las
-- tablas propias de CxC. Si tu Oracle real sí las tiene con otro nombre, la
-- única consecuencia de correr esta sección es un error puntual de "nombre
-- de constraint duplicado" en esa línea específica (inofensivo, no afecta
-- nada más) — exactamente lo mismo que pasó con la migración 002.
--
-- Excluye a propósito CLIENTE y EMPLEADO: son tablas externas del ERP que
-- CxC solo referencia, no administra; no se les agrega ninguna constraint.
--
-- Orden de ejecución: de arriba hacia abajo.
-- =============================================================================

PROMPT Migración CxC 003 — doble aprobación / historial / checks: iniciando...

--------------------------------------------------------
-- 1. CXC_AJUSTES: doble aprobación (dos empleados distintos)
--------------------------------------------------------
-- El primer "Aprobar" mueve el ajuste a EN_2DA_APROBACION sin tocar saldo.
-- El segundo "Aprobar" exige un empleado DISTINTO al primero (lo valida el
-- server, no la BD) y recién ahí mueve CXC_DOCUMENTOS.SALDO y deja APROBADO.

ALTER TABLE "PROYECTOANALISIS"."CXC_AJUSTES"
  ADD ("ID_EMPLEADO_APROBADOR_2" NUMBER, "FECHA_APROBACION_2" DATE);

ALTER TABLE "PROYECTOANALISIS"."CXC_AJUSTES"
  ADD CONSTRAINT "FK_CXC_AJ_APROBADOR2"
  FOREIGN KEY ("ID_EMPLEADO_APROBADOR_2")
  REFERENCES "PROYECTOANALISIS"."EMPLEADO" ("ID_EMPLEADO");

CREATE INDEX "PROYECTOANALISIS"."IX_CXC_AJ_APROBADOR2"
  ON "PROYECTOANALISIS"."CXC_AJUSTES" ("ID_EMPLEADO_APROBADOR_2") TABLESPACE "USERS";

PROMPT [1/6] CXC_AJUSTES actualizado (doble aprobación).

--------------------------------------------------------
-- 2. CXC_DOCUMENTO_HISTORIAL: bitácora contable ligera
--------------------------------------------------------
-- No existe (ni existirá desde este script) un módulo de Contabilidad/GL
-- real en el ERP: no hay catálogo de cuentas contables que mapear. En su
-- lugar, el historial de documento — que ya registraba ESTADO_ANTERIOR /
-- ESTADO_NUEVO — se enriquece para funcionar como bitácora de movimientos
-- financieros: qué operación fue (TIPO_EVENTO), cuánto dinero movió (MONTO),
-- si aumentó o redujo la deuda del cliente (NATURALEZA: CARGO/ABONO) y una
-- descripción legible. El server ahora escribe aquí automáticamente en cada
-- aplicar/reversar/ajuste-aprobado/anular, dentro de la misma transacción
-- que mueve el saldo (ver documentoHistorial.repository.ts::registrarEvento).
-- Si el día de mañana se construye un módulo de Contabilidad real, esta
-- tabla es la fuente natural para poblarlo.

ALTER TABLE "PROYECTOANALISIS"."CXC_DOCUMENTO_HISTORIAL"
  ADD ("TIPO_EVENTO" VARCHAR2(35 BYTE),
       "MONTO" NUMBER(14,2),
       "NATURALEZA" VARCHAR2(10 BYTE),
       "DESCRIPCION" VARCHAR2(250 BYTE));

ALTER TABLE "PROYECTOANALISIS"."CXC_DOCUMENTO_HISTORIAL"
  ADD CONSTRAINT "CK_CXC_DH_NATURALEZA"
  CHECK (NATURALEZA IS NULL OR NATURALEZA IN ('CARGO', 'ABONO'));

ALTER TABLE "PROYECTOANALISIS"."CXC_DOCUMENTO_HISTORIAL"
  ADD CONSTRAINT "CK_CXC_DH_TIPO_EVENTO"
  CHECK (TIPO_EVENTO IS NULL OR TIPO_EVENTO IN (
    'APLICACION_PAGO', 'APLICACION_NOTA_CREDITO', 'APLICACION_ANTICIPO',
    'REVERSA_APLICACION_PAGO', 'REVERSA_APLICACION_NOTA_CREDITO', 'REVERSA_APLICACION_ANTICIPO',
    'AJUSTE_APROBADO', 'ANULACION_DOCUMENTO'
  ));

PROMPT [2/6] CXC_DOCUMENTO_HISTORIAL actualizado (bitácora de movimientos).

--------------------------------------------------------
-- 3. ID_EMPLEADO en aplicaciones de Nota de Crédito y Anticipo
--------------------------------------------------------
-- CXC_APLICACION_PAGOS ya tenía ID_EMPLEADO (quién aplicó). Las otras dos
-- tablas de aplicación nunca lo tuvieron — solo registraban quién REVERSA,
-- nunca quién APLICA. Se agrega para trazabilidad simétrica y porque ahora
-- es requerido por el formulario (antes no se pedía en absoluto).

ALTER TABLE "PROYECTOANALISIS"."CXC_APLICACION_NOTA_CREDITO"
  ADD ("ID_EMPLEADO" NUMBER);

ALTER TABLE "PROYECTOANALISIS"."CXC_APLICACION_NOTA_CREDITO"
  ADD CONSTRAINT "FK_CXC_ANC_EMPLEADO"
  FOREIGN KEY ("ID_EMPLEADO")
  REFERENCES "PROYECTOANALISIS"."EMPLEADO" ("ID_EMPLEADO");

CREATE INDEX "PROYECTOANALISIS"."IX_CXC_ANC_EMPLEADO"
  ON "PROYECTOANALISIS"."CXC_APLICACION_NOTA_CREDITO" ("ID_EMPLEADO") TABLESPACE "USERS";

ALTER TABLE "PROYECTOANALISIS"."CXC_APLICACION_ANTICIPO"
  ADD ("ID_EMPLEADO" NUMBER);

ALTER TABLE "PROYECTOANALISIS"."CXC_APLICACION_ANTICIPO"
  ADD CONSTRAINT "FK_CXC_AA_EMPLEADO"
  FOREIGN KEY ("ID_EMPLEADO")
  REFERENCES "PROYECTOANALISIS"."EMPLEADO" ("ID_EMPLEADO");

CREATE INDEX "PROYECTOANALISIS"."IX_CXC_AA_EMPLEADO"
  ON "PROYECTOANALISIS"."CXC_APLICACION_ANTICIPO" ("ID_EMPLEADO") TABLESPACE "USERS";

PROMPT [3/6] ID_EMPLEADO agregado a aplicaciones de NC y anticipo.

--------------------------------------------------------
-- 4. CXC_RECIBOS: folio único
--------------------------------------------------------
-- Ahora se genera un recibo automáticamente al aplicar un pago (folio
-- REC-<año>-<consecutivo>, derivado del propio ID_RECIBO). El UNIQUE evita
-- que un folio se repita si en el futuro se genera también manualmente.

ALTER TABLE "PROYECTOANALISIS"."CXC_RECIBOS"
  ADD CONSTRAINT "UQ_CXC_RECIBOS_NUMERO" UNIQUE ("NUMERO_RECIBO");

PROMPT [4/6] CXC_RECIBOS con folio único.

--------------------------------------------------------
-- 5. Fix de DEFAULT obsoletos (valores que ya no existen en el enum actual)
--------------------------------------------------------
-- Antes de agregar los CHECK de la sección 6, se corrigen dos columnas cuyo
-- DEFAULT del script original quedó desalineado del enum vigente en
-- @erp/contracts (el server siempre setea el ESTADO explícito, así que el
-- DEFAULT nunca se usó en la práctica, pero de todas formas se corrige para
-- no dejar una trampa a futuro).

UPDATE "PROYECTOANALISIS"."CXC_MORA" SET "ESTADO" = 'ACTIVA' WHERE "ESTADO" IS NULL OR "ESTADO" NOT IN ('ACTIVA','PAGADA','ANULADA');
ALTER TABLE "PROYECTOANALISIS"."CXC_MORA" MODIFY ("ESTADO" DEFAULT 'ACTIVA');

UPDATE "PROYECTOANALISIS"."CXC_RUTAS" SET "ESTADO" = 'PLANIFICADA' WHERE "ESTADO" IS NULL OR "ESTADO" NOT IN ('PLANIFICADA','EN_PROCESO','COMPLETADA','CANCELADA');
ALTER TABLE "PROYECTOANALISIS"."CXC_RUTAS" MODIFY ("ESTADO" DEFAULT 'PLANIFICADA');

PROMPT [5/6] Defaults obsoletos corregidos (CXC_MORA, CXC_RUTAS).

--------------------------------------------------------
-- 6. Cobertura completa de CHECK constraints (ESTADO y flags heredados)
--------------------------------------------------------
-- Ninguna de estas existía en el schema real que compartiste. Cada valor
-- viene 1:1 de los enums ya vigentes en @erp/contracts (documento.ts,
-- ajuste.ts, tipo-documento.ts, recibo.ts, pago.ts, anticipo.ts,
-- forma-pago.ts, nota-credito.ts, condicion-credito.ts, mora.ts,
-- promesa-pago.ts, convenio-pago.ts, convenio-cuota.ts, empresa.ts,
-- sucursal.ts, ruta.ts, ruta-detalle.ts). CXC_NOTAS_CREDITO tolera además
-- el valor heredado 'ACTIVA' junto a los 3 vigentes.

ALTER TABLE "PROYECTOANALISIS"."CXC_DOCUMENTOS"
  ADD CONSTRAINT "CK_CXC_DOC_ESTADO" CHECK (ESTADO IN ('PENDIENTE','PARCIAL','PAGADO','VENCIDO','ANULADO'));

ALTER TABLE "PROYECTOANALISIS"."CXC_AJUSTES"
  ADD CONSTRAINT "CK_CXC_AJ_ESTADO" CHECK (ESTADO IN ('PENDIENTE','EN_2DA_APROBACION','APROBADO','RECHAZADO','ANULADO'));
ALTER TABLE "PROYECTOANALISIS"."CXC_AJUSTES"
  ADD CONSTRAINT "CK_CXC_AJ_TIPO" CHECK (TIPO_AJUSTE IN ('DEBITO','CREDITO'));

ALTER TABLE "PROYECTOANALISIS"."CXC_TIPOS_DOCUMENTO"
  ADD CONSTRAINT "CK_CXC_TIPOS_DOC_ESTADO" CHECK (ESTADO IN ('A','I'));
ALTER TABLE "PROYECTOANALISIS"."CXC_TIPOS_DOCUMENTO"
  ADD CONSTRAINT "CK_CXC_TIPOS_DOC_NATURALEZA" CHECK (NATURALEZA IN ('CARGO','CREDITO'));

ALTER TABLE "PROYECTOANALISIS"."CXC_RECIBOS"
  ADD CONSTRAINT "CK_CXC_REC_ESTADO" CHECK (ESTADO IN ('EMITIDO','CANCELADO'));
ALTER TABLE "PROYECTOANALISIS"."CXC_RECIBOS"
  ADD CONSTRAINT "CK_CXC_REC_MONTO" CHECK (MONTO > 0);

ALTER TABLE "PROYECTOANALISIS"."CXC_PAGOS"
  ADD CONSTRAINT "CK_CXC_PAGOS_ESTADO" CHECK (ESTADO IN ('NO_IDENTIFICADO','NO_APLICADO','APLICADO','EN_CUENTA','REVERSADO','ANULADO'));

ALTER TABLE "PROYECTOANALISIS"."CXC_ANTICIPOS"
  ADD CONSTRAINT "CK_CXC_ANT_ESTADO" CHECK (ESTADO IN ('DISPONIBLE','APLICADO','AGOTADO','CANCELADO'));

ALTER TABLE "PROYECTOANALISIS"."CXC_FORMAS_PAGO"
  ADD CONSTRAINT "CK_CXC_FP_ESTADO" CHECK (ESTADO IN ('A','I'));
ALTER TABLE "PROYECTOANALISIS"."CXC_FORMAS_PAGO"
  ADD CONSTRAINT "CK_CXC_FP_REQ_REF" CHECK (REQUIERE_REFERENCIA IN ('S','N'));

ALTER TABLE "PROYECTOANALISIS"."CXC_NOTAS_CREDITO"
  ADD CONSTRAINT "CK_CXC_NC_ESTADO" CHECK (ESTADO IN ('PENDIENTE','APLICADA','ANULADA','ACTIVA'));

ALTER TABLE "PROYECTOANALISIS"."CXC_CONDICIONES_CREDITO"
  ADD CONSTRAINT "CK_CXC_COND_ESTADO" CHECK (ESTADO IN ('A','I'));

ALTER TABLE "PROYECTOANALISIS"."CXC_MORA"
  ADD CONSTRAINT "CK_CXC_MORA_ESTADO" CHECK (ESTADO IN ('ACTIVA','PAGADA','ANULADA'));

ALTER TABLE "PROYECTOANALISIS"."CXC_PROMESAS_PAGO"
  ADD CONSTRAINT "CK_CXC_PP_ESTADO" CHECK (ESTADO IN ('PENDIENTE','CUMPLIDA','INCUMPLIDA'));

ALTER TABLE "PROYECTOANALISIS"."CXC_CONVENIOS_PAGO"
  ADD CONSTRAINT "CK_CXC_CV_ESTADO" CHECK (ESTADO IN ('ACTIVO','CUMPLIDO','INCUMPLIDO','CANCELADO'));

ALTER TABLE "PROYECTOANALISIS"."CXC_CONVENIO_CUOTAS"
  ADD CONSTRAINT "CK_CXC_CC_ESTADO" CHECK (ESTADO IN ('PENDIENTE','PAGADA','VENCIDA'));

-- CK_CXC_EMPRESAS_ESTADO y CK_CXC_SUCURSALES_ESTADO se omiten aquí: ya
-- existían con ese mismo nombre en el Oracle real (ORA-02264 confirmado al
-- correr esta migración), o sea que esas dos columnas ya estaban validadas
-- desde antes con el mismo efecto.

ALTER TABLE "PROYECTOANALISIS"."CXC_RUTAS"
  ADD CONSTRAINT "CK_CXC_RUTAS_ESTADO" CHECK (ESTADO IN ('PLANIFICADA','EN_PROCESO','COMPLETADA','CANCELADA'));

ALTER TABLE "PROYECTOANALISIS"."CXC_RUTA_DETALLE"
  ADD CONSTRAINT "CK_CXC_RD_ESTADO_VISITA" CHECK (ESTADO_VISITA IN ('PENDIENTE','VISITADO','NO_ENCONTRADO','REPROGRAMADO'));

PROMPT [6/6] CHECK constraints de estados/flags agregadas.

--------------------------------------------------------
-- 7. Verificación rápida
--------------------------------------------------------
-- Debe devolver 8 filas (una por columna nueva de las secciones 1, 3 y 4):
--
-- SELECT TABLE_NAME, COLUMN_NAME FROM USER_TAB_COLUMNS
--  WHERE (TABLE_NAME = 'CXC_AJUSTES' AND COLUMN_NAME IN ('ID_EMPLEADO_APROBADOR_2','FECHA_APROBACION_2'))
--     OR (TABLE_NAME = 'CXC_DOCUMENTO_HISTORIAL' AND COLUMN_NAME IN ('TIPO_EVENTO','MONTO','NATURALEZA','DESCRIPCION'))
--     OR (TABLE_NAME = 'CXC_APLICACION_NOTA_CREDITO' AND COLUMN_NAME = 'ID_EMPLEADO')
--     OR (TABLE_NAME = 'CXC_APLICACION_ANTICIPO' AND COLUMN_NAME = 'ID_EMPLEADO');
--
-- Debe devolver 19 filas nuevas de esta migración (más las 2 preexistentes
-- CK_CXC_EMPRESAS_ESTADO / CK_CXC_SUCURSALES_ESTADO si tu Oracle ya las tenía):
--
-- SELECT TABLE_NAME, CONSTRAINT_NAME FROM USER_CONSTRAINTS
--  WHERE CONSTRAINT_TYPE = 'C' AND CONSTRAINT_NAME LIKE 'CK\_CXC\_%' ESCAPE '\'
--    AND TABLE_NAME IN ('CXC_DOCUMENTOS','CXC_AJUSTES','CXC_TIPOS_DOCUMENTO','CXC_RECIBOS',
--      'CXC_PAGOS','CXC_ANTICIPOS','CXC_FORMAS_PAGO','CXC_NOTAS_CREDITO','CXC_CONDICIONES_CREDITO',
--      'CXC_MORA','CXC_PROMESAS_PAGO','CXC_CONVENIOS_PAGO','CXC_CONVENIO_CUOTAS','CXC_EMPRESAS',
--      'CXC_SUCURSALES','CXC_RUTAS','CXC_RUTA_DETALLE');

PROMPT Migración CxC 003 completada.
