#!/usr/bin/env node
// apps.json -> repo.json + index.html (the Homebrew Channel catalog).
//
//   node tools/build.mjs           write repo.json and index.html
//   node tools/build.mjs --check   validate only; fail if the files on disk are out of date
//
// index.html is a byte-for-byte copy of repo.json: Homebrew Channel fetches the
// URL it was given as is, so the bare https://webocu.github.io/ has to answer
// with JSON. repo.json is the same document under a name that is served as
// application/json.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readConfig, render, validate } from './lib.mjs';

const check = process.argv.includes('--check');
const cfg = readConfig();

const errors = validate(cfg);
if (errors.length) {
  console.error(errors.map((e) => `error: ${e}`).join('\n'));
  process.exit(1);
}

const out = render(cfg);
const targets = ['repo.json', 'index.html'].map((name) => join(ROOT, name));

if (check) {
  const stale = targets.filter((file) => {
    try {
      return readFileSync(file, 'utf8') !== out;
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`error: out of date: ${stale.map((f) => f.slice(ROOT.length + 1)).join(', ')} (run: make build)`);
    process.exit(1);
  }
  console.log(`ok: ${cfg.apps.length} apps, repo.json and index.html are up to date`);
} else {
  for (const file of targets) writeFileSync(file, out);
  console.log(`wrote repo.json and index.html (${cfg.apps.length} apps)`);
}
