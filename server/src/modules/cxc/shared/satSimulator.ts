import { createHash, randomUUID } from 'crypto';
import {
  IVA_GT,
  LIMITE_CONSUMIDOR_FINAL,
  type ErrorSat,
  type LineaFactura,
} from '@erp/contracts';
import { businessTodayIso } from '../../../shared/date';

/**
 * Simulador del certificador FEL / SAT de Guatemala.
 *
 * NO se conecta a la SAT: reproduce sus reglas más relevantes (NIT con dígito
 * verificador, Consumidor Final con tope, IVA 12% incluido en el precio) y
 * genera los datos que devolvería un certificador (UUID de autorización,
 * serie/número FEL, XML DTE simplificado). Todo es puro y determinista salvo
 * el UUID, para poder probarlo sin base de datos.
 */

export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** 'cf', 'C/F', 'c.f.' → 'CF'. El resto: mayúsculas sin espacios ni guion. */
export function normalizarNit(raw: string | null | undefined): string {
  const compact = String(raw ?? '').toUpperCase().replace(/[\s.\-/]/g, '');
  return compact === 'CF' ? 'CF' : compact;
}

/** Dígito verificador del NIT guatemalteco (módulo 11; resultado 10 = 'K'). */
export function digitoVerificadorNit(cuerpo: string): string {
  const n = cuerpo.length;
  let suma = 0;
  for (let i = 0; i < n; i += 1) suma += Number(cuerpo[i]) * (n + 1 - i);
  const resto = (11 - (suma % 11)) % 11;
  return resto === 10 ? 'K' : String(resto);
}

export function esNitValido(nit: string): boolean {
  const normalizado = normalizarNit(nit);
  if (normalizado === 'CF') return true;
  if (!/^\d{2,11}[0-9K]$/.test(normalizado)) return false;
  const cuerpo = normalizado.slice(0, -1);
  return digitoVerificadorNit(cuerpo) === normalizado.slice(-1);
}

/** Formato visible del NIT: 1234567-8. */
export function formatearNit(nit: string): string {
  const n = normalizarNit(nit);
  return n === 'CF' || n.length < 2 ? n : `${n.slice(0, -1)}-${n.slice(-1)}`;
}

export interface TotalesFactura {
  lineas: Array<LineaFactura & { total: number }>;
  total: number;
  subtotalGravado: number;
  iva: number;
}

/** El precio ya incluye IVA: base = total / 1.12, iva = total - base. */
export function calcularTotales(lineas: LineaFactura[]): TotalesFactura {
  const conTotal = lineas.map((l) => ({ ...l, total: roundMoney(l.cantidad * l.precioUnitario) }));
  const total = roundMoney(conTotal.reduce((acc, l) => acc + l.total, 0));
  const subtotalGravado = roundMoney(total / (1 + IVA_GT));
  return { lineas: conTotal, total, subtotalGravado, iva: roundMoney(total - subtotalGravado) };
}

export interface ContextoValidacion {
  emisor: { nit: string | null; nombre: string | null } | null;
  nitReceptor: string;
  nombreReceptor: string;
  fechaEmision: string;
  total: number;
  tipoFacturaConfigurado: boolean;
  monedaValida: boolean;
  condicionValida: boolean;
  clienteExiste: boolean;
}

/** Reglas del certificador simulado. Devuelve rechazos con código estilo SAT. */
export function validarFactura(ctx: ContextoValidacion): { errores: ErrorSat[]; advertencias: string[] } {
  const errores: ErrorSat[] = [];
  const advertencias: string[] = [];
  const err = (codigo: string, campo: string, mensaje: string) => errores.push({ codigo, campo, mensaje });

  if (!ctx.emisor) {
    err('EMISOR_NO_CONFIGURADO', 'general', 'No hay una empresa emisora activa. Registra la empresa en Organización > Empresas.');
  } else if (!ctx.emisor.nit) {
    err('EMISOR_SIN_NIT', 'general', 'La empresa emisora no tiene NIT. Edítala en Organización > Empresas antes de facturar.');
  } else if (!esNitValido(ctx.emisor.nit) || normalizarNit(ctx.emisor.nit) === 'CF') {
    err('EMISOR_NIT_INVALIDO', 'general', `El NIT de la empresa emisora (${ctx.emisor.nit}) no es válido. Corrígelo en Organización > Empresas.`);
  }

  if (!ctx.tipoFacturaConfigurado) {
    err('TIPO_DOCUMENTO_FACT', 'general', 'No existe un tipo de documento activo con código FACT. Créalo en Documentos > Tipos de documento.');
  }
  if (!ctx.clienteExiste) err('CLIENTE_NO_EXISTE', 'idCliente', 'El cliente seleccionado no existe.');
  if (!ctx.monedaValida) err('MONEDA_INVALIDA', 'idMoneda', 'La moneda seleccionada no existe.');
  if (!ctx.condicionValida) err('CONDICION_INVALIDA', 'idCondicionCredito', 'La condición de crédito no existe o está inactiva.');

  const nit = normalizarNit(ctx.nitReceptor);
  if (!nit) {
    err('NIT_RECEPTOR_REQUERIDO', 'nitReceptor', 'El NIT del receptor es obligatorio; usa CF si es consumidor final.');
  } else if (!esNitValido(nit)) {
    err('NIT_RECEPTOR_INVALIDO', 'nitReceptor', `El NIT del receptor (${ctx.nitReceptor}) no es válido: el dígito verificador no coincide.`);
  }
  if (!ctx.nombreReceptor.trim()) err('NOMBRE_RECEPTOR_REQUERIDO', 'nombreReceptor', 'El nombre del receptor es obligatorio.');

  if (nit === 'CF' && ctx.total > LIMITE_CONSUMIDOR_FINAL) {
    err(
      'CF_EXCEDE_LIMITE',
      'nitReceptor',
      `Una factura a Consumidor Final no puede superar Q${LIMITE_CONSUMIDOR_FINAL.toLocaleString('es-GT', { minimumFractionDigits: 2 })}; identifica al comprador con su NIT.`,
    );
  }

  if (ctx.fechaEmision > businessTodayIso()) {
    err('FECHA_FUTURA', 'fechaEmision', 'La fecha de emisión no puede ser futura.');
  }
  if (ctx.total > 9_999_999_999.99) err('TOTAL_EXCEDIDO', 'lineas', 'El total de la factura excede el máximo permitido.');

  if (nit === 'CF') advertencias.push('Factura a Consumidor Final: no podrás usarla como crédito fiscal del comprador.');
  return { errores, advertencias };
}

