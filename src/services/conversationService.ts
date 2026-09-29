/**
 * Alya Assistant - Firestore Conversation Service Module
 * Re-exports and wraps Firestore CRUD operations from lib/db.ts for conversations and messages.
 */

export * from '../lib/db';
import {
  ChatSession,
  ChatMessage,
  createChatSession,
  ensureChatSession,
  subscribeChatSessions,
  updateChatSession,
  deleteChatSession,
  addChatMessage,
  subscribeChatMessageHistory,
  getChatMessageHistory,
  clearChatMessageHistory
} from '../lib/db';

export type ConversationSession = ChatSession;

export const conversationService = {
  createConversation: (userId: string, title?: string, customId?: string) => 
    createChatSession(userId, title, customId),
    
  ensureConversationExists: (userId: string, conversationId: string) => 
    ensureChatSession(userId, conversationId),
    
  subscribeToConversations: (userId: string, callback: (convs: ChatSession[]) => void, onError?: (err: Error) => void) =>
    subscribeChatSessions(userId, callback, onError),
    
  updateConversationTitle: (userId: string, conversationId: string, title: string) =>
    updateChatSession(userId, conversationId, { title }),
    
  deleteConversation: (userId: string, conversationId: string) =>
    deleteChatSession(userId, conversationId),
    
  subscribeToMessages: (userId: string, conversationId: string, callback: (msgs: ChatMessage[]) => void, onError?: (err: Error) => void) =>
    subscribeChatMessageHistory(userId, conversationId, callback, onError),
    
  addMessage: (userId: string, conversationId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>, customMessageId?: string) =>
    addChatMessage(userId, conversationId, message, customMessageId),
    
  getMessageHistory: (userId: string, conversationId: string, limitCount?: number) =>
    getChatMessageHistory(userId, conversationId, limitCount),
    
  clearMessageHistory: (userId: string, conversationId: string) =>
    clearChatMessageHistory(userId, conversationId)
};
