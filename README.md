# Random

A mobile-first, offline-capable random generator PWA: number, list/name picker, dice, coin, cast lots. Vanilla HTML/CSS/JS, no dependencies, no build step on the host.

## Run locally

```sh
python3 -m http.server 8000   # open http://localhost:8000
```

Ads are always off on localhost.

## Configure & build

All ids/URLs live in `js/config.js` (`SITE_URL`, `ADSENSE_CLIENT`, `ADSENSE_SLOT`, `TIP_URL`). Empty = feature off.
After editing it, or anything in `tools/page-template.html` / `tools/pages-data.mjs`, regenerate and commit the output:

```sh
node tools/build-pages.mjs    # landing pages, index.html, sitemap/robots/ads.txt, SW cache hash
node tools/make-icons.mjs     # only if the icon changes
node tools/make-og.mjs        # only if the share image changes
node tests/rng.test.mjs && node tests/site.test.mjs
```

`index.html` and the `*/index.html` landing pages are **generated** — edit the template, not the output.

## Deploy

Static hosting, publish the repo root as-is (no build command). See `docs/SPEC-v2.md` §8 for the full launch checklist. Short version:

1. Cloudflare Pages (or GitHub Pages if you skip ads) + your own domain (needed for AdSense).
2. Set `SITE_URL`, rebuild, push.
3. Visit `<site>/?noads=1` once on your own devices (installed iOS app: tap the version in Settings 5×).
4. Google Search Console → submit `sitemap.xml`; import into Bing Webmaster Tools.
5. AdSense: set `ADSENSE_CLIENT`, rebuild, request review; after approval create a fixed 320×50 unit → `ADSENSE_SLOT`, turn Auto ads off, publish the GDPR message.
6. Tip jar: set `TIP_URL` (Ko-fi / Buy Me a Coffee), rebuild.

## Development workflow

Subagents in `.claude/agents/`: `orchestrator` (Opus) → `architect` (Opus, writes `docs/SPEC*.md`) → `implementer` (Sonnet) → `reviewer` (Opus). Run `claude --agent orchestrator` for new features.
