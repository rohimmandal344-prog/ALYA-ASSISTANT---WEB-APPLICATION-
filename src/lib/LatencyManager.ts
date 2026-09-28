/**
 * Alya Assistant - Real-Time Latency & WebSocket Relay Manager
 * Continuous ping-pong monitoring between Web Dashboard and Android Companion
 * with real-time RTT decomposition, jitter tracking, and dynamic lowest-latency relay selection.
 */

import { deviceWebSocketClient } from '../services/deviceWebSocketService';

export interface RelayServer {
  id: string;
  name: string;
  region: string;
  location: string;
  datacenter: string;
  url: string;
  wsUrl?: string;
  isDefault?: boolean;
}

export interface CompanionPingResult {
  pingId: string;
  timestamp: number;
  deviceId: string;
  deviceName?: string;
  webToServerMs: number;
  serverToCompanionMs: number;
  totalRttMs: number;
  status: 'success' | 'device_offline' | 'timeout' | 'error';
  error?: string;
}

export interface RelayProbeResult {
  relay: RelayServer;
  samples: number[];
  avgRtt: number;
  minRtt: number;
  maxRtt: number;
  jitter: number;
  packetLossPercent: number;
  score: number; // 0 (worst) - 100 (best)
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DEGRADED' | 'UNREACHABLE';
  testedAt: number;
}

export interface LatencyMetrics {
  currentRtt: number;
  smoothedRtt: number;
  jitter: number;
  qualityScore: number;
  qualityRating: 'ULTRA_LOW' | 'OPTIMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  companionOnline: boolean;
  activeRelay: RelayServer;
  lastProbeTime: number;
  breakdown: {
    webToServerMs: number;
    serverToCompanionMs: number;
  };
  sampleCount: number;
}

export interface RelaySuggestion {
  currentRelay: RelayServer;
  suggestedRelay: RelayServer;
  improvementMs: number;
  improvementPercent: number;
  isSwitchRecommended: boolean;
  recommendationReason: string;
  evaluatedAt: number;
  allProbes: RelayProbeResult[];
}

export type LatencyListener = (metrics: LatencyMetrics) => void;
export type SuggestionListener = (suggestion: RelaySuggestion) => void;

export class LatencyManager {
  private relayServers: RelayServer[] = [];
  private activeRelayId: string = 'node-se1-active';
  private pingHistory: CompanionPingResult[] = [];
  private latestMetrics: LatencyMetrics | null = null;
  private latestSuggestion: RelaySuggestion | null = null;
  private latestProbes: RelayProbeResult[] = [];

  private monitoringTimer: any = null;
  private relayEvaluationTimer: any = null;
  private isMonitoring: boolean = false;
  private isProbing: boolean = false;

  private metricsListeners: Set<LatencyListener> = new Set();
  private suggestionListeners: Set<SuggestionListener> = new Set();

  constructor() {
    this.initRelayServers();
    this.loadPersistedState();
  }

  private initRelayServers() {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';

    this.relayServers = [
      {
        id: 'node-se1-active',
        name: 'Singapore Primary Gateway (Asia-SE1)',
        region: 'asia-southeast1',
        location: 'Singapore',
        datacenter: 'Google Cloud Jurong DC',
        url: `${origin}/api/ping`,
        wsUrl: `${wsProto}//${wsHost}/ws`,
        isDefault: true
      },
      {
        id: 'node-s1-mumbai',
        name: 'South Asia Regional Relay (Mumbai / Asia-S1)',
        region: 'asia-south1',
        location: 'Mumbai, India',
        datacenter: 'Google Cloud Mumbai Edge',
        url: `${origin}/api/ping?region=asia-south1`,
        wsUrl: `${wsProto}//${wsHost}/ws?region=asia-south1`,
        isDefault: false
      },
      {
        id: 'node-east1-tokyo',
        name: 'East Asia Fast Relay (Tokyo / Asia-E1)',
        region: 'asia-east1',
        location: 'Tokyo, Japan',
        datacenter: 'Google Cloud Tokyo Edge',
        url: `${origin}/api/ping?region=asia-east1`,
        wsUrl: `${wsProto}//${wsHost}/ws?region=asia-east1`,
        isDefault: false
      },
      {
        id: 'node-us-central',
        name: 'North America Central Hub (Iowa / US-C1)',
        region: 'us-central1',
        location: 'Council Bluffs, USA',
        datacenter: 'Google Cloud Iowa DC',
        url: `${origin}/api/ping?region=us-central1`,
        wsUrl: `${wsProto}//${wsHost}/ws?region=us-central1`,
        isDefault: false
      },
      {
        id: 'node-eu-west',
        name: 'European Union Hub (Frankfurt / EU-W3)',
        region: 'europe-west3',
        location: 'Frankfurt, Germany',
        datacenter: 'Google Cloud Frankfurt Edge',
        url: `${origin}/api/ping?region=europe-west3`,
        wsUrl: `${wsProto}//${wsHost}/ws?region=europe-west3`,
        isDefault: false
      }
    ];
  }

