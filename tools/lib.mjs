// Shared helpers for the catalog tools: config loading, validation, and the
// derivation of release URLs. No dependencies; Node >= 20.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const APPS_JSON = join(ROOT, 'apps.json');

export const readConfig = () => JSON.parse(readFileSync(APPS_JSON, 'utf8'));

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export const siteOf = (cfg) => cfg.site.replace(/\/+$/, '');

// Convention shared with the app repositories: tag v<version>, asset <id>_<version>_all.ipk.
export const tagOf = (app) => app.tag ?? `v${app.version}`;
export const assetOf = (app) => app.asset ?? `${app.id}_${app.version}_all.ipk`;
export const ipkUrlOf = (app) =>
  `https://github.com/${app.github}/releases/download/${tagOf(app)}/${assetOf(app)}`;
export const iconUrlOf = (cfg, app) => `${siteOf(cfg)}/apps/${app.id}/icon.png`;
export const descriptionUrlOf = (cfg, app) => `${siteOf(cfg)}/apps/${app.id}/description.html`;

// The src of every <img> in a description fragment.
export const imagesOf = (html) => [...html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);

export function validate(cfg) {
  const errors = [];
  const err = (msg) => errors.push(msg);

  if (typeof cfg.site !== 'string' || !/^https:\/\/[^/\s]+\/?$/.test(cfg.site)) {
    err('site must be an https origin such as https://webocu.github.io');
  }
  if (!Array.isArray(cfg.apps) || cfg.apps.length === 0) {
    err('apps must be a non-empty array');
    return errors;
  }

  const seen = new Set();
  for (const app of cfg.apps) {
    const at = `[${app.id ?? '?'}]`;
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(app.id ?? '')) err(`${at} id must be lower-case reverse-DNS-like`);
    if (seen.has(app.id)) err(`${at} duplicate id`);
    seen.add(app.id);

    for (const key of ['title', 'shortDescription', 'appDescription']) {
      if (typeof app[key] !== 'string' || !app[key].trim()) err(`${at} ${key} is required`);
    }
    if (!/^[\w.-]+\/[\w.-]+$/.test(app.github ?? '')) err(`${at} github must be owner/repo`);
    if (!/^\d+\.\d+\.\d+$/.test(app.version ?? '')) err(`${at} version must be MAJOR.MINOR.PATCH`);
    if (!['web', 'native', 'service'].includes(app.type)) err(`${at} type must be web, native or service`);
    if (![true, false, 'optional'].includes(app.rootRequired)) {
      err(`${at} rootRequired must be true, false or "optional"`);
    }
    if (!/^[0-9a-f]{64}$/.test(app.ipkHash?.sha256 ?? '')) {
      err(`${at} ipkHash.sha256 must be 64 hex chars (run: make sync APP=${app.id})`);
    }
    if (!Number.isInteger(app.ipkSize) || app.ipkSize <= 0) {
      err(`${at} ipkSize must be a positive integer (run: make sync APP=${app.id})`);
    }

    const icon = join(ROOT, 'apps', app.id ?? '', 'icon.png');
    if (!existsSync(icon)) err(`${at} missing apps/${app.id}/icon.png`);
    const desc = join(ROOT, 'apps', app.id ?? '', 'description.html');
    if (!existsSync(desc)) {
      err(`${at} missing apps/${app.id}/description.html`);
    } else {
      const html = readFileSync(desc, 'utf8');
      if (/<\s*(html|head|body)\b/i.test(html)) {
        // Homebrew Channel pastes the file into its panel: it must be a fragment.
        err(`${at} description.html must be an HTML fragment, not a full page`);
      }
      // The panel resolves a relative address against its own page, so a picture has to be
      // written with the full address; one on this site has to exist in this repository.
      for (const src of imagesOf(html)) {
        if (!/^https:\/\//.test(src)) {
          err(`${at} description.html: image "${src}" must be an absolute https address`);
        } else if (src.startsWith(`${siteOf(cfg)}/`) && !existsSync(join(ROOT, src.slice(siteOf(cfg).length + 1)))) {
          err(`${at} description.html: ${src} is not in this repository`);
        }
      }
    }
  }
  return errors;
}

export function packageOf(cfg, app) {
  const iconUri = iconUrlOf(cfg, app);
  return {
    id: app.id,
    title: app.title,
    iconUri,
    manifest: {
      id: app.id,
      version: app.version,
      type: app.type,
      title: app.title,
      appDescription: app.appDescription,
      iconUri,
      sourceUrl: `https://github.com/${app.github}`,
      rootRequired: app.rootRequired,
      ipkUrl: ipkUrlOf(app),
      ipkHash: { sha256: app.ipkHash.sha256 },
      ipkSize: app.ipkSize,
    },
    ...(app.requirements ? { requirements: app.requirements } : {}),
    shortDescription: app.shortDescription,
    fullDescriptionUrl: descriptionUrlOf(cfg, app),
  };
}

// Homebrew Channel does not paginate: the whole catalog is one page.
export function render(cfg) {
  const packages = cfg.apps.map((app) => packageOf(cfg, app));
  const doc = {
    paging: { page: 1, count: packages.length, maxPage: 1, itemsTotal: packages.length },
    packages,
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export async function download(url) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
