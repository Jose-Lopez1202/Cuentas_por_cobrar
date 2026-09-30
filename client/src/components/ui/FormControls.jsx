import React, { useEffect, useId, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const DEFAULT_DATE_MIN = '1900-01-01';
const DEFAULT_DATE_MAX = '2100-12-31';

const slug = (value = 'field') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const sanitizeRestrictedValue = (
  rawValue,
  restriction,
  allowNegative = false,
  decimalPlaces,
  uppercase = false,
) => {
  let value = String(rawValue ?? '');

  switch (restriction) {
    case 'letters':
      value = value.replace(/[^\p{L}\s.'’-]/gu, '');
      break;
    case 'integer': {
      const sign = allowNegative && value.trimStart().startsWith('-') ? '-' : '';
      value = sign + value.replace(/\D/g, '');
      break;
    }
    case 'decimal': {
      const normalized = value.replace(/,/g, '.');
      const sign = allowNegative && normalized.trimStart().startsWith('-') ? '-' : '';
      const clean = normalized.replace(/[^0-9.]/g, '');
      const firstDot = clean.indexOf('.');
      const whole = firstDot >= 0 ? clean.slice(0, firstDot) : clean;
      let decimals = firstDot >= 0 ? clean.slice(firstDot + 1).replace(/\./g, '') : '';
      if (decimalPlaces !== undefined) decimals = decimals.slice(0, decimalPlaces);
      value = sign + whole + (firstDot >= 0 ? `.${decimals}` : '');
      break;
    }
    case 'alphanumeric':
      value = value.replace(/[^\p{L}\p{N}\s.,:'’\-_/#+&()]/gu, '');
      break;
    case 'identifier':
      value = value.replace(/[^A-Za-z0-9\-_/]/g, '');
      break;
    case 'nit':
      value = value.toUpperCase().replace(/[^0-9KCF-]/g, '');
      break;
    default:
      break;
  }

  return uppercase ? value.toUpperCase() : value;
};

const defaultHint = ({ label, type, restriction, required, maxLength, decimalPlaces }) => {
  if (!label) return undefined;
  const name = label.toLowerCase();

  if (restriction === 'letters') return `Solo letras y separadores válidos para ${name}.`;
  if (restriction === 'integer') return `Solo números enteros${required ? '; campo obligatorio' : ''}.`;
  if (restriction === 'decimal') {
    return `Solo números${decimalPlaces ? `, máximo ${decimalPlaces} decimales` : ''}${required ? '; campo obligatorio' : ''}.`;
  }
  if (restriction === 'identifier') return 'Letras y números; admite -, _ y /.';
  if (restriction === 'nit') return 'Formato NIT, por ejemplo 1234567-8.';
  if (restriction === 'alphanumeric') return `Admite letras y números para ${name}.`;
  if (type === 'date') return `Selecciona una fecha válida entre ${DEFAULT_DATE_MIN} y ${DEFAULT_DATE_MAX}${required ? '; campo obligatorio' : ''}.`;
  if (type === 'time') return `Selecciona una hora válida${required ? '; campo obligatorio' : ''}.`;
  if (maxLength) return `Máximo ${maxLength} caracteres.`;
  if (required) return 'Campo obligatorio.';
  return undefined;
};

const restrictionPattern = (restriction, allowNegative, decimalPlaces) => {
  if (restriction === 'integer') return allowNegative ? '-?[0-9]+' : '[0-9]+';
  if (restriction === 'decimal') {
    const dp = decimalPlaces ?? 2;
    return allowNegative
      ? `-?[0-9]+(?:\\.[0-9]{1,${dp}})?`
      : `[0-9]+(?:\\.[0-9]{1,${dp}})?`;
  }
  if (restriction === 'identifier') return '[A-Za-z0-9][A-Za-z0-9_\\-/]*';
  if (restriction === 'nit') return '(?:CF|[0-9]{4,12}-?[0-9K])';
  return undefined;
};


const semanticValidityMessage = ({
  value,
  restriction,
  min,
  max,
  required,
  label,
}) => {
  const field = label || 'El campo';
  const raw = String(value ?? '').trim();

  if (!raw) return required ? `${field} es obligatorio.` : '';

  if (restriction === 'integer' || restriction === 'decimal') {
    const number = Number(raw);
    if (!Number.isFinite(number)) return `${field} debe ser un número válido.`;

    if (restriction === 'integer' && !Number.isInteger(number)) {
      return `${field} debe ser un número entero.`;
    }
    if (min !== undefined && min !== null && min !== '' && number < Number(min)) {
      return `${field} debe ser mayor o igual a ${min}.`;
    }
    if (max !== undefined && max !== null && max !== '' && number > Number(max)) {
      return `${field} debe ser menor o igual a ${max}.`;
    }
  }

  return '';
};

/**
 * TextInput accesible con restricciones semánticas.
 *
 * type="number" se renderiza como texto + inputMode para impedir e/E/+
 * y notación científica. Las reglas de negocio siguen validadas también
 * en el formulario y en el backend.
 */
export const TextInput = ({
  label,
  required = false,
  error,
  icon: Icon,
  isReadOnly = false,
  placeholder = '',
  value,
  onChange,
  onBlur,
  type = 'text',
  helperText,
  className = '',
  id,
  restriction,
  allowNegative = false,
  decimalPlaces,
  uppercase = false,
  maxLength,
  inputMode,
  min,
  max,
  pattern,
  ...props
}) => {
  const reactId = useId().replace(/:/g, '');
  const inputRef = useRef(null);
  const inputId = id || `input-${slug(label)}-${reactId}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  const inferredRestriction = restriction ?? (
    type === 'number'
      ? (String(props.step ?? '') && String(props.step) !== '1' ? 'decimal' : 'integer')
      : 'none'
  );

  const inferredDecimalPlaces =
    inferredRestriction === 'decimal'
      ? (decimalPlaces ?? (String(props.step ?? '') === '0.0001' ? 4 : 2))
      : decimalPlaces;

  const renderedType = type === 'number' ? 'text' : type;
  const resolvedInputMode = inputMode ?? (
    inferredRestriction === 'integer'
      ? 'numeric'
      : inferredRestriction === 'decimal'
        ? 'decimal'
        : undefined
  );

  const resolvedHelperText = helperText ?? defaultHint({
    label,
    type,
    restriction: inferredRestriction,
    required,
    maxLength,
    decimalPlaces: inferredDecimalPlaces,
  });

  const resolvedPattern = pattern ?? restrictionPattern(
    inferredRestriction,
    allowNegative,
    inferredDecimalPlaces,
  );

  const resolvedMin = type === 'date' ? (min ?? DEFAULT_DATE_MIN) : min;
  const resolvedMax = type === 'date' ? (max ?? DEFAULT_DATE_MAX) : max;

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.setCustomValidity(
      semanticValidityMessage({
        value,
        restriction: inferredRestriction,
        min,
        max,
        required,
        label,
      }),
    );
  }, [value, inferredRestriction, min, max, required, label]);

  const handleChange = (event) => {
    if (!onChange) return;
    const nextValue = sanitizeRestrictedValue(
      event.target.value,
      inferredRestriction,
      allowNegative,
      inferredDecimalPlaces,
      uppercase,
    );
    if (nextValue !== event.target.value) event.target.value = nextValue;
    onChange(event);
  };

  const handleBlur = (event) => {
    if (uppercase && typeof event.target.value === 'string') {
      event.target.value = event.target.value.toUpperCase().trim();
      onChange?.(event);
    }
    onBlur?.(event);
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 flex items-center">
          {label}
          {required && <span className="text-red-500 ml-0.5" title="Campo requerido" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative flex items-center w-full">
        {Icon && (
          <div className="absolute left-3 pointer-events-none text-slate-400 flex items-center justify-center" aria-hidden="true">
            <Icon size={16} />
          </div>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type={renderedType}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          readOnly={isReadOnly}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          inputMode={resolvedInputMode}
          min={resolvedMin}
          max={resolvedMax}
          pattern={resolvedPattern}
          aria-required={required || undefined}
          aria-readonly={isReadOnly || undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : resolvedHelperText ? helpId : undefined}
          className={`
            w-full h-10 px-3 text-sm rounded-lg border transition-all duration-150 outline-none
            ${Icon ? 'pl-9' : 'pl-3'}
            ${isReadOnly
              ? 'bg-slate-50 text-slate-600 border-slate-200 cursor-default font-medium select-all'
              : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-100 text-red-900' : ''}
          `}
          {...props}
        />
      </div>

      {error && (
        <span id={errorId} role="alert" className="text-xs text-red-600 font-medium flex items-center gap-1">
          {error}
        </span>
      )}

      {!error && resolvedHelperText && (
        <span id={helpId} className="text-xs text-slate-500 leading-relaxed">{resolvedHelperText}</span>
      )}
    </div>
  );
};

export const Select = ({
  label,
  required = false,
  error,
  icon: Icon,
  options = [],
  isReadOnly = false,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  helperText,
  className = '',
  id,
  ...props
}) => {
  const reactId = useId().replace(/:/g, '');
  const selectId = id || `select-${slug(label)}-${reactId}`;
  const errorId = `${selectId}-error`;
  const helpId = `${selectId}-help`;
  const resolvedHelperText = helperText ?? (
    label ? `Selecciona ${label.toLowerCase()}${required ? '; campo obligatorio' : ''}.` : undefined
  );

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-slate-700 flex items-center">
          {label}
          {required && <span className="text-red-500 ml-0.5" title="Campo requerido" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative flex items-center w-full">
        {Icon && (
          <div className="absolute left-3 pointer-events-none text-slate-400 flex items-center justify-center" aria-hidden="true">
            <Icon size={16} />
          </div>
        )}

        <select
          id={selectId}
          value={value}
          onChange={onChange}
          disabled={isReadOnly}
          required={required}
          aria-required={required || undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : resolvedHelperText ? helpId : undefined}
          className={`
            w-full h-10 px-3 pr-9 text-sm rounded-lg border appearance-none transition-all duration-150 outline-none
            ${Icon ? 'pl-9' : 'pl-3'}
            ${isReadOnly
              ? 'bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed font-medium'
              : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer'}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}
          `}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt, index) => {
            const optVal = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={`${optVal}-${index}`} value={optVal}>
                {optLabel}
              </option>
            );
          })}
        </select>

        <div className="absolute right-3 pointer-events-none text-slate-400 flex items-center justify-center" aria-hidden="true">
          <ChevronDown size={16} />
        </div>
      </div>

      {error && <span id={errorId} role="alert" className="text-xs text-red-600 font-medium">{error}</span>}
      {!error && resolvedHelperText && <span id={helpId} className="text-xs text-slate-500 leading-relaxed">{resolvedHelperText}</span>}
    </div>
  );
};

export const TextArea = ({
  label,
  required = false,
  error,
  isReadOnly = false,
  rows = 3,
  placeholder = '',
  value,
  onChange,
  helperText,
  className = '',
  id,
  maxLength,
  showCharacterCount = true,
  ...props
}) => {
  const reactId = useId().replace(/:/g, '');
  const areaId = id || `area-${slug(label)}-${reactId}`;
  const errorId = `${areaId}-error`;
  const helpId = `${areaId}-help`;
  const resolvedHelperText = helperText ?? (
    label ? `Describe ${label.toLowerCase()}${maxLength ? ` (máx. ${maxLength} caracteres)` : ''}.` : undefined
  );

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={areaId} className="text-xs font-semibold text-slate-700 flex items-center">
          {label}
          {required && <span className="text-red-500 ml-0.5" title="Campo requerido" aria-hidden="true">*</span>}
        </label>
      )}

      <textarea
        id={areaId}
        rows={rows}
        value={value}
        onChange={onChange}
        readOnly={isReadOnly}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        aria-required={required || undefined}
        aria-readonly={isReadOnly || undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : resolvedHelperText ? helpId : undefined}
        className={`
          w-full px-3 py-2 text-sm rounded-lg border transition-all duration-150 outline-none resize-y
          ${isReadOnly
            ? 'bg-slate-50 text-slate-600 border-slate-200 cursor-default font-medium'
            : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'}
          ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-100 text-red-900' : ''}
        `}
        {...props}
      />

      {error && <span id={errorId} role="alert" className="text-xs text-red-600 font-medium">{error}</span>}
      {!error && (resolvedHelperText || (maxLength && showCharacterCount)) && (
        <div id={helpId} className="flex justify-between gap-3 text-xs text-slate-500 leading-relaxed">
          <span>{resolvedHelperText}</span>
          {maxLength && showCharacterCount && (
            <span className="shrink-0 tabular-nums" aria-label={`${String(value ?? '').length} de ${maxLength} caracteres`}>
              {String(value ?? '').length}/{maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const Checkbox = ({
  label,
  helperText,
  checked = false,
  onChange,
  disabled = false,
  required = false,
  className = '',
  id,
  ...props
}) => {
  const reactId = useId().replace(/:/g, '');
  const checkId = id || `check-${slug(label)}-${reactId}`;
  const helpId = `${checkId}-help`;

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="flex items-center h-5 pt-0.5">
        <input
          id={checkId}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-describedby={helperText ? helpId : undefined}
          className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer disabled:cursor-not-allowed accent-blue-600"
          {...props}
        />
      </div>
      <div className="flex flex-col text-sm">
        {label && (
          <label htmlFor={checkId} className="font-medium text-slate-900 cursor-pointer select-none">
            {label}
            {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        {helperText && (
          <p id={helpId} className="text-xs text-slate-500 mt-0.5 leading-relaxed">{helperText}</p>
        )}
      </div>
    </div>
  );
};
