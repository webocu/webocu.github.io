#!/usr/bin/env node
// Fill ipkHash.sha256 and ipkSize of one app in apps.json from its IPK.
//
//   node tools/sync.mjs <id> [--version X.Y.Z] [--file path/to/app.ipk] [--icon]
//
//   --version   bump the app to this version first
//   --file      hash a local IPK instead of downloading the release asset
//               (before the release exists; upload exactly this file afterwards)
//   --icon      also fetch source/icons/icon.png of the release tag
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { APPS_JSON, ROOT, assetOf, download, ipkUrlOf, readConfig, sha256, tagOf } from './lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const id = args.find((a) => !a.startsWith('--') && a !== flag('--version') && a !== flag('--file'));
if (!id) {
  console.error('usage: node tools/sync.mjs <id> [--version X.Y.Z] [--file app.ipk] [--icon]');
  process.exit(2);
}

const cfg = readConfig();
const app = cfg.apps.find((a) => a.id === id);
if (!app) {
  console.error(`error: no app "${id}" in apps.json (known: ${cfg.apps.map((a) => a.id).join(', ')})`);
  process.exit(1);
}

if (flag('--version')) app.version = flag('--version');

let bytes;
const file = flag('--file');
if (file) {
  if (basename(file) !== assetOf(app)) {
    // The release asset must carry exactly this name or ipkUrl would 404.
    console.error(`error: file is named ${basename(file)}, the release asset must be named ${assetOf(app)}`);
    process.exit(1);
  }
  bytes = readFileSync(file);
} else {
  console.log(`downloading ${ipkUrlOf(app)}`);
  bytes = await download(ipkUrlOf(app));
}

app.ipkHash = { sha256: sha256(bytes) };
app.ipkSize = bytes.length;
writeFileSync(APPS_JSON, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(`${app.id} ${app.version}: sha256 ${app.ipkHash.sha256}, ${app.ipkSize} bytes`);

if (args.includes('--icon')) {
  const url = `https://raw.githubusercontent.com/${app.github}/${tagOf(app)}/source/icons/icon.png`;
  writeFileSync(join(ROOT, 'apps', app.id, 'icon.png'), await download(url));
  console.log(`icon updated from ${url}`);
}
console.log('next: make build');
