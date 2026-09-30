-- =============================================================================
-- MIGRACIÓN 005 — anulación formal de anticipos.
-- =============================================================================
-- Motivo: ESTADOS_ANTICIPO ya incluía 'CANCELADO' en @erp/contracts, pero
-- ningún camino del código lo alcanzaba nunca — era un valor muerto. Un
-- anticipo sin aplicaciones se podía DELETE físico sin dejar quién ni por
-- qué. Se cierra el mismo hueco que ya se había cerrado para pagos, notas de
-- crédito y documentos: anular() en vez de editar/borrar libremente.
--
-- 100% aditivo: solo ALTER TABLE ADD + FK + índice. Ningún DROP, ningún
-- DELETE. Seguro de correr aunque ya haya datos.
-- =============================================================================

PROMPT Migración CxC 005 — anulación de anticipos: iniciando...

ALTER TABLE "PROYECTOANALISIS"."CXC_ANTICIPOS"
  ADD ("ID_EMPLEADO_ANULACION" NUMBER, "FECHA_ANULACION" DATE, "MOTIVO_ANULACION" VARCHAR2(250 BYTE));

ALTER TABLE "PROYECTOANALISIS"."CXC_ANTICIPOS"
  ADD CONSTRAINT "FK_CXC_ANT_ANULACION"
  FOREIGN KEY ("ID_EMPLEADO_ANULACION")
  REFERENCES "PROYECTOANALISIS"."EMPLEADO" ("ID_EMPLEADO");

CREATE INDEX "PROYECTOANALISIS"."IX_CXC_ANT_ANULACION"
  ON "PROYECTOANALISIS"."CXC_ANTICIPOS" ("ID_EMPLEADO_ANULACION") TABLESPACE "USERS";

PROMPT [1/1] CXC_ANTICIPOS actualizado (anulación).

--------------------------------------------------------
-- Verificación rápida (debe devolver 3 filas):
--
-- SELECT COLUMN_NAME FROM USER_TAB_COLUMNS
--  WHERE TABLE_NAME = 'CXC_ANTICIPOS'
--    AND COLUMN_NAME IN ('ID_EMPLEADO_ANULACION','FECHA_ANULACION','MOTIVO_ANULACION');

PROMPT Migración CxC 005 completada.
