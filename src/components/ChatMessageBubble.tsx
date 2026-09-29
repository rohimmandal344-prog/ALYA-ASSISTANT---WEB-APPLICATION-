import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Copy, 
  Check, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Terminal, 
  Zap, 
  User,
  Play,
  Square,
  CloudSun,
  Droplets,
  Wind,
  Thermometer,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { ChatMessage } from '../services/conversationService';
import { playAlyaVoice, stopAlyaVoice } from '../lib/femaleVoiceSynthesizer';
import { AlyaSpeechWaveform } from './AlyaSpeechWaveform';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onRetry?: (text: string) => void;
  onExecuteCommand?: (cmd: string) => void;
}

export function ChatMessageBubble({ message, onRetry, onExecuteCommand }: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (isUser) return; // TTS is strictly supported on Alya's messages only

    if (isSpeaking) {
      stopAlyaVoice();
      setIsSpeaking(false);
      return;
    }

    playAlyaVoice(message.content, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const formatTimestamp = (ts?: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render text with basic markdown code blocks, bold, lists, and inline code
  const renderFormattedContent = (content: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'code', lang: match[1] || 'plaintext', value: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.substring(lastIndex) });
    }

    return (
      <div className="space-y-2">
        {parts.map((part, idx) => {
          if (part.type === 'code') {
            return (
              <div key={idx} className="my-2.5 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 font-mono text-xs shadow-md">
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
                  <span className="flex items-center gap-1.5 font-semibold text-indigo-400 uppercase tracking-wider">
                    <Terminal className="w-3.5 h-3.5" />
                    {part.lang}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(part.value);
                    }}
                    className="hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <pre className="p-3.5 overflow-x-auto text-emerald-400 leading-relaxed font-mono">
                  <code>{part.value}</code>
                </pre>
              </div>
            );
          }

          const lines = part.value.split('\n');
          return (
            <div key={idx} className="space-y-1">
              {lines.map((line, lIdx) => {
                if (!line.trim()) return <div key={lIdx} className="h-1.5" />;

                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                  return (
                    <div key={lIdx} className="flex items-start gap-2 pl-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0"></span>
                      <span className="leading-relaxed">{parseInlineStyles(line.trim().substring(2))}</span>
                    </div>
                  );
                }

                if (/^\d+\.\s/.test(line.trim())) {
                  const num = line.trim().match(/^(\d+\.)\s/)?.[1];
                  const rest = line.trim().replace(/^\d+\.\s/, '');
                  return (
                    <div key={lIdx} className="flex items-start gap-2 pl-2">
                      <span className="font-mono text-indigo-500 font-bold shrink-0">{num}</span>
                      <span className="leading-relaxed">{parseInlineStyles(rest)}</span>
                    </div>
                  );
                }

                if (line.startsWith('### ')) {
                  return <h4 key={lIdx} className="font-bold text-sm text-indigo-400 mt-2">{line.replace('### ', '')}</h4>;
                }
                if (line.startsWith('## ')) {
                  return <h3 key={lIdx} className="font-bold text-base text-slate-900 dark:text-white mt-2">{line.replace('## ', '')}</h3>;
                }

                return <p key={lIdx} className="leading-relaxed">{parseInlineStyles(line)}</p>;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const parseInlineStyles = (text: string) => {
    const segments = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return segments.map((seg, i) => {
      if (seg.startsWith('`') && seg.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 font-mono text-[11px] mx-0.5 font-medium">
            {seg.slice(1, -1)}
          </code>
        );
      }
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900 dark:text-white">{seg.slice(2, -2)}</strong>;
      }
      return seg;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`group flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20 mt-1">
          <Sparkles className="w-4 h-4" />
        </div>
      )}

      <div className={`max-w-[85%] md:max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Message Card Bubble */}
        <div className={`
          relative rounded-3xl p-4 md:p-5 shadow-xs transition-all
          ${isUser 
            ? message.status === 'failed'
              ? 'bg-red-500 text-white rounded-tr-xs shadow-md'
              : message.status === 'sending'
                ? 'bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900 rounded-tr-xs shadow-md animate-pulse opacity-80'
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-tr-xs shadow-md' 
            : 'bg-white dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80 rounded-tl-xs shadow-sm backdrop-blur-sm'}
        `}>
          {/* Main content body */}
          <div className="text-sm font-normal">
            {renderFormattedContent(message.content)}
          </div>

          {/* Hardware / Command Status Badge */}
          {message.commandExecution && (
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-950/40 p-2.5 rounded-xl">
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Target: {message.commandExecution.deviceId || 'Android Device'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {message.commandExecution.status === 'success' ? (
                  <span className="text-emerald-500 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Executed
                  </span>
                ) : message.commandExecution.status === 'failure' ? (
                  <span className="text-red-500 font-bold text-[11px] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {message.commandExecution.error || 'Failed'}
                  </span>
                ) : (
                  <span className="text-amber-500 font-bold text-[11px] flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 animate-spin" /> Pending
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Weather Card */}
          {message.weatherData && (
            <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-950/80 border border-indigo-500/25 shadow-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <CloudSun className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{message.weatherData.locationName}</span>
                      {message.weatherData.isUserGPS && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">GPS</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">{message.weatherData.condition}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-white font-mono">{message.weatherData.temperature}°C</div>
                  <div className="text-[10px] text-slate-400">Feels like {message.weatherData.feelsLike}°C</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5 text-[10px] text-slate-300">
                <div className="flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>Rain: {message.weatherData.rainProbability ?? 0}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind className="w-3 h-3 text-teal-400 shrink-0" />
                  <span>Wind: {message.weatherData.windSpeed} km/h</span>
                </div>
                <div className="flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>{message.weatherData.minTemp ?? 20}° / {message.weatherData.maxTemp ?? 30}°</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5">
                <span>Source: {message.weatherData.source || 'Open-Meteo API'}</span>
                {message.weatherData.sunrise && (
                  <span>☀️ {message.weatherData.sunrise} · 🌙 {message.weatherData.sunset}</span>
                )}
              </div>
            </div>
          )}

          {/* Message Bottom Toolbar */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs">
            {/* ONLY render TTS audio button & real-time visualizer on Alya Assistant chats */}
            {!isUser ? (
              isSpeaking ? (
                <AlyaSpeechWaveform
                  isPlaying={true}
                  onStop={() => {
                    stopAlyaVoice();
                    setIsSpeaking(false);
                  }}
                  variant="inline"
                />
              ) : (
                <button
                  onClick={handleSpeak}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all"
                  title="Listen to Alya's voice response"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span className="text-[11px]">Play Audio</span>
                </button>
              )
            ) : (
              <div />
            )}

            {/* Assistant / Sender Tag */}
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
              {isUser && message.status === 'sending' && (
                <span className="flex items-center gap-1 text-slate-400 font-bold">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Sending...
                </span>
              )}
              {isUser && message.status === 'failed' && (
                <span className="flex items-center gap-1 text-red-400 font-bold">
                  <AlertCircle className="w-3 h-3" />
                  Failed
                </span>
              )}
              {!isUser && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  Alisa (Alya)
                </span>
              )}
              <span>{formatTimestamp(message.timestamp)}</span>
            </div>
          </div>
        </div>

        {/* Action Toolbar on Hover */}
        <div className={`flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 text-xs`}>
          <button
            onClick={handleCopy}
            className="p-1 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
            title="Copy message"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy</span>
          </button>

          {isUser && onRetry && (
            <button
              onClick={() => onRetry(message.content)}
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-[11px] font-medium"
              title="Resend prompt"
            >
              Re-run
            </button>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-xs mt-1">
          <User className="w-4 h-4" />
        </div>
      )}
    </motion.div>
  );
}
