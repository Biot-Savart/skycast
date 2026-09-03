# Skycast ⛅ — Interactive Weather Dashboard

A feature-rich, fully interactive weather website in **100% vanilla JavaScript** — no frameworks, no build step, no API keys. Live data comes from the free [Open-Meteo](https://open-meteo.com/) APIs (forecast, geocoding, and air quality).

**▶ Live demo: [biot-savart.github.io/skycast](https://biot-savart.github.io/skycast/)**

## Features

- 🔍 **City search** with live autocomplete, full keyboard navigation (arrows / Enter / Esc, `/` to focus)
- 📍 **Browser geolocation** one-click "use my location"
- 🕐 **Live local clock** for the location's timezone (ticking every second)
- 🌈 **Dynamic animated backgrounds** — rain, snow, drifting clouds, twinkling stars, lightning, and fog rendered on a canvas, themed by weather condition + day/night
- 📊 **Interactive 24-hour chart** — hover-synced with the hour strip, crosshair tooltip (temp, feels like, precip chance, wind), shaded night bands
- 🌧 **15-minute precipitation nowcast** for the next 12 hours with bar chart + summary
- 📅 **16-day forecast** — click any day for its hourly temperature curve and detailed stats (auto-scrolls to details)
- 🧭 **Right-now tiles** — animated wind compass, humidity + computed dew point, UV index, pressure, cloud cover, visibility, precipitation
- ☀️ **Sun arc** with real-time solar position progress, sunrise/sunset, daylight duration
- 🌙 **Moon phase** computed from the synodic cycle (phase name + illumination %)
- 🌬 **Air quality** — European AQI gauge with band scale, US AQI, and 6 pollutant breakdowns (PM2.5, PM10, O₃, NO₂, SO₂, CO)
- ⭐ **Saved places** (localStorage) with quick-load chips + **compare modal** showing several cities side-by-side
- 🔄 **Unit switching** — °C/°F, km/h / mph / m/s, mm/in — all persisted
- 📱 Responsive layout, respects `prefers-reduced-motion`, keyboard friendly, toast notifications, loading skeletons

## Run locally

Any static file server works:

```bash
python -m http.server 8000
# → http://localhost:8000
```

(Opening `index.html` directly from disk won't work because the app uses ES modules, which require an HTTP origin.)

## Deploy on GitHub Pages

This repo ships with a ready [.github/workflows/pages.yml](.github/workflows/pages.yml). Pushing to `main` triggers the official zero-build Pages deploy — the site goes live at `https://<user>.github.io/<repo>/` automatically. This repo is deployed at [biot-savart.github.io/skycast](https://biot-savart.github.io/skycast/).

## Deploy on GitLab Pages

The repo ships with a ready [.gitlab-ci.yml](.gitlab-ci.yml). Just:

1. Create a new GitLab project and push this repo.
2. **Settings → Pages** — the `pages` job publishes automatically on the default branch.
3. Your site appears at `https://<user>.gitlab.io/<project>/`.

No build step, no secrets, no CI variables needed — the app runs entirely client-side with free, keyless APIs.

## Tech choices

| Choice | Why |
|---|---|
| Vanilla ES modules | Zero dependencies, no build chain, trivially hostable |
| Canvas charts (hand-rolled) | Full control of interactions; no chart library payload |
| Canvas particle backgrounds | Lightweight, condition-aware atmosphere |
| localStorage | Persist units, saved places, last location — no backend needed |
| Fetch data in metric, convert client-side | Changing units never triggers a re-fetch |

## Project layout

```
index.html          — markup & sections
css/styles.css      — glassmorphism UI, themes, responsive rules
js/api.js           — Open-Meteo endpoints (forecast / geocode / AQI)
js/wx.js            — weather codes, animated SVG icons, units, moon math
js/state.js         — tiny observable store + persistence
js/chart.js         — LineChart & BarChart with hover tooltips
js/background.js    — particle animation engine
js/views.js         — rendering for every section
js/main.js          — controller: search, geolocation, events, boot
```

## Credits

- Weather, geocoding & air-quality data by [Open-Meteo](https://open-meteo.com/) (CC-BY 4.0) — no API keys required, free for everyone
- Built with **GLM** (`zai-org/GLM-5.3-Flash`) by [Z.ai](https://huggingface.co/zai-org), running locally in [LM Studio](https://lmstudio.ai)
