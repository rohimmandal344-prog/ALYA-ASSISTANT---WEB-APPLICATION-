package com.alya.assistant.network

import android.content.Context
import android.util.Log
import com.alya.assistant.controller.DeviceController
import okhttp3.*
import okio.ByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class WebSocketManager(
    private val deviceId: String,
    private val userId: String,
    private val controller: DeviceController
) {
    private var client: OkHttpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private var webSocket: WebSocket? = null

    companion object {
        @Volatile
        private var INSTANCE: WebSocketManager? = null

        fun getInstance(context: Context): WebSocketManager {
            return INSTANCE ?: synchronized(this) {
                val current = INSTANCE
                if (current != null) {
                    current
                } else {
                    val prefs = context.getSharedPreferences("alya_user_preferences_v1", Context.MODE_PRIVATE)
                    var devId = prefs.getString("device_id", null)
                    if (devId == null) {
                        devId = java.util.UUID.randomUUID().toString()
                        prefs.edit().putString("device_id", devId).apply()
                    }
                    val usrId = prefs.getString("user_id", "default_android_user") ?: "default_android_user"
                    val ctrl = DeviceController(context.applicationContext)
                    val manager = WebSocketManager(devId, usrId, ctrl)
                    INSTANCE = manager
                    manager
                }
            }
        }
    }

    fun connect() {
        val url = "wss://ais-dev-vyn7gzvpy2j2omgwzrlwq5-887422690979.asia-southeast1.run.app/ws"
        connect(url)
    }

    fun connect(serverUrl: String) {
        val url = "$serverUrl?deviceId=$deviceId&userId=$userId"
        val request = Request.Builder().url(url).build()
        
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("AlyaWS", "Connected to backend")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val data = JSONObject(text)
                    val msgType = data.optString("type")

                    // Real-time RTT Diagnostics: Measure end-to-end latency with web dashboard
                    if (msgType == "COMPANION_PING") {
                        val pingId = data.optString("pingId", "")
                        val clientSentAt = data.optLong("clientSentAt", 0L)
                        val serverSentAt = data.optLong("serverSentAt", System.currentTimeMillis())
                        val pong = JSONObject().apply {
                            put("type", "COMPANION_PONG")
                            put("pingId", pingId)
                            put("clientSentAt", clientSentAt)
                            put("serverSentAt", serverSentAt)
                            put("companionRepliedAt", System.currentTimeMillis())
                        }
                        webSocket.send(pong.toString())
                        return
                    }

                    if (msgType == "COMMAND") {
                        val commandId = data.getString("id")
                        val action = data.getString("command")
                        val params = data.optJSONObject("params")?.let { jsonToMap(it) }
                        
                        val result = controller.executeAction(action, params)
                        
                        // Send result back
                        val responseJson = JSONObject().apply {
                            put("type", "COMMAND_RESULT")
                            put("id", commandId)
                            put("status", if (result.startsWith("FAILURE")) "failure" else "success")
                            put("result", result)
                        }
                        webSocket.send(responseJson.toString())
                    }
                } catch (e: Exception) {
                    Log.e("AlyaWS", "Message handle error", e)
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("AlyaWS", "Disconnected: $reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("AlyaWS", "Connection failure", t)
                // Implement exponential backoff retry here
            }
        })
    }

    private fun jsonToMap(json: JSONObject): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            map[key] = json.get(key)
        }
        return map
    }
}
