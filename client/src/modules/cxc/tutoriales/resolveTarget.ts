import type { TourTarget } from './tutorialTypes';

const root = () => document.getElementById('main-content');

/** Fila de título: primer ancestro flex del h1 sin salirse del área de trabajo. */
const headerRow = (main: HTMLElement): HTMLElement | null => {
  const h1 = main.querySelector('h1');
  if (!h1) return null;
  let node: HTMLElement | null = h1.parentElement;
  while (node && node !== main) {
    if (node.classList.contains('flex')) return node;
    node = node.parentElement;
  }
  return h1.parentElement;
};

const visible = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/**
 * Devuelve el elemento a resaltar o null si aún no existe (datos cargando,
 * tabla vacía, etc.). El motor reintenta y, si sigue sin aparecer, muestra
 * el paso centrado.
 */
export const resolveTarget = (target: TourTarget | undefined): HTMLElement | null => {
  const main = root();
  if (!main || !target) return null;

  let el: Element | null = null;

  if (typeof target === 'object') {
    if ('css' in target) {
      el = main.querySelector(target.css);
    } else {
      el =
        Array.from(main.querySelectorAll('button')).find((b) =>
          b.textContent?.toLowerCase().includes(target.button.toLowerCase()),
        ) ?? null;
    }
    return visible(el) ? el : null;
  }

  switch (target) {
    case 'header':
      el = headerRow(main);
      break;
    case 'action': {
      const buttons = headerRow(main)?.querySelectorAll('button');
      el = buttons && buttons.length > 0 ? buttons[buttons.length - 1] : null;
      break;
    }
    case 'filters': {
      const field = main.querySelector('input:not([type="hidden"]), select');
      el = field?.closest('div.bg-white') ?? field?.parentElement ?? null;
      break;
    }
    case 'table':
      el = main.querySelector('table')?.closest('div.rounded-xl') ?? main.querySelector('table');
      break;
    case 'rowActions':
      el = main.querySelector('table tbody tr:first-child td:last-child');
      break;
    case 'pagination': {
      const table = main.querySelector('table')?.closest('div.rounded-xl');
      // El paginador es el hermano posterior al contenedor con scroll de la tabla.
      el = table?.querySelector(':scope > div.border-t') ?? null;
      break;
    }
    case 'banner':
      el = main.querySelector('div.bg-blue-50.border-blue-200, div.bg-amber-50.border-amber-200');
      break;
  }

  return visible(el) ? el : null;
};
