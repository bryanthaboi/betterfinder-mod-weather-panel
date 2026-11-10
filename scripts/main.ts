import { net, settings, ui } from "betterfinder";
import type { ActivateHandler, CommandRunHandler, SettingsChangedHandler, UINode, UIColor } from "betterfinder";

const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=";
const FORECAST = "https://api.open-meteo.com/v1/forecast?timezone=auto&forecast_days=5&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max";

interface Sky { text: string; icon: string; night?: string; color: UIColor; glyph: string; }

const CLEAR: Sky = { text: "clear", icon: "sun.max.fill", night: "moon.stars.fill", color: "warning", glyph: "☀" };
const CLOUDY: Sky = { text: "overcast", icon: "cloud.fill", color: "secondary", glyph: "☁" };
const FOG: Sky = { text: "foggy", icon: "cloud.fog.fill", color: "secondary", glyph: "☁" };
const DRIZZLE: Sky = { text: "drizzle", icon: "cloud.drizzle.fill", color: "accent", glyph: "☂" };
const RAIN: Sky = { text: "rain", icon: "cloud.rain.fill", color: "accent", glyph: "☂" };
const SLEET: Sky = { text: "freezing rain", icon: "cloud.sleet.fill", color: "accent", glyph: "☂" };
const SNOW: Sky = { text: "snow", icon: "cloud.snow.fill", color: "primary", glyph: "❄" };
const STORM: Sky = { text: "thunderstorm", icon: "cloud.bolt.rain.fill", color: "danger", glyph: "⚡" };

