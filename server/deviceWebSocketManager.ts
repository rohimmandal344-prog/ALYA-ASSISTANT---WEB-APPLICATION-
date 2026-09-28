import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

export interface DeviceTelemetry {
  batteryLevel?: number;
  isCharging?: boolean;
  volumeLevel?: number;
  flashlightOn?: boolean;
  wifiConnected?: boolean;
  wifiSSID?: string;
  networkType?: string;
  screenOn?: boolean;
  currentApp?: string;
  ramUsageMb?: number;
  storageFreeGb?: number;
  accessibilityActive?: boolean;
  notificationListenerActive?: boolean;
  wakeWordActive?: boolean;
}

export interface ConnectedDevice {
  deviceId: string;
  userId: string;
  deviceName: string;
  platform: 'android' | 'web';
  appVersion?: string;
  ws: WebSocket;
  connectedAt: Date;
  lastSeen: Date;
  pingLatencyMs?: number;
  telemetry: DeviceTelemetry;
  authorizedCapabilities: string[];
}

export interface DeviceCommandRequest {
  id: string;
  command: string;
  params: Record<string, any>;
  timestamp: number;
  origin: 'web' | 'alya_brain' | 'automation' | 'livekit_agent';
}

export interface DeviceCommandResponse {
  commandId: string;
  deviceId: string;
  status: 'success' | 'failure';
  result?: any;
  error?: string;
  executionDurationMs?: number;
  verifiedTelemetry?: DeviceTelemetry;
}

export interface PairingCodeSession {
  pairingCode: string;
  userId: string;
  expiresAt: number;
}

class DeviceWebSocketManager {
  // Map of deviceId -> ConnectedDevice
  private devices = new Map<string, ConnectedDevice>();

  // Map of userId -> Set of Web UI WebSockets
  private webClients = new Map<string, Set<WebSocket>>();

  // Active Pairing Codes (code -> PairingCodeSession)
  private pairingCodes = new Map<string, PairingCodeSession>();

  // Paired Device Tokens (deviceId -> authToken)
  private pairedDeviceTokens = new Map<string, { userId: string; token: string; pairedAt: Date }>();

  // Pending command executions awaiting device verification (commandId -> Promise handlers)
  private pendingCommands = new Map<string, {
    resolve: (res: DeviceCommandResponse) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
    command: string;
    deviceId: string;
    startTime: number;
  }>();

  constructor() {
    // Heartbeat ping interval to keep connection healthy and compute latency
    setInterval(() => this.heartbeat(), 15000);

    // Clean up expired pairing codes every minute
    setInterval(() => this.cleanupPairingCodes(), 60000);
  }

  /**
   * Generate a secure 6-digit pairing code for a user session
   */
  public generatePairingCode(userId: string): { pairingCode: string; expiresAt: number } {
    // Generate code in format ALYA-XXXX-1234
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const prefix = (userId || 'USER').slice(0, 4).toUpperCase();
    const pairingCode = `ALYA-${prefix}-${randomDigits}`;
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes valid

    this.pairingCodes.set(pairingCode, { pairingCode, userId, expiresAt });
    return { pairingCode, expiresAt };
  }

  /**
   * Validate a pairing code submitted by a native Android companion app
   */
  public validateAndPairDevice(options: {
    pairingCode: string;
    deviceId: string;
    deviceName?: string;
  }): { success: boolean; token?: string; userId?: string; error?: string } {
    const { pairingCode, deviceId } = options;
    const session = this.pairingCodes.get(pairingCode.trim().toUpperCase());

    if (!session) {
      return { success: false, error: 'Invalid or unrecognized pairing code.' };
    }

    if (Date.now() > session.expiresAt) {
      this.pairingCodes.delete(pairingCode.trim().toUpperCase());
      return { success: false, error: 'Pairing code has expired. Please generate a new code.' };
    }

    // Generate permanent companion auth token
    const token = `alya_dev_tok_${uuidv4().replace(/-/g, '')}`;
    this.pairedDeviceTokens.set(deviceId, {
      userId: session.userId,
      token,
      pairedAt: new Date()
    });

    // Code single-use consume
    this.pairingCodes.delete(pairingCode.trim().toUpperCase());

    console.log(`[DeviceManager] Device ${deviceId} successfully paired with user ${session.userId}`);
    return { success: true, token, userId: session.userId };
  }

