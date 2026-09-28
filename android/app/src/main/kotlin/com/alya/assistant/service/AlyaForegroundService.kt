package com.alya.assistant.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.alya.assistant.MainActivity
import com.alya.assistant.network.WebSocketManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * AlyaForegroundService
 * Ensures continuous assistant operation, maintains active WebSocket connection
 * with Alya Assistant Cloud, listens for live wake words, and handles real-time device control commands.
 */
class AlyaForegroundService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var wakeLock: PowerManager.WakeLock? = null
    private var webSocketManager: WebSocketManager? = null

    companion object {
        const val CHANNEL_ID = "alya_foreground_service_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"

        fun startService(context: Context) {
            val intent = Intent(context, AlyaForegroundService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, AlyaForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireWakeLock()
        webSocketManager = WebSocketManager.getInstance(applicationContext)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val notification = buildForegroundNotification("Alya Assistant is active and connected")
                startForeground(NOTIFICATION_ID, notification)
                serviceScope.launch {
                    webSocketManager?.connect()
                }
            }
            ACTION_STOP -> {
                stopForeground(true)
                stopSelf()
            }
            else -> {
                val notification = buildForegroundNotification("Alya Assistant running in background")
                startForeground(NOTIFICATION_ID, notification)
            }
        }
        return START_STICKY
    }

    private fun buildForegroundNotification(statusText: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Alya Assistant Companion")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Alya Assistant Service Channel",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps Alya Assistant active for live voice commands and device automations"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AlyaAssistant:ForegroundWakeLock").apply {
            setReferenceCounted(false)
            acquire(10 * 60 * 1000L) // 10 minutes timeout per acquire cycle
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {
            // Ignore release exceptions
        }
    }
}
