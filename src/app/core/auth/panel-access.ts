/**
 * Which panel address a signed-in account may open.
 *
 * A missing or empty module list means the account can open every section
 * (owners and older sessions). A non-empty list is the restriction.
 */

const SECTIONS = [
  { module: 'dashboard', path: '/panel', exact: true },
  { module: 'mesa', path: '/panel/mesa' },
  { module: 'ingreso', path: '/panel/ingreso' },
  { module: 'eventos', path: '/panel/eventos' },
  { module: 'sedes', path: '/panel/sedes' },
  { module: 'cupos', path: '/panel/cupos' },
  { module: 'colaboradores', path: '/panel/colaboradores' },
  { module: 'configuracion', path: '/panel/configuracion' },
] as const;

const HOME_ORDER = SECTIONS.map((section) => section.module);

export function hasPanelModule(
  modules: readonly string[] | null | undefined,
  module: string,
): boolean {
  return !modules || modules.length === 0 || modules.includes(module);
}

/** First section this account can open. Restricted accounts never land on the dashboard. */
export function panelHome(modules: readonly string[] | null | undefined): string {
  if (!modules || modules.length === 0) {
    return '/panel';
  }
  const module = HOME_ORDER.find((candidate) => modules.includes(candidate));
  return SECTIONS.find((section) => section.module === module)?.path ?? '/panel/forbidden';
}

/** True when `url` is a panel path this module list may open. */
export function allowsPanelPath(
  url: string,
  modules: readonly string[] | null | undefined,
): boolean {
  const path = pathOnly(url);
  if (isOpenPanelPath(path)) {
    return true;
  }
  if (!modules || modules.length === 0) {
    return true;
  }
  const section = [...SECTIONS]
    .sort((left, right) => right.path.length - left.path.length)
    .find((candidate) =>
      'exact' in candidate
        ? path === candidate.path
        : path === candidate.path || path.startsWith(`${candidate.path}/`),
    );
  return section ? modules.includes(section.module) : false;
}

/** Remembered return path when it is allowed; otherwise the account's home. */
export function landingPath(
  modules: readonly string[] | null | undefined,
  requested: string,
): string {
  return allowsPanelPath(requested, modules) ? requested : panelHome(modules);
}

function pathOnly(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

function isOpenPanelPath(path: string): boolean {
  return (
    path === '/panel/login' ||
    path.startsWith('/panel/login/') ||
    path === '/panel/signup' ||
    path.startsWith('/panel/signup/') ||
    path === '/panel/forbidden' ||
    path.startsWith('/panel/forbidden/')
  );
}
