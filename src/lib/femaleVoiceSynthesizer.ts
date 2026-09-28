/**
 * Realistic Multilingual Female Voice Synthesizer for Alya Assistant
 * Configures natural prosody, warm female vocal resonance, adaptive mood modulation,
 * and high-priority native neural voice matching across all supported languages.
 */

import { LanguageDetector, LanguageInfo } from './LanguageDetector';

export type AlyaMood = 'happy' | 'excited' | 'curious' | 'calm' | 'playful' | 'thoughtful' | 'focused' | 'auto';

export interface VoiceOptions {
  mood?: AlyaMood;
  language?: string;
  pitch?: number;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err?: any) => void;
}

// Mood-based pitch and speech rate modulation table
const MOOD_PROSODY: Record<string, { pitch: number; rate: number }> = {
  happy: { pitch: 1.05, rate: 1.02 },
  excited: { pitch: 1.08, rate: 1.06 },
  curious: { pitch: 1.02, rate: 1.00 },
  calm: { pitch: 0.96, rate: 0.92 },
  playful: { pitch: 1.06, rate: 1.03 },
  thoughtful: { pitch: 0.94, rate: 0.92 },
  focused: { pitch: 1.00, rate: 1.02 },
  auto: { pitch: 0.98, rate: 0.96 }, // Warm, natural default
};

/**
 * Finds the most natural female voice for any given language code
 */
function getBestFemaleVoiceForLang(langCode: string): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const shortCode = langCode.split('-')[0].toLowerCase();

  // 1. Language-matching female neural/natural voices
  const preferredFemaleNames = [
    'natural', 'neural', 'female', 'woman', 'siri',
    'jenny', 'aria', 'sonia', 'samantha', 'victoria', 'karen', 'moira', 'fiona', 'tessa', 'zira',
    'swara', 'madhur', 'ananya', 'priya', 'manisha', 'hi-in', 'bn-bd', 'bn-in',
    'kyoko', 'yuna', 'heami', 'xiaoxiao', 'sabina', 'denise', 'elena', 'paola', 'lucia', 'fatima'
  ];

  // Search matching language first
  const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(shortCode));

  if (langVoices.length > 0) {
    for (const name of preferredFemaleNames) {
      const match = langVoices.find(v => v.name.toLowerCase().includes(name));
      if (match) return match;
    }
    return langVoices[0];
  }

  // Fallback to preferred English female voices
  for (const name of preferredFemaleNames) {
    const found = voices.find(v => v.name.toLowerCase().includes(name));
    if (found) return found;
  }

  return voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
}

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export async function playAlyaVoice(
  rawText: string,
  options?: VoiceOptions | { onStart?: () => void; onEnd?: () => void; onError?: () => void }
) {
  // Cancel any active audio stream or speech utterance
  stopAlyaVoice();

  // Clean text for natural human reading & intonation
  const cleanSpokenText = rawText
    .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
    .replace(/https?:\/\/[^\s]+/g, 'link')
    .replace(/[*#`_~>]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '. ')
    .trim();

  if (!cleanSpokenText) return;

  const opts: VoiceOptions = (typeof options === 'object' && options !== null) ? options : {};
  const activeMood = (opts.mood || localStorage.getItem('alya_current_mood') || 'auto') as AlyaMood;
  const moodProsody = MOOD_PROSODY[activeMood] || MOOD_PROSODY.auto;

  const targetLang = opts.language || localStorage.getItem('alya_preferred_lang') || 'auto';
  const detectedLangInfo = targetLang === 'auto' 
    ? LanguageDetector.detectLanguage(cleanSpokenText)
    : LanguageDetector.getLanguageInfo(targetLang);

  const basePitch = opts.pitch ?? Number(localStorage.getItem('alya_voice_pitch') || moodProsody.pitch);
  const baseRate = opts.rate ?? Number(localStorage.getItem('alya_voice_rate') || moodProsody.rate);

  try {
    const voiceName = localStorage.getItem('alya_preferred_voice') || 'Aoede';
    
    if (opts.onStart) opts.onStart();

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: cleanSpokenText, 
        voiceName,
        language: detectedLangInfo.code,
        mood: activeMood,
        pitch: basePitch,
        rate: baseRate
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('QUOTA_EXHAUSTED');
      }
      throw new Error('TTS request failed');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      if (currentAudio === audio) currentAudio = null;
      if (opts.onEnd) opts.onEnd();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      if (currentAudio === audio) currentAudio = null;
      if (opts.onError) opts.onError();
    };

    await audio.play();
  } catch (error: any) {
    if (error?.message === 'QUOTA_EXHAUSTED') {
      try {
        (window as any).ttsQuotaExceeded = true;
      } catch {}
    }

    // High-fidelity Multilingual Local Browser Speech Synthesis Fallback
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
      currentUtterance = utterance;

      const femaleVoice = getBestFemaleVoiceForLang(detectedLangInfo.code);
      if (femaleVoice) {
        utterance.voice = femaleVoice;
        utterance.lang = femaleVoice.lang;
      } else {
        utterance.lang = detectedLangInfo.code;
      }

      utterance.pitch = Math.max(0.5, Math.min(2.0, basePitch));
      utterance.rate = Math.max(0.5, Math.min(2.0, baseRate));

      utterance.onstart = () => {
        if (opts.onStart) opts.onStart();
      };
      utterance.onend = () => {
        if (currentUtterance === utterance) currentUtterance = null;
        if (opts.onEnd) opts.onEnd();
      };
      utterance.onerror = (e) => {
        if (currentUtterance === utterance) currentUtterance = null;
        if (opts.onError) opts.onError(e);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      if (opts.onError) opts.onError(error);
    }
  }
}

export function stopAlyaVoice() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = '';
    } catch {}
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  currentUtterance = null;
}
