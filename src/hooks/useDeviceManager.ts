import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  deviceWebSocketClient, 
  ConnectedDevice, 
  CommandExecutionResult, 
  DeviceTelemetry 
} from '../services/deviceWebSocketService';

export function useDeviceManager() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<ConnectedDevice | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecutionResult, setLastExecutionResult] = useState<CommandExecutionResult | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  const userId = user?.uid || 'default_user';

  useEffect(() => {
    deviceWebSocketClient.connect(userId);
    setConnectionStatus('connected');

    // Fetch initial list
    deviceWebSocketClient.fetchDevices(userId).then((list) => {
      setDevices(list);
      if (list.length > 0 && !activeDevice) {
        setActiveDevice(list[0]);
      }
    });

    const unsubscribe = deviceWebSocketClient.subscribe((event) => {
      const { type, payload } = event;

      if (type === 'DEVICES_SNAPSHOT') {
        const devList: ConnectedDevice[] = payload.devices || [];
        setDevices(devList);
        if (devList.length > 0) {
          setActiveDevice((prev) => prev ? devList.find(d => d.deviceId === prev.deviceId) || devList[0] : devList[0]);
        }
      } else if (type === 'DEVICE_CONNECTED') {
        const newDev: ConnectedDevice = payload.device;
        setDevices((prev) => {
          const exists = prev.some(d => d.deviceId === newDev.deviceId);
          return exists ? prev.map(d => d.deviceId === newDev.deviceId ? newDev : d) : [...prev, newDev];
        });
      } else if (type === 'DEVICE_DISCONNECTED') {
        const disconnectedId = payload.deviceId;
        setDevices((prev) => prev.filter(d => d.deviceId !== disconnectedId));
      } else if (type === 'DEVICE_STATUS_UPDATE') {
        const { deviceId, telemetry, authorizedCapabilities } = payload;
        setDevices((prev) =>
          prev.map((d) =>
            d.deviceId === deviceId
              ? { ...d, telemetry: { ...d.telemetry, ...telemetry }, authorizedCapabilities: authorizedCapabilities || d.authorizedCapabilities, lastSeen: new Date() }
              : d
          )
        );
        setActiveDevice((prev) =>
          prev && prev.deviceId === deviceId
            ? { ...prev, telemetry: { ...prev.telemetry, ...telemetry }, authorizedCapabilities: authorizedCapabilities || prev.authorizedCapabilities, lastSeen: new Date() }
            : prev
        );
      } else if (type === 'DEVICE_COMMAND_VERIFIED') {
        const response: CommandExecutionResult = payload.response;
        setLastExecutionResult(response);
      } else if (type === 'STATUS_CHANGE') {
        const { status } = payload;
        if (status === 'OPEN') setConnectionStatus('connected');
        else if (status === 'CONNECTING' || status === 'RECONNECTING') setConnectionStatus('connecting');
        else setConnectionStatus('disconnected');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  const sendCommand = useCallback(
    async (deviceId: string, command: string, params: Record<string, any> = {}) => {
      setIsExecuting(true);
      setLastExecutionResult(null);
      try {
        const result = await deviceWebSocketClient.sendCommand(deviceId, command, params);
        setLastExecutionResult(result);
        return result;
      } finally {
        setIsExecuting(false);
      }
    },
    []
  );

  return {
    devices,
    activeDevice,
    setActiveDevice,
    isExecuting,
    lastExecutionResult,
    connectionStatus,
    sendCommand,
    refreshDevices: () => deviceWebSocketClient.fetchDevices(userId).then(setDevices)
  };
}
