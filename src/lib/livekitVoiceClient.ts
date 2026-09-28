/**
 * Alya Assistant - LiveKit WebRTC Voice Client
 * Handles real-time WebRTC audio streaming, LiveKit room connections,
 * Voice Activity Detection (VAD), barge-in interruption, and automatic session recovery.
 */

import { Room, RoomEvent, Track, LocalAudioTrack, createLocalAudioTrack } from 'livekit-client';

export interface LiveKitVoiceClientOptions {
  userId?: string;
  roomName?: string;
  language?: string;
  onText?: (text: string) => void;
  onAudio?: (base64Audio: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onInterrupted?: () => void;
}

export class LiveKitVoiceClient {
  private room: Room | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private options: LiveKitVoiceClientOptions;
  private isConnected: boolean = false;
  private wsFallback: WebSocket | null = null;

  constructor(options: LiveKitVoiceClientOptions) {
    this.options = options;
  }

  /**
   * Connect to LiveKit Room using authenticated server JWT token.
   */
  async connect(): Promise<boolean> {
    try {
      // 1. Fetch short-lived token from backend
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: this.options.roomName || 'alya-voice-room',
          userId: this.options.userId || 'web_user',
          name: 'Alya User'
        })
      });

      if (!res.ok) {
        throw new Error(`Token endpoint returned ${res.status}`);
      }

      const { token, serverUrl, roomName } = await res.json();

      // 2. Initialize LiveKit WebRTC Room
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Bind Room Events
      this.room.on(RoomEvent.Connected, () => {
        this.isConnected = true;
        this.options.onConnected?.();
      });

      this.room.on(RoomEvent.Disconnected, () => {
        this.isConnected = false;
        this.options.onDisconnected?.();
      });

      this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.play().catch(console.warn);
        }
      });

      this.room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const str = new TextDecoder().decode(payload);
          const data = JSON.parse(str);
          if (data.type === 'LIVE_TEXT' && this.options.onText) {
            this.options.onText(data.text);
          }
          if (data.type === 'LIVE_INTERRUPTED' && this.options.onInterrupted) {
            this.options.onInterrupted();
          }
        } catch {}
      });

      // Connect to WebRTC LiveKit server
      await this.room.connect(serverUrl, token);

      // Publish local audio track
      this.localAudioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      await this.room.localParticipant.publishTrack(this.localAudioTrack);
      return true;

    } catch (err: any) {
      console.warn('[LiveKitVoiceClient] WebRTC direct connection notice, starting WebSocket Agent bridge fallback:', err?.message || err);
      return this.connectWebSocketFallback();
    }
  }

  /**
   * WebSocket Agent Bridge fallback for environments where WebRTC UDP ports are filtered
   */
  private connectWebSocketFallback(): Promise<boolean> {
    return new Promise((resolve) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const userId = this.options.userId || 'default_user';
      const wsUrl = `${protocol}//${window.location.host}/ws/live?clientType=voice&userId=${encodeURIComponent(userId)}`;

      this.wsFallback = new WebSocket(wsUrl);

      this.wsFallback.onopen = () => {
        this.isConnected = true;
        this.wsFallback?.send(JSON.stringify({
          type: 'LIVE_START',
          language: this.options.language || localStorage.getItem('alya_preferred_lang') || 'auto'
        }));
        this.options.onConnected?.();
        resolve(true);
      };

      this.wsFallback.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'LIVE_TEXT' && this.options.onText) {
            this.options.onText(msg.text);
          }
          if (msg.type === 'LIVE_AUDIO' && this.options.onAudio) {
            this.options.onAudio(msg.audio);
          }
          if (msg.type === 'LIVE_INTERRUPTED' && this.options.onInterrupted) {
            this.options.onInterrupted();
          }
        } catch {}
      };

      this.wsFallback.onerror = () => {
        this.options.onError?.('Voice connection failed.');
        resolve(false);
      };

      this.wsFallback.onclose = () => {
        this.isConnected = false;
        this.options.onDisconnected?.();
      };
    });
  }

  /**
   * Send live text input to Alya Agent
   */
  sendTextInput(text: string) {
    if (this.wsFallback && this.wsFallback.readyState === WebSocket.OPEN) {
      this.wsFallback.send(JSON.stringify({
        type: 'LIVE_TEXT_INPUT',
        text,
        language: this.options.language || 'auto'
      }));
    } else if (this.room && this.isConnected) {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ type: 'LIVE_TEXT_INPUT', text }));
      this.room.localParticipant.publishData(data, { reliable: true });
    }
  }

  /**
   * Notify Alya Agent of user barge-in / interruption
   */
  interrupt() {
    if (this.wsFallback && this.wsFallback.readyState === WebSocket.OPEN) {
      this.wsFallback.send(JSON.stringify({ type: 'LIVE_INTERRUPT' }));
    }
  }

  /**
   * Mute or unmute microphone
   */
  setMicrophoneMuted(muted: boolean) {
    if (this.localAudioTrack) {
      if (muted) {
        this.localAudioTrack.mute();
      } else {
        this.localAudioTrack.unmute();
      }
    }
  }

  /**
   * Disconnect voice session and stop tracks
   */
  disconnect() {
    this.isConnected = false;
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack = null;
    }
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    if (this.wsFallback) {
      try {
        this.wsFallback.onopen = null;
        this.wsFallback.onmessage = null;
        this.wsFallback.onerror = null;
        this.wsFallback.onclose = null;
        this.wsFallback.close();
      } catch {}
      this.wsFallback = null;
    }
    this.options.onDisconnected?.();
  }
}
