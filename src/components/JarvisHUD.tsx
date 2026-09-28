import React from 'react';
import { motion } from 'motion/react';
import { 
  Mic, 
  Cpu, 
  Globe, 
  Layers, 
  Zap, 
  ShieldAlert, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  Activity,
  Radio,
  Sparkles
} from 'lucide-react';

export type AssistantState = 
  | 'Listening'
  | 'Thinking'
  | 'Searching'
  | 'Planning'
  | 'Executing'
  | 'Waiting for Permission'
  | 'Speaking'
  | 'Completed'
  | 'Failed';

interface JarvisHUDProps {
  state: AssistantState;
  activeAgent?: string;
  activeTool?: string;
  subtaskSummary?: string;
  latencyMs?: number;
  onVoiceClick?: () => void;
}

export function JarvisHUD({
  state,
  activeAgent = 'Conversation Agent',
  activeTool,
  subtaskSummary,
  latencyMs,
  onVoiceClick
}: JarvisHUDProps) {
  const getStatusConfig = () => {
    switch (state) {
      case 'Listening':
        return {
          icon: Mic,
          color: 'text-cyan-400',
          border: 'border-cyan-500/40',
          bg: 'bg-cyan-950/40',
          glow: 'shadow-cyan-500/20',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          text: 'Listening to Audio Input...'
        };
      case 'Thinking':
        return {
          icon: Cpu,
          color: 'text-violet-400',
          border: 'border-violet-500/40',
          bg: 'bg-violet-950/40',
          glow: 'shadow-violet-500/20',
          badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
          text: 'Neural Reasoning & Intent Synthesis...'
        };
      case 'Searching':
        return {
          icon: Globe,
          color: 'text-amber-400',
          border: 'border-amber-500/40',
          bg: 'bg-amber-950/40',
          glow: 'shadow-amber-500/20',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          text: 'Grounding Live Information...'
        };
      case 'Planning':
        return {
          icon: Layers,
          color: 'text-teal-400',
          border: 'border-teal-500/40',
          bg: 'bg-teal-950/40',
          glow: 'shadow-teal-500/20',
          badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
          text: 'Decomposing Goal into Subtasks...'
        };
      case 'Executing':
        return {
          icon: Zap,
          color: 'text-orange-400',
          border: 'border-orange-500/40',
          bg: 'bg-orange-950/40',
          glow: 'shadow-orange-500/20',
          badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          text: `Executing Tool: ${activeTool || 'Action'}`
        };
      case 'Waiting for Permission':
        return {
          icon: ShieldAlert,
          color: 'text-yellow-400',
          border: 'border-yellow-500/50',
          bg: 'bg-yellow-950/50',
          glow: 'shadow-yellow-500/30',
          badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
          text: 'Waiting for User Authorization...'
        };
      case 'Speaking':
        return {
          icon: Volume2,
          color: 'text-emerald-400',
          border: 'border-emerald-500/40',
          bg: 'bg-emerald-950/40',
          glow: 'shadow-emerald-500/20',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          text: 'Synthesizing Neural Speech Output...'
        };
      case 'Completed':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-400',
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/20',
          glow: 'shadow-emerald-500/10',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          text: 'Execution & Verification Completed'
        };
      case 'Failed':
        return {
          icon: XCircle,
          color: 'text-rose-400',
          border: 'border-rose-500/40',
          bg: 'bg-rose-950/40',
          glow: 'shadow-rose-500/20',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          text: 'Execution Anomaly Detected'
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div className={`p-3 md:p-3.5 rounded-2xl ${config.bg} border ${config.border} shadow-lg ${config.glow} transition-all duration-300 backdrop-blur-md`}>
      <div className="flex items-center justify-between gap-3">
        {/* Left: State Ring & Status Text */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center shrink-0">
            <div className={`w-9 h-9 rounded-xl ${config.bg} border ${config.border} flex items-center justify-center ${config.color}`}>
              <IconComponent className="w-4 h-4 animate-pulse" />
            </div>
            {state === 'Listening' || state === 'Speaking' ? (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                ALYA HUD <span className="text-[10px] font-mono text-slate-400">|</span> 
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${config.badge}`}>
                  {state}
                </span>
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate mt-0.5">
              {subtaskSummary || config.text}
            </p>
          </div>
        </div>

        {/* Right: Active Agent, Latency & Quick Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-medium text-slate-400">Specialist Agent</span>
            <span className="text-xs font-semibold text-violet-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-violet-400" />
              {activeAgent}
            </span>
          </div>

          {typeof latencyMs === 'number' && (
            <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-emerald-400">
              <Activity className="w-3 h-3" />
              <span>{latencyMs}ms</span>
            </div>
          )}

          {onVoiceClick && (
            <button
              onClick={onVoiceClick}
              className="p-2 rounded-xl bg-violet-600/80 hover:bg-violet-500 text-white transition border border-violet-400/30 flex items-center gap-1.5 text-xs font-semibold"
              title="Toggle Live Voice"
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Live Voice</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
