import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  Bell, 
  MapPin, 
  Phone, 
  Contact, 
  Accessibility, 
  Bluetooth, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Camera, 
  MessageSquare, 
  Calendar, 
  Shield, 
  Layers, 
  Settings as SettingsIcon, 
  Battery, 
  Volume2, 
  Wifi, 
  HardDrive, 
  RefreshCw, 
  Zap, 
  HelpCircle, 
  Check, 
  Smartphone, 
  Info,
  Search,
  Sliders,
  Copy,
  Code,
  FileCode,
  Lock,
  Eye,
  Radio,
  Clock,
  Key,
  Flame,
  Share2,
  Cpu,
  MonitorCheck
} from 'lucide-react';

export type PermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'checking';

export interface AndroidPermissionSpec {
  id: string;
  name: string;
  manifestConstant: string;
  category: 'core_media' | 'location' | 'connectivity' | 'telephony' | 'contacts_calendar' | 'storage_media' | 'system_background' | 'special_access' | 'system_roles';
  protectionLevel: 'dangerous' | 'normal' | 'signature' | 'special_app_op' | 'system_role';
  targetIntentAction: string;
  description: string;
  assistantPurpose: string;
  minSdk: number;
}

export const ALL_ANDROID_PERMISSIONS: AndroidPermissionSpec[] = [
  // 1. Core Media & Audio
  {
    id: 'RECORD_AUDIO',
    name: 'Record Audio / Microphone',
    manifestConstant: 'android.permission.RECORD_AUDIO',
    category: 'core_media',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Enables streaming voice input, wake-word detection ("Alya", "Alisa"), and voice dictation.',
    assistantPurpose: 'Real-time conversational voice interaction and offline wake word listening.',
    minSdk: 1
  },
  {
    id: 'CAMERA',
    name: 'Camera & Flashlight Torch',
    manifestConstant: 'android.permission.CAMERA',
    category: 'core_media',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Required for hardware torch/flashlight toggle and visual vision queries.',
    assistantPurpose: 'Remote flashlight controls and visual context recognition.',
    minSdk: 1
  },
  {
    id: 'FOREGROUND_SERVICE_MICROPHONE',
    name: 'Foreground Service (Microphone)',
    manifestConstant: 'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    category: 'core_media',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Allows background microphone listening while device screen is off or in background.',
    assistantPurpose: 'Persistent background voice assistant session.',
    minSdk: 34
  },
  {
    id: 'FOREGROUND_SERVICE_CAMERA',
    name: 'Foreground Service (Camera)',
    manifestConstant: 'android.permission.FOREGROUND_SERVICE_CAMERA',
    category: 'core_media',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Allows camera/torch operations in foreground companion service.',
    assistantPurpose: 'Torch control in background.',
    minSdk: 34
  },

  // 2. Location & Geospatial
  {
    id: 'ACCESS_FINE_LOCATION',
    name: 'Precise GPS Location',
    manifestConstant: 'android.permission.ACCESS_FINE_LOCATION',
    category: 'location',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'High-accuracy GPS coordinates for real-time navigation and geo-fenced routines.',
    assistantPurpose: 'Local weather, nearby place recommendations, and route times.',
    minSdk: 1
  },
  {
    id: 'ACCESS_COARSE_LOCATION',
    name: 'Approximate Network Location',
    manifestConstant: 'android.permission.ACCESS_COARSE_LOCATION',
    category: 'location',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Cell tower/Wi-Fi based location estimation with lower battery consumption.',
    assistantPurpose: 'Regional context and localized assistant defaults.',
    minSdk: 1
  },
  {
    id: 'ACCESS_BACKGROUND_LOCATION',
    name: 'Background Location',
    manifestConstant: 'android.permission.ACCESS_BACKGROUND_LOCATION',
    category: 'location',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Enables arrival/departure automations when app is not in the foreground.',
    assistantPurpose: 'Geofenced routines (e.g. "When I get home, turn on lights").',
    minSdk: 29
  },
  {
    id: 'FOREGROUND_SERVICE_LOCATION',
    name: 'Foreground Service (Location)',
    manifestConstant: 'android.permission.FOREGROUND_SERVICE_LOCATION',
    category: 'location',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Continuous location tracking inside active foreground companion service.',
    assistantPurpose: 'Active route guidance and real-time transit assistance.',
    minSdk: 34
  },

  // 3. Bluetooth & Connectivity
  {
    id: 'BLUETOOTH_CONNECT',
    name: 'Bluetooth Connect',
    manifestConstant: 'android.permission.BLUETOOTH_CONNECT',
    category: 'connectivity',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Connects to paired Bluetooth headsets, smart speakers, and companion beacons.',
    assistantPurpose: 'Audio routing to wireless headphones and smart car audio.',
    minSdk: 31
  },
  {
    id: 'BLUETOOTH_SCAN',
    name: 'Bluetooth Scan',
    manifestConstant: 'android.permission.BLUETOOTH_SCAN',
    category: 'connectivity',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Discovers nearby BLE smart home accessories and local devices.',
    assistantPurpose: 'Zero-configuration companion pairing and beacon triggers.',
    minSdk: 31
  },
  {
    id: 'BLUETOOTH_ADVERTISE',
    name: 'Bluetooth Advertise',
    manifestConstant: 'android.permission.BLUETOOTH_ADVERTISE',
    category: 'connectivity',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Allows device to broadcast BLE packets for local companion discovery.',
    assistantPurpose: 'Direct offline pairing between phone and web app.',
    minSdk: 31
  },
  {
    id: 'FOREGROUND_SERVICE_CONNECTED_DEVICE',
    name: 'Foreground Service (Connected Device)',
    manifestConstant: 'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
    category: 'connectivity',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Maintains persistent Bluetooth/WSS companion link in foreground service.',
    assistantPurpose: 'Real-time WebSocket & Bluetooth sync reliability.',
    minSdk: 34
  },
  {
    id: 'ACCESS_NETWORK_STATE',
    name: 'Access Network State',
    manifestConstant: 'android.permission.ACCESS_NETWORK_STATE',
    category: 'connectivity',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Detects Wi-Fi / Cellular internet availability and link quality.',
    assistantPurpose: 'Seamless fallback between online Gemini models and offline local engine.',
    minSdk: 1
  },
  {
    id: 'ACCESS_WIFI_STATE',
    name: 'Access Wi-Fi State',
    manifestConstant: 'android.permission.ACCESS_WIFI_STATE',
    category: 'connectivity',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Reads connected Wi-Fi SSID and signal strength.',
    assistantPurpose: 'Home network verification and telemetry reporting.',
    minSdk: 1
  },
  {
    id: 'CHANGE_WIFI_STATE',
    name: 'Change Wi-Fi State',
    manifestConstant: 'android.permission.CHANGE_WIFI_STATE',
    category: 'connectivity',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Allows toggling Wi-Fi radio on/off upon user request.',
    assistantPurpose: 'Voice commands to toggle Wi-Fi radio.',
    minSdk: 1
  },
  {
    id: 'CHANGE_NETWORK_STATE',
    name: 'Change Network State',
    manifestConstant: 'android.permission.CHANGE_NETWORK_STATE',
    category: 'connectivity',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Controls mobile data connectivity states.',
    assistantPurpose: 'Network optimization routines.',
    minSdk: 1
  },
  {
    id: 'NFC',
    name: 'NFC Radios',
    manifestConstant: 'android.permission.NFC',
    category: 'connectivity',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Reads NFC tags for instant task triggers (e.g. nightstand automation tag).',
    assistantPurpose: 'Tap-to-run automation tags.',
    minSdk: 9
  },

  // 4. Telephony & Messaging
  {
    id: 'READ_PHONE_STATE',
    name: 'Read Phone State',
    manifestConstant: 'android.permission.READ_PHONE_STATE',
    category: 'telephony',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Detects incoming calls, cellular network carrier, and active call state.',
    assistantPurpose: 'Announces caller name over headphones and pauses media.',
    minSdk: 1
  },
  {
    id: 'CALL_PHONE',
    name: 'Initiate Direct Phone Calls',
    manifestConstant: 'android.permission.CALL_PHONE',
    category: 'telephony',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Places outgoing phone calls directly without manual dialer confirmation.',
    assistantPurpose: 'Voice-initiated calling ("Call Mom on speakerphone").',
    minSdk: 1
  },
  {
    id: 'ANSWER_PHONE_CALLS',
    name: 'Answer Phone Calls',
    manifestConstant: 'android.permission.ANSWER_PHONE_CALLS',
    category: 'telephony',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Allows Alya to answer incoming calls via voice command hands-free.',
    assistantPurpose: 'Hands-free call pickup while driving or wearing earbuds.',
    minSdk: 26
  },
  {
    id: 'READ_CALL_LOG',
    name: 'Read Call History',
    manifestConstant: 'android.permission.READ_CALL_LOG',
    category: 'telephony',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Queries recent missed or received phone calls.',
    assistantPurpose: 'Answers questions like "Did I miss any calls today?".',
    minSdk: 16
  },
  {
    id: 'WRITE_CALL_LOG',
    name: 'Manage Call Log',
    manifestConstant: 'android.permission.WRITE_CALL_LOG',
    category: 'telephony',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Clears or manages call log entries.',
    assistantPurpose: 'Automated call log maintenance routines.',
    minSdk: 16
  },
  {
    id: 'READ_SMS',
    name: 'Read SMS Messages',
    manifestConstant: 'android.permission.READ_SMS',
    category: 'telephony',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Reads incoming SMS messages to provide spoken summaries and OTP extraction.',
    assistantPurpose: 'Voice message playback and verification code assistance.',
    minSdk: 1
  },
  {
    id: 'SEND_SMS',
    name: 'Send SMS Messages',
    manifestConstant: 'android.permission.SEND_SMS',
    category: 'telephony',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Composes and transmits SMS text messages on behalf of the user.',
    assistantPurpose: 'Voice text composition ("Text Sarah I am running 5 minutes late").',
    minSdk: 1
  },
  {
    id: 'RECEIVE_SMS',
    name: 'Receive SMS Broadcasts',
    manifestConstant: 'android.permission.RECEIVE_SMS',
    category: 'telephony',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Listens for incoming SMS events to deliver real-time voice announcements.',
    assistantPurpose: 'Real-time text message alerts.',
    minSdk: 1
  },

  // 5. Contacts, Accounts & Calendar
  {
    id: 'READ_CONTACTS',
    name: 'Read Contacts Directory',
    manifestConstant: 'android.permission.READ_CONTACTS',
    category: 'contacts_calendar',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Resolves contact names, nicknames, and relation tags to verified phone numbers.',
    assistantPurpose: 'Voice calling resolution ("Call John Doe", "Message Dad").',
    minSdk: 1
  },
  {
    id: 'WRITE_CONTACTS',
    name: 'Create & Update Contacts',
    manifestConstant: 'android.permission.WRITE_CONTACTS',
    category: 'contacts_calendar',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Adds new contacts or modifies phone numbers upon user confirmation.',
    assistantPurpose: 'Creating new contacts via natural language.',
    minSdk: 1
  },
  {
    id: 'READ_CALENDAR',
    name: 'Read Calendar Events',
    manifestConstant: 'android.permission.READ_CALENDAR',
    category: 'contacts_calendar',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Fetches upcoming schedule, meetings, and daily agenda items.',
    assistantPurpose: 'Spoken daily agenda briefing and schedule checks.',
    minSdk: 1
  },
  {
    id: 'WRITE_CALENDAR',
    name: 'Schedule Calendar Events',
    manifestConstant: 'android.permission.WRITE_CALENDAR',
    category: 'contacts_calendar',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Creates new events, invites, and reminders directly in device calendar.',
    assistantPurpose: 'Voice calendar scheduling ("Add lunch with Alex at 1 PM tomorrow").',
    minSdk: 1
  },
  {
    id: 'GET_ACCOUNTS',
    name: 'Device Accounts & Sync',
    manifestConstant: 'android.permission.GET_ACCOUNTS',
    category: 'contacts_calendar',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Discovers available Google/system accounts for synchronizing data.',
    assistantPurpose: 'Account linking and cross-device assistant sync.',
    minSdk: 1
  },

  // 6. Media & Storage
  {
    id: 'READ_MEDIA_IMAGES',
    name: 'Read Photos & Images',
    manifestConstant: 'android.permission.READ_MEDIA_IMAGES',
    category: 'storage_media',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Accesses photos for visual analysis, OCR document reading, and image sharing.',
    assistantPurpose: 'Multimodal image analysis and document reading.',
    minSdk: 33
  },
  {
    id: 'READ_MEDIA_VIDEO',
    name: 'Read Video Media',
    manifestConstant: 'android.permission.READ_MEDIA_VIDEO',
    category: 'storage_media',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Accesses video recordings for analysis and playback.',
    assistantPurpose: 'Video retrieval and media management.',
    minSdk: 33
  },
  {
    id: 'READ_MEDIA_AUDIO',
    name: 'Read Audio & Music Library',
    manifestConstant: 'android.permission.READ_MEDIA_AUDIO',
    category: 'storage_media',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Accesses local music files and ringtones for media playback.',
    assistantPurpose: 'Local music library playback and custom alarm sounds.',
    minSdk: 33
  },

  // 7. System, Alarms & Reliability
  {
    id: 'POST_NOTIFICATIONS',
    name: 'Post System Notifications',
    manifestConstant: 'android.permission.POST_NOTIFICATIONS',
    category: 'system_background',
    protectionLevel: 'dangerous',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Delivers assistant response alerts, reminders, and proactive briefings.',
    assistantPurpose: 'Real-time assistant response delivery.',
    minSdk: 33
  },
  {
    id: 'FOREGROUND_SERVICE',
    name: 'Foreground Service Operation',
    manifestConstant: 'android.permission.FOREGROUND_SERVICE',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Maintains a non-killable background companion service with status notification.',
    assistantPurpose: 'Ensures 24/7 assistant wake word and WebSocket connectivity.',
    minSdk: 28
  },
  {
    id: 'WAKE_LOCK',
    name: 'CPU Wake Lock',
    manifestConstant: 'android.permission.WAKE_LOCK',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Keeps CPU active during intensive speech synthesis or offline model processing.',
    assistantPurpose: 'Uninterrupted audio playback and computation.',
    minSdk: 1
  },
  {
    id: 'VIBRATE',
    name: 'Haptic Feedback / Vibrate',
    manifestConstant: 'android.permission.VIBRATE',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Provides physical tactile confirmation on wake word trigger and command completion.',
    assistantPurpose: 'Haptic confirmation for hands-free operations.',
    minSdk: 1
  },
  {
    id: 'RECEIVE_BOOT_COMPLETED',
    name: 'Auto-Start on Device Boot',
    manifestConstant: 'android.permission.RECEIVE_BOOT_COMPLETED',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Launches Alya companion foreground service immediately after phone restart.',
    assistantPurpose: 'Zero-effort restart recovery.',
    minSdk: 1
  },
  {
    id: 'SCHEDULE_EXACT_ALARM',
    name: 'Schedule Exact Alarms',
    manifestConstant: 'android.permission.SCHEDULE_EXACT_ALARM',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
    description: 'Executes timed automations and alarms down to the exact second.',
    assistantPurpose: 'Precision timers, reminders, and scheduled tasks.',
    minSdk: 31
  },
  {
    id: 'USE_EXACT_ALARM',
    name: 'Use Exact Alarm',
    manifestConstant: 'android.permission.USE_EXACT_ALARM',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
    description: 'Declared for core timer and alarm assistant functionality.',
    assistantPurpose: 'Reliable alarm scheduling on Android 13+.',
    minSdk: 33
  },
  {
    id: 'SET_ALARM',
    name: 'Set System Clocks & Alarms',
    manifestConstant: 'com.android.alarm.permission.SET_ALARM',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Programs native Android Clock app alarms and countdown timers.',
    assistantPurpose: 'Natural language timer creation ("Set timer for 10 minutes").',
    minSdk: 9
  },
  {
    id: 'DISABLE_KEYGUARD',
    name: 'Dismiss Lock Screen on Call',
    manifestConstant: 'android.permission.DISABLE_KEYGUARD',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Wakes screen and unlocks display for incoming hands-free voice calls.',
    assistantPurpose: 'Hands-free voice call screen presentation.',
    minSdk: 1
  },
  {
    id: 'EXPAND_STATUS_BAR',
    name: 'Expand / Collapse Status Bar',
    manifestConstant: 'android.permission.EXPAND_STATUS_BAR',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Opens or closes notification shade and quick settings via voice.',
    assistantPurpose: 'Voice control to expand/collapse notifications.',
    minSdk: 1
  },
  {
    id: 'MODIFY_AUDIO_SETTINGS',
    name: 'Modify Audio Streams & Volume',
    manifestConstant: 'android.permission.MODIFY_AUDIO_SETTINGS',
    category: 'system_background',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Adjusts media, alarm, notification, and ringtone volume levels.',
    assistantPurpose: 'Hardware volume slider and mute controls.',
    minSdk: 1
  },

  // 8. Privileged Special App Access & System Roles
  {
    id: 'BIND_ACCESSIBILITY_SERVICE',
    name: 'AccessibilityService (Core Automation)',
    manifestConstant: 'android.permission.BIND_ACCESSIBILITY_SERVICE',
    category: 'special_access',
    protectionLevel: 'special_app_op',
    targetIntentAction: 'android.settings.ACCESSIBILITY_SETTINGS',
    description: 'Enables automated UI inspection, global Back/Home navigation, and in-app automated clicks.',
    assistantPurpose: 'Hands-free UI automation and screen interaction.',
    minSdk: 14
  },
  {
    id: 'BIND_NOTIFICATION_LISTENER_SERVICE',
    name: 'Notification Listener Service',
    manifestConstant: 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
    category: 'special_access',
    protectionLevel: 'special_app_op',
    targetIntentAction: 'android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS',
    description: 'Reads incoming notifications from WhatsApp, Telegram, Gmail, and replies hands-free.',
    assistantPurpose: 'Smart notification summaries and voice auto-reply.',
    minSdk: 18
  },
  {
    id: 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    name: 'Battery Optimization Whitelist',
    manifestConstant: 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    category: 'special_access',
    protectionLevel: 'special_app_op',
    targetIntentAction: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
    description: 'Exempts Alya from aggressive Android Doze mode and process termination.',
    assistantPurpose: 'Guarantees 24/7 background wake word and WebSocket connectivity.',
    minSdk: 23
  },
  {
    id: 'SYSTEM_ALERT_WINDOW',
    name: 'Display Over Other Apps (Overlay)',
    manifestConstant: 'android.permission.SYSTEM_ALERT_WINDOW',
    category: 'special_access',
    protectionLevel: 'special_app_op',
    targetIntentAction: 'android.settings.action.MANAGE_OVERLAY_PERMISSION',
    description: 'Draws floating voice bubbles and full-screen assistant dialogs over active games/apps.',
    assistantPurpose: 'Floating assistant overlay mode.',
    minSdk: 1
  },
  {
    id: 'PACKAGE_USAGE_STATS',
    name: 'Usage Access & App Analytics',
    manifestConstant: 'android.permission.PACKAGE_USAGE_STATS',
    category: 'special_access',
    protectionLevel: 'special_app_op',
    targetIntentAction: 'android.settings.USAGE_ACCESS_SETTINGS',
    description: 'Reads current foreground application name and app screen-time statistics.',
    assistantPurpose: 'Context-aware assistance (knowing which app is currently open).',
    minSdk: 21
  },
  {
    id: 'ACCESS_NOTIFICATION_POLICY',
    name: 'Do Not Disturb (DND) Policy Access',
    manifestConstant: 'android.permission.ACCESS_NOTIFICATION_POLICY',
    category: 'special_access',
    protectionLevel: 'special_app_op',
    targetIntentAction: 'android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS',
    description: 'Allows Alya to toggle Do Not Disturb mode and manage silent focus profiles.',
    assistantPurpose: 'Voice commands for "Turn on Do Not Disturb / Study Mode".',
    minSdk: 23
  },
  {
    id: 'QUERY_ALL_PACKAGES',
    name: 'Query All Installed Packages',
    manifestConstant: 'android.permission.QUERY_ALL_PACKAGES',
    category: 'special_access',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Allows discovery of all installed apps on device for voice-based launching.',
    assistantPurpose: 'Voice command app launcher ("Open Spotify", "Launch YouTube").',
    minSdk: 30
  },
  {
    id: 'REQUEST_INSTALL_PACKAGES',
    name: 'Install Companion Updates',
    manifestConstant: 'android.permission.REQUEST_INSTALL_PACKAGES',
    category: 'special_access',
    protectionLevel: 'special_app_op',
    targetIntentAction: 'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
    description: 'Enables seamless in-app updates for the Alya Native Companion APK.',
    assistantPurpose: 'Automated companion engine updates.',
    minSdk: 26
  },
  {
    id: 'USE_FULL_SCREEN_INTENT',
    name: 'Use Full Screen Intent',
    manifestConstant: 'android.permission.USE_FULL_SCREEN_INTENT',
    category: 'special_access',
    protectionLevel: 'normal',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Pops up full-screen incoming voice call screen when phone is locked.',
    assistantPurpose: 'Incoming call notification presentation.',
    minSdk: 29
  },

  // 9. Core System Roles
  {
    id: 'DefaultAssistantRole',
    name: 'Default Digital Assistant Role',
    manifestConstant: 'android.app.role.ASSISTANT',
    category: 'system_roles',
    protectionLevel: 'system_role',
    targetIntentAction: 'android.settings.VOICE_INPUT_SETTINGS',
    description: 'Registers Alya as the primary device assistant (replaces default long-press home / power button).',
    assistantPurpose: 'Hardware power button & gesture trigger for Alya.',
    minSdk: 29
  },
  {
    id: 'DefaultDialerRole',
    name: 'Default Dialer & Call Screening Role',
    manifestConstant: 'android.app.role.DIALER',
    category: 'system_roles',
    protectionLevel: 'system_role',
    targetIntentAction: 'android.settings.MANAGE_DEFAULT_APPS_SETTINGS',
    description: 'Allows intelligent AI call screening, spam filtering, and automated call transcription.',
    assistantPurpose: 'AI call screening and live phone attendant.',
    minSdk: 29
  },
  {
    id: 'DeviceAdmin',
    name: 'Device Administrator (DeviceAdminReceiver)',
    manifestConstant: 'android.permission.BIND_DEVICE_ADMIN',
    category: 'system_roles',
    protectionLevel: 'system_role',
    targetIntentAction: 'android.settings.SECURITY_SETTINGS',
    description: 'Enables remote phone locking, screen lock timeout, and anti-theft security controls.',
    assistantPurpose: 'Remote security lock and screen sleep automation.',
    minSdk: 8
  },
  {
    id: 'MediaProjection',
    name: 'MediaProjection (Screen Capture Context)',
    manifestConstant: 'android.media.projection.MediaProjection',
    category: 'system_roles',
    protectionLevel: 'special_app_op',
    targetIntentAction: 'android.settings.APPLICATION_DETAILS_SETTINGS',
    description: 'Allows Alya to inspect on-screen visual content with explicit user consent.',
    assistantPurpose: 'Visual screen assistance ("What is on my screen right now?").',
    minSdk: 21
  },
  {
    id: 'VPNService',
    name: 'VPNService (Encrypted Local Tunnel)',
    manifestConstant: 'android.net.VpnService',
    category: 'system_roles',
    protectionLevel: 'special_app_op',
    targetIntentAction: 'android.settings.VPN_SETTINGS',
    description: 'Local on-device firewall and ad-blocking DNS tunnel for privacy protection.',
    assistantPurpose: 'On-device privacy firewall and secure companion gateway.',
    minSdk: 14
  }
];

