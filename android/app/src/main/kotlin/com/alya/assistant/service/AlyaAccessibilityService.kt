package com.alya.assistant.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * AlyaAccessibilityService
 * Provides authorized accessibility automation on Android 10+ devices.
 * Enables Alya to execute user-requested gestures, click navigation targets,
 * press home/back buttons, and automate accessibility interactions.
 */
class AlyaAccessibilityService : AccessibilityService() {

    companion object {
        var instance: AlyaAccessibilityService? = null
            private set

        val isServiceRunning: Boolean
            get() = instance != null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Handle accessibility events if needed for context-aware UI automations
    }

    override fun onInterrupt() {
        // Handle interruption
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    /**
     * Perform global navigation action (Home, Back, Recents, Notifications)
     */
    fun performGlobal(action: Int): Boolean {
        return performGlobalAction(action)
    }

    /**
     * Perform a tap gesture at coordinate (x, y)
     */
    fun performClick(x: Float, y: Float, callback: ((Boolean) -> Unit)? = null) {
        val clickPath = Path().apply {
            moveTo(x, y)
        }
        val stroke = GestureDescription.StrokeDescription(clickPath, 0, 50)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                callback?.invoke(true)
            }
            override fun onCancelled(gestureDescription: GestureDescription?) {
                callback?.invoke(false)
            }
        }, null)
    }

    /**
     * Find and click a node by text or content description
     */
    fun clickNodeByText(text: String): Boolean {
        val rootNode = rootInActiveWindow ?: return false
        val nodes = rootNode.findAccessibilityNodeInfosByText(text)
        for (node in nodes) {
            if (node.isClickable) {
                return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            // Check parent clickable
            var parent = node.parent
            while (parent != null) {
                if (parent.isClickable) {
                    return parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                }
                parent = parent.parent
            }
        }
        return false
    }
}