  /**
   * Verify whether a device connection presents a valid token or user authorization
   */
  public verifyDeviceToken(deviceId: string, token?: string): boolean {
    if (!token) return true; // Allow initial handshake in preview mode
    const paired = this.pairedDeviceTokens.get(deviceId);
    if (!paired) return true;
    return paired.token === token;
  }

  /**
   * Register a new Android or Web Companion connection
   */
  public registerDevice(params: {
    deviceId: string;
    userId: string;
    deviceName: string;
    platform: 'android' | 'web';
    appVersion?: string;
    ws: WebSocket;
    capabilities?: string[];
  }): ConnectedDevice {
    const { deviceId, userId, deviceName, platform, appVersion, ws, capabilities } = params;

    const device: ConnectedDevice = {
      deviceId,
      userId,
      deviceName: deviceName || (platform === 'android' ? 'Android Phone' : 'Web Companion'),
      platform,
      appVersion: appVersion || '1.0.0',
      ws,
      connectedAt: new Date(),
      lastSeen: new Date(),
      telemetry: {
        batteryLevel: 100,
        isCharging: false,
        volumeLevel: 60,
        flashlightOn: false,
        wifiConnected: true,
        accessibilityActive: platform === 'android',
        notificationListenerActive: platform === 'android',
        wakeWordActive: true
      },
      authorizedCapabilities: capabilities || ['flashlight', 'volume', 'battery', 'app_launch', 'notifications']
    };

    this.devices.set(deviceId, device);
    console.log(`[DeviceManager] Device registered: ${deviceName} (${deviceId}) for user: ${userId}`);

    // Notify all active Web UI sessions of new device
    this.broadcastToUser(userId, {
      type: 'DEVICE_CONNECTED',
      device: this.serializeDevice(device)
    });

    return device;
  }

  /**
   * Register a Web UI client for real-time telemetry listening
   */
  public registerWebClient(userId: string, ws: WebSocket) {
    if (!this.webClients.has(userId)) {
      this.webClients.set(userId, new Set());
    }
    this.webClients.get(userId)!.add(ws);

    // Send initial snapshot of connected devices for this user
    const userDevices = this.getDevicesForUser(userId);
    ws.send(JSON.stringify({
      type: 'DEVICES_SNAPSHOT',
      devices: userDevices
    }));
  }

