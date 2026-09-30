# Revisión de estados UI - Cuentas por Cobrar

## Objetivo
Unificar la apariencia visual de todos los estados de CxC para que usen la misma forma, altura, tipografía, borde y espaciado. El color cambia únicamente según el significado del estado.

## Estándar aplicado

| Estado | Color |
| --- | --- |
| ACTIVO, ACTIVA, PAGADO, PAGADA | Verde |
| PENDIENTE | Amarillo |
| VENCIDO, VENCIDA | Rojo |
| MORA | Naranja |
| CANCELADO, CANCELADA, ANULADO, ANULADA | Gris |
| PARCIAL, PARCIALMENTE APLICADO | Azul |
| INACTIVO, INACTIVA | Gris |

También se cubrieron estados operativos ya existentes en CxC para evitar texto plano: CUMPLIDO/CUMPLIDA, INCUMPLIDO/INCUMPLIDA, PLANIFICADA, EN_PROCESO, COMPLETADA, VISITADO, NO_ENCONTRADO y REPROGRAMADO.

## Forma común
- Badge tipo píldora (`rounded-full`).
- Altura fija de 24 px.
- Ancho mínimo de 78 px; textos largos pueden crecer sin deformarse.
- Tamaño de letra de 11 px.
- Peso `semibold`.
- Borde fino y color pastel coherente.
- Texto centrado y presentación amigable (`Activo`, `Pendiente`, `Vencido`, etc.).

## Pantallas revisadas
- Documentos y detalle/historial de documento.
- Tipos de documento.
- Pagos.
- Anticipos.
- Recibos.
- Formas de pago.
- Condiciones de crédito.
- Notas de crédito.
- Mora.
- Promesas de pago.
- Convenios y cuotas.
- Empresas.
- Sucursales.
- Rutas y detalle de ruta.

## Cambio estructural
La lógica visual quedó centralizada en `client/src/shared/components/UnifiedStatusBadge.tsx` y se expone desde `client/src/shared/ui-kit.ts`. Esto evita definir colores diferentes en cada página.

## Validación realizada
- Se revisaron 68 archivos TS/TSX del frontend con el parser de TypeScript.
- Errores de sintaxis encontrados: 0.
- Se eliminaron mapeos locales que hacían que `ANULADO`/`CANCELADO` aparecieran rojos en unas vistas y grises en otras.
- Los estados que antes se mostraban como texto plano en Pagos, Anticipos, Recibos, Mora y Rutas ahora usan el componente unificado.

## Nota local
`server/.env` se conserva dentro del proyecto, conforme al flujo local acordado.
