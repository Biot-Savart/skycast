/* Open-Meteo API layer — all endpoints are free and require NO API key.
   https://open-meteo.com/ */

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AQI_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

/** Search cities by name. Returns array of {id,name,latitude,longitude,country,admin1,timezone,population,country_code} */
export async function geocode(name, count = 8) {
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=${count}&language=en&format=json`;
  const data = await getJSON(url);
  return data.results || [];
}

/** Full forecast for a location. Units requested in metric; conversion happens client-side. */
export async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    forecast_days: 16,
    wind_speed_unit: 'kmh',
    // current
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,' +
      'weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    // hourly
    hourly:
      'temperature_2m,apparent_temperature,precipitation_probability,precipitation,' +
      'weather_code,wind_speed_10m,uv_index,visibility,is_day',
    // 15-minute nowcast
    minutely_15: 'precipitation,precipitation_probability',
    // daily
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration,' +
      'uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,' +
      'wind_gusts_10m_max,wind_direction_10m_dominant',
  });
  return getJSON(`${FORECAST_URL}?${params}`);
}

/** Current air quality (may not exist over open ocean — caller handles failure). */
export async function fetchAirQuality(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    current:
      'european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
  });
  return getJSON(`${AQI_URL}?${params}`);
}

/** Small current-conditions fetch, used by the compare modal. */
export async function fetchCurrent(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    wind_speed_unit: 'kmh',
    current: 'temperature_2m,weather_code,wind_speed_10m,is_day',
  });
  return getJSON(`${FORECAST_URL}?${params}`);
}
