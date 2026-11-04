/* eslint-disable n/no-process-exit, n/no-sync -- CLI build script */
// ATV fork: verify custom/theme/_colors.scss still defines every variable upstream's
// _colors.scss defines. Run after every upstream sync; a new upstream color would
// otherwise break the Sass build (or silently go unthemed).
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const UPSTREAM_PATH = 'server/styles/scss/shared/_colors.scss';
const vars = (scss) => new Set([...scss.matchAll(/^\s*\$([\w-]+)\s*:/gm)].map((m) => m[1]));

let upstream;
try {
	upstream = execFileSync('git', ['show', `upstream/main:${UPSTREAM_PATH}`]).toString();
} catch {
	console.error('✗ could not read upstream/main (run: git fetch upstream main)');
	process.exit(1);
}

const ours = vars(await readFile('custom/theme/_colors.scss', 'utf8'));
const missing = [...vars(upstream)].filter((v) => !ours.has(v));

if (missing.length) {
	console.error(`✗ theme is missing upstream color variables: ${missing.map((v) => `$${v}`).join(', ')}`);
	console.error('  add them to custom/theme/_colors.scss');
	process.exit(1);
}

console.log(`✓ theme defines all ${vars(upstream).size} upstream color variables`);
