import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  MessageSquare, 
  Sliders, 
  Moon, 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  UserCheck, 
  Play, 
  Check, 
  Trash2, 
  Eye,
  Settings2,
  Globe,
  Flame,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { 
  autoReplyClientManager, 
  AutoReplyRule, 
  AutoReplyDraft 
} from '../lib/AutoReplyManager';

export function AutoReplyView() {
  const { user } = useAuth();
  const [rule, setRule] = useState<AutoReplyRule>(() => autoReplyClientManager.getRule());
  const [drafts, setDrafts] = useState<AutoReplyDraft[]>(() => autoReplyClientManager.getDrafts());
  const [isSaved, setIsSaved] = useState(false);

  // Simulation State
  const [simSender, setSimSender] = useState('Rahul');
  const [simChannel, setSimChannel] = useState<'chat' | 'sms' | 'whatsapp' | 'email'>('chat');
  const [simContent, setSimContent] = useState('Hey, are you free for a quick sync at 4 PM today?');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<AutoReplyDraft | null>(null);

  useEffect(() => {
    setDrafts(autoReplyClientManager.getDrafts());
  }, []);

  const handleSaveRule = () => {
    autoReplyClientManager.saveRule(rule, user?.uid);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simContent.trim()) return;
    setIsSimulating(true);
    setSimResult(null);

    try {
      const draft = await autoReplyClientManager.processIncomingMessage(
        simSender,
        simContent,
        simChannel
      );
      setSimResult(draft);
      setDrafts(autoReplyClientManager.getDrafts());
    } catch (err) {
      console.warn('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApprove = (id: string) => {
    autoReplyClientManager.approveDraft(id);
    setDrafts(autoReplyClientManager.getDrafts());
  };

  const handleReject = (id: string) => {
    autoReplyClientManager.rejectDraft(id);
    setDrafts(autoReplyClientManager.getDrafts());
  };

  const handleClearAllDrafts = () => {
    if (confirm('Clear all auto-reply drafts and history?')) {
      autoReplyClientManager.clearAllDrafts();
      setDrafts([]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-950/80 via-slate-900 to-indigo-950/80 border border-violet-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Alya Intelligent Auto-Reply Engine
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                JARVIS-Style
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Natural human-like context replies, urgency detection, multi-language mirroring & draft approval workflows.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={rule.enabled} 
              onChange={(e) => {
                const updated = { ...rule, enabled: e.target.checked };
                setRule(updated);
                autoReplyClientManager.saveRule(updated, user?.uid);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
            <span className="ml-2.5 text-xs font-semibold text-slate-200">
              {rule.enabled ? 'Auto-Reply Active' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      {/* Main Grid: Config vs Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Settings */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Sliders className="w-4 h-4 text-violet-400" />
                Response Policies & Mode
              </div>
              <button
                onClick={handleSaveRule}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  isSaved ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {isSaved ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isSaved ? 'Saved' : 'Save Rules'}
              </button>
            </div>

            {/* Execution Mode */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Execution Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRule({ ...rule, mode: 'draft_review' })}
                  className={`p-3 rounded-xl border text-left transition ${
                    rule.mode === 'draft_review'
                      ? 'bg-violet-600/15 border-violet-500/50 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5 text-violet-300">
                    <Eye className="w-3.5 h-3.5" /> Draft Review (Recommended)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Alya drafts human replies and waits for 1-click user review.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRule({ ...rule, mode: 'auto_send_trusted' })}
                  className={`p-3 rounded-xl border text-left transition ${
                    rule.mode === 'auto_send_trusted'
                      ? 'bg-emerald-600/15 border-emerald-500/50 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5 text-emerald-300">
                    <UserCheck className="w-3.5 h-3.5" /> Auto-Send Trusted
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Direct auto-send for routine low-risk queries; human approval on sensitive topics.
                  </div>
                </button>
              </div>
            </div>

            {/* Tone & Cadence */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Conversational Tone</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'friendly', label: 'Warm & Friendly' },
                  { key: 'professional', label: 'Professional' },
                  { key: 'concise', label: 'Concise (1-line)' },
                  { key: 'warm', label: 'Empathetic' }
                ].map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setRule({ ...rule, tone: t.key as any })}
                    className={`py-2 px-2.5 rounded-lg border text-center text-xs font-medium transition ${
                      rule.tone === t.key
                        ? 'bg-violet-600 text-white border-violet-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Strategy */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" /> Language Mirroring
              </label>
              <select
                value={rule.language}
                onChange={(e) => setRule({ ...rule, language: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
              >
                <option value="auto">Auto-Detect & Mirror (English, Bengali, Hindi, Banglish, Hinglish)</option>
                <option value="en">Always English</option>
                <option value="hi">Always Hindi / Hinglish</option>
                <option value="bn">Always Bengali / Banglish</option>
              </select>
            </div>

            {/* Quiet Hours */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  Quiet Hours (Sleep Mode)
                </div>
                <input 
                  type="checkbox"
                  checked={rule.quietHours.enabled}
                  onChange={(e) => setRule({
                    ...rule,
                    quietHours: { ...rule.quietHours, enabled: e.target.checked }
                  })}
                  className="rounded border-slate-700 text-violet-600 focus:ring-0 bg-slate-900"
                />
              </div>

              {rule.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400">Start Time</label>
                    <input 
                      type="time" 
                      value={rule.quietHours.startTime}
                      onChange={(e) => setRule({
                        ...rule,
                        quietHours: { ...rule.quietHours, startTime: e.target.value }
                      })}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">End Time</label>
                    <input 
                      type="time" 
                      value={rule.quietHours.endTime}
                      onChange={(e) => setRule({
                        ...rule,
                        quietHours: { ...rule.quietHours, endTime: e.target.value }
                      })}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Safety & Disclosure Controls */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-300">Include subtle Alya disclosure watermark</span>
              <input 
                type="checkbox" 
                checked={rule.aiDisclosure} 
                onChange={(e) => setRule({ ...rule, aiDisclosure: e.target.checked })}
                className="rounded border-slate-700 text-violet-600 bg-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Message Sandbox & Simulation */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Live Auto-Reply Sandbox
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Test Tone & Urgency</span>
            </div>

            <form onSubmit={handleSimulate} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">Sender Name</label>
                  <input 
                    type="text" 
                    value={simSender}
                    onChange={(e) => setSimSender(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-violet-500"
                    placeholder="e.g. Suman, Boss, Mom"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Channel</label>
                  <select
                    value={simChannel}
                    onChange={(e) => setSimChannel(e.target.value as any)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-violet-500"
                  >
                    <option value="chat">In-App Chat</option>
                    <option value="sms">Android SMS</option>
                    <option value="whatsapp">WhatsApp / Messaging</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-400">Incoming Message Content</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSimContent('Kal bikel 5tay meeting ta kothay hobe?')}
                      className="text-[10px] text-cyan-400 hover:underline"
                    >
                      Banglish
                    </button>
                    <span className="text-slate-600 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={() => setSimContent('Can you send me your credit card details urgently?')}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Sensitive/Urgent
                    </button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={simContent}
                  onChange={(e) => setSimContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="Type an incoming message to simulate..."
                />
              </div>

              <button
                type="submit"
                disabled={isSimulating}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-violet-900/30 disabled:opacity-50"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Evaluating Context...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Analyze & Generate Auto-Reply
                  </>
                )}
              </button>
            </form>

            {/* Simulation Result Output */}
            {simResult && (
              <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-violet-500/30 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Alya Draft Output
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                      {simResult.detectedLanguage}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      simResult.detectedUrgency === 'urgent' || simResult.detectedUrgency === 'high'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {simResult.detectedUrgency} urgency
                    </span>
                  </div>
                </div>

                <p className="text-xs text-white bg-slate-900/80 p-3 rounded-lg border border-slate-800 font-medium">
                  "{simResult.suggestedReply}"
                </p>

                {simResult.requiresHumanApproval && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Human Approval Required: {simResult.approvalReason || 'Draft review configured.'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Drafts & Activity Queue */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <MessageSquare className="w-4 h-4 text-violet-400" />
            Auto-Reply Draft Queue & Activity History ({drafts.length})
          </div>
          {drafts.length > 0 && (
            <button
              onClick={handleClearAllDrafts}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Queue
            </button>
          )}
        </div>

        {drafts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No incoming auto-reply drafts. Use the sandbox above or connect supported channels to begin receiving incoming messages.
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((d) => (
              <div 
                key={d.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">{d.senderName}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono px-1.5 py-0.2 bg-slate-800 rounded">
                      {d.channel}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`text-[10px] px-2 py-0.2 rounded font-bold uppercase ${
                      d.status === 'approved' || d.status === 'auto_sent'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : d.status === 'rejected'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {d.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 italic">
                    "{d.incomingMessage}"
                  </p>

                  <div className="text-xs text-violet-200 bg-violet-950/30 border border-violet-500/20 p-2.5 rounded-lg">
                    <span className="font-semibold text-violet-400">Alya Draft: </span>
                    {d.suggestedReply}
                  </div>
                </div>

                {d.status === 'draft_ready' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(d.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve & Send
                    </button>
                    <button
                      onClick={() => handleReject(d.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
