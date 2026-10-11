import { test, expect } from '@playwright/test';

const lista = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/cxc/**', (route) =>
    route.fulfill({ json: lista }),
  );
  await page.goto('/cxc/credito/condiciones-credito');
});

test('la página de condiciones de crédito carga', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Nueva Condición/i })).toBeVisible();
});

test('el formulario vacío no se puede guardar y explica por qué', async ({ page }) => {
  await page.getByRole('button', { name: /Nueva Condición/i }).click();

  const guardar = page.getByRole('button', { name: 'Crear condición' });
  await expect(guardar).toBeDisabled();
  await expect(page.getByText('No se puede guardar todavía porque:')).toBeVisible();
});

test('muestra el error en rojo bajo el input al salir de un campo vacío', async ({ page }) => {
  await page.getByRole('button', { name: /Nueva Condición/i }).click();

  const dias = page.getByLabel('Días de crédito');
  await dias.focus();
  await dias.blur();
  await expect(page.getByRole('alert').filter({ hasText: 'es obligatorio' }).first()).toBeVisible();
});
