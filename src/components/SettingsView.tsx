import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Volume2, Languages, Bell, Moon, Shield, Info, LogOut, 
  Mic, Zap, Cpu, Check, Radio, Play, Smartphone, WifiOff, Sparkles, Search,
  MapPin, CloudSun, Compass, Droplets, Wind, Thermometer, RefreshCw, AlertCircle,
  Database, Sliders, History, Download, Upload, RotateCcw, Lock, CheckCircle2,
  SlidersHorizontal, Eye, ShieldAlert, ArrowRight, CornerDownLeft
} from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../lib/LanguageDetector';
import { locationService, LocationPermissionState } from '../lib/locationService';
import { weatherService, FullWeatherData } from '../services/weatherService';
import { 
  userSettingsService, 
  UserPreferences, 
  SettingChangeLogEntry,
  PersonalityType,
  ResponseCadence,
  DeviceControlMode
} from '../lib/userSettingsService';

export function SettingsView() {
  const { profile, logout, user } = useAuth();

  // Settings State initialized from authoritative userSettingsService
  const [preferences, setPreferences] = useState<UserPreferences>(() => userSettingsService.getPreferences());
  const [history, setHistory] = useState<SettingChangeLogEntry[]>(() => userSettingsService.getHistory());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  // Location & Weather Test State
  const [browserPermState, setBrowserPermState] = useState<LocationPermissionState>('prompt');
  const [isTestingLocation, setIsTestingLocation] = useState(false);
  const [weatherPreview, setWeatherPreview] = useState<FullWeatherData | null>(null);
  const [locationTestError, setLocationTestError] = useState<string | null>(null);

  // Modals & History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Subscribe to persistent settings updates (cloud sync & local changes)
  useEffect(() => {
    userSettingsService.initialize(user?.uid);
    const unsubscribe = userSettingsService.subscribe((updated) => {
      setPreferences(updated);
      setHistory(userSettingsService.getHistory());
    });

    locationService.checkPermissionState().then(setBrowserPermState);

    return () => unsubscribe();
  }, [user]);

  const triggerSaveFeedback = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2200);
  };

  const handleUpdate = async (updates: Partial<UserPreferences>) => {
    await userSettingsService.updatePreferences(updates, 'web_ui');
    triggerSaveFeedback();
  };

  const handleRevert = async (key: string) => {
    const success = await userSettingsService.revertSetting(key);
    if (success) {
      triggerSaveFeedback();
    }
  };

  const handleResetAll = async () => {
    await userSettingsService.resetAllSettings();
    setShowResetConfirmModal(false);
    triggerSaveFeedback();
  };

  const handleExport = () => {
    const jsonStr = userSettingsService.exportSettingsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alya-settings-rev${preferences.revision}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    const res = await userSettingsService.importSettingsJson(importJsonText);
    if (res.success) {
      setShowImportModal(false);
      setImportJsonText('');
      triggerSaveFeedback();
    } else {
      setImportError(res.error || 'Failed to import settings');
    }
  };

  const handleTestLocationAndWeather = async () => {
    setIsTestingLocation(true);
    setLocationTestError(null);
    setWeatherPreview(null);
    try {
      if (preferences.locationPreference === 'disabled') {
        setLocationTestError('Location is currently disabled in your preferences. Select Automatic GPS or Manual City to test.');
        return;
      }
      
      const cityToTest = preferences.locationPreference === 'manual' ? preferences.manualCity : undefined;
      const res = await weatherService.getWeatherForRequest(cityToTest);
      if (res.success && res.data) {
        setWeatherPreview(res.data);
      } else {
        setLocationTestError(res.error || 'Failed to retrieve location/weather.');
      }
      const updatedPerm = await locationService.checkPermissionState();
      setBrowserPermState(updatedPerm);
    } catch (err: any) {
      setLocationTestError(err.message || 'Error executing location test.');
    } finally {
      setIsTestingLocation(false);
    }
  };

  const testVoiceSynthesis = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("Hello! I am Alya, your personal assistant. My voice speed and personality settings are permanently locked in.");
      utterance.rate = preferences.speechSpeed;
      utterance.pitch = 1.0 + (preferences.speechPitch * 0.1);
      window.speechSynthesis.speak(utterance);
    }
  };

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(l => 
    l.name.toLowerCase().includes(langSearch.toLowerCase()) || 
    l.nativeName.toLowerCase().includes(langSearch.toLowerCase()) ||
    l.code.toLowerCase().includes(langSearch.toLowerCase())
  );

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-28">
        {/* Header & Status Banner */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-3 h-3" /> Permanent Preference Lock
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                Rev #{preferences.revision}
              </span>
              {savedSuccess && (
                <motion.span 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="text-xs text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30"
                >
                  <Check className="w-3.5 h-3.5" /> Saved & Locked
                </motion.span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1.5 flex items-center gap-2">
              Alya Configuration & Preferences
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              All settings are persistent across reboots, sessions, and synchronized across Web & Android.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
              title="View settings change history"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>Audit Log ({history.length})</span>
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
              title="Export Settings to JSON"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export</span>
            </button>
          </div>
        </header>

        {/* Account & Cross-Device Cloud Sync Status */}
        <section className="bg-slate-900/90 rounded-3xl border border-white/5 p-6 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-violet-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xl shadow-inner">
                {profile?.displayName?.[0] || 'A'}
              </div>
              <div>
                <h3 className="font-bold text-white text-base">{profile?.displayName || 'Alya User'}</h3>
                <p className="text-xs text-slate-400">{profile?.email || 'Authenticated Account'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider font-mono">
                    {preferences.cloudSyncEnabled ? 'Cloud Sync Active (Firestore)' : 'Local Storage Mode'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-2xl border border-white/5">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-white">Cross-Device Sync</div>
                <div className="text-[10px] text-slate-400">Sync with Android Companion</div>
              </div>
              <button
                type="button"
                onClick={() => handleUpdate({ cloudSyncEnabled: !preferences.cloudSyncEnabled })}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${
                  preferences.cloudSyncEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  preferences.cloudSyncEnabled ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </section>

        {/* 1. Identity, Personality Mood & Response Cadence */}
        <section className="bg-slate-900/80 rounded-3xl border border-white/5 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" /> Assistant Personality & Response Cadence
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Defines Alya's conversational tone, empathy level, and detail density.</p>
            </div>
            {history.some(h => h.key === 'assistantPersonality' || h.key === 'responseCadence') && (
              <button
                onClick={() => handleRevert('assistantPersonality')}
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                <CornerDownLeft className="w-3 h-3" /> Revert Personality
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: 'alya_default',
                name: 'Alya Default',
                desc: '18yo female human identity: Warm, expressive, smart & organic.'
              },
              {
                id: 'jarvis_formal',
                name: 'JARVIS Style',
                desc: 'Cinematic AI: Highly efficient, analytical, precise & direct.'
              },
              {
                id: 'warm_companion',
                name: 'Warm Companion',
                desc: 'Empathetic, attentive, friendly, and emotionally supportive.'
              },
              {
                id: 'concise_expert',
                name: 'Concise Expert',
                desc: '1-line answers, code-first, and zero conversational filler.'
              }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleUpdate({ assistantPersonality: p.id as PersonalityType })}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  preferences.assistantPersonality === p.id
                    ? 'bg-violet-600/15 border-violet-500 text-white shadow-xs'
                    : 'bg-slate-950/60 border-white/5 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{p.name}</span>
                  {preferences.assistantPersonality === p.id && <Check className="w-3.5 h-3.5 text-violet-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{p.desc}</p>
              </button>
            ))}
          </div>

          {/* Response Cadence Selector */}
          <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-200">Response Detail Cadence</span>
              <p className="text-[11px] text-slate-400">Controls verbosity of answers across chat and voice.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
              {[
                { id: 'concise', label: 'Concise' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'detailed', label: 'Detailed' }
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleUpdate({ responseCadence: c.id as ResponseCadence })}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    preferences.responseCadence === c.id
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-slate-950 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Neural Voice & Audio Engine */}
        <section className="bg-slate-900/80 rounded-3xl border border-white/5 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-indigo-400" /> Unified Neural Voice & Audio Engine
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Ultra-realistic female voice powered by Gemini Live API & 24kHz Audio Engine.</p>
            </div>
            <button
              onClick={testVoiceSynthesis}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Play className="w-3 h-3" /> Test Voice Sample
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'Aoede', label: 'Aoede (Alya Female Standard)', desc: 'Natural, expressive, clear tone with dynamic cadence.' },
              { id: 'Kore', label: 'Kore (Warm Human Female)', desc: 'Soft, gentle, conversational rhythm.' },
              { id: 'Fenrir', label: 'Fenrir (Deep Direct)', desc: 'Authoritative, resonant, and studio-grade clarity.' }
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleUpdate({ voiceName: v.id })}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  preferences.voiceName === v.id
                    ? 'bg-indigo-600/15 border-indigo-500 text-white'
                    : 'bg-slate-950/60 border-white/5 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{v.label}</span>
                  {preferences.voiceName === v.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{v.desc}</p>
              </button>
            ))}
          </div>

          {/* Speed & Pitch Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Speaking Rate / Speed</span>
                <span className="font-mono text-indigo-400 font-bold">{preferences.speechSpeed}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={preferences.speechSpeed}
                onChange={(e) => handleUpdate({ speechSpeed: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Voice Pitch Modulation</span>
                <span className="font-mono text-indigo-400 font-bold">
                  {preferences.speechPitch > 0 ? `+${preferences.speechPitch}` : preferences.speechPitch}
                </span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.5"
                value={preferences.speechPitch}
                onChange={(e) => handleUpdate({ speechPitch: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* 3. Multilingual Support & Selector */}
        <section className="bg-slate-900/80 rounded-3xl border border-white/5 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Languages className="w-4 h-4 text-emerald-400" /> Multilingual Understanding & Response
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Alya understands and mirrors 35+ languages, dialects, and mixed speech.</p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search languages..."
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-full sm:w-48"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1 pt-1">
            {filteredLanguages.map((l) => {
              const isSelected = preferences.language === l.code;
              return (
                <button
                  key={l.code}
                  onClick={() => handleUpdate({ language: l.code })}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected 
                      ? 'bg-emerald-500/15 border-emerald-500 text-white' 
                      : 'bg-slate-950/60 hover:bg-slate-950 border-white/5 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{l.flag}</span>
                    <div className="overflow-hidden">
                      <div className="font-bold text-xs text-white truncate">{l.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{l.nativeName}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Wake Word Triggers & Sensitivity */}
        <section className="bg-slate-900/80 rounded-3xl border border-white/5 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Mic className="w-4 h-4 text-amber-400" /> Wake Word Triggers (Offline Engine)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Activate Alya hands-free with real offline voice detection.</p>
            </div>
            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-lg uppercase">
              Low False Positive
            </span>
          </div>

          <div className="space-y-2">
            {[
              { id: 'alya', label: 'Hey Alya', state: preferences.wakeWords.alya },
              { id: 'alia', label: 'Hey Alia', state: preferences.wakeWords.alia },
              { id: 'seno', label: 'Hey Seno', state: preferences.wakeWords.seno }
            ].map((ww) => (
              <div key={ww.id} className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-2xl border border-white/5">
                <span className="text-xs font-bold text-white">"{ww.label}"</span>
                <button
                  type="button"
                  onClick={() => handleUpdate({
                    wakeWords: {
                      ...preferences.wakeWords,
                      [ww.id]: !ww.state
                    }
                  })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${
                    ww.state ? 'bg-amber-600' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    ww.state ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
              <span>Wake Sensitivity Threshold</span>
              <span className="font-mono text-amber-400 font-bold">{Math.round(preferences.wakeWords.sensitivity * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="1.0" 
              step="0.05"
              value={preferences.wakeWords.sensitivity}
              onChange={(e) => handleUpdate({
                wakeWords: {
                  ...preferences.wakeWords,
                  sensitivity: parseFloat(e.target.value)
                }
              })}
              className="w-full accent-amber-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
            />
          </div>
        </section>

        {/* 5. Location Permission & Local Intelligence */}
        <section className="bg-slate-900/80 rounded-3xl border border-white/5 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Location Preference & Weather Grounding</h2>
                <p className="text-xs text-slate-400">User-controlled geolocation for live weather, nearby places, and local time.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10">
              {browserPermState === 'granted' ? (
                <span className="text-emerald-400">GPS Granted</span>
              ) : browserPermState === 'denied' ? (
                <span className="text-rose-400">GPS Denied</span>
              ) : (
                <span className="text-amber-400">Permission Prompt</span>
              )}
            </div>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'auto',
                title: 'Automatic GPS',
                desc: 'Requests device/browser location on demand for precise local weather and places.'
              },
              {
                id: 'manual',
                title: 'Manual City Only',
                desc: 'Uses configured city without requesting device coordinates or GPS fixes.'
              },
              {
                id: 'disabled',
                title: 'Privacy Mode (Disabled)',
                desc: 'Completely disables location requests. Alya will ask for city per query.'
              }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleUpdate({ locationPreference: m.id as any })}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  preferences.locationPreference === m.id
                    ? 'bg-cyan-950/40 border-cyan-500/40 text-white shadow-xs'
                    : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{m.title}</span>
                  {preferences.locationPreference === m.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">{m.desc}</p>
              </button>
            ))}
          </div>

          {/* Manual City Configuration */}
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5 space-y-3">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              Default / Fallback City Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={preferences.manualCity}
                onChange={(e) => handleUpdate({ manualCity: e.target.value })}
                placeholder="e.g. Kolkata, Mumbai, Delhi, London, New York..."
                className="flex-1 px-3.5 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Test Live Weather & Location */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Verify real-time Open-Meteo weather & location fetching:</span>
              <button
                type="button"
                onClick={handleTestLocationAndWeather}
                disabled={isTestingLocation}
                className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 rounded-xl text-xs font-bold text-indigo-300 flex items-center gap-1.5 transition-all"
              >
                {isTestingLocation ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudSun className="w-3.5 h-3.5" />}
                {isTestingLocation ? 'Acquiring...' : 'Test Weather & GPS'}
              </button>
            </div>

            {locationTestError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{locationTestError}</span>
              </div>
            )}

            {weatherPreview && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/70 to-slate-950/90 border border-cyan-500/30 shadow-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-sm text-white">
                      <MapPin className="w-4 h-4 text-cyan-400" />
                      <span>{weatherPreview.current.locationName}</span>
                    </div>
                    <span className="text-xs text-slate-400">{weatherPreview.current.condition.description}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white font-mono">{weatherPreview.current.temperature}°C</div>
                    <div className="text-[10px] text-slate-400">Feels like {weatherPreview.current.feelsLike}°C</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Humidity: {weatherPreview.current.humidity}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>Wind: {weatherPreview.current.windSpeed} km/h</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Pressure: {weatherPreview.current.pressure} hPa</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* 6. Device Security & Offline Engine */}
        <section className="bg-slate-900/80 rounded-3xl border border-white/5 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Device Control & Offline Capabilities</h2>
                <p className="text-xs text-slate-400">Security policies for executing phone hardware actions and local fallback operations.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-950/60 rounded-2xl border border-white/5">
              <div>
                <div className="text-xs font-bold text-white">Offline Capabilities Engine</div>
                <p className="text-[11px] text-slate-400">Execute device controls & local queries without internet.</p>
              </div>
              <button
                type="button"
                onClick={() => handleUpdate({ offlineMode: !preferences.offlineMode })}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${
                  preferences.offlineMode ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  preferences.offlineMode ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5 space-y-2">
              <label className="text-xs font-bold text-slate-200">Device Action Confirmation Policy</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'confirm_sensitive', label: 'Confirm Sensitive (Recommended)' },
                  { id: 'always_confirm', label: 'Always Ask Confirmation' },
                  { id: 'auto_execute', label: 'Auto-Execute Authorized' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleUpdate({ deviceControlConfirmation: m.id as DeviceControlMode })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                      preferences.deviceControlConfirmation === m.id
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 7. Backup, Import, Reset & Sign Out */}
        <section className="bg-slate-900/80 rounded-3xl border border-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-400" /> Preference Backup & Reset
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="p-3.5 bg-slate-950/60 hover:bg-slate-950 border border-white/5 rounded-2xl text-xs font-semibold text-slate-300 flex items-center justify-center gap-2 transition"
            >
              <Upload className="w-4 h-4 text-cyan-400" /> Import Settings from JSON
            </button>
            <button
              onClick={() => setShowResetConfirmModal(true)}
              className="p-3.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl text-xs font-semibold text-rose-300 flex items-center justify-center gap-2 transition"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" /> Reset All Settings to Default
            </button>
          </div>

          <div className="pt-2 border-t border-white/5">
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 p-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-bold transition-all text-xs uppercase tracking-wider"
            >
              <LogOut className="w-4 h-4" />
              Sign Out of Alya Core
            </button>
          </div>
        </section>
      </div>

      {/* History / Audit Log Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[80vh] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <History className="w-4 h-4 text-indigo-400" />
                  Settings Audit & Change History ({history.length})
                </div>
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {history.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">No setting modifications recorded yet.</div>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono">{h.key}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-indigo-300 rounded font-mono">
                            {h.source}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          <span className="text-rose-400 line-through mr-1">{JSON.stringify(h.oldValue)}</span>
                          <ArrowRight className="inline w-3 h-3 text-slate-500 mx-1" />
                          <span className="text-emerald-400 font-semibold">{JSON.stringify(h.newValue)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(h.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevert(h.key)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition shrink-0"
                      >
                        <CornerDownLeft className="w-3 h-3" /> Revert
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-rose-500/30 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset All Settings?</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  This will restore all preferences (language, wake words, personality, voice, and offline options) to their factory defaults. This action cannot be undone automatically.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowResetConfirmModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetAll}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-rose-900/30"
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-cyan-400" /> Import Settings JSON
                </h3>
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleImportSubmit} className="space-y-3">
                <textarea
                  rows={8}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="Paste exported JSON settings here..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                />

                {importError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    {importError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl transition"
                >
                  Validate & Apply Settings
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
