package com.alya.assistant.controller

import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import android.provider.Settings
import com.alya.assistant.MainActivity
import com.alya.assistant.service.AlyaAccessibilityService

class DeviceController(private val context: Context) {

    fun executeAction(command: String, params: Map<String, Any>?): String {
        val cmd = command.trim().uppercase()
        return when {
            cmd == "HOME" -> goHome()
            cmd == "BACK" -> goBack()
            cmd in listOf("FLASHLIGHT", "DEVICE_FLASHLIGHT", "TORCH") -> {
                val state = params?.get("state") as? Boolean 
                    ?: params?.get("enabled") as? Boolean 
                    ?: true
                toggleFlashlight(state)
            }
            cmd in listOf("VOLUME", "DEVICE_VOLUME") -> {
                val level = (params?.get("level") as? Number)?.toInt() ?: 50
                val action = params?.get("action") as? String
                when (action) {
                    "decrease", "down", "lower" -> adjustVolume(AudioManager.ADJUST_LOWER)
                    "increase", "up", "raise" -> adjustVolume(AudioManager.ADJUST_RAISE)
                    else -> setVolume(level)
                }
            }
            cmd in listOf("BATTERY", "DEVICE_BATTERY") -> getBatteryInfo()
            cmd in listOf("LOCATION", "GET_LOCATION", "DEVICE_LOCATION") -> getLocation()
            cmd in listOf("OPEN_APP", "DEVICE_APP_LAUNCH", "APP_LAUNCH") -> {
                val appName = (params?.get("appName") as? String) 
                    ?: (params?.get("packageName") as? String) 
                    ?: ""
                openAppByNameOrPackage(appName)
            }
            cmd in listOf("SETTINGS", "DEVICE_SETTING_CONTROL", "OPEN_SETTINGS") -> {
                val setting = (params?.get("setting") as? String)?.lowercase() ?: ""
                openSpecificSettings(setting)
            }
            cmd in listOf("NAVIGATE_CHAT", "WAPAS_CHAT", "BACK_TO_CHAT", "BRING_TO_FRONT") -> {
                bringAlyaToForeground()
            }
            else -> "UNKNOWN_COMMAND: $command"
        }
    }

    private fun goHome(): String {
        return try {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            "SUCCESS"
        } catch (e: Exception) {
            "FAILURE: ${e.message}"
        }
    }

    private fun goBack(): String {
        return try {
            AlyaAccessibilityService.instance?.performGlobalAction(
                android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK
            )
            "SUCCESS"
        } catch (e: Exception) {
            "FAILURE: ${e.message}"
        }
    }

