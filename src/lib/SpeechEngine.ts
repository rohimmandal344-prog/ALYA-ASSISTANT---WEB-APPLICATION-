/**
 * Alya Assistant - Centralized High-Fidelity Speech Engine
 * Delegates directly to femaleVoiceSynthesizer for unified, state-managed multilingual
 * speech output with built-in client-side fallback (Web Speech API) for all world languages.
 * Completely eliminates duplicate WebSocket connections and overlapping playback streams.
 */

import { playAlyaVoice, stopAlyaVoice, VoiceOptions } from './femaleVoiceSynthesizer';

export interface SpeechRequest {
  id: string;
  text: string;
  options?: VoiceOptions;
  priority: 'normal' | 'high' | 'immediate';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

class SpeechEngine {
  private static instance: SpeechEngine;
  private isSpeaking: boolean = false;

  private constructor() {}

  public static getInstance(): SpeechEngine {
    if (!SpeechEngine.instance) {
      SpeechEngine.instance = new SpeechEngine();
    }
    return SpeechEngine.instance;
  }

  /**
   * Speak the requested text using the centralized warm female vocal profile of Alya
   */
  public speak(
    text: string, 
    options?: VoiceOptions, 
    priority: 'normal' | 'high' | 'immediate' = 'normal'
  ): string {
    const playId = `speech_${Date.now()}`;
    this.isSpeaking = true;

    playAlyaVoice(text, {
      ...options,
      onStart: () => {
        this.isSpeaking = true;
        options?.onStart?.();
      },
      onEnd: () => {
        this.isSpeaking = false;
        options?.onEnd?.();
      },
      onError: (err) => {
        this.isSpeaking = false;
        options?.onError?.(err);
      }
    }).catch((err) => {
      this.isSpeaking = false;
      options?.onError?.(err);
    });

    return playId;
  }

  /**
   * Immediately cancel any active speech synthesis across all channels
   */
  public stop() {
    this.isSpeaking = false;
    stopAlyaVoice();
  }

  /**
   * Returns whether the speech engine is currently active
   */
  public isActive(): boolean {
    return this.isSpeaking || (typeof window !== 'undefined' && window.speechSynthesis?.speaking);
  }
}

export const speechEngine = SpeechEngine.getInstance();
export default speechEngine;
