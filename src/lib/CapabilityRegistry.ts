/**
 * Capability Registry for Alya Assistant
 * Defines structured schemas, metadata, required permissions, parameter validation,
 * and natural language intent matching for all device control execution tools.
 */

export type CapabilityCategory = 'light' | 'fan' | 'ac' | 'tv' | 'plug' | 'room' | 'query' | 'location' | 'weather' | 'news' | 'android_companion';
export type PlatformTarget = 'server' | 'web' | 'android';

export interface CapabilityParameter {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  min?: number;
  max?: number;
  enumValues?: string[];
}

export interface CapabilityDefinition {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  toolId: string;
  supportedPlatforms: PlatformTarget[];
  requiredPermission?: string;
  isHazardous?: boolean;
  intentKeywords: {
    english: string[];
    bengali: string[];
    banglish: string[];
    hindi: string[];
  };
  parameters: Record<string, CapabilityParameter>;
}

export class CapabilityRegistry {
  private static instance: CapabilityRegistry | null = null;
  private capabilities: Map<string, CapabilityDefinition> = new Map();

  private constructor() {
    this.registerBuiltInCapabilities();
  }

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  /**
   * Register all default hardware and smart home capabilities
   */
  private registerBuiltInCapabilities(): void {
    const list: CapabilityDefinition[] = [
      {
        id: 'cap_smart_light',
        name: 'Smart Light Power & Level',
        category: 'light',
        description: 'Control state, brightness level (0-100%), and color temperature of smart lights.',
        toolId: 'smart_light_control',
        supportedPlatforms: ['server', 'web', 'android'],
        intentKeywords: {
          english: ['light', 'lamp', 'bulb', 'dim', 'brighten', 'warm white', 'daylight'],
          bengali: ['লাইট', 'বাতি', 'আলো', 'উজ্জ্বলতা'],
          banglish: ['light', 'alo', 'batti', 'jwalao', 'bondho', 'brightness', 'komao', 'barhao'],
          hindi: ['लाइट', 'बत्ती', 'रोशनी', 'जलाओ', 'बंद करो']
        },
        parameters: {
          room: { type: 'string', description: 'Target room (Bedroom, Living Room, Kitchen, etc.)' },
          action: { type: 'string', description: 'turn_on | turn_off | set_brightness | set_color', required: true },
          brightness: { type: 'number', description: 'Brightness percentage 0-100', min: 0, max: 100 },
          color: { type: 'string', description: 'Color name (Warm White, Daylight, Cool White, Blue, Amber)' }
        }
      },
      {
        id: 'cap_smart_fan',
        name: 'Smart Ceiling Fan Control',
        category: 'fan',
        description: 'Turn on/off, adjust fan speed level (1 to 5), and toggle oscillation.',
        toolId: 'smart_fan_control',
        supportedPlatforms: ['server', 'web', 'android'],
        intentKeywords: {
          english: ['fan', 'speed', 'ceiling fan', 'cooler', 'breeze'],
          bengali: ['ফ্যান', 'পাখা', 'স্পিড'],
          banglish: ['fan', 'pakha', 'speed', 'bariye', 'komao', 'chalao'],
          hindi: ['पंखा', 'स्पीड', 'चलाओ']
        },
        parameters: {
          room: { type: 'string', description: 'Target room' },
          action: { type: 'string', description: 'turn_on | turn_off | set_speed', required: true },
          speed: { type: 'number', description: 'Fan speed level 1-5', min: 1, max: 5 }
        }
      },
      {
        id: 'cap_smart_ac',
        name: 'Smart Air Conditioner Thermostat',
        category: 'ac',
        description: 'Set temperature (16-30°C) and mode (cool, fan, dry, eco) for AC units.',
        toolId: 'smart_ac_control',
        supportedPlatforms: ['server', 'web', 'android'],
        intentKeywords: {
          english: ['ac', 'air conditioner', 'temperature', 'cooling', 'cool', 'thermostat'],
          bengali: ['এসি', 'তাপমাত্রা', 'ঠান্ডা'],
          banglish: ['ac', 'thanda', 'temperature', 'degree', 'degree-e', 'cool'],
          hindi: ['एसी', 'तापमान', 'ठंडा']
        },
        parameters: {
          room: { type: 'string', description: 'Target room' },
          action: { type: 'string', description: 'turn_on | turn_off | set_temperature | set_mode', required: true },
          temperature: { type: 'number', description: 'Target degrees Celsius', min: 16, max: 30 },
          mode: { type: 'string', description: 'cool | fan | dry | eco', enumValues: ['cool', 'fan', 'dry', 'eco'] }
        }
      },
      {
        id: 'cap_smart_tv',
        name: 'Smart TV Control',
        category: 'tv',
        description: 'Control power, volume percentage, and muting for Smart TVs.',
        toolId: 'smart_tv_control',
        supportedPlatforms: ['server', 'web', 'android'],
        intentKeywords: {
          english: ['tv', 'television', 'volume', 'mute', 'channel'],
          bengali: ['টিভি', 'টেলিভিশন', 'শব্দ'],
          banglish: ['tv', 'television', 'volume', 'mute', 'sound'],
          hindi: ['टीवी', 'टेलीविज़न', 'आवाज़']
        },
        parameters: {
          room: { type: 'string', description: 'Target room' },
          action: { type: 'string', description: 'turn_on | turn_off | set_volume | toggle_mute', required: true },
          volume: { type: 'number', description: 'Volume level 0-100', min: 0, max: 100 }
        }
      },
      {
        id: 'cap_smart_plug',
        name: 'Smart Plug Relay',
        category: 'plug',
        description: 'Power appliances on or off via smart plugs (coffee maker, water heater/geyser).',
        toolId: 'smart_plug_control',
        supportedPlatforms: ['server', 'web', 'android'],
        isHazardous: true,
        intentKeywords: {
          english: ['plug', 'outlet', 'geyser', 'water heater', 'coffee maker', 'heater'],
          bengali: ['প্লাগ', 'গিজার', 'ওয়াটার হিটার', 'কফি মেকার'],
          banglish: ['plug', 'geyser', 'water heater', 'coffee maker', 'heater'],
          hindi: ['प्लग', 'गीज़र', 'हीटर']
        },
        parameters: {
          name: { type: 'string', description: 'Plug appliance name' },
          action: { type: 'string', description: 'turn_on | turn_off', required: true }
        }
      },
      {
        id: 'cap_room_control',
        name: 'Room Group Master Switch',
        category: 'room',
        description: 'Master control for all devices or lights in a specific room.',
        toolId: 'smart_room_control',
        supportedPlatforms: ['server', 'web', 'android'],
        intentKeywords: {
          english: ['all lights', 'everything', 'entire room', 'turn off all', 'all devices'],
          bengali: ['সব লাইট', 'সব কিছু', 'পুরো রুম'],
          banglish: ['shob light', 'shob bondho', 'sab band', 'shob chalu'],
          hindi: ['सब लाइट', 'सब बंद', 'सब चालू']
        },
        parameters: {
          room: { type: 'string', description: 'Target room', required: true },
          action: { type: 'string', description: 'turn_on | turn_off', required: true },
          targetType: { type: 'string', description: 'all | light | fan | ac | plug' }
        }
      },
      {
        id: 'cap_smart_query',
        name: 'Smart Device Telemetry Query',
        category: 'query',
        description: 'Check current power state, temperature, brightness, or active devices.',
        toolId: 'smart_device_query',
        supportedPlatforms: ['server', 'web', 'android'],
        intentKeywords: {
          english: ['is my', 'status', 'temperature', 'running', 'check', 'current'],
          bengali: ['কি অন', 'স্ট্যাটাস', 'তাপমাত্রা কত'],
          banglish: ['ki on', 'status', 'koto', 'cholche', 'bondho ache'],
          hindi: ['क्या ऑन है', 'स्टेटस', 'कितना है']
        },
        parameters: {
          room: { type: 'string', description: 'Optional room filter' },
          deviceType: { type: 'string', description: 'light | fan | ac | tv | plug' }
        }
      },
      {
        id: 'cap_location',
        name: 'GPS / Locality Location Service',
        category: 'location',
        description: 'Detect user current locality, coordinates, and area when authorized.',
        toolId: 'get_current_location',
        supportedPlatforms: ['server', 'web', 'android'],
        requiredPermission: 'ACCESS_FINE_LOCATION',
        intentKeywords: {
          english: ['my location', 'where am i', 'current location', 'my area', 'locality'],
          bengali: ['আমার লোকেশন', 'আমি কোথায়', 'আমার এলাকা'],
          banglish: ['amar location', 'ami kothay', 'amar elaka', 'kothay achi'],
          hindi: ['मेरी लोकेशन', 'मैं कहाँ हूँ', 'मेरा इलाका']
        },
        parameters: {}
      },
      {
        id: 'cap_real_weather',
        name: 'Real Location Weather Service',
        category: 'weather',
        description: 'Get live temperature, precipitation, wind, UV index, and forecasts for user location or city.',
        toolId: 'get_real_weather',
        supportedPlatforms: ['server', 'web', 'android'],
        requiredPermission: 'ACCESS_FINE_LOCATION',
        intentKeywords: {
          english: ['weather', 'forecast', 'rain', 'temperature here', 'how hot is it', 'will it rain', 'weather here', 'near me weather'],
          bengali: ['আবহাওয়া', 'বৃষ্টি হবে', 'তাপমাত্রা কত', 'পূর্বাভাস'],
          banglish: ['abohawa', 'weather', 'brishti hobe', 'forecast', 'temperature', 'thanda', 'gorom koto'],
          hindi: ['मौसम', 'बारिश होगी', 'तापमान', 'मौसम कैसा है']
        },
        parameters: {
          location: { type: 'string', description: 'City name if explicitly requested' }
        }
      },
      {
        id: 'cap_local_news',
        name: 'Local & Regional News Provider',
        category: 'news',
        description: 'Fetch real current local headlines and safety updates for user locality/area.',
        toolId: 'get_local_news',
        supportedPlatforms: ['server', 'web', 'android'],
        requiredPermission: 'ACCESS_FINE_LOCATION',
        intentKeywords: {
          english: ['news near me', 'local news', 'happening around me', 'what is happening in my area', 'latest around here'],
          bengali: ['আশেপাশের খবর', 'স্থানীয় সংবাদ', 'আমার এলাকার খবর'],
          banglish: ['news near me', 'kabor', 'khobor', 'amar elakar khobor', 'asche pacher khobor'],
          hindi: ['पास की खबरें', 'स्थानीय समाचार', 'आसपास क्या हो रहा है']
        },
        parameters: {
          query: { type: 'string', description: 'Search topic or area' }
        }
      },
      {
        id: 'cap_android_torch',
        name: 'Android Torch Flashlight',
        category: 'android_companion',
        description: 'Turn Android phone camera torch on or off.',
        toolId: 'device_flashlight',
        supportedPlatforms: ['android'],
        requiredPermission: 'CAMERA',
        intentKeywords: {
          english: ['flashlight', 'torch', 'flash'],
          bengali: ['ফ্ল্যাশলাইট', 'টর্চ'],
          banglish: ['flashlight', 'torch'],
          hindi: ['टॉर्च', 'फ्लैशलाइट']
        },
        parameters: {
          state: { type: 'boolean', description: 'true to turn on, false to turn off', required: true }
        }
      },
      {
        id: 'cap_android_volume',
        name: 'Android Audio Stream Volume',
        category: 'android_companion',
        description: 'Set Android media audio stream volume percentage.',
        toolId: 'device_volume',
        supportedPlatforms: ['android'],
        requiredPermission: 'AUDIO_SETTINGS',
        intentKeywords: {
          english: ['volume', 'sound level', 'phone volume'],
          bengali: ['ভলিউম', 'শব্দ'],
          banglish: ['volume', 'sound'],
          hindi: ['वॉल्यूम', 'आवाज़']
        },
        parameters: {
          level: { type: 'number', description: 'Volume 0-100', required: true, min: 0, max: 100 }
        }
      }
    ];

    for (const cap of list) {
      this.capabilities.set(cap.id, cap);
    }
  }

