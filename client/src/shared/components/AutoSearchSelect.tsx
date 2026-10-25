import { Select as SelectBase } from '../../components/ui/FormControls';
import { SearchableSelect } from './SearchableSelect';

/** A partir de este número de opciones el desplegable muestra la barra de búsqueda. */
export const SEARCHABLE_SELECT_THRESHOLD = 7;

/**
 * Select del kit que, cuando la lista es larga (clientes, pagos, documentos...),
 * se muestra con lupa y búsqueda por texto. Con listas cortas (estados, tipos)
 * conserva el select nativo. Se exporta como `Select` desde shared/ui-kit, así
 * que todos los formularios lo reciben sin cambios.
 */
export function AutoSearchSelect(props: any) {
  const { options = [], icon, ...rest } = props;
  if (!icon && Array.isArray(options) && options.length > SEARCHABLE_SELECT_THRESHOLD) {
    return <SearchableSelect options={options} {...rest} />;
  }
  const Base = SelectBase as any;
  return <Base options={options} icon={icon} {...rest} />;
}
