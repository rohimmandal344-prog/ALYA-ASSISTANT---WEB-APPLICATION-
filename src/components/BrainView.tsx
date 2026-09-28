import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, 
  Cpu, 
  Sparkles, 
  ShieldCheck, 
  Smartphone, 
  Code, 
  Search, 
  Clock, 
  Database, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  Play,
  Layers,
  ArrowRight,
  Terminal
} from 'lucide-react';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  description: string;
  allowedCapabilities: string[];
  maxAutonomyLevel: string;
}

interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredPermission: string;
  supportedPlatforms: string[];
  verificationMethod: string;
}

export function BrainView() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [testPrompt, setTestPrompt] = useState('Turn on the flashlight and remind me to study in 10 minutes');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<'pipeline' | 'agents' | 'tools'>('pipeline');

  useEffect(() => {
    fetch('/api/alya/capabilities')
      .then(res => res.json())
      .then(data => {
        if (data.agents) setAgents(data.agents);
        if (data.tools) setTools(data.tools);
      })
      .catch(console.error);
  }, []);

  const runPipelineTest = async () => {
    if (!testPrompt.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/alya/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testPrompt,
          source: 'web_chat',
          context: {
            isOnline: true,
            userMemories: [
              { category: 'preference', key: 'name', value: 'User' },
              { category: 'device', key: 'companion_model', value: 'Pixel 8' }
            ]
          }
        })
      });
      const data = await res.json();
      setPipelineResult(data);
    } catch (err) {
      console.error('Brain test error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const PIPELINE_STAGES = [
    { num: '01', name: 'Perception Layer', desc: 'Audio/Text/Sensory input normalization & language identification.' },
    { num: '02', name: 'Intent Engine', desc: 'Deep semantic understanding beyond rigid keyword triggers.' },
    { num: '03', name: 'Context Retrieval', desc: 'Short-term dialogue thread & relevant long-term memory points.' },
    { num: '04', name: 'Reasoning Engine', desc: 'Sub-goal decomposition, constraints & confidence assessment.' },
    { num: '05', name: 'Planning & Orchestrator', desc: 'Task delegation to domain-specialized AI Agents.' },
    { num: '06', name: 'Tool Registry', desc: 'Capability matching with permissions & platform checks.' },
    { num: '07', name: 'Action Execution', desc: 'Dispatches verified command payloads to hardware or cloud.' },
    { num: '08', name: 'Verification System', desc: 'Telemetry audit & confirmation: never report unverified success.' },
    { num: '09', name: 'Reflection & Correction', desc: 'Anomalies detection, root-cause diagnosis & alternative strategies.' },
    { num: '10', name: 'Response Generation', desc: 'Natural, empathetic, concise delivery using Alya persona.' },
    { num: '11', name: 'Safety & Guardrails', desc: 'Enforces permission scopes and private data boundaries.' }
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Alya Brain & Agent Architecture</h1>
              <p className="text-sm text-slate-500">Modular 13-stage cognitive pipeline with real-world verification.</p>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setSelectedTab('pipeline')}
            className={`px-4 py-2 rounded-xl transition-all ${
              selectedTab === 'pipeline' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Cognitive Pipeline
          </button>
          <button
            onClick={() => setSelectedTab('agents')}
            className={`px-4 py-2 rounded-xl transition-all ${
              selectedTab === 'agents' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Specialized Agents ({agents.length || 7})
          </button>
          <button
            onClick={() => setSelectedTab('tools')}
            className={`px-4 py-2 rounded-xl transition-all ${
              selectedTab === 'tools' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Tool Registry ({tools.length || 8})
          </button>
        </div>
      </div>

      {/* Live Pipeline Test Sandbox */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-500" />
            Live Cognitive Pipeline Simulator
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-medium">
            Gemini 3.8 Flash + Live Engine
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            placeholder="Type any command or complex query to inspect Alya's brain pipeline..."
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={runPipelineTest}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all"
          >
            {isProcessing ? (
              <Activity className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            Run Pipeline
          </button>
        </div>

        {/* Pipeline output inspector */}
        <AnimatePresence>
          {pipelineResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pipeline Execution Trace</span>
                <span className="text-xs font-mono text-indigo-500">Agent: {pipelineResult.activeAgent?.name}</span>
              </div>

              {/* Stage cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pipelineResult.pipelineStages?.map((st: any, i: number) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{st.stage}</span>
                      {st.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">{st.summary}</p>
                  </div>
                ))}
              </div>

              {/* Final response box */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Synthesized Natural Response</span>
                <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  "{pipelineResult.reply}"
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Tab Content */}
      {selectedTab === 'pipeline' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            13-Stage Cognitive Pipeline Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage.num} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-4">
                <span className="text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400">{stage.num}</span>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{stage.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{stage.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === 'agents' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-500" />
            Specialized Domain Agents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(agents.length > 0 ? agents : [
              { id: 'research', name: 'Research Agent', role: 'Information Synthesis', description: 'Deep factual search & knowledge distillation.', allowedCapabilities: ['web_search', 'summarize'], maxAutonomyLevel: 'authorized_auto' },
              { id: 'device', name: 'Device Agent', role: 'Hardware Automation', description: 'Real Android control with native verification.', allowedCapabilities: ['device_flashlight', 'device_volume'], maxAutonomyLevel: 'authorized_auto' },
              { id: 'automation', name: 'Automation Agent', role: 'Schedules & Timers', description: 'Handles time-triggered routines & alerts.', allowedCapabilities: ['create_reminder', 'set_timer'], maxAutonomyLevel: 'authorized_auto' },
              { id: 'memory', name: 'Memory Agent', role: 'Long-Term Memory', description: 'Maintains user facts and personalized profile.', allowedCapabilities: ['memory_store', 'memory_retrieve'], maxAutonomyLevel: 'authorized_auto' },
              { id: 'coding', name: 'Coding Agent', role: 'Architecture & Logic', description: 'Technical reasoning and code optimization.', allowedCapabilities: ['code_generation'], maxAutonomyLevel: 'read_only' },
              { id: 'diagnostics', name: 'Diagnostics Agent', role: 'System Health', description: 'Tracks latency and WebSocket audio health.', allowedCapabilities: ['system_diagnostics'], maxAutonomyLevel: 'read_only' },
              { id: 'security', name: 'Security Agent', role: 'Permissions & Guardrails', description: 'Validates safety constraints before execution.', allowedCapabilities: ['permission_check'], maxAutonomyLevel: 'authorized_auto' },
            ]).map((agent) => (
              <div key={agent.id} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{agent.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">
                    {agent.maxAutonomyLevel}
                  </span>
                </div>
                <p className="text-xs text-indigo-500 font-semibold">{agent.role}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{agent.description}</p>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                  {agent.allowedCapabilities.map((cap, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === 'tools' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            Centralized Tool & Capability Registry
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(tools.length > 0 ? tools : [
              { id: 'device_flashlight', name: 'Flashlight Toggle', description: 'Turn device torch on/off with verified state feedback.', category: 'device', requiredPermission: 'CAMERA', supportedPlatforms: ['android'], verificationMethod: 'Query CameraManager torch mode callback state.' },
              { id: 'device_volume', name: 'Volume Control', description: 'Adjust media volume percentage.', category: 'device', requiredPermission: 'AUDIO_SETTINGS', supportedPlatforms: ['android'], verificationMethod: 'Query AudioManager.getStreamVolume.' },
              { id: 'device_battery', name: 'Battery Diagnostics', description: 'Read battery percentage and charging state.', category: 'device', requiredPermission: 'NONE', supportedPlatforms: ['android', 'web'], verificationMethod: 'Read BatteryManager or Navigator.getBattery API.' },
              { id: 'create_reminder', name: 'Create Reminder / Timer', description: 'Schedule countdown alerts and reminders.', category: 'automation', requiredPermission: 'NOTIFICATIONS', supportedPlatforms: ['android', 'web', 'server'], verificationMethod: 'Check scheduled entry in automation collection.' },
              { id: 'memory_store', name: 'Store Long-Term Memory', description: 'Persist verified facts and preferences.', category: 'memory', requiredPermission: 'NONE', supportedPlatforms: ['server', 'web'], verificationMethod: 'Verify document write in Firestore memory store.' },
              { id: 'system_diagnostics', name: 'Run Diagnostics', description: 'Audit WebSocket streaming latency & device sync.', category: 'diagnostics', requiredPermission: 'NONE', supportedPlatforms: ['server', 'web', 'android'], verificationMethod: 'Check heartbeat roundtrip.' }
            ]).map((tool) => (
              <div key={tool.id} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{tool.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono uppercase">
                    {tool.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{tool.description}</p>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono pt-2">
                  <span className="text-indigo-500 font-semibold">Verification: </span>
                  {tool.verificationMethod}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
