/**
 * Centralized Voice Engine for Alya Assistant
 * Manages microphone lifecycle, audio stream initialization, track health,
 * volume level metering, and real-time 16kHz PCM audio chunk generation.
 */

import { AudioEngineManager } from './AudioEngine';
import { PermissionManager } from './permissionManager';

export interface VoiceEngineConfig {
  sampleRate?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export type AudioChunkCallback = (pcmBase64: string, rawInt16: Int16Array) => void;
export type VolumeChangeCallback = (volumeLevel: number) => void;
export type TrackStateCallback = (active: boolean, error?: string) => void;

export class VoiceEngine {
  private static instance: VoiceEngine | null = null;

  // Stream & Hardware
  private mediaStream: MediaStream | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private audioEngine: AudioEngineManager;

  // Audio Context & Nodes
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // State
  private isCapturing = false;
  private isMuted = false;
  private volumeInterval: number | null = null;

  // Callbacks
  private onAudioChunkCallbacks: Set<AudioChunkCallback> = new Set();
  private onVolumeChangeCallbacks: Set<VolumeChangeCallback> = new Set();
  private onTrackStateCallbacks: Set<TrackStateCallback> = new Set();

  private constructor() {
    this.audioEngine = AudioEngineManager.getInstance();
  }

  public static getInstance(): VoiceEngine {
    if (!VoiceEngine.instance) {
      VoiceEngine.instance = new VoiceEngine();
    }
    return VoiceEngine.instance;
  }

  /**
   * Initializes microphone access with standardized 16kHz audio constraints
   */
  public async initializeMicrophone(config: VoiceEngineConfig = {}): Promise<MediaStream> {
    // 1. Verify pre-flight prerequisites
    const prereqs = await PermissionManager.verifyVoiceSessionPrerequisites();
    if (!prereqs.microphone.granted) {
      throw new Error(prereqs.microphone.error || 'Microphone access denied or unavailable.');
    }

    // 2. Stop any stale media streams
    this.stopCapture();

    const constraints: MediaStreamConstraints = {
      audio: {
        sampleRate: config.sampleRate || 16000,
        channelCount: 1,
        echoCancellation: config.echoCancellation ?? true,
        noiseSuppression: config.noiseSuppression ?? true,
        autoGainControl: config.autoGainControl ?? true,
      },
    };

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const tracks = this.mediaStream.getAudioTracks();

      if (tracks.length === 0) {
        throw new Error('No audio tracks returned from microphone stream.');
      }

      this.audioTrack = tracks[0];

      // Bind track health listeners
      this.audioTrack.onended = () => {
        console.warn('[VoiceEngine] Microphone track ended unexpectedly.');
        this.notifyTrackState(false, 'Microphone track was closed or disconnected.');
        this.stopCapture();
      };

      this.audioTrack.onmute = () => {
        console.warn('[VoiceEngine] Microphone track muted by system or hardware.');
        this.notifyTrackState(false, 'Microphone track muted by system.');
      };

      this.audioTrack.onunmute = () => {
        console.log('[VoiceEngine] Microphone track unmuted by system.');
        this.notifyTrackState(true);
      };

      this.notifyTrackState(true);
      return this.mediaStream;
    } catch (err: any) {
      console.error('[VoiceEngine] Error initializing microphone:', err);
      throw new Error(err.message || 'Failed to acquire microphone media stream.');
    }
  }

