/**
 * Helper utility to initialize and attach the 16kHz PCM AudioWorkletProcessor
 * to a Web Audio Context for low-latency, off-main-thread audio streaming.
 */

export interface WorkletStreamOptions {
  audioCtx: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  onAudioPCM16: (pcmBuffer: Uint8Array) => void;
  isMuted?: () => boolean;
}

export async function attachPCMAudioWorklet(options: WorkletStreamOptions): Promise<AudioNode> {
  const { audioCtx, sourceNode, onAudioPCM16, isMuted } = options;

  const inlineWorkletCode = `
    class PCMWorkletProcessor extends AudioWorkletProcessor {
      process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input.length > 0) {
          const float32Data = input[0];
          if (float32Data && float32Data.length > 0) {
            const pcm16 = new Int16Array(float32Data.length);
            for (let i = 0; i < float32Data.length; i++) {
              const s = Math.max(-1, Math.min(1, float32Data[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
          }
        }
        return true;
      }
    }
    registerProcessor('pcm-worklet-processor', PCMWorkletProcessor);
  `;

  if (!audioCtx.audioWorklet) {
    throw new Error('AudioWorklet is not supported in this browser environment.');
  }

  // Attempt to load from public file first, then fallback to inline blob
  try {
    await audioCtx.audioWorklet.addModule('/pcm-processor.js');
  } catch {
    const blob = new Blob([inlineWorkletCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    await audioCtx.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);
  }

  const workletNode = new AudioWorkletNode(audioCtx, 'pcm-worklet-processor');

  workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    if (isMuted && isMuted()) return;
    const pcmBuffer = new Uint8Array(event.data);
    onAudioPCM16(pcmBuffer);
  };

  sourceNode.connect(workletNode);
  
  // Connect to a silent GainNode (gain = 0) so the AudioWorklet node remains active in Web Audio graph
  // without piping raw microphone input back to the physical speakers (prevents acoustic feedback / self-echo)
  const silentGain = audioCtx.createGain();
  silentGain.gain.setValueAtTime(0, audioCtx.currentTime);
  workletNode.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  return workletNode;
}
