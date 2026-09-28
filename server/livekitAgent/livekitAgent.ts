/**
 * Alya Assistant - Central LiveKit Agent Framework
 * Orchestrates WebRTC communication, STT, LLM Reasoning, Tool Execution,
 * and TTS audio streaming for real-time natural voice conversation with Alya.
 */

import { livekitConfig } from '../config/livekitConfig.ts';
import { STTProviderRegistry } from './sttProvider.ts';
import { LLMProviderRegistry } from './llmProvider.ts';
import { TTSProviderRegistry } from './ttsProvider.ts';
import { deviceWebSocketManager } from '../deviceWebSocketManager.ts';

export interface LiveKitSessionParams {
  roomId: string;
  participantIdentity: string;
  userId: string;
  deviceId?: string;
  language?: string;
}

export class LiveKitAgentSession {
  public id: string;
  public roomId: string;
  public userId: string;
  public deviceId?: string;
  public language: string;
  public active: boolean = true;
  public isSpeaking: boolean = false;
  private currentGenerationId: number = 0;
  private history: Array<{ role: string; content: string }> = [];

  constructor(params: LiveKitSessionParams) {
    this.id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.roomId = params.roomId;
    this.userId = params.userId;
    this.deviceId = params.deviceId;
    this.language = params.language || 'auto';
  }

  /**
   * Process incoming user speech or text prompt through STT -> LLM/Tool Registry -> TTS pipeline
   */
  async processUserInput(promptText: string, onAudioChunk?: (base64WavAudio: string) => void): Promise<{
    text: string;
    agentName: string;
    actionExecuted?: string;
    suggestedAction?: { command: string; params?: any; targetDevice?: string };
    interrupted?: boolean;
  }> {
    const text = promptText.trim();
    if (!text) {
      return { text: "I'm listening!", agentName: 'Alya Core' };
    }

    const generationId = ++this.currentGenerationId;

    // 1. Add user turn to conversation context
    this.history.push({ role: 'user', content: text });
    if (this.history.length > 20) this.history = this.history.slice(-20);

    // 2. Process query via Open-Source LLM Provider & Alya Brain Engine
    const llmProvider = LLMProviderRegistry.getProvider();
    const brainResult = await llmProvider.processQuery({
      prompt: text,
      source: 'livekit_agent',
      language: this.language,
      history: this.history,
      deviceId: this.deviceId
    });

    // Check if interrupted during LLM inference
    if (this.currentGenerationId !== generationId) {
      return { text: '', agentName: 'Alya Core', interrupted: true };
    }

    const replyText = brainResult.reply || "I'm right here with you!";
    
    // 3. Add assistant response to history
    this.history.push({ role: 'assistant', content: replyText });

    // 4. Dispatch device control actions if suggested by Capability Registry
    let actionResultMsg: string | undefined = undefined;
    if (brainResult.suggestedAction && brainResult.suggestedAction.targetDevice) {
      try {
        const execResult = await deviceWebSocketManager.sendCommand({
          deviceId: brainResult.suggestedAction.targetDevice,
          command: brainResult.suggestedAction.command,
          params: brainResult.suggestedAction.params,
          origin: 'livekit_agent'
        });
        actionResultMsg = `Executed ${brainResult.suggestedAction.command}: ${execResult.status}`;
      } catch (devErr: any) {
        console.warn('[LiveKitAgent] Device execution warning:', devErr?.message);
      }
    }

    // Check if interrupted before TTS
    if (this.currentGenerationId !== generationId) {
      return { text: '', agentName: 'Alya Core', interrupted: true };
    }

    // 5. Synthesize speech via Open-Source TTS Provider (Kokoro/Coqui/Piper)
    if (onAudioChunk) {
      try {
        const ttsProvider = TTSProviderRegistry.getProvider();
        const wavBuffer = await ttsProvider.synthesize({
          text: replyText,
          language: brainResult.detectedLanguage || this.language,
          speed: livekitConfig.tts.speed
        });

        if (wavBuffer.length > 0 && this.currentGenerationId === generationId) {
          const base64Audio = wavBuffer.toString('base64');
          this.isSpeaking = true;
          onAudioChunk(base64Audio);
          this.isSpeaking = false;
        }
      } catch (ttsErr) {
        console.warn('[LiveKitAgent] TTS synthesis fallback:', ttsErr);
      }
    }

    return {
      text: replyText,
      agentName: brainResult.activeAgent?.name || 'Alya Live Voice',
      actionExecuted: actionResultMsg,
      suggestedAction: brainResult.suggestedAction
    };
  }

  /**
   * Immediately cancel speaking on user barge-in / interruption
   */
  interrupt() {
    this.currentGenerationId++;
    this.isSpeaking = false;
  }

  close() {
    this.active = false;
    this.isSpeaking = false;
    this.currentGenerationId++;
  }
}

export class LiveKitAgentManager {
  private static sessions: Map<string, LiveKitAgentSession> = new Map();

  static createSession(params: LiveKitSessionParams): LiveKitAgentSession {
    const session = new LiveKitAgentSession(params);
    this.sessions.set(session.roomId, session);
    return session;
  }

  static getSession(roomId: string): LiveKitAgentSession | undefined {
    return this.sessions.get(roomId);
  }

  static removeSession(roomId: string) {
    const session = this.sessions.get(roomId);
    if (session) {
      session.close();
      this.sessions.delete(roomId);
    }
  }
}