  /**
   * Get all registered capabilities
   */
  public getCapabilities(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Find capability by ID
   */
  public getCapability(id: string): CapabilityDefinition | undefined {
    return this.capabilities.get(id);
  }

  /**
   * Match user text against capability intent keywords
   */
  public findCapabilityForIntent(text: string): CapabilityDefinition | null {
    const lower = text.toLowerCase();

    for (const cap of this.capabilities.values()) {
      const allKeywords = [
        ...cap.intentKeywords.english,
        ...cap.intentKeywords.bengali,
        ...cap.intentKeywords.banglish,
        ...cap.intentKeywords.hindi
      ];

      if (allKeywords.some(kw => lower.includes(kw.toLowerCase()))) {
        return cap;
      }
    }

    return null;
  }

  /**
   * Validate parameters for a capability
   */
  public validateParameters(capabilityId: string, params: Record<string, any>): { valid: boolean; error?: string } {
    const cap = this.getCapability(capabilityId);
    if (!cap) {
      return { valid: false, error: `Capability [${capabilityId}] not found.` };
    }

    for (const [key, schema] of Object.entries(cap.parameters)) {
      const val = params[key];

      if (schema.required && (val === undefined || val === null || val === '')) {
        return { valid: false, error: `Missing required parameter [${key}] for ${cap.name}.` };
      }

      if (val !== undefined && val !== null) {
        if (schema.type === 'number') {
          const num = Number(val);
          if (isNaN(num)) return { valid: false, error: `Parameter [${key}] must be a valid number.` };
          if (schema.min !== undefined && num < schema.min) return { valid: false, error: `[${key}] must be >= ${schema.min}.` };
          if (schema.max !== undefined && num > schema.max) return { valid: false, error: `[${key}] must be <= ${schema.max}.` };
        }

        if (schema.enumValues && !schema.enumValues.includes(String(val))) {
          return { valid: false, error: `[${key}] must be one of: ${schema.enumValues.join(', ')}.` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Filter capabilities supported on a platform
   */
  public getCapabilitiesByPlatform(platform: PlatformTarget): CapabilityDefinition[] {
    return this.getCapabilities().filter(cap => cap.supportedPlatforms.includes(platform));
  }
}

export const capabilityRegistry = CapabilityRegistry.getInstance();
