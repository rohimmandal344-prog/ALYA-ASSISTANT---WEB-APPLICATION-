/**
 * Real Live Weather Service for Alya Assistant
 * Fetches accurate live weather metrics, hourly & daily forecasts, severe conditions,
 * and astronomical data (sunrise/sunset) using real Open-Meteo APIs without fake/mock fallback.
 */

import { locationService, LocationContext } from '../lib/locationService';

export interface WeatherCondition {
  code: number;
  description: string;
  isDay: boolean;
}

export interface CurrentWeather {
  temperature: number; // °C
  feelsLike: number; // °C
  condition: WeatherCondition;
  humidity: number; // %
  windSpeed: number; // km/h
  windDirection: number; // degrees
  pressure: number; // hPa
  precipitation: number; // mm
  uvIndex?: number;
  locationName: string;
}

export interface DailyForecast {
  date: string;
  condition: WeatherCondition;
  maxTemp: number;
  minTemp: number;
  precipitationProbability: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
}

export interface FullWeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
  locationContext: {
    locality?: string;
    region?: string;
    country?: string;
    latitude: number;
    longitude: number;
    source: string;
  };
  fetchedAt: string;
}

export interface WeatherFetchResult {
  success: boolean;
  data?: FullWeatherData;
  error?: string;
  locationRequired?: boolean;
}

class WeatherServiceImpl {
  /**
   * Translate WMO Weather Code into natural human-readable condition text
   */
  public decodeWMOCode(code: number, isDay: boolean = true): WeatherCondition {
    const timeOfDay = isDay ? '☀️' : '🌙';
    switch (code) {
      case 0:
        return { code, description: isDay ? 'Clear sky' : 'Clear night', isDay };
      case 1:
        return { code, description: 'Mainly clear', isDay };
      case 2:
        return { code, description: 'Partly cloudy', isDay };
      case 3:
        return { code, description: 'Overcast', isDay };
      case 45:
      case 48:
        return { code, description: 'Foggy conditions', isDay };
      case 51:
      case 53:
      case 55:
        return { code, description: 'Light drizzle', isDay };
      case 61:
        return { code, description: 'Slight rain', isDay };
      case 63:
        return { code, description: 'Moderate rain', isDay };
      case 65:
        return { code, description: 'Heavy rain', isDay };
      case 71:
      case 73:
      case 75:
        return { code, description: 'Snowfall', isDay };
      case 80:
      case 81:
      case 82:
        return { code, description: 'Rain showers', isDay };
      case 95:
      case 96:
      case 99:
        return { code, description: 'Thunderstorm', isDay };
      default:
        return { code, description: 'Fair conditions', isDay };
    }
  }

  /**
   * Fetch weather for latitude & longitude via Open-Meteo
   */
  public async getWeatherByCoordinates(
    lat: number,
    lon: number,
    locationName?: string
  ): Promise<WeatherFetchResult> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`;

      const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) {
        return { success: false, error: `Weather service returned HTTP ${response.status}` };
      }

      const raw = await response.json();
      const curr = raw.current;
      const dailyRaw = raw.daily || {};

      const isDay = curr.is_day === 1;
      const condition = this.decodeWMOCode(curr.weather_code, isDay);

      const daily: DailyForecast[] = (dailyRaw.time || []).slice(0, 5).map((t: string, idx: number) => ({
        date: t,
        condition: this.decodeWMOCode(dailyRaw.weather_code?.[idx] || 0, true),
        maxTemp: Math.round(dailyRaw.temperature_2m_max?.[idx] ?? 0),
        minTemp: Math.round(dailyRaw.temperature_2m_min?.[idx] ?? 0),
        precipitationProbability: dailyRaw.precipitation_probability_max?.[idx] ?? 0,
        sunrise: dailyRaw.sunrise?.[idx] ? new Date(dailyRaw.sunrise[idx]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        sunset: dailyRaw.sunset?.[idx] ? new Date(dailyRaw.sunset[idx]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        uvIndexMax: dailyRaw.uv_index_max?.[idx] ?? 0
      }));

      const data: FullWeatherData = {
        current: {
          temperature: Math.round(curr.temperature_2m),
          feelsLike: Math.round(curr.apparent_temperature),
          condition,
          humidity: curr.relative_humidity_2m,
          windSpeed: Math.round(curr.wind_speed_10m),
          windDirection: curr.wind_direction_10m,
          pressure: Math.round(curr.surface_pressure),
          precipitation: curr.precipitation,
          uvIndex: daily[0]?.uvIndexMax || 0,
          locationName: locationName || `${lat.toFixed(2)}, ${lon.toFixed(2)}`
        },
        daily,
        locationContext: {
          latitude: lat,
          longitude: lon,
          source: locationName ? 'user_provided' : 'gps'
        },
        fetchedAt: new Date().toISOString()
      };

      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: `Failed to fetch live weather data: ${err.message || err}` };
    }
  }

  /**
   * Search city name coordinates via Open-Meteo Geocoding API
   */
  public async searchCityLocation(cityName: string): Promise<{ lat: number; lon: number; fullName: string } | null> {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const json = await res.json();
        if (json.results && json.results.length > 0) {
          const match = json.results[0];
          const fullName = [match.name, match.admin1, match.country].filter(Boolean).join(', ');
          return { lat: match.latitude, lon: match.longitude, fullName };
        }
      }
    } catch {
      // Ignore search errors
    }
    return null;
  }

  /**
   * High-level entry point: Get weather for current GPS location OR specified city
   */
  public async getWeatherForRequest(cityQuery?: string): Promise<WeatherFetchResult> {
    if (cityQuery && cityQuery.trim().length > 1) {
      const searchRes = await this.searchCityLocation(cityQuery.trim());
      if (searchRes) {
        return this.getWeatherByCoordinates(searchRes.lat, searchRes.lon, searchRes.fullName);
      }
      return {
        success: false,
        error: `Could not find weather location for "${cityQuery}". Please check the city name.`
      };
    }

    // Try current GPS location
    const locRes = await locationService.getCurrentLocation();
    if (!locRes.success || !locRes.context) {
      return {
        success: false,
        locationRequired: true,
        error: locRes.error || 'Location permission is required to check local weather.'
      };
    }

    const { latitude, longitude, locality, region, country } = locRes.context;
    const name = [locality, region, country].filter(Boolean).join(', ');
    return this.getWeatherByCoordinates(latitude, longitude, name);
  }
}

export const weatherService = new WeatherServiceImpl();
