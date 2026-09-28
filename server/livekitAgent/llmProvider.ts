/**
 * Alya Assistant - Open-Source LLM Provider Abstraction
 * Provider-independent interface for Reasoning, Conversation Context,
 * and Capability/Tool Calling. Compatible with self-hosted open models (Ollama, vLLM)
 * and Alya Brain's 13-stage Cognitive Reasoning Engine.
 */

import { livekitConfig } from '../config/livekitConfig.ts';
import { AlyaBrainEngine, BrainExecutionResult } from '../alyaBrain/alyaBrainEngine.ts';

export interface LLMGenerateOptions {
  prompt: string;
  source?: 'livekit_agent' | 'web_chat' | 'android_companion';
  language?: string;
  history?: Array<{ role: string; content: string }>;
  deviceId?: string;
}

export interface ILLMProvider {
  name: string;
  processQuery(options: LLMGenerateOptions): Promise<BrainExecutionResult>;
}

export class AlyaLocalLLMProvider implements ILLMProvider {
  public name = 'Alya Brain Local Reasoning Engine';

  async processQuery(options: LLMGenerateOptions): Promise<BrainExecutionResult> {
    const preferredLang = options.language || livekitConfig.stt.language || 'auto';
    
    // Execute through Alya Brain 13-stage cognitive pipeline
    // (Perception -> Intent -> Capability Registry -> Tool Execution -> Verification)
    return await AlyaBrainEngine.process({
      text: options.prompt,
      source: 'live_voice',
      language: preferredLang,
      context: {
        recentMessages: options.history || [],
        connectedDeviceId: options.deviceId
      }
    });
  }
}

export class LLMProviderRegistry {
  private static providers: Map<string, ILLMProvider> = new Map();

  static register(id: string, provider: ILLMProvider) {
    this.providers.set(id, provider);
  }

  static getProvider(id?: string): ILLMProvider {
    const providerId = id || livekitConfig.llm.provider;
    return this.providers.get(providerId) || new AlyaLocalLLMProvider();
  }
}

// Register default providers
LLMProviderRegistry.register('alya-brain-local', new AlyaLocalLLMProvider());
LLMProviderRegistry.register('ollama', new AlyaLocalLLMProvider());
LLMProviderRegistry.register('vllm', new AlyaLocalLLMProvider());
