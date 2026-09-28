/**
 * Real Location Permission & Geolocation Service for Alya Assistant
 * Handles OS and Browser permission state checking, precise coordinate acquisition via GPS/Network,
 * reverse geocoding to human-readable locality/region, and session context management.
 */

export type LocationPermissionState = 'granted' | 'denied' | 'prompt' | 'disabled' | 'unsupported';
export type LocationAccuracyType = 'precise' | 'approximate' | 'cached' | 'user_provided' | 'unknown';

export interface LocationContext {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  timestamp: number;
  locality?: string;  // e.g. "Dhanmondi", "Kolkata", "Manhattan"
  region?: string;    // e.g. "Dhaka Division", "West Bengal", "New York"
  country?: string;   // e.g. "Bangladesh", "India", "United States"
  formattedAddress?: string;
  source: 'gps' | 'network' | 'user_provided' | 'cached';
  accuracyType: LocationAccuracyType;
}

export interface LocationResult {
  success: boolean;
  permissionState: LocationPermissionState;
  context?: LocationContext;
  error?: string;
  errorDetails?: string;
}

class LocationServiceImpl {
  private lastKnownContext: LocationContext | null = null;

  /**
   * Safe human-readable name protecting raw coordinate privacy
   */
  public formatSafeLocationName(context?: LocationContext | null): string {
    if (!context) return '';
    if (context.locality && context.country) {
      return context.region ? `${context.locality}, ${context.region}, ${context.country}` : `${context.locality}, ${context.country}`;
    }
    if (context.locality) return context.locality;
    if (context.formattedAddress) return context.formattedAddress;
    return 'Your area';
  }

  /**
   * Has user previously dismissed the location explanation prompt?
   */
  public hasDismissedPrompt(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('alya_location_prompt_dismissed') === 'true';
  }

  public setDismissedPrompt(dismissed: boolean): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('alya_location_prompt_dismissed', dismissed ? 'true' : 'false');
    }
  }

  /**
   * Check browser or device location permission status without prompting
   */
  public async checkPermissionState(): Promise<LocationPermissionState> {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return 'unsupported';
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as any });
        if (result.state === 'granted') return 'granted';
        if (result.state === 'denied') return 'denied';
        if (result.state === 'prompt') return 'prompt';
      } catch {
        // Fallthrough if permission query fails
      }
    }

    return 'prompt';
  }

  /**
   * Acquire precise current location using real Geolocation API
   */
  public async getCurrentLocation(timeoutMs: number = 8000): Promise<LocationResult> {
    const permState = await this.checkPermissionState();
    if (permState === 'unsupported') {
      return {
        success: false,
        permissionState: 'unsupported',
        error: 'Geolocation is not supported in this environment.'
      };
    }

    return new Promise((resolve) => {
      const options: PositionOptions = {
        enableHighAccuracy: true, // Use GPS when available
        timeout: timeoutMs,
        maximumAge: 60000 // Accept positions up to 1 min old for speed
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          const accuracyType: LocationAccuracyType = accuracy <= 100 ? 'precise' : 'approximate';

          // Reverse geocode coordinates
          const geoInfo = await this.reverseGeocode(lat, lon);

          const context: LocationContext = {
            latitude: lat,
            longitude: lon,
            accuracy,
            timestamp: position.timestamp,
            locality: geoInfo.locality,
            region: geoInfo.region,
            country: geoInfo.country,
            formattedAddress: geoInfo.formattedAddress,
            source: 'gps',
            accuracyType
          };

          this.lastKnownContext = context;

          resolve({
            success: true,
            permissionState: 'granted',
            context
          });
        },
        (err) => {
          let state: LocationPermissionState = 'denied';
          let userMsg = 'Location request failed.';

          if (err.code === err.PERMISSION_DENIED) {
            state = 'denied';
            userMsg = 'Location permission is currently disabled or denied by user.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            state = 'disabled';
            userMsg = 'Device location services appear to be disabled or position is unavailable.';
          } else if (err.code === err.TIMEOUT) {
            state = 'prompt';
            userMsg = 'Location request timed out while acquiring GPS fix.';
          }

          resolve({
            success: false,
            permissionState: state,
            error: userMsg,
            errorDetails: err.message
          });
        },
        options
      );
    });
  }

  /**
   * Reverse geocode latitude/longitude into locality, region, and country
   * Using BigDataCloud / OpenStreetMap Nominatim reverse geocoding (free, reliable API)
   */
  public async reverseGeocode(lat: number, lon: number): Promise<{
    locality?: string;
    region?: string;
    country?: string;
    formattedAddress?: string;
  }> {
    try {
      // BigDataCloud reverse geocoding API (Free client-side reverse geocoder)
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
        { signal: AbortSignal.timeout(4000) }
      );

      if (res.ok) {
        const data = await res.json();
        const locality = data.locality || data.city || data.localityInfo?.administrative?.[2]?.name || data.localityInfo?.informative?.[0]?.name;
        const region = data.principalSubdivision || data.localityInfo?.administrative?.[1]?.name;
        const country = data.countryName;

        const parts = [locality, region, country].filter(Boolean);
        const formattedAddress = parts.join(', ');

        return { locality, region, country, formattedAddress };
      }
    } catch {
      // Fallback: try Nominatim OpenStreetMap
      try {
        const res2 = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
          {
            headers: { 'User-Agent': 'AlyaAssistant/1.0' },
            signal: AbortSignal.timeout(4000)
          }
        );
        if (res2.ok) {
          const data2 = await res2.json();
          const addr = data2.address || {};
          const locality = addr.city || addr.town || addr.village || addr.suburb || addr.county;
          const region = addr.state || addr.region;
          const country = addr.country;
          return { locality, region, country, formattedAddress: data2.display_name };
        }
      } catch {
        // Ignore fallback errors
      }
    }

    return {};
  }

  /**
   * Get cached last known location if recent (< 10 minutes)
   */
  public getLastKnownLocation(): LocationContext | null {
    if (!this.lastKnownContext) return null;
    const isRecent = (Date.now() - this.lastKnownContext.timestamp) < (10 * 60 * 1000);
    return isRecent ? this.lastKnownContext : null;
  }

  /**
   * Location preference: 'auto' (try GPS/browser), 'manual' (use configured city), 'disabled' (privacy mode)
   */
  public getPermissionPreference(): 'auto' | 'manual' | 'disabled' {
    if (typeof localStorage === 'undefined') return 'auto';
    return (localStorage.getItem('alya_location_preference') as any) || 'auto';
  }

  public setPermissionPreference(pref: 'auto' | 'manual' | 'disabled'): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('alya_location_preference', pref);
    }
  }

  public getManualCity(): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('alya_manual_city') || '';
  }

  public setManualCity(city: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('alya_manual_city', city.trim());
      if (city.trim()) {
        this.setUserLocationContext(city.trim());
      }
    }
  }

  /**
   * Set user-provided manual location context (e.g. "Tokyo", "London")
   */
  public setUserLocationContext(locality: string, region?: string, country?: string, lat: number = 0, lon: number = 0): LocationContext {
    const context: LocationContext = {
      latitude: lat,
      longitude: lon,
      accuracy: 1000,
      timestamp: Date.now(),
      locality,
      region,
      country,
      formattedAddress: [locality, region, country].filter(Boolean).join(', '),
      source: 'user_provided',
      accuracyType: 'user_provided'
    };
    this.lastKnownContext = context;
    return context;
  }
}

export const locationService = new LocationServiceImpl();
