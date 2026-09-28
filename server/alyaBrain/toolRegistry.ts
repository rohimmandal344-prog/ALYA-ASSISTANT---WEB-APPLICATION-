/**
 * Alya Assistant - Tool Registry & Capabilities
 * Centralized registry defining all capabilities, input schemas,
 * platform support, required permissions, and verification logic.
 */

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'device' | 'automation' | 'memory' | 'research' | 'diagnostics';
  requiredPermission: string;
  supportedPlatforms: ('android' | 'web' | 'server')[];
  inputSchema: Record<string, { type: string; description: string; required?: boolean }>;
  verificationMethod: string;
}

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  device_flashlight: {
    id: 'device_flashlight',
    name: 'Flashlight Toggle',
    description: 'Turn the device flashlight torch on or off.',
    category: 'device',
    requiredPermission: 'CAMERA',
    supportedPlatforms: ['android'],
    inputSchema: {
      state: { type: 'boolean', description: 'true to turn on, false to turn off', required: true }
    },
    verificationMethod: 'Query CameraManager torch mode callback state.'
  },
  device_volume: {
    id: 'device_volume',
    name: 'Media Volume Control',
    description: 'Set device media stream volume percentage (0-100).',
    category: 'device',
    requiredPermission: 'AUDIO_SETTINGS',
    supportedPlatforms: ['android'],
    inputSchema: {
      level: { type: 'number', description: 'Volume level from 0 to 100', required: true }
    },
    verificationMethod: 'Query AudioManager.getStreamVolume(STREAM_MUSIC).'
  },
  device_battery: {
    id: 'device_battery',
    name: 'Battery Diagnostics',
    description: 'Retrieve real battery level, charging status, and thermal health.',
    category: 'device',
    requiredPermission: 'NONE',
    supportedPlatforms: ['android', 'web'],
    inputSchema: {},
    verificationMethod: 'Read BatteryManager or Navigator.getBattery API.'
  },
  device_app_launch: {
    id: 'device_app_launch',
    name: 'Launch Application',
    description: 'Open a designated application by package name or common app name.',
    category: 'device',
    requiredPermission: 'ACCESSIBILITY',
    supportedPlatforms: ['android'],
    inputSchema: {
      appName: { type: 'string', description: 'Name of the app (e.g., Camera, WhatsApp, Spotify)', required: true }
    },
    verificationMethod: 'Verify top-resumed ActivityManager window focus.'
  },
  device_app_close: {
    id: 'device_app_close',
    name: 'Close Application',
    description: 'Close a running application or stop a background service.',
    category: 'device',
    requiredPermission: 'ACCESSIBILITY',
    supportedPlatforms: ['android'],
    inputSchema: {
      appName: { type: 'string', description: 'Name of the app to close', required: true }
    },
    verificationMethod: 'Confirm app process termination or move to background via ActivityManager.'
  },
  device_setting_control: {
    id: 'device_setting_control',
    name: 'System Setting Control',
    description: 'Toggle or adjust system settings like Bluetooth, Wi-Fi, Hotspot, and Screen Brightness.',
    category: 'device',
    requiredPermission: 'WRITE_SETTINGS',
    supportedPlatforms: ['android'],
    inputSchema: {
      setting: { type: 'string', description: 'bluetooth | wifi | hotspot | screen_brightness', required: true },
      state: { type: 'boolean', description: 'true for On, false for Off', required: false },
      value: { type: 'number', description: 'Numeric value for settings like brightness', required: false }
    },
    verificationMethod: 'Verify setting change via Settings.System or respective Hardware Manager.'
  },
  get_current_location: {
    id: 'get_current_location',
    name: 'Get Current Location',
    description: 'Retrieve current GPS/Network coordinates and locality name when authorized.',
    category: 'device',
    requiredPermission: 'ACCESS_FINE_LOCATION',
    supportedPlatforms: ['android', 'web', 'server'],
    inputSchema: {},
    verificationMethod: 'Verify active GPS/Network coordinate accuracy and reverse geocode result.'
  },
  get_real_weather: {
    id: 'get_real_weather',
    name: 'Real Weather Service',
    description: 'Fetch real live weather metrics, hourly/daily forecasts, and temperature for user locality or city. Use this for specific weather queries.',
    category: 'research',
    requiredPermission: 'ACCESS_FINE_LOCATION',
    supportedPlatforms: ['android', 'web', 'server'],
    inputSchema: {
      location: { type: 'string', description: 'City or area name (optional if using GPS)', required: false }
    },
    verificationMethod: 'Verify live Open-Meteo weather response payload.'
  },
  web_search: {
    id: 'web_search',
    name: 'Google Web Search',
    description: 'Search the live web for real-time information, news, temperature, or facts that require current internet data beyond the base knowledge.',
    category: 'research',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web'],
    inputSchema: {
      query: { type: 'string', description: 'The search query string', required: true }
    },
    verificationMethod: 'Return live search snippets and grounding results.'
  },
  get_local_news: {
    id: 'get_local_news',
    name: 'Local News Provider',
    description: 'Retrieve real current regional headlines and community safety developments.',
    category: 'research',
    requiredPermission: 'ACCESS_FINE_LOCATION',
    supportedPlatforms: ['android', 'web', 'server'],
    inputSchema: {
      query: { type: 'string', description: 'Area or topic for local news search', required: false }
    },
    verificationMethod: 'Verify RSS XML headline payload integrity.'
  },
  nearby_places: {
    id: 'nearby_places',
    name: 'Nearby Places & POI Finder',
    description: 'Find nearby hospitals, pharmacies, restaurants, shops, parks, and ATMs based on user location.',
    category: 'research',
    requiredPermission: 'ACCESS_COARSE_LOCATION',
    supportedPlatforms: ['android', 'web', 'server'],
    inputSchema: {
      placeType: { type: 'string', description: 'hospital | restaurant | pharmacy | atm | park | bank | shop', required: true },
      query: { type: 'string', description: 'Search term or modifier', required: false }
    },
    verificationMethod: 'Verify live Overpass OSM or Places search results.'
  },
  get_local_time: {
    id: 'get_local_time',
    name: 'Get Local Time & Timezone',
    description: 'Retrieve local time, timezone, sunrise and sunset for user location or specified city.',
    category: 'research',
    requiredPermission: 'NONE',
    supportedPlatforms: ['android', 'web', 'server'],
    inputSchema: {
      location: { type: 'string', description: 'City or area name (optional)', required: false }
    },
    verificationMethod: 'Verify timezone and astronomical time calculation.'
  },
  create_reminder: {
    id: 'create_reminder',
    name: 'Create Reminder / Timer',
    description: 'Schedule a user reminder or countdown alert with title and trigger timestamp.',
    category: 'automation',
    requiredPermission: 'NOTIFICATIONS',
    supportedPlatforms: ['android', 'web', 'server'],
    inputSchema: {
      title: { type: 'string', description: 'Reminder message or task', required: true },
      dueTime: { type: 'string', description: 'ISO time or duration description', required: true }
    },
    verificationMethod: 'Confirm schedule registered in local AlarmManager or Firestore automation collection.'
  },
  memory_store: {
    id: 'memory_store',
    name: 'Store Long-Term Memory',
    description: 'Save user preferences, important facts, or operational preferences.',
    category: 'memory',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web'],
    inputSchema: {
      category: { type: 'string', description: 'preference | fact | device | task', required: true },
      key: { type: 'string', description: 'Identifier or topic', required: true },
      value: { type: 'string', description: 'Information to remember', required: true }
    },
    verificationMethod: 'Verify document write in Firestore memory collection.'
  },
  memory_retrieve: {
    id: 'memory_retrieve',
    name: 'Recall Memory',
    description: 'Query stored facts, user preferences, and contextual history.',
    category: 'memory',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web'],
    inputSchema: {
      query: { type: 'string', description: 'Search keywords or topic to recall', required: true }
    },
    verificationMethod: 'Check retrieval accuracy from structured memory store.'
  },
  update_user_preference: {
    id: 'update_user_preference',
    name: 'Update Permanent User Setting',
    description: 'Permanently update and lock an explicit user preference (language, voice, personality, wake word, cadence, location, offline mode) without affecting other settings.',
    category: 'memory',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web', 'android'],
    inputSchema: {
      settingKey: { type: 'string', description: 'language | personality | cadence | voice | speed | wake_word | location_mode | city | offline_mode', required: true },
      settingValue: { type: 'string', description: 'The new explicit value to lock in permanently', required: true }
    },
    verificationMethod: 'Confirm persistent write to user preferences storage and revision bump.'
  },
  system_diagnostics: {
    id: 'system_diagnostics',
    name: 'Run System Diagnostics',
    description: 'Evaluate latency, WebSocket connectivity, active agents, and device sync.',
    category: 'diagnostics',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web', 'android'],
    inputSchema: {},
    verificationMethod: 'Check heartbeat roundtrip and subsystem status.'
  },
  smart_light_control: {
    id: 'smart_light_control',
    name: 'Smart Light Control',
    description: 'Turn on/off, adjust brightness (0-100%), change colors (Warm White, Cool White, Daylight, Blue, etc.) for smart lights.',
    category: 'device',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web', 'android'],
    inputSchema: {
      room: { type: 'string', description: 'Room name (e.g. Bedroom, Living Room, Kitchen)', required: false },
      action: { type: 'string', description: 'turn_on | turn_off | set_brightness | set_color', required: true },
      brightness: { type: 'number', description: 'Brightness level from 0 to 100', required: false },
      color: { type: 'string', description: 'Color name or temperature (e.g., Warm White, Blue, Daylight)', required: false }
    },
    verificationMethod: 'Confirm state modification in smartDeviceManager and IoT bus.'
  },
  smart_fan_control: {
    id: 'smart_fan_control',
    name: 'Smart Fan Control',
    description: 'Turn on/off, adjust fan speed level (1 to 5), and toggle oscillation for ceiling/standing fans.',
    category: 'device',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web', 'android'],
    inputSchema: {
      room: { type: 'string', description: 'Room name (e.g. Bedroom, Living Room)', required: false },
      action: { type: 'string', description: 'turn_on | turn_off | set_speed', required: true },
      speed: { type: 'number', description: 'Fan speed level 1-5', required: false }
    },
    verificationMethod: 'Verify fan state update in smartDeviceManager.'
  },
  smart_ac_control: {
    id: 'smart_ac_control',
    name: 'Smart Air Conditioner Control',
    description: 'Turn on/off, set temperature (16-30°C), and set operating mode (cool, heat, fan, dry, eco) for ACs.',
    category: 'device',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web', 'android'],
    inputSchema: {
      room: { type: 'string', description: 'Room name (e.g. Bedroom, Living Room)', required: false },
      action: { type: 'string', description: 'turn_on | turn_off | set_temperature | set_mode', required: true },
      temperature: { type: 'number', description: 'Target temperature in Celsius (16-30)', required: false },
      mode: { type: 'string', description: 'cool | heat | fan | dry | eco', required: false }
    },
    verificationMethod: 'Verify thermostat state in smartDeviceManager.'
  },
  smart_tv_control: {
    id: 'smart_tv_control',
    name: 'Smart TV Control',
    description: 'Turn on/off, adjust volume, mute, and change channels for Smart TVs.',
    category: 'device',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web', 'android'],
    inputSchema: {
      room: { type: 'string', description: 'Room name (e.g. Living Room)', required: false },
      action: { type: 'string', description: 'turn_on | turn_off | set_volume | toggle_mute', required: true },
      volume: { type: 'number', description: 'Volume level 0-100', required: false }
    },
    verificationMethod: 'Verify TV telemetry update in smartDeviceManager.'
  },
  smart_plug_control: {
    id: 'smart_plug_control',
    name: 'Smart Plug Control',
    description: 'Turn connected appliances on/off via smart plugs (coffee maker, water heater geyser, desk lamp).',
    category: 'device',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web', 'android'],
    inputSchema: {
      name: { type: 'string', description: 'Plug or appliance name (e.g., Geyser, Coffee Maker)', required: false },
      action: { type: 'string', description: 'turn_on | turn_off', required: true }
    },
    verificationMethod: 'Verify plug power relay state in smartDeviceManager.'
  },
  smart_room_control: {
    id: 'smart_room_control',
    name: 'Room Group Control',
    description: 'Control all smart devices in a specified room (e.g., turn off all lights, turn everything off in Living Room).',
    category: 'device',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web', 'android'],
    inputSchema: {
      room: { type: 'string', description: 'Room name (e.g., Living Room, Bedroom)', required: true },
      action: { type: 'string', description: 'turn_on | turn_off', required: true },
      targetType: { type: 'string', description: 'all | light | fan | ac | plug', required: false }
    },
    verificationMethod: 'Verify multi-device state updates in smartDeviceManager.'
  },
  smart_device_query: {
    id: 'smart_device_query',
    name: 'Query Smart Device Status',
    description: 'Ask for current status, temperature, brightness, or power of any device or room.',
    category: 'device',
    requiredPermission: 'NONE',
    supportedPlatforms: ['server', 'web', 'android'],
    inputSchema: {
      room: { type: 'string', description: 'Optional room filter', required: false },
      deviceType: { type: 'string', description: 'Optional device type filter (light | fan | ac | tv | plug)', required: false }
    },
    verificationMethod: 'Read and format live device telemetry from smartDeviceManager.'
  },
  navigate_view: {
    id: 'navigate_view',
    name: 'App View Navigation',
    description: 'Switch between in-app views such as chat, devices, settings, memory, automations, permissions, testing.',
    category: 'automation',
    requiredPermission: 'NONE',
    supportedPlatforms: ['web', 'android'],
    inputSchema: {
      view: { type: 'string', description: 'chat | devices | settings | memory | automations | permissions | testing', required: true }
    },
    verificationMethod: 'Confirm active view tab change.'
  },
  web_open_url: {
    id: 'web_open_url',
    name: 'Open Web Service / URL',
    description: 'Open a web service or URL in browser (e.g., YouTube, Google, GitHub, Wikipedia).',
    category: 'research',
    requiredPermission: 'NONE',
    supportedPlatforms: ['web', 'android', 'server'],
    inputSchema: {
      url: { type: 'string', description: 'URL to open', required: true },
      title: { type: 'string', description: 'Title or service name', required: false }
    },
    verificationMethod: 'Verify URL launch in browser or web intent.'
  }
};
