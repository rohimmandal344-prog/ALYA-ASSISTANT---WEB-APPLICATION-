import React, { useState } from 'react';
import { 
  Flashlight, 
  BatteryMedium, 
  Volume2, 
  Calendar, 
  Sparkles, 
  Smartphone, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  Wand2,
  Clock
} from 'lucide-react';

interface ChatSuggestionsProps {
  onSelectPrompt: (prompt: string) => void;
}

const CATEGORIES = [
  { id: 'hardware', label: 'Device Control', icon: Smartphone },
  { id: 'productivity', label: 'Daily Briefing', icon: Calendar },
  { id: 'automation', label: 'Smart Automations', icon: Wand2 },
  { id: 'system', label: 'Diagnostics', icon: Cpu },
];

const SUGGESTIONS_BY_CATEGORY: Record<string, Array<{ text: string; desc: string; icon: any }>> = {
  hardware: [
    { text: 'Turn on flashlight', desc: 'Hardware camera torch activation', icon: Flashlight },
    { text: 'Check device battery and charging status', desc: 'Real-time power diagnostics', icon: BatteryMedium },
    { text: 'Set media volume to 75%', desc: 'Audio focus level control', icon: Volume2 },
    { text: 'Launch Camera App', desc: 'Direct package execution', icon: Smartphone },
  ],
  productivity: [
    { text: 'Give me a morning briefing and today’s schedule', desc: 'Agenda & productivity review', icon: Clock },
    { text: 'Set a timer for 25 minutes for focus work', desc: 'Pomodoro timer engine', icon: Zap },
    { text: 'Draft a quick professional email reply', desc: 'Cognitive writing synthesis', icon: Sparkles },
    { text: 'Summarize my recent conversations', desc: 'Context aggregation', icon: Calendar },
  ],
  automation: [
    { text: 'Schedule evening bedtime mode at 10 PM', desc: 'Automated brightness & DND', icon: Wand2 },
    { text: 'Enable Battery Saver when power drops below 20%', desc: 'Condition-based trigger', icon: BatteryMedium },
    { text: 'Translate "Welcome to the future of assistants" to Hindi & Spanish', desc: 'Multilingual neural bridge', icon: Sparkles },
    { text: 'Explain how Alya verified device execution works', desc: 'Multi-agent capability registry', icon: ShieldCheck },
  ],
  system: [
    { text: 'Run system health check and ping latency test', desc: 'Network & socket verification', icon: Zap },
    { text: 'Show connected Android companion devices', desc: 'Secure device pairing state', icon: Smartphone },
    { text: 'Inspect current wake-word engine configuration', desc: 'Offline "Alya/Alia/Seno" engine', icon: Cpu },
    { text: 'List all authorized Accessibility & System capabilities', desc: 'Permission manager audit', icon: ShieldCheck },
  ]
};

export function ChatSuggestions({ onSelectPrompt }: ChatSuggestionsProps) {
  const [activeTab, setActiveTab] = useState('hardware');

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col items-center">
      {/* Brand Hero Visual */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 ring-4 ring-indigo-500/10">
          <Sparkles className="w-10 h-10 text-white animate-pulse" />
        </div>
        <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white font-mono text-[9px] font-bold shadow-sm">
          ONLINE
        </div>
      </div>

      <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-center">
        Alisa Mikhailovna Kujou
      </h3>
      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold text-center mt-1">
        Call Name: Alya • Real-Time Human Companion
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md text-center mt-1.5 leading-relaxed">
        Ultra-low latency cognitive assistant with direct hardware companion control and verified real-time execution.
      </p>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl mt-6 border border-slate-200/80 dark:border-slate-800/80 overflow-x-auto max-w-full">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`
                flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all
                ${isActive 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}
              `}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-500' : ''}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Suggestion Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-5">
        {SUGGESTIONS_BY_CATEGORY[activeTab]?.map((item, idx) => {
          const ItemIcon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectPrompt(item.text)}
              className="group p-3.5 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-left transition-all hover:shadow-md hover:border-indigo-500/40 flex items-start gap-3"
            >
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                <ItemIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {item.text}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {item.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
