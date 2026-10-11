import { TextInput } from '../../../../shared/ui-kit';
import { todayIso, validateRequiredDate } from '../../../../shared/validation';

interface RangoFechasProps {
  desde: string;
  hasta: string;
  onChange: (rango: { desde: string; hasta: string }) => void;
}

/** Devuelve el motivo por el que el rango no sirve, o undefined si es válido. */
export function validarRango(desde: string, hasta: string): { desde?: string; hasta?: string } {
  const errores: { desde?: string; hasta?: string } = {};
  errores.desde = validateRequiredDate(desde, 'La fecha inicial');
  errores.hasta = validateRequiredDate(hasta, 'La fecha final', { notFuture: true });
  if (!errores.desde && !errores.hasta && desde > hasta) errores.hasta = 'La fecha final no puede ser anterior a la inicial.';
  return errores;
}

export const RangoFechas = ({ desde, hasta, onChange }: RangoFechasProps) => {
  const errores = validarRango(desde, hasta);
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
      <TextInput label="Desde" type="date" required value={desde} max={hasta || todayIso()}
        onChange={(e: any) => onChange({ desde: e.target.value, hasta })} error={errores.desde} helperText="Inicio del período a analizar." />
      <TextInput label="Hasta" type="date" required value={hasta} max={todayIso()}
        onChange={(e: any) => onChange({ desde, hasta: e.target.value })} error={errores.hasta} helperText="Fin del período; no puede ser futuro." />
    </div>
  );
};

/** Primer día de hace 5 meses y hoy: 6 meses calendario. */
export function rangoInicial(): { desde: string; hasta: string } {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { desde: `${inicio.getFullYear()}-${pad(inicio.getMonth() + 1)}-01`, hasta: todayIso() };
}
