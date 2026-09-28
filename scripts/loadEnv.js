/**
 * Reliable Environment Variable Loader and Validator for Alya Assistant
 * Safely loads .env and environment configs with fallbacks.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function loadEnvironment() {
  const envFiles = ['.env.local', '.env'];
  
  for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: false });
    }
  }

  // Ensure default environment values if not set
  process.env.PORT = process.env.PORT || '3000';
  process.env.LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://livekit.alyaassistant.internal';
  process.env.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey_alya_livekit_2026';
  process.env.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret_alya_livekit_key_2026';
  process.env.LIVEKIT_ROOM = process.env.LIVEKIT_ROOM || 'alya-voice-room';
  process.env.LIVEKIT_AGENT_NAME = process.env.LIVEKIT_AGENT_NAME || 'Alya Live Voice';
  process.env.STT_PROVIDER = process.env.STT_PROVIDER || 'whisper';
  process.env.STT_MODEL = process.env.STT_MODEL || 'whisper-large-v3';
  process.env.LLM_PROVIDER = process.env.LLM_PROVIDER || 'alya-brain-local';
  process.env.LLM_MODEL = process.env.LLM_MODEL || 'alya-18yo-v1';
  process.env.TTS_PROVIDER = process.env.TTS_PROVIDER || 'elevenlabs';
  process.env.TTS_MODEL = process.env.TTS_MODEL || 'eleven_multilingual_v2';
  process.env.TTS_VOICE = process.env.TTS_VOICE || '06llJPvI62CjqSWOX9Gp';

  return {
    PORT: process.env.PORT,
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    STT_PROVIDER: process.env.STT_PROVIDER,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    TTS_PROVIDER: process.env.TTS_PROVIDER,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const loaded = loadEnvironment();
  console.log('[loadEnv] Environment variables loaded successfully:', loaded);
}
