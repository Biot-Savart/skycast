/* Render layer: turns store state into DOM. Owns the chart instances and hover sync. */

import * as wx from './wx.js';
import { LineChart, BarChart } from './chart.js';

const $ = (id) => document.getElementById(id);

/* ---------- helpers ---------- */
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function idxOfNow(times, nowISO) {
  for (let i = 0; i < times.length; i++) if (times[i] >= nowISO) return i;
  return times.length - 1;
}

/* ---------- module chart instances (lazy) ---------- */
let hourlyChart, nowcastChart, dayChart;

function ensureCharts() {
  if (!hourlyChart) {
    hourlyChart = new LineChart($('hourly-chart'), {
      onHover: (i) => hourlyHover(i),
    });
  }
  if (!nowcastChart) {
    nowcastChart = new BarChart($('nowcast-chart'), {
      onHover: (i) => nowcastHover(i),
    });
  }
  if (!dayChart) {
    dayChart = new LineChart($('day-chart'), {
      onHover: () => {},
      showDots: true,
    });
  }
}

/* ============================================================
   HERO
============================================================ */
export function renderHero(state) {
  const { weather, units } = state;
  if (!weather) return;
  const c = weather.current;
  const { desc } = wx.describeCode(c.weather_code);
  $('hero-body').hidden = false;

  $('loc-name').textContent = state.location.name;
  const meta = [state.location.admin1, state.location.country].filter(Boolean).join(', ');
  $('loc-meta').textContent = meta || wx.tzName(weather.utc_offset_seconds);

  $('cur-icon').innerHTML = wx.iconFor(c.weather_code, c.is_day === 1);
  $('cur-icon').setAttribute('aria-label', desc);

  $('cur-temp').textContent = wx.temp(c.temperature_2m, units.temp);
  $('cur-desc').textContent = desc;
  $('cur-feels').textContent = `Feels like ${wx.temp(c.apparent_temperature, units.temp)}`;

  $('cur-hilo').innerHTML =
    `<span class="hi">↑ ${wx.temp(weather.daily.temperature_2m_max[0], units.temp)}</span> ` +
    `<span class="lo">↓ ${wx.temp(weather.daily.temperature_2m_min[0], units.temp)}</span>`;

  $('cur-stats').innerHTML = `
    <span>Wind <b>${wx.wind(c.wind_speed_10m, units.wind)} ${wx.compass(c.wind_direction_10m)}</b></span>
    <span>Humidity <b>${c.relative_humidity_2m}%</b></span>
    <span>Rain today <b>${wx.precip(weather.daily.precipitation_sum[0], units.precip)}</b></span>`;

  updateClock(state);
}

export function updateClock(state) {
  const { weather } = state;
  if (!weather) return;
  const t = wx.timeInZone(weather.utc_offset_seconds);
  $('loc-time').innerHTML =
    `${t}<small>${escapeHTML(weather.timezone)} · ${wx.tzName(weather.utc_offset_seconds)}</small>`;
}

/* ============================================================
   HOURLY (strip + chart, hover-synced)
============================================================ */
let hourlyStripItems = [];
let hourlyMeta = []; // per-index tooltip data

