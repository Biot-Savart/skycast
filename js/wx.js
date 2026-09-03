/* Weather codes, SVG icons, unit conversion, formatting, and small astronomy helpers. */

/* ---------- weather code table ---------- */
const CODES = {
  0:  { desc: 'Clear sky',                       icon: 'clear' },
  1:  { desc: 'Mainly clear',                    icon: 'mostly-clear' },
  2:  { desc: 'Partly cloudy',                   icon: 'partly' },
  3:  { desc: 'Overcast',                       icon: 'cloud' },
  45: { desc: 'Fog',                             icon: 'fog' },
  48: { desc: 'Freezing fog',                    icon: 'fog' },
  51: { desc: 'Light drizzle',                   icon: 'drizzle' },
  53: { desc: 'Moderate drizzle',                icon: 'drizzle' },
  55: { desc: 'Dense drizzle',                   icon: 'drizzle' },
  56: { desc: 'Freezing drizzle',                icon: 'sleet' },
  57: { desc: 'Dense freezing drizzle',           icon: 'sleet' },
  61: { desc: 'Light rain',                       icon: 'rain' },
  63: { desc: 'Moderate rain',                   icon: 'rain' },
  65: { desc: 'Heavy rain',                      icon: 'rain' },
  66: { desc: 'Freezing rain',                   icon: 'sleet' },
  67: { desc: 'Heavy freezing rain',             icon: 'sleet' },
  71: { desc: 'Light snowfall',                  icon: 'snow' },
  73: { desc: 'Moderate snowfall',               icon: 'snow' },
  75: { desc: 'Heavy snowfall',                  icon: 'snow' },
  77: { desc: 'Snow grains',                     icon: 'snow' },
  80: { desc: 'Light rain showers',              icon: 'showers' },
  81: { desc: 'Rain showers',                    icon: 'showers' },
  82: { desc: 'Violent rain showers',            icon: 'showers' },
  85: { desc: 'Light snow showers',              icon: 'snow' },
  86: { desc: 'Heavy snow showers',              icon: 'snow' },
  95: { desc: 'Thunderstorm',                    icon: 'thunder' },
  96: { desc: 'Thunderstorm with hail',          icon: 'thunder' },
  99: { desc: 'Thunderstorm with heavy hail',    icon: 'thunder' },
};

export function describeCode(code) {
  return CODES[code] || { desc: 'Unknown', icon: 'cloud' };
}

/* ---------- animated inline SVG icons ---------- */
const SUN = (cls = '') =>
  `<g class="${cls}"><circle cx="32" cy="32" r="11" fill="#ffd166"/>
   <g class="spin" stroke="#ffd166" stroke-width="3" stroke-linecap="round">
     <line x1="32" y1="8" x2="32" y2="14"/><line x1="32" y1="50" x2="32" y2="56"/>
     <line x1="8" y1="32" x2="14" y2="32"/><line x1="50" y1="32" x2="56" y2="32"/>
     <line x1="15" y1="15" x2="19" y2="19"/><line x1="45" y1="45" x2="49" y2="49"/>
     <line x1="49" y1="15" x2="45" y2="19"/><line x1="19" y1="45" x2="15" y2="49"/>
   </g></g>`;

const MOON = `<path d="M40 12a20 20 0 1 0 12 34 16 16 0 0 1-12-34z" fill="#f4f0d8"/>`;

const CLOUD = (fill = '#dfeaf5', cls = 'cloud-drift') =>
  `<path class="${cls}" d="M24 44a10 10 0 0 1-.7-20 14 14 0 0 1 27-3.5A9.5 9.5 0 0 1 49 44H24z" fill="${fill}"/>`;

