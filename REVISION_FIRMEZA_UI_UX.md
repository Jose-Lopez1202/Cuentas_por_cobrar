# Revisión aplicada — Firmeza, UI/UX y calidad CxC

## Cambios solicitados de navegación

- `Documento Detalle` eliminado del sidebar.
- `Documento Historial` eliminado del sidebar.
- Ambos continúan disponibles dentro del documento seleccionado, donde corresponde por relación padre-hijo.
- Eliminadas las pestañas superiores duplicadas de Documentos, Pagos, Crédito, Cobranza y Organización.
- El sidebar queda como fuente única de navegación de catálogos CxC.

## Refuerzo de formularios

- Hints consistentes debajo de inputs/selects/textareas.
- Campos `required` ahora también usan validación HTML nativa.
- Campos numéricos bloquean letras y caracteres de notación científica accidental.
- Campos enteros y decimales muestran teclado adecuado en dispositivos móviles.
- Códigos/NIT/series/referencias pueden usar restricción alfanumérica.
- Campos de estado textual reforzados para letras cuando no existe todavía un catálogo cerrado.
- Límites de caracteres visibles en formularios donde ya existen restricciones en contracts.
- Textareas muestran contador cuando tienen `maxLength`.

## Accesibilidad

- `aria-invalid`, `aria-required`, `aria-describedby` y `role="alert"` en controles.
- Menús con `aria-expanded`, `aria-controls` y `aria-current`.
- Modales con foco inicial, trampa de Tab, Escape y restauración de foco.
- Foco visible para navegación con teclado.

## Rendimiento

- Debounce de 300 ms en búsquedas paginadas.
- Cancelación de requests obsoletos.
- Timeout centralizado de API (15 s por defecto).

## Seguridad y privacidad

- CORS con allowlist configurable.
- Límite de body de 1 MB.
- Cabeceras defensivas básicas.
- `Cache-Control: no-store` en API CxC.
- Se elimina `X-Powered-By`.
- El log de Oracle ya no imprime el connection string completo.
- Errores internos no exponen stack/SQL al frontend.

## Mantenibilidad / POO

- Jerarquía de errores `AppError` / `NotFoundError` / `ConflictError` / `BadRequestError`.
- Se mantiene separación route -> controller -> service -> repository -> Oracle.
- No se fuerzan clases en React: se aplican SOLID y encapsulación donde aportan valor real.

## Validación realizada

- Se revisaron 205 archivos fuente con el parser/transpilador de TypeScript: **0 errores de sintaxis**.
- Búsqueda de marcadores de conflicto Git: **0 encontrados**.
- La compilación completa no se ejecutó en el sandbox por no disponer del workspace pnpm instalado de forma reproducible; en tu PC se recomienda validar con `pnpm dev` y `pnpm build`.
