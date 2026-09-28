/**
 * Centralized High-Performance Audio Engine Manager for Alya Assistant
 * Handles AudioContext lifecycles, mutually exclusive audio focus,
 * input/output sample rate standardization, and non-overlapping PCM queue streams.
 */

export class AudioEngineManager {
  private static instance: AudioEngineManager | null = null;

  // Audio Contexts
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;

  // Streams & Nodes
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private speakerAnalyser: AnalyserNode | null = null;

  // Playback Queues
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;

  // Focus and States
  private currentFocus: 'none' | 'microphone' | 'tts' | 'system' = 'none';
  private inputMuted = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): AudioEngineManager {
    if (!AudioEngineManager.instance) {
      AudioEngineManager.instance = new AudioEngineManager();
    }
    return AudioEngineManager.instance;
  }

  /**
   * Request exclusive audio focus to prevent overlapping operations
   */
  public requestAudioFocus(focus: 'none' | 'microphone' | 'tts' | 'system'): boolean {
    console.log(`[AudioEngine] Audio focus transition: ${this.currentFocus} ➔ ${focus}`);

    if (focus === 'microphone') {
      // Pause or stop any active speaker output/TTS
      this.stopTTS();
      this.clearOutputQueue();
    } else if (focus === 'tts') {
      // Mute microphone or let it co-exist during response
    }

    this.currentFocus = focus;
    return true;
  }

  /**
   * Standardizes Microphone Input AudioContext (16kHz, low-latency interactive hint)
   */
  public async initInputEngine(stream: MediaStream): Promise<AnalyserNode> {
    this.cleanupInput();
    this.micStream = stream;

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    // Set explicit 16kHz sample rate with ultra-low latency interactive hint
    this.inputCtx = new AudioCtxClass({ 
      sampleRate: 16000,
      latencyHint: 'interactive'
    });

    if (this.inputCtx.state === 'suspended') {
      await this.inputCtx.resume();
    }

    this.sourceNode = this.inputCtx.createMediaStreamSource(stream);
    
    this.micAnalyser = this.inputCtx.createAnalyser();
    this.micAnalyser.fftSize = 32;
    this.sourceNode.connect(this.micAnalyser);

    this.requestAudioFocus('microphone');
    return this.micAnalyser;
  }

  /**
   * Standardizes Speaker Output AudioContext (24kHz, low-latency interactive hint)
   */
  public async initOutputEngine(): Promise<AnalyserNode> {
    if (this.outputCtx && this.outputCtx.state !== 'closed') {
      if (this.outputCtx.state === 'suspended') {
        await this.outputCtx.resume();
      }
      return this.speakerAnalyser || this.createSpeakerAnalyser();
    }

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    // Set explicit 24kHz sample rate with minimal interactive latency
    this.outputCtx = new AudioCtxClass({ 
      sampleRate: 24000,
      latencyHint: 'interactive'
    });

    if (this.outputCtx.state === 'suspended') {
      await this.outputCtx.resume();
    }

    return this.createSpeakerAnalyser();
  }

  private createSpeakerAnalyser(): AnalyserNode {
    if (!this.outputCtx) throw new Error('Output AudioContext not initialized.');
    this.speakerAnalyser = this.outputCtx.createAnalyser();
    this.speakerAnalyser.fftSize = 32;
    return this.speakerAnalyser;
  }

  /**
   * Queues base64 PCM audio chunk for standardized playback (24kHz)
   */
  public queueAudioChunk(base64Pcm: string) {
    if (!this.outputCtx || this.outputCtx.state === 'closed') {
      this.initOutputEngine().then(() => this.enqueueBase64(base64Pcm)).catch(() => {});
    } else {
      this.enqueueBase64(base64Pcm);
    }
  }

  private enqueueBase64(base64Pcm: string) {
    try {
      const binary = atob(base64Pcm);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 0x7FFF;
      }

      this.audioQueue.push(floatData);
      this.processOutputQueue();
    } catch (err) {
      console.warn('[AudioEngine] Error decoding PCM chunk:', err);
    }
  }

  private async processOutputQueue() {
    if (this.audioQueue.length === 0 || !this.outputCtx || this.outputCtx.state === 'closed') {
      return;
    }

    if (this.outputCtx.state === 'suspended') {
      try { await this.outputCtx.resume(); } catch {}
    }

    this.isPlaying = true;
    this.requestAudioFocus('tts');

    while (this.audioQueue.length > 0) {
      const chunk = this.audioQueue.shift()!;
      const audioBuffer = this.outputCtx.createBuffer(1, chunk.length, 24000);
      audioBuffer.getChannelData(0).set(chunk);

      const source = this.outputCtx.createBufferSource();
      source.buffer = audioBuffer;

      if (this.speakerAnalyser) {
        source.connect(this.speakerAnalyser);
        this.speakerAnalyser.connect(this.outputCtx.destination);
      } else {
        source.connect(this.outputCtx.destination);
      }

      const now = this.outputCtx.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.activeSourceNodes.push(source);

      source.onended = () => {
        this.activeSourceNodes = this.activeSourceNodes.filter(node => node !== source);
        if (this.activeSourceNodes.length === 0 && this.audioQueue.length === 0) {
          this.isPlaying = false;
        }
      };
    }
  }

  /**
   * Toggle input stream track muting
   */
  public muteInput(isMuted: boolean) {
    this.inputMuted = isMuted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }

  /**
   * Stop active speech synthesis (browser and custom stream nodes)
   */
  public stopTTS() {
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    
    // Stop all playing source buffers
    this.activeSourceNodes.forEach(node => {
      try { node.stop(); } catch {}
    });
    this.activeSourceNodes = [];
    this.isPlaying = false;
  }

  /**
   * Clears pending queue frames
   */
  public clearOutputQueue() {
    this.audioQueue = [];
  }

  /**
   * Releases input pipeline
   */
  public cleanupInput() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
      this.micStream = null;
    }

    try { this.sourceNode?.disconnect(); } catch {}
    try { this.micAnalyser?.disconnect(); } catch {}

    if (this.inputCtx && this.inputCtx.state !== 'closed') {
      this.inputCtx.close().catch(() => {});
    }

    this.sourceNode = null;
    this.micAnalyser = null;
    this.inputCtx = null;
  }

  /**
   * Releases output pipeline
   */
  public cleanupOutput() {
    this.stopTTS();
    this.clearOutputQueue();

    try { this.speakerAnalyser?.disconnect(); } catch {}

    if (this.outputCtx && this.outputCtx.state !== 'closed') {
      this.outputCtx.close().catch(() => {});
    }

    this.speakerAnalyser = null;
    this.outputCtx = null;
  }

  /**
   * Global core cleanup and reset
   */
  public async shutdownEngine() {
    console.log('[AudioEngine] Shutting down global Audio Engine.');
    this.cleanupInput();
    this.cleanupOutput();
    this.currentFocus = 'none';
  }
}

export const audioEngine = AudioEngineManager.getInstance();
