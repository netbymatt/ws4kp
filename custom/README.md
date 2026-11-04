# ATV fork of WeatherStar 4000+

This is a scoped fork of [netbymatt/ws4kp](https://github.com/netbymatt/ws4kp). All ATV customization lives in `custom/`. Upstream files are touched only at the small set of points listed below, so merging new upstream releases stays painless.

## Branches and remotes

| | |
|---|---|
| `upstream` remote | `https://github.com/netbymatt/ws4kp` (read-only) |
| `origin` remote | the ATV fork on GitHub |
| `main` | mirror of `upstream/main`; never commit here |
| `atv/main` | the deployable ATV branch |

## Layout

```
custom/
  region.config.mjs        geography: communities, station mode, bounds  <- edit this
  theme/_colors.scss       brand palette + mapping onto upstream color variables  <- and this
  theme/_overrides.scss    brand fixes for colors upstream hard-codes elsewhere
  data/points-cache.json   NWS grid points per community (generated, committed)
  scripts/build-data.mjs   region.config -> datagenerators/output/*.json
  scripts/check-theme.mjs  fails if upstream adds a color variable we don't define
  scripts/sync-upstream.sh merge upstream + rebuild everything
  .env.example             default location/displays (copy to ../.env)
```

## Where the fork touches upstream files

| File | Change | Why |
|---|---|---|
| `server/styles/scss/shared/_colors.scss` | replaced with one `@forward` line | theme lives in `custom/theme` |
| `server/styles/scss/ws.scss` | +1 `@use` line at the end | loads `custom/theme/_overrides.scss` |
| `.gitattributes` | +6 lines | generated files use `merge=ours` |
| `datagenerators/output/*.json` | regenerated | Arkansas data |
| `server/styles/ws.min.css` | regenerated | compiled theme |

Keep this table up to date when adding a new touch point.

## Everyday commands

```bash
node custom/scripts/build-data.mjs     # after editing region.config.mjs (needs api.weather.gov for new cities)
npm run build:css                      # after editing custom/theme/*
npm start                              # dev server on http://localhost:8080
npm run build                          # static build in dist/ (Docker builds do this too)
custom/scripts/sync-upstream.sh        # pull in a new upstream release
```

## Geography

`region.config.mjs` lists 7 communities covering Arkansas's corners and its north/south regions: Fayetteville (NW), Jonesboro (NE), Fort Smith (W), Little Rock (central), Pine Bluff (SE), Texarkana (SW) and El Dorado (S).

- **Travel Forecast** shows exactly these communities. Each one needs an NWS grid point in `data/points-cache.json`.
- **Regional map** places these communities around the viewer's location. The map window covers about 11° of longitude, so central Arkansas shows the whole state.
- **Latest Observations** and current-conditions names use `stations.json`. With `stationsMode: 'communities'`, only the 7 community stations ship, labeled with the community names. Switch to `'region'` to include every station inside `bounds`. This fills the map more densely but shows non-ATV places.
- **Location search** still accepts any US address. To pin the display to one place, set `WSQS_latLon`/`WSQS_latLonQuery` (and optionally `WSQS_kiosk=true`) in `.env`.

## Theme

`theme/_colors.scss` defines the brand palette as `$atv-*` variables and maps them onto upstream's 16 semantic variables (`$title-color`, `$column-header`, ...). Change a mapping there; don't edit upstream SCSS.

The CRT frame and panel artwork are PNGs in `server/images/backgrounds/`. They are still upstream's blue and orange, so they won't match the green theme until the backgrounds are redone (planned step 4). Fonts are planned step 5.