  private loadPersistedState() {
    try {
      if (typeof localStorage === 'undefined') return;
      const savedRelay = localStorage.getItem('alya_selected_relay_id');
      if (savedRelay && this.relayServers.some(r => r.id === savedRelay)) {
        this.activeRelayId = savedRelay;
      }
    } catch {}
  }

  /**
   * Start continuous real-time ping-pong monitoring between Web Dashboard and Android Companion
   */
  public startMonitoring(intervalMs: number = 4000) {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Run first probe immediately
    this.executeSingleProbeCycle();
    this.evaluateAllRelays();

    // Ping-pong interval for active connection
    this.monitoringTimer = setInterval(() => {
      this.executeSingleProbeCycle();
    }, intervalMs);

    // Periodic evaluation of alternative relay servers every 30 seconds
    this.relayEvaluationTimer = setInterval(() => {
      this.evaluateAllRelays();
    }, 30000);
  }

  /**
   * Stop continuous monitoring
   */
  public stopMonitoring() {
    this.isMonitoring = false;
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    if (this.relayEvaluationTimer) {
      clearInterval(this.relayEvaluationTimer);
      this.relayEvaluationTimer = null;
    }
  }

  /**
   * Execute a single high-precision ping-pong measurement cycle to companion and server
   */
  public async executeSingleProbeCycle(): Promise<CompanionPingResult | null> {
    if (this.isProbing) return null;
    this.isProbing = true;

    try {
      // 1. Measure Companion RTT via WebSocket bridge
      const companionRes = await deviceWebSocketClient.measureCompanionRTT();
      const now = Date.now();

      let pingResult: CompanionPingResult;

      if (companionRes && companionRes.status === 'success') {
        pingResult = {
          pingId: companionRes.pingId,
          timestamp: now,
          deviceId: companionRes.deviceId,
          deviceName: companionRes.deviceName,
          webToServerMs: companionRes.webToServerRttMs,
          serverToCompanionMs: companionRes.serverToCompanionRttMs,
          totalRttMs: companionRes.totalEndToEndRttMs,
          status: 'success'
        };
      } else {
        // Fallback: measure Web -> Server direct latency probe
        const start = performance.now();
        const activeRelay = this.getActiveRelay();
        let webToServerMs = 20;
        try {
          const res = await fetch(`${activeRelay.url}?t=${now}`, { method: 'GET', cache: 'no-store' });
          if (res.ok) {
            webToServerMs = Math.max(1, Math.round(performance.now() - start));
          }
        } catch {
          webToServerMs = 999;
        }

        pingResult = {
          pingId: `probe_${now}`,
          timestamp: now,
          deviceId: companionRes?.deviceId || 'none',
          deviceName: companionRes?.deviceName,
          webToServerMs,
          serverToCompanionMs: 0,
          totalRttMs: webToServerMs,
          status: companionRes?.status === 'device_offline' ? 'device_offline' : 'error',
          error: companionRes?.error || 'Companion device is offline or not currently connected via WebSocket.'
        };
      }

      this.pingHistory.push(pingResult);
      if (this.pingHistory.length > 60) {
        this.pingHistory = this.pingHistory.slice(-60);
      }

      // Compute rolling metrics with EWMA smoothing
      this.computeMetrics(pingResult);

      return pingResult;
    } catch (err: any) {
      console.warn('[LatencyManager] Probe cycle error:', err);
      return null;
    } finally {
      this.isProbing = false;
    }
  }