    private fun bringAlyaToForeground(): String {
        return try {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            }
            context.startActivity(intent)
            "SUCCESS: Returned to Alya Assistant chat"
        } catch (e: Exception) {
            "FAILURE: ${e.message}"
        }
    }

    private fun toggleFlashlight(enabled: Boolean): String {
        val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        return try {
            val cameraId = cameraManager.cameraIdList.firstOrNull() ?: return "FAILURE: No camera flashlight found"
            cameraManager.setTorchMode(cameraId, enabled)
            if (enabled) "SUCCESS: Flashlight turned on" else "SUCCESS: Flashlight turned off"
        } catch (e: Exception) {
            "FAILURE: ${e.message}"
        }
    }

    private fun setVolume(level: Int): String {
        return try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val clampedLevel = level.coerceIn(0, 100)
            val targetVolume = ((clampedLevel / 100.0) * maxVolume).toInt()
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVolume, AudioManager.FLAG_SHOW_UI)
            "SUCCESS: Volume set to $clampedLevel%"
        } catch (e: Exception) {
            "FAILURE: ${e.message}"
        }
    }

    private fun adjustVolume(direction: Int): String {
        return try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, AudioManager.FLAG_SHOW_UI)
            val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val pct = ((current.toDouble() / max) * 100).toInt()
            "SUCCESS: Volume adjusted to $pct%"
        } catch (e: Exception) {
            "FAILURE: ${e.message}"
        }
    }

    private fun getBatteryInfo(): String {
        return try {
            val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            val level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            val isCharging = batteryManager.isCharging
            "SUCCESS: Battery at $level%${if (isCharging) " (Charging)" else ""}"
        } catch (e: Exception) {
            "FAILURE: ${e.message}"
        }
    }

    private fun getLocation(): String {
        return try {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
                ?: return "FAILURE: LocationManager unavailable on device"

            val hasFine = androidx.core.content.ContextCompat.checkSelfPermission(
                context, android.Manifest.permission.ACCESS_FINE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED

            val hasCoarse = androidx.core.content.ContextCompat.checkSelfPermission(
                context, android.Manifest.permission.ACCESS_COARSE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED

            if (!hasFine && !hasCoarse) {
                return "PERMISSION_DENIED: Location permission not granted by user"
            }

            val provider = when {
                hasFine && locationManager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) ->
                    android.location.LocationManager.GPS_PROVIDER
                hasCoarse && locationManager.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER) ->
                    android.location.LocationManager.NETWORK_PROVIDER
                else -> android.location.LocationManager.PASSIVE_PROVIDER
            }

            @Suppress("MissingPermission")
            val loc = locationManager.getLastKnownLocation(provider)
            if (loc != null) {
                "SUCCESS: LAT=${loc.latitude}, LON=${loc.longitude}, ACC=${loc.accuracy}m"
            } else {
                "FAILURE: No active GPS/Network fix available"
            }
        } catch (e: Exception) {
            "FAILURE: ${e.message}"
        }
    }

    private fun openAppByNameOrPackage(appNameOrPkg: String): String {
        val query = appNameOrPkg.trim().lowercase()
        if (query.isEmpty()) return "FAILURE: Empty application name provided"

        // Handle direct common apps
        val targetPackage = when {
            query.contains("youtube") -> "com.google.android.youtube"
            query.contains("chrome") -> "com.android.chrome"
            query.contains("whatsapp") -> "com.whatsapp"
            query.contains("spotify") -> "com.spotify.music"
            query.contains("settings") -> {
                return openSpecificSettings("")
            }
            query.contains("camera") -> {
                return try {
                    val intent = Intent("android.media.action.IMAGE_CAPTURE").apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                    "SUCCESS: Opened Camera"
                } catch (e: Exception) {
                    "FAILURE: Could not open Camera"
                }
            }
            query.contains("map") -> "com.google.android.apps.maps"
            query.contains("gmail") -> "com.google.android.gm"
            query.contains("instagram") -> "com.instagram.android"
            else -> query
        }

        // Try direct launch intent
        val pm = context.packageManager
        val launchIntent = pm.getLaunchIntentForPackage(targetPackage)
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(launchIntent)
            return "SUCCESS: Opened $appNameOrPkg"
        }

        // Fuzzy search installed applications by label
        try {
            val apps = pm.getInstalledApplications(0)
            for (app in apps) {
                val label = pm.getApplicationLabel(app).toString().lowercase()
                if (label.contains(query) || query.contains(label)) {
                    val intent = pm.getLaunchIntentForPackage(app.packageName)
                    if (intent != null) {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(intent)
                        return "SUCCESS: Opened ${pm.getApplicationLabel(app)}"
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore search errors
        }

        // Browser fallback for web services like YouTube if native app not installed
        if (query.contains("youtube")) {
            return try {
                val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com")).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(webIntent)
                "SUCCESS: Opened YouTube in browser"
            } catch (e: Exception) {
                "FAILURE: App $appNameOrPkg not installed"
            }
        }

        return "FAILURE: Application '$appNameOrPkg' is not installed or cannot be opened"
    }

    private fun openSpecificSettings(setting: String): String {
        return try {
            val action = when (setting.lowercase()) {
                "wifi", "wi-fi" -> Settings.ACTION_WIFI_SETTINGS
                "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
                "display", "brightness" -> Settings.ACTION_DISPLAY_SETTINGS
                "sound", "volume" -> Settings.ACTION_SOUND_SETTINGS
                "apps", "application" -> Settings.ACTION_APPLICATION_SETTINGS
                "accessibility" -> Settings.ACTION_ACCESSIBILITY_SETTINGS
                else -> Settings.ACTION_SETTINGS
            }
            val intent = Intent(action).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            "SUCCESS: Opened Android Settings"
        } catch (e: Exception) {
            "FAILURE: ${e.message}"
        }
    }
}