function sky(code: number): Sky {
  if (code === 0) return CLEAR;
  if (code === 1) return { text: "mostly clear", icon: "sun.max.fill", night: "moon.stars.fill", color: "warning", glyph: "☀" };
  if (code === 2) return { text: "partly cloudy", icon: "cloud.sun.fill", night: "cloud.moon.fill", color: "warning", glyph: "⛅" };
  if (code === 3) return CLOUDY;
  if (code === 45 || code === 48) return FOG;
  if (code === 51) return { text: "light drizzle", icon: DRIZZLE.icon, color: DRIZZLE.color, glyph: DRIZZLE.glyph };
  if (code === 53 || code === 55) return DRIZZLE;
  if (code === 56 || code === 57 || code === 66 || code === 67) return SLEET;
  if (code === 61) return { text: "light rain", icon: RAIN.icon, color: RAIN.color, glyph: RAIN.glyph };
  if (code === 63) return RAIN;
  if (code === 65) return { text: "heavy rain", icon: "cloud.heavyrain.fill", color: RAIN.color, glyph: RAIN.glyph };
  if (code === 71) return { text: "light snow", icon: SNOW.icon, color: SNOW.color, glyph: SNOW.glyph };
  if (code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return SNOW;
  if (code === 80 || code === 81) return { text: "showers", icon: "cloud.sun.rain.fill", night: "cloud.moon.rain.fill", color: "accent", glyph: "☂" };
  if (code === 82) return { text: "violent showers", icon: "cloud.heavyrain.fill", color: "accent", glyph: "☂" };
  if (code === 95 || code === 96 || code === 99) return STORM;
  return { text: "weird", icon: "questionmark.circle", color: "secondary", glyph: "?" };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayName(iso: string, index: number): string {
  if (index === 0) return "Today";
  const parsed = new Date(iso + "T12:00:00Z");
  const day = DAYS[parsed.getUTCDay()];
  return day || iso;
}

function message(text: string, icon: string): UINode {
  return {
    type: "vstack", spacing: 12, children: [
      { type: "card", align: "center", spacing: 10, padding: 20, children: [
        { type: "icon", icon: icon, size: 34, color: "secondary", label: "Weather status" },
        { type: "text", text: text, style: "secondary", align: "center", label: text },
      ] },
      { type: "hstack", children: [
        { type: "spacer" },
        { type: "button", id: "retry", text: "Retry", icon: "arrow.clockwise", label: "Retry weather lookup", command: "refresh-weather" },
      ] },
    ],
  };
}

function stat(icon: string, value: string, caption: string): UINode {
  return {
    type: "card", align: "center", spacing: 4, padding: 10, children: [
      { type: "icon", icon: icon, size: 15, color: "secondary" },
      { type: "text", text: value, weight: "semibold", size: 14, align: "center", label: caption + " " + value },
      { type: "text", text: caption, style: "secondary", size: 10, align: "center" },
    ],
  };
}

async function readString(key: string, fallback: string): Promise<string> {
  const value = await settings.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

async function fail(text: string, icon: string): Promise<void> {
  await ui.setPanel("weather", message(text, icon));
  await ui.setStatusText("temp", "");
}

async function render(): Promise<void> {
  const city = await readString("city", "Austin");
  const units = await readString("units", "fahrenheit");
  const metric = units === "celsius";
  const speed = metric ? "km/h" : "mph";

  const geo = await net.fetch({ url: GEOCODE + encodeURIComponent(city), method: "GET" });
  if (geo.status !== 200) return await fail("geocoding failed (" + geo.status + ")", "wifi.exclamationmark");
  const places = JSON.parse(geo.body).results;
  if (!places || places.length === 0) return await fail("cant find a city called " + city, "mappin.slash");
  const place = places[0];

  const url = FORECAST + "&latitude=" + place.latitude + "&longitude=" + place.longitude +
    "&temperature_unit=" + (metric ? "celsius" : "fahrenheit") +
    "&wind_speed_unit=" + (metric ? "kmh" : "mph");
  const wx = await net.fetch({ url, method: "GET" });
  if (wx.status !== 200) return await fail("forecast failed (" + wx.status + ")", "wifi.exclamationmark");
  const data = JSON.parse(wx.body);
  const now = data.current;
  const daily = data.daily;

  const current = sky(now.weather_code);
  const night = now.is_day === 0;
  const temp = Math.round(now.temperature_2m) + "°";
  const region = [place.admin1, place.country].filter((part: unknown) => typeof part === "string" && part.length > 0).join(", ");

  const rows: UINode[] = [];
  for (let i = 0; i < daily.time.length; i++) {
    const day = sky(daily.weather_code[i]);
    const rain = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null;
    const name = dayName(daily.time[i], i);
    const high = Math.round(daily.temperature_2m_max[i]) + "°";
    const low = Math.round(daily.temperature_2m_min[i]) + "°";
    if (i > 0) rows.push({ type: "divider" });
    rows.push({
      type: "hstack", spacing: 8, children: [
        { type: "icon", icon: day.icon, size: 15, color: day.color, label: day.text },
        { type: "text", text: name, weight: i === 0 ? "semibold" : "regular", label: name + ", " + day.text + ", high " + high + ", low " + low },
        { type: "spacer" },
        { type: "text", text: typeof rain === "number" && rain >= 20 ? rain + "%" : "", style: "secondary", size: 11, color: "accent" },
        { type: "text", text: high, weight: "semibold" },
        { type: "text", text: low, style: "secondary" },
      ],
    });
  }

  const stamp = new Date();
  const minutes = stamp.getMinutes();
  const updated = "updated " + stamp.getHours() + ":" + (minutes < 10 ? "0" + minutes : "" + minutes);

  await ui.setPanel("weather", {
    type: "vstack", spacing: 12, children: [
      { type: "card", tinted: true, color: current.color === "secondary" || current.color === "primary" ? "accent" : current.color, padding: 16, spacing: 2, children: [
        { type: "hstack", spacing: 12, children: [
          { type: "icon", icon: night && current.night ? current.night : current.icon, size: 40, color: current.color, label: current.text },
          { type: "vstack", spacing: 0, children: [
            { type: "text", text: temp, size: 38, weight: "bold", label: "Temperature " + temp },
            { type: "text", text: current.text, style: "secondary", label: "Conditions " + current.text },
          ] },
          { type: "spacer" },
        ] },
        { type: "text", text: place.name, style: "title", label: "Location " + place.name },
        { type: "text", text: region, style: "secondary", size: 11 },
      ] },
      { type: "hstack", spacing: 8, children: [
        stat("thermometer.medium", Math.round(now.apparent_temperature) + "°", "feels like"),
        stat("humidity.fill", now.relative_humidity_2m + "%", "humidity"),
        stat("wind", Math.round(now.wind_speed_10m) + "", speed),
      ] },
      { type: "card", spacing: 8, padding: 12, children: rows },
      { type: "hstack", children: [
        { type: "text", text: updated, style: "secondary", size: 11, label: updated },
        { type: "spacer" },
        { type: "button", id: "refresh", text: "Refresh", icon: "arrow.clockwise", label: "Refresh weather", command: "refresh-weather" },
      ] },
    ],
  });
  await ui.setStatusText("temp", current.glyph + " " + temp + (metric ? "C" : "F"));
}

async function safeRender(): Promise<string | undefined> {
  try {
    await render();
    return undefined;
  } catch (error) {
    await fail("couldnt reach the weather service", "wifi.exclamationmark");
    return "weather lookup failed";
  }
}

export const activate: ActivateHandler = async (context, input) => {
  await safeRender();
};

export const refreshWeather: CommandRunHandler = async (context, input) => {
  if (input.commandId === "open-weather") await ui.showPanel("weather");
  const failure = await safeRender();
  return failure ? { message: failure } : {};
};

export const settingsChanged: SettingsChangedHandler = async (context, input) => {
  await safeRender();
};
