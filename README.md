# EventsF

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.1.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

Unit tests run with [Vitest](https://vitest.dev/) through the Angular CLI (`jsdom`, no
browser needed). The app is **zoneless**, so a `TestBed` must opt in with
`provideZonelessChangeDetection()`:

```bash
npm test            # ng test — watches in a TTY, single run otherwise
npm test -- --watch=false
```

## Running end-to-end tests

The e2e suite uses [Playwright](https://playwright.dev/) (`e2e/`, config in
`playwright.config.ts`). Browsers are not downloaded by `npm install`:

```bash
npx playwright install chromium   # once
npm run e2e                       # ng serve is started automatically (proxy.conf.json → events-api)
```

`e2e/public-catalog.spec.ts` covers the public shell, the keyboard skip-link, an
[axe](https://github.com/dequelabs/axe-core) accessibility pass and the PWA manifest/icons.

## Quality gates

```bash
npm run lint      # ESLint flat config (angular-eslint): TS + templates, incl. WCAG rules
npm run verify    # i18n audit → lint → unit tests → production build
```

Linting is not type-aware (no `projectService`), so it is fast enough for a pre-commit hook.

## i18n

Every user-visible string lives in `src/app/core/i18n/messages.ts` behind a typed key, so a
typo breaks the build. Keys used only inside templates (`{{ 'x.y' | t }}`) escape the type
checker, which is what the audit script closes:

```bash
npm run i18n:audit                           # missing keys fail the command; unused ones are listed
npm run i18n:audit -- --out i18n-audit.txt   # write the report to a file instead
```

Architecture decisions are recorded in [docs/adr](./docs/adr).

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
