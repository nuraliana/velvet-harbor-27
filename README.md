# Vice Line — GTA 6-style Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/nuraliana/velvet-harbor-27/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/nuraliana/velvet-harbor-27/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn your photos and a caption into a GTA 6-style multi-panel poster — the
Vice City sunset / neon look, bold gradient title, cast tags, press quote and
billing block — and export it as a PNG to share.

Runs **entirely offline** in a desktop browser from its own static files.
Your photos never leave your machine: no uploads, no accounts, no watermark.

## Use it

Serve the `app/` folder any static way (or just open it), e.g.:

```sh
node serve.ts        # then open http://localhost:8080
```

1. **Photos** — click a panel slot, then add a photo (file picker, drag it
   straight onto a panel on the cover, or paste with Ctrl+V). Scroll on a
   panel to zoom it, drag it to move it.
2. **Crop** — zoom / pan sliders, Fit vs Fill, Flip, and Smart crop (biases
   portrait photos toward the top third, where faces are). Arrow keys nudge
   the selected photo. "One photo, all panels" and "Shuffle panels" included.
3. **Words** — title, script subtitle, tagline ribbon, press quote, volume
   ticket, billing line, and a cast label per panel (they feed the billing
   block's STARRING line automatically).
4. **Grade & finish** — Vice City Sunset, Neon Nights, Golden Hour, Noir
   Pink, or Original, with a strength slider; slanted panels on/off; gold /
   white / black frames.
5. **Export PNG** — 1080×1350 (4:5 post), 1080×1080 (square), or 1080×1920
   (story), one click each.

No photo yet? **Load demo cover** builds a full poster from six procedural
scenes drawn in code (sunset boulevard, pier, neon alley, skyline, beach,
sports car) — zero external assets.

## Files

- `app/index.html`, `app/style.css` — page + studio UI
- `app/src/cover.js` — the poster renderer (same code draws preview + export)
- `app/src/main.js` — editor wiring: slots, drag/drop, crop, export
- `app/src/samples.js` — procedural demo photos, drawn from scratch
- `app/src/shots.js` + `shots.json` — fixed screenshot scenes (`?shot=…`)
- `main.ts`, `serve.ts`, `vendor/` — make.fun kit plumbing

## License

MIT — see `LICENSE`.