  /**
   * Starts live audio capture and sets up PCM streaming nodes
   */
  public async startCapture(config: VoiceEngineConfig = {}): Promise<boolean> {
    if (this.isCapturing) {
      return true;
    }

    try {
      if (!this.mediaStream || !this.audioTrack || this.audioTrack.readyState !== 'live') {
        await this.initializeMicrophone(config);
      }

      if (!this.mediaStream) {
        throw new Error('Microphone stream initialization failed.');
      }

      // Initialize AudioEngine input pipeline
      this.analyserNode = await this.audioEngine.initInputEngine(this.mediaStream);

      // Create local AudioContext for 16kHz PCM chunk processing
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({
        sampleRate: 16000,
        latencyHint: 'interactive',
      });

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // Setup ScriptProcessor / Worklet Node for PCM 16kHz extraction with ultra-low latency 1024 buffer (~64ms)
      const bufferSize = 1024;
      const processor = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!this.isCapturing || this.isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convert Int16Array to Base64 PCM chunk
        let binary = '';
        const bytes = new Uint8Array(pcm16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Pcm = btoa(binary);

        this.notifyAudioChunk(base64Pcm, pcm16);
      };

      this.sourceNode.connect(processor);
      
      // Connect to a silent GainNode (gain = 0) so the processor remains active in Web Audio graph
      // without piping raw microphone audio to the physical speakers (prevents acoustic feedback / self-echo)
      const silentGain = this.audioCtx.createGain();
      silentGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      processor.connect(silentGain);
      silentGain.connect(this.audioCtx.destination);
      this.workletNode = processor;

      this.isCapturing = true;
      this.isMuted = false;
      this.startVolumeMeter();

      console.log('[VoiceEngine] Voice capture successfully started.');
      return true;
    } catch (err: any) {
      console.error('[VoiceEngine] Failed to start capture:', err);
      this.stopCapture();
      throw err;
    }
  }

  /**
   * Stops microphone capture and tears down nodes and tracks
   */
  public stopCapture(): void {
    this.isCapturing = false;
    this.stopVolumeMeter();

    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {}
      this.workletNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }

    this.audioTrack = null;
    this.analyserNode = null;

    this.audioEngine.cleanupInput();
    console.log('[VoiceEngine] Voice capture stopped and resources cleaned up.');
  }

  /**
   * Mutes or unmutes the audio track
   */
  public setMute(mute: boolean): void {
    this.isMuted = mute;
    if (this.audioTrack) {
      this.audioTrack.enabled = !mute;
    }
    console.log(`[VoiceEngine] Microphone mute set to: ${mute}`);
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsCapturing(): boolean {
    return this.isCapturing;
  }

  public getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  /**
   * Subscription handlers
   */
  public onAudioChunk(callback: AudioChunkCallback): () => void {
    this.onAudioChunkCallbacks.add(callback);
    return () => this.onAudioChunkCallbacks.delete(callback);
  }

  public onVolumeChange(callback: VolumeChangeCallback): () => void {
    this.onVolumeChangeCallbacks.add(callback);
    return () => this.onVolumeChangeCallbacks.delete(callback);
  }

  public onTrackState(callback: TrackStateCallback): () => void {
    this.onTrackStateCallbacks.add(callback);
    return () => this.onTrackStateCallbacks.delete(callback);
  }

  /**
   * Helper: Meter volume level for live visualizers
   */
  private startVolumeMeter(): void {
    this.stopVolumeMeter();
    if (!this.analyserNode) return;

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    this.volumeInterval = window.setInterval(() => {
      if (!this.isCapturing || this.isMuted || !this.analyserNode) {
        this.notifyVolumeChange(0);
        return;
      }

      this.analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const volumeLevel = Math.min(100, Math.round((average / 255) * 100 * 2.5));

      this.notifyVolumeChange(volumeLevel);
    }, 50);
  }

  private stopVolumeMeter(): void {
    if (this.volumeInterval !== null) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }
    this.notifyVolumeChange(0);
  }

  private notifyAudioChunk(base64Pcm: string, rawInt16: Int16Array): void {
    this.onAudioChunkCallbacks.forEach((cb) => {
      try {
        cb(base64Pcm, rawInt16);
      } catch (err) {
        console.error('[VoiceEngine] Error in AudioChunk callback:', err);
      }
    });
  }

  private notifyVolumeChange(volumeLevel: number): void {
    this.onVolumeChangeCallbacks.forEach((cb) => {
      try {
        cb(volumeLevel);
      } catch (err) {
        console.error('[VoiceEngine] Error in VolumeChange callback:', err);
      }
    });
  }

  private notifyTrackState(active: boolean, error?: string): void {
    this.onTrackStateCallbacks.forEach((cb) => {
      try {
        cb(active, error);
      } catch (err) {
        console.error('[VoiceEngine] Error in TrackState callback:', err);
      }
    });
  }
}

export const voiceEngine = VoiceEngine.getInstance();
