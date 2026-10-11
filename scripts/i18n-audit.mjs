#!/usr/bin/env node
/**
 * i18n catalog audit.
 *
 * `messages.ts` is the only place where user-visible text may live, and every key is
 * typed — but TypeScript cannot see keys written inside templates (`'x.y' | t`) or in
 * `labelKey=…` attributes. This script closes that gap:
 *
 * - **MISSING**: a key used by the app that `MESSAGES` does not define (a screen would
 *   render the raw key). Exits with code 1 so CI can fail on it.
 * - **UNUSED**: a key defined by `MESSAGES` that nothing references. Informative only:
 *   the panel/admin keys are declared ahead of the phases that will use them.
 *
 * Usage: `node scripts/i18n-audit.mjs [--out <file>]`
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(repoRoot, 'src', 'app');
const messagesPath = join(appRoot, 'core', 'i18n', 'messages.ts');

const outFlag = process.argv.indexOf('--out');
const outFile = outFlag === -1 ? null : process.argv[outFlag + 1];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (['.ts', '.html'].includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

/** `'a.b': '…'` top-level entries of the catalog. */
const defined = new Set(
  [...readFileSync(messagesPath, 'utf8').matchAll(/^\s*'([a-zA-Z][\w.]*)'\s*:/gm)].map((m) => m[1]),
);

/**
 * Keys referenced literally. Any quoted string equal to a defined key counts, in either
 * quote style, which covers the pipe (`t('a.b')`), `*Key="a.b"` attributes on shared
 * primitives and lookup tables such as `ERROR_MESSAGE_KEYS`.
 * Keys assembled at runtime (`'status.' + kind`, `` `status.${kind}` ``) make every entry
 * under that prefix reachable, so the whole prefix is marked as used.
 */
function collectUsage(source, track) {
  for (const match of source.matchAll(/['"]([a-zA-Z][\w.]*)['"]/g)) {
    if (defined.has(match[1])) {
      track(match[1]);
    }
  }
  for (const match of source.matchAll(/['"`]([a-zA-Z][\w.]*)\.(?:\$|\s*\+)/g)) {
    for (const key of defined) {
      if (key.startsWith(`${match[1]}.`)) {
        track(key);
      }
    }
  }
}

/**
 * Keys the app asks for by name. Unlike [`collectUsage`], these are **not** filtered by
 * the catalog: a key that is missing from `MESSAGES` is exactly what we want to catch, so
 * a new screen renders the raw key instead of a translation.
 */
const requestPatterns = [
  /'([a-zA-Z][\w.]*)'\s*\|\s*t\b/g,
  /\.t\(\s*'([^']+)'/g,
  /(?:labelKey|titleKey|bodyKey|hintKey|headingKey|messageKey)\s*[=:]\s*['"]([^'"]+)['"]/g,
];

const used = new Map();
const requested = new Map();
const remember = (map, key, file) => {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  map.get(key).add(file);
};

for (const file of walk(appRoot)) {
  if (file === messagesPath) {
    continue;
  }
  const relativePath = relative(repoRoot, file);
  const source = readFileSync(file, 'utf8');
  collectUsage(source, (key) => remember(used, key, relativePath));
  for (const pattern of requestPatterns) {
    for (const match of source.matchAll(pattern)) {
      remember(requested, match[1], relativePath);
    }
  }
}

const missing = [...requested.keys()].filter((key) => !defined.has(key)).sort();
const unused = [...defined].filter((key) => !used.has(key)).sort();

const lines = [
  `DEFINED: ${defined.size}  REFERENCED: ${used.size}  REQUESTED: ${requested.size}`,
  '',
  `=== MISSING (${missing.length}) ===`,
  ...missing.map((key) => `${key}   <- ${[...requested.get(key)].join(', ')}`),
  '',
  `=== UNUSED (${unused.length}) — declared ahead of the phase that will use them ===`,
  ...unused,
];

const report = lines.join('\n');
if (outFile) {
  writeFileSync(resolve(repoRoot, outFile), report, 'utf8');
}
console.log(report);

if (missing.length > 0) {
  console.error(`\n${missing.length} missing message key(s).`);
  process.exitCode = 1;
}
