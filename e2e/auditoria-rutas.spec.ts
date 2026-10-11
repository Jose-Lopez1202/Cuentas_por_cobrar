import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/**
 * AUDITORÍA AUTOMÁTICA DE PANTALLAS
 *
 * Lee client/src/app/routes.tsx, así que cada pantalla nueva que se agregue al
 * router se audita sola, sin tocar este archivo. Por cada ruta revisa:
 *   1. que cargue sin excepciones de JavaScript,
 *   2. que no caiga en la pantalla de error ("No pudimos mostrar esta pantalla"),
 *   3. que no haya errores en la consola del navegador,
 *   4. que no se desborde horizontalmente en un teléfono (390 px),
 *   5. accesibilidad con axe-core (contraste, etiquetas, roles...),
 *   y adjunta una captura de pantalla al reporte HTML.
 *
 * Por defecto la API va simulada (listas vacías), así que no necesita Oracle.
 *   - E2E_REAL_API=1  -> usa el servidor real (hay que tenerlo levantado).
 *   - AUDIT_STRICT=1  -> los hallazgos de accesibilidad y desborde hacen fallar
 *                        la prueba (útil en CI). Sin esto solo se reportan.
 */

const STRICT = process.env.AUDIT_STRICT === '1';
const REAL_API = process.env.E2E_REAL_API === '1';

const routesSource = readFileSync(join(__dirname, '..', 'client', 'src', 'app', 'routes.tsx'), 'utf8');
const RUTAS = [...new Set([...routesSource.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]))]
  .filter((p) => p.startsWith('/'))
  .map((p) => p.replace(/:[A-Za-z]+/g, '1'));

// Ruido conocido que no es un defecto de la aplicación.
const IGNORAR_CONSOLA = [/favicon/i, /tile\.openstreetmap\.org/i, /ERR_INTERNET_DISCONNECTED/i, /ERR_NAME_NOT_RESOLVED/i];

const listaVacia = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } };

async function simularApi(page: Page) {
  if (REAL_API) return;
  await page.route('**/api/**', (route) => route.fulfill({ json: listaVacia }));
}

test.describe('Auditoría de pantallas', () => {
  test('el router tiene rutas para auditar', () => {
    expect(RUTAS.length, 'No se encontraron rutas en client/src/app/routes.tsx').toBeGreaterThan(5);
  });

  for (const ruta of RUTAS) {
    test(`pantalla ${ruta}`, async ({ page }, testInfo) => {
      const erroresPagina: string[] = [];
      const erroresConsola: string[] = [];
      page.on('pageerror', (e) => erroresPagina.push(e.message));
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const texto = msg.text();
        if (!IGNORAR_CONSOLA.some((re) => re.test(texto))) erroresConsola.push(texto);
      });

      await simularApi(page);
      await page.goto(ruta, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);

      // 1-2. No debe haber excepciones ni pantalla de error.
      await expect(page.getByText('No pudimos mostrar esta pantalla'), 'La pantalla cayó en el error boundary').toHaveCount(0);
      expect(erroresPagina, `Excepciones de JavaScript en ${ruta}`).toEqual([]);
      await expect(page.locator('body'), 'La pantalla quedó en blanco').not.toBeEmpty();

      // 3. Errores de consola (se informan siempre; fallan solo en modo estricto).
      if (erroresConsola.length) {
        testInfo.annotations.push({ type: 'consola', description: erroresConsola.slice(0, 5).join(' | ') });
        if (STRICT) expect(erroresConsola, `Errores de consola en ${ruta}`).toEqual([]);
      }

      // 5. Accesibilidad (WCAG A/AA) con axe-core.
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const graves = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      if (graves.length) {
        const resumen = graves.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`).join(' | ');
        testInfo.annotations.push({ type: 'accesibilidad', description: resumen });
        await testInfo.attach('axe-violaciones.json', { body: JSON.stringify(graves, null, 2), contentType: 'application/json' });
        if (STRICT) expect(graves, `Problemas de accesibilidad en ${ruta}: ${resumen}`).toEqual([]);
      }

      // 4. Desborde horizontal en teléfono.
      await page.setViewportSize({ width: 390, height: 800 });
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (desborde > 1) {
        testInfo.annotations.push({ type: 'responsive', description: `Desborde horizontal de ${desborde}px en 390px de ancho` });
        if (STRICT) expect(desborde, `Desborde horizontal en ${ruta}`).toBeLessThanOrEqual(1);
      }

      await testInfo.attach('captura.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    });
  }
});
