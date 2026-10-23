import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  required?: boolean;
  error?: string;
  options?: SearchableSelectOption[];
  isReadOnly?: boolean;
  value?: string | number;
  /** Misma firma que Select: se invoca con un objeto tipo evento { target: { value } }. */
  onChange?: (e: { target: { value: string } }) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  helperText?: string;
  className?: string;
  id?: string;
}

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Select con barra de búsqueda para listas largas (clientes, documentos...).
 * Mantiene la API de Select del kit (value/onChange con target.value) para
 * poder intercambiarlos sin tocar la lógica de los formularios. Filtra sin
 * distinguir mayúsculas ni acentos y busca en todo el texto de la opción
 * (nombre, NIT, serie...).
 */
export function SearchableSelect({
  label,
  required = false,
  error,
  options = [],
  isReadOnly = false,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Escribe para buscar...',
  helperText,
  className = '',
  id,
}: SearchableSelectProps) {
  const reactId = useId().replace(/:/g, '');
  const baseId = id || `ss-${reactId}`;
  const listId = `${baseId}-list`;
  const errorId = `${baseId}-error`;
  const helpId = `${baseId}-help`;

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);

  const selected = options.find((o) => String(o.value) === String(value ?? ''));
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((o) => normalize(o.label).includes(q)) : options;
  }, [options, query]);

  const resolvedError =
    error ?? (touched && required && !isReadOnly && !selected
      ? `Debes seleccionar ${label ? label.toLowerCase() : 'una opción'}.`
      : undefined);
  const resolvedHelper =
    helperText ?? (label ? `Selecciona ${label.toLowerCase()}${required ? '; campo obligatorio' : ''}.` : undefined);

  const close = () => {
    setOpen(false);
    setQuery('');
    setTouched(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => { setActive(0); }, [query, open]);

  const choose = (opt: SearchableSelectOption) => {
    onChange?.({ target: { value: String(opt.value) } });
    close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) choose(filtered[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };

  return (
    <div ref={rootRef} className={`w-full flex flex-col gap-1.5 relative ${className}`}>
      {label && (
        <label htmlFor={baseId} className="text-xs font-semibold text-slate-700 flex items-center">
          {label}
          {required && <span className="text-red-500 ml-0.5" title="Campo requerido" aria-hidden="true">*</span>}
        </label>
      )}

      <button
        id={baseId}
        type="button"
        disabled={isReadOnly}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-required={required || undefined}
        aria-invalid={Boolean(resolvedError) || undefined}
        aria-describedby={resolvedError ? errorId : resolvedHelper ? helpId : undefined}
        className={`w-full h-10 pl-3 pr-9 text-sm text-left rounded-lg border relative transition-all duration-150 outline-none ${
          isReadOnly
            ? 'bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed font-medium'
            : 'bg-white border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer'
        } ${resolvedError ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
      >
        <span className={`block truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="relative border-b border-slate-100 p-2">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-label={`Buscar ${label ? label.toLowerCase() : 'opción'}`}
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${baseId}-opt-${active}` : undefined}
              className="w-full h-9 pl-8 pr-3 text-sm rounded-md border border-slate-300 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">Sin resultados para “{query}”.</li>
            )}
            {filtered.map((opt, index) => {
              const isSelected = String(opt.value) === String(value ?? '');
              return (
                <li
                  key={`${opt.value}-${index}`}
                  id={`${baseId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => { e.preventDefault(); choose(opt); }}
                  className={`px-3 py-2 text-sm cursor-pointer ${
                    index === active ? 'bg-blue-50 text-blue-900' : 'text-slate-800'
                  } ${isSelected ? 'font-semibold' : ''}`}
                >
                  {opt.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {resolvedError && <span id={errorId} role="alert" className="text-xs text-red-600 font-medium">{resolvedError}</span>}
      {!resolvedError && resolvedHelper && <span id={helpId} className="text-xs text-slate-500 leading-relaxed">{resolvedHelper}</span>}
    </div>
  );
}
