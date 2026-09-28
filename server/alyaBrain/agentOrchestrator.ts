/**
 * Alya Assistant - Specialized AI Agents & Orchestration System
 * Coordinates domain-specialized agents under strict boundary and permission controls.
 */

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  description: string;
  allowedCapabilities: string[];
  maxAutonomyLevel: 'direct_approval' | 'authorized_auto' | 'read_only';
}

export const AGENT_REGISTRY: Record<string, AgentInfo> = {
  brain_planning: {
    id: 'brain_planning',
    name: 'Brain & Planning Agent',
    role: 'Cognitive Task Decomposition & Multi-Step Execution',
    description: 'Classifies complex tasks, generates structured execution subtasks, tracks stage progress, and coordinates outcomes.',
    allowedCapabilities: ['task_decomposition', 'plan_tracking', 'outcome_evaluation'],
    maxAutonomyLevel: 'authorized_auto'
  },
  conversation: {
    id: 'conversation',
    name: 'Conversation Agent',
    role: 'Natural Dialogue, Multilingual Fluidity & Empathy',
    description: 'Handles natural multi-turn conversations in Hindi, Hinglish, Bengali, and English, matching tone and style.',
    allowedCapabilities: ['natural_dialogue', 'language_mirroring', 'sentiment_adaptation'],
    maxAutonomyLevel: 'authorized_auto'
  },
  research: {
    id: 'research',
    name: 'Research & Verification Agent',
    role: 'Real-Time Information Synthesis & Source Citations',
    description: 'Retrieves verified facts, news, and current events with Google Search grounding and source provenance.',
    allowedCapabilities: ['web_search_query', 'fact_verification', 'source_citation'],
    maxAutonomyLevel: 'authorized_auto'
  },
  memory: {
    id: 'memory',
    name: 'Memory & Personalization Agent',
    role: 'User-Consented Long-Term Memory Lifecycle',
    description: 'Stores, retrieves, indexes, and purges user-approved facts and preferences under strict privacy boundaries.',
    allowedCapabilities: ['memory_store', 'memory_retrieve', 'memory_delete', 'update_user_preference'],
    maxAutonomyLevel: 'authorized_auto'
  },
  live_voice: {
    id: 'live_voice',
    name: 'Live Voice & Full-Duplex Agent',
    role: 'Low-Latency Streaming, Barge-In & Audio Focus',
    description: 'Manages continuous microphone listening, PCM streaming, voice activity detection, and instant barge-in interruption.',
    allowedCapabilities: ['audio_stream', 'vad_detection', 'barge_in_control'],
    maxAutonomyLevel: 'authorized_auto'
  },
  location_weather: {
    id: 'location_weather',
    name: 'Location & Weather Agent',
    role: 'Smart Privacy Geolocation & Meteorological Data',
    description: 'Processes live GPS coordinates and manual cities with Open-Meteo forecasts, alerts, sunrise/sunset, and local context.',
    allowedCapabilities: ['get_current_location', 'weather_forecast', 'reverse_geocode'],
    maxAutonomyLevel: 'authorized_auto'
  },
  device: {
    id: 'device',
    name: 'Device Control Agent',
    role: 'Hardware & System Automation',
    description: 'Executes verified hardware actions (Flashlight, Volume, Apps, Battery, Media) via Web and Android companion.',
    allowedCapabilities: ['device_flashlight', 'device_volume', 'device_battery', 'device_app_launch', 'device_app_close', 'device_setting_control', 'device_media_control'],
    maxAutonomyLevel: 'authorized_auto'
  },
  automation: {
    id: 'automation',
    name: 'Automation & Routines Agent',
    role: 'Schedules, Timers & Recurring Routines',
    description: 'Creates, executes, and coordinates reminders, timers, alarms, and multi-step triggers within safety boundaries.',
    allowedCapabilities: ['create_reminder', 'set_timer', 'schedule_routine', 'cancel_automation'],
    maxAutonomyLevel: 'authorized_auto'
  },
  quality_testing: {
    id: 'quality_testing',
    name: 'Quality & Testing Agent',
    role: 'Diagnostic Benchmarks & Subsystem Validation',
    description: 'Runs automated diagnostic suites (A-L), monitors RTT latencies, and verifies capability integrity.',
    allowedCapabilities: ['system_diagnostics', 'ping_devices', 'capability_audit', 'run_test_suite'],
    maxAutonomyLevel: 'read_only'
  },
  security: {
    id: 'security',
    name: 'Security & Guardrail Agent',
    role: 'Permission Verification & Injection Defense',
    description: 'Enforces permission requirements, inspects tool execution arguments, and prevents cross-user memory leakage.',
    allowedCapabilities: ['permission_check', 'audit_log', 'rate_limit', 'guardrail_enforce'],
    maxAutonomyLevel: 'authorized_auto'
  }
};

export class AgentOrchestrator {
  /**
   * Determine the primary agent to handle the user's intent.
   */
  static selectAgent(intent: string, toolsRequired: string[]): AgentInfo {
    if (intent === 'device_control' || toolsRequired.some(t => t.startsWith('device_'))) {
      return AGENT_REGISTRY.device;
    }
    if (intent === 'weather_query' || toolsRequired.includes('get_current_location')) {
      return AGENT_REGISTRY.location_weather;
    }
    if (intent === 'automation' || toolsRequired.some(t => t.includes('reminder') || t.includes('timer'))) {
      return AGENT_REGISTRY.automation;
    }
    if (intent === 'memory_query' || intent === 'memory_store' || intent === 'settings_update') {
      return AGENT_REGISTRY.memory;
    }
    if (intent === 'diagnostics' || toolsRequired.includes('system_diagnostics')) {
      return AGENT_REGISTRY.quality_testing;
    }
    if (intent === 'live_voice') {
      return AGENT_REGISTRY.live_voice;
    }
    if (intent === 'multi_step_planning' || intent === 'complex_reasoning') {
      return AGENT_REGISTRY.brain_planning;
    }
    if (intent === 'casual_chat' || intent === 'greeting') {
      return AGENT_REGISTRY.conversation;
    }
    return AGENT_REGISTRY.research;
  }
}
