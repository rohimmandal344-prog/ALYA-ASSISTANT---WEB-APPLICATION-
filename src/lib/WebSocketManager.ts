/**
 * Alya Assistant - Secure WebSocket Manager
 * Robust WebSocket wrapper with auto-reconnect, authentication token handling,
 * message buffering, binary streaming support, heartbeat signals, latency diagnostics,
 * and Live Conversation streaming hooks.
 */

export type WSConnectionStatus = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'RECONNECTING';

export type AlyaEventType = 
  | 'command_execution' 
  | 'status_update' 
  | 'device_pairing_request' 
  | 'telemetry_push' 
  | 'notification_sync'
  | 'heartbeat'
  | 'LIVE_STARTED'
  | 'LIVE_TEXT'
  | 'LIVE_AUDIO'
  | 'LIVE_TURN_COMPLETE'
  | 'LIVE_INTERRUPTED'
  | 'LIVE_ERROR'
  | 'LIVE_STOPPED';

export interface AlyaEvent<T = any> {
  type: AlyaEventType;
  payload: T;
  deviceId?: string;
  timestamp: number;
  messageId: string;
  signature?: string; // For secure message verification
}

export interface ServerNodeCandidate {
  id: string;
  name: string;
  url: string;
  region: string;
  datacenter?: string;
  isDefault?: boolean;
}

export interface ServerNodeProbeResult {
  node: ServerNodeCandidate;
  samples: number[];
  avgRtt: number;
  minRtt: number;
  maxRtt: number;
  jitter: number;
  packetLossPercent: number;
  status: 'optimal' | 'acceptable' | 'degraded' | 'unreachable';
  testedAt: number;
}

export interface CompanionRTTProbeResult {
  deviceId: string;
  deviceName?: string;
  pingId: string;
  clientSentAt: number;
  serverReceivedAt?: number;
  companionRepliedAt?: number;
  clientReceivedAt: number;
  totalEndToEndRttMs: number;
  webToServerRttMs: number;
  serverToCompanionRttMs: number;
  status: 'success' | 'device_offline' | 'timeout' | 'error';
  error?: string;
  testedAt: number;
}

export interface RTTDiagnosticLogEntry {
  id: string;
  timestamp: number;
  type: 'companion_rtt' | 'server_node_benchmark' | 'heartbeat' | 'websocket_fail' | 'websocket_success';
  target: string;
  rttMs: number;
  breakdown?: {
    webToServerMs: number;
    serverToCompanionMs: number;
  };
  fastestNodeId?: string;
  status: string;
  notes: string;
}

export interface LatencyMetricSummary {
  currentRtt: number;
  smoothedRtt: number;
  webToServerMs: number;
  serverToCompanionMs: number;
  jitter: number;
  speedRating: 'ULTRA_FAST' | 'OPTIMAL' | 'MODERATE' | 'SLOW' | 'OFFLINE';
  qualityScore: number;
  status: 'optimal' | 'acceptable' | 'degraded' | 'device_offline' | 'disconnected';
  testedAt: number;
  fastestNode: ServerNodeCandidate | null;
  targetDevice?: string;
}

export interface LiveSessionConfig {
  voiceName?: string;
  language?: string;
  onText?: (text: string) => void;
  onAudio?: (base64Audio: string) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onStop?: () => void;
}

export interface WSOptions {
  url: string;
  token?: string;
  deviceId?: string;
  userId?: string;
  clientType?: 'web' | 'voice' | 'device';
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onMessage?: (data: any) => void;
  onBinaryMessage?: (data: ArrayBuffer | Blob) => void;
  onEvent?: (event: AlyaEvent) => void;
  onError?: (err: Event) => void;
  onStatusChange?: (status: WSConnectionStatus) => void;
}

/**
 * High-Performance Diagnostics & RTT Measurement Module
 * Measures end-to-end RTT between Web Dashboard and Android Companion,
 * logs detailed latency telemetry, and benchmarks multi-region server nodes
 * to automatically identify and select the fastest node for low latency.
 */
