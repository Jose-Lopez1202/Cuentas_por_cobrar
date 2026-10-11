import { z } from 'zod';
import { isoDateSchema, moneySchema } from '../validation';

/** IVA vigente en Guatemala. El precio de venta ya incluye el impuesto. */
export const IVA_GT = 0.12;
/** Monto máximo de una factura a Consumidor Final sin identificar al comprador. */
export const LIMITE_CONSUMIDOR_FINAL = 2500;
export const ESTADOS_FACTURA_FEL = ['CERTIFICADA', 'ANULADA'] as const;

export const lineaFacturaSchema = z.object({
  codigoProducto: z.string().trim().max(30, 'El código no puede superar 30 caracteres').optional(),
  descripcion: z.string().trim().min(1, 'La descripción es obligatoria').max(200, 'La descripción no puede superar 200 caracteres'),
  cantidad: z
    .number()
    .finite('La cantidad debe ser un número válido')
    .positive('La cantidad debe ser mayor a 0')
    .refine((v) => Math.abs(v * 10000 - Math.round(v * 10000)) < 1e-8, 'La cantidad admite como máximo 4 decimales'),
  /** Precio unitario CON IVA incluido. */
  precioUnitario: moneySchema('El precio unitario', true),
});
export type LineaFactura = z.infer<typeof lineaFacturaSchema>;

export const emitirFacturaSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  /** 'CF' o NIT. Si se omite se usa el NIT del cliente (o CF si no tiene). */
  nitReceptor: z.string().trim().max(20, 'El NIT no puede superar 20 caracteres').optional(),
  nombreReceptor: z.string().trim().max(150, 'El nombre no puede superar 150 caracteres').optional(),
  idMoneda: z.number().int().positive('Selecciona una moneda'),
  idCondicionCredito: z.number().int().positive().nullable().optional(),
  fechaEmision: isoDateSchema('La fecha de emisión'),
  idEmpleado: z.number().int().positive('Selecciona el empleado que emite'),
  lineas: z.array(lineaFacturaSchema).min(1, 'La factura debe tener al menos una línea').max(500, 'Máximo 500 líneas por factura'),
});
export type EmitirFacturaInput = z.infer<typeof emitirFacturaSchema>;

export const anularFacturaSchema = z.object({
  idEmpleadoAnulacion: z.number().int().positive('Selecciona el empleado que anula'),
  motivoAnulacion: z.string().trim().min(10, 'Describe el motivo de la anulación (mínimo 10 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
});
export type AnularFacturaInput = z.infer<typeof anularFacturaSchema>;

export interface ErrorSat {
  codigo: string;
  campo: string;
  mensaje: string;
}

/** Resultado de la validación que haría el certificador (simulado). */
export interface ValidacionSat {
  valida: boolean;
  errores: ErrorSat[];
  advertencias: string[];
  nitEmisor: string | null;
  nombreEmisor: string | null;
  nitReceptor: string;
  nombreReceptor: string;
  subtotalGravado: number;
  iva: number;
  total: number;
  fechaVencimiento: string;
}

export interface FacturaFel {
  idFacturaFel: number;
  idDocumento: number;
  uuidAutorizacion: string;
  serieFel: string;
  numeroFel: number;
  tipoDte: string;
  fechaEmision: string;
  fechaCertificacion: string;
  nitEmisor: string;
  nombreEmisor: string;
  nitReceptor: string;
  nombreReceptor: string;
  subtotalGravado: number;
  iva: number;
  total: number;
  saldo: number;
  estado: (typeof ESTADOS_FACTURA_FEL)[number];
  fechaAnulacion: string | null;
  uuidAnulacion: string | null;
  motivoAnulacion: string | null;
}

export interface FacturaFelDetalle extends FacturaFel {
  lineas: Array<{ codigoProducto: string | null; descripcion: string; cantidad: number; precioUnitario: number; total: number }>;
  xmlDte: string | null;
}
