/**
 * Alya Assistant - LiveKit WebRTC Token & Room Service
 * Uses livekit-server-sdk to securely issue short-lived JWT access tokens for
 * Web and Android clients connecting to LiveKit rooms.
 * NEVER exposes LIVEKIT_API_SECRET to the client app.
 */

import { AccessToken } from 'livekit-server-sdk';
import { livekitConfig } from './config/livekitConfig.ts';

export interface GenerateTokenOptions {
  roomName?: string;
  identity?: string;
  name?: string;
  userId?: string;
  metadata?: Record<string, any>;
  ttlSeconds?: number;
}

export class LiveKitServerService {
  /**
   * Issue short-lived, authenticated JWT access token for LiveKit Room join.
   */
  static async createJoinToken(options: GenerateTokenOptions): Promise<{
    token: string;
    serverUrl: string;
    roomName: string;
    identity: string;
    expiresAt: number;
  }> {
    const roomName = options.roomName || livekitConfig.defaultRoom;
    const userId = options.userId || 'user_' + Math.random().toString(36).substr(2, 8);
    const identity = options.identity || `${userId}_${Math.random().toString(36).substr(2, 6)}`;
    const name = options.name || 'Alya User';
    const ttl = options.ttlSeconds || 3600; // 1 hour token TTL

    const apiKey = livekitConfig.apiKey;
    const apiSecret = livekitConfig.apiSecret;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl,
      metadata: JSON.stringify(options.metadata || { userId, clientType: 'alya_voice' })
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const jwtToken = await at.toJwt();
    const expiresAt = Date.now() + ttl * 1000;

    return {
      token: jwtToken,
      serverUrl: livekitConfig.url,
      roomName,
      identity,
      expiresAt
    };
  }
}
