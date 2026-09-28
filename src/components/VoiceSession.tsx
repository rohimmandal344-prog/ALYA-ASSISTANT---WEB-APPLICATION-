import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  PhoneOff, 
  Sparkles, 
  User, 
  Bot, 
  Radio, 
  Activity, 
  Send, 
  AlertCircle, 
  CheckCircle2,
  Lock,
  Clock,
  Layers,
  Terminal,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { stopAlyaVoice } from '../lib/femaleVoiceSynthesizer';
import { speechEngine } from '../lib/SpeechEngine';
import { voiceHistoryService } from '../services/voiceHistoryService';
import { PermissionManager } from '../lib/permissionManager';
import { voiceEngine } from '../lib/VoiceEngine';

interface TranscriptItem {
  id: string;
  speaker: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface VoiceSessionProps {
  isOpen: boolean;
  onClose: () => void;
  voiceName?: string;
}

export function VoiceSession({ isOpen, onClose, voiceName = 'Aoede' }: VoiceSessionProps) {
  const { user } = useAuth();
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<'none' | 'user' | 'assistant'>('none');
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(12));
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [liveTextInput, setLiveTextInput] = useState('');
  const [micDenied, setMicDenied] = useState(false);

  // Connection and Audio States
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const speakerAnalyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const turnGenerationIdRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Diagnostics Telemetry Storage
  const pingIntervalRef = useRef<any>(null);
  const diagIntervalRef = useRef<any>(null);
  const statsRef = useRef({
    wsUrl: '',
    readyState: 'CLOSED',
    messagesSent: 0,
    messagesReceived: 0,
    lastHeartbeatMs: null as number | null,
    latencyHistory: [] as number[],
    lastMessageTime: null as string | null,
    lastError: null as string | null,
    webaudioState: 'closed',
    webaudioSampleRate: 0,
    webaudioNode: 'None',
    workletLoaded: 'Checking',
    audioQueueSize: 0,
    tracks: [] as any[],
    ttsQuotaExceeded: false,
  });

