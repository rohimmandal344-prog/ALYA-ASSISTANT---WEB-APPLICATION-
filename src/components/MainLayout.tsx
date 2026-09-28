import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Settings, 
  ShieldCheck, 
  Smartphone,
  LogOut,
  Menu,
  X,
  Phone,
  Brain,
  Database,
  Zap,
  Terminal,
  Volume2,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  MicOff,
  SlidersHorizontal,
  CheckCircle2,
  Mic,
  Activity,
  Server,
  Gauge,
  Wifi,
  ArrowRight,
  Sparkles,
  ArrowUpRight,
  Bot
} from 'lucide-react';
import { deviceWebSocketClient } from '../services/deviceWebSocketService';
import { CompanionRTTProbeResult, ServerNodeProbeResult, RTTDiagnosticLogEntry } from '../lib/WebSocketManager';
import { latencyManager, LatencyMetrics, RelaySuggestion } from '../lib/LatencyManager';
import { ChatView } from './ChatView';
import { SettingsView } from './SettingsView';
import { PermissionsView } from './PermissionsView';
import { DevicesView } from './DevicesView';
import { VoiceSession } from './VoiceSession';
import { BrainView } from './BrainView';
import { MemoryView } from './MemoryView';
import { AutomationsView } from './AutomationsView';
import { TestingView } from './TestingView';
import { AutoReplyView } from './AutoReplyView';
import { VoiceTranscriptView } from './VoiceTranscriptView';

