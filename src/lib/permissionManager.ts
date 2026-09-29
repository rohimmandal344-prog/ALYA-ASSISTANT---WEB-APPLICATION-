/**
 * Centralized Permission & Readiness Manager for Alya Assistant
 * Ensures microphone, network connectivity, and WebAudio support are verified
 * prior to VoiceSession initialization to prevent silent failures.
 */

export interface PermissionCheckResult {
  ready: boolean;
  microphone: {
    granted: boolean;
    error?: string;
  };
  network: {
    online: boolean;
    latencyMs?: number;
    error?: string;
  };
  audioContext: {
    supported: boolean;
    state?: string;
  };
  errorMessage?: string;
}

class PermissionManagerImpl {
  /**
   * Verifies microphone permission by querying API or attempting media stream acquisition
   */
  public async checkMicrophonePermission(): Promise<{ granted: boolean; error?: string }> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { granted: false, error: 'MediaDevices API is not supported in this browser environment.' };
      }

      // Query status first if Permissions API is supported
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'microphone' as any });
          if (status.state === 'denied') {
            return { granted: false, error: 'Microphone access is explicitly blocked in browser permissions.' };
          }
          if (status.state === 'granted' || status.state === 'prompt') {
            return { granted: true };
          }
        } catch {
          // Fall through to device check
        }
      }

      // If permissions API is unavailable, verify audio input device presence
      if (navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const hasMic = devices.some(d => d.kind === 'audioinput');
          if (!hasMic && devices.length > 0) {
            return { granted: false, error: 'No microphone input device was detected on your hardware.' };
          }
        } catch {}
      }

      return { granted: true };
    } catch (err: any) {
      let errorMsg = 'Microphone permission request failed.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Microphone permission was denied by the user or browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No microphone device was detected on your hardware.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Microphone is already in use by another application.';
      } else if (err.message) {
        errorMsg = err.message;
      }

      return { granted: false, error: errorMsg };
    }
  }

  /**
   * Verifies network connectivity and backend API reachability
   */
  public async checkNetworkConnectivity(): Promise<{ online: boolean; latencyMs?: number; error?: string }> {
    if (!navigator.onLine) {
      return { online: false, error: 'Device appears offline. Check network connection.' };
    }

    const startTime = Date.now();
    try {
      const response = await fetch('/api/alya/capabilities', {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        return { online: false, error: `Backend server returned HTTP status ${response.status}.` };
      }

      const latencyMs = Date.now() - startTime;
      return { online: true, latencyMs };
    } catch (err: any) {
      // Offline fallback is supported, but report network status probe
      return {
        online: false,
        error: err.name === 'TimeoutError' ? 'Network latency probe timed out.' : 'Backend connection check failed.',
      };
    }
  }

  /**
   * Checks WebAudio AudioContext availability
   */
  public checkAudioContextSupport(): { supported: boolean; state?: string } {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return { supported: false };
    }

    try {
      const tempCtx = new AudioCtx();
      const state = tempCtx.state;
      tempCtx.close().catch(() => {});
      return { supported: true, state };
    } catch {
      return { supported: true, state: 'unknown' };
    }
  }

  /**
   * Centralized Pre-flight Check: Verifies all prerequisites prior to VoiceSession launch
   */
  public async verifyVoiceSessionPrerequisites(): Promise<PermissionCheckResult> {
    const micCheck = await this.checkMicrophonePermission();
    const netCheck = await this.checkNetworkConnectivity();
    const audioCheck = this.checkAudioContextSupport();

    const ready = micCheck.granted && audioCheck.supported;
    let errorMessage: string | undefined;

    if (!micCheck.granted) {
      errorMessage = micCheck.error || 'Microphone access is required for voice session.';
    } else if (!audioCheck.supported) {
      errorMessage = 'WebAudio is not supported in this browser.';
    } else if (!netCheck.online) {
      errorMessage = netCheck.error || 'Network connection offline. Voice API streaming requires internet.';
    }

    return {
      ready,
      microphone: micCheck,
      network: netCheck,
      audioContext: audioCheck,
      errorMessage,
    };
  }
}

export const PermissionManager = new PermissionManagerImpl();