export function renderHourly(state) {
  const { weather, units } = state;
  if (!weather?.hourly) return;
  ensureCharts();

  const nowISO = wx.localISO(wx.zonedNow(weather.utc_offset_seconds)).slice(0, 13); // "YYYY-MM-DDTHH"
  const start = Math.max(0, idxOfNow(weather.hourly.time, nowISO));
  const N = 24;

  const labels = [], values = [], bands = [];
  const strip = [];
  hourlyMeta = [];
  let bandOpen = null;

  for (let k = 0; k < N; k++) {
    const i = start + k;
    if (i >= weather.hourly.time.length) break;
    const time = weather.hourly.time[i];
    const isDay = weather.hourly.is_day[i] === 1;
    const t = time.slice(11, 16);

    labels.push(t);
    values.push(wx.tempNum(weather.hourly.temperature_2m[i], units.temp));

    if (!isDay && bandOpen === null) bandOpen = k;
    if (isDay && bandOpen !== null) { bands.push({ from: bandOpen, to: k }); bandOpen = null; }

    const pop = weather.hourly.precipitation_probability?.[i];
    strip.push(`
      <div class="hourly-item${k === 0 ? ' now' : ''}" data-i="${k}" role="listitem">
        <span class="h-time">${k === 0 ? 'Now' : t}</span>
        <span class="h-icon">${wx.iconFor(weather.hourly.weather_code[i], isDay)}</span>
        <span class="h-temp">${wx.temp(weather.hourly.temperature_2m[i], units.temp)}</span>
        <span class="h-pop">${pop >= 15 ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 7.6 6 12a6 6 0 1 1-12 0c0-4.4 6-12 6-12z" fill="currentColor"/></svg>${pop}%` : '&nbsp;'}</span>
      </div>`);

    hourlyMeta.push({
      time,
      desc: wx.describeCode(weather.hourly.weather_code[i]).desc,
      temp: wx.temp(weather.hourly.temperature_2m[i], units.temp),
      feels: wx.temp(weather.hourly.apparent_temperature[i], units.temp),
      wind: wx.wind(weather.hourly.wind_speed_10m[i], units.wind),
      pop: pop ?? 0,
    });
  }
  if (bandOpen !== null) bands.push({ from: bandOpen, to: values.length - 1 });

  $('hourly-strip').innerHTML = strip.join('');
  hourlyStripItems = [...document.querySelectorAll('.hourly-item')];
  hourlyStripItems.forEach((el) => {
    el.addEventListener('pointerenter', () => hourlyHover(Number(el.dataset.i), true));
    el.addEventListener('pointerleave', () => hourlyHover(-1, true));
  });

  hourlyChart.setData(labels, values, bands);
}

function hourlyHover(i, fromStrip = false) {
  hourlyStripItems.forEach((el) => el.classList.toggle('hl', Number(el.dataset.i) === i));
  if (fromStrip && i >= 0) hourlyChart.setHover(i);

  const tip = $('hourly-tip');
  if (i < 0 || !hourlyMeta[i]) { tip.hidden = true; return; }
  const m = hourlyMeta[i];
  const pos = hourlyChart.pointPos(i);
  if (!pos) return;
  tip.hidden = false;
  tip.innerHTML = `
    <b>${m.temp}</b> ${escapeHTML(m.desc)}<br>
    ${m.time.slice(11, 16)} · feels ${m.feels}<br>
    💧 ${m.pop}% · 💨 ${m.wind}`;
  // place tip above the point (page coords = canvas offset + local)
  const cRect = $('hourly-chart').getBoundingClientRect();
  const wrapRect = tip.parentElement.getBoundingClientRect();
  tip.style.left = `${cRect.left - wrapRect.left + pos.px}px`;
  tip.style.top = `${cRect.top - wrapRect.top + pos.py}px`;
}

/* ============================================================
   PRECIPITATION NOWCAST (15-min bars)
============================================================ */
let nowcastMeta = [];

export function renderNowcast(state) {
  const { weather, units } = state;
  const min15 = weather?.minutely_15;
  if (!min15 || !min15.time) {
    $('nowcast-card').style.display = 'none';
    return;
  }
  ensureCharts();
  $('nowcast-card').style.display = '';

  const nowISO = wx.localISO(wx.zonedNow(weather.utc_offset_seconds)).slice(0, 16); // "YYYY-MM-DDTHH:MM"
  const start = Math.max(0, idxOfNow(min15.time, nowISO));
  const N = 48; // 12 hours

  const labels = [], values = [];
  nowcastMeta = [];
  for (let k = 0; k < N; k++) {
    const i = start + k;
    if (i >= min15.time.length) break;
    const t = min15.time[i];
    labels.push(t.slice(11, 16));
    values.push(min15.precipitation[i] || 0);
    nowcastMeta.push({
      time: t,
      mm: min15.precipitation[i] || 0,
      pop: min15.precipitation_probability?.[i],
    });
  }
  nowcastChart.setData(labels, values);

  // summary
  const max = Math.max(...values);
  if (max <= 0) {
    $('nowcast-summary').innerHTML = 'No precipitation expected in the next 12 hours. ☀️';
  } else {
    const first = nowcastMeta.find((m) => m.mm > 0);
    const peak = nowcastMeta.reduce((a, b) => (b.mm > a.mm ? b : a), nowcastMeta[0]);
    const total = values.reduce((s, v) => s + v, 0);
    $('nowcast-summary').innerHTML =
      `Precipitation starting around <b>${escapeHTML(first.time.slice(11, 16))}</b>, ` +
      `peak <b>${wx.precip(peak.mm, units.precip)}</b> near <b>${escapeHTML(peak.time.slice(11, 16))}</b>, ` +
      `total <b>${wx.precip(total, units.precip)}</b>.`;
  }
}

function nowcastHover(i) {
  const tip = $('nowcast-tip');
  if (i < 0 || !nowcastMeta[i]) { tip.hidden = true; return; }
  const m = nowcastMeta[i];
  const cRect = $('nowcast-chart').getBoundingClientRect();
  const wrapRect = tip.parentElement.getBoundingClientRect();
  const frac = (i + 0.5) / nowcastMeta.length;
  tip.hidden = false;
  tip.innerHTML = `<b>${escapeHTML(m.time.slice(11, 16))}</b><br>${wx.precip(m.mm, state_units().precip)}${m.pop != null ? ` · ${m.pop}%` : ''}`;
  tip.style.left = `${cRect.left - wrapRect.left + frac * cRect.width}px`;
  tip.style.top = `${cRect.top - wrapRect.top + 10}px`;
}

// tiny indirection so the tooltip always formats with current units
function state_units() { return window.__skycastState.units; }

/* ============================================================
   16-DAY FORECAST + DAY DETAILS
============================================================ */
export function renderDaily(state) {
  const { weather, units } = state;
  if (!weather?.daily) return;

  const d = weather.daily;
  const cards = [];
  for (let i = 0; i < d.time.length; i++) {
    const date = wx.dateFromISO(d.time[i]);
    const isToday = i === 0;
    const pop = d.precipitation_probability_max?.[i];
    cards.push(`
      <div class="day-card${i === state.selectedDay ? ' selected' : ''}${isToday ? ' today' : ''}" data-i="${i}" tabindex="0" role="button"
           aria-label="${wx.dayLabel(date)} forecast">
        <span class="d-date">${isToday ? '<b>Today</b>' : `<b>${wx.dayLabel(date)}</b>${wx.MONTHS[date.getMonth()]} ${date.getDate()}`}</span>
        <span class="d-icon">${wx.iconFor(d.weather_code[i], true)}</span>
        <span class="d-hilo"><span class="max">${wx.tempNum(d.temperature_2m_max[i], units.temp)}°</span><span class="min">${wx.tempNum(d.temperature_2m_min[i], units.temp)}°</span></span>
        <span class="d-pop">${pop >= 15 ? `💧 ${pop}%` : '&nbsp;'}</span>
      </div>`);
  }
  const grid = $('daily-grid');
  grid.innerHTML = cards.join('');
  grid.querySelectorAll('.day-card').forEach((el) => {
    el.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('skycast:select-day', { detail: Number(el.dataset.i) }));
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
  });

  renderDayDetails(state);
}

function renderDayDetails(state) {
  const { weather, units, selectedDay } = state;
  const d = weather.daily;
  const i = selectedDay;

  const date = wx.dateFromISO(d.time[i]);
  $('day-details').hidden = false;
  $('day-details-title').textContent =
    `${wx.dayLabel(date)}, ${wx.MONTHS[date.getMonth()]} ${date.getDate()} — ${wx.describeCode(d.weather_code[i]).desc}`;

  // hourly values for this day
  const dayPrefix = d.time[i];
  const h = weather.hourly;
  const labels = [], values = [], bands = [];
  let bandOpen = null;
  for (let k = 0; k < h.time.length; k++) {
    if (!h.time[k].startsWith(dayPrefix)) continue;
    const idx = labels.length;
    labels.push(h.time[k].slice(11, 16));
    values.push(wx.tempNum(h.temperature_2m[k], units.temp));
    if (h.is_day[k] !== 1 && bandOpen === null) bandOpen = idx;
    if (h.is_day[k] === 1 && bandOpen !== null) { bands.push({ from: bandOpen, to: idx }); bandOpen = null; }
  }
  if (bandOpen !== null) bands.push({ from: bandOpen, to: values.length - 1 });

  ensureCharts();
  dayChart.setData(labels, values, bands);

  const stats = [
    ['High', wx.temp(d.temperature_2m_max[i], units.temp)],
    ['Low', wx.temp(d.temperature_2m_min[i], units.temp)],
    ['Rain', `${wx.precip(d.precipitation_sum[i], units.precip)} · ${d.precipitation_probability_max?.[i] ?? 0}%`],
    ['Max wind', `${wx.wind(d.wind_speed_10m_max[i], units.wind)} ${wx.compass(d.wind_direction_10m_dominant[i])}`],
    ['Gusts', wx.wind(d.wind_gusts_10m_max?.[i], units.wind)],
    ['UV max', `${d.uv_index_max[i]?.toFixed(1) ?? '—'} ${wx.uvInfo(d.uv_index_max[i]).label}`],
    ['Sunrise', wx.hhmm(d.sunrise[i])],
    ['Sunset', wx.hhmm(d.sunset[i])],
    ['Daylight', wx.durLabel(d.daylight_duration?.[i])],
  ];
  $('day-details-stats').innerHTML = stats
    .map(([l, v]) => `<div class="stat-pill">${escapeHTML(l)}<b>${escapeHTML(String(v))}</b></div>`)
    .join('');
}

/* ============================================================
   CURRENT-DETAILS TILES
============================================================ */
export function renderDetails(state) {
  const { weather, units } = state;
  if (!weather) return;
  const c = weather.current;
  const nowISO = wx.localISO(wx.zonedNow(weather.utc_offset_seconds)).slice(0, 13);
  const hi = idxOfNow(weather.hourly.time, nowISO);
  const uv = weather.hourly.uv_index[hi];
  const vis = weather.hourly.visibility?.[hi];
  const dp = wx.dewPoint(c.temperature_2m, c.relative_humidity_2m);

  const uvI = wx.uvInfo(uv);
  const uvBar = Math.min(100, (uv / 11) * 100);

  const tiles = [
    `
    <div class="tile">
      <span class="t-label">Wind</span>
      <div class="compass" title="Wind direction">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2"/>
          <text x="32" y="12" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.6)">N</text>
          <text x="54" y="35" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.6)">E</text>
          <text x="32" y="58" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.6)">S</text>
          <text x="10" y="35" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.6)">W</text>
          <g class="needle" style="transform: rotate(${(c.wind_direction_10m + 180) % 360}deg)">
            <path d="M32 12 L36 36 L32 32 L28 36 Z" fill="#ffd166"/>
          </g>
        </svg>
      </div>
      <b class="t-value" style="margin-top:6px">${wx.wind(c.wind_speed_10m, units.wind)}</b>
      <span class="t-sub">${wx.compass(c.wind_direction_10m)} · gusts ${wx.wind(c.wind_gusts_10m, units.wind)}</span>
    </div>`,
    `
    <div class="tile">
      <span class="t-label">Humidity</span>
      <b class="t-value">${c.relative_humidity_2m}%</b>
      <span class="t-sub">Dew point ${wx.temp(dp, units.temp)}</span>
      <div class="bar"><i style="width:${c.relative_humidity_2m}%"></i></div>
    </div>`,
    `
    <div class="tile">
      <span class="t-label">UV index</span>
      <b class="t-value" style="color:${uvI.color}">${uv?.toFixed(1) ?? '—'}</b>
      <span class="t-sub">${uvI.label}</span>
      <div class="bar"><i style="width:${uvBar}%;background:${uvI.color}"></i></div>
    </div>`,
    `
    <div class="tile">
      <span class="t-label">Pressure</span>
      <b class="t-value">${Math.round(c.pressure_msl)} <small>hPa</small></b>
      <span class="t-sub">Sea-level pressure</span>
    </div>`,
    `
    <div class="tile">
      <span class="t-label">Cloud cover</span>
      <b class="t-value">${c.cloud_cover}%</b>
      <div class="bar"><i style="width:${c.cloud_cover}%"></i></div>
    </div>`,
    `
    <div class="tile">
      <span class="t-label">Visibility</span>
      <b class="t-value">${wx.dist(vis, units.precip)}</b>
      <span class="t-sub">${vis >= 20000 ? 'Excellent' : vis >= 10000 ? 'Good' : vis >= 4000 ? 'Moderate' : 'Poor'}</span>
    </div>`,
    `
    <div class="tile">
      <span class="t-label">Rain today</span>
      <b class="t-value">${wx.precip(weather.daily.precipitation_sum[0], units.precip)}</b>
      <span class="t-sub">Chance of precipitation ${weather.daily.precipitation_probability_max?.[0] ?? 0}%</span>
    </div>`,
    `
    <div class="tile">
      <span class="t-label">Precip. now</span>
      <b class="t-value">${wx.precip(c.precipitation, units.precip)}</b>
      <span class="t-sub">In the current hour</span>
    </div>`,
  ];
  $('details-grid').innerHTML = tiles.join('');
}

/* ============================================================
   SUN & MOON
============================================================ */
export function renderSunMoon(state) {
  const { weather } = state;
  if (!weather?.daily) return;
  const d = weather.daily;
  const i = 0; // today

  // Open-Meteo returns local wall-clock strings ("YYYY-MM-DDTHH:MM"), so compare
  // wall-clock minutes directly against the location-local "now".
  const mins = (iso) => +iso.slice(11, 13) * 60 + +iso.slice(14, 16);
  const nd = wx.zonedNow(weather.utc_offset_seconds);
  const nowM = nd.getHours() * 60 + nd.getMinutes();
  const riseM = mins(d.sunrise[i]);
  const setM = mins(d.sunset[i]);
  let p = (nowM - riseM) / Math.max(1, setM - riseM);
  let status;
  if (p < 0) { p = 0; status = 'Before sunrise'; }
  else if (p > 1) { p = 1; status = 'After sunset'; }
  else status = `${Math.round(p * 100)}% of daylight elapsed`;

  // sun position on arc (theta from 180° → 0°)
  const theta = Math.PI * (1 - p);
  const sx = 150 + 135 * Math.cos(theta);
  const sy = 135 - 120 * Math.sin(theta);
  const sunColor = status === 'After sunset' || status === 'Before sunrise' ? '#9aa7c7' : '#ffd166';

  $('sun-arc-wrap').innerHTML = `
    <svg viewBox="0 0 300 160" role="img" aria-label="Sun arc for today">
      <path d="M15 135 A 135 120 0 0 1 285 135" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M15 135 A 135 120 0 0 1 285 135" fill="none" stroke="#ffd166" stroke-width="3" stroke-linecap="round"
            pathLength="100" stroke-dasharray="${(p * 100).toFixed(1)} 100"/>
      <line x1="10" y1="135" x2="290" y2="135" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
      <circle cx="${sx}" cy="${sy}" r="10" fill="${sunColor}">
        <animate attributeName="r" values="10;11.5;10" dur="3s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${sx}" cy="${sy}" r="16" fill="none" stroke="${sunColor}" stroke-opacity=".4" stroke-width="1.5"/>
      <text class="sun-val" x="15" y="146" text-anchor="middle">${wx.hhmm(d.sunrise[i])}</text>
      <text class="sun-val" x="285" y="146" text-anchor="middle">${wx.hhmm(d.sunset[i])}</text>
      <text class="sun-label" x="15" y="159" text-anchor="middle">Sunrise</text>
      <text class="sun-label" x="285" y="159" text-anchor="middle">Sunset</text>
    </svg>`;

  $('sunmoon-sub').textContent = status;

  $('sun-times').innerHTML = [
    ['Daylight', wx.durLabel(d.daylight_duration?.[i])],
    ['UV max', `${d.uv_index_max[i]?.toFixed(1) ?? '—'} ${wx.uvInfo(d.uv_index_max[i]).label}`],
  ].map(([l, v]) => `<div class="stat-pill">${escapeHTML(l)}<b>${escapeHTML(String(v))}</b></div>`).join('');

  // moon phase for the location-local calendar day
  const phase = wx.moonPhase(new Date(nd.getFullYear(), nd.getMonth(), nd.getDate(), 12));
  $('moon-wrap').innerHTML = `
    ${wx.moonSVG(phase)}
    <div class="moon-name">${phase.name}</div>
    <div class="moon-sub">${Math.round(phase.illum * 100)}% illuminated</div>`;
}

/* ============================================================
   AIR QUALITY
============================================================ */
const AQI_MAX_SCALE = 150;

function aqiGaugeSVG(value, info) {
  const cx = 130, cy = 120, r = 100;
  const bands = [
    { from: 0, to: 20, color: '#50f0a0' },
    { from: 20, to: 40, color: '#50d0f0' },
    { from: 40, to: 60, color: '#f0e050' },
    { from: 60, to: 80, color: '#f08050' },
    { from: 80, to: 100, color: '#f04050' },
    { from: 100, to: 150, color: '#a040c0' },
  ];
  const pt = (v) => {
    const a = Math.PI * (1 - Math.min(v, AQI_MAX_SCALE) / AQI_MAX_SCALE);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arc = (v0, v1, color) => {
    const [x0, y0] = pt(v0), [x1, y1] = pt(v1);
    const large = (v1 - v0) / AQI_MAX_SCALE > 0.5 ? 1 : 0;
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="butt" stroke-opacity=".85"/>`;
  };
  let arcs = bands.map((b) => arc(b.from, b.to, b.color)).join('');
  const [nx, ny] = pt(value ?? 0);
  const needle = value == null ? '' :
    `<circle cx="${nx.toFixed(1)}" cy="${(ny - 6).toFixed(1)}" r="7" fill="#fff" stroke="#1c2436" stroke-width="2"/>`;
  return `
    <svg viewBox="0 0 260 140" role="img" aria-label="Air quality gauge">
      ${arcs}
      <line x1="${cx - r - 6}" y1="${cy}" x2="${cx + r + 6}" y2="${cy}" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>
      ${needle}
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="30" font-weight="800" fill="#fff">${value == null ? '—' : Math.round(value)}</text>
    </svg>`;
}

