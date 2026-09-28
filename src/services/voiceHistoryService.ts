import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  serverTimestamp, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/db';

export interface VoiceMessage {
  speaker: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface VoiceSessionRecord {
  id: string;
  userId: string;
  title: string;
  createdAt: any;
  durationSeconds?: number;
  transcript: VoiceMessage[];
}

export const voiceHistoryService = {
  /**
   * Save a completed voice session to Firestore
   */
  async saveVoiceSession(
    userId: string, 
    transcript: { speaker: 'user' | 'assistant'; text: string; timestamp: Date }[], 
    durationSeconds?: number
  ): Promise<string> {
    const sessionId = Math.random().toString(36).substring(2, 15);
    const path = `users/${userId}/voice_sessions/${sessionId}`;
    
    // Clean and limit transcript up to 200 items as dictated by rules
    const cleanTranscript = transcript.slice(0, 200).map(item => ({
      speaker: item.speaker,
      text: item.text.trim().substring(0, 10000), // Prevent overflow injection
      timestamp: item.timestamp.toISOString()
    }));

    const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const recordPayload = {
      id: sessionId,
      userId,
      title: `Voice Call on ${dateStr}`,
      createdAt: serverTimestamp(),
      durationSeconds: durationSeconds || 0,
      transcript: cleanTranscript
    };

    try {
      await setDoc(doc(db, 'users', userId, 'voice_sessions', sessionId), recordPayload);
      return sessionId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  /**
   * Subscribe to real-time updates for user's past voice sessions
   */
  subscribeToVoiceSessions(
    userId: string, 
    callback: (sessions: VoiceSessionRecord[]) => void, 
    onError?: (err: Error) => void
  ) {
    const path = `users/${userId}/voice_sessions`;
    const q = query(
      collection(db, 'users', userId, 'voice_sessions'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const list: VoiceSessionRecord[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          userId: data.userId,
          title: data.title || 'Untitled Call',
          createdAt: data.createdAt,
          durationSeconds: data.durationSeconds || 0,
          transcript: data.transcript || []
        });
      });
      callback(list);
    }, (err) => {
      if (onError) {
        try {
          handleFirestoreError(err, OperationType.GET, path);
        } catch (wrappedErr: any) {
          onError(wrappedErr);
        }
      }
    });
  },

  /**
   * Delete a single voice session record from Firestore (Privacy Requirement)
   */
  async deleteVoiceSession(userId: string, sessionId: string): Promise<void> {
    const path = `users/${userId}/voice_sessions/${sessionId}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'voice_sessions', sessionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  /**
   * Delete ALL voice sessions from Firestore (Privacy / Right to be Forgotten Requirement)
   */
  async clearAllVoiceSessions(userId: string, sessionIds: string[]): Promise<void> {
    const path = `users/${userId}/voice_sessions`;
    try {
      const batch = writeBatch(db);
      sessionIds.forEach((id) => {
        batch.delete(doc(db, 'users', userId, 'voice_sessions', id));
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
};