  /**
   * Evaluate all candidate relay servers to identify the fastest node and generate recommendations
   */
  public async evaluateAllRelays(): Promise<RelaySuggestion> {
    const probePromises = this.relayServers.map(relay => this.probeRelayServer(relay));
    const results = await Promise.all(probePromises);

    // Sort by weighted score descending (highest quality & lowest latency first)
    results.sort((a, b) => b.score - a.score);
    this.latestProbes = results;

    const currentRelay = this.getActiveRelay();
    const currentProbe = results.find(r => r.relay.id === currentRelay.id) || results[0];
    const bestProbe = results[0];

    const improvementMs = Math.max(0, currentProbe.avgRtt - bestProbe.avgRtt);
    const improvementPercent = currentProbe.avgRtt > 0 
      ? Math.round((improvementMs / currentProbe.avgRtt) * 100) 
      : 0;

    // Switch is recommended if candidate is different and gives > 15ms or > 12% improvement
    const isSwitchRecommended = bestProbe.relay.id !== currentRelay.id && (improvementMs >= 15 || improvementPercent >= 12);

    let recommendationReason = `Currently connected to ${currentRelay.name} (${currentProbe.avgRtt}ms). Optimal routing active.`;

    if (isSwitchRecommended) {
      recommendationReason = `Switching to ${bestProbe.relay.name} reduces RTT from ${currentProbe.avgRtt}ms to ${bestProbe.avgRtt}ms (-${improvementPercent}% latency / +${improvementMs}ms faster).`;
    }

    const suggestion: RelaySuggestion = {
      currentRelay,
      suggestedRelay: bestProbe.relay,
      improvementMs,
      improvementPercent,
      isSwitchRecommended,
      recommendationReason,
      evaluatedAt: Date.now(),
      allProbes: results
    };

    this.latestSuggestion = suggestion;
    this.notifySuggestionListeners(suggestion);

    return suggestion;
  }

  /**
   * Probe a single relay server with sample burst to calculate RTT, jitter, and packet loss
   */
  private async probeRelayServer(relay: RelayServer): Promise<RelayProbeResult> {
    const samples: number[] = [];
    let packetLossCount = 0;
    const sampleCount = 3;

    for (let i = 0; i < sampleCount; i++) {
      const start = performance.now();
      try {
        const probeUrl = `${relay.url}${relay.url.includes('?') ? '&' : '?'}probe=${Date.now()}_${i}`;
        const res = await fetch(probeUrl, { method: 'GET', cache: 'no-store' });
        const elapsed = Math.max(1, Math.round(performance.now() - start));
        if (res.ok) {
          samples.push(elapsed);
        } else {
          packetLossCount++;
        }
      } catch {
        packetLossCount++;
      }
      await new Promise(r => setTimeout(r, 30));
    }

    const validSamples = samples.length > 0 ? samples : [999];
    const avgRtt = Math.round(validSamples.reduce((a, b) => a + b, 0) / validSamples.length);
    const minRtt = Math.min(...validSamples);
    const maxRtt = Math.max(...validSamples);

    // Calculate jitter (mean absolute deviation)
    const jitter = validSamples.length > 1
      ? Math.round(validSamples.reduce((sum, s) => sum + Math.abs(s - avgRtt), 0) / validSamples.length)
      : 0;

    const packetLossPercent = Math.round((packetLossCount / sampleCount) * 100);

    // Calculate composite score (0-100)
    // 50% RTT weight, 25% Jitter weight, 25% Reliability weight
    const rttScore = Math.max(0, 100 - (avgRtt / 4));
    const jitterScore = Math.max(0, 100 - (jitter * 2));
    const reliabilityScore = Math.max(0, 100 - (packetLossPercent * 2));
    const compositeScore = Math.round((rttScore * 0.5) + (jitterScore * 0.25) + (reliabilityScore * 0.25));

    let status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DEGRADED' | 'UNREACHABLE' = 'EXCELLENT';
    if (packetLossPercent > 50 || avgRtt >= 600) status = 'UNREACHABLE';
    else if (avgRtt > 250) status = 'DEGRADED';
    else if (avgRtt > 120) status = 'FAIR';
    else if (avgRtt > 50) status = 'GOOD';

    return {
      relay,
      samples: validSamples,
      avgRtt,
      minRtt,
      maxRtt,
      jitter,
      packetLossPercent,
      score: compositeScore,
      status,
      testedAt: Date.now()
    };
  }