export function renderAQI(state) {
  const aqi = state.aqi?.current;
  if (!aqi) {
    $('aqi-main').innerHTML = `<p style="color:var(--ink-dim)">Air-quality data is unavailable for this location.</p>`;
    $('aqi-pollutants').innerHTML = '';
    return;
  }
  const v = aqi.european_aqi;
  const info = wx.aqiInfo(v);
  $('aqi-main').innerHTML = `
    ${aqiGaugeSVG(v, info)}
    <div class="aqi-value" style="color:${info.color}">${v ?? '—'}</div>
    <div class="aqi-label" style="color:${info.color}">${info.label}</div>
    <div style="font-size:.75rem;color:var(--ink-dim);margin-top:4px">US AQI: ${aqi.us_aqi ?? '—'}</div>`;

  const rows = [
    ['PM2.5', aqi.pm2_5, 'µg/m³', 50],
    ['PM10', aqi.pm10, 'µg/m³', 100],
    ['O₃', aqi.ozone, 'µg/m³', 180],
    ['NO₂', aqi.nitrogen_dioxide, 'µg/m³', 150],
    ['SO₂', aqi.sulphur_dioxide, 'µg/m³', 150],
    ['CO', aqi.carbon_monoxide, 'mg/m³', 10],
  ];
  $('aqi-pollutants').innerHTML = rows
    .filter(([, val]) => val != null)
    .map(([name, val, unit, scale]) => {
      const pct = Math.min(100, (val / scale) * 100);
      return `
      <div class="poll-row">
        <span class="p-name">${name}</span>
        <span class="bar"><i style="width:${pct.toFixed(0)}%"></i></span>
        <span class="p-val">${val.toFixed(1)} ${unit}</span>
      </div>`;
    })
    .join('');
}

