#!/usr/bin/env node
// Online checks.
//
//   node tools/verify.mjs          every ipkUrl still serves the file apps.json describes
//   node tools/verify.mjs --live   additionally: the published site matches repo.json, and
//                                  every iconUri / fullDescriptionUrl answers
//
// A replaced or deleted release asset makes the hash check fail on the TV, so
// this is what CI runs on a schedule.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, download, ipkUrlOf, packageOf, readConfig, sha256, siteOf } from './lib.mjs';

const live = process.argv.includes('--live');
const cfg = readConfig();
let failed = 0;
const report = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failed += 1;
};

for (const app of cfg.apps) {
  const url = ipkUrlOf(app);
  try {
    const bytes = await download(url);
    report(sha256(bytes) === app.ipkHash.sha256, `${app.id} sha256 of ${url}`);
    report(bytes.length === app.ipkSize, `${app.id} size ${bytes.length} (catalog: ${app.ipkSize})`);
  } catch (e) {
    report(false, `${app.id}: ${e.message}`);
  }
}

if (live) {
  const local = readFileSync(join(ROOT, 'repo.json'), 'utf8');
  for (const path of ['/', '/repo.json']) {
    try {
      const body = (await download(`${siteOf(cfg)}${path}`)).toString('utf8');
      report(body === local, `${siteOf(cfg)}${path} matches repo.json`);
    } catch (e) {
      report(false, e.message);
    }
  }
  for (const app of cfg.apps) {
    const pkg = packageOf(cfg, app);
    for (const url of [pkg.iconUri, pkg.fullDescriptionUrl]) {
      try {
        await download(url);
        report(true, url);
      } catch (e) {
        report(false, e.message);
      }
    }
  }
}

process.exit(failed ? 1 : 0);
