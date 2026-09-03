/* Skycast main controller: init, search, geolocation, units, saved places, compare. */

import { store } from './state.js';
import * as api from './api.js';
import * as wx from './wx.js';
import * as views from './views.js';
import { background } from './background.js';

const $ = (id) => document.getElementById(id);

/* ---------------- toasts ---------------- */
function toast(msg, type = 'info', ms = 4200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('fade'), ms - 400);
  setTimeout(() => el.remove(), ms);
}

/* ---------------- data loading ---------------- */
async function loadLocation(loc, opts = {}) {
  store.set({ loading: true, selectedDay: 0, hlHour: -1 });
  try {
    const [weather, aqi] = await Promise.all([
      api.fetchWeather(loc.lat, loc.lon),
      api.fetchAirQuality(loc.lat, loc.lon).catch(() => null),
    ]);
    store.set({ location: loc, weather, aqi, loading: false, error: null });

    const c = weather.current;
    const theme = wx.themeFor(c.weather_code, c.is_day === 1);
    document.body.dataset.cond = theme;
    background.setTheme(theme);

    // cache the temp next to the saved chip if this place is saved
    const st = store.get();
    const idx = st.saved.findIndex((s) => samePlace(s, loc));
    if (idx >= 0) {
      const saved = [...st.saved];
      saved[idx] = { ...saved[idx], lastTemp: wx.temp(c.temperature_2m, st.units.temp) };
      store.set({ saved });
    }
    if (opts.announce) toast(`Showing ${loc.name}`);
  } catch (err) {
    console.error(err);
    store.set({ loading: false, error: err.message });
    toast(`Couldn't load weather: ${err.message}`, 'error');
  }
}

function samePlace(a, b) {
  return a.lat === b.lat && a.lon === b.lon;
}

/* ---------------- store → views ---------------- */
store.subscribe((state) => views.renderAll(state));
store.subscribe((state) => updateUnitsUI(state));

function updateUnitsUI(state) {
  document.querySelectorAll('#units-pop .seg').forEach((seg) => {
    const group = seg.dataset.group;
    seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.value === state.units[group]);
    });
  });
}

/* ---------------- search ---------------- */
const searchInput = $('search-input');
const searchResults = $('search-results');
let searchTimer = null;
let resultItems = [];
let activeIdx = -1;
let searchToken = 0;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchToken++;
  const q = searchInput.value.trim();
  if (q.length < 2) { hideResults(); return; }
  searchTimer = setTimeout(() => doSearch(q), 220);
});

async function doSearch(q) {
  const token = ++searchToken;
  try {
    const results = await api.geocode(q);
    if (token !== searchToken) return; // a newer keystroke won the race
    resultItems = results;
    activeIdx = -1;
    if (!results.length) {
      searchResults.innerHTML = `<li class="empty">No places found for “${escapeHTML(q)}”.</li>`;
    } else {
      searchResults.innerHTML = results
        .map((r, i) => `
          <li data-i="${i}" role="option">
            <span class="r-name">${escapeHTML(r.name)}</span>
            <span class="r-sub">${escapeHTML([r.admin1, r.country].filter(Boolean).join(', '))}</span>
          </li>`)
        .join('');
      searchResults.querySelectorAll('li[data-i]').forEach((li) => {
        li.addEventListener('click', () => pickResult(Number(li.dataset.i)));
        li.addEventListener('pointerenter', () => setActive(Number(li.dataset.i)));
      });
    }
    searchResults.hidden = false;
  } catch {
    searchResults.innerHTML = `<li class="empty">Search failed — check your connection.</li>`;
    searchResults.hidden = false;
  }
}

function setActive(i) {
  activeIdx = i;
  searchResults.querySelectorAll('li[data-i]').forEach((li) =>
    li.classList.toggle('active', Number(li.dataset.i) === i));
}

function pickResult(i) {
  const r = resultItems[i];
  if (!r) return;
  hideResults();
  searchInput.value = r.name;
  loadLocation({ name: r.name, admin1: r.admin1, country: r.country, lat: r.latitude, lon: r.longitude });
}

function hideResults() {
  searchResults.hidden = true;
  activeIdx = -1;
}

searchInput.addEventListener('keydown', (e) => {
  const items = [...searchResults.querySelectorAll('li[data-i]')];
  if (e.key === 'ArrowDown' && items.length) {
    e.preventDefault();
    setActive(Math.min(activeIdx + 1, items.length - 1));
  } else if (e.key === 'ArrowUp' && items.length) {
    e.preventDefault();
    setActive(Math.max(activeIdx - 1, 0));
  } else if (e.key === 'Enter') {
    if (activeIdx >= 0) pickResult(activeIdx);
    else if (items.length) pickResult(0);
  } else if (e.key === 'Escape') {
    hideResults();
    searchInput.blur();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- geolocation ---------------- */
$('locate-btn').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Geolocation is not supported by this browser.', 'error');
  toast('Locating you…', 'info', 2000);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      loadLocation({ name: 'My location', admin1: '', country: '', lat: latitude, lon: longitude }, { announce: true });
    },
    (err) => toast(`Location unavailable: ${err.message}`, 'error'),
    { timeout: 10000 },
  );
});

