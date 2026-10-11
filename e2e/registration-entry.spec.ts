import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { MESSAGES } from '../src/app/core/i18n/messages';

/**
 * The shareable entry point (`/inscripcion`).
 *
 * A link pasted into WhatsApp is opened by someone who never saw the catalogue, so these
 * specs drive the gate exactly like that reader: the API is stubbed, nothing is visited
 * before, and the only thing on screen is the URL that was shared.
 *
 * The stubs cover the session probe as well: this app reads a `401` from `/auth/me` as a
 * dead session and sends the reader to the panel login, so a run that answered only the
 * catalogue would let the gate be replaced mid-assertion by an unrelated screen.
 */

interface SedeFixture {
  readonly id: string;
  readonly name: string;
  readonly open?: boolean;
  readonly titulares?: number;
}

interface EventFixture {
  readonly slug: string;
  readonly name: string;
  readonly sedes: readonly SedeFixture[];
}

const EVENT: EventFixture = {
  slug: 'taller-halloween',
  name: 'Taller de Halloween',
  sedes: [
    { id: 'sede-norte', name: 'Sede Norte' },
    { id: 'sede-sur', name: 'Sede Sur' },
  ],
};

/** One event, one open sede: the only shape where the gate may answer without asking. */
const SINGLE: EventFixture = {
  slug: 'taller-halloween',
  name: 'Taller de Halloween',
  sedes: [{ id: 'sede-norte', name: 'Sede Norte' }],
};

function publicEvent(fixture: EventFixture): Record<string, unknown> {
  return {
    id: fixture.slug,
    slug: fixture.slug,
    name: fixture.name,
    description: null,
    timezone: 'America/Bogota',
    startsAt: '2026-10-31T15:00:00.000Z',
    endsAt: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    participations: fixture.sedes.map((sede) => ({
      id: sede.id,
      establishment: { id: `${sede.id}-id`, name: sede.name, city: 'Bogotá' },
      availableTitulares: sede.titulares ?? 4,
      availableCompanions: 0,
      registrationOpensAt: null,
      registrationClosesAt: null,
      registrationOpen: sede.open ?? true,
    })),
  };
}

/** Serves both public reads the gate and the form use: the list and the single event. */
async function stubCatalog(page: Page, fixture: EventFixture): Promise<void> {
  await page.route('**/api/v1/public/events**', (route: Route) => {
    const isDetail = /\/public\/events\/[^/]+$/.test(new URL(route.request().url()).pathname);
    const data = publicEvent(fixture);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        isDetail
          ? { success: true, data }
          : { success: true, data: [data], meta: { total: 1, limit: 50, offset: 0 } },
      ),
    });
  });
}

/** Answers every public read with an envelope error, the way a stale link would. */
async function stubMissingEvent(page: Page): Promise<void> {
  await page.route('**/api/v1/public/events**', (route: Route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'No existe' },
      }),
    }),
  );
}

/**
 * Keeps the visitor anonymous. Aborting `/auth/me` produces a network error, which lands on
 * the same anonymous state as a real `401` (`SessionStore.load()` clears on any error). The
 * `401` case is pinned by its own test below — either way the page stays put.
 */
async function stubAnonymousSession(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', (route: Route) => route.abort());
}

/**
 * The real answer of a live backend to an anonymous `/auth/me` probe: `401`. A public visitor
 * must never be bounced to the operator panel because of it.
 */
async function stubAnonymous401(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', (route: Route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'No autenticado' },
      }),
    }),
  );
}

