#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Bundle size audit (Phase 3.1.9).
 *
 * Reports raw + gzipped sizes for each dist artifact.
 * With `--check`, exits non-zero if any artifact exceeds its budget.
 *
 * Run after `pnpm build`:
 *   pnpm size            # report only
 *   pnpm size:check      # report and enforce budgets
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const KB = 1024;

// Production size budgets (gzipped). Generous headroom over current sizes.
const BUDGETS = [
  { file: 'dist/esm/index.js', label: 'ESM', maxGzipKB: 100 },
  { file: 'dist/cjs/index.cjs', label: 'CJS', maxGzipKB: 100 },
  { file: 'dist/umd/wirex-sdk.umd.js', label: 'UMD (min)', maxGzipKB: 50 },
];

const root = path.resolve(__dirname, '..');
const checkMode = process.argv.includes('--check');

let failed = false;
const results = [];

for (const { file, label, maxGzipKB } of BUDGETS) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`ERROR: missing ${file} — run \`pnpm build\` first`);
    process.exit(1);
  }
  const buf = fs.readFileSync(fullPath);
  const raw = buf.length;
  const gz = zlib.gzipSync(buf).length;
  const rawKB = (raw / KB).toFixed(1);
  const gzKB = (gz / KB).toFixed(1);
  const utilPct = ((gz / KB / maxGzipKB) * 100).toFixed(0);

  const exceeded = gz / KB > maxGzipKB;
  const status = exceeded ? 'FAIL' : 'OK';
  if (exceeded) failed = true;

  results.push({ label, file, rawKB, gzKB, maxGzipKB, utilPct, status });
}

const colWidths = {
  label: 10,
  file: 30,
  raw: 10,
  gz: 18,
  budget: 12,
  status: 6,
};

const header = [
  'Format'.padEnd(colWidths.label),
  'File'.padEnd(colWidths.file),
  'Raw'.padStart(colWidths.raw),
  'Gzipped'.padStart(colWidths.gz),
  'Budget'.padStart(colWidths.budget),
  'Status'.padStart(colWidths.status),
].join(' │ ');

console.log('');
console.log(header);
console.log('─'.repeat(header.length));

for (const r of results) {
  const row = [
    r.label.padEnd(colWidths.label),
    r.file.padEnd(colWidths.file),
    `${r.rawKB} KB`.padStart(colWidths.raw),
    `${r.gzKB} KB (${r.utilPct}%)`.padStart(colWidths.gz),
    `${r.maxGzipKB} KB`.padStart(colWidths.budget),
    r.status.padStart(colWidths.status),
  ].join(' │ ');
  console.log(row);
}
console.log('');

if (checkMode && failed) {
  console.error('Bundle size budget exceeded.');
  process.exit(1);
}

process.exit(0);