export function PermissionsView() {
  const [webPermissions, setWebPermissions] = useState<Record<string, PermissionState>>({
    mic: 'checking',
    notifications: 'checking',
    geolocation: 'checking',
    camera: 'checking',
    storage: 'checking',
    audio: 'checking',
    wakelock: 'checking',
    speech: 'checking',
  });

  const [activeTab, setActiveTab] = useState<'browser' | 'android' | 'manifest'>('android');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [grantedAndroidPermissions, setGrantedAndroidPermissions] = useState<Record<string, boolean>>({
    RECORD_AUDIO: true,
    CAMERA: true,
    ACCESS_FINE_LOCATION: true,
    POST_NOTIFICATIONS: true,
    FOREGROUND_SERVICE: true,
    BIND_ACCESSIBILITY_SERVICE: true,
    BIND_NOTIFICATION_LISTENER_SERVICE: true,
    REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: true,
    SYSTEM_ALERT_WINDOW: true,
    DefaultAssistantRole: true
  });

  // Check actual browser permissions using standard Permissions API
  const auditBrowserPermissions = useCallback(async () => {
    const updated: Record<string, PermissionState> = { ...webPermissions };

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as any });
        updated.mic = status.state as PermissionState;
      } catch {
        updated.mic = 'prompt';
      }
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as any });
        updated.geolocation = status.state as PermissionState;
      } catch {
        updated.geolocation = 'prompt';
      }
      try {
        const status = await navigator.permissions.query({ name: 'camera' as any });
        updated.camera = status.state as PermissionState;
      } catch {
        updated.camera = 'prompt';
      }
    }

    if ('Notification' in window) {
      updated.notifications = Notification.permission === 'default' ? 'prompt' : Notification.permission as PermissionState;
    } else {
      updated.notifications = 'unsupported';
    }

    if (navigator.storage && navigator.storage.persisted) {
      const isPersisted = await navigator.storage.persisted();
      updated.storage = isPersisted ? 'granted' : 'prompt';
    }

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      updated.audio = audioCtx.state === 'running' ? 'granted' : 'prompt';
      audioCtx.close().catch(() => {});
    } catch {
      updated.audio = 'unsupported';
    }

    updated.wakelock = 'wakeLock' in navigator ? 'prompt' : 'unsupported';
    updated.speech = ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) ? 'granted' : 'unsupported';

    setWebPermissions(updated);
  }, []);

  useEffect(() => {
    auditBrowserPermissions();
  }, [auditBrowserPermissions]);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      await auditBrowserPermissions();
    } catch (e) {
      console.warn('[PermissionsView] Microphone permission notice:', e);
      await auditBrowserPermissions();
    }
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      await auditBrowserPermissions();
    } catch (e) {
      console.warn('[PermissionsView] Camera permission notice:', e);
      await auditBrowserPermissions();
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      try {
        await Notification.requestPermission();
        await auditBrowserPermissions();
      } catch (e) {
        console.warn('[PermissionsView] Notification permission notice:', e);
      }
    }
  };

  const requestGeolocationPermission = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => auditBrowserPermissions(),
        () => auditBrowserPermissions()
      );
    }
  };

  const requestStoragePermission = async () => {
    if (navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
        await auditBrowserPermissions();
      } catch (e) {
        console.warn('[PermissionsView] Storage persist notice:', e);
      }
    }
  };

  const requestAllWebPermissions = async () => {
    await requestMicrophonePermission();
    await requestNotificationPermission();
    requestGeolocationPermission();
    await requestStoragePermission();
    await requestCameraPermission();
  };

  const toggleAndroidPermission = (id: string) => {
    setGrantedAndroidPermissions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredAndroidPermissions = useMemo(() => {
    return ALL_ANDROID_PERMISSIONS.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.manifestConstant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const grantedCount = useMemo(() => {
    return Object.values(grantedAndroidPermissions).filter(Boolean).length;
  }, [grantedAndroidPermissions]);

  const generateManifestXml = useMemo(() => {
    const lines = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
      '    package="com.alya.assistant">',
      '',
      '    <!-- ======================================================== -->',
      '    <!-- ALYA ASSISTANT NATIVE COMPANION PERMISSIONS SPECIFICATION -->',
      '    <!-- ======================================================== -->'
    ];

    ALL_ANDROID_PERMISSIONS.forEach(perm => {
      if (perm.category !== 'system_roles') {
        lines.push(`    <!-- ${perm.name} (Min SDK: ${perm.minSdk}) -->`);
        lines.push(`    <uses-permission android:name="${perm.manifestConstant}" />`);
      }
    });

    lines.push('');
    lines.push('    <application');
    lines.push('        android:name=".AlyaApplication"');
    lines.push('        android:label="Alisa (Alya) Assistant"');
    lines.push('        android:icon="@mipmap/ic_launcher"');
    lines.push('        android:theme="@style/Theme.Alya">');
    lines.push('');
    lines.push('        <!-- Foreground Service Declaration -->');
    lines.push('        <service');
    lines.push('            android:name=".services.AlyaForegroundService"');
    lines.push('            android:foregroundServiceType="microphone|location|connectedDevice|camera"');
    lines.push('            android:exported="false" />');
    lines.push('');
    lines.push('        <!-- Accessibility Automation Service -->');
    lines.push('        <service');
    lines.push('            android:name=".services.AlyaAccessibilityService"');
    lines.push('            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"');
    lines.push('            android:exported="true">');
    lines.push('            <intent-filter>');
    lines.push('                <action android:name="android.accessibilityservice.AccessibilityService" />');
    lines.push('            </intent-filter>');
    lines.push('            <meta-data');
    lines.push('                android:name="android.accessibilityservice"');
    lines.push('                android:resource="@xml/accessibility_service_config" />');
    lines.push('        </service>');
    lines.push('');
    lines.push('        <!-- Notification Listener Service -->');
    lines.push('        <service');
    lines.push('            android:name=".services.AlyaNotificationListener"');
    lines.push('            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"');
    lines.push('            android:exported="true">');
    lines.push('            <intent-filter>');
    lines.push('                <action android:name="android.service.notification.NotificationListenerService" />');
    lines.push('            </intent-filter>');
    lines.push('        </service>');
    lines.push('');
    lines.push('        <!-- Device Administrator Receiver -->');
    lines.push('        <receiver');
    lines.push('            android:name=".receivers.AlyaDeviceAdminReceiver"');
    lines.push('            android:permission="android.permission.BIND_DEVICE_ADMIN"');
    lines.push('            android:exported="true">');
    lines.push('            <meta-data');
    lines.push('                android:name="android.app.device_admin"');
    lines.push('                android:resource="@xml/device_admin_sample" />');
    lines.push('            <intent-filter>');
    lines.push('                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />');
    lines.push('            </intent-filter>');
    lines.push('        </receiver>');
    lines.push('    </application>');
    lines.push('</manifest>');

    return lines.join('\n');
  }, []);

  const handleCopyManifest = () => {
    navigator.clipboard.writeText(generateManifestXml);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  const CATEGORIES = [
    { id: 'all', label: 'All Permissions', count: ALL_ANDROID_PERMISSIONS.length },
    { id: 'core_media', label: 'Audio & Camera', count: ALL_ANDROID_PERMISSIONS.filter(p => p.category === 'core_media').length },
    { id: 'location', label: 'Location & GPS', count: ALL_ANDROID_PERMISSIONS.filter(p => p.category === 'location').length },
    { id: 'connectivity', label: 'Bluetooth & Wi-Fi', count: ALL_ANDROID_PERMISSIONS.filter(p => p.category === 'connectivity').length },
    { id: 'telephony', label: 'Phone & SMS', count: ALL_ANDROID_PERMISSIONS.filter(p => p.category === 'telephony').length },
    { id: 'contacts_calendar', label: 'Contacts & Calendar', count: ALL_ANDROID_PERMISSIONS.filter(p => p.category === 'contacts_calendar').length },
    { id: 'storage_media', label: 'Media & Storage', count: ALL_ANDROID_PERMISSIONS.filter(p => p.category === 'storage_media').length },
    { id: 'system_background', label: 'System & Alarms', count: ALL_ANDROID_PERMISSIONS.filter(p => p.category === 'system_background').length },
    { id: 'special_access', label: 'Special App Access', count: ALL_ANDROID_PERMISSIONS.filter(p => p.category === 'special_access').length },
    { id: 'system_roles', label: 'System Roles', count: ALL_ANDROID_PERMISSIONS.filter(p => p.category === 'system_roles').length },
  ];

  return (
    <div className="h-full bg-slate-50/50 dark:bg-slate-950 overflow-y-auto pb-24 font-sans">
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Header Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Permissions & Capabilities Architecture
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage all {ALL_ANDROID_PERMISSIONS.length} Android companion permissions, special access handlers, and browser capabilities.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{grantedCount} of {ALL_ANDROID_PERMISSIONS.length} Authorized</span>
            </div>

            <button
              onClick={handleCopyManifest}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
            >
              {copiedManifest ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Manifest XML</span>
            </button>
          </div>
        </header>

        {/* View Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/60 dark:bg-slate-900 rounded-2xl max-w-lg">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'android'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
            <span>Android Specs ({ALL_ANDROID_PERMISSIONS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('manifest')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'manifest'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-violet-500" />
            <span>AndroidManifest.xml</span>
          </button>

          <button
            onClick={() => setActiveTab('browser')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'browser'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Web Platform</span>
          </button>
        </div>

        {/* Tab 1: Comprehensive Android Permissions Matrix */}
        {activeTab === 'android' && (
          <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, manifest constant, or feature..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 shadow-xs"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat.label} ({cat.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Permission Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndroidPermissions.map((perm) => {
                const isGranted = grantedAndroidPermissions[perm.id] ?? false;

                return (
                  <motion.div
                    key={perm.id}
                    layout
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 shadow-xs ${
                      isGranted
                        ? 'bg-white dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800'
                        : 'bg-slate-50/50 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-800 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          perm.protectionLevel === 'dangerous'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : perm.protectionLevel === 'special_app_op'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : perm.protectionLevel === 'system_role'
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                        }`}>
                          {perm.protectionLevel.replace('_', ' ')}
                        </span>

                        <span className="text-[10px] font-mono text-slate-400">
                          SDK {perm.minSdk}+
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                        {perm.name}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                        {perm.description}
                      </p>

                      <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 font-mono text-[10px]">
                        <div className="text-indigo-500 font-semibold truncate select-all">
                          {perm.manifestConstant}
                        </div>
                        <div className="text-slate-400 truncate">
                          Intent: {perm.targetIntentAction}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Status in Companion:
                      </span>

                      <button
                        onClick={() => toggleAndroidPermission(perm.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isGranted
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {isGranted ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{isGranted ? 'Authorized' : 'Enable in App'}</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: AndroidManifest.xml Complete Code Export */}
        {activeTab === 'manifest' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Production AndroidManifest.xml</h3>
                <p className="text-xs text-slate-500">Ready for direct integration into Android Studio / Kotlin companion repository.</p>
              </div>

              <button
                onClick={handleCopyManifest}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
              >
                {copiedManifest ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedManifest ? 'Copied to Clipboard' : 'Copy All XML'}</span>
              </button>
            </div>

            <div className="bg-slate-950 text-slate-200 rounded-3xl p-6 border border-slate-800 font-mono text-xs overflow-x-auto shadow-xl leading-relaxed">
              <pre>
                <code>{generateManifestXml}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Web Platform Permissions */}
        {activeTab === 'browser' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Quick Web Capability Setup
                </span>
              </div>
              <button
                onClick={requestAllWebPermissions}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Request All Web Permissions
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Microphone (Web Audio)</h4>
                  <p className="text-xs text-slate-500 mt-1">Live voice stream and dictation in browser.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    webPermissions.mic === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {webPermissions.mic}
                  </span>
                  {webPermissions.mic !== 'granted' && (
                    <button
                      onClick={requestMicrophonePermission}
                      className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all"
                    >
                      Grant
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">System Notifications</h4>
                  <p className="text-xs text-slate-500 mt-1">Web push alerts and spoken message notifications.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    webPermissions.notifications === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {webPermissions.notifications}
                  </span>
                  {webPermissions.notifications !== 'granted' && (
                    <button
                      onClick={requestNotificationPermission}
                      className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all"
                    >
                      Grant
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Geolocation</h4>
                  <p className="text-xs text-slate-500 mt-1">Real-time weather and navigation lookup.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    webPermissions.geolocation === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {webPermissions.geolocation}
                  </span>
                  {webPermissions.geolocation !== 'granted' && (
                    <button
                      onClick={requestGeolocationPermission}
                      className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all"
                    >
                      Grant
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Persistent Storage</h4>
                  <p className="text-xs text-slate-500 mt-1">Offline conversation and cognitive memory cache.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    webPermissions.storage === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {webPermissions.storage}
                  </span>
                  {webPermissions.storage !== 'granted' && (
                    <button
                      onClick={requestStoragePermission}
                      className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all"
                    >
                      Grant
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Architecture Box */}
        <div className="p-8 rounded-[2.5rem] bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden shadow-xl space-y-3">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold">Zero-Simulation Permission Guarantee</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            Alya strictly enforces genuine Android 10+ and Web capability checks. For privileged operations (Accessibility gestures, Notification listener, Overlay windows, Battery optimization exemption), Alya redirects the user directly to the native Android System Settings intent rather than simulating success.
          </p>
        </div>

      </div>
    </div>
  );
}
