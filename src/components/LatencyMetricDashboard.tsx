import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gauge, 
  Activity, 
  Wifi, 
  Smartphone, 
  Server, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  Trash2, 
  Radio, 
  Sparkles, 
  Search, 
  Clock, 
  Cpu,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { 
  CompanionRTTProbeResult, 
  ServerNodeProbeResult, 
  RTTDiagnosticLogEntry, 
  ServerNodeCandidate,
  LatencyMetricSummary 
} from '../lib/WebSocketManager';
import { deviceWebSocketClient } from '../services/deviceWebSocketService';
import { latencyManager } from '../lib/LatencyManager';

export interface LatencyMetricDashboardProps {
  className?: string;
  onClose?: () => void;
  isStandalone?: boolean;
}

export function LatencyMetricDashboard({ className = '', onClose, isStandalone = false }: LatencyMetricDashboardProps) {
  // State
  const [metricSummary, setMetricSummary] = useState<LatencyMetricSummary | null>(() => {
    return deviceWebSocketClient.getMetricSummary();
  });
  const [companionRtt, setCompanionRtt] = useState<CompanionRTTProbeResult | null>(() => {
    return deviceWebSocketClient.diagnostics?.getLatestCompanionRTT() || null;
  });
  const [nodeBenchmarks, setNodeBenchmarks] = useState<ServerNodeProbeResult[]>(() => {
    return deviceWebSocketClient.diagnostics?.getLatestBenchmarkResults() || [];
  });
  const [fastestNode, setFastestNode] = useState<ServerNodeCandidate | null>(() => {
    return deviceWebSocketClient.getFastestServerNode();
  });
  const [logs, setLogs] = useState<RTTDiagnosticLogEntry[]>(() => {
    return deviceWebSocketClient.getDiagnosticLogs(50);
  });

  const [isPinging, setIsPinging] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [autoProbeInterval, setAutoProbeInterval] = useState<number>(0); // 0 = off, or 4000, 8000
  const [searchFilter, setSearchFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'companion_rtt' | 'server_node_benchmark'>('all');
  const [lastProbeSuccessAt, setLastProbeSuccessAt] = useState<number | null>(null);

  // Sync state from diagnostics module
  const refreshLocalState = useCallback(() => {
    const summary = deviceWebSocketClient.getMetricSummary();
    if (summary) setMetricSummary(summary);
    
    if (deviceWebSocketClient.diagnostics) {
      const rtt = deviceWebSocketClient.diagnostics.getLatestCompanionRTT();
      if (rtt) setCompanionRtt(rtt);
      
      const bench = deviceWebSocketClient.diagnostics.getLatestBenchmarkResults();
      if (bench.length > 0) setNodeBenchmarks(bench);
      
      const fastest = deviceWebSocketClient.diagnostics.getFastestNode();
      if (fastest) setFastestNode(fastest);
    }
    
    const currentLogs = deviceWebSocketClient.getDiagnosticLogs(50);
    setLogs(currentLogs);
  }, []);

  // Subscribe to live diagnostics updates from WebSocketDiagnosticsModule
  useEffect(() => {
    refreshLocalState();

    let unsub: (() => void) | undefined;
    if (deviceWebSocketClient.diagnostics) {
      unsub = deviceWebSocketClient.diagnostics.onDiagnosticsUpdate((report: any) => {
        refreshLocalState();
        if (report?.type === 'COMPANION_RTT_UPDATE' && report?.result?.status === 'success') {
          setLastProbeSuccessAt(Date.now());
        }
      });
    }

    // Also poll every 2.5s for freshness
    const interval = setInterval(refreshLocalState, 2500);

    return () => {
      if (unsub) unsub();
      clearInterval(interval);
    };
  }, [refreshLocalState]);

  // Handle continuous auto-probe interval
  useEffect(() => {
    if (autoProbeInterval <= 0) {
      deviceWebSocketClient.diagnostics?.stopContinuousDiagnostics();
      return;
    }

    deviceWebSocketClient.diagnostics?.startContinuousDiagnostics(autoProbeInterval);

    return () => {
      deviceWebSocketClient.diagnostics?.stopContinuousDiagnostics();
    };
  }, [autoProbeInterval]);

  // Run companion RTT measurement
  const handleMeasureCompanionRTT = async () => {
    setIsPinging(true);
    try {
      const result = await deviceWebSocketClient.measureCompanionRTT();
      if (result) {
        setCompanionRtt(result);
        if (result.status === 'success') {
          setLastProbeSuccessAt(Date.now());
        }
      }
      refreshLocalState();
    } catch (err) {
      console.warn('[LatencyDashboard] Ping error:', err);
    } finally {
      setIsPinging(false);
    }
  };

  // Run multi-region server node benchmark
  const handleBenchmarkNodes = async () => {
    setIsBenchmarking(true);
    try {
      const result = await deviceWebSocketClient.benchmarkServerNodes();
      if (result) {
        setFastestNode(result.fastestNode);
        setNodeBenchmarks(result.results);
      }
      refreshLocalState();
    } catch (err) {
      console.warn('[LatencyDashboard] Benchmark error:', err);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleClearLogs = () => {
    deviceWebSocketClient.diagnostics?.clearLogs();
    setLogs([]);
  };

  // Calculations for Speedometer & Quality
  const currentRtt = companionRtt?.totalEndToEndRttMs || metricSummary?.currentRtt || 38;
  const webToServer = companionRtt?.webToServerRttMs || metricSummary?.webToServerMs || Math.round(currentRtt / 2);
  const serverToCompanion = companionRtt?.serverToCompanionRttMs || metricSummary?.serverToCompanionMs || Math.round(currentRtt / 2);
  const jitter = metricSummary?.jitter || (nodeBenchmarks[0]?.jitter ?? 3);
  const qualityScore = metricSummary?.qualityScore ?? Math.max(10, Math.min(100, 100 - Math.round(currentRtt / 4)));

  const speedTier = useMemo(() => {
    if (currentRtt <= 0 || metricSummary?.status === 'disconnected') {
      return {
        label: 'Disconnected',
        color: 'text-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
        badge: 'Offline',
        description: 'WebSocket gateway offline or disconnected.'
      };
    }
    if (currentRtt < 50) {
      return {
        label: 'Ultra-Fast',
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        badge: '⚡ Ultra-Low Latency (<50ms)',
        description: 'Exceptional link speed. Immediate voice barge-in and real-time Android device control.'
      };
    }
    if (currentRtt < 120) {
      return {
        label: 'Optimal',
        color: 'text-teal-500',
        bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
        badge: '✓ Optimal Interactivity (<120ms)',
        description: 'Smooth real-time experience with imperceptible delay across WebSocket.'
      };
    }
    if (currentRtt < 250) {
      return {
        label: 'Moderate',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        badge: '⚠️ Moderate Latency (<250ms)',
        description: 'Acceptable responsiveness. Occasional packet delay or mobile cellular handoff.'
      };
    }
    return {
      label: 'High Latency',
      color: 'text-red-500',
      bg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      badge: '❌ High Latency (>250ms)',
      description: 'Network congestion or far server region detected. Edge relay switch recommended.'
    };
  }, [currentRtt, metricSummary?.status]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (activeCategory !== 'all' && log.type !== activeCategory) return false;
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        return (
          log.target.toLowerCase().includes(query) ||
          log.notes.toLowerCase().includes(query) ||
          log.status.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [logs, activeCategory, searchFilter]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner & Control Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  RTT & Connection Speed Diagnostics
                </h2>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${speedTier.bg}`}>
                  {speedTier.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time Round Trip Time measurement between Web Dashboard, Gateway, and Android Companion.
              </p>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleMeasureCompanionRTT}
              disabled={isPinging}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <Activity className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isPinging ? 'Measuring RTT...' : 'Ping Companion'}</span>
            </button>

            <button
              onClick={handleBenchmarkNodes}
              disabled={isBenchmarking}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Server className={`w-4 h-4 ${isBenchmarking ? 'animate-bounce text-indigo-500' : ''}`} />
              <span>{isBenchmarking ? 'Probing Nodes...' : 'Benchmark Edge Nodes'}</span>
            </button>
          </div>
        </div>

        {/* Speedometer & Primary Latency Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          {/* Main Visual Latency Speedometer Gauge Card */}
          <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center justify-center text-center relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-12 -left-12 w-40 h-40 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              End-to-End Latency
            </span>

            {/* Circular Gauge Representation */}
            <div className="relative w-44 h-44 my-2 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                {/* Background track circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-200 dark:text-slate-700"
                  fill="transparent"
                />
                {/* Dynamic colored progress arc */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={264}
                  strokeDashoffset={Math.max(0, 264 - (264 * Math.min(100, Math.max(5, 100 - (currentRtt / 3)))) / 100)}
                  strokeLinecap="round"
                  className={`transition-all duration-700 ${
                    currentRtt < 50
                      ? 'text-emerald-500'
                      : currentRtt < 120
                      ? 'text-teal-500'
                      : currentRtt < 250
                      ? 'text-amber-500'
                      : 'text-red-500'
                  }`}
                  fill="transparent"
                />
              </svg>

              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                  {currentRtt > 0 ? currentRtt : '--'}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  ms RTT
                </span>
              </div>
            </div>

            <div className="mt-1 flex items-center gap-1.5 font-bold text-xs">
              <span className={`w-2 h-2 rounded-full ${
                currentRtt < 50 ? 'bg-emerald-500 animate-pulse' : currentRtt < 120 ? 'bg-teal-500' : 'bg-amber-500'
              }`} />
              <span className="text-slate-700 dark:text-slate-300">{speedTier.badge}</span>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 max-w-xs leading-relaxed">
              {speedTier.description}
            </p>
          </div>

          {/* Hop Breakdown & Quality Metrics */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Hop 1: Web to Gateway */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Web ➔ Gateway</span>
                  <Wifi className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                    {webToServer}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">ms</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Client to cloud relay</span>
              </div>

              {/* Hop 2: Gateway to Android Companion */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Gateway ➔ Android</span>
                  <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {serverToCompanion}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">ms</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Phone WebSocket link</span>
              </div>

              {/* Jitter Stability */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Jitter & Drift</span>
                  <Activity className="w-3.5 h-3.5 text-cyan-500" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black font-mono text-slate-800 dark:text-slate-200">
                    ±{jitter}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">ms</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Packet delay variation</span>
              </div>
            </div>

            {/* Quality Score Bar */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  Connection Quality Health Score
                </span>
                <span className={`font-mono font-extrabold ${
                  qualityScore > 80 ? 'text-emerald-500' : qualityScore > 50 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {qualityScore}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    qualityScore > 80
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : qualityScore > 50
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${qualityScore}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span>0% (Degraded)</span>
                <span>Target: &gt;85% for Ultra-Low Latency Live API</span>
                <span>100% (Lossless)</span>
              </div>
            </div>

            {/* Continuous Diagnostics Auto-Probe Interval Bar */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Continuous RTT Monitoring
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { label: 'Off', val: 0 },
                  { label: '3s', val: 3000 },
                  { label: '5s', val: 5000 },
                  { label: '10s', val: 10000 }
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setAutoProbeInterval(item.val)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      autoProbeInterval === item.val
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Region Edge Server Node Leaderboard */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Multi-Region Edge Gateway Leaderboard
                </h3>
                {fastestNode && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Fastest: {fastestNode.region}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Benchmarks all distributed nodes to route WebSocket commands to the lowest-latency edge.
              </p>
            </div>
          </div>

          <button
            onClick={handleBenchmarkNodes}
            disabled={isBenchmarking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBenchmarking ? 'animate-spin text-teal-500' : ''}`} />
            <span>Re-Benchmark All</span>
          </button>
        </div>

        {/* Node benchmark cards */}
        {nodeBenchmarks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {nodeBenchmarks.map((probe, idx) => {
              const isFastest = idx === 0 || probe.node.id === fastestNode?.id;
              return (
                <div
                  key={probe.node.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isFastest
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500/30 shadow-xs'
                      : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        isFastest ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`} />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {probe.node.name}
                      </span>
                      {isFastest && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase bg-emerald-500 text-white tracking-wider">
                          FASTEST
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Region: {probe.node.region} • Jitter: ±{probe.jitter}ms • Loss: {probe.packetLossPercent}%
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className={`text-lg font-black font-mono ${
                        probe.avgRtt < 100
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : probe.avgRtt < 250
                          ? 'text-amber-500'
                          : 'text-red-500'
                      }`}>
                        {probe.avgRtt}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">ms</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">Min: {probe.minRtt}ms</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
            <p className="text-xs text-slate-500">
              No server benchmarks recorded yet. Click <b>"Benchmark Edge Nodes"</b> above to test all candidate gateways.
            </p>
          </div>
        )}
      </div>

      {/* Real-Time RTT Diagnostic Log Stream */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Live RTT Diagnostic Telemetry Log
              </h3>
              <p className="text-xs text-slate-500">
                Granular timestamps and hop-by-hop latency logs stored in local session.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {(['all', 'companion_rtt', 'server_node_benchmark'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat === 'companion_rtt' ? 'Companion' : 'Nodes'}
                </button>
              ))}
            </div>

            <button
              onClick={handleClearLogs}
              title="Clear Logs"
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search diagnostic events by target or note..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Logs Table / List */}
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((entry) => (
              <div key={entry.id} className="pt-2 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {entry.target}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      entry.status === 'success' || entry.status === 'optimal'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : entry.status === 'acceptable'
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}>
                      {entry.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    {entry.notes}
                  </p>
                  {entry.breakdown && (
                    <p className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400">
                      Web ➔ Gateway: {entry.breakdown.webToServerMs}ms • Gateway ➔ App: {entry.breakdown.serverToCompanionMs}ms
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className={`font-mono font-extrabold text-sm ${
                    entry.rttMs < 50
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : entry.rttMs < 120
                      ? 'text-teal-500'
                      : entry.rttMs < 250
                      ? 'text-amber-500'
                      : 'text-red-500'
                  }`}>
                    {entry.rttMs} ms
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">
              {searchFilter ? 'No diagnostic events match your search query.' : 'No latency events recorded yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
