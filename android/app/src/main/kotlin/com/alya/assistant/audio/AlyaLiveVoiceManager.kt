package com.alya.assistant.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.util.Base64
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * AlyaLiveVoiceManager - Android Native Full-Duplex Audio Engine
 *
 * Capabilities:
 * 1. Continuous full-duplex recording and playback (speaks and listens concurrently).
 * 2. Hardware Acoustic Echo Cancellation (AEC) and Noise Suppression (NS) via Android AudioFX.
 * 3. Instant user barge-in detection (halts audio playback on genuine user vocal input).
 * 4. Ultra-low latency 16kHz PCM streaming capture and 24kHz PCM output.
 */
class AlyaLiveVoiceManager(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.IO)
    private var recordJob: Job? = null
    private var playbackJob: Job? = null

    // Audio Hardware Components
    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var aecEffect: AcousticEchoCanceler? = null
    private var nsEffect: NoiseSuppressor? = null

    // State Tracking
    private val isRecording = AtomicBoolean(false)
    private val isPlaying = AtomicBoolean(false)
    private val currentGenerationId = AtomicInteger(0)
    private val audioQueue = ConcurrentLinkedQueue<ByteArray>()

    // Callbacks
    var onAudioChunkCaptured: ((base64Pcm: String) => Unit)? = null
    var onBargeInDetected: (() => Unit)? = null
    var onStateChanged: ((state: String) => Unit)? = null

    companion object {
        const val SAMPLE_RATE_IN = 16000
        const val SAMPLE_RATE_OUT = 24000
        const val CHUNK_SIZE_IN = 1024 // ~64ms at 16kHz
    }

    /**
     * Start continuous full-duplex audio session
     */
    fun startLiveSession() {
        if (isRecording.get()) return

        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = true

        val minBufferSizeIn = AudioRecord.getMinBufferSize(
            SAMPLE_RATE_IN,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val bufferSizeIn = maxOf(minBufferSizeIn, CHUNK_SIZE_IN * 2)

        try {
            // Use VOICE_COMMUNICATION to enable hardware AEC on modern Android SoCs
            val record = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                SAMPLE_RATE_IN,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSizeIn
            )
            audioRecord = record

            // Attach Acoustic Echo Canceler if available on hardware
            if (AcousticEchoCanceler.isAvailable()) {
                aecEffect = AcousticEchoCanceler.create(record.audioSessionId)?.apply {
                    enabled = true
                }
            }

            // Attach Noise Suppressor if available on hardware
            if (NoiseSuppressor.isAvailable()) {
                nsEffect = NoiseSuppressor.create(record.audioSessionId)?.apply {
                    enabled = true
                }
            }

            // Configure Output AudioTrack (24kHz for ultra-realistic neural TTS)
            val minBufferSizeOut = AudioTrack.getMinBufferSize(
                SAMPLE_RATE_OUT,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )

            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(SAMPLE_RATE_OUT)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(maxOf(minBufferSizeOut, 4096))
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            audioTrack?.play()
            record.startRecording()
            isRecording.set(true)
            onStateChanged?.invoke("LISTENING")

            // Start Concurrent Audio Capture Thread
            startCaptureLoop()

            // Start Concurrent Audio Playback Thread
            startPlaybackLoop()

        } catch (e: Exception) {
            e.printStackTrace()
            onStateChanged?.invoke("ERROR: ${e.message}")
            stopLiveSession()
        }
    }

    private fun startCaptureLoop() {
        recordJob = scope.launch {
            val buffer = ShortArray(CHUNK_SIZE_IN)
            val byteBuffer = ByteArray(CHUNK_SIZE_IN * 2)

            while (isActive && isRecording.get()) {
                val readCount = audioRecord?.read(buffer, 0, CHUNK_SIZE_IN) ?: 0
                if (readCount > 0) {
                    // Calculate RMS energy for local voice activity & barge-in
                    var sum = 0.0
                    for (i in 0 until readCount) {
                        val sample = buffer[i]
                        byteBuffer[i * 2] = (sample.toInt() and 0xFF).toByte()
                        byteBuffer[i * 2 + 1] = ((sample.toInt() shr 8) and 0xFF).toByte()
                        sum += sample * sample
                    }
                    val rms = Math.sqrt(sum / readCount)

                    // If Alya is currently speaking and user speaks loudly (barge-in above AEC threshold)
                    if (isPlaying.get() && rms > 1500) {
                        triggerBargeIn()
                    }

                    val base64 = Base64.encodeToString(byteBuffer, 0, readCount * 2, Base64.NO_WRAP)
                    onAudioChunkCaptured?.invoke(base64)
                }
            }
        }
    }

    private fun startPlaybackLoop() {
        playbackJob = scope.launch {
            while (isActive && isRecording.get()) {
                val chunk = audioQueue.poll()
                if (chunk != null && chunk.isNotEmpty()) {
                    isPlaying.set(true)
                    audioTrack?.write(chunk, 0, chunk.size)
                } else {
                    if (audioQueue.isEmpty() && isPlaying.get()) {
                        isPlaying.set(false)
                        onStateChanged?.invoke("LISTENING")
                    }
                    kotlinx.coroutines.delay(10)
                }
            }
        }
    }

    /**
     * Enqueue incoming 24kHz PCM audio chunk for streaming playback
     */
    fun enqueueAudioChunk(base64Audio: String, generationId: Int) {
        if (generationId != currentGenerationId.get()) {
            return // Discard obsolete chunk from previous interrupted response
        }
        try {
            val bytes = Base64.decode(base64Audio, Base64.NO_WRAP)
            audioQueue.offer(bytes)
            isPlaying.set(true)
            onStateChanged?.invoke("SPEAKING")
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Instantly halt playback upon confirmed user interruption
     */
    fun triggerBargeIn() {
        currentGenerationId.incrementAndGet()
        audioQueue.clear()
        isPlaying.set(false)
        audioTrack?.pause()
        audioTrack?.flush()
        audioTrack?.play()
        onStateChanged?.invoke("INTERRUPTED")
        onBargeInDetected?.invoke()
    }

    /**
     * Clean up all audio hardware resources safely
     */
    fun stopLiveSession() {
        isRecording.set(false)
        isPlaying.set(false)
        recordJob?.cancel()
        playbackJob?.cancel()
        audioQueue.clear()

        try {
            audioRecord?.stop()
            audioRecord?.release()
        } catch (e: Exception) {}
        audioRecord = null

        try {
            aecEffect?.release()
            nsEffect?.release()
        } catch (e: Exception) {}
        aecEffect = null
        nsEffect = null

        try {
            audioTrack?.stop()
            audioTrack?.release()
        } catch (e: Exception) {}
        audioTrack = null

        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.mode = AudioManager.MODE_NORMAL
        onStateChanged?.invoke("CLOSED")
    }
}
