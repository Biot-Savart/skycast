/* Minimal observable store + localStorage persistence. */

const LS = {
  units: 'skycast.units',
  saved: 'skycast.saved',
  last: 'skycast.last',
};

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
}

const state = {
  location: null,      // {name, country, admin1, lat, lon}
  weather: null,       // Open-Meteo forecast response
  aqi: null,           // Open-Meteo air-quality response (or null)
  loading: false,
  error: null,
  selectedDay: 0,      // index into daily arrays
  hlHour: -1,          // hovered hour index within the 24h window
  units: load(LS.units, { temp: 'c', wind: 'kmh', precip: 'mm' }),
  saved: load(LS.saved, []),
};

const subscribers = new Set();

export const store = {
  get: () => state,

  set(patch) {
    Object.assign(state, patch);
    if (patch.units) save(LS.units, state.units);
    if (patch.saved) save(LS.saved, state.saved);
    if (patch.location) save(LS.last, state.location);
    subscribers.forEach((fn) => fn(state, patch));
  },

  subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
};