test.describe('entrada pública de inscripción', () => {
  test('el enlace sin parámetros entrega el formulario cuando hay una sola sede', async ({
    page,
  }) => {
    await stubAnonymousSession(page);
    await stubCatalog(page, SINGLE);

    await page.goto('/inscripcion');

    // The gate resolves and hands over to the canonical form, which is what the event
    // detail links to as well: one address for the alta, two ways of reaching it. The sede
    // travels in the navigation state, so the address stays clean.
    await expect(page).toHaveURL(/\/eventos\/taller-halloween\/inscripcion$/);
    await expect(
      page.getByRole('heading', { level: 1, name: MESSAGES['register.title'] }),
    ).toBeVisible();
  });

  test('pregunta en qué sede inscribirse cuando hay varias abiertas', async ({ page }) => {
    await stubAnonymousSession(page);
    await stubCatalog(page, EVENT);

    await page.goto('/inscripcion');

    await expect(
      page.getByRole('heading', { level: 1, name: MESSAGES['register.entry.title'] }),
    ).toBeVisible();
    await expect(page.getByText('Sede Norte')).toBeVisible();

    const cta = page.getByRole('link', { name: MESSAGES['event.venue.register'] }).first();
    await expect(cta).toHaveAttribute('href', '/eventos/taller-halloween/inscripcion');

    await cta.click();

    await expect(page).toHaveURL(/\/eventos\/taller-halloween\/inscripcion$/);
    await expect(page.locator('.choice-card[data-selected="true"]')).toContainText('Sede Norte');
    await expect(
      page.getByRole('heading', { level: 1, name: MESSAGES['register.title'] }),
    ).toBeVisible();
  });

  test('el enlace con evento y sede abre directamente esa sede', async ({ page }) => {
    await stubAnonymousSession(page);
    await stubCatalog(page, EVENT);

    await page.goto('/inscripcion?evento=taller-halloween&sede=sede-sur');

    await expect(page).toHaveURL(/\/eventos\/taller-halloween\/inscripcion$/);
    await expect(page.locator('.choice-card[data-selected="true"]')).toContainText('Sede Sur');
  });

  test('explica una sede cerrada en lugar de rebotar', async ({ page }) => {
    await stubAnonymousSession(page);
    await stubCatalog(page, {
      slug: 'taller-halloween',
      name: 'Taller de Halloween',
      sedes: [{ id: 'sede-norte', name: 'Sede Norte', open: false }],
    });

    await page.goto('/inscripcion?evento=taller-halloween');

    await expect(page.getByText(MESSAGES['register.entry.none'])).toBeVisible();
    await expect(page.getByText(MESSAGES['event.venue.closedParticipation'])).toBeVisible();
    // No dead CTA: a closed sede offers an explanation, not a button.
    await expect(page.getByRole('link', { name: MESSAGES['event.venue.register'] })).toHaveCount(0);
  });

  test('un evento que ya no existe cae en el estado de no encontrado', async ({ page }) => {
    await stubAnonymousSession(page);
    await stubMissingEvent(page);

    await page.goto('/inscripcion?evento=evento-viejo');

    await expect(page.getByText(MESSAGES['app.notFound.title'])).toBeVisible();
    await expect(page.getByRole('link', { name: MESSAGES['register.entry.browse'] })).toBeVisible();
  });

  test('una recarga con sesión anónima nunca muestra el panel interno', async ({ page }) => {
    await stubAnonymous401(page);
    await stubCatalog(page, SINGLE);

    await page.goto('/eventos/taller-halloween/inscripcion');
    await expect(
      page.getByRole('heading', { level: 1, name: MESSAGES['register.title'] }),
    ).toBeVisible();

    await page.reload();

    // A `401` on the anonymous probe is "no session", not "a session that died": the reader
    // stays on the form and never learns the panel exists.
    await expect(page).toHaveURL(/\/eventos\/taller-halloween\/inscripcion$/);
    await expect(
      page.getByRole('heading', { level: 1, name: MESSAGES['register.title'] }),
    ).toBeVisible();
  });

  test('cabe en pantalla de móvil y no tiene violaciones graves de accesibilidad', async ({
    page,
  }) => {
    await stubAnonymousSession(page);
    await stubCatalog(page, EVENT);

    await page.goto('/inscripcion');
    await expect(page.getByText('Sede Sur')).toBeVisible();

    // A link that arrives from a phone must not force a horizontal scroll.
    const { width, scrollWidth } = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(width + 1);

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