export function generarUuidAutorizacion(): string {
  return randomUUID().toUpperCase();
}

/** Serie FEL de 8 caracteres hex, estable por empresa (como la serie de un certificado). */
export function serieFelParaEmpresa(idEmpresa: number): string {
  return createHash('sha256').update(`FEL-SIM-${idEmpresa}`).digest('hex').slice(0, 8).toUpperCase();
}

const esc = (v: string) => v
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const fix = (n: number, d = 2) => n.toFixed(d);

export interface DatosXml {
  uuid: string;
  serie: string;
  numero: number;
  fechaEmision: string;
  fechaCertificacion: string;
  moneda: string;
  emisor: { nit: string; nombre: string };
  receptor: { nit: string; nombre: string };
  totales: TotalesFactura;
}

/** XML DTE simplificado (inspirado en dte:GTDocumento v0.1). No es válido ante la SAT. */
export function generarXmlDte(d: DatosXml): string {
  const items = d.totales.lineas.map((l, i) => {
    const base = roundMoney(l.total / (1 + IVA_GT));
    const iva = roundMoney(l.total - base);
    return `      <dte:Item NumeroLinea="${i + 1}" BienOServicio="B">
        <dte:Cantidad>${fix(l.cantidad, 4)}</dte:Cantidad>
        <dte:Descripcion>${esc(l.descripcion)}</dte:Descripcion>
        <dte:PrecioUnitario>${fix(l.precioUnitario)}</dte:PrecioUnitario>
        <dte:Precio>${fix(l.total)}</dte:Precio>
        <dte:Descuento>0.00</dte:Descuento>
        <dte:Impuestos><dte:Impuesto><dte:NombreCorto>IVA</dte:NombreCorto><dte:CodigoUnidadGravable>1</dte:CodigoUnidadGravable><dte:MontoGravable>${fix(base)}</dte:MontoGravable><dte:MontoImpuesto>${fix(iva)}</dte:MontoImpuesto></dte:Impuesto></dte:Impuestos>
        <dte:Total>${fix(l.total)}</dte:Total>
      </dte:Item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- SIMULACIÓN: este DTE no fue certificado por la SAT -->
<dte:GTDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" Version="0.1">
  <dte:SAT ClaseDocumento="dte">
    <dte:DTE ID="DatosCertificados">
      <dte:DatosEmision ID="DatosEmision">
        <dte:DatosGenerales Tipo="FACT" FechaHoraEmision="${esc(d.fechaEmision)}T00:00:00-06:00" CodigoMoneda="${esc(d.moneda)}"/>
        <dte:Emisor NITEmisor="${esc(d.emisor.nit)}" NombreEmisor="${esc(d.emisor.nombre)}" AfiliacionIVA="GEN"/>
        <dte:Receptor IDReceptor="${esc(d.receptor.nit)}" NombreReceptor="${esc(d.receptor.nombre)}"/>
        <dte:Frases><dte:Frase TipoFrase="1" CodigoEscenario="1"/></dte:Frases>
        <dte:Items>
${items}
        </dte:Items>
        <dte:Totales>
          <dte:TotalImpuestos><dte:TotalImpuesto NombreCorto="IVA" TotalMontoImpuesto="${fix(d.totales.iva)}"/></dte:TotalImpuestos>
          <dte:GranTotal>${fix(d.totales.total)}</dte:GranTotal>
        </dte:Totales>
      </dte:DatosEmision>
      <dte:Certificacion>
        <dte:NITCertificador>SIMULADO</dte:NITCertificador>
        <dte:NumeroAutorizacion Serie="${esc(d.serie)}" Numero="${d.numero}">${esc(d.uuid)}</dte:NumeroAutorizacion>
        <dte:FechaHoraCertificacion>${esc(d.fechaCertificacion)}</dte:FechaHoraCertificacion>
      </dte:Certificacion>
    </dte:DTE>
  </dte:SAT>
</dte:GTDocumento>
`;
}
