/**
 * Alya Assistant - Centralized LiveKit & Open-Source Model Configuration
 * Configures LiveKit WebRTC server credentials, room parameters, and provider
 * abstractions for STT (Whisper), LLM (Alya Brain/Ollama), and TTS (ElevenLabs/Kokoro/Coqui/Piper).
 */

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  defaultRoom: string;
  agentName: string;
  stt: {
    provider: string;
    model: string;
    sampleRate: number;
    language: string;
  };
  llm: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  tts: {
    provider: string;
    model: string;
    voice: string;
    sampleRate: number;
    speed: number;
    elevenlabsApiKey: string;
  };
}

export const livekitConfig: LiveKitConfig = {
  url: process.env.LIVEKIT_URL || 'wss://livekit.alyaassistant.internal',
  apiKey: process.env.LIVEKIT_API_KEY || 'devkey_alya_livekit_2026',
  apiSecret: process.env.LIVEKIT_API_SECRET || 'secret_alya_livekit_key_2026',
  defaultRoom: process.env.LIVEKIT_ROOM || 'alya-voice-room',
  agentName: process.env.LIVEKIT_AGENT_NAME || 'Alya Live Voice',
  stt: {
    provider: process.env.STT_PROVIDER || 'whisper',
    model: process.env.STT_MODEL || 'whisper-large-v3',
    sampleRate: 16000,
    language: 'auto',
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'alya-brain-local',
    model: process.env.LLM_MODEL || 'alya-18yo-v1',
    temperature: 0.65,
    maxTokens: 256,
  },
  tts: {
    provider: process.env.TTS_PROVIDER || 'elevenlabs',
    model: process.env.TTS_MODEL || 'eleven_multilingual_v2',
    voice: process.env.TTS_VOICE || '06llJPvI62CjqSWOX9Gp',
    sampleRate: 24000,
    speed: 1.0,
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  },
};
