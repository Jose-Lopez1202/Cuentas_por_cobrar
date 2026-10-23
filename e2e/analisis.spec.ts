import { test, expect, type Page } from '@playwright/test';
import { simularSesion } from './helpers/auth';
import { simularAnalitica } from './fixtures/analitica';

async function preparar(page: Page) {
  await page.route('**/localhost:3000/api/**', (route) => route.fulfill({ json: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } } }));
  await simularSesion(page);
  await simularAnalitica(page);
}

test.describe('Análisis de cobranza', () => {
  test('el panel ejecutivo muestra indicadores, alertas y los filtros', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/dashboard');
    await expect(page.getByRole('heading', { name: 'Panel de Cuentas por Cobrar' })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Índice de cobranza').first()).toBeVisible();
    await expect(page.getByText('Qué atender')).toBeVisible();
    await expect(page.getByText('Cartera con más de 90 días de atraso')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Período' })).toBeVisible();
  });

  test('cambiar el período actualiza la URL para poder compartir el filtro', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/dashboard');
    await page.getByRole('button', { name: '30 días' }).click();
    await expect(page).toHaveURL(/p=30d/);
  });

  test('las listas desplegables tienen buscador (cobrador y cliente)', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/dashboard');
    // Cobrador: se filtra la lista local al escribir.
    await page.getByRole('combobox', { name: 'Cobrador' }).click();
    await page.getByRole('searchbox', { name: 'Buscar cobrador…' }).fill('gabri');
    await expect(page.getByRole('option', { name: /Gabriela Soto/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Ana Morales/ })).toHaveCount(0);
    await page.getByRole('option', { name: /Gabriela Soto/ }).click();
    await expect(page).toHaveURL(/e=\d+/);
    // Cliente: busca en el servidor y recuerda el nombre en la URL.
    const pedido = page.waitForRequest((r) => /resumen/.test(r.url()) && /idCliente=/.test(r.url()));
    await page.getByRole('combobox', { name: 'Cliente' }).click();
    await page.getByRole('searchbox').fill('ferre');
    await page.getByRole('option', { name: /Ferretería El Constructor/ }).click();
    await pedido;
    await expect(page).toHaveURL(/c=3/);
    await expect(page.getByRole('combobox', { name: 'Cliente' })).toContainText('Ferretería El Constructor');
  });

  test('filtrado cruzado: elegir un tramo de antigüedad recalcula todo el tablero', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/dashboard');
    await expect(page.getByText('Qué atender')).toBeVisible();
    const pedido = page.waitForRequest((r) => /resumen/.test(r.url()) && /tramo=3/.test(r.url()));
    await page.locator('.recharts-bar-rectangle').nth(2).click();
    await pedido;
    await expect(page.getByRole('group', { name: 'Selección activa en los gráficos' })).toContainText('Antigüedad: 31 a 60 días');
    await expect(page).toHaveURL(/t=3/);
    // Un segundo clic en lo mismo quita la selección.
    await page.locator('.recharts-bar-rectangle').nth(2).click();
    await expect(page).not.toHaveURL(/t=3/);
    await expect(page.getByRole('group', { name: 'Selección activa en los gráficos' })).toHaveCount(0);
  });

  test('filtrado cruzado: forma de pago y cobrador se combinan y se quitan con la selección', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/dashboard');
    await page.getByRole('button', { name: 'Filtrar el tablero por Efectivo' }).click();
    await page.getByRole('button', { name: 'Filtrar el tablero por Ana Morales' }).click();
    const seleccion = page.getByRole('group', { name: 'Selección activa en los gráficos' });
    await expect(seleccion).toContainText('Forma de pago: Efectivo');
    await expect(page).toHaveURL(/f=2/);
    await expect(page).toHaveURL(/e=3/);
    await page.getByRole('button', { name: 'Quitar selección: Forma de pago: Efectivo' }).click();
    await expect(page).not.toHaveURL(/f=2/);
  });

  test('días de cobro: elegir un día filtra el tablero y se puede ver sus pagos', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/analisis/dias-cobro');
    const pedido = page.waitForRequest((r) => /dias-cobro/.test(r.url()) && /diaSemana=5/.test(r.url()));
    await page.getByRole('button', { name: /Vie de la semana 1/ }).click();
    await pedido;
    await expect(page.getByRole('group', { name: 'Selección activa en los gráficos' })).toContainText('Día: Viernes');
    await page.getByRole('button', { name: 'Ver los pagos de ese día' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('rutas: elegir una zona deja el tablero solo con esa zona', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/analisis/rutas');
    const pedido = page.waitForRequest((r) => /analitica\/rutas\?/.test(r.url()) && /baseRuta=Ruta(\+|%20)Zona(\+|%20)11/.test(r.url()));
    await page.getByRole('button', { name: 'Filtrar el tablero por Ruta Zona 11' }).click();
    await pedido;
    await expect(page.getByRole('group', { name: 'Selección activa en los gráficos' })).toContainText('Zona: Ruta Zona 11');
  });

  test('cobradores: elegir a una persona deja solo su información', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/analisis/cobradores');
    await page.getByRole('button', { name: 'Filtrar el tablero por Ana Morales' }).first().click();
    await expect(page.getByText('Puesto en el ranking')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ver desempeño de José Hernández/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Ver desempeño de Ana Morales/ })).toBeVisible();
    await page.getByRole('button', { name: 'Filtrar el tablero por Ana Morales' }).first().click();
    await expect(page.getByRole('button', { name: /Ver desempeño de José Hernández/ })).toBeVisible();
  });

  test('clientes en riesgo: elegir un nivel atenúa la matriz y filtra la tabla', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/analisis/clientes-riesgo');
    await page.getByRole('button', { name: /Alto/ }).first().click();
    await expect(page.getByRole('button', { name: /Ver ficha de Distribuidora Central/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Ver ficha de Comercial Los Pinos/ })).toBeVisible();
  });

  test('el estado de cuenta busca clientes escribiendo en la lista', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/reportes/estado-cuenta');
    await page.getByRole('combobox', { name: 'Cliente' }).click();
    await page.getByRole('searchbox').fill('farma');
    await expect(page.getByRole('option', { name: /Farmacia San Rafael/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Abarrotes/ })).toHaveCount(0);
  });

  test('una fila de deudores abre la ficha del cliente con el porqué del puntaje', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/dashboard');
    await page.getByRole('button', { name: /Ver ficha de Distribuidora Central/ }).click();
    const panel = page.getByRole('dialog');
    await expect(panel.getByText('¿Por qué este puntaje?')).toBeVisible();
    await expect(panel.getByText('Antigüedad de la deuda')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('el ranking de cobradores permite entrar al detalle de cada persona', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/analisis/cobradores');
    await expect(page.getByRole('heading', { name: 'Ranking de cobradores' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quién cobra más' })).toBeVisible();
    await page.getByRole('button', { name: /Ver desempeño de Ana Morales/ }).click();
    const panel = page.getByRole('dialog');
    await expect(panel.getByText('Cobro diario')).toBeVisible();
    // Desde el detalle del cobrador se puede entrar a un cliente y volver.
    await panel.getByRole('button', { name: /Ver ficha de Distribuidora Central/ }).first().click();
    await expect(page.getByRole('dialog').getByText('¿Por qué este puntaje?')).toBeVisible();
    await page.getByRole('button', { name: 'Volver al detalle anterior' }).click();
    await expect(page.getByRole('dialog').getByText('Cobro diario')).toBeVisible();
  });

  test('rutas recurrentes: una zona abre sus salidas y paradas', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/analisis/rutas');
    await page.getByRole('button', { name: 'Ver detalle de Ruta Zona 1', exact: true }).first().click();
    const panel = page.getByRole('dialog');
    await expect(panel.getByText('Todas las salidas de esta ruta en el período')).toBeVisible();
    await panel.getByRole('tab', { name: /Paradas/ }).click();
    await expect(panel.getByText('Comercial Los Pinos, S.A.')).toBeVisible();
  });

  test('clientes problemáticos: filtrar por nivel y abrir una ficha', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/analisis/clientes-riesgo');
    await expect(page.getByRole('heading', { name: 'Clientes problemáticos' })).toBeVisible();
    await page.getByRole('button', { name: /Alto/ }).first().click();
    await expect(page.getByText('Solo nivel alto')).toBeVisible();
    await page.getByRole('button', { name: /Ver ficha de Comercial Los Pinos/ }).click();
    await expect(page.getByRole('dialog').getByText('¿Por qué este puntaje?')).toBeVisible();
  });

  test('un rango de fechas invertido explica el problema', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/dashboard?p=custom&d=2026-10-17&h=2026-07-01');
    await expect(page.getByText(/La fecha inicial no puede ser posterior a la final/)).toBeVisible();
  });
});
