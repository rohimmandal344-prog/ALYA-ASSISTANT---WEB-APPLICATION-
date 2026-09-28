/**
 * Alya Assistant - useConversation Custom Hook
 * Manages active conversation sessions, real-time message sync with Firestore,
 * optimistic updates for ultra-low latency UI feedback, and automated title generation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  conversationService, 
  ConversationSession, 
  ChatMessage 
} from '../services/conversationService';
import { locationService } from '../lib/locationService';
import { userSettingsService } from '../lib/userSettingsService';

const ACTIVE_CONV_STORAGE_KEY = 'alya_active_conversation_id';

export function useConversation() {
  const { user } = useAuth();
  
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_CONV_STORAGE_KEY) || 'main';
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync activeConversationId to localStorage
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem(ACTIVE_CONV_STORAGE_KEY, activeConversationId);
    }
  }, [activeConversationId]);

  // Subscribe to user's conversation sessions
  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }

    const unsubscribe = conversationService.subscribeToConversations(
      user.uid,
      (list) => {
        setConversations(list);
        // If current active ID doesn't exist in list and list has items, fallback to first
        if (list.length > 0 && !list.some(c => c.id === activeConversationId) && activeConversationId !== 'main') {
          setActiveConversationId(list[0].id);
        }
      },
      (err) => setError('Failed to stream conversations from database.')
    );

    return () => unsubscribe();
  }, [user, activeConversationId]);

  // Subscribe to messages in the active conversation
  useEffect(() => {
    if (!user || !activeConversationId) {
      setMessages([]);
      return;
    }

    // Ensure session doc exists in Firestore
    conversationService.ensureConversationExists(user.uid, activeConversationId).catch(console.error);

    const unsubscribe = conversationService.subscribeToMessages(
      user.uid,
      activeConversationId,
      (msgs) => {
        setMessages(msgs);
      },
      (err) => setError('Failed to stream messages.')
    );

    return () => unsubscribe();
  }, [user, activeConversationId]);

  /**
   * Create a new conversation session and switch to it immediately.
   */
  const createNewConversation = useCallback(async (title: string = 'New Conversation') => {
    if (!user) return;
    try {
      const newId = await conversationService.createConversation(user.uid, title);
      setActiveConversationId(newId);
      setError(null);
      return newId;
    } catch (err: any) {
      console.error('Failed to create new conversation:', err);
      setError('Could not create new session.');
    }
  }, [user]);

  /**
   * Switch active conversation session.
   */
  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setError(null);
  }, []);

  /**
   * Rename an existing conversation.
   */
  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    if (!user || !title.trim()) return;
    try {
      await conversationService.updateConversationTitle(user.uid, conversationId, title.trim());
    } catch (err: any) {
      console.error('Failed to rename conversation:', err);
      setError('Failed to rename conversation.');
    }
  }, [user]);

  /**
   * Delete a conversation session.
   */
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    try {
      await conversationService.deleteConversation(user.uid, conversationId);
      if (activeConversationId === conversationId) {
        const remaining = conversations.filter(c => c.id !== conversationId);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          await createNewConversation();
        }
      }
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
      setError('Failed to delete conversation.');
    }
  }, [user, activeConversationId, conversations, createNewConversation]);

  /**
   * Delete all conversation sessions from database.
   */
  const clearAllConversations = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      await Promise.all(conversations.map(c => conversationService.deleteConversation(user.uid, c.id)));
      await createNewConversation('New Conversation');
    } catch (err: any) {
      console.error('Failed to clear all conversations:', err);
      setError('Failed to clear chat history.');
    }
  }, [user, conversations, createNewConversation]);

  /**
   * Send a message with ultra-low latency optimistic UI update,
   * automated Firestore persistence, and Alya Brain cognitive reasoning.
   */
  const sendMessage = useCallback(async (content: string) => {
    const text = content.trim();
    if (!text || !user || !activeConversationId) return;

    setError(null);
    setIsTyping(true);
    const startTime = performance.now();

    // 1. Optimistic Local Append for 0ms UI response
    const optimisticMessage: ChatMessage = {
      id: `opt-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: { toDate: () => new Date() },
      userId: user.uid,
      conversationId: activeConversationId
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      // 2. Persist user message to Firestore
      await conversationService.addMessage(user.uid, activeConversationId, {
        role: 'user',
        content: text,
        userId: user.uid,
        conversationId: activeConversationId
      });

      // 3. Auto-generate title if currently "New Conversation"
      const currentConv = conversations.find(c => c.id === activeConversationId);
      if (currentConv && (!currentConv.title || currentConv.title === 'New Conversation')) {
        const generatedTitle = text.length > 32 ? `${text.slice(0, 32).trim()}...` : text;
        conversationService.updateConversationTitle(user.uid, activeConversationId, generatedTitle).catch(console.warn);
      }

      // 4. Cancel any previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // 5. Check if query is location-sensitive (weather, nearby, time) and fetch location if permitted
      const lowerText = text.toLowerCase();
      const isLocationQuery = lowerText.includes('weather') || lowerText.includes('mausam') || 
                              lowerText.includes('rain') || lowerText.includes('barish') || 
                              lowerText.includes('temperature') || lowerText.includes('nearby') || 
                              lowerText.includes('near me') || lowerText.includes('hospital') ||
                              lowerText.includes('mere paas') || lowerText.includes('local time');
      
      let locationContext = locationService.getLastKnownLocation();
      const manualCity = locationService.getManualCity();

      if (isLocationQuery && !locationContext && locationService.getPermissionPreference() === 'auto') {
        try {
          const locRes = await locationService.getCurrentLocation(3000);
          if (locRes.success && locRes.context) {
            locationContext = locRes.context;
          }
        } catch {}
      }

      // 6. Call Alya Brain Pipeline with recent history and location context
      const currentPrefs = userSettingsService.getPreferences();
      const preferredLang = currentPrefs.language || 'auto';
      const recentContext = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/alya/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          text,
          source: 'web_chat',
          language: preferredLang,
          context: {
            recentMessages: recentContext,
            isOnline: true,
            location: locationContext,
            manualCity: currentPrefs.manualCity || manualCity
          }
        })
      });

      const latency = Math.round(performance.now() - startTime);
      setLastLatencyMs(latency);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server returned status ${response.status}: ${errText.slice(0, 100)}`);
      }

      const data = await response.json();
      const reply = data.reply || data.text || "I'm here with you.";

      // 6. Execute browser-supported actions in Web client
      if (data.suggestedAction) {
        if (data.suggestedAction.command === 'navigate_view') {
          const targetView = data.suggestedAction.params?.view || 'chat';
          window.dispatchEvent(new CustomEvent('alya:navigate', { detail: { view: targetView } }));
        } else if (data.suggestedAction.command === 'update_user_preference') {
          const { settingKey, settingValue } = data.suggestedAction.params || {};
          if (settingKey && settingValue) {
            userSettingsService.updatePreferences({ [settingKey]: settingValue }, 'conversational_command');
          }
        } else if (data.suggestedAction.command === 'web_open_url' && data.suggestedAction.params?.url) {
          try {
            window.open(data.suggestedAction.params.url, '_blank', 'noopener,noreferrer');
          } catch {}
        }
      }

      // 7. Persist assistant reply to Firestore with cognitive verification metadata
      await conversationService.addMessage(user.uid, activeConversationId, {
        role: 'assistant',
        content: reply,
        agentName: data.activeAgent?.name || 'Alya Core',
        intent: data.intent || 'conversation',
        verified: data.executionVerification?.verified ?? true,
        weatherData: data.weatherData,
        userId: user.uid,
        conversationId: activeConversationId
      });

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Chat error:', err);
      const isNetwork = err?.message?.includes('fetch') || err?.name === 'TypeError';
      setError(isNetwork ? 'Network connection momentary blip. Tap to retry.' : (err.message || 'Failed to complete thought.'));
    } finally {
      setIsTyping(false);
    }
  }, [user, activeConversationId, messages, conversations]);

  /**
   * Retry sending the last user message.
   */
  const retryLastMessage = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content);
    }
  }, [messages, sendMessage]);

  return {
    conversations,
    activeConversationId,
    messages,
    isTyping,
    error,
    lastLatencyMs,
    sendMessage,
    createNewConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    clearAllConversations,
    retryLastMessage
  };
}
