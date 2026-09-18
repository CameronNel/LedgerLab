#!/usr/bin/env node
/** Run dependency-free domain/API checks using local or globally installed tsc.
 * Does not install packages or claim to verify React, Vinext, Workers or browsers.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const modes = { workspace: 'workspace-check.ts', workday: 'workday-check.ts', review: 'month-review-check.ts', check: 'check.ts', workflows: 'workflow-check.ts', persistence: 'persistence-check.ts', career: 'career-check.ts', desktop: 'desktop-check.ts', workbook: 'workbook-check.ts' };
const selected = process.argv.slice(2);
const names = selected.length ? selected : Object.keys(modes);
if (names.some(name => !modes[name])) throw new Error(`Use ${Object.keys(modes).join(', ')} or no arguments for all suites.`);
const localTsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const tsc = process.env.LEDGERLAB_TSC || (existsSync(localTsc) ? localTsc : 'tsc');
const globalModules = resolve(dirname(process.execPath), '../lib/node_modules');
const typeRoots = [process.env.LEDGERLAB_TYPE_ROOTS, join(root, 'node_modules/@types'),
  join(globalModules, '@types'), join(globalModules, 'ts-node/node_modules/@types')]
  .filter(candidate => candidate && existsSync(join(candidate, 'node/index.d.ts')));
if (!typeRoots.length) throw new Error('Node.js type definitions are required. Install the locked dependencies, or set LEDGERLAB_TYPE_ROOTS to an existing @types directory containing node.');
const out = mkdtempSync(join(tmpdir(), 'ledgerlab-portable-'));
try {
  const config = join(out, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: {
    module: 'commonjs', moduleResolution: 'node', target: 'ES2022', strict: true,
    skipLibCheck: true, esModuleInterop: true, noEmitOnError: true, types: ['node'],
    typeRoots, rootDir: root, outDir: join(out, 'compiled'),
  }, files: names.map(name => join(root, 'scripts/accounting', modes[name])) }, null, 2));
  const version = spawnSync(tsc, ['--version'], { cwd: root, encoding: 'utf8' });
  if (version.error || version.status !== 0) throw new Error(`TypeScript compiler unavailable: ${version.error?.message || version.stderr}`);
  console.log(`Portable verification: ${version.stdout.trim()}; Node ${process.version}.`);
  console.log('Checks domain logic and the production request/session logic; not the React UI or deployment build.');
  const compile = spawnSync(tsc, ['-p', config], { cwd: root, stdio: 'inherit' });
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else for (const name of names) {
    const run = spawnSync(process.execPath, [join(out, 'compiled/scripts/accounting', modes[name].replace(/\.ts$/, '.js'))],
      { cwd: root, stdio: 'inherit' });
    if (run.status !== 0) { process.exitCode = run.status ?? 1; break; }
  }
} finally { rmSync(out, { recursive: true, force: true }); }
