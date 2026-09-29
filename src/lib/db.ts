/**
 * Alya Assistant - Firestore Database Service Module (`lib/db.ts`)
 * Provides high-performance, real-time CRUD operations for chat sessions and persistent message history.
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc, 
  deleteDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  serverTimestamp, 
  orderBy,
  limit,
  writeBatch,
  Unsubscribe 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { v4 as uuidv4 } from 'uuid';

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: any;
  userId: string;
  conversationId: string;
  status?: 'pending' | 'sending' | 'sent' | 'failed' | 'retrying';
  agentName?: string;
  intent?: string;
  verified?: boolean;
  weatherData?: {
    locationName: string;
    temperature: number;
    feelsLike: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    rainProbability?: number;
    maxTemp?: number;
    minTemp?: number;
    sunrise?: string;
    sunset?: string;
    timezone?: string;
    source?: string;
    retrievedAt?: string;
    isUserGPS?: boolean;
    tomorrow?: {
      condition: string;
      minTemp: number;
      maxTemp: number;
      rainProbability: number;
    };
  };
  commandExecution?: {
    status: 'pending' | 'success' | 'failure';
    deviceId: string;
    result?: string;
    error?: string;
  };
}

// ---------------------------------------------------------------------------
// SKILL MANDATED ERROR HANDLING
// ---------------------------------------------------------------------------

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Recursively cleans objects and arrays to remove undefined properties before writing to Firestore,
 * preserving special Firestore object instances like FieldValue and Timestamp.
 */
export function sanitizeFirestoreData<T = any>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeFirestoreData(item)) as any;
  }
  if (data && typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    const isPlain = proto === null || proto === Object.prototype;
    if (!isPlain) {
      return data;
    }
    
    const cleaned: any = {};
    for (const key of Object.keys(data)) {
      const val = (data as any)[key];
      if (val !== undefined) {
        cleaned[key] = sanitizeFirestoreData(val);
      }
    }
    return cleaned;
  }
  return data;
}

// ---------------------------------------------------------------------------
// CHAT SESSIONS CRUD
// ---------------------------------------------------------------------------

/**
 * Creates a new chat session document in Firestore.
 */
