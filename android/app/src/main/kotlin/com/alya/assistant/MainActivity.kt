package com.alya.assistant

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.alya.assistant.ui.theme.AlyaTheme
import com.alya.assistant.service.AlyaForegroundService

class MainActivity : ComponentActivity() {

    private val requiredPermissions = mutableListOf(
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.READ_CONTACTS,
        Manifest.permission.WRITE_CONTACTS,
        Manifest.permission.CALL_PHONE,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.READ_CALL_LOG,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.CAMERA,
        Manifest.permission.READ_SMS,
        Manifest.permission.SEND_SMS,
        Manifest.permission.READ_CALENDAR,
        Manifest.permission.WRITE_CALENDAR
    ).apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
            add(Manifest.permission.READ_MEDIA_IMAGES)
            add(Manifest.permission.READ_MEDIA_VIDEO)
            add(Manifest.permission.READ_MEDIA_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            add(Manifest.permission.BLUETOOTH_CONNECT)
            add(Manifest.permission.BLUETOOTH_SCAN)
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        // Refresh UI state
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val serviceIntent = Intent(this, AlyaForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        setContent {
            AlyaTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    PermissionManagerScreen(
                        permissions = requiredPermissions,
                        onGrantStandard = { permissionLauncher.launch(requiredPermissions.toTypedArray()) },
                        onOpenSettings = { action ->
                            val intent = Intent(action).apply {
                                data = Uri.fromParts("package", packageName, null)
                                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                            }
                            startActivity(intent)
                        },
                        onOpenAccessibility = {
                            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun PermissionManagerScreen(
    permissions: List<String>,
    onGrantStandard: () -> Unit,
    onOpenSettings: (String) -> Unit,
    onOpenAccessibility: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "Security & Capabilities",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                text = "Alya Ai Assistant requires high-level access to provide JARVIS-style device control.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onGrantStandard,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Grant All Standard Permissions")
            }
        }

        item {
            Text(
                text = "Special Access",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = 16.dp)
            )
        }

        items(listOf(
            SpecialPermissionData("Accessibility Service", "Critical for remote UI control.", onOpenAccessibility),
            SpecialPermissionData("Overlay Permission", "Show Alya over other apps.", { onOpenSettings(Settings.ACTION_MANAGE_OVERLAY_PERMISSION) }),
            SpecialPermissionData("Write Settings", "Modify brightness and volume.", { onOpenSettings(Settings.ACTION_MANAGE_WRITE_SETTINGS) }),
            SpecialPermissionData("Ignore Battery Optimization", "Prevent background termination.", { onOpenSettings(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) })
        )) { item ->
            PermissionCard(item.title, item.description, item.onAction)
        }
    }
}

data class SpecialPermissionData(val title: String, val description: String, val onAction: () -> Unit)

@Composable
fun PermissionCard(title: String, description: String, onAction: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = MaterialTheme.typography.titleSmall)
                Text(
                    text = description,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = onAction) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = "Grant",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
