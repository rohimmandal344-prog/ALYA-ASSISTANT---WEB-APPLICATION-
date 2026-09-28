import { WebSocketManager } from '../lib/WebSocketManager';

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
  isOnline: boolean;
  connectedAt: string | Date;
  lastSeen: string | Date;
  pingLatencyMs: number;
  telemetry: DeviceTelemetry;
  authorizedCapabilities: string[];
}

export interface CommandExecutionResult {
  commandId: string;
  deviceId: string;
  status: 'success' | 'failure';
  result?: any;
  error?: string;
  executionDurationMs?: number;
  verifiedTelemetry?: DeviceTelemetry;
}

type DeviceEventCallback = (event: {
  type: 'DEVICES_SNAPSHOT' | 'DEVICE_CONNECTED' | 'DEVICE_DISCONNECTED' | 'DEVICE_STATUS_UPDATE' | 'DEVICE_COMMAND_VERIFIED' | 'INCOMING_ANDROID_NOTIFICATION' | 'STATUS_CHANGE';
  payload: any;
}) => void;

class DeviceWebSocketClient {
  private manager: WebSocketManager | null = null;
  private listeners: Set<DeviceEventCallback> = new Set();
  private userId: string = 'default_user';

  public connect(userId?: string, token?: string) {
    if (userId) this.userId = userId;
    
    if (this.manager && this.manager.getStatus() !== 'CLOSED') {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?clientType=web&userId=${encodeURIComponent(this.userId)}`;

    this.manager = new WebSocketManager({
      url: wsUrl,
      token,
      onOpen: () => {
        console.log('[DeviceWS] Connected to Alya Device Realtime Gateway');
      },
      onEvent: (event) => {
        // Forward structured events to existing notification system
        this.notifyListeners(event);
      },
      onStatusChange: (status) => {
        this.notifyListeners({ type: 'STATUS_CHANGE', payload: { status } });
      }
    });

    // Handle structured events and map them to the existing dashboard event system
    this.manager.on('command_execution', (event) => {
      this.notifyListeners({
        type: 'DEVICE_COMMAND_VERIFIED',
        payload: { response: event.payload }
      });
    });

    this.manager.on('status_update', (event) => {
      this.notifyListeners({
        type: 'DEVICE_STATUS_UPDATE',
        payload: event.payload
      });
    });

    this.manager.on('device_pairing_request', (event) => {
      // Potentially show a notification or update pairing state
      console.log('[DeviceWS] Pairing Request Event:', event.payload);
    });

    this.manager.connect();
  }

  public disconnect() {
    if (this.manager) {
      this.manager.disconnect();
      this.manager = null;
    }
  }

  public subscribe(callback: DeviceEventCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(data: any) {
    this.listeners.forEach((callback) => {
      try {
        if (data && typeof data === 'object' && data.type) {
          callback(data);
        } else {
          // Wrap if it's not in the expected format (unlikely with WebSocketManager)
          callback({
            type: data.type || 'UNKNOWN',
            payload: data
          });
        }
      } catch (err) {
        console.error('[DeviceWS] Listener error:', err);
      }
    });
  }

  public get diagnostics() {
    return this.manager ? this.manager.diagnostics : null;
  }

  public async measureCompanionRTT(deviceId?: string) {
    if (!this.manager) {
      this.connect();
    }
    return this.manager ? await this.manager.measureCompanionRTT(deviceId) : null;
  }

  public async benchmarkServerNodes() {
    if (!this.manager) {
      this.connect();
    }
    return this.manager ? await this.manager.benchmarkServerNodes() : null;
  }

  public getDiagnosticLogs(limit?: number) {
    return this.manager ? this.manager.getDiagnosticLogs(limit) : [];
  }

  public getFastestServerNode() {
    return this.manager ? this.manager.getFastestServerNode() : null;
  }

  public getMetricSummary() {
    return this.manager ? this.manager.getMetricSummary() : null;
  }

  public async sendCommand(deviceId: string, command: string, params: Record<string, any> = {}): Promise<CommandExecutionResult> {
    const res = await fetch('/api/device/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        command,
        params
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Command failed with status ${res.status}`);
    }

    return await res.json();
  }

  public async generatePairingCode(userId?: string): Promise<{ pairingCode: string; expiresAt: number }> {
    const targetUser = userId || this.userId;
    const res = await fetch('/api/device/pairing-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUser })
    });

    if (!res.ok) {
      throw new Error('Failed to generate device pairing code.');
    }

    return await res.json();
  }

  public async fetchDevices(userId?: string): Promise<ConnectedDevice[]> {
    const targetUser = userId || this.userId;
    const res = await fetch(`/api/devices?userId=${encodeURIComponent(targetUser)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.devices || [];
  }
}

export const deviceWebSocketClient = new DeviceWebSocketClient();