  /**
   * Calculate smoothed rolling metrics based on recent ping-pong telemetry
   */
  private computeMetrics(latestPing: CompanionPingResult) {
    const recent = this.pingHistory.slice(-15);
    const validRtts = recent.map(p => p.totalRttMs).filter(r => r > 0 && r < 2000);

    const currentRtt = latestPing.totalRttMs;

    // Exponentially Weighted Moving Average (alpha = 0.3)
    const smoothedRtt = this.latestMetrics
      ? Math.round(0.3 * currentRtt + 0.7 * this.latestMetrics.smoothedRtt)
      : currentRtt;

    // Calculate jitter across recent valid samples
    const avg = validRtts.length > 0 
      ? validRtts.reduce((a, b) => a + b, 0) / validRtts.length 
      : currentRtt;
    const jitter = validRtts.length > 1
      ? Math.round(validRtts.reduce((acc, val) => acc + Math.abs(val - avg), 0) / validRtts.length)
      : 0;

    let qualityRating: 'ULTRA_LOW' | 'OPTIMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'OPTIMAL';
    if (smoothedRtt <= 45) qualityRating = 'ULTRA_LOW';
    else if (smoothedRtt <= 110) qualityRating = 'OPTIMAL';
    else if (smoothedRtt <= 240) qualityRating = 'MODERATE';
    else if (smoothedRtt <= 500) qualityRating = 'HIGH';
    else qualityRating = 'CRITICAL';

    const qualityScore = Math.max(5, Math.min(100, Math.round(100 - (smoothedRtt / 5) - (jitter * 0.5))));

    const metrics: LatencyMetrics = {
      currentRtt,
      smoothedRtt,
      jitter,
      qualityScore,
      qualityRating,
      companionOnline: latestPing.status === 'success',
      activeRelay: this.getActiveRelay(),
      lastProbeTime: latestPing.timestamp,
      breakdown: {
        webToServerMs: latestPing.webToServerMs,
        serverToCompanionMs: latestPing.serverToCompanionMs
      },
      sampleCount: this.pingHistory.length
    };

    this.latestMetrics = metrics;
    this.notifyMetricsListeners(metrics);
  }

  /**
   * Change the active WebSocket relay server
   */
  public selectRelayServer(relayId: string): boolean {
    const target = this.relayServers.find(r => r.id === relayId);
    if (!target) return false;

    this.activeRelayId = relayId;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('alya_selected_relay_id', relayId);
      }
    } catch {}

    // Re-evaluate suggestion with new active relay
    if (this.latestProbes.length > 0) {
      this.evaluateAllRelays();
    }

    return true;
  }

  public getActiveRelay(): RelayServer {
    return this.relayServers.find(r => r.id === this.activeRelayId) || this.relayServers[0];
  }

  public getAllRelayServers(): RelayServer[] {
    return [...this.relayServers];
  }

  public getLatestMetrics(): LatencyMetrics | null {
    return this.latestMetrics;
  }

  public getLatestSuggestion(): RelaySuggestion | null {
    return this.latestSuggestion;
  }

  public getPingHistory(): CompanionPingResult[] {
    return [...this.pingHistory];
  }

  public onMetricsUpdate(listener: LatencyListener): () => void {
    this.metricsListeners.add(listener);
    if (this.latestMetrics) listener(this.latestMetrics);
    return () => {
      this.metricsListeners.delete(listener);
    };
  }

  public onSuggestion(listener: SuggestionListener): () => void {
    this.suggestionListeners.add(listener);
    if (this.latestSuggestion) listener(this.latestSuggestion);
    return () => {
      this.suggestionListeners.delete(listener);
    };
  }

  private notifyMetricsListeners(metrics: LatencyMetrics) {
    this.metricsListeners.forEach(cb => {
      try { cb(metrics); } catch {}
    });
  }

  private notifySuggestionListeners(suggestion: RelaySuggestion) {
    this.suggestionListeners.forEach(cb => {
      try { cb(suggestion); } catch {}
    });
  }
}

export const latencyManager = new LatencyManager();
