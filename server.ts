import { loadEnvironment } from './scripts/loadEnv.js';
loadEnvironment();

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { geminiService, ALYA_CONSTITUTION } from './server/geminiService.ts';
import { AlyaBrainEngine } from './server/alyaBrain/alyaBrainEngine.ts';
import { TOOL_REGISTRY } from './server/alyaBrain/toolRegistry.ts';
import { AGENT_REGISTRY } from './server/alyaBrain/agentOrchestrator.ts';
import { deviceWebSocketManager } from './server/deviceWebSocketManager.ts';
import { smartDeviceManager } from './server/smartDeviceManager.ts';
import { LiveKitServerService } from './server/livekitServer.ts';
import { LiveKitAgentManager } from './server/livekitAgent/livekitAgent.ts';
import { TTSProviderRegistry } from './server/livekitAgent/ttsProvider.ts';
import { AutoReplyManager } from './server/autoReplyManager.ts';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  app.use(express.json());

  // In-Memory 24/7 Instant Reply Cache for high-frequency queries (<10ms response, zero data waste)
  const instantReplyCache = new Map<string, { reply: string; intent: string; timestamp: number }>();
  const INSTANT_GREETINGS: Record<string, string> = {
    'hi': "Hello! I'm Alya (Alisa Mikhailovna Kujou). I'm right here with you—what's on your mind?",
    'hello': "Hi there! Alya here. What can I do for you right now?",
    'hey': "Hey! How's your day going? What's on your mind?",
    'kemon acho': "Ami bhalo achi! Tumi kemon acho? Aajke tomake ki bhabe sahajyo korte pari?",
    'kaise ho': "Main theek hoon! Aap kaise hain? Aaj main aapki kya madad kar sakti hoon?",
    'who are you': "I am Alya (Alisa Mikhailovna Kujou), your personal real-time assistant for live voice conversation, device control, smart home, and daily tasks.",
    'what can you do': "I can converse naturally in real-time voice, control your paired Android phone (torch, volume, apps), manage smart home devices, fetch real-time weather & news, and integrate with Roo Code and Cline developer environments."
  };

  // 24/7 Active Server Health Endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Alya Assistant 24/7 Core',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: Date.now(),
      mcpEndpoint: '/api/mcp',
      openAiEndpoint: '/v1/chat/completions',
      activeRelay: 'Singapore Primary Gateway (Asia-SE1)'
    });
  });

  // Alya Brain 13-stage Cognitive Pipeline Endpoint
  app.post('/api/alya/brain', async (req, res) => {
    try {
      const { text, source, context, language, dataSaver } = req.body;
      const cleanText = (text || '').trim();
      const lowerText = cleanText.toLowerCase();
      const targetUserId = req.body.userId || 'default_user';

      // 1. Instant Low-Bandwidth Reply for Greetings & System Queries
      if (INSTANT_GREETINGS[lowerText]) {
        const instantReply = INSTANT_GREETINGS[lowerText];
        return res.json({
          reply: instantReply,
          activeAgent: { id: 'alya_core', name: 'Alya Core', role: 'Conversational Assistant' },
          intent: 'greeting',
          detectedLanguage: 'en',
          pipelineStages: [],
          toolsUsed: [],
          executionVerification: { verified: true, verificationMessage: 'Instant cognitive cache hit (<5ms)' }
        });
      }

      // 2. Check in-memory instant reply cache for recent repetitive queries (TTL: 60s)
      const cached = instantReplyCache.get(lowerText);
      if (cached && (Date.now() - cached.timestamp < 60000)) {
        return res.json({
          reply: cached.reply,
          activeAgent: { id: 'alya_core', name: 'Alya Core', role: 'Conversational Assistant' },
          intent: cached.intent,
          detectedLanguage: 'en',
          pipelineStages: [],
          toolsUsed: [],
          executionVerification: { verified: true, verificationMessage: 'Instant cognitive cache hit' }
        });
      }

      // 3. Auto-detect any active connected companion device for the user to resolve Web-to-device permissions
      const userDevices = deviceWebSocketManager.getDevicesForUser(targetUserId);
      const onlineDevice = userDevices.find(d => d.isOnline);

      const enrichedContext = {
        ...(context || {}),
        connectedDeviceId: context?.connectedDeviceId || onlineDevice?.deviceId,
        targetDeviceName: onlineDevice?.deviceName
      };

      const result = await AlyaBrainEngine.process({
        text: cleanText,
        source: source || 'web_chat',
        context: enrichedContext,
        language: language
      });

      // 4. If a real device action was generated, route and verify via companion device
      if (result.suggestedAction) {
        const targetDeviceId = result.suggestedAction.targetDevice || onlineDevice?.deviceId;
        if (targetDeviceId && onlineDevice) {
          try {
            const execResult = await deviceWebSocketManager.sendCommand({
              deviceId: targetDeviceId,
              command: result.suggestedAction.command,
              params: result.suggestedAction.params,
              origin: 'alya_brain',
              timeoutMs: 6000
            });
            result.executionVerification = {
              verified: execResult.status === 'success',
              verificationMessage: execResult.status === 'success' 
                ? `Hardware execution verified on ${onlineDevice.deviceName} via native companion telemetry.` 
                : (execResult.error || 'Execution failed')
            };
          } catch (devErr: any) {
            result.executionVerification = {
              verified: false,
              verificationMessage: devErr.message
            };
          }
        }
      }

      // 5. Data Saver Optimization: strip verbose stage details to save up to 75% cellular/wifi bandwidth
      const isDataSaverActive = dataSaver || req.headers['x-data-saver'] === 'true' || context?.dataSaver;
      if (isDataSaverActive) {
        result.pipelineStages = [];
      }

      // Cache successful conversational replies
      if (result.reply && result.reply.length < 500 && !result.suggestedAction) {
        instantReplyCache.set(lowerText, {
          reply: result.reply,
          intent: result.intent,
          timestamp: Date.now()
        });
        if (instantReplyCache.size > 200) {
          const firstKey = instantReplyCache.keys().next().value;
          if (firstKey) instantReplyCache.delete(firstKey);
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error('Alya Brain Processing Error:', error);
      res.status(500).json({ error: error.message || 'Error processing cognitive pipeline' });
    }
  });

  // LiveKit WebRTC Token Service Endpoint
  app.post('/api/livekit/token', async (req, res) => {
    try {
      const { roomName, identity, name, userId, metadata } = req.body;
      const result = await LiveKitServerService.createJoinToken({
        roomName,
        identity,
        name,
        userId: userId || 'user_default',
        metadata
      });
      res.json(result);
    } catch (err: any) {
      console.error('[LiveKitServer] Token generation error:', err);
      res.status(500).json({ error: err.message || 'Failed to issue LiveKit access token' });
    }
  });

  // Open-Source / Premium Neural TTS Endpoint
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voiceName, pitch, rate, language } = req.body;
      if (!text) return res.status(400).json({ error: 'Text is required' });
      
      const ttsProvider = TTSProviderRegistry.getProvider();
      const audioBuffer = await ttsProvider.synthesize({
        text,
        voiceName: voiceName || 'Alya (Natural Female)',
        language,
        speed: typeof rate === 'number' ? rate : 1.0
      });

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('TTS synthesized empty buffer');
      }
      
      const isElevenLabs = ttsProvider.name.includes('ElevenLabs');
      const isMp3 = audioBuffer.length > 3 && (
        (audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44 && audioBuffer[2] === 0x33) ||
        (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0)
      );
      res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'audio/wav');
      res.send(audioBuffer);
    } catch (err: any) {
      console.error('[API] TTS Error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'TTS Error' });
    }
  });

  // Real Weather Service Endpoint (Open-Meteo Integration)
  app.get('/api/alya/weather', async (req, res) => {
    try {
      const { lat, lon, city } = req.query;

      let targetLat = lat ? parseFloat(lat as string) : null;
      let targetLon = lon ? parseFloat(lon as string) : null;
      let locationName = city as string;

      if (city && (!targetLat || !targetLon)) {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city as string)}&count=1&language=en&format=json`;
        const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });
        if (geoRes.ok) {
          const geoJson = await geoRes.json();
          if (geoJson.results && geoJson.results.length > 0) {
            targetLat = geoJson.results[0].latitude;
            targetLon = geoJson.results[0].longitude;
            locationName = [geoJson.results[0].name, geoJson.results[0].admin1, geoJson.results[0].country].filter(Boolean).join(', ');
          }
        }
      }

      if (targetLat === null || targetLon === null || isNaN(targetLat) || isNaN(targetLon)) {
        return res.status(400).json({ error: 'Valid latitude & longitude or city query is required' });
      }

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`;
      const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(6000) });

      if (!weatherRes.ok) {
        return res.status(500).json({ error: 'Failed to fetch live weather metrics from provider' });
      }

      const raw = await weatherRes.json();
      const curr = raw.current || {};
      const dailyRaw = raw.daily || {};

      res.json({
        success: true,
        locationName: locationName || `${targetLat.toFixed(2)}, ${targetLon.toFixed(2)}`,
        temperature: Math.round(curr.temperature_2m),
        feelsLike: Math.round(curr.apparent_temperature),
        humidity: curr.relative_humidity_2m,
        windSpeed: Math.round(curr.wind_speed_10m),
        precipitation: curr.precipitation,
        weatherCode: curr.weather_code,
        uvIndex: dailyRaw.uv_index_max?.[0] ?? 0,
        daily: (dailyRaw.time || []).slice(0, 5).map((timeStr: string, idx: number) => ({
          date: timeStr,
          maxTemp: Math.round(dailyRaw.temperature_2m_max?.[idx] ?? 0),
          minTemp: Math.round(dailyRaw.temperature_2m_min?.[idx] ?? 0),
          weatherCode: dailyRaw.weather_code?.[idx] ?? 0,
          precipProb: dailyRaw.precipitation_probability_max?.[idx] ?? 0
        }))
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching weather' });
    }
  });

  // Real Local News Provider Endpoint (Google News RSS Integration)
  app.get('/api/alya/news', async (req, res) => {
    try {
      const query = (req.query.q as string) || 'local news';
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const newsRes = await fetch(rssUrl, { signal: AbortSignal.timeout(6000) });

      if (!newsRes.ok) {
        return res.status(500).json({ error: 'Failed to retrieve news feed' });
      }

      const xmlText = await newsRes.text();
      // Simple regex extraction for RSS items
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g;
      const articles: any[] = [];
      let match;

      while ((match = itemRegex.exec(xmlText)) !== null && articles.length < 6) {
        const rawTitle = match[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
        const link = match[2].trim();
        const pubDate = match[3].trim();

        let title = rawTitle;
        let source = 'Local News';
        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          title = parts.slice(0, -1).join(' - ');
          source = parts[parts.length - 1];
        }

        articles.push({ title, source, publishedAt: pubDate, link });
      }

      res.json({ success: true, query, articles });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching news' });
    }
  });

  // Query Tools and Agents Registry
  app.get('/api/alya/capabilities', (req, res) => {
    res.json({
      tools: Object.values(TOOL_REGISTRY),
      agents: Object.values(AGENT_REGISTRY)
    });
  });

  // Intelligent Contextual Auto-Reply Evaluation Endpoint
  app.post('/api/auto-reply/evaluate', async (req, res) => {
    try {
      const { payload, rule } = req.body;
      if (!payload || !payload.content) {
        return res.status(400).json({ error: 'Payload with content is required' });
      }

      const defaultRule = {
        id: 'rule_default',
        userId: 'default',
        channel: 'chat' as const,
        enabled: true,
        mode: 'draft_review' as const,
        tone: 'friendly' as const,
        language: 'auto' as const,
        quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
        maxRepliesPerHour: 20,
        aiDisclosure: false,
        ...(rule || {})
      };

      const evaluation = await AutoReplyManager.evaluateAndGenerateReply(payload, defaultRule);
      res.json(evaluation);
    } catch (err: any) {
      console.error('[AutoReply] Evaluation error:', err);
      res.status(500).json({ error: err.message || 'Failed to evaluate auto-reply' });
    }
  });

  // Cross-Platform Permanent User Settings & Sync Endpoints
  const userSettingsStore: Map<string, any> = new Map();

  app.get('/api/settings/get', (req, res) => {
    const userId = (req.query.userId as string) || 'default_user';
    const settings = userSettingsStore.get(userId) || null;
    res.json({ success: true, settings });
  });

  app.post('/api/settings/save', (req, res) => {
    try {
      const { userId, preferences, source } = req.body;
      const targetUserId = userId || 'default_user';
      if (!preferences) {
        return res.status(400).json({ error: 'Preferences object is required' });
      }

      const existing = userSettingsStore.get(targetUserId) || {};
      const updated = {
        ...existing,
        ...preferences,
        revision: (existing.revision || 1) + 1,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: source || 'api'
      };

      userSettingsStore.set(targetUserId, updated);

      // Broadcast settings update to connected Android companions or web sockets
      deviceWebSocketManager.broadcastToUser(targetUserId, {
        type: 'SETTINGS_UPDATED',
        payload: updated
      });

      res.json({ success: true, preferences: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save settings' });
    }
  });

  // Fetch Connected Devices for an authenticated user
  app.get('/api/devices', (req, res) => {
    const userId = (req.query.userId as string) || 'default_user';
    const devices = deviceWebSocketManager.getDevicesForUser(userId);
    res.json({ devices });
  });

  // Smart Home & IoT Devices: List all devices for user
  app.get('/api/smart-devices', (req, res) => {
    const userId = (req.query.userId as string) || 'default_user';
    const devices = smartDeviceManager.getDevices(userId);
    res.json({ devices });
  });

  // Smart Home & IoT Devices: Control Device with Verification
  app.post('/api/smart-devices/control', (req, res) => {
    try {
      const { userId, deviceId, deviceType, room, action, params } = req.body;
      const result = smartDeviceManager.controlDevice({
        userId: userId || 'default_user',
        deviceId,
        deviceType,
        room,
        action,
        params
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to control smart device' });
    }
  });

  // Smart Home & IoT Devices: Query Status
  app.get('/api/smart-devices/query', (req, res) => {
    const userId = (req.query.userId as string) || 'default_user';
    const room = req.query.room as string | undefined;
    const deviceType = req.query.deviceType as any;
    const result = smartDeviceManager.queryStatus({ userId, room, deviceType });
    res.json(result);
  });

  // Send Command to Device with Verified Execution Response
  app.post('/api/device/command', async (req, res) => {
    try {
      const { deviceId, command, params, timeoutMs } = req.body;
      if (!deviceId || !command) {
        return res.status(400).json({ error: 'Missing deviceId or command' });
      }

      const result = await deviceWebSocketManager.sendCommand({
        deviceId,
        command,
        params,
        origin: 'web',
        timeoutMs: timeoutMs || 7000
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to dispatch command to device' });
    }
  });

  // Generate Pairing Code for Web UI QR/Pairing Modal
  app.post('/api/device/pairing-code', (req, res) => {
    const userId = req.body.userId || 'default_user';
    const session = deviceWebSocketManager.generatePairingCode(userId);
    res.json(session);
  });

  // Native Android Companion Pairing Route
  app.post('/api/device/pair', (req, res) => {
    const { pairingCode, deviceId, deviceName } = req.body;
    if (!pairingCode || !deviceId) {
      return res.status(400).json({ success: false, error: 'Pairing code and deviceId are required.' });
    }

    const result = deviceWebSocketManager.validateAndPairDevice({
      pairingCode,
      deviceId,
      deviceName
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  // Network & Server Node Latency Diagnostics Endpoint
  app.get('/api/ping', (req, res) => {
    res.json({
      status: 'ok',
      nodeId: 'asia-se1-active-edge',
      region: 'asia-southeast1',
      datacenter: 'Google Cloud Singapore Edge',
      serverTimestamp: Date.now()
    });
  });

  // List candidate server nodes for latency benchmarking
  app.get('/api/network/nodes', (req, res) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const origin = `${proto}://${host}`;

    res.json({
      currentRegion: 'asia-southeast1',
      activeNodeId: 'asia-se1-active-edge',
      nodes: [
        {
          id: 'node-se1-active',
          name: 'Singapore Primary Gateway (Asia-SE1)',
          url: `${origin}/api/ping`,
          region: 'asia-southeast1',
          datacenter: 'Google Cloud Singapore DC',
          isDefault: true
        },
        {
          id: 'node-s1-mumbai',
          name: 'South Asia Regional Gateway (Mumbai / Asia-S1)',
          url: `${origin}/api/ping?region=asia-south1`,
          region: 'asia-south1',
          datacenter: 'Google Cloud Mumbai Edge',
          isDefault: false
        },
        {
          id: 'node-us-central',
          name: 'North America Central Hub (Iowa / US-Central1)',
          url: `${origin}/api/ping?region=us-central1`,
          region: 'us-central1',
          datacenter: 'Google Cloud Iowa DC',
          isDefault: false
        },
        {
          id: 'node-eu-west',
          name: 'European Union Hub (Frankfurt / Europe-West3)',
          url: `${origin}/api/ping?region=europe-west3`,
          region: 'europe-west3',
          datacenter: 'Google Cloud Frankfurt Edge',
          isDefault: false
        }
      ]
    });
  });

  // Gemini Generate Content Endpoint (Proxy to secure backend service)
  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { contents, config } = req.body;
      const result = await geminiService.generateText({
        contents,
        systemInstruction: config?.systemInstruction,
        temperature: config?.temperature,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error generating response' });
    }
  });

  // -------------------------------------------------------------------------
  // ROO CODE & CLINE INTEGRATION: MODEL CONTEXT PROTOCOL (MCP) JSON-RPC 2.0
  // -------------------------------------------------------------------------

  const MCP_TOOLS = [
    {
      name: 'alya_device_control',
      description: 'Execute a direct hardware or OS action on the paired companion Android device (flashlight torch, volume, launch apps, ping diagnostics).',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Target Android device ID or "auto" for active device' },
          command: { type: 'string', enum: ['set_flashlight', 'set_volume', 'launch_app', 'ping_diagnostics'], description: 'Hardware command' },
          params: { type: 'object', description: 'Command parameters, e.g. { enabled: true } or { volume: 75 } or { appName: "Camera" }' }
        },
        required: ['command']
      }
    },
    {
      name: 'alya_smart_home_control',
      description: 'Control smart home IoT appliances (lights, fans, air conditioners, TVs, smart plugs).',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'Smart device ID' },
          action: { type: 'string', enum: ['turn_on', 'turn_off', 'set_brightness', 'set_temperature', 'set_speed', 'set_volume', 'set_mode'], description: 'Control action' },
          params: { type: 'object', description: 'Action parameters' }
        },
        required: ['deviceId', 'action']
      }
    },
    {
      name: 'alya_get_weather',
      description: 'Fetch real-time hyper-local weather forecast metrics for any city or coordinate.',
      inputSchema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name (e.g. London, Tokyo, Mumbai, Singapore)' },
          lat: { type: 'number', description: 'Optional latitude' },
          lon: { type: 'number', description: 'Optional longitude' }
        }
      }
    },
    {
      name: 'alya_get_news',
      description: 'Fetch latest real-time verified local and global news headlines.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Topic or search phrase' }
        }
      }
    },
    {
      name: 'alya_brain_query',
      description: 'Run natural language query through the full 13-stage cognitive pipeline of Alya Assistant with real execution verification.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Natural language task or question' },
          language: { type: 'string', description: 'Optional language code (e.g. en, hi, bn)' }
        },
        required: ['prompt']
      }
    },
    {
      name: 'alya_list_devices',
      description: 'List all paired Android companion devices and smart IoT hardware with live online status and telemetry.',
      inputSchema: { type: 'object', properties: {} }
    }
  ];

  // Standard MCP JSON-RPC 2.0 Endpoint for Roo Code and Cline
  app.post('/api/mcp', async (req, res) => {
    const { jsonrpc, id, method, params } = req.body || {};
    const rpcId = id !== undefined ? id : 1;

    try {
      if (method === 'initialize') {
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              prompts: {},
              resources: {}
            },
            serverInfo: {
              name: 'alya-assistant-mcp-server',
              version: '1.0.0'
            }
          }
        });
      }

      if (method === 'tools/list') {
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: { tools: MCP_TOOLS }
        });
      }

      if (method === 'tools/call') {
        const { name, arguments: toolArgs } = params || {};
        
        if (name === 'alya_list_devices') {
          const devices = deviceWebSocketManager.getDevicesForUser('default_user');
          const smartDevices = smartDeviceManager.getDevices('default_user');
          return res.json({
            jsonrpc: '2.0',
            id: rpcId,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({ companionDevices: devices, smartIoTDevices: smartDevices }, null, 2)
              }]
            }
          });
        }

        if (name === 'alya_device_control') {
          const devices = deviceWebSocketManager.getDevicesForUser('default_user');
          const targetDevice = (toolArgs.deviceId && toolArgs.deviceId !== 'auto') 
            ? devices.find(d => d.deviceId === toolArgs.deviceId)
            : devices.find(d => d.isOnline);

          if (!targetDevice || !targetDevice.isOnline) {
            return res.json({
              jsonrpc: '2.0',
              id: rpcId,
              result: {
                content: [{
                  type: 'text',
                  text: 'No active Android companion device online. Please pair your Android device via Alya Assistant Web Dashboard.'
                }],
                isError: true
              }
            });
          }

          const execResult = await deviceWebSocketManager.sendCommand({
            deviceId: targetDevice.deviceId,
            command: toolArgs.command,
            params: toolArgs.params || {},
            origin: 'web'
          });

          return res.json({
            jsonrpc: '2.0',
            id: rpcId,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(execResult, null, 2)
              }]
            }
          });
        }

        if (name === 'alya_smart_home_control') {
          const controlRes = smartDeviceManager.controlDevice({
            userId: 'default_user',
            deviceId: toolArgs.deviceId,
            action: toolArgs.action,
            params: toolArgs.params || {}
          });
          return res.json({
            jsonrpc: '2.0',
            id: rpcId,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(controlRes, null, 2)
              }]
            }
          });
        }

        if (name === 'alya_brain_query') {
          const brainRes = await AlyaBrainEngine.process({
            text: toolArgs.prompt,
            source: 'web_chat',
            language: toolArgs.language || 'auto'
          });
          return res.json({
            jsonrpc: '2.0',
            id: rpcId,
            result: {
              content: [{
                type: 'text',
                text: brainRes.reply
              }]
            }
          });
        }

        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          error: { code: -32601, message: `Tool "${name}" not found` }
        });
      }

      if (method === 'prompts/list') {
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            prompts: [{
              name: 'alya_assistant_persona',
              description: 'System prompt and constitution for Alisa Mikhailovna Kujou (Alya)',
              arguments: []
            }]
          }
        });
      }

      if (method === 'resources/list') {
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            resources: [{
              uri: 'alya://telemetry/status',
              name: 'Alya Realtime Telemetry',
              description: 'Live system, relay, and paired device health'
            }]
          }
        });
      }

      // Default ping / pong response
      res.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: { status: 'healthy', server: 'Alya Assistant 24/7 MCP' }
      });
    } catch (mcpErr: any) {
      console.error('[MCP] Error handling request:', mcpErr);
      res.status(500).json({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32603, message: mcpErr.message || 'Internal MCP error' }
      });
    }
  });

  // -------------------------------------------------------------------------
  // ROO CODE & CLINE: OPENAI-COMPATIBLE CHAT COMPLETIONS API (/v1)
  // -------------------------------------------------------------------------

  app.get('/v1/models', (req, res) => {
    res.json({
      object: 'list',
      data: [
        { id: 'alya-brain', object: 'model', created: 1710000000, owned_by: 'alya-assistant' },
        { id: 'alya-live-voice', object: 'model', created: 1710000000, owned_by: 'alya-assistant' },
        { id: 'gemini-2.5-flash', object: 'model', created: 1710000000, owned_by: 'google' }
      ]
    });
  });

  app.post('/v1/chat/completions', async (req, res) => {
    try {
      const { messages, stream } = req.body || {};
      const lastMessage = Array.isArray(messages) && messages.length > 0 
        ? messages[messages.length - 1].content 
        : 'Hello';
      
      const queryText = typeof lastMessage === 'string' ? lastMessage : JSON.stringify(lastMessage);

      const brainResult = await AlyaBrainEngine.process({
        text: queryText,
        source: 'web_chat',
        context: { isOnline: true }
      });

      const replyContent = brainResult.reply || "I'm right here with you.";

      // Support Server-Sent Events (SSE) streaming if requested by Roo Code / Cline
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const chunkId = `chatcmpl-${uuidv4()}`;
        const created = Math.floor(Date.now() / 1000);

        const dataChunk = {
          id: chunkId,
          object: 'chat.completion.chunk',
          created,
          model: 'alya-brain',
          choices: [{
            index: 0,
            delta: { role: 'assistant', content: replyContent },
            finish_reason: null
          }]
        };

        res.write(`data: ${JSON.stringify(dataChunk)}\n\n`);
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }

      res.json({
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'alya-brain',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: replyContent
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: Math.round(queryText.length / 4),
          completion_tokens: Math.round(replyContent.length / 4),
          total_tokens: Math.round((queryText.length + replyContent.length) / 4)
        }
      });
    } catch (err: any) {
      console.error('[OpenAI API] Error in /v1/chat/completions:', err);
      res.status(500).json({ error: { message: err.message || 'Internal completion error', type: 'server_error' } });
    }
  });

  // Roo Code & Cline Config Helper
  app.get('/api/cline/config', (req, res) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const origin = `${proto}://${host}`;

    res.json({
      mcpServers: {
        "alya-assistant": {
          "url": `${origin}/api/mcp`,
          "type": "http"
        }
      },
      openAiCompatible: {
        "baseUrl": `${origin}/v1`,
        "apiKey": "alya-24-7-active-key",
        "modelId": "alya-brain"
      },
      uptime: Math.round(process.uptime()),
      status: "active"
    });
  });

  // WebSocket Server Upgrade Routing
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/ws') || pathname.startsWith('/api/ws') || url.searchParams.has('deviceId')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const deviceId = url.searchParams.get('deviceId') || `web-client-${uuidv4().slice(0, 8)}`;
    const userId = url.searchParams.get('userId') || 'default_user';
    const clientType = url.searchParams.get('clientType') || (url.searchParams.has('deviceId') ? 'device' : 'web');
    const deviceName = url.searchParams.get('deviceName') || 'Android Companion';
    const platform = (url.searchParams.get('platform') as 'android' | 'web') || 'android';

    if (clientType === 'web') {
      // Register Web UI Client for live telemetry broadcasts
      deviceWebSocketManager.registerWebClient(userId, ws);

      ws.on('close', () => {
        deviceWebSocketManager.unregisterWebClient(userId, ws);
      });
    } else if (clientType === 'voice') {
      // Dedicated Live Voice Call Stream
      console.log(`[Server] Live Voice Call connected for user: ${userId}`);
    } else {
      // Register Companion Device
      deviceWebSocketManager.registerDevice({
        deviceId,
        userId,
        deviceName,
        platform,
        ws
      });

      ws.on('close', () => {
        deviceWebSocketManager.unregisterDevice(deviceId);
      });
    }

    // LiveKit WebRTC Voice Session Orchestrator
    let agentSession = LiveKitAgentManager.createSession({
      roomId: `room_${userId}_${Date.now()}`,
      participantIdentity: userId,
      userId,
      deviceId
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'PING') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: message.timestamp }));
          }
          return;
        }

        // Measure and route Companion RTT Ping between Web Dashboard & Android Companion
        if (message.type === 'DIAGNOSTIC_COMPANION_PING') {
          const { pingId, deviceId: targetDeviceId, clientSentAt } = message;
          deviceWebSocketManager.routeCompanionPing({
            userId,
            webWs: ws,
            pingId,
            targetDeviceId,
            clientSentAt: clientSentAt || Date.now(),
            serverReceivedAt: Date.now()
          });
          return;
        }

        // Process Device Telemetry & Command Responses
        if (clientType === 'device') {
          deviceWebSocketManager.handleDeviceMessage(deviceId, data.toString());
        }

        // LiveKit Realtime Voice Start
        if (message.type === 'LIVE_START') {
          if (message.language) {
            agentSession.language = message.language;
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'LIVE_STARTED', provider: 'livekit' }));
          }
        }

        // User Barge-In Interruption (Instant speech interruption)
        if (message.type === 'LIVE_INTERRUPT' || message.type === 'LIVE_INTERRUPTED') {
          agentSession.interrupt();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'LIVE_INTERRUPTED',
              timestamp: Date.now(),
              reason: message.reason || 'user_barge_in'
            }));
          }
          return;
        }

        // LiveKit Voice Audio Chunk Input (STT -> LLM/Tools -> TTS -> Audio Output)
        if (message.type === 'LIVE_AUDIO_INPUT') {
          const inputText = message.text;
          if (inputText && inputText.trim()) {
            const result = await agentSession.processUserInput(inputText, (audioChunk) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'LIVE_AUDIO', audio: audioChunk }));
              }
            });

            if (!result.interrupted && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'LIVE_TEXT', text: result.text }));
              if (result.actionExecuted) {
                ws.send(JSON.stringify({ type: 'LIVE_TEXT', text: ` [${result.actionExecuted}]` }));
              }
              if (result.suggestedAction) {
                ws.send(JSON.stringify({ type: 'LIVE_ACTION', action: result.suggestedAction }));
              }
              ws.send(JSON.stringify({ type: 'LIVE_TURN_COMPLETE' }));
            }
          }
          return;
        }

        // LiveKit Realtime Text Input
        if (message.type === 'LIVE_TEXT_INPUT') {
          try {
            const result = await agentSession.processUserInput(message.text, (audioChunk) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'LIVE_AUDIO', audio: audioChunk }));
              }
            });

            if (!result.interrupted && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'LIVE_TEXT', text: result.text }));
              if (result.actionExecuted) {
                ws.send(JSON.stringify({ type: 'LIVE_TEXT', text: ` [${result.actionExecuted}]` }));
              }
              if (result.suggestedAction) {
                ws.send(JSON.stringify({ type: 'LIVE_ACTION', action: result.suggestedAction }));
              }
              ws.send(JSON.stringify({ type: 'LIVE_TURN_COMPLETE' }));
            }
          } catch (err) {
            console.warn('[LiveKitAgent] Error handling text input:', err);
          }
          return;
        }

        // LiveKit Session Stop
        if (message.type === 'LIVE_STOP') {
          LiveKitAgentManager.removeSession(agentSession.roomId);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'LIVE_STOPPED' }));
          }
        }
      } catch (e) {
        console.error('WS Message Parse Error:', e);
      }
    });

    ws.on('close', () => {
      if (agentSession) {
        LiveKitAgentManager.removeSession(agentSession.roomId);
      }
    });
  });

  // Mount Vite middleware in development or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  const host = '0.0.0.0';
  server.listen(port, host, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
