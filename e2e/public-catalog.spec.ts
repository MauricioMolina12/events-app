import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { MESSAGES } from '../src/app/core/i18n/messages';

/**
 * Smoke + accessibility pass over the public shell.
 *
 * These specs deliberately avoid depending on API data: the catalogue renders an error
 * or empty state without a backend, and that state is exactly what a visitor with a dead
 * connection sees, so it must stay accessible and branded.
 */
test.describe('shell público', () => {
  test('la raíz redirige al catálogo y el shell se renderiza', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/eventos$/);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      MESSAGES['catalog.hero.title'],
    );
    await expect(page.getByRole('contentinfo')).toContainText(MESSAGES['app.supportCodeHint']);
  });

  test('el enlace de salto es alcanzable con teclado y enfoca el contenido', async ({ page }) => {
    await page.goto('/eventos');

    // First tab stop in the document: it stays off-screen until focused.
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: MESSAGES['app.skipToContent'] });
    await expect(skipLink).toBeVisible();

    await skipLink.click();
    await expect(page.locator('#contenido')).toBeFocused();
  });

  test('el shell público no expone el panel ni pestañas de navegación', async ({ page }) => {
    await page.goto('/eventos');

    const banner = page.getByRole('banner');
    await expect(banner).toBeVisible();
    // No entry point to the operator panel: that surface is internal. `exact` keeps the
    // brand ("Eventos Barby Toys & Cupidos") from matching the "Eventos" tab name.
    await expect(
      banner.getByRole('link', { name: MESSAGES['role.operator'], exact: true }),
    ).toHaveCount(0);
    await expect(
      banner.getByRole('link', { name: MESSAGES['nav.public.events'], exact: true }),
    ).toHaveCount(0);
  });

  test('el interruptor de tema alterna entre claro y oscuro', async ({ page }) => {
    await page.goto('/eventos');

    const theme = page.getByRole('radiogroup', { name: MESSAGES['ui.theme.label'] });
    await expect(theme).toBeVisible();

    await theme.getByRole('radio', { name: MESSAGES['app.theme.dark'] }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await theme.getByRole('radio', { name: MESSAGES['app.theme.light'] }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  for (const ruta of ['/eventos', '/ruta-que-no-existe']) {
    test(`sin violaciones graves de accesibilidad en ${ruta}`, async ({ page }) => {
      await page.goto(ruta);

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
});

test.describe('PWA', () => {
  test('sirve el manifest con nombre e iconos', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');

    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as {
      name: string;
      start_url: string;
      icons: { src: string; sizes: string }[];
    };
    expect(manifest.name).toBe(MESSAGES['app.name']);
    expect(manifest.start_url).toBe('/eventos');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('sirve cada icono declarado en el manifest', async ({ page, request }) => {
    await page.goto('/eventos');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const manifest = (await (await request.get(href as string)).json()) as {
      icons: { src: string }[];
    };
    for (const icon of manifest.icons) {
      const response = await request.get(icon.src);
      expect(response.ok(), icon.src).toBe(true);
      expect(response.headers()['content-type'], icon.src).toContain('image/png');
    }
  });
});
