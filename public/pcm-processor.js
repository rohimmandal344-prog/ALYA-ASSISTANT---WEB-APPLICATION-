/**
 * Dedicated AudioWorkletProcessor for 16kHz PCM Audio Streaming
 * Offloads Float32-to-Int16 PCM conversion off the main UI thread.
 */
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
        // Zero-copy transfer of buffer to main listener thread
        this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('pcm-worklet-processor', PCMWorkletProcessor);
