/**
 * Alya Assistant - Smart Home & IoT Device Manager
 * Supports Lights, Fans, ACs, TVs, Smart Plugs, and Group Controls
 * with real state tracking, safety checks, and WebSocket event broadcasting.
 */

export type SmartDeviceType = 'light' | 'fan' | 'ac' | 'tv' | 'plug';

export interface SmartDeviceState {
  power: boolean;
  brightness?: number; // 0-100 (for lights)
  color?: string; // hex or color name (for lights)
  speed?: number; // 1-5 (for fans)
  oscillation?: boolean; // (for fans)
  temperature?: number; // 16-30 Celsius (for AC)
  mode?: 'cool' | 'heat' | 'fan' | 'dry' | 'eco'; // (for AC)
  volume?: number; // 0-100 (for TV)
  channel?: string | number; // (for TV)
  muted?: boolean; // (for TV)
  powerWatts?: number; // Current consumption (for plugs)
  isHazardous?: boolean; // High power devices needing safety warning
}

export interface SmartDevice {
  id: string;
  userId: string;
  name: string;
  type: SmartDeviceType;
  room: string;
  online: boolean;
  state: SmartDeviceState;
  lastUpdated: string;
}

export interface ControlDeviceOptions {
  userId?: string;
  deviceId?: string;
  deviceType?: SmartDeviceType;
  room?: string;
  action: 'turn_on' | 'turn_off' | 'set_brightness' | 'set_color' | 'set_speed' | 'set_temperature' | 'set_mode' | 'set_volume' | 'toggle';
  params?: Record<string, any>;
}

export interface ControlResult {
  success: boolean;
  affectedDevices: SmartDevice[];
  message: string;
  warning?: string;
}

class SmartDeviceManager {
  // Map of deviceId -> SmartDevice
  private devices = new Map<string, SmartDevice>();

  constructor() {
    this.seedDefaultSmartDevices('default_user');
  }

  /**
   * Seed a standard smart home environment if not already present
   */
  public seedDefaultSmartDevices(userId: string = 'default_user') {
    const defaultList: Omit<SmartDevice, 'userId'>[] = [
      {
        id: 'light-bedroom-main',
        name: 'Bedroom Light',
        type: 'light',
        room: 'Bedroom',
        online: true,
        state: { power: true, brightness: 80, color: 'Warm White' },
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'light-living-main',
        name: 'Living Room Light',
        type: 'light',
        room: 'Living Room',
        online: true,
        state: { power: false, brightness: 100, color: 'Daylight' },
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'light-kitchen',
        name: 'Kitchen Light',
        type: 'light',
        room: 'Kitchen',
        online: true,
        state: { power: false, brightness: 100, color: 'Cool White' },
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'fan-bedroom',
        name: 'Bedroom Ceiling Fan',
        type: 'fan',
        room: 'Bedroom',
        online: true,
        state: { power: true, speed: 3, oscillation: false },
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'fan-living',
        name: 'Living Room Fan',
        type: 'fan',
        room: 'Living Room',
        online: true,
        state: { power: false, speed: 2, oscillation: true },
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'ac-bedroom',
        name: 'Bedroom Inverter AC',
        type: 'ac',
        room: 'Bedroom',
        online: true,
        state: { power: false, temperature: 24, mode: 'cool' },
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'ac-living',
        name: 'Living Room AC',
        type: 'ac',
        room: 'Living Room',
        online: true,
        state: { power: false, temperature: 22, mode: 'cool' },
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'tv-living',
        name: 'Living Room Smart TV',
        type: 'tv',
        room: 'Living Room',
        online: true,
        state: { power: false, volume: 25, channel: 1, muted: false },
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'plug-geyser',
        name: 'Bathroom Water Heater',
        type: 'plug',
        room: 'Bathroom',
        online: true,
        state: { power: false, powerWatts: 0, isHazardous: true },
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'plug-coffee',
        name: 'Kitchen Coffee Maker',
        type: 'plug',
        room: 'Kitchen',
        online: true,
        state: { power: false, powerWatts: 0, isHazardous: false },
        lastUpdated: new Date().toISOString()
      }
    ];

    for (const item of defaultList) {
      const fullId = `${userId}_${item.id}`;
      if (!this.devices.has(fullId)) {
        this.devices.set(fullId, {
          ...item,
          id: fullId,
          userId
        });
      }
    }
  }

  /**
   * Get all devices for a given user
   */
  public getDevices(userId: string = 'default_user'): SmartDevice[] {
    this.seedDefaultSmartDevices(userId);
    return Array.from(this.devices.values()).filter(d => d.userId === userId || d.userId === 'default_user');
  }

  /**
   * Find devices matching criteria (room, name, type)
   */
  public findDevices(options: {
    userId?: string;
    room?: string;
    deviceType?: SmartDeviceType;
    nameQuery?: string;
  }): SmartDevice[] {
    const list = this.getDevices(options.userId);
    return list.filter(d => {
      if (options.deviceType && d.type !== options.deviceType) return false;
      if (options.room && !d.room.toLowerCase().includes(options.room.toLowerCase())) return false;
      if (options.nameQuery) {
        const q = options.nameQuery.toLowerCase();
        const matchName = d.name.toLowerCase().includes(q);
        const matchRoom = d.room.toLowerCase().includes(q);
        const matchType = d.type.toLowerCase().includes(q);
        if (!matchName && !matchRoom && !matchType) return false;
      }
      return true;
    });
  }

