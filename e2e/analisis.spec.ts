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
    await page.getByLabel('Cobrador', { exact: true }).selectOption({ index: 1 });
    await expect(page).toHaveURL(/e=\d+/);
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

  test('mejores días de cobro: la columna de un día abre sus pagos', async ({ page }) => {
    await preparar(page);
    await page.goto('/cxc/analisis/dias-cobro');
    await expect(page.getByRole('heading', { name: 'Mejores días de cobro' })).toBeVisible();
    await expect(page.getByText('Lectura rápida:')).toBeVisible();
    await page.getByRole('button', { name: /Vie de la semana 1/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
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
