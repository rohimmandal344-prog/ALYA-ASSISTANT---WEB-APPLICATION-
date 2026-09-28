import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Send, 
  Sparkles, 
  AlertCircle, 
  Phone, 
  History, 
  Zap, 
  RotateCcw, 
  Mic, 
  Search, 
  X, 
  Download, 
  ArrowDown, 
  Volume2, 
  VolumeX
} from 'lucide-react';
import { useConversation } from '../hooks/useConversation';
import { ConversationSidebar } from './ConversationSidebar';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatSuggestions } from './ChatSuggestions';
import { JarvisHUD, AssistantState } from './JarvisHUD';

export function ChatView() {
  const {
    conversations,
    activeConversationId,
    messages,
    isTyping,
    error,
    lastLatencyMs,
    sendMessage,
    createNewConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    clearAllConversations,
    retryLastMessage
  } = useConversation();

  const [input, setInput] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [searchInChat, setSearchInChat] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const getHudState = (): AssistantState => {
    if (isListening) return 'Listening';
    if (isTyping) return 'Thinking';
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      if (lastMsg.verified === false) return 'Failed';
      if (lastMsg.intent === 'weather_query' || lastMsg.intent === 'web_search') return 'Searching';
      return 'Completed';
    }
    return 'Completed';
  };

  // Filter messages if search active
  const filteredMessages = searchInChat.trim() 
    ? messages.filter(m => m.content.toLowerCase().includes(searchInChat.toLowerCase()))
    : messages;

  // Virtualizer for snappy performance across thousands of messages
  const rowVirtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 100, // Dynamic height estimation
    overscan: 10, // Buffer items above and below viewport
  });

  // Play gentle subtle feedback audio on message sent/received
  const playFeedbackChime = useCallback((type: 'send' | 'receive') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'send') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {}
  }, [soundEnabled]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (filteredMessages.length > 0 && !showScrollBottom) {
      rowVirtualizer.scrollToIndex(filteredMessages.length - 1, { 
        align: 'end', 
        behavior: 'smooth' 
      });
    }
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      playFeedbackChime('receive');
    }
  }, [filteredMessages.length, isTyping, showScrollBottom, playFeedbackChime, rowVirtualizer]);

  // Track scroll position to display floating jump-to-bottom button
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 180);
  };

  const scrollToBottom = () => {
    if (filteredMessages.length > 0) {
      rowVirtualizer.scrollToIndex(filteredMessages.length - 1, { 
        align: 'end', 
        behavior: 'smooth' 
      });
    } else if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    setShowScrollBottom(false);
  };

  // Adjust textarea height dynamically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const handleSend = (overrideMsg?: string) => {
    const textToSend = typeof overrideMsg === 'string' ? overrideMsg : input;
    if (!textToSend.trim()) return;

    playFeedbackChime('send');
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    sendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Speech Recognition / Voice Dictation
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInput(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  // Export Conversation as Markdown
  const exportConversation = () => {
    if (messages.length === 0) return;
    const currentConv = conversations.find(c => c.id === activeConversationId);
    const title = currentConv?.title || 'Alya-Conversation';
    
    let content = `# ${title}\nExported: ${new Date().toLocaleString()}\n\n---\n\n`;
    messages.forEach(m => {
      content += `### ${m.role === 'user' ? 'User' : (m.agentName || 'Alya')}:\n${m.content}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSession = conversations.find(c => c.id === activeConversationId);
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex h-full bg-slate-50/50 dark:bg-slate-950 overflow-hidden relative font-sans">
      {/* Collapsible History Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        currentConversationId={activeConversationId}
        onSelectConversation={(id) => {
          selectConversation(id);
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsHistoryOpen(false);
          }
        }}
        onNewConversation={() => {
          createNewConversation();
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsHistoryOpen(false);
          }
        }}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onClearAllConversations={clearAllConversations}
        isOpen={isHistoryOpen}
        onToggle={() => setIsHistoryOpen(prev => !prev)}
      />

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Header Bar */}
        <header className="p-3.5 md:px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsHistoryOpen(prev => !prev)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title={isHistoryOpen ? "Collapse Sidebar" : "Open History"}
            >
              <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {currentSession?.title || 'Alya Assistant'}
                  </h2>
                  {lastLatencyMs !== null && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                      <Zap className="w-3 h-3" />
                      {lastLatencyMs}ms
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-tight">
                    VIRTUALIZED HIGH-PERFORMANCE STREAM • REAL-TIME MEMORY
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-1.5">
            {/* Search in chat toggle */}
            <button
              onClick={() => setShowSearch(prev => !prev)}
              className={`p-2 rounded-xl transition-colors ${
                showSearch 
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Search conversation"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Sound chime toggle */}
            <button
              onClick={() => setSoundEnabled(prev => !prev)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:flex"
              title={soundEnabled ? "Mute audio cues" : "Enable audio cues"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Export Markdown */}
            <button
              onClick={exportConversation}
              disabled={messages.length === 0}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 hidden sm:flex"
              title="Export conversation as Markdown"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Live Call Voice Modal Trigger */}
            <button 
              onClick={() => (window as any).toggleVoicePopup?.()}
              className="ml-1 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Live Call</span>
            </button>
          </div>
        </header>

        {/* In-Chat Search Bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-hidden"
            >
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchInChat}
                onChange={(e) => setSearchInChat(e.target.value)}
                placeholder="Search messages in this conversation..."
                className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
              />
              {searchInChat && (
                <span className="text-[11px] text-slate-400 font-mono">
                  {filteredMessages.length} match{filteredMessages.length === 1 ? '' : 'es'}
                </span>
              )}
              <button
                onClick={() => { setSearchInChat(''); setShowSearch(false); }}
                className="p-1 hover:text-slate-800 dark:hover:text-white text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Futuristic Jarvis HUD Indicator */}
        <div className="px-4 pt-3 shrink-0">
          <JarvisHUD 
            state={getHudState()} 
            latencyMs={lastLatencyMs || undefined} 
            onVoiceClick={() => (window as any).toggleVoicePopup?.()} 
          />
        </div>

        {/* Message Stream with DOM Virtualization */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth"
        >
          {messages.length === 0 ? (
            <ChatSuggestions onSelectPrompt={(prompt) => handleSend(prompt)} />
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map((virtualRow) => {
                const msg = filteredMessages[virtualRow.index];
                if (!msg) return null;

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="pb-5"
                  >
                    <ChatMessageBubble
                      message={msg}
                      onRetry={(text) => handleSend(text)}
                      onExecuteCommand={(cmd) => handleSend(cmd)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Typing Indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="flex justify-start items-center gap-3 pl-1 pt-2"
              >
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>

                <div className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-3xl rounded-tl-xs px-5 py-3.5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center gap-3">
                  <span className="text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
                    Alya is typing
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Banner with Retry */}
          {error && (
            <div className="flex justify-center my-4">
              <button
                onClick={retryLastMessage}
                className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs font-semibold px-4 py-2.5 rounded-2xl border border-amber-200 dark:border-amber-900/60 flex items-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-xs"
              >
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{error}</span>
                <span className="underline font-bold ml-1 flex items-center gap-1 text-amber-900 dark:text-amber-100">
                  <RotateCcw className="w-3.5 h-3.5" /> Retry
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Floating Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollBottom && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToBottom}
              className="absolute bottom-28 right-8 p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all z-20"
              title="Scroll to latest"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Rich Input Area */}
        <div className="p-3 md:p-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="max-w-4xl mx-auto">
            <div className={`
              relative flex items-end bg-slate-100 dark:bg-slate-900 border rounded-3xl transition-all shadow-xs
              ${isListening 
                ? 'border-red-500 ring-2 ring-red-500/20' 
                : 'border-slate-200 dark:border-slate-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20'}
            `}>
              {/* Voice Dictation Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3.5 mb-1 ml-1.5 rounded-2xl transition-all shrink-0 ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30' 
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
                title={isListening ? "Listening... click to stop" : "Voice dictation"}
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Dynamic Resizing Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening to your voice..." : "Message Alya (Press Enter to send, Shift+Enter for new line)..."}
                className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 py-3.5 px-2 text-sm outline-none resize-none min-h-[44px] max-h-[140px] font-medium leading-relaxed"
              />

              {/* Send Button */}
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className={`
                  p-3 mb-1.5 mr-1.5 rounded-2xl transition-all shrink-0 shadow-md
                  ${input.trim() 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 scale-100' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 opacity-40 cursor-not-allowed'}
                `}
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-bar status */}
            <div className="flex items-center justify-between px-2 pt-2 text-[10px] text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span>Alya Cognitive Neural Core</span>
              </span>
              <span>
                Shift + Enter for new line • Enter to send
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