export function MainLayout() {
  const { user, profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVoicePopupOpen, setIsVoicePopupOpen] = useState(false);
  const [showMicModal, setShowMicModal] = useState(false);
  const [selectedVoice] = useState('Aoede');
  const [micStatus, setMicStatus] = useState<{
    state: 'prompt' | 'granted' | 'denied' | 'error';
    message?: string;
    details?: string;
  }>({ state: 'prompt' });

  // Live Diagnostics Panel States
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [diagData, setDiagData] = useState<any>(null);

  // Companion RTT & Server Node Optimizer States
  const [companionRttData, setCompanionRttData] = useState<CompanionRTTProbeResult | null>(null);
  const [nodeBenchmarkResults, setNodeBenchmarkResults] = useState<ServerNodeProbeResult[]>([]);
  const [fastestNode, setFastestNode] = useState<any>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [rttLogs, setRttLogs] = useState<RTTDiagnosticLogEntry[]>([]);

  // Continuous Real-Time Latency & Dynamic Relay Optimization State
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics | null>(() => latencyManager.getLatestMetrics());
  const [relaySuggestion, setRelaySuggestion] = useState<RelaySuggestion | null>(() => latencyManager.getLatestSuggestion());

  useEffect(() => {
    // Start continuous ping-pong monitoring between Web Dashboard and Android app
    latencyManager.startMonitoring(4000);

    const unsubMetrics = latencyManager.onMetricsUpdate((metrics) => {
      setLatencyMetrics(metrics);
    });

    const unsubSuggestion = latencyManager.onSuggestion((suggestion) => {
      setRelaySuggestion(suggestion);
    });

    return () => {
      unsubMetrics();
      unsubSuggestion();
      latencyManager.stopMonitoring();
    };
  }, []);

  const handleApplySuggestedRelay = (relayId: string) => {
    latencyManager.selectRelayServer(relayId);
    runDiagnosticsBenchmark();
  };

  const runDiagnosticsBenchmark = useCallback(async () => {
    setIsBenchmarking(true);
    try {
      deviceWebSocketClient.connect(user?.uid);
      
      // 1. Measure Companion RTT
      const rttResult = await deviceWebSocketClient.measureCompanionRTT();
      if (rttResult) {
        setCompanionRttData(rttResult);
      }

      // 2. Benchmark Server Nodes to find lowest latency node
      const benchResult = await deviceWebSocketClient.benchmarkServerNodes();
      if (benchResult) {
        setFastestNode(benchResult.fastestNode);
        setNodeBenchmarkResults(benchResult.results);
      }

      // 3. Update Diagnostic Logs
      const logs = deviceWebSocketClient.getDiagnosticLogs();
      setRttLogs(logs);
    } catch (err) {
      console.warn('[Diagnostics] Benchmark execution error:', err);
    } finally {
      setIsBenchmarking(false);
    }
  }, [user]);

  // Initial load when opening diagnostics panel
  useEffect(() => {
    if (isDiagnosticsOpen) {
      const logs = deviceWebSocketClient.getDiagnosticLogs();
      setRttLogs(logs);
      const savedNode = deviceWebSocketClient.getFastestServerNode();
      if (savedNode) setFastestNode(savedNode);
      if (deviceWebSocketClient.diagnostics) {
        const latestRtt = deviceWebSocketClient.diagnostics.getLatestCompanionRTT();
        if (latestRtt) setCompanionRttData(latestRtt);
        const latestBench = deviceWebSocketClient.diagnostics.getLatestBenchmarkResults();
        if (latestBench.length > 0) setNodeBenchmarkResults(latestBench);
      }
    }
  }, [isDiagnosticsOpen]);

  useEffect(() => {
    (window as any).onAlyaDiagnosticsUpdate = (data: any) => {
      setDiagData(data);
    };
    const handleNavigate = (e: any) => {
      const view = e.detail?.view;
      if (view && typeof view === 'string') {
        const normalized = view.toLowerCase();
        if (['chat', 'devices', 'settings', 'permissions', 'brain', 'memory', 'automations', 'autoreply', 'testing', 'transcripts'].includes(normalized)) {
          setActiveTab(normalized);
        }
      }
    };
    window.addEventListener('alya:navigate', handleNavigate);
    return () => {
      delete (window as any).onAlyaDiagnosticsUpdate;
      window.removeEventListener('alya:navigate', handleNavigate);
    };
  }, []);

  // Central refs for MediaStream tracks & AudioContext cleanup
  const activeStreamRef = useRef<MediaStream | null>(null);
  const activeAudioCtxRef = useRef<AudioContext | null>(null);

  /**
   * Robust cleanup method to release all MediaStream tracks and close AudioContext
   */
  const cleanupAudioResources = useCallback(async () => {
    // 1. Release all MediaStream tracks
    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
      } catch (err) {
        console.warn('[MainLayout] Track stop warning:', err);
      }
      activeStreamRef.current = null;
    }

    // 2. Cancel browser speech synthesis & recognition
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }

    // 3. Close AudioContext
    if (activeAudioCtxRef.current) {
      try {
        if (activeAudioCtxRef.current.state !== 'closed') {
          await activeAudioCtxRef.current.close();
        }
      } catch (err) {
        console.warn('[MainLayout] AudioContext close warning:', err);
      }
      activeAudioCtxRef.current = null;
    }
  }, []);

  // Guarantee audio cleanup on MainLayout unmount
  useEffect(() => {
    return () => {
      cleanupAudioResources();
    };
  }, [cleanupAudioResources]);

  const checkMicPermission = async (isManualRequest = false) => {
    try {
      setMicStatus({ state: 'prompt' });
      // Explicit check using getUserMedia upon user action
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Explicitly stop and disable all temporary tracks to prevent memory leaks or locked devices
      stream.getTracks().forEach(track => {
        track.enabled = false;
        track.stop();
      });
      setMicStatus({ state: 'granted' });
      setShowMicModal(false);
      if (isManualRequest) {
        setIsVoicePopupOpen(true);
      }
      return true;
    } catch (err: any) {
      console.warn('[MicCheck] Permission check error:', err);
      let message = 'Microphone access required.';
      let details = 'Alya needs microphone access for live conversation features.';
      let state: 'denied' | 'error' = 'denied';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Microphone Access Blocked';
        details = 'Microphone permissions are currently denied in your browser or device settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No Microphone Detected';
        details = 'We could not detect any connected microphone or audio input hardware.';
        state = 'error';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Microphone In Use';
        details = 'Your microphone is currently being used by another application or tab.';
        state = 'error';
      }

      setMicStatus({ state, message, details });
      setShowMicModal(true);
      return false;
    }
  };

  const handleVoiceToggle = async () => {
    setIsVoicePopupOpen(true);
  };

  // Expose toggle and voice state to global window for other components
  useEffect(() => {
    (window as any).toggleVoicePopup = handleVoiceToggle;
    (window as any).getSelectedVoice = () => selectedVoice;
    return () => { 
      delete (window as any).toggleVoicePopup; 
      delete (window as any).getSelectedVoice;
    };
  }, [selectedVoice, micStatus]);

  // Simulated Wake Word Listener for Web
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Simulate wake word with Alt+A
      if (e.altKey && e.key === 'a') {
        setIsVoicePopupOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { id: 'chat', label: 'Assistant', icon: MessageSquare },
    { id: 'transcript', label: 'Voice Transcripts', icon: Mic },
    { id: 'brain', label: 'Brain & Agents', icon: Brain },
    { id: 'memory', label: 'Memory', icon: Database },
    { id: 'automations', label: 'Automations', icon: Zap },
    { id: 'autoreply', label: 'Auto-Reply', icon: Bot },
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'testing', label: 'Testing Suite', icon: Terminal },
    { id: 'permissions', label: 'Security', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-xl">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <span className="font-bold text-lg">A</span>
            </div>
            <div>
              <span className="font-bold tracking-tight text-base text-slate-900 dark:text-white block leading-tight">Alisa M. Kujou</span>
              <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Alya Companion</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg shadow-slate-900/5' 
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Live Diagnostics Sidebar Button */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setIsDiagnosticsOpen(true)}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              isDiagnosticsOpen 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5" />
              <span>Live Diagnostics</span>
            </div>
            {diagData?.readyState === 'OPEN' && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Unified Alya Voice Tone Status */}
        <div className="px-4 mb-2">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
            <Volume2 className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold text-slate-800 dark:text-white truncate">Ultra-Realistic Voice</span>
              <span className="block text-[10px] text-slate-400 font-normal">Gemini Live & Neural Engine</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
            <img src={user?.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-slate-100" alt="Avatar" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{profile?.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2">
            <Menu className="w-6 h-6" />
          </button>
          <button 
            onClick={handleVoiceToggle}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl shadow-lg"
          >
            <Phone className="w-4 h-4" />
            <span className="text-xs font-bold tracking-tight">Live Call</span>
          </button>
          <img src={user?.photoURL || ''} className="w-8 h-8 rounded-full" alt="Avatar" />
        </header>

        {/* Granular Mic Permission Alert Banner */}
        <AnimatePresence>
          {(micStatus.state === 'denied' || micStatus.state === 'error') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/50 overflow-hidden"
            >
              <div className="max-w-4xl mx-auto px-4 py-3 flex items-start gap-3">
                <div className={`p-2 rounded-xl ${micStatus.state === 'denied' ? 'bg-red-100 dark:bg-red-900/50 text-red-600' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600'}`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-red-900 dark:text-red-200">{micStatus.message}</h3>
                  <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5">{micStatus.details}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => checkMicPermission(false)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                  <button 
                    onClick={() => setMicStatus({ state: 'granted' })}
                    className="p-1.5 text-red-400 hover:text-red-200 transition-colors rounded-lg"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Router */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ChatView />
              </motion.div>
            )}
            {activeTab === 'transcript' && (
              <motion.div key="transcript" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <VoiceTranscriptView />
              </motion.div>
            )}
            {activeTab === 'brain' && (
              <motion.div key="brain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <BrainView />
              </motion.div>
            )}
            {activeTab === 'memory' && (
              <motion.div key="memory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <MemoryView />
              </motion.div>
            )}
            {activeTab === 'automations' && (
              <motion.div key="automations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <AutomationsView />
              </motion.div>
            )}
            {activeTab === 'autoreply' && (
              <motion.div key="autoreply" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <AutoReplyView />
              </motion.div>
            )}
            {activeTab === 'testing' && (
              <motion.div key="testing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <TestingView />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <SettingsView />
              </motion.div>
            )}
            {activeTab === 'permissions' && (
              <motion.div key="permissions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <PermissionsView />
              </motion.div>
            )}
            {activeTab === 'devices' && (
              <motion.div key="devices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <DevicesView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <VoiceSession 
          isOpen={isVoicePopupOpen} 
          onClose={async () => {
            setIsVoicePopupOpen(false);
            await cleanupAudioResources();
          }} 
          voiceName={selectedVoice}
        />

        {/* User-Friendly Microphone Permission Modal */}
        <AnimatePresence>
          {showMicModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMicModal(false)}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 z-10 overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 mb-4 shadow-inner">
                    <MicOff className="w-6 h-6" />
                  </div>
                  <button
                    onClick={() => setShowMicModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {micStatus.message || 'Microphone Access Required'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {micStatus.details || 'Alya requires access to your microphone for live conversation and real-time voice streaming.'}
                </p>

                <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    How to enable microphone:
                  </span>
                  
                  <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-[10px]">1</div>
                    <span>Look for the 🔒 <b>Lock / Settings</b> icon in your browser URL bar.</span>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-[10px]">2</div>
                    <span>Locate <b>Microphone</b> and change the toggle to <b>Allow</b>.</span>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-[10px]">3</div>
                    <span>Click <b>Try Again</b> below to start chatting with Alya.</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => checkMicPermission(true)}
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                  <button
                    onClick={() => setShowMicModal(false)}
                    className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Diagnostics Button when a call is active and drawer is closed */}
      <AnimatePresence>
        {diagData && diagData.readyState !== 'CLOSED' && !isDiagnosticsOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            onClick={() => setIsDiagnosticsOpen(true)}
            className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center gap-2.5 font-bold text-xs transition-all cursor-pointer"
          >
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Show Call Diagnostics</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Diagnostics Slide-over Drawer */}
      <AnimatePresence>
        {isDiagnosticsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDiagnosticsOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-45"
            />
            {/* Drawer Body */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 shadow-2xl z-50 flex flex-col overflow-hidden font-sans"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Live Session Diagnostics</h2>
                    <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Real-Time Performance Monitor</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsDiagnosticsOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Active Session Status Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Global Voice State</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {diagData ? (diagData.readyState === 'OPEN' ? 'Live Call In Progress' : `Session ${diagData.readyState.toLowerCase()}`) : 'No Session Active'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      diagData?.readyState === 'OPEN' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-400'
                    }`} />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {diagData?.readyState || 'IDLE'}
                    </span>
                  </div>
                </div>

                {/* 1. WebSocket Heartbeat Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                    <Zap className="w-4 h-4 text-indigo-500" />
                    <span>Gemini WebSocket Bridge</span>
                  </h3>
                  
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm space-y-3 text-xs">
                    {diagData ? (
                      <>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-700/30">
                          <span className="text-slate-500">URL Endpoint</span>
                          <span className="font-mono text-[10px] bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 truncate max-w-[240px]" title={diagData.wsUrl}>
                            {diagData.wsUrl}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-700/30">
                          <span className="text-slate-500">WebSocket ReadyState</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                            diagData.readyState === 'OPEN' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {diagData.readyState}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-700/30">
                          <span className="text-slate-500">Heartbeat RTT (Latency)</span>
                          <span className={`font-bold font-mono ${
                            diagData.lastHeartbeatMs !== null 
                              ? diagData.lastHeartbeatMs < 150 ? 'text-emerald-500' : diagData.lastHeartbeatMs < 300 ? 'text-amber-500' : 'text-red-500'
                              : 'text-slate-400'
                          }`}>
                            {diagData.lastHeartbeatMs !== null ? `${diagData.lastHeartbeatMs}ms` : 'Awaiting handshake...'}
                          </span>
                        </div>

                        {/* Latency History visual sparkline */}
                        {diagData.latencyHistory && diagData.latencyHistory.length > 0 && (
                          <div className="py-1 border-b border-slate-50 dark:border-slate-700/30 space-y-1.5">
                            <span className="text-slate-500 block">Latency Heartbeat History</span>
                            <div className="flex items-end gap-1 h-8 pt-1">
                              {diagData.latencyHistory.map((l: number, idx: number) => {
                                const maxHeight = 28;
                                const height = Math.max(4, Math.min(maxHeight, (l / 500) * maxHeight));
                                return (
                                  <div
                                    key={idx}
                                    style={{ height: `${height}px` }}
                                    className={`w-full rounded-xs transition-all ${
                                      l < 150 ? 'bg-emerald-500' : l < 300 ? 'bg-amber-400' : 'bg-red-500'
                                    }`}
                                    title={`RTT: ${l}ms`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-50 dark:border-slate-700/30">
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Sent Packets</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{diagData.messagesSent}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold">Received Responses</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{diagData.messagesReceived}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-500">Last Telemetry Check</span>
                          <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">{diagData.lastMessageTime || 'Never'}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-400 text-xs italic text-center py-4">No active WebSocket connection stream to measure.</p>
                    )}

                    {diagData?.lastError && (
                      <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 flex gap-2 text-red-600 dark:text-red-400">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="font-semibold leading-tight">{diagData.lastError}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. WebAudio API Pipeline */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                    <Volume2 className="w-4 h-4 text-indigo-500" />
                    <span>WebAudio API Engine</span>
                  </h3>
                  
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm space-y-3 text-xs">
                    {diagData ? (
                      <>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-700/30">
                          <span className="text-slate-500">AudioContext State</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                            diagData.webaudioState === 'running' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {diagData.webaudioState.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-700/30">
                          <span className="text-slate-500">Sample Rate</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{diagData.webaudioSampleRate} Hz</span>
                        </div>

                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-700/30">
                          <span className="text-slate-500">Audio Processing Node</span>
                          <span className={`font-mono text-[11px] font-bold ${
                            diagData.webaudioNode === 'AudioWorkletNode' ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-500'
                          }`}>
                            {diagData.webaudioNode}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-700/30">
                          <span className="text-slate-500">AudioWorklet Loaded</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{diagData.workletLoaded}</span>
                        </div>

                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-500">Incoming Audio Queue Size</span>
                          <span className={`font-mono font-bold ${
                            diagData.audioQueueSize > 5 ? 'text-red-500 animate-pulse' : 'text-slate-800 dark:text-slate-200'
                          }`}>
                            {diagData.audioQueueSize} frames
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-400 text-xs italic text-center py-4">WebAudio API pipeline is currently offline.</p>
                    )}
                  </div>
                </div>

                {/* 3. MediaStream Tracks */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                    <Mic className="w-4 h-4 text-indigo-500" />
                    <span>Microphone MediaStream Tracks</span>
                  </h3>
                  
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm space-y-3 text-xs">
                    {diagData && diagData.tracks && diagData.tracks.length > 0 ? (
                      <div className="space-y-4">
                        {diagData.tracks.map((track: any, i: number) => (
                          <div key={track.id} className="space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-700/30 pb-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={track.label}>
                                {i + 1}. {track.label}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                track.readyState === 'live' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'
                              }`}>
                                {track.readyState}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                              <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-xl text-center">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Type</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{track.kind}</span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-xl text-center">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Active</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{track.enabled ? 'Enabled' : 'Disabled'}</span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-xl text-center">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Muted</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{track.muted ? 'Yes' : 'No'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-xs italic text-center py-4">No active audio capture streams detected.</p>
                    )}
                  </div>
                </div>

                {/* 4. Companion RTT & Server Node Optimizer */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                      <Gauge className="w-4 h-4 text-emerald-500" />
                      <span>Companion RTT & Node Optimizer</span>
                    </h3>
                    <button
                      onClick={runDiagnosticsBenchmark}
                      disabled={isBenchmarking}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-bold transition-all shadow-sm"
                    >
                      <RefreshCw className={`w-3 h-3 ${isBenchmarking ? 'animate-spin' : ''}`} />
                      {isBenchmarking ? 'Probing...' : 'Measure RTT & Nodes'}
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 text-xs">
                    {/* Companion RTT Metric Card */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-indigo-500" />
                          <span className="font-bold text-slate-800 dark:text-slate-200">Android Companion End-to-End RTT</span>
                        </div>
                        {companionRttData ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            companionRttData.status === 'success'
                              ? companionRttData.totalEndToEndRttMs < 100
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : companionRttData.totalEndToEndRttMs < 300
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-red-500/10 text-red-500'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                          }`}>
                            {companionRttData.status === 'success' ? `${companionRttData.totalEndToEndRttMs}ms RTT` : companionRttData.status.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">Not measured yet</span>
                        )}
                      </div>

                      {companionRttData && companionRttData.status === 'success' ? (
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700/50">
                            <span className="block text-[9px] text-slate-400 uppercase font-bold">Web ➔ Server Gateway</span>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{companionRttData.webToServerRttMs} ms</span>
                          </div>
                          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700/50">
                            <span className="block text-[9px] text-slate-400 uppercase font-bold">Server Gateway ➔ Phone</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{companionRttData.serverToCompanionRttMs} ms</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">
                          {companionRttData?.error || 'Click "Measure RTT & Nodes" to test live round-trip latency to your paired Android companion device.'}
                        </p>
                      )}
                    </div>

                    {/* Dynamic Relay Server Suggestion Banner */}
                    {relaySuggestion && (
                      <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        relaySuggestion.isSwitchRecommended
                          ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-500/30'
                          : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500/20'
                      }`}>
                        <div className="flex items-start gap-2.5">
                          <div className={`p-1.5 rounded-lg shrink-0 ${
                            relaySuggestion.isSwitchRecommended 
                              ? 'bg-amber-500/20 text-amber-500' 
                              : 'bg-indigo-500/20 text-indigo-500'
                          }`}>
                            <Zap className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                {relaySuggestion.isSwitchRecommended ? 'Faster Relay Server Available' : 'Optimal Relay Connected'}
                              </span>
                              {relaySuggestion.isSwitchRecommended && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white uppercase">
                                  -{relaySuggestion.improvementPercent}% Latency
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {relaySuggestion.recommendationReason}
                            </p>
                          </div>
                        </div>

                        {relaySuggestion.isSwitchRecommended && (
                          <button
                            onClick={() => handleApplySuggestedRelay(relaySuggestion.suggestedRelay.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] transition-all self-start sm:self-auto shrink-0 shadow-sm cursor-pointer"
                          >
                            <span>Switch to {relaySuggestion.suggestedRelay.location}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Server Node Latency Benchmark Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">Server Node Latency Benchmarks</span>
                        </div>
                        {fastestNode && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Fastest: {fastestNode.name.split('(')[0]}
                          </span>
                        )}
                      </div>

                      {nodeBenchmarkResults.length > 0 ? (
                        <div className="space-y-1.5">
                          {nodeBenchmarkResults.map((probe, idx) => (
                            <div 
                              key={probe.node.id} 
                              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                                idx === 0 
                                  ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30' 
                                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-100 dark:border-slate-700/40'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  idx === 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`} />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">{probe.node.name}</span>
                                    {idx === 0 && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-emerald-500 text-white">
                                        Fastest Node
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">Region: {probe.node.region} • Jitter: {probe.jitter}ms</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`font-mono text-xs font-extrabold ${
                                  probe.avgRtt < 100 
                                    ? 'text-emerald-600 dark:text-emerald-400' 
                                    : probe.avgRtt < 250 
                                    ? 'text-amber-500' 
                                    : 'text-red-500'
                                }`}>
                                  {probe.avgRtt} ms
                                </span>
                                <span className="block text-[9px] text-slate-400 uppercase">Min: {probe.minRtt}ms</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 py-1">
                          No server benchmarks performed yet. Run the probe to discover the lowest-latency edge server for your session.
                        </p>
                      )}
                    </div>

                    {/* Live RTT Diagnostics Log Stream */}
                    {rttLogs.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/40">
                        <span className="font-bold text-[10px] uppercase text-slate-400 block tracking-wider">Recent Latency Logs</span>
                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                          {rttLogs.slice(0, 5).map((log) => (
                            <div key={log.id} className="text-[10px] font-mono flex items-center justify-between text-slate-500 py-0.5">
                              <span className="truncate max-w-[200px]">{new Date(log.timestamp).toLocaleTimeString()} - {log.notes}</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">{log.rttMs}ms</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Troubleshooting Diagnostic Engine */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Self-Correction Troubleshooting Helper</span>
                  </h3>
                  
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 text-xs space-y-3">
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Our system analyzer evaluated the live metrics. Here are the pinpointed fixes:
                    </p>
                    
                    <div className="space-y-2.5">
                      {/* Check WebSocket State */}
                      {(!diagData || diagData.readyState === 'CLOSED') && (
                        <div className="flex gap-2.5 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-slate-800 dark:text-slate-200">Session Inactive</span>
                            <span className="text-[11px] text-slate-500">Tap the <b>Live Call</b> button or press <b>Alt+A</b> to open the voice line and trigger the live connection.</span>
                          </div>
                        </div>
                      )}

                      {/* Check WebSocket Errors */}
                      {diagData?.lastError && (
                        <div className="flex gap-2.5 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0 animate-ping" />
                          <div>
                            <span className="font-bold block text-red-600 dark:text-red-400">WebSocket Handshake Failure</span>
                            <span className="text-[11px] text-slate-500">The connection to the Live Bridge was rejected. Verify your <b>GEMINI_API_KEY</b> is correctly entered in the Secrets panel.</span>
                          </div>
                        </div>
                      )}

                      {/* Check WebAudio Context */}
                      {diagData && diagData.webaudioState === 'suspended' && (
                        <div className="flex gap-2.5 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-amber-600 dark:text-amber-400">AudioContext Suspended</span>
                            <span className="text-[11px] text-slate-500">Browsers automatically block audio until user interaction. Tap anywhere on the chat or popup screen to resume speech.</span>
                          </div>
                        </div>
                      )}

                      {/* Check MediaStream Tracks */}
                      {diagData && diagData.readyState === 'OPEN' && (!diagData.tracks || diagData.tracks.length === 0) && (
                        <div className="flex gap-2.5 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-amber-600 dark:text-amber-400">Microphone Input Missing</span>
                            <span className="text-[11px] text-slate-500">The socket is connected but no audio track was captured. Verify browser site permissions allow microphone access.</span>
                          </div>
                        </div>
                      )}

                      {/* Check ScriptProcessor Fallback */}
                      {diagData && diagData.webaudioNode === 'ScriptProcessorNode' && (
                        <div className="flex gap-2.5 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-amber-600 dark:text-amber-400">AudioWorklet Offline Fallback Active</span>
                            <span className="text-[11px] text-slate-500">Using the main thread instead of off-thread worklets. This might increase latency. Check if third-party extensions are blocking `/pcm-processor.js`.</span>
                          </div>
                        </div>
                      )}

                      {/* Check Buffer Queue lag */}
                      {diagData && diagData.audioQueueSize > 5 && (
                        <div className="flex gap-2.5 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-red-500">Audio Processing Lag</span>
                            <span className="text-[11px] text-slate-500">Playback buffers are queuing up faster than they can play. Close other tabs or heavy programs running on your computer.</span>
                          </div>
                        </div>
                      )}

                      {/* Check TTS Quota Exceeded */}
                      {diagData && diagData.ttsQuotaExceeded && (
                        <div className="flex gap-2.5 items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-amber-600 dark:text-amber-400">Neural TTS Quota Exceeded (429)</span>
                            <span className="text-[11px] text-slate-500">The server-side daily voice generation quota is exhausted. Alya has seamlessly fell back to your browser's local natural speech synthesis to continue your conversation without any interruption!</span>
                          </div>
                        </div>
                      )}

                      {/* Everything looks great */}
                      {diagData && diagData.readyState === 'OPEN' && !diagData.lastError && diagData.tracks.some((t: any) => t.readyState === 'live' && t.enabled) && diagData.webaudioState === 'running' && (
                        <div className="flex gap-2.5 items-start text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">All Systems Operational</span>
                            <span className="text-[11px] text-slate-500">WebAudio, WebSocket, and MediaStream are green. If Alya is not heard, verify system volumes are up or that you speak clearly.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" 
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-80 bg-white dark:bg-slate-900 z-50 md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-bold text-xl">A</div>
                  <span className="font-bold tracking-tight text-lg">Alya</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2"><X className="w-6 h-6"/></button>
              </div>
              <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                    className={`flex items-center gap-3 w-full px-4 py-4 rounded-2xl text-base font-medium transition-all ${
                      activeTab === item.id 
                        ? 'bg-slate-900 text-white shadow-lg' 
                        : 'text-slate-500 active:bg-slate-100'
                    }`}
                  >
                    <item.icon className="w-6 h-6" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
