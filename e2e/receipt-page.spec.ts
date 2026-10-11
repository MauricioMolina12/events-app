import { expect, test } from '@playwright/test';
import { MESSAGES } from '../src/app/core/i18n/messages';

const REGISTRATION_ID = 'ff6cf74d-b63c-4717-ba27-7ace50281698';

test('consulta y muestra el comprobante devuelto por el endpoint público', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => route.abort());

  const lookup = page.waitForRequest((request) =>
    new URL(request.url()).pathname.endsWith(`/public/registrations/${REGISTRATION_ID}`),
  );
  await page.route('**/public/registrations/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!pathname.endsWith(`/public/registrations/${REGISTRATION_ID}`)) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: REGISTRATION_ID,
          participationId: 'participation-1',
          documentType: 'CC',
          documentNumber: '123456789',
          fullName: 'Maria Perez',
          companionsCount: 1,
          status: 'confirmed',
          registeredAt: '2026-10-04T15:00:00.000Z',
        },
      }),
    });
  });

  await page.goto(`/inscripcion/${REGISTRATION_ID}`);
  await lookup;

  await expect(
    page.getByRole('heading', { level: 1, name: '¡Listo, Maria Perez!' }),
  ).toBeVisible();
  await expect(page.getByText(REGISTRATION_ID, { exact: true })).toBeVisible();
  await expect(page.getByText('Maria Perez', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: MESSAGES['register.receipt.qr'] })).toBeVisible();
  await expect(page.getByText(MESSAGES['register.receipt.qr'], { exact: true })).toBeVisible();
  await expect(
    page.getByText(MESSAGES['register.companions.count'].replace('{count}', '1')),
  ).toBeVisible();
});
