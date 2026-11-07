import { net, settings, ui } from "betterfinder";
import type { ActivateHandler, CommandRunHandler, SettingsChangedHandler, UINode } from "betterfinder";

const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=";
const FORECAST = "https://api.open-meteo.com/v1/forecast?timezone=auto&forecast_days=3&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code";

const SKY: Record<number, string> = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "foggy",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  56: "freezing drizzle", 57: "freezing drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain",
  66: "freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "rain showers", 81: "rain showers", 82: "violent showers",
  85: "snow showers", 86: "snow showers",
  95: "thunderstorm", 96: "thunderstorm w hail", 99: "thunderstorm w hail",
};

const sky = (code: number): string => SKY[code] ?? "weird";

const message = (text: string): UINode => ({
  type: "vstack",
  children: [
    { type: "text", text, label: "Weather status" },
    { type: "button", text: "Retry", label: "Retry weather lookup", command: "refresh-weather" },
  ],
});

async function readString(key: string, fallback: string): Promise<string> {
  const value = await settings.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

async function render(): Promise<void> {
  const city = await readString("city", "Austin");
  const units = await readString("units", "fahrenheit");
  const metric = units === "celsius";
  const deg = metric ? "C" : "F";
  const speed = metric ? "km/h" : "mph";

  await ui.setPanel("weather", message("checking the sky..."));

  const geo = await net.fetch({ url: GEOCODE + encodeURIComponent(city), method: "GET" });
  if (geo.status !== 200) {
    await ui.setPanel("weather", message("geocoding failed (" + geo.status + ")"));
    return;
  }
  const places = JSON.parse(geo.body).results;
  if (!places || places.length === 0) {
    await ui.setPanel("weather", message("cant find a city called " + city));
    return;
  }
  const place = places[0];

  const url = FORECAST + "&latitude=" + place.latitude + "&longitude=" + place.longitude +
    "&temperature_unit=" + (metric ? "celsius" : "fahrenheit") +
    "&wind_speed_unit=" + (metric ? "kmh" : "mph");
  const wx = await net.fetch({ url, method: "GET" });
  if (wx.status !== 200) {
    await ui.setPanel("weather", message("forecast failed (" + wx.status + ")"));
    return;
  }
  const data = JSON.parse(wx.body);
  const now = data.current;
  const daily = data.daily;

  const where = [place.name, place.admin1, place.country].filter((part: unknown) => typeof part === "string" && part.length > 0).join(", ");
  const days = [];
  for (let i = 0; i < daily.time.length; i++) {
    days.push({
      id: "day" + i,
      title: daily.time[i] + "  " + Math.round(daily.temperature_2m_max[i]) + "/" + Math.round(daily.temperature_2m_min[i]) + deg,
      subtitle: sky(daily.weather_code[i]),
    });
  }

  await ui.setPanel("weather", {
    type: "vstack",
    children: [
      { type: "text", text: where, label: "Location" },
      { type: "text", text: Math.round(now.temperature_2m) + deg + "  " + sky(now.weather_code), label: "Current conditions" },
      { type: "text", text: "feels like " + Math.round(now.apparent_temperature) + deg + ", " + now.relative_humidity_2m + "% humidity, wind " + Math.round(now.wind_speed_10m) + " " + speed, label: "Details" },
      { type: "divider" },
      { type: "list", items: days, label: "Three day forecast" },
      { type: "button", text: "Refresh", label: "Refresh weather", command: "refresh-weather" },
    ],
  });
}

async function safeRender(): Promise<string | undefined> {
  try {
    await render();
    return undefined;
  } catch (error) {
    await ui.setPanel("weather", message("couldnt reach the weather service"));
    return "weather lookup failed";
  }
}

export const activate: ActivateHandler = async (context, input) => {
  await safeRender();
};

export const refreshWeather: CommandRunHandler = async (context, input) => {
  const failure = await safeRender();
  return failure ? { message: failure } : { message: "weather refreshed" };
};

export const settingsChanged: SettingsChangedHandler = async (context, input) => {
  await safeRender();
};
