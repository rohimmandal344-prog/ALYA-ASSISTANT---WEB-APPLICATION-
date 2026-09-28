/**
 * Client-Side Auto-Reply Manager for Alya Assistant
 * Coordinates auto-reply rules, draft queue, quiet hours evaluation,
 * and user approvals.
 */

import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  serverTimestamp 
} from 'firebase/firestore';

export interface AutoReplyRule {
  id: string;
  channel: 'all' | 'chat' | 'sms' | 'whatsapp' | 'email';
  enabled: boolean;
  mode: 'draft_review' | 'auto_send_trusted';
  tone: 'friendly' | 'professional' | 'concise' | 'warm';
  language: 'auto' | 'en' | 'hi' | 'bn';
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    quietReplyMessage?: string;
  };
  allowedContacts?: string[];
  maxRepliesPerHour: number;
  aiDisclosure: boolean;
}

export interface AutoReplyDraft {
  id: string;
  senderName: string;
  senderContact?: string;
  channel: string;
  incomingMessage: string;
  suggestedReply: string;
  requiresHumanApproval: boolean;
  approvalReason?: string;
  detectedLanguage: string;
  detectedUrgency: 'low' | 'medium' | 'high' | 'urgent';
  detectedTone: string;
  status: 'draft_ready' | 'auto_sent' | 'approved' | 'rejected' | 'suppressed';
  confidence: number;
  timestamp: string;
}

const STORAGE_RULE_KEY = 'alya_auto_reply_rules';
const STORAGE_DRAFTS_KEY = 'alya_auto_reply_drafts';

class AutoReplyClientManager {
  private defaultRule: AutoReplyRule = {
    id: 'default_rule',
    channel: 'all',
    enabled: true,
    mode: 'draft_review',
    tone: 'friendly',
    language: 'auto',
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '07:00',
      quietReplyMessage: 'I am currently resting and will review your message in the morning.'
    },
    maxRepliesPerHour: 15,
    aiDisclosure: false
  };

  /**
   * Get active auto-reply rule
   */
  public getRule(): AutoReplyRule {
    if (typeof localStorage === 'undefined') return this.defaultRule;
    try {
      const stored = localStorage.getItem(STORAGE_RULE_KEY);
      return stored ? JSON.parse(stored) : this.defaultRule;
    } catch {
      return this.defaultRule;
    }
  }

  /**
   * Save auto-reply rule
   */
  public saveRule(rule: AutoReplyRule, userId?: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_RULE_KEY, JSON.stringify(rule));
    }
    if (userId) {
      setDoc(doc(db, 'users', userId, 'settings', 'autoReplyRule'), {
        ...rule,
        updatedAt: serverTimestamp()
      }).catch(err => console.warn('[AutoReply] Firestore save sync error:', err));
    }
  }

  /**
   * Get local drafts queue
   */
  public getDrafts(): AutoReplyDraft[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_DRAFTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save drafts queue
   */
  public saveDrafts(drafts: AutoReplyDraft[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_DRAFTS_KEY, JSON.stringify(drafts));
    }
  }

  /**
   * Submit incoming message to server engine for auto-reply synthesis
   */
  public async processIncomingMessage(
    senderName: string,
    content: string,
    channel: 'chat' | 'sms' | 'whatsapp' | 'email' = 'chat',
    senderContact?: string
  ): Promise<AutoReplyDraft> {
    const rule = this.getRule();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const res = await fetch('/api/auto-reply/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            messageId,
            senderName,
            senderContact,
            channel,
            content,
            receivedAt: new Date().toISOString()
          },
          rule
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const evalData = await res.json();

      const draft: AutoReplyDraft = {
        id: messageId,
        senderName,
        senderContact,
        channel,
        incomingMessage: content,
        suggestedReply: evalData.suggestedReply,
        requiresHumanApproval: evalData.requiresHumanApproval,
        approvalReason: evalData.approvalReason,
        detectedLanguage: evalData.detectedLanguage,
        detectedUrgency: evalData.detectedUrgency,
        detectedTone: evalData.detectedTone,
        status: evalData.status,
        confidence: evalData.confidence,
        timestamp: new Date().toISOString()
      };

      const drafts = this.getDrafts();
      drafts.unshift(draft);
      this.saveDrafts(drafts.slice(0, 50));

      return draft;
    } catch (err: any) {
      console.warn('[AutoReplyClient] Evaluation fetch error:', err);
      const fallbackDraft: AutoReplyDraft = {
        id: messageId,
        senderName,
        senderContact,
        channel,
        incomingMessage: content,
        suggestedReply: `Hi ${senderName}, thanks for your message! I will get back to you shortly.`,
        requiresHumanApproval: true,
        approvalReason: 'Offline fallback auto-reply generated.',
        detectedLanguage: 'English',
        detectedUrgency: 'low',
        detectedTone: rule.tone,
        status: 'draft_ready',
        confidence: 0.85,
        timestamp: new Date().toISOString()
      };

      const drafts = this.getDrafts();
      drafts.unshift(fallbackDraft);
      this.saveDrafts(drafts.slice(0, 50));
      return fallbackDraft;
    }
  }

  /**
   * Approve a draft
   */
  public approveDraft(id: string): void {
    const drafts = this.getDrafts().map(d => {
      if (d.id === id) {
        return { ...d, status: 'approved' as const };
      }
      return d;
    });
    this.saveDrafts(drafts);
  }

  /**
   * Reject a draft
   */
  public rejectDraft(id: string): void {
    const drafts = this.getDrafts().map(d => {
      if (d.id === id) {
        return { ...d, status: 'rejected' as const };
      }
      return d;
    });
    this.saveDrafts(drafts);
  }

  /**
   * Clear all drafts
   */
  public clearAllDrafts(): void {
    this.saveDrafts([]);
  }
}

export const autoReplyClientManager = new AutoReplyClientManager();
