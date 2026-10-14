import { test, expect, type Page } from '@playwright/test';
import { simularSesion, simularSinSesion, usuarioPrueba } from './helpers/auth';

const listaVacia = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } };

/** API genérica simulada + visitante sin sesión. */
async function visitante(page: Page) {
  await page.route('**/api/**', (route) => route.fulfill({ json: listaVacia }));
  await simularSinSesion(page);
}

async function escribirCredenciales(page: Page, clave = 'Clave#Segura2026') {
  await page.getByLabel('Usuario').fill('tester');
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();
}

test.describe('Login', () => {
  test('sin sesión, cualquier pantalla redirige al login', async ({ page }) => {
    await visitante(page);
    await page.goto('/cxc/facturacion/facturas');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('campos vacíos muestran el error bajo cada input', async ({ page }) => {
    await visitante(page);
    await page.goto('/login');
    await page.getByRole('button', { name: /Iniciar sesión/ }).click();
    await expect(page.getByText('Ingresa tu usuario.')).toBeVisible();
    await expect(page.getByText('Ingresa tu contraseña.')).toBeVisible();
  });

  test('credenciales incorrectas muestran un mensaje genérico', async ({ page }) => {
    await visitante(page);
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ status: 401, json: { error: 'Usuario o contraseña incorrectos.', code: 'UNAUTHORIZED' } }));
    await page.goto('/login');
    await escribirCredenciales(page, 'mala');
    await expect(page.getByRole('alert').filter({ hasText: 'Usuario o contraseña incorrectos' })).toBeVisible();
  });

  test('demasiados intentos muestra la cuenta regresiva y bloquea el botón', async ({ page }) => {
    await visitante(page);
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ status: 429, headers: { 'Retry-After': '120' }, json: { error: 'Demasiados intentos', code: 'TOO_MANY_REQUESTS', retryAfter: 120 } }));
    await page.goto('/login');
    await escribirCredenciales(page, 'mala');
    await expect(page.getByText(/Podrás intentarlo en 2:0/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Intenta en/ })).toBeDisabled();
  });

  test('inicio de sesión correcto entra al sistema', async ({ page }) => {
    await visitante(page);
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ json: { accessToken: 'token-de-prueba', expiresIn: 900, usuario: usuarioPrueba } }));
    await page.goto('/login');
    await escribirCredenciales(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('clave temporal obliga a cambiarla', async ({ page }) => {
    await visitante(page);
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ json: { accessToken: 'token-de-prueba', expiresIn: 900, usuario: { ...usuarioPrueba, debeCambiarClave: true } } }));
    await page.goto('/login');
    await escribirCredenciales(page, 'Temporal#2026x');
    await expect(page).toHaveURL(/\/cambiar-clave/);
    await expect(page.getByRole('heading', { name: 'Crea tu contraseña' })).toBeVisible();
  });

  test('con sesión activa, /login redirige al sistema', async ({ page }) => {
    await page.route('**/api/**', (route) => route.fulfill({ json: listaVacia }));
    await simularSesion(page);
    await page.goto('/login');
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('Recuperación de contraseña', () => {
  test('desde el login se llega a la recuperación y se pide el dato', async ({ page }) => {
    await visitante(page);
    await page.goto('/login');
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByText('Ingresa tu usuario o tu correo electrónico.')).toBeVisible();
  });

  test('la confirmación es genérica y no revela si la cuenta existe', async ({ page }) => {
    await visitante(page);
    await page.route('**/api/auth/recuperar', (route) =>
      route.fulfill({ status: 202, json: { mensaje: 'Si los datos coinciden con una cuenta con correo registrado, enviaremos un enlace para restablecer la contraseña.' } }));
    await page.goto('/recuperar-clave');
    await page.getByLabel('Usuario o correo electrónico').fill('cualquiera');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
    await expect(page.getByText(/Si los datos coinciden/)).toBeVisible();
  });

  test('un enlace vencido explica qué hacer', async ({ page }) => {
    await visitante(page);
    await page.route('**/api/auth/recuperar/verificar', (route) => route.fulfill({ json: { valido: false } }));
    await page.goto('/restablecer-clave?token=token-de-prueba-vencido-123456');
    await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Solicitar un enlace nuevo' })).toBeVisible();
  });

  test('un enlace válido permite crear la contraseña y vuelve al login', async ({ page }) => {
    await visitante(page);
    await page.route('**/api/auth/recuperar/verificar', (route) => route.fulfill({ json: { valido: true } }));
    await page.route('**/api/auth/recuperar/restablecer', (route) => route.fulfill({ json: { mensaje: 'ok' } }));
    await page.goto('/restablecer-clave?token=token-de-prueba-valido-1234567');
    await expect(page).toHaveURL(/\/restablecer-clave$/); // el token se borra de la barra de direcciones
    await page.getByLabel('Contraseña nueva').fill('Nueva#Clave2026');
    await page.getByLabel('Confirmar contraseña').fill('Nueva#Clave2026');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Tu contraseña se actualizó correctamente/)).toBeVisible();
  });
});