  const publishDiagnostics = useCallback(() => {
    statsRef.current.readyState = wsRef.current 
      ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsRef.current.readyState] 
      : 'CLOSED';
    statsRef.current.audioQueueSize = audioQueueRef.current.length;
    statsRef.current.ttsQuotaExceeded = !!(window as any).ttsQuotaExceeded;
    
    if (audioCtxRef.current) {
      statsRef.current.webaudioState = audioCtxRef.current.state;
      statsRef.current.webaudioSampleRate = audioCtxRef.current.sampleRate;
      statsRef.current.webaudioNode = processorRef.current 
        ? ((processorRef.current as any).port ? 'AudioWorkletNode' : 'ScriptProcessorNode')
        : 'None';
      statsRef.current.workletLoaded = processorRef.current ? 'Loaded' : 'Fallback / Not Loaded';
    } else {
      statsRef.current.webaudioState = 'closed';
      statsRef.current.webaudioSampleRate = 0;
      statsRef.current.webaudioNode = 'None';
      statsRef.current.workletLoaded = 'Not Initialized';
    }

    if (streamRef.current) {
      statsRef.current.tracks = streamRef.current.getTracks().map(track => ({
        id: track.id,
        label: track.label || 'Microphone Input',
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted,
      }));
    } else {
      statsRef.current.tracks = [];
    }

    if (typeof (window as any).onAlyaDiagnosticsUpdate === 'function') {
      (window as any).onAlyaDiagnosticsUpdate({ ...statsRef.current });
    }
  }, []);

  // Expose publisher globally
  useEffect(() => {
    (window as any).publishAlyaDiagnostics = publishDiagnostics;
    return () => {
      delete (window as any).publishAlyaDiagnostics;
    };
  }, [publishDiagnostics]);

  // Natural female voice synthesis fallback for text replies
  const speakTextWithHumanVoice = useCallback((text: string) => {
    if (!speakerOn) return;
    
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    speechEngine.speak(text, {
      onStart: () => {
        setActiveSpeaker('assistant');
        isPlayingRef.current = true;
      },
      onEnd: () => {
        setActiveSpeaker('none');
        isPlayingRef.current = false;
      },
      onError: () => {
        setActiveSpeaker('none');
        isPlayingRef.current = false;
      }
    }, 'normal');
  }, [speakerOn]);

  const saveTranscriptEntry = (speaker: 'user' | 'assistant', text: string) => {
    if (!text || !text.trim()) return;
    try {
      const stored = localStorage.getItem('alya_voice_transcripts');
      const list = stored ? JSON.parse(stored) : [];
      const newEntry = {
        id: Math.random().toString(36).substring(2, 9),
        speaker,
        text: text.trim(),
        timestamp: new Date().toISOString()
      };
      list.push(newEntry);
      if (list.length > 200) list.shift();
      localStorage.setItem('alya_voice_transcripts', JSON.stringify(list));
      window.dispatchEvent(new Event('alya_transcript_updated'));
    } catch (e) {
      console.warn('[VoiceSession] Error saving transcript entry:', e);
    }
  };

  const handleBargeIn = useCallback((reason = 'user_barge_in') => {
    turnGenerationIdRef.current += 1;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextStartTimeRef.current = 0;

    if (activeSourceNodeRef.current) {
      try {
        activeSourceNodeRef.current.stop();
        activeSourceNodeRef.current.disconnect();
      } catch {}
      activeSourceNodeRef.current = null;
    }

    speechEngine.stop();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopAlyaVoice();

    setActiveSpeaker('user');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'LIVE_INTERRUPT', reason }));
    }
  }, []);

  const setupSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const preferredLang = localStorage.getItem('alya_preferred_lang') || 'auto';
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = preferredLang === 'auto' ? 'en-US' : preferredLang;

      // Instant Barge-In detection when speech is first detected by microphone
      recognition.onspeechstart = () => {
        if (isPlayingRef.current || activeSpeaker === 'assistant') {
          handleBargeIn('speech_start_detected');
        }
      };

      recognition.onresult = async (event: any) => {
        const latestIndex = event.results.length - 1;
        const transcriptText = event.results[latestIndex][0].transcript.trim();
        if (!transcriptText) return;

        // Instant interruption of any ongoing response
        handleBargeIn('user_speech_result');

        setTranscript(prev => [...prev, { id: Math.random().toString(), speaker: 'user', text: transcriptText, timestamp: new Date() }]);
        saveTranscriptEntry('user', transcriptText);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'LIVE_TEXT_INPUT', text: transcriptText }));
        } else {
          handleCognitiveFallback(transcriptText);
        }
      };

      recognition.onerror = () => {};
      recognition.onend = () => {
        if (isOpen && isLive && !isMuted) {
          try { recognition.start(); } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition notice:', err);
    }
  };

  const handleCognitiveFallback = async (text: string) => {
    try {
      const preferredLang = localStorage.getItem('alya_preferred_lang') || 'auto';
      const res = await fetch('/api/alya/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'voice_call', language: preferredLang })
      });
      const data = await res.json();
      const reply = data.reply || "I'm right here with you!";
      setTranscript(prev => [...prev, { id: Math.random().toString(), speaker: 'assistant', text: reply, timestamp: new Date() }]);
      speakTextWithHumanVoice(reply);
    } catch {
      speakTextWithHumanVoice("I got you. Let me look right into that for you.");
    }
  };

  const convertFloat32ToInt16 = (buffer: Float32Array) => {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
      buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
    }
    return buf;
  };

  const setupAudioCapture = async () => {
    try {
      setMicPermissionError(null);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioCtxRef.current) {
        if (audioCtxRef.current.state !== 'closed') {
          await audioCtxRef.current.close().catch(() => {});
        }
        audioCtxRef.current = null;
      }

      if (outputAudioCtxRef.current) {
        if (outputAudioCtxRef.current.state !== 'closed') {
          await outputAudioCtxRef.current.close().catch(() => {});
        }
        outputAudioCtxRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      streamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass({ sampleRate: 16000 });
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioCtxRef.current = audioCtx;

      // Dedicated 24kHz Output Context for LiveKit Voice Agent Audio Playback (Ultra-Realistic Fidelity)
      const outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      if (outputAudioCtx.state === 'suspended') {
        await outputAudioCtx.resume();
      }
      outputAudioCtxRef.current = outputAudioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const micAnalyser = audioCtx.createAnalyser();
      micAnalyser.fftSize = 32;
      micAnalyserRef.current = micAnalyser;
      source.connect(micAnalyser);

      const speakerAnalyser = outputAudioCtx.createAnalyser();
      speakerAnalyser.fftSize = 32;
      speakerAnalyserRef.current = speakerAnalyser;

      if (audioCtx.audioWorklet) {
        try {
          try {
            await audioCtx.audioWorklet.addModule('/pcm-processor.js');
          } catch {
            const inlinePcmCode = `
              class PCMWorkletProcessor extends AudioWorkletProcessor {
                process(inputs) {
                  const input = inputs[0];
                  if (input && input.length > 0) {
                    const float32Data = input[0];
                    if (float32Data && float32Data.length > 0) {
                      const pcm16 = new Int16Array(float32Data.length);
                      for (let i = 0; i < float32Data.length; i++) {
                        const s = Math.max(-1, Math.min(1, float32Data[i]));
                        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                      }
                      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
                    }
                  }
                  return true;
                }
              }
              registerProcessor('pcm-worklet-processor', PCMWorkletProcessor);
            `;
            const blob = new Blob([inlinePcmCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            await audioCtx.audioWorklet.addModule(url);
            URL.revokeObjectURL(url);
          }

          const workletNode = new AudioWorkletNode(audioCtx, 'pcm-worklet-processor');
          workletNode.port.onmessage = (event) => {
            if (!isMuted && wsRef.current?.readyState === WebSocket.OPEN) {
              const pcmBuffer = new Uint8Array(event.data);
              let binary = '';
              const chunkSize = 8192;
              for (let i = 0; i < pcmBuffer.length; i += chunkSize) {
                const chunk = pcmBuffer.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, Array.from(chunk));
              }
              const base64 = btoa(binary);
              wsRef.current.send(JSON.stringify({ type: 'LIVE_AUDIO_INPUT', audio: base64 }));
              statsRef.current.messagesSent += 1;
            }
          };

          source.connect(workletNode);
          
          // Connect to silent GainNode (gain = 0) so AudioWorklet stays alive without pumping mic audio to physical speakers
          const silentGain = audioCtx.createGain();
          silentGain.gain.setValueAtTime(0, audioCtx.currentTime);
          workletNode.connect(silentGain);
          silentGain.connect(audioCtx.destination);
          
          processorRef.current = workletNode;
          return;
        } catch (workletErr) {
          console.warn('[VoiceSession] ScriptProcessorFallback active:', workletErr);
        }
      }

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isMuted && wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = convertFloat32ToInt16(inputData);
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          wsRef.current.send(JSON.stringify({ type: 'LIVE_AUDIO_INPUT', audio: base64 }));
          statsRef.current.messagesSent += 1;
        }
      };

      source.connect(processor);
      
      // Connect to silent GainNode (gain = 0) to eliminate acoustic feedback loop
      const silentGain = audioCtx.createGain();
      silentGain.gain.setValueAtTime(0, audioCtx.currentTime);
      processor.connect(silentGain);
      silentGain.connect(audioCtx.destination);
    } catch (e: any) {
      console.warn('Microphone configuration notice:', e?.message || e);
      setMicDenied(true);
      setMicPermissionError('Microphone access is requested. Please verify settings and permission bars.');
    }
  };

  const playAudioChunk = (base64Audio: string, generationId?: number) => {
    if (!audioCtxRef.current || !speakerOn) return;
    if (generationId !== undefined && generationId !== turnGenerationIdRef.current) {
      return; // Discard obsolete audio chunk from interrupted turn
    }

    try {
      // Robust base64 decoding
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0;
      }

      audioQueueRef.current.push(floatData);
      setActiveSpeaker('assistant');
      if (!isPlayingRef.current) processQueue();
    } catch (err) {
      console.warn('[VoiceSession] Audio decode error:', err);
    }
  };

  const nextStartTimeRef = useRef<number>(0);

  const processQueue = async () => {
    const outCtx = outputAudioCtxRef.current || audioCtxRef.current;
    if (audioQueueRef.current.length === 0 || !outCtx || !speakerOn) {
      isPlayingRef.current = false;
      activeSourceNodeRef.current = null;
      nextStartTimeRef.current = 0;
      setActiveSpeaker('none');
      return;
    }

    if (outCtx.state === 'suspended') {
      try { await outCtx.resume(); } catch {}
    }

    isPlayingRef.current = true;
    setActiveSpeaker('assistant');
    const chunk = audioQueueRef.current.shift()!;
    
    // Direct 24000Hz pristine reproduction from LiveKit Voice Agent
    const sampleRate = 24000;
    const audioBuffer = outCtx.createBuffer(1, chunk.length, sampleRate);
    audioBuffer.getChannelData(0).set(chunk);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    activeSourceNodeRef.current = source;

    if (speakerAnalyserRef.current) {
      source.connect(speakerAnalyserRef.current);
      speakerAnalyserRef.current.connect(outCtx.destination);
    } else {
      source.connect(outCtx.destination);
    }

    // Precise scheduling to avoid gaps/pops
    const currentTime = outCtx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.01; // Small lookahead
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;

    source.onended = () => {
      if (activeSourceNodeRef.current === source) {
        activeSourceNodeRef.current = null;
      }
      if (audioQueueRef.current.length > 0) {
        processQueue();
      } else {
        isPlayingRef.current = false;
        setActiveSpeaker('none');
      }
    };
  };

  const handleSendLiveText = async () => {
    if (!liveTextInput.trim()) return;
    const text = liveTextInput.trim();
    setLiveTextInput('');
    setTranscript(prev => [...prev, { id: Math.random().toString(), speaker: 'user', text, timestamp: new Date() }]);
    
    window.speechSynthesis.cancel();
    stopAlyaVoice();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'LIVE_TEXT_INPUT', text }));
      statsRef.current.messagesSent += 1;
      publishDiagnostics();
    } else {
      await handleCognitiveFallback(text);
    }
  };

  const startLiveSession = async () => {
    try {
      // Centralized Permission & Readiness Check via PermissionManager
      const prereqs = await PermissionManager.verifyVoiceSessionPrerequisites();
      if (!prereqs.microphone.granted) {
        setMicDenied(true);
        setMicPermissionError(prereqs.microphone.error || 'Microphone access is explicitly blocked in browser permissions.');
      } else {
        setMicDenied(false);
        setMicPermissionError(null);
        try {
          await voiceEngine.initializeMicrophone();
        } catch (micErr: any) {
          console.info('[VoiceSession] Microphone initialization notice:', micErr?.message || micErr);
          setMicDenied(true);
          setMicPermissionError(micErr?.message || 'Microphone access is explicitly blocked in browser permissions.');
        }
      }

      if (!prereqs.network.online) {
        setMicPermissionError(`Network Warning: ${prereqs.network.error || 'Offline mode active.'}`);
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const userId = user?.uid || 'default_user';
      const wsUrl = `${protocol}//${window.location.host}/ws/live?clientType=voice&userId=${encodeURIComponent(userId)}`;
      
      statsRef.current = {
        wsUrl,
        readyState: 'CONNECTING',
        messagesSent: 0,
        messagesReceived: 0,
        lastHeartbeatMs: null,
        latencyHistory: [],
        lastMessageTime: null,
        lastError: null,
        webaudioState: 'closed',
        webaudioSampleRate: 0,
        webaudioNode: 'None',
        workletLoaded: 'Checking',
        audioQueueSize: 0,
        tracks: [],
        ttsQuotaExceeded: false,
      };
      publishDiagnostics();

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsLive(true);
        const preferredLang = localStorage.getItem('alya_preferred_lang') || 'auto';
        ws.send(JSON.stringify({ type: 'LIVE_START', voiceName, language: preferredLang }));
        statsRef.current.messagesSent += 1;
        
        setupAudioCapture();
        setupSpeechRecognition();
        publishDiagnostics();

        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
            statsRef.current.messagesSent += 1;
            publishDiagnostics();
          }
        }, 3000);

        diagIntervalRef.current = setInterval(() => {
          publishDiagnostics();
        }, 500);
      };

      ws.onmessage = async (event) => {
        statsRef.current.messagesReceived += 1;
        statsRef.current.lastMessageTime = new Date().toLocaleTimeString();

        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'PONG') {
            const rtt = Date.now() - msg.timestamp;
            statsRef.current.lastHeartbeatMs = rtt;
            statsRef.current.latencyHistory = [...statsRef.current.latencyHistory.slice(-9), rtt];
            publishDiagnostics();
            return;
          }

          if (msg.type === 'LIVE_STARTED') {
            setIsLive(true);
          }
          if (msg.type === 'LIVE_TEXT') {
            setTranscript(prev => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === 'assistant') {
                return [...prev.slice(0, -1), { ...last, text: last.text + msg.text }];
              } else {
                return [...prev, { id: Math.random().toString(), speaker: 'assistant', text: msg.text, timestamp: new Date() }];
              }
            });
            saveTranscriptEntry('assistant', msg.text);
          }
          if (msg.type === 'LIVE_AUDIO' && speakerOn) {
            playAudioChunk(msg.audio, turnGenerationIdRef.current);
          }
          if (msg.type === 'LIVE_ACTION' && msg.action) {
            if (msg.action.command === 'navigate_view') {
              const target = msg.action.params?.view || 'chat';
              window.dispatchEvent(new CustomEvent('alya:navigate', { detail: { view: target } }));
            } else if (msg.action.command === 'web_open_url' && msg.action.params?.url) {
              try { window.open(msg.action.params.url, '_blank', 'noopener,noreferrer'); } catch {}
            }
          }
          if (msg.type === 'LIVE_INTERRUPTED') {
            handleBargeIn('server_live_interrupted');
          }
          if (msg.type === 'LIVE_ERROR') {
            console.warn('[VoiceSession] Live streaming notice:', msg.error);
            setMicPermissionError(`Live Voice Bridge: ${msg.error}. Intelligent Speech & Cognitive Core active.`);
            setupSpeechRecognition();
          }
        } catch (e) {
          console.error('[VoiceSession] Message parse error:', e);
        }
        publishDiagnostics();
      };

      ws.onerror = (err) => {
        console.error('[VoiceSession] WebSocket error:', err);
        statsRef.current.lastError = 'WebSocket connection failure';
        publishDiagnostics();
      };

      ws.onclose = () => {
        setIsLive(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        if (diagIntervalRef.current) {
          clearInterval(diagIntervalRef.current);
          diagIntervalRef.current = null;
        }
        publishDiagnostics();
      };
    } catch (error: any) {
      console.error('[VoiceSession] Live Setup Error:', error);
      statsRef.current.lastError = error?.message || 'Failed to start Live API session';
      publishDiagnostics();
    }
  };

  const stopLiveSession = async (isManual = false) => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (diagIntervalRef.current) {
      clearInterval(diagIntervalRef.current);
      diagIntervalRef.current = null;
    }

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'LIVE_STOP' }));
        wsRef.current.close();
      }
    } catch {}
    wsRef.current = null;
    
    try { if (recognitionRef.current) recognitionRef.current.abort(); } catch {}
    recognitionRef.current = null;

    speechEngine.stop();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopAlyaVoice();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }

    try { sourceRef.current?.disconnect(); } catch {}
    try { processorRef.current?.disconnect(); } catch {}
    try { micAnalyserRef.current?.disconnect(); } catch {}
    try { speakerAnalyserRef.current?.disconnect(); } catch {}

    if (audioCtxRef.current) {
      if (audioCtxRef.current.state !== 'closed') {
        await audioCtxRef.current.close().catch(() => {});
      }
      audioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      if (outputAudioCtxRef.current.state !== 'closed') {
        await outputAudioCtxRef.current.close().catch(() => {});
      }
      outputAudioCtxRef.current = null;
    }
    
    if (transcript.length > 1) {
      const userId = user?.uid || 'default_user';
      voiceHistoryService.saveVoiceSession(userId, transcript).catch(err => {
        console.warn('[VoiceSession] Failed to persist call session to Firestore:', err);
      });
    }

    sourceRef.current = null;
    processorRef.current = null;
    micAnalyserRef.current = null;
    speakerAnalyserRef.current = null;
    
    setIsLive(false);
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    publishDiagnostics();
    
    if (isManual) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      const initialGreeting = "Hello! I'm Alisa Mikhailovna Kujou, but you can just call me Alya. I'm right here with you—what's on your mind?";
      setTranscript([
        { id: '1', speaker: 'assistant', text: initialGreeting, timestamp: new Date() }
      ]);
      startLiveSession();
      setTimeout(() => speakTextWithHumanVoice(initialGreeting), 800);
    } else {
      stopLiveSession(false);
    }
    return () => {
      stopLiveSession(false);
    };
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Sizable Visualizer rendering
  useEffect(() => {
    if (!isOpen) return;

    const updateVisualizer = () => {
      let dataArray = new Uint8Array(16);
      let isUserSpeaking = false;
      let isAlyaSpeaking = false;

      if (micAnalyserRef.current && !isMuted) {
        const micData = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
        micAnalyserRef.current.getByteFrequencyData(micData);
        const micAvg = micData.reduce((a, b) => a + b, 0) / micData.length;
        if (micAvg > 12) {
          isUserSpeaking = true;
          dataArray = micData.slice(0, 16);
        }
      }

      if ((speakerAnalyserRef.current && isPlayingRef.current && speakerOn) || window.speechSynthesis.speaking) {
        isAlyaSpeaking = true;
        dataArray = new Uint8Array([80, 120, 160, 200, 230, 250, 220, 180, 140, 110, 80, 60, 90, 130, 170, 120]);
      }

      if (isAlyaSpeaking) {
        setActiveSpeaker('assistant');
      } else if (isUserSpeaking) {
        setActiveSpeaker('user');
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          stopAlyaVoice();
        }
      } else {
        setActiveSpeaker('none');
      }

      const levels = Array.from(dataArray).map(val => Math.max(12, Math.min(100, (val / 255) * 100)));
      setAudioLevels(levels.length === 16 ? levels : new Array(16).fill(12));

      animFrameRef.current = requestAnimationFrame(updateVisualizer);
    };

    animFrameRef.current = requestAnimationFrame(updateVisualizer);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, isMuted, speakerOn]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden font-sans"
        >
          {/* Ambient Glow */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none transition-all duration-700 ${
            activeSpeaker === 'assistant' 
              ? 'bg-indigo-600/30 scale-125' 
              : activeSpeaker === 'user' 
                ? 'bg-emerald-600/30 scale-125' 
                : 'bg-indigo-600/10 scale-100'
          }`}></div>

          {/* Top Header */}
          <header className="relative z-10 p-5 md:p-6 flex items-center justify-between border-b border-white/5 bg-slate-900/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Alisa Mikhailovna Kujou</span>
                  <span className="text-xs text-indigo-400 font-semibold">(Alya)</span>
                </h1>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[11px] text-slate-400 font-medium">WebRTC Low-Latency Live Conversation</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white/5 rounded-full border border-white/10">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-xs font-bold tracking-wider uppercase text-emerald-300">Live Voice Connected</span>
            </div>
          </header>

          {/* Main Voice Center Area */}
          <div className="flex-1 relative z-10 flex flex-col lg:flex-row items-center justify-center p-4 md:p-10 gap-4 lg:gap-10 overflow-y-auto lg:overflow-hidden max-w-7xl mx-auto w-full h-[calc(100vh-160px)] lg:h-[calc(100vh-140px)]">
            
            {/* Center Animation Orb & Visualizer */}
            <div className="flex flex-col items-center justify-center flex-1 py-2 lg:py-4 shrink-0">
              <div className="relative flex items-center justify-center">
                {/* Visualizer Ping Rings */}
                <div className={`absolute w-36 h-36 sm:w-44 sm:h-44 md:w-80 md:h-80 rounded-full border border-indigo-500/20 transition-all duration-1000 ${isLive ? 'animate-ping' : ''}`}></div>
                <div className={`absolute w-24 h-24 sm:w-32 sm:h-32 md:w-60 md:h-60 rounded-full bg-indigo-500/5 blur-xl transition-all duration-1000 ${isLive ? 'animate-pulse' : ''}`}></div>
                
                {/* Core ChatGPT-Style Breathing Morphing Orb */}
                <motion.div 
                  animate={{ 
                    scale: activeSpeaker === 'assistant' ? [1, 1.12, 0.96, 1.08, 1] : activeSpeaker === 'user' ? [1, 1.08, 1.02, 1.1, 1] : [1, 1.04, 1],
                    borderRadius: activeSpeaker === 'assistant' 
                      ? ["42% 58% 70% 30% / 45% 45% 55% 55%", "70% 30% 52% 48% / 60% 40% 60% 40%", "42% 58% 70% 30% / 45% 45% 55% 55%"]
                      : activeSpeaker === 'user'
                        ? ["50% 50% 30% 70% / 50% 60% 40% 50%", "30% 70% 70% 30% / 50% 30% 70% 50%", "50% 50% 30% 70% / 50% 60% 40% 50%"]
                        : ["50%", "48% 52% 52% 48% / 48% 48% 52% 52%", "50%"]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: activeSpeaker === 'assistant' ? 2.2 : activeSpeaker === 'user' ? 1.8 : 4.5, 
                    ease: "easeInOut" 
                  }}
                  className={`w-20 h-20 sm:w-28 sm:h-28 md:w-44 md:h-44 shadow-[0_0_80px_rgba(99,102,241,0.4)] flex items-center justify-center relative z-10 border border-white/20 transition-colors duration-700 ${
                    activeSpeaker === 'user' 
                      ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400' 
                      : activeSpeaker === 'assistant'
                        ? 'bg-gradient-to-tr from-indigo-600 via-violet-500 to-pink-500'
                        : 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-violet-500'
                  }`}
                >
                  <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-36 md:h-36 rounded-full bg-slate-950/40 backdrop-blur-md flex items-center justify-center">
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white animate-pulse" />
                  </div>
                </motion.div>
              </div>

              {/* Spectrum Bars */}
              <div className="mt-6 flex items-center justify-center gap-1 h-12 w-48 md:w-64">
                {audioLevels.map((level, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: `${level}%` }}
                    transition={{ type: 'spring', stiffness: 350, damping: 15 }}
                    className={`w-1.5 rounded-full transition-colors duration-300 ${
                      activeSpeaker === 'assistant'
                        ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]'
                        : activeSpeaker === 'user'
                          ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                          : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>

              {/* Status Indicator */}
              <div className="mt-3 text-center">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] md:text-xs font-bold tracking-wide">
                  <Activity className={`w-3 h-3 ${
                    activeSpeaker === 'assistant' ? 'text-indigo-400 animate-pulse' : activeSpeaker === 'user' ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
                  }`} />
                  <span className={activeSpeaker === 'assistant' ? 'text-indigo-300' : activeSpeaker === 'user' ? 'text-emerald-300' : 'text-slate-400'}>
                    {activeSpeaker === 'assistant' ? 'Alya is Speaking...' : activeSpeaker === 'user' ? 'Listening to You...' : isLive ? 'Connected & Listening' : 'Establishing Secure Line...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Conversation Transcript Box */}
            <div className="w-full lg:w-[460px] h-[180px] sm:h-[240px] lg:h-[380px] bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-3xl lg:rounded-[2.5rem] p-4 lg:p-6 flex flex-col shadow-2xl overflow-hidden shrink-0">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/5 mb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dialogue Thread</span>
                <span className="text-[9px] text-indigo-400 font-mono font-bold tracking-wider">Alya & You</span>
              </div>

              {micPermissionError && (
                <div className={`mb-2.5 p-4 rounded-2xl text-xs flex flex-col gap-3 transition-all ${
                  micDenied 
                    ? 'bg-red-500/10 border border-red-500/20 text-red-200' 
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {micDenied ? <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                    <div className="flex flex-col gap-1">
                      <span className="font-bold">{micDenied ? 'Microphone Access Blocked' : 'Microphone Notice'}</span>
                      <span className="text-[11px] leading-relaxed opacity-90">{micPermissionError}</span>
                      {micDenied && (
                        <div className="mt-2 text-[10px] bg-red-500/20 p-2 rounded-lg border border-red-500/30">
                          <p className="font-semibold mb-1 uppercase tracking-wider">How to Fix:</p>
                          <ol className="list-decimal list-inside space-y-1 opacity-90">
                            <li>Click the <Lock className="w-2.5 h-2.5 inline mx-0.5" /> icon in your browser address bar.</li>
                            <li>Toggle <b>Microphone</b> to "On" or "Allow".</li>
                            <li>Refresh the page and try again.</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      if (micDenied) {
                        window.location.reload();
                      } else {
                        setMicDenied(false);
                        setupAudioCapture();
                      }
                    }}
                    className={`w-full py-2 font-bold rounded-xl shrink-0 transition-all text-center ${
                      micDenied 
                        ? 'bg-red-500/20 hover:bg-red-500/40 text-red-100 border border-red-500/30' 
                        : 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-100 border border-amber-500/30'
                    }`}
                  >
                    {micDenied ? 'Refresh to Apply Settings' : 'Try Again'}
                  </button>
                </div>
              )}

              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3.5 pr-1 scroll-smooth">
                {transcript.map((item) => (
                  <div 
                    key={item.id} 
                    className={`flex flex-col ${item.speaker === 'assistant' ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1 mb-0.5 text-[9px] font-bold text-slate-500">
                      {item.speaker === 'assistant' ? <Bot className="w-2.5 h-2.5 text-indigo-400" /> : <User className="w-2.5 h-2.5 text-emerald-400" />}
                      <span>{item.speaker === 'assistant' ? 'Alya' : 'You'}</span>
                    </div>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      item.speaker === 'assistant' 
                        ? 'bg-slate-800/80 text-slate-200 border border-white/5 rounded-tl-none mr-auto' 
                        : 'bg-indigo-600 text-white rounded-tr-none ml-auto shadow-md shadow-indigo-500/15'
                    }`}>
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* In-Call Text Input */}
              <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center gap-2">
                <input
                  type="text"
                  value={liveTextInput}
                  onChange={(e) => setLiveTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendLiveText()}
                  placeholder="Type message to Alya..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={handleSendLiveText}
                  disabled={!liveTextInput.trim()}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-xs"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>

          </div>

          {/* Bottom Call Controls */}
          <footer className="relative z-10 p-4 md:p-6 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-center gap-4 md:gap-6 shrink-0">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 md:p-5 rounded-2xl md:rounded-3xl transition-all flex flex-col items-center gap-1.5 ${
                isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4 md:w-5 md:h-5" /> : <Mic className="w-4 h-4 md:w-5 md:h-5" />}
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              onClick={() => stopLiveSession(true)}
              className="px-6 md:px-8 py-3 md:py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl md:rounded-3xl transition-all flex items-center gap-2.5 shadow-xl shadow-red-600/30 font-bold text-xs md:text-sm uppercase tracking-wider active:scale-95 cursor-pointer"
            >
              <PhoneOff className="w-4 h-4 md:w-5 md:h-5" />
              <span>End Call</span>
            </button>

            <button
              onClick={() => setSpeakerOn(!speakerOn)}
              className={`p-3 md:p-5 rounded-2xl md:rounded-3xl transition-all flex flex-col items-center gap-1.5 ${
                !speakerOn ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              {speakerOn ? <Volume2 className="w-4 h-4 md:w-5 md:h-5" /> : <VolumeX className="w-4 h-4 md:w-5 md:h-5" />}
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">{speakerOn ? 'Speaker' : 'Muted'}</span>
            </button>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