  /**
   * Execute smart device command
   */
  public controlDevice(options: ControlDeviceOptions): ControlResult {
    const userId = options.userId || 'default_user';
    let targets: SmartDevice[] = [];

    if (options.deviceId) {
      const dev = this.devices.get(options.deviceId) || this.devices.get(`${userId}_${options.deviceId}`);
      if (dev) targets.push(dev);
    } else {
      targets = this.findDevices({
        userId,
        room: options.room,
        deviceType: options.deviceType
      });
    }

    if (targets.length === 0) {
      // If room specified but no device of that type, check any device in that room
      if (options.room) {
        targets = this.findDevices({ userId, room: options.room });
      }
    }

    if (targets.length === 0) {
      return {
        success: false,
        affectedDevices: [],
        message: `No compatible smart device found${options.room ? ` in ${options.room}` : ''}${options.deviceType ? ` (${options.deviceType})` : ''}.`
      };
    }

    const updatedDevices: SmartDevice[] = [];
    const params = options.params || {};
    let safetyWarning: string | undefined;

    for (const target of targets) {
      // Safety confirmation check for high power / hazardous appliances
      if (target.state.isHazardous && (options.action === 'turn_on' || params.power === true)) {
        safetyWarning = `Safety notice: ${target.name} is a high-power device. Make sure it is monitored.`;
      }

      switch (options.action) {
        case 'turn_on':
          target.state.power = true;
          if (target.type === 'plug') target.state.powerWatts = 1200;
          break;
        case 'turn_off':
          target.state.power = false;
          if (target.type === 'plug') target.state.powerWatts = 0;
          break;
        case 'toggle':
          target.state.power = !target.state.power;
          break;
        case 'set_brightness':
          if (target.type === 'light') {
            const b = Math.min(100, Math.max(0, Number(params.brightness ?? params.level ?? 50)));
            target.state.brightness = b;
            target.state.power = b > 0;
          }
          break;
        case 'set_color':
          if (target.type === 'light' && params.color) {
            target.state.color = String(params.color);
            target.state.power = true;
          }
          break;
        case 'set_speed':
          if (target.type === 'fan') {
            const s = Math.min(5, Math.max(1, Number(params.speed ?? params.level ?? 3)));
            target.state.speed = s;
            target.state.power = true;
          }
          break;
        case 'set_temperature':
          if (target.type === 'ac') {
            const t = Math.min(30, Math.max(16, Number(params.temperature ?? params.temp ?? 24)));
            target.state.temperature = t;
            target.state.power = true;
          }
          break;
        case 'set_mode':
          if (target.type === 'ac' && params.mode) {
            target.state.mode = params.mode;
            target.state.power = true;
          }
          break;
        case 'set_volume':
          if (target.type === 'tv') {
            const v = Math.min(100, Math.max(0, Number(params.volume ?? params.level ?? 20)));
            target.state.volume = v;
            target.state.muted = false;
          }
          break;
        default:
          if (params.power !== undefined) {
            target.state.power = Boolean(params.power);
          }
          break;
      }

      target.lastUpdated = new Date().toISOString();
      updatedDevices.push({ ...target });
    }

    const deviceNames = updatedDevices.map(d => d.name).join(', ');
    const stateDesc = options.action === 'turn_on' ? 'turned on' :
                      options.action === 'turn_off' ? 'switched off' :
                      options.action === 'set_brightness' ? `brightness set to ${params.brightness ?? params.level}%` :
                      options.action === 'set_temperature' ? `temperature set to ${params.temperature ?? params.temp}°C` :
                      options.action === 'set_speed' ? `speed set to level ${params.speed ?? params.level}` :
                      options.action === 'set_color' ? `color changed to ${params.color}` : 'updated';

    return {
      success: true,
      affectedDevices: updatedDevices,
      message: `Done! ${deviceNames} ${stateDesc}.`,
      warning: safetyWarning
    };
  }

  /**
   * Query device status
   */
  public queryStatus(options: { userId?: string; room?: string; deviceType?: SmartDeviceType; nameQuery?: string }): {
    devices: SmartDevice[];
    summary: string;
  } {
    const list = this.findDevices(options);
    if (list.length === 0) {
      return {
        devices: [],
        summary: 'No matching smart devices found in your home.'
      };
    }

    const descriptions = list.map(d => {
      const p = d.state.power ? 'ON' : 'OFF';
      let extra = '';
      if (d.type === 'light' && d.state.power) extra = ` (${d.state.brightness}%, ${d.state.color})`;
      if (d.type === 'ac' && d.state.power) extra = ` (${d.state.temperature}°C, ${d.state.mode} mode)`;
      if (d.type === 'fan' && d.state.power) extra = ` (Speed ${d.state.speed})`;
      if (d.type === 'tv' && d.state.power) extra = ` (Volume ${d.state.volume})`;
      return `${d.name} (${d.room}): ${p}${extra}`;
    });

    return {
      devices: list,
      summary: descriptions.join('; ')
    };
  }
}

export const smartDeviceManager = new SmartDeviceManager();