/* ---------------- popovers ---------------- */
const pops = [
  { btn: $('units-btn'), pop: $('units-pop') },
  { btn: $('saved-btn'), pop: $('saved-pop') },
];

pops.forEach(({ btn, pop }) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !pop.hidden;
    pops.forEach((p) => (p.pop.hidden = true));
    pop.hidden = open;
  });
  pop.addEventListener('click', (e) => e.stopPropagation());
});

document.addEventListener('click', () => pops.forEach((p) => (p.pop.hidden = true)));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') pops.forEach((p) => (p.pop.hidden = true));
});

/* ---------------- units ---------------- */
$('units-pop').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-value]');
  if (!btn) return;
  const group = btn.closest('.seg').dataset.group;
  const units = { ...store.get().units, [group]: btn.dataset.value };
  store.set({ units });
});

/* ---------------- saved places ---------------- */
$('save-current').addEventListener('click', () => {
  const st = store.get();
  if (!st.location) return toast('Load a place first.', 'error');
  if (st.saved.some((s) => samePlace(s, st.location))) return toast('Already saved. ★');
  const saved = [...st.saved, { ...st.location, lastTemp: wx.temp(st.weather?.current?.temperature_2m, st.units.temp) }];
  store.set({ saved });
  toast(`Saved ${st.location.name} ★`);
});

$('saved-list').addEventListener('click', (e) => {
  const x = e.target.closest('.chip-x');
  if (x) {
    e.stopPropagation();
    const saved = [...store.get().saved];
    saved.splice(Number(x.dataset.x), 1);
    store.set({ saved });
    return;
  }
  const chip = e.target.closest('.saved-chip');
  if (!chip) return;
  const loc = store.get().saved[Number(chip.dataset.i)];
  if (loc) {
    pops.forEach((p) => (p.pop.hidden = true));
    loadLocation({ name: loc.name, admin1: loc.admin1, country: loc.country, lat: loc.lat, lon: loc.lon }, { announce: true });
  }
});

/* ---------------- compare modal ---------------- */
const compareModal = $('compare-modal');

$('compare-btn').addEventListener('click', openCompare);
$('compare-close').addEventListener('click', () => (compareModal.hidden = true));
compareModal.addEventListener('click', (e) => { if (e.target === compareModal) compareModal.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !compareModal.hidden) compareModal.hidden = true; });

async function openCompare() {
  const st = store.get();
  if (st.saved.length < 1) return toast('Save a place first (☆), then you can compare.', 'info');

  compareModal.hidden = false;
  $('compare-body').innerHTML = `<p class="c-loading">Loading current conditions…</p>`;
  $('compare-body').innerHTML = `
    <table>
      <thead><tr><th>Place</th><th></th><th>Temp</th><th>Conditions</th><th>Wind</th></tr></thead>
      <tbody id="compare-rows"></tbody>
    </table>`;
  const tbody = $('compare-rows');

  const jobs = st.saved.map(async (loc, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = views.compareRowHTML(loc, null, st.units);
    tbody.appendChild(tr);
    try {
      const cur = await api.fetchCurrent(loc.lat, loc.lon);
      tr.innerHTML = views.compareRowHTML(loc, cur, st.units);
      tr.querySelector('.c-name').addEventListener('click', () => {
        compareModal.hidden = true;
        loadLocation({ name: loc.name, admin1: loc.admin1, country: loc.country, lat: loc.lat, lon: loc.lon }, { announce: true });
      });
    } catch {
      tr.innerHTML = `<td>${escapeHTML(loc.name)}</td><td class="c-loading" colspan="3">Unavailable</td>`;
    }
  });
  await Promise.allSettled(jobs);
}

/* ---------------- day selection ---------------- */
document.addEventListener('skycast:select-day', (e) => {
  const st = store.get();
  if (!st.weather) return;
  store.set({ selectedDay: e.detail });
  const el = $('day-details');
  if (el && !el.hidden) el.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
});

/* ---------------- clocks & timers ---------------- */
setInterval(() => views.updateClock(store.get()), 1000);
setInterval(() => {
  const st = store.get();
  if (st.weather && !st.loading) views.renderSunMoon(st);
}, 60000);

/* ---------------- boot ---------------- */
(async function boot() {
  views.renderAll(store.get());            // initial paint (skeleton)
  views.renderSavedList(store.get());

  let last = null;
  try { last = JSON.parse(localStorage.getItem('skycast.last')); } catch { /* ignore */ }

  if (last && Number.isFinite(last.lat) && Number.isFinite(last.lon)) {
    await loadLocation(last);
  } else {
    // pleasant default until the user picks a place
    await loadLocation({ name: 'Johannesburg', admin1: 'Gauteng', country: 'South Africa', lat: -26.2044, lon: 28.0456 });
    toast('Tip: search any city, or press the ⌖ button to use your location.');
  }
})();
