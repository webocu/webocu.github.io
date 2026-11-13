# webocu.github.io

An app catalog for the [webOS Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel)
with the WebOCU apps for webOS TV:

| App | Id | Source |
| --- | --- | --- |
| WebOCU Dock: an overlay app launcher | `webocu.dock` | [webocu/webocu-dock](https://github.com/webocu/webocu-dock) |
| WebOCU Settings: an overlay settings panel | `webocu.settings` | [webocu/webocu-settings](https://github.com/webocu/webocu-settings) |

## Add it to the Homebrew Channel

The Homebrew Channel needs a TV rooted with [webosbrew](https://www.webosbrew.org/).

1. Open the Homebrew Channel, then **Settings → Add repository**.
2. Enter `https://webocu.github.io/`
3. Both apps appear in the list; open one and press **Install**.

The address answers with the catalog itself (JSON), so the short form above works. The same
document is also served as `https://webocu.github.io/repo.json`.

From a computer, the repository can be added to a TV that has the Homebrew Channel with:

```sh
ares-launch --device <tv> org.webosbrew.hbchannel -p '{"launchMode":"addRepository","url":"https://webocu.github.io/"}'
```

A TV with only Developer Mode has no Homebrew Channel: install the `.ipk` from the **Releases** page of
each app with `ares-install` instead.

## How it works

- The packages are **not** stored here. `ipkUrl` points at the `.ipk` in the GitHub Releases of each app
  and the catalog carries its `sha256` and size; the TV refuses a file that does not match.
- [`apps.json`](apps.json) is the single source of truth. `make build` turns it into `repo.json` and
  `index.html`, which are byte-for-byte the same document. The Homebrew Channel fetches the address it is
  given as is, and it has no pagination: the whole catalog is one document.
- `apps/<id>/` holds the icon (80×80) and `description.html`, an HTML **fragment** (the Homebrew Channel
  pastes it into its panel, so no `<html>` or `<body>`).
- Because `/` is the catalog, there is no web page here; this README is the human-facing page.

## Publishing a new version

Needs Node 20 or newer, nothing else.

1. In the app repository: build, then publish a GitHub release `v<version>` with the file
   `<id>_<version>_all.ipk` attached. Never replace an asset after it is published; release a new version.
2. Here: `make sync APP=<id> VERSION=<version>`. It downloads the asset and writes its `sha256` and size
   into `apps.json`. Add `ICON=1` to refresh the icon from the tag.
3. `make build`, then `make check` and `make verify`.
4. Commit and push. GitHub Pages publishes `main`; `make verify LIVE=1` checks the published site.

Before the release exists (the first time), hash the local file instead:
`make sync APP=<id> FILE=path/to/<id>_<version>_all.ipk`, and upload exactly that file.

To add an app: add an entry to `apps.json`, then `apps/<id>/icon.png` and `apps/<id>/description.html`.

| Target | What it does |
| --- | --- |
| `make check` | validate `apps.json`; fail if `repo.json` / `index.html` are out of date |
| `make build` | regenerate `repo.json` and `index.html` |
| `make sync` | fill `sha256` and size of an app from its release |
| `make verify` | every `ipkUrl` still serves the file the catalog describes |

CI runs `check` and `verify` on every push and pull request, and `verify` once a week, so a replaced or
deleted release asset is noticed before a TV trips over it.

## License

[MIT](LICENSE)