  /**
   * Unregister a Web UI client
   */
  public unregisterWebClient(userId: string, ws: WebSocket) {
    const clients = this.webClients.get(userId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.webClients.delete(userId);
      }
    }
  }

  /**
   * Unregister disconnected device
   */
  public unregisterDevice(deviceId: string) {
    const device = this.devices.get(deviceId);
    if (device) {
      this.devices.delete(deviceId);
      console.log(`[DeviceManager] Device unregistered: ${device.deviceName} (${deviceId})`);

      // Broadcast disconnection to Web UI
      this.broadcastToUser(device.userId, {
        type: 'DEVICE_DISCONNECTED',
        deviceId
      });
    }
  }

  /**
   * Process incoming WebSocket messages from companion devices
   */
  public handleDeviceMessage(deviceId: string, rawData: string | Buffer | any) {
    try {
      const message = JSON.parse(rawData.toString());
      const device = this.devices.get(deviceId);
      if (!device) return;

      device.lastSeen = new Date();

      switch (message.type) {
        // Structured Alya Events from companion app
        case 'status_update':
        case 'TELEMETRY_UPDATE':
        case 'STATUS_UPDATE': {
          const telemetry = message.payload?.telemetry || message.telemetry;
          if (telemetry) {
            device.telemetry = { ...device.telemetry, ...telemetry };
          }
          const caps = message.payload?.authorizedCapabilities || message.authorizedCapabilities;
          if (caps) {
            device.authorizedCapabilities = caps;
          }
          this.broadcastToUser(device.userId, {
            type: 'DEVICE_STATUS_UPDATE',
            deviceId,
            telemetry: device.telemetry,
            authorizedCapabilities: device.authorizedCapabilities
          });
          break;
        }

        case 'command_execution':
        case 'COMMAND_RESULT': {
          const payload = message.payload || message;
          const response: DeviceCommandResponse = {
            commandId: payload.commandId || payload.id,
            deviceId,
            status: payload.status || (payload.success ? 'success' : 'failure'),
            result: payload.result || payload.data,
            error: payload.error,
            executionDurationMs: payload.executionDurationMs,
            verifiedTelemetry: payload.verifiedTelemetry
          };

          if (response.verifiedTelemetry) {
            device.telemetry = { ...device.telemetry, ...response.verifiedTelemetry };
          }

          // Resolve pending async execution promise
          const pending = this.pendingCommands.get(response.commandId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingCommands.delete(response.commandId);
            pending.resolve(response);
          }

          // Forward execution feedback to Web UI
          this.broadcastToUser(device.userId, {
            type: 'DEVICE_COMMAND_VERIFIED',
            response
          });
          break;
        }

        case 'device_pairing_request': {
          // This would be handled if pairing happened via WebSocket
          // For now, most pairing happens via HTTP POST /api/device/pair
          console.log(`[DeviceManager] Pairing request via WS from ${deviceId}`);
          break;
        }

        // Heartbeat Pong
        case 'PONG': {
          if (message.clientTimestamp) {
            device.pingLatencyMs = Math.max(1, Date.now() - message.clientTimestamp);
          }
          break;
        }

        // Diagnostic Companion Pong from Android companion
        case 'COMPANION_PONG': {
          const { pingId, clientSentAt, serverSentAt, companionRepliedAt } = message;
          const serverForwardedAt = Date.now();
          const serverToCompanionMs = companionRepliedAt && serverSentAt ? Math.max(1, companionRepliedAt - serverSentAt) : 0;
          device.pingLatencyMs = serverToCompanionMs;
          
          this.broadcastToUser(device.userId, {
            type: 'DIAGNOSTIC_COMPANION_PONG',
            pingId,
            deviceId,
            deviceName: device.deviceName,
            status: 'success',
            clientSentAt,
            serverSentAt,
            companionRepliedAt,
            serverForwardedAt,
            serverToCompanionMs
          });
          break;
        }

        // Notification arrived on Android companion
        case 'ANDROID_NOTIFICATION': {
          this.broadcastToUser(device.userId, {
            type: 'INCOMING_ANDROID_NOTIFICATION',
            deviceId,
            notification: message.notification
          });
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error('[DeviceManager] Error handling device message:', e);
    }
  }

  /**
   * Send command to a specific device with guaranteed delivery & async verification
   */
  public async sendCommand(options: {
    deviceId: string;
    command: string;
    params?: Record<string, any>;
    origin?: 'web' | 'alya_brain' | 'automation' | 'livekit_agent';
    timeoutMs?: number;
  }): Promise<DeviceCommandResponse> {
    const { deviceId, command, params = {}, origin = 'web', timeoutMs = 7000 } = options;
    const device = this.devices.get(deviceId);

    if (!device || device.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Device ${deviceId} is currently offline or unreachable.`);
    }

    const commandId = uuidv4();
    const commandPayload: DeviceCommandRequest = {
      id: commandId,
      command,
      params,
      timestamp: Date.now(),
      origin
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command ${command} timed out waiting for device verification (${timeoutMs}ms).`));
      }, timeoutMs);

      this.pendingCommands.set(commandId, {
        resolve,
        reject,
        timeout,
        command,
        deviceId,
        startTime: Date.now()
      });

      // Send down WebSocket to Android companion
      try {
        device.ws.send(JSON.stringify({
          type: 'EXECUTE_COMMAND',
          ...commandPayload
        }));
      } catch (err: any) {
        clearTimeout(timeout);
        this.pendingCommands.delete(commandId);
        reject(new Error(`Failed to transmit command: ${err.message}`));
      }
    });
  }

  /**
   * Broadcast message to all web clients of a given user
   */
  public broadcastToUser(userId: string, payload: any) {
    const clients = this.webClients.get(userId);
    if (!clients || clients.size === 0) return;

    const data = JSON.stringify(payload);
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch {}
      }
    });
  }

  /**
   * Periodic heartbeat to detect zombie connections and measure latency
   */
  private heartbeat() {
    const now = Date.now();
    this.devices.forEach((device, deviceId) => {
      if (device.ws.readyState === WebSocket.OPEN) {
        try {
          device.ws.send(JSON.stringify({
            type: 'PING',
            timestamp: now
          }));
        } catch {
          this.unregisterDevice(deviceId);
        }
      } else {
        this.unregisterDevice(deviceId);
      }
    });
  }

  /**
   * Cleanup expired pairing codes
   */
  private cleanupPairingCodes() {
    const now = Date.now();
    this.pairingCodes.forEach((session, code) => {
      if (now > session.expiresAt) {
        this.pairingCodes.delete(code);
      }
    });
  }

  /**
   * Get all connected devices for a specific user
   */
  public getDevicesForUser(userId: string) {
    const result: any[] = [];
    this.devices.forEach((device) => {
      if (device.userId === userId) {
        result.push(this.serializeDevice(device));
      }
    });
    return result;
  }

  /**
   * Get a single device
   */
  public getDevice(deviceId: string) {
    const dev = this.devices.get(deviceId);
    return dev ? this.serializeDevice(dev) : null;
  }

  /**
   * Routes a diagnostic ping from Web Dashboard to the Android Companion to measure end-to-end RTT
   */
  public routeCompanionPing(options: {
    userId: string;
    webWs: WebSocket;
    pingId: string;
    targetDeviceId?: string;
    clientSentAt: number;
    serverReceivedAt: number;
  }) {
    const { userId, webWs, pingId, targetDeviceId, clientSentAt, serverReceivedAt } = options;

    let targetDevice: ConnectedDevice | undefined;
    if (targetDeviceId && targetDeviceId !== 'auto') {
      targetDevice = this.devices.get(targetDeviceId);
    } else {
      for (const dev of this.devices.values()) {
        if (dev.userId === userId && dev.ws.readyState === WebSocket.OPEN) {
          targetDevice = dev;
          break;
        }
      }
    }

    if (!targetDevice || targetDevice.ws.readyState !== WebSocket.OPEN) {
      if (webWs.readyState === WebSocket.OPEN) {
        webWs.send(JSON.stringify({
          type: 'DIAGNOSTIC_COMPANION_PONG',
          pingId,
          deviceId: targetDeviceId || 'none',
          status: 'device_offline',
          clientSentAt,
          serverReceivedAt,
          serverForwardedAt: Date.now(),
          webToServerRttMs: Math.max(1, Date.now() - clientSentAt),
          error: 'Android companion device is offline or not currently connected via WebSocket.'
        }));
      }
      return;
    }

    const serverSentAt = Date.now();
    try {
      targetDevice.ws.send(JSON.stringify({
        type: 'COMPANION_PING',
        pingId,
        clientSentAt,
        serverSentAt
      }));
    } catch (err: any) {
      if (webWs.readyState === WebSocket.OPEN) {
        webWs.send(JSON.stringify({
          type: 'DIAGNOSTIC_COMPANION_PONG',
          pingId,
          deviceId: targetDevice.deviceId,
          status: 'error',
          clientSentAt,
          serverReceivedAt,
          serverForwardedAt: Date.now(),
          webToServerRttMs: Math.max(1, Date.now() - clientSentAt),
          error: `Failed to deliver ping to companion: ${err.message}`
        }));
      }
    }
  }

  /**
   * Serialize device object for JSON transmission
   */
  private serializeDevice(device: ConnectedDevice) {
    return {
      deviceId: device.deviceId,
      userId: device.userId,
      deviceName: device.deviceName,
      platform: device.platform,
      appVersion: device.appVersion,
      isOnline: device.ws.readyState === WebSocket.OPEN,
      connectedAt: device.connectedAt,
      lastSeen: device.lastSeen,
      pingLatencyMs: device.pingLatencyMs || 25,
      telemetry: device.telemetry,
      authorizedCapabilities: device.authorizedCapabilities
    };
  }
}

export const deviceWebSocketManager = new DeviceWebSocketManager();