export async function createChatSession(
  userId: string, 
  title: any = 'New Conversation', 
  customId?: string
): Promise<string> {
  const conversationId = customId || uuidv4();
  const sessionRef = doc(db, 'users', userId, 'conversations', conversationId);
  const path = `users/${userId}/conversations/${conversationId}`;
  
  const safeTitle = (typeof title === 'string') 
    ? title.trim() 
    : (title && typeof title === 'object' && 'nativeEvent' in title) 
      ? 'New Conversation' 
      : String(title || 'New Conversation').trim();

  try {
    await setDoc(sessionRef, sanitizeFirestoreData({
      id: conversationId,
      userId,
      title: safeTitle || 'New Conversation',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    return conversationId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Retrieves a single chat session by ID.
 */
export async function getChatSession(
  userId: string, 
  conversationId: string
): Promise<ChatSession | null> {
  const sessionRef = doc(db, 'users', userId, 'conversations', conversationId);
  const path = `users/${userId}/conversations/${conversationId}`;
  
  try {
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      userId: data.userId || userId,
      title: data.title || 'Conversation',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Ensures a chat session exists, creating it if missing.
 */
export async function ensureChatSession(
  userId: string, 
  conversationId: string, 
  defaultTitle: string = 'New Conversation'
): Promise<void> {
  const sessionRef = doc(db, 'users', userId, 'conversations', conversationId);
  const path = `users/${userId}/conversations/${conversationId}`;
  
  try {
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) {
      await setDoc(sessionRef, sanitizeFirestoreData({
        id: conversationId,
        userId,
        title: defaultTitle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Lists all chat sessions for a specific user once.
 */
export async function listChatSessions(userId: string): Promise<ChatSession[]> {
  const sessionsRef = collection(db, 'users', userId, 'conversations');
  const path = `users/${userId}/conversations`;
  
  try {
    const snapshot = await getDocs(sessionsRef);
    const sessions: ChatSession[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      sessions.push({
        id: docSnap.id,
        userId: data.userId || userId,
        title: data.title || 'Conversation',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });
    // Sort by updatedAt desc
    sessions.sort((a, b) => {
      const t1 = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
      const t2 = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
      return t2 - t1;
    });
    return sessions;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Subscribes to real-time updates of all chat sessions for a user.
 */
export function subscribeChatSessions(
  userId: string,
  callback: (sessions: ChatSession[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const sessionsRef = collection(db, 'users', userId, 'conversations');
  const path = `users/${userId}/conversations`;
  
  return onSnapshot(
    sessionsRef,
    (snapshot) => {
      const list: ChatSession[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Conversation',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      list.sort((a, b) => {
        const t1 = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
        const t2 = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
        return t2 - t1;
      });

      callback(list);
    },
    (error) => {
      console.error('[db.ts] subscribeChatSessions error:', error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err: any) {
        if (onError) onError(err);
      }
    }
  );
}

/**
 * Updates a chat session (e.g., renaming title).
 */
export async function updateChatSession(
  userId: string,
  conversationId: string,
  updates: { title?: any }
): Promise<void> {
  const sessionRef = doc(db, 'users', userId, 'conversations', conversationId);
  const path = `users/${userId}/conversations/${conversationId}`;
  
  const sanitizedUpdates = { ...updates };
  if (sanitizedUpdates.title !== undefined) {
    if (typeof sanitizedUpdates.title === 'string') {
      sanitizedUpdates.title = sanitizedUpdates.title.trim();
    } else if (sanitizedUpdates.title && typeof sanitizedUpdates.title === 'object' && 'nativeEvent' in sanitizedUpdates.title) {
      delete sanitizedUpdates.title; // Ignore event object passed as title
    } else {
      sanitizedUpdates.title = String(sanitizedUpdates.title).trim();
    }
  }
  
  try {
    await updateDoc(sessionRef, sanitizeFirestoreData({
      ...sanitizedUpdates,
      updatedAt: serverTimestamp(),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Deletes a chat session document.
 */
export async function deleteChatSession(
  userId: string,
  conversationId: string
): Promise<void> {
  const sessionRef = doc(db, 'users', userId, 'conversations', conversationId);
  const path = `users/${userId}/conversations/${conversationId}`;
  
  try {
    await deleteDoc(sessionRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// MESSAGE HISTORY CRUD
// ---------------------------------------------------------------------------

/**
 * Appends a new message to the conversation history.
 */
export async function addChatMessage(
  userId: string,
  conversationId: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>,
  customMessageId?: string
): Promise<string> {
  const messagesRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
  const sessionRef = doc(db, 'users', userId, 'conversations', conversationId);
  const messageId = customMessageId || uuidv4();
  const msgDocRef = doc(messagesRef, messageId);
  const path = `users/${userId}/conversations/${conversationId}/messages/${messageId}`;

  try {
    await setDoc(msgDocRef, sanitizeFirestoreData({
      ...message,
      id: messageId,
      userId,
      conversationId,
      timestamp: serverTimestamp(),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  // Touch session updatedAt
  try {
    await updateDoc(sessionRef, {
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking if session is being initialized
  }

  return messageId;
}

/**
 * Retrieves message history for a session once.
 */
export async function getChatMessageHistory(
  userId: string,
  conversationId: string,
  limitCount: number = 100
): Promise<ChatMessage[]> {
  const messagesRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  
  try {
    const q = query(messagesRef, limit(limitCount));
    const snapshot = await getDocs(q);
    const msgs: ChatMessage[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const timestamp = data.timestamp || { toDate: () => new Date() };
      msgs.push({
        id: docSnap.id,
        ...data,
        timestamp,
      } as ChatMessage);
    });

    msgs.sort((a, b) => {
      const t1 = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const t2 = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return t1 - t2;
    });

    return msgs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Subscribes to real-time message stream for a specific session.
 */
export function subscribeChatMessageHistory(
  userId: string,
  conversationId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const messagesRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  
  return onSnapshot(
    messagesRef,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const timestamp = data.timestamp || { toDate: () => new Date() };
        msgs.push({
          id: docSnap.id,
          ...data,
          timestamp,
        } as ChatMessage);
      });

      msgs.sort((a, b) => {
        const t1 = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
        const t2 = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
        return t1 - t2;
      });

      callback(msgs);
    },
    (error) => {
      console.error('[db.ts] subscribeChatMessageHistory error:', error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err: any) {
        if (onError) onError(err);
      }
    }
  );
}

/**
 * Updates an individual message (e.g. status flag or annotation).
 */
export async function updateChatMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  updates: Partial<ChatMessage>
): Promise<void> {
  const msgRef = doc(db, 'users', userId, 'conversations', conversationId, 'messages', messageId);
  const path = `users/${userId}/conversations/${conversationId}/messages/${messageId}`;
  
  try {
    await updateDoc(msgRef, sanitizeFirestoreData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Deletes an individual message from history.
 */
export async function deleteChatMessage(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<void> {
  const msgRef = doc(db, 'users', userId, 'conversations', conversationId, 'messages', messageId);
  const path = `users/${userId}/conversations/${conversationId}/messages/${messageId}`;
  
  try {
    await deleteDoc(msgRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Clears all message history in a session using batch operations.
 */
export async function clearChatMessageHistory(
  userId: string,
  conversationId: string
): Promise<void> {
  const messagesRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  
  try {
    const snapshot = await getDocs(messagesRef);
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Default export encapsulating the Firestore service module.
 */
export const firestoreService = {
  createChatSession,
  getChatSession,
  ensureChatSession,
  listChatSessions,
  subscribeChatSessions,
  updateChatSession,
  deleteChatSession,
  addChatMessage,
  getChatMessageHistory,
  subscribeChatMessageHistory,
  updateChatMessage,
  deleteChatMessage,
  clearChatMessageHistory,
};

export default firestoreService;