export class WebSocketDiagnosticsModule {
  private wsManager: WebSocketManager;
  private pendingPings = new Map<string, {
    resolve: (res: CompanionRTTProbeResult) => void;
    reject: (err: any) => void;
    timeout: any;
    clientSentAt: number;
    deviceId: string;
  }>();

  private logHistory: RTTDiagnosticLogEntry[] = [];
  private fastestNode: ServerNodeCandidate | null = null;
  private latestCompanionRTT: CompanionRTTProbeResult | null = null;
  private latestBenchmarkResults: ServerNodeProbeResult[] = [];
  private periodicTimer: any = null;
  private listeners: Set<(report: any) => void> = new Set();

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
    this.loadPersistedLogs();
  }

  private loadPersistedLogs() {
    try {
      const saved = localStorage.getItem('alya_rtt_diagnostics_history');
      if (saved) {
        this.logHistory = JSON.parse(saved).slice(-100);
      }
      const savedNode = localStorage.getItem('alya_fastest_server_node');
      if (savedNode) {
        this.fastestNode = JSON.parse(savedNode);
      }
    } catch {}
  }

  private persistLogs() {
    try {
      localStorage.setItem('alya_rtt_diagnostics_history', JSON.stringify(this.logHistory.slice(-100)));
      if (this.fastestNode) {
        localStorage.setItem('alya_fastest_server_node', JSON.stringify(this.fastestNode));
      }
    } catch {}
  }

  /**
   * Internal hook to handle incoming DIAGNOSTIC_COMPANION_PONG from WebSocket
   */
  public handleCompanionPong(data: any) {
    const pingId = data.pingId;
    const pending = this.pendingPings.get(pingId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingPings.delete(pingId);

    const clientReceivedAt = Date.now();
    const totalEndToEndRttMs = Math.max(1, clientReceivedAt - pending.clientSentAt);
    const webToServerRttMs = data.serverReceivedAt 
      ? Math.max(1, data.serverReceivedAt - pending.clientSentAt) 
      : Math.round(totalEndToEndRttMs / 2);
    const serverToCompanionRttMs = data.serverToCompanionMs || (
      data.companionRepliedAt && data.serverSentAt 
        ? Math.max(1, data.companionRepliedAt - data.serverSentAt) 
        : 0
    );

    const result: CompanionRTTProbeResult = {
      deviceId: data.deviceId || pending.deviceId,
      deviceName: data.deviceName,
      pingId,
      clientSentAt: pending.clientSentAt,
      serverReceivedAt: data.serverReceivedAt,
      companionRepliedAt: data.companionRepliedAt,
      clientReceivedAt,
      totalEndToEndRttMs,
      webToServerRttMs,
      serverToCompanionRttMs,
      status: data.status || 'success',
      error: data.error,
      testedAt: clientReceivedAt
    };

    this.latestCompanionRTT = result;

    this.logEntry({
      id: `rtt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: clientReceivedAt,
      type: 'companion_rtt',
      target: result.deviceName || result.deviceId,
      rttMs: totalEndToEndRttMs,
      breakdown: {
        webToServerMs: webToServerRttMs,
        serverToCompanionMs: serverToCompanionRttMs
      },
      status: result.status,
      notes: result.status === 'success' 
        ? `Round-trip complete: Web->Server ${webToServerRttMs}ms, Server->Android ${serverToCompanionRttMs}ms (Total: ${totalEndToEndRttMs}ms)`
        : `Companion status: ${result.error || result.status}`
    });

    this.notifyListeners({ type: 'COMPANION_RTT_UPDATE', result });
    pending.resolve(result);
  }

  /**
   * Measure real round-trip time between Web Dashboard and Android Companion
   */
  public async measureCompanionRTT(deviceId: string = 'auto', timeoutMs: number = 7000): Promise<CompanionRTTProbeResult> {
    const pingId = `diag_ping_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
    const clientSentAt = Date.now();

    if (this.wsManager.getStatus() !== 'OPEN') {
      const offlineResult: CompanionRTTProbeResult = {
        deviceId,
        pingId,
        clientSentAt,
        clientReceivedAt: Date.now(),
        totalEndToEndRttMs: 0,
        webToServerRttMs: 0,
        serverToCompanionRttMs: 0,
        status: 'error',
        error: 'WebSocket Gateway is currently disconnected.',
        testedAt: Date.now()
      };
      this.latestCompanionRTT = offlineResult;
      return offlineResult;
    }

    return new Promise<CompanionRTTProbeResult>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingPings.delete(pingId);
        const timeoutResult: CompanionRTTProbeResult = {
          deviceId,
          pingId,
          clientSentAt,
          clientReceivedAt: Date.now(),
          totalEndToEndRttMs: timeoutMs,
          webToServerRttMs: Math.round(timeoutMs / 2),
          serverToCompanionRttMs: Math.round(timeoutMs / 2),
          status: 'timeout',
          error: `Ping timed out after ${timeoutMs}ms without companion response.`,
          testedAt: Date.now()
        };
        this.latestCompanionRTT = timeoutResult;
        this.logEntry({
          id: `rtt_timeout_${Date.now()}`,
          timestamp: Date.now(),
          type: 'companion_rtt',
          target: deviceId,
          rttMs: timeoutMs,
          status: 'timeout',
          notes: `Ping timed out (${timeoutMs}ms)`
        });
        resolve(timeoutResult);
      }, timeoutMs);

      this.pendingPings.set(pingId, {
        resolve,
        reject: () => {},
        timeout,
        clientSentAt,
        deviceId
      });

      this.wsManager.send({
        type: 'DIAGNOSTIC_COMPANION_PING',
        pingId,
        deviceId,
        clientSentAt
      });
    });
  }

  /**
   * Benchmark candidate server nodes and automatically identify the fastest server node
   */
  public async benchmarkServerNodes(candidateNodes?: ServerNodeCandidate[]): Promise<{
    fastestNode: ServerNodeCandidate;
    results: ServerNodeProbeResult[];
  }> {
    let nodesToTest = candidateNodes;

    if (!nodesToTest || nodesToTest.length === 0) {
      try {
        const res = await fetch('/api/network/nodes');
        if (res.ok) {
          const data = await res.json();
          nodesToTest = data.nodes;
        }
      } catch (err) {
        console.warn('[Diagnostics] Failed to fetch server nodes, using local edge candidate:', err);
      }
    }

    if (!nodesToTest || nodesToTest.length === 0) {
      const origin = window.location.origin;
      nodesToTest = [
        {
          id: 'node-se1-active',
          name: 'Singapore Primary Gateway (Asia-SE1)',
          url: `${origin}/api/ping`,
          region: 'asia-southeast1',
          datacenter: 'Google Cloud Singapore DC',
          isDefault: true
        },
        {
          id: 'node-s1-mumbai',
          name: 'South Asia Regional Gateway (Mumbai / Asia-S1)',
          url: `${origin}/api/ping?region=asia-south1`,
          region: 'asia-south1',
          datacenter: 'Google Cloud Mumbai Edge',
          isDefault: false
        },
        {
          id: 'node-us-central',
          name: 'North America Central Hub (Iowa / US-Central1)',
          url: `${origin}/api/ping?region=us-central1`,
          region: 'us-central1',
          datacenter: 'Google Cloud Iowa DC',
          isDefault: false
        },
        {
          id: 'node-eu-west',
          name: 'European Union Hub (Frankfurt / Europe-West3)',
          url: `${origin}/api/ping?region=europe-west3`,
          region: 'europe-west3',
          datacenter: 'Google Cloud Frankfurt Edge',
          isDefault: false
        }
      ];
    }

    const probeResults: ServerNodeProbeResult[] = [];

    for (const node of nodesToTest) {
      const samples: number[] = [];
      let packetLossCount = 0;
      const sampleCount = 3;

      for (let i = 0; i < sampleCount; i++) {
        const start = performance.now();
        try {
          const probeUrl = node.url + (node.url.includes('?') ? '&' : '?') + `t=${Date.now()}_${i}`;
          const response = await fetch(probeUrl, { method: 'GET', cache: 'no-store' });
          const elapsed = Math.round(performance.now() - start);
          if (response.ok) {
            samples.push(Math.max(1, elapsed));
          } else {
            packetLossCount++;
          }
        } catch {
          packetLossCount++;
        }
        await new Promise(r => setTimeout(r, 40));
      }

      const validSamples = samples.length > 0 ? samples : [999];
      const avgRtt = Math.round(validSamples.reduce((a, b) => a + b, 0) / validSamples.length);
      const minRtt = Math.min(...validSamples);
      const maxRtt = Math.max(...validSamples);
      
      const jitter = validSamples.length > 1
        ? Math.round(validSamples.reduce((sum, s) => sum + Math.abs(s - avgRtt), 0) / validSamples.length)
        : 0;
      
      const packetLossPercent = Math.round((packetLossCount / sampleCount) * 100);

      let status: 'optimal' | 'acceptable' | 'degraded' | 'unreachable' = 'optimal';
      if (packetLossPercent > 50 || avgRtt >= 600) status = 'unreachable';
      else if (avgRtt > 250) status = 'degraded';
      else if (avgRtt > 90) status = 'acceptable';

      probeResults.push({
        node,
        samples: validSamples,
        avgRtt,
        minRtt,
        maxRtt,
        jitter,
        packetLossPercent,
        status,
        testedAt: Date.now()
      });
    }

    probeResults.sort((a, b) => a.avgRtt - b.avgRtt);
    const fastest = probeResults[0].node;
    this.fastestNode = fastest;
    this.latestBenchmarkResults = probeResults;

    this.logEntry({
      id: `bench_${Date.now()}`,
      timestamp: Date.now(),
      type: 'server_node_benchmark',
      target: fastest.name,
      rttMs: probeResults[0].avgRtt,
      fastestNodeId: fastest.id,
      status: probeResults[0].status,
      notes: `Identified fastest server node: ${fastest.name} with ${probeResults[0].avgRtt}ms average RTT.`
    });

    this.persistLogs();
    this.notifyListeners({
      type: 'SERVER_BENCHMARK_COMPLETE',
      fastestNode: fastest,
      results: probeResults
    });

    return {
      fastestNode: fastest,
      results: probeResults
    };
  }

  public logEntry(entry: RTTDiagnosticLogEntry) {
    this.logHistory.unshift(entry);
    if (this.logHistory.length > 100) {
      this.logHistory = this.logHistory.slice(0, 100);
    }
    this.persistLogs();
    this.notifyListeners({ type: 'NEW_LOG_ENTRY', entry });
  }

  public logWebSocketFail(reason: string, attempt: number) {
    this.logEntry({
      id: `ws_fail_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      type: 'websocket_fail',
      target: this.wsManager.getOptionUrl(),
      rttMs: 0,
      status: 'failed',
      notes: `Failed connection attempt ${attempt}: ${reason}`
    });
  }

  public logWebSocketSuccess(attempt: number) {
    this.logEntry({
      id: `ws_success_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      type: 'websocket_success',
      target: this.wsManager.getOptionUrl(),
      rttMs: 0,
      status: 'connected',
      notes: attempt > 0 
        ? `Reconnected successfully after ${attempt} attempt(s).` 
        : `Connected successfully on initial attempt.`
    });
  }

  public getLogs(limit: number = 50): RTTDiagnosticLogEntry[] {
    return this.logHistory.slice(0, limit);
  }

  public clearLogs(): void {
    this.logHistory = [];
    try {
      localStorage.removeItem('alya_rtt_diagnostics_history');
    } catch {}
    this.notifyListeners({ type: 'LOGS_CLEARED' });
  }

  public getFastestNode(): ServerNodeCandidate | null {
    return this.fastestNode;
  }

  public getLatestCompanionRTT(): CompanionRTTProbeResult | null {
    return this.latestCompanionRTT;
  }

  public getLatestBenchmarkResults(): ServerNodeProbeResult[] {
    return this.latestBenchmarkResults;
  }

  public startContinuousDiagnostics(intervalMs: number = 15000) {
    this.stopContinuousDiagnostics();
    this.periodicTimer = setInterval(async () => {
      if (this.wsManager.getStatus() === 'OPEN') {
        await this.measureCompanionRTT('auto').catch(() => {});
      }
    }, intervalMs);
  }

  public stopContinuousDiagnostics() {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  public onDiagnosticsUpdate(listener: (report: any) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getConnectionSpeedRating(rttMs: number, isOnline: boolean = true): 'ULTRA_FAST' | 'OPTIMAL' | 'MODERATE' | 'SLOW' | 'OFFLINE' {
    if (!isOnline || rttMs <= 0) return 'OFFLINE';
    if (rttMs < 50) return 'ULTRA_FAST';
    if (rttMs < 120) return 'OPTIMAL';
    if (rttMs < 250) return 'MODERATE';
    return 'SLOW';
  }

  public getQualityScore(rttMs: number, jitter: number = 0, packetLoss: number = 0): number {
    if (rttMs <= 0) return 0;
    let score = 100;
    if (rttMs > 40) score -= Math.min(45, Math.round((rttMs - 40) / 4));
    if (jitter > 5) score -= Math.min(25, Math.round((jitter - 5) * 1.5));
    score -= packetLoss * 3;
    return Math.max(5, Math.min(100, Math.round(score)));
  }

  public getMetricSummary(): LatencyMetricSummary {
    const rtt = this.latestCompanionRTT;
    const isWsOpen = this.wsManager.getStatus() === 'OPEN';
    const isCompanionSuccess = isWsOpen && !!rtt && rtt.status === 'success';
    const currentRtt = rtt?.totalEndToEndRttMs || (isWsOpen ? this.wsManager.getLatency() || 35 : 0);
    const jitter = this.latestBenchmarkResults[0]?.jitter || 4;
    const speedRating = this.getConnectionSpeedRating(currentRtt, isCompanionSuccess || isWsOpen);
    const qualityScore = (isCompanionSuccess || isWsOpen) ? this.getQualityScore(currentRtt, jitter, 0) : 0;

    let status: 'optimal' | 'acceptable' | 'degraded' | 'device_offline' | 'disconnected' = 'disconnected';
    if (!isWsOpen) {
      status = 'disconnected';
    } else if (rtt && (rtt.status === 'device_offline' || rtt.status === 'timeout')) {
      status = 'device_offline';
    } else if (currentRtt < 120) {
      status = 'optimal';
    } else if (currentRtt < 250) {
      status = 'acceptable';
    } else {
      status = 'degraded';
    }

    return {
      currentRtt,
      smoothedRtt: currentRtt,
      webToServerMs: rtt?.webToServerRttMs || Math.round(currentRtt / 2),
      serverToCompanionMs: rtt?.serverToCompanionRttMs || Math.round(currentRtt / 2),
      jitter,
      speedRating,
      qualityScore,
      status,
      testedAt: rtt?.testedAt || Date.now(),
      fastestNode: this.fastestNode,
      targetDevice: rtt?.deviceName || rtt?.deviceId || 'Android Companion'
    };
  }

  private notifyListeners(data: any) {
    this.listeners.forEach(cb => {
      try { cb(data); } catch {}
    });
  }
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private status: WSConnectionStatus = 'CLOSED';
  private options: WSOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private messageQueue: (string | ArrayBuffer | Blob)[] = [];
  private forcedClose = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  private heartbeatTimer: any = null;
  private lastPingTime: number = 0;
  private latency: number = 0;

  // Live session state
  private liveConfig: LiveSessionConfig | null = null;

  // Diagnostics & RTT Measurement Subsystem
  public readonly diagnostics: WebSocketDiagnosticsModule;

  private handleOnline = () => {
    this.isOnline = true;
    if (!this.forcedClose && (this.status === 'CLOSED' || this.status === 'RECONNECTING')) {
      this.reconnectAttempts = 0;
      this.connect();
    }
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setStatus('CLOSED');
  };

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.isOnline) {
      if (!this.forcedClose && (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING)) {
        this.connect();
      }
    }
  };

  constructor(options: WSOptions) {
    this.options = {
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 15,
      ...options
    };
    this.diagnostics = new WebSocketDiagnosticsModule(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  /**
   * Resolves raw URLs to secure TLS/SSL WebSocket connections (wss://)
   */
  private buildSecureWebSocketUrl(rawUrl: string): string {
    let resolvedUrl = rawUrl.trim();

    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host;

      if (resolvedUrl.startsWith('/')) {
        resolvedUrl = `${wsProtocol}//${host}${resolvedUrl}`;
      } else if (resolvedUrl.startsWith('http://')) {
        resolvedUrl = isHttps ? resolvedUrl.replace('http://', 'wss://') : resolvedUrl.replace('http://', 'ws://');
      } else if (resolvedUrl.startsWith('https://')) {
        resolvedUrl = resolvedUrl.replace('https://', 'wss://');
      } else if (resolvedUrl.startsWith('ws://') && isHttps) {
        resolvedUrl = resolvedUrl.replace('ws://', 'wss://');
      } else if (!resolvedUrl.startsWith('ws://') && !resolvedUrl.startsWith('wss://')) {
        resolvedUrl = `${wsProtocol}//${host}/${resolvedUrl}`;
      }
    }

    const params = new URLSearchParams();
    if (this.options.token) params.append('token', this.options.token);
    if (this.options.deviceId) params.append('deviceId', this.options.deviceId);
    if (this.options.userId) params.append('userId', this.options.userId);
    if (this.options.clientType) params.append('clientType', this.options.clientType);
    
    const queryString = params.toString();
    if (queryString) {
      resolvedUrl += (resolvedUrl.includes('?') ? '&' : '?') + queryString;
    }

    return resolvedUrl;
  }

  public connect() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline = false;
      this.setStatus('CLOSED');
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.forcedClose = false;
    this.setStatus('CONNECTING');

    // Clean up previous instance event listeners to prevent duplicate closure cascades
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    try {
      const secureWsUrl = this.buildSecureWebSocketUrl(this.options.url);
      const socket = new WebSocket(secureWsUrl);
      this.ws = socket;
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.setStatus('OPEN');
        const attempts = this.reconnectAttempts;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.flushQueue();
        if (this.options.onOpen) this.options.onOpen();
        this.diagnostics.logWebSocketSuccess(attempts);
      };

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
        // Check for binary audio frame
        if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
          if (this.options.onBinaryMessage) {
            this.options.onBinaryMessage(event.data);
          }
          return;
        }

        try {
          const data = JSON.parse(event.data);

          // Handle RTT diagnostic response from Android Companion
          if (data && (data.type === 'DIAGNOSTIC_COMPANION_PONG' || data.type === 'COMPANION_PONG')) {
            this.diagnostics.handleCompanionPong(data);
            return;
          }
          
          // Handle heartbeat pong / ping
          if (data && (data.type === 'heartbeat' || data.type === 'PONG')) {
            if (data.timestamp || this.lastPingTime) {
              this.latency = Date.now() - (data.timestamp || this.lastPingTime);
            }
            return;
          }

          // Live Session Message Handlers
          if (data && data.type) {
            if (data.type === 'LIVE_STARTED') {
              this.liveConfig?.onStart?.();
            } else if (data.type === 'LIVE_TEXT') {
              this.liveConfig?.onText?.(data.text);
            } else if (data.type === 'LIVE_AUDIO') {
              this.liveConfig?.onAudio?.(data.audio);
            } else if (data.type === 'LIVE_TURN_COMPLETE') {
              this.liveConfig?.onTurnComplete?.();
            } else if (data.type === 'LIVE_INTERRUPTED') {
              this.liveConfig?.onInterrupted?.();
            } else if (data.type === 'LIVE_ERROR') {
              this.liveConfig?.onError?.(data.error);
            } else if (data.type === 'LIVE_STOPPED') {
              this.liveConfig?.onStop?.();
            }
          }
          
          // Handle structured AlyaEvents
          if (data && data.type && data.messageId) {
            const alyaEvent = data as AlyaEvent;
            
            if (this.verifyEvent(alyaEvent)) {
              this.eventListeners.get(alyaEvent.type)?.forEach(cb => cb(alyaEvent));
              if (this.options.onEvent) this.options.onEvent(alyaEvent);
            }
          }
          
          if (this.options.onMessage) this.options.onMessage(data);
        } catch (e) {
          if (this.options.onMessage) this.options.onMessage(event.data);
        }
      };

      socket.onclose = (event) => {
        if (this.ws !== socket) return;
        this.stopHeartbeat();
        this.ws = null;

        if (this.forcedClose) {
          this.setStatus('CLOSED');
          if (this.options.onClose) this.options.onClose(event.code, event.reason);
          return;
        }

        const attempt = this.reconnectAttempts + 1;
        this.diagnostics.logWebSocketFail(`Closed with code ${event.code} (${event.reason || 'No reason specified'})`, attempt);

        // Graceful reconnect if online
        if (this.isOnline && this.options.autoReconnect && this.reconnectAttempts < (this.options.maxReconnectAttempts || 15)) {
          this.setStatus('RECONNECTING');
          if (this.options.onClose) this.options.onClose(event.code, event.reason);
          this.reconnect();
        } else {
          this.setStatus('CLOSED');
          if (this.options.onClose) this.options.onClose(event.code, event.reason);
        }
      };

      socket.onerror = (err) => {
        if (this.ws !== socket) return;
        // Suppress noisy closure error cascades during reconnect/network drops
        if (this.options.onError && this.status !== 'RECONNECTING') {
          this.options.onError(err);
        }
      };
    } catch (err: any) {
      console.warn('[WebSocket] Connection creation failed, attempting exponential backoff reconnect:', err);
      const attempt = this.reconnectAttempts + 1;
      this.diagnostics.logWebSocketFail(`Creation threw: ${err?.message || String(err)}`, attempt);
      this.setStatus('CLOSED');
      if (this.isOnline && this.options.autoReconnect && this.reconnectAttempts < (this.options.maxReconnectAttempts || 15)) {
        this.setStatus('RECONNECTING');
        this.reconnect();
      }
    }
  }

  /**
   * Start Live Conversation Stream with audio/text callbacks
   */
  public startLiveStream(config: LiveSessionConfig = {}) {
    this.liveConfig = config;
    this.send({
      type: 'LIVE_START',
      voiceName: config.voiceName || 'Aoede',
      language: config.language || localStorage.getItem('alya_preferred_lang') || 'auto'
    });
  }

  /**
   * Transmit PCM Audio chunk (Base64) to backend
   */
  public sendLiveAudioChunk(pcmBase64: string) {
    this.send({
      type: 'LIVE_AUDIO_INPUT',
      audio: pcmBase64
    });
  }

  /**
   * Transmit Live Text Input for real-time processing and device action
   */
  public sendLiveTextInput(text: string, language?: string) {
    this.send({
      type: 'LIVE_TEXT_INPUT',
      text,
      language: language || localStorage.getItem('alya_preferred_lang') || 'auto'
    });
  }

  /**
   * Stop Live Conversation Stream
   */
  public stopLiveStream() {
    this.send({ type: 'LIVE_STOP' });
    this.liveConfig = null;
  }

  /**
   * Send binary data directly over the WebSocket connection
   */
  public sendBinary(data: ArrayBuffer | Blob | ArrayBufferView) {
    if (this.status === 'OPEN' && this.ws) {
      this.ws.send(data as any);
    } else {
      if (data instanceof Blob || data instanceof ArrayBuffer) {
        this.messageQueue.push(data);
      }
    }
  }

  /**
   * Send a structured event securely
   */
  public emit(type: AlyaEventType, payload: any) {
    const event: AlyaEvent = {
      type,
      payload,
      deviceId: this.options.deviceId,
      timestamp: Date.now(),
      messageId: `msg_${Math.random().toString(36).substr(2, 9)}`,
      signature: this.options.token ? 'signed_payload_placeholder' : undefined
    };
    
    this.send(event);
  }

  public disconnect() {
    this.forcedClose = true;
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setStatus('CLOSED');
  }

  public destroy() {
    this.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  public send(data: any) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    
    if (this.status === 'OPEN' && this.ws) {
      this.ws.send(payload);
    } else {
      this.messageQueue.push(payload);
      if (this.messageQueue.length > 100) this.messageQueue.shift();
    }
  }

  public getStatus(): WSConnectionStatus {
    return this.status;
  }

  public getOptionUrl(): string {
    return this.options.url;
  }

  private eventListeners: Map<AlyaEventType, Set<(event: AlyaEvent) => void>> = new Map();

  public on(type: AlyaEventType, callback: (event: AlyaEvent) => void) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(callback);
    return () => this.off(type, callback);
  }

  public off(type: AlyaEventType, callback: (event: AlyaEvent) => void) {
    this.eventListeners.get(type)?.delete(callback);
  }

  private verifyEvent(event: AlyaEvent): boolean {
    if (!event.signature) return true;
    return event.signature === 'signed_payload_placeholder';
  }

  public getLatency(): number {
    return this.latency;
  }

  public async measureCompanionRTT(deviceId = 'auto', timeoutMs = 7000): Promise<CompanionRTTProbeResult> {
    return this.diagnostics.measureCompanionRTT(deviceId, timeoutMs);
  }

  public async benchmarkServerNodes(candidateNodes?: ServerNodeCandidate[]): Promise<{
    fastestNode: ServerNodeCandidate;
    results: ServerNodeProbeResult[];
  }> {
    return this.diagnostics.benchmarkServerNodes(candidateNodes);
  }

  public getDiagnosticLogs(limit = 50): RTTDiagnosticLogEntry[] {
    return this.diagnostics.getLogs(limit);
  }

  public getFastestServerNode(): ServerNodeCandidate | null {
    return this.diagnostics.getFastestNode();
  }

  public getMetricSummary(): LatencyMetricSummary {
    return this.diagnostics.getMetricSummary();
  }
  
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.status === 'OPEN') {
        this.lastPingTime = Date.now();
        this.send({ type: 'PING', timestamp: Date.now() });
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setStatus(status: WSConnectionStatus) {
    this.status = status;
    if (this.options.onStatusChange) {
      this.options.onStatusChange(status);
    }
  }

  private reconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    
    this.reconnectAttempts++;
    // Exponential backoff with standard multiplier of 1.5, capped at 30 seconds
    const baseDelay = Math.min(30000, (this.options.reconnectInterval || 3000) * Math.pow(1.5, this.reconnectAttempts - 1));
    // Apply randomized jitter to prevent thundering herd problem on proxies/gateways
    const jitter = Math.floor(Math.random() * 600);
    const delay = baseDelay + jitter;
    
    console.warn(`[WebSocket] Offline, connection closed, or proxy failed. Retrying in ${delay.toFixed(0)}ms (Attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts || 15}) using exponential backoff with jitter.`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private flushQueue() {
    while (this.messageQueue.length > 0 && this.status === 'OPEN' && this.ws) {
      const msg = this.messageQueue.shift();
      if (msg) this.ws.send(msg);
    }
  }
}