const RAIN = (cls = 'raindrop', color = '#8fd0ff') => {
  let drops = '';
  for (let i = 0; i < 3; i++) {
    drops += `<line class="${cls}" style="animation-delay:${(i * 0.35).toFixed(2)}s"
      x1="${24 + i * 9}" y1="48" x2="${21 + i * 9}" y2="56" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return drops;
};

const SNOW = () => {
  let dots = '';
  for (let i = 0; i < 3; i++) {
    dots += `<circle class="snowdot" style="animation-delay:${(i * 0.7).toFixed(1)}s"
      cx="${24 + i * 9}" cy="52" r="2.6" fill="#eaf6ff"/>`;
  }
  return dots;
};

const ICONS = {
  clear:      (day) => `<svg viewBox="0 0 64 64">${day ? SUN() : MOON}</svg>`,
  'mostly-clear': (day) => `<svg viewBox="0 0 64 64">${day ? SUN() : MOON}${CLOUD('#ffffff30', 'cloud-drift')}</svg>`,
  partly:     (day) => `<svg viewBox="0 0 64 64">${day ? SUN() : MOON}${CLOUD('#ffffff70')}</svg>`,
  cloud:      () => `<svg viewBox="0 0 64 64">${CLOUD('#c9d6e4')}</svg>`,
  fog:        () => `<svg viewBox="0 0 64 64">${CLOUD('#c3c9cf')}
                <g stroke="#aab2ba" stroke-width="3" stroke-linecap="round">
                  <line x1="14" y1="50" x2="50" y2="50"/><line x1="18" y1="57" x2="46" y2="57"/>
                </g></svg>`,
  drizzle:    () => `<svg viewBox="0 0 64 64">${CLOUD('#b9c6d4')}${RAIN('raindrop', '#a5dcff')}</svg>`,
  rain:       () => `<svg viewBox="0 0 64 64">${CLOUD('#93a5b8')}${RAIN()}</svg>`,
  showers:    () => `<svg viewBox="0 0 64 64">${CLOUD('#a4b4c6')}${RAIN()}</svg>`,
  sleet:      () => `<svg viewBox="0 0 64 64">${CLOUD('#a9b7c8')}${RAIN()}${SNOW()}</svg>`,
  snow:       () => `<svg viewBox="0 0 64 64">${CLOUD('#c8d6e4')}${SNOW()}</svg>`,
  thunder:    () => `<svg viewBox="0 0 64 64">${CLOUD('#7d8aa0')}
                <path class="bolt" d="M32 46l-6 10h5l-3 8 10-13h-6l4-5h-4z" fill="#ffe066"/></svg>`,
};

export function iconFor(code, isDay = true) {
  const { icon } = describeCode(code);
  const fn = ICONS[icon] || ICONS.cloud;
  return fn(isDay);
}

/* ---------- condition → background theme ---------- */
export function themeFor(code, isDay) {
  const { icon } = describeCode(code);
  const day = isDay ? '-day' : '-night';
  switch (icon) {
    case 'clear':
    case 'mostly-clear': return isDay ? 'clear-day' : 'clear-night';
    case 'partly':       return `partly${day}`;
    case 'cloud':        return `cloud${day}`;
    case 'rain':
    case 'drizzle':
    case 'showers':
    case 'sleet':        return `rain${day}`;
    case 'snow':         return `snow${day}`;
    case 'thunder':      return `thunder${day}`;
    case 'fog':          return `fog${day}`;
    default:             return `cloud${day}`;
  }
}

/* ---------- units ---------- */
export function temp(v, unit) { // v in °C
  if (v == null || Number.isNaN(v)) return '—';
  return unit === 'f' ? `${Math.round(v * 9 / 5 + 32)}°F` : `${Math.round(v)}°C`;
}
export function tempNum(v, unit) {
  return unit === 'f' ? Math.round(v * 9 / 5 + 32) : Math.round(v);
}
export function wind(v, unit) { // v in km/h
  if (v == null || Number.isNaN(v)) return '—';
  if (unit === 'mph') return `${Math.round(v * 0.621371)} mph`;
  if (unit === 'ms') return `${(v / 3.6).toFixed(1)} m/s`;
  return `${Math.round(v)} km/h`;
}
export function precip(v, unit) { // v in mm
  if (v == null || Number.isNaN(v)) return '—';
  return unit === 'in' ? `${(v / 25.4).toFixed(2)} in` : `${v.toFixed(1)} mm`;
}
export function dist(v, unit) { // v in meters
  if (v == null || Number.isNaN(v)) return '—';
  return unit === 'in' ? `${(v / 1609.34).toFixed(1)} mi` : `${(v / 1000).toFixed(1)} km`;
}

export const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export function compass(deg) { return COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }

/* ---------- UV ---------- */
export function uvInfo(uv) {
  if (uv == null) return { label: '—', color: '#8a93a6' };
  if (uv < 3) return { label: 'Low', color: '#7bd97b' };
  if (uv < 6) return { label: 'Moderate', color: '#ffd166' };
  if (uv < 8) return { label: 'High', color: '#ff9f5a' };
  if (uv < 11) return { label: 'Very high', color: '#ff6b6b' };
  return { label: 'Extreme', color: '#c77dff' };
}

/* ---------- AQI (European) ---------- */
const AQI_BANDS = [
  { max: 20,  label: 'Good',           color: '#50f0a0' },
  { max: 40,  label: 'Fair',           color: '#50d0f0' },
  { max: 60,  label: 'Moderate',       color: '#f0e050' },
  { max: 80,  label: 'Poor',           color: '#f08050' },
  { max: 100, label: 'Very poor',      color: '#f04050' },
  { max: 150, label: 'Extremely poor', color: '#a040c0' },
];
export function aqiInfo(v) {
  if (v == null) return { label: 'Unknown', color: '#8a93a6' };
  for (const b of AQI_BANDS) if (v <= b.max) return { label: b.label, color: b.color };
  return { label: 'Extremely poor', color: '#a040c0' };
}

/* ---------- dew point (Magnus) ---------- */
export function dewPoint(t, rh) {
  if (t == null || rh == null) return null;
  const a = 17.625, b = 243.04;
  const alpha = Math.log(Math.max(rh, 1) / 100) + (a * t) / (b + t);
  return (b * alpha) / (a - alpha);
}

/* ---------- local time helpers (forecast uses timezone=auto, times are local ISO) ---------- */
/** Date shifted so getHours() etc. read in the location's timezone. */
export function zonedNow(utcOffsetSeconds) {
  const d = new Date();
  d.setTime(d.getTime() + d.getTimezoneOffset() * 60000 + utcOffsetSeconds * 1000);
  return d;
}

export function localISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function hhmm(iso) { return iso ? iso.slice(11, 16) : '—'; }

export function timeInZone(utcOffsetSeconds) {
  const d = zonedNow(utcOffsetSeconds);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function tzName(offsetSeconds) {
  const h = Math.abs(offsetSeconds) / 3600;
  const m = Math.abs(offsetSeconds) % 3600 / 60;
  const sign = offsetSeconds >= 0 ? '+' : '−';
  return `UTC${sign}${Math.floor(h)}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/* ---------- formatting ---------- */
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateFromISO(isoDate) { // "YYYY-MM-DD"
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayLabel(date) { return DAY_NAMES[date.getDay()]; }

export function durLabel(seconds) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/* ---------- moon phase ---------- */
export function moonPhase(date = new Date()) {
  const SYNODIC = 29.530588853;
  const REF = Date.UTC(2000, 0, 6, 18, 14); // known new moon
  const days = (date.getTime() - REF) / 86400000;
  let k = ((days % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC; // 0=new .. 0.5=full
  const illum = (1 - Math.cos(2 * Math.PI * k)) / 2;
  let name;
  if (k < 0.03 || k > 0.97) name = 'New moon';
  else if (k < 0.22) name = 'Waxing crescent';
  else if (k < 0.28) name = 'First quarter';
  else if (k < 0.47) name = 'Waxing gibbous';
  else if (k < 0.53) name = 'Full moon';
  else if (k < 0.72) name = 'Waning gibbous';
  else if (k < 0.78) name = 'Last quarter';
  else name = 'Waning crescent';
  return { k, illum, name };
}

/** SVG moon: light disc with a dark disc clipped inside to produce the phase. */
export function moonSVG(phase, size = 110) {
  const { k, illum } = phase;
  const r = size / 2 - 6, cx = size / 2, cy = size / 2;
  // shadow disc offset: 0 (new) .. ±2r (full); waxing → lit right → shadow shifted left
  const sign = k < 0.5 ? -1 : 1;
  const dx = sign * 2 * r * illum;
  return `
  <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs><clipPath id="moon-clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
    <circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#ffffff18"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f6f2da"/>
    <circle cx="${cx + dx}" cy="${cy}" r="${r}" fill="#2a3050" clip-path="url(#moon-clip)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffffff40" stroke-width="1"/>
  </svg>`;
}
