import { test, expect, type Page } from '@playwright/test';
import { simularSesion } from './helpers/auth';

const usuario = {
  idUsuario: 2, username: 'maria.lopez', nombre: 'María López', email: null, rol: 'OPERADOR', estado: 'ACTIVO',
  debeCambiarClave: true, minutosBloqueo: 0, intentosFallidos: 0, sesionesActivas: 0, ultimoLogin: null,
  fechaCreacion: '2026-10-13T12:00:00.000Z',
};
const lista = { data: [usuario], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } };

async function prepararApi(page: Page, rol: 'ADMIN' | 'OPERADOR' = 'ADMIN') {
  await page.route('**/api/**', (route) => route.fulfill({ json: lista }));
  await simularSesion(page, { rol });
}

test.describe('Gestión de usuarios', () => {
  test('el administrador ve el listado y el acceso en el menú', async ({ page }) => {
    await prepararApi(page);
    await page.goto('/admin/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuarios y accesos' })).toBeVisible();
    await expect(page.getByText('María López')).toBeVisible();
    await expect(page.getByText('Clave temporal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Usuarios y accesos' })).toBeVisible();
  });

  test('un usuario que no es administrador ve por qué no puede entrar', async ({ page }) => {
    await prepararApi(page, 'OPERADOR');
    await page.goto('/admin/usuarios');
    await expect(page.getByText('No tienes permiso para ver esta pantalla')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Usuarios y accesos' })).toHaveCount(0);
  });

  test('el formulario explica los errores bajo cada campo', async ({ page }) => {
    await prepararApi(page);
    await page.goto('/admin/usuarios');
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    await page.getByRole('textbox', { name: /^Usuario/ }).fill('ab');
    await page.getByRole('textbox', { name: /^Usuario/ }).blur();
    await expect(page.getByText('El usuario debe tener al menos 3 caracteres')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear usuario' })).toBeDisabled();
    await expect(page.getByText('No se puede guardar todavía porque:')).toBeVisible();
  });

  test('crear un usuario muestra la contraseña temporal una sola vez', async ({ page }) => {
    await prepararApi(page);
    await page.route('**/api/admin/usuarios', (route) => {
      if (route.request().method() !== 'POST') return route.fulfill({ json: lista });
      return route.fulfill({ status: 201, json: { usuario, claveTemporal: 'Temp#Clave2026x' } });
    });
    await page.goto('/admin/usuarios');
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    await page.getByRole('textbox', { name: /^Usuario/ }).fill('maria.lopez');
    await page.getByLabel('Nombre completo').fill('María López');
    await page.getByRole('button', { name: 'Crear usuario' }).click();
    await page.getByRole('button', { name: 'Sí, guardar' }).click();
    await expect(page.getByText('Temp#Clave2026x')).toBeVisible();
    await expect(page.getByText('Se muestra solo esta vez.')).toBeVisible();
  });

  test('el servidor rechaza un usuario repetido y el error sale bajo el campo', async ({ page }) => {
    await prepararApi(page);
    await page.route('**/api/admin/usuarios', (route) => {
      if (route.request().method() !== 'POST') return route.fulfill({ json: lista });
      return route.fulfill({
        status: 400,
        json: { error: 'Ya existe un usuario "maria.lopez".', code: 'VALIDATION_ERROR', details: [{ campo: 'username', mensaje: 'Ya existe un usuario "maria.lopez". Elige otro nombre de usuario.' }] },
      });
    });
    await page.goto('/admin/usuarios');
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    await page.getByRole('textbox', { name: /^Usuario/ }).fill('maria.lopez');
    await page.getByLabel('Nombre completo').fill('María López');
    await page.getByRole('button', { name: 'Crear usuario' }).click();
    await page.getByRole('button', { name: 'Sí, guardar' }).click();
    await expect(page.getByText('Elige otro nombre de usuario.')).toBeVisible();
  });
});