/* ============================================================
   SAVED PLACES POPOVER
============================================================ */
export function renderSavedList(state) {
  const list = $('saved-list');
  if (!state.saved.length) {
    list.innerHTML = `<div class="saved-empty">No saved places yet — save one with the ☆ button above.</div>`;
    return;
  }
  list.innerHTML = state.saved
    .map((s, i) => `
      <button class="saved-chip" data-i="${i}" title="Show ${escapeHTML(s.name)}">
        <span>${escapeHTML(s.name)}</span>
        <span class="chip-temp">${s.lastTemp ?? ''}</span>
        <span class="chip-x" data-x="${i}" title="Remove">×</span>
      </button>`)
    .join('');
}

/* ============================================================
   COMPARE MODAL BODY
============================================================ */
export function compareRowHTML(loc, current, units) {
  if (!current) {
    return `<tr><td class="c-name">${escapeHTML(loc.name)}</td><td class="c-loading" colspan="4">Loading…</td></tr>`;
  }
  const c = current.current;
  const { desc } = wx.describeCode(c.weather_code);
  return `
    <tr>
      <td class="c-name" data-loc='${escapeHTML(JSON.stringify(loc))}'>${escapeHTML(loc.name)}</td>
      <td><span class="c-icon">${wx.iconFor(c.weather_code, c.is_day === 1)}</span></td>
      <td>${wx.temp(c.temperature_2m, units.temp)}</td>
      <td>${desc}</td>
      <td>${wx.wind(c.wind_speed_10m, units.wind)}</td>
    </tr>`;
}

/* ============================================================
   TOP-LEVEL RENDER
============================================================ */
export function renderAll(state) {
  window.__skycastState = state;
  document.body.classList.toggle('loading', state.loading && !state.weather);
  if (!state.weather) return;
  renderHero(state);
  renderHourly(state);
  renderNowcast(state);
  renderDaily(state);
  renderDetails(state);
  renderSunMoon(state);
  renderAQI(state);
  renderSavedList(state);
  // charts can end up slightly mis-measured while the page reflows — redraw once settled
  requestAnimationFrame(() => { hourlyChart?.draw(); nowcastChart?.draw(); dayChart?.draw(); });
}
