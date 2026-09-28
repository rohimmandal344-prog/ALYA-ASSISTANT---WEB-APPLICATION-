import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, 
  Trash2, 
  Clock, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Bot, 
  User, 
  ShieldAlert, 
  RefreshCw, 
  Sparkles, 
  Download,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { voiceHistoryService, VoiceSessionRecord } from '../services/voiceHistoryService';

export function VoiceTranscriptView() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<VoiceSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync / Subscribe past sessions in real-time
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);

    const unsubscribe = voiceHistoryService.subscribeToVoiceSessions(
      user.uid,
      (list) => {
        setSessions(list);
        setLoading(false);
      },
      (err) => {
        console.error('[VoiceTranscriptView] Subscription Error:', err);
        setErrorMessage('Failed to sync past voice sessions from Firestore.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    if (!confirm('Are you sure you want to delete this voice call record? This is permanent.')) return;

    try {
      setErrorMessage(null);
      await voiceHistoryService.deleteVoiceSession(user.uid, id);
      if (selectedSessionId === id) setSelectedSessionId(null);
    } catch (err: any) {
      setErrorMessage('Failed to delete call session.');
    }
  };

  const handleClearAllSessions = async () => {
    if (!user || sessions.length === 0) return;
    if (!confirm('Privacy WIPE: Are you sure you want to securely delete ALL past voice sessions from your cloud profile? This cannot be undone.')) return;

    try {
      setErrorMessage(null);
      const ids = sessions.map(s => s.id);
      await voiceHistoryService.clearAllVoiceSessions(user.uid, ids);
      setSelectedSessionId(null);
    } catch (err: any) {
      setErrorMessage('Failed to wipe voice sessions.');
    }
  };

  const handleExportSession = (session: VoiceSessionRecord) => {
    let content = `# ${session.title}\nID: ${session.id}\nDate: ${session.createdAt?.toDate ? session.createdAt.toDate().toLocaleString() : 'Past Call'}\n\n---\n\n`;
    session.transcript.forEach(msg => {
      content += `### ${msg.speaker === 'user' ? 'You' : 'Alya'}:\n${msg.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSessions = sessions.filter(session => {
    const matchesTitle = session.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMessage = session.transcript.some(msg => msg.text.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTitle || matchesMessage;
  });

  const activeSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* Upper header segment */}
      <header className="p-4 md:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
              <Phone className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Voice Session Logs</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Call History & Transcripts</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Wipe or retrieve past low-latency spoken conversations. All transcripts are securely protected with owner-only access rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAllSessions}
              disabled={sessions.length === 0}
              className="px-3.5 py-2 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 bg-red-500/5 hover:bg-red-500/10 disabled:opacity-30 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Privacy Wipe History</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </header>

      {/* Main split work-view panel */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left column: Sessions List */}
        <div className="w-full lg:w-96 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 overflow-y-auto">
          {/* Search bar wrapper */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search past conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>
          </div>

          {/* Session Cards Feed */}
          <div className="flex-1 p-2 space-y-1">
            {loading ? (
              <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                <span>Loading call history...</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400">
                No past call sessions found.
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isActive = session.id === selectedSessionId;
                const date = session.createdAt?.toDate ? session.createdAt.toDate() : new Date();
                const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between border ${
                      isActive 
                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm text-slate-950 dark:text-white font-bold'
                        : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate leading-tight">{session.title}</p>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{dateStr} • {timeStr}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Active Transcript Dialogue */}
        <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-950/20 overflow-hidden">
          {activeSession ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Dialogue Header */}
              <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{activeSession.title}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    ID: {activeSession.id} • {activeSession.transcript.length} dialogue turns
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportSession(activeSession)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Markdown</span>
                  </button>
                </div>
              </div>

              {/* Dialogue message boxes list */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {activeSession.transcript.map((msg, index) => {
                  const isUser = msg.speaker === 'user';
                  const formattedTime = msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 font-bold">
                        {isUser ? <User className="w-3 h-3 text-emerald-500" /> : <Bot className="w-3 h-3 text-indigo-400" />}
                        <span>{isUser ? 'You' : 'Alya'}</span>
                        <span className="font-normal font-mono">• {formattedTime}</span>
                      </div>

                      <div className="relative group max-w-[80%] flex items-start gap-2">
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isUser 
                            ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-500/10' 
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-200 rounded-tl-none'
                        }`}>
                          <p>{msg.text}</p>
                        </div>
                        <button
                          onClick={() => handleCopyText(`${index}-${msg.speaker}`, msg.text)}
                          className="opacity-0 group-hover:opacity-100 p-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-lg shrink-0 mt-2 transition-all"
                          title="Copy text"
                        >
                          {copiedId === `${index}-${msg.speaker}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 mb-4 border border-dashed border-slate-200 dark:border-slate-800 shadow-inner">
                <Phone className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Active Call Selected</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                Select a past call record from the sidebar list to inspect the complete dialog transcript.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
