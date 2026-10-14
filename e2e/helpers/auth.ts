import type { Page } from '@playwright/test';

export const usuarioPrueba = {
  idUsuario: 1,
  username: 'tester',
  nombre: 'Usuario de Prueba',
  rol: 'ADMIN',
  debeCambiarClave: false,
};

/**
 * Simula una sesión ya iniciada (la API de auth va simulada). Registrar DESPUÉS de
 * cualquier page.route genérico de la API: Playwright da prioridad a la última ruta.
 */
export async function simularSesion(page: Page, usuario: Partial<typeof usuarioPrueba> = {}) {
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token-de-prueba', expiresIn: 900, usuario: { ...usuarioPrueba, ...usuario } } }),
  );
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 204 }));
}

/** Visitante sin sesión: la renovación falla, así que las pantallas protegidas mandan al login. */
export async function simularSinSesion(page: Page) {
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ status: 401, json: { error: 'Sin sesión', code: 'SESSION_INVALID' } }),
  );
}

/** Contra la API real (E2E_REAL_API=1): entra por la pantalla de login con E2E_USER / E2E_PASSWORD. */
export async function iniciarSesionReal(page: Page) {
  const username = process.env.E2E_USER;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) throw new Error('Define E2E_USER y E2E_PASSWORD para auditar con la API real.');
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
