/**
 * Alya Assistant - Intelligent Auto-Reply Engine
 * Provides context-aware, human-like auto-replies for supported channels.
 * Features:
 * - Tone adaptation (casual, professional, empathetic, concise)
 * - Language mirroring (English, Hindi, Hinglish, Bengali, Banglish)
 * - Sensitivity & urgency detection (requires human approval for sensitive/financial/urgent messages)
 * - Quiet hours enforcement
 * - Rate limiting & spam protection
 * - Draft review vs. auto-send mode
 */

import { geminiService } from './geminiService.ts';

export interface AutoReplyRule {
  id: string;
  userId: string;
  channel: 'all' | 'chat' | 'sms' | 'whatsapp' | 'email';
  enabled: boolean;
  mode: 'draft_review' | 'auto_send_trusted';
  tone: 'friendly' | 'professional' | 'concise' | 'warm';
  language: 'auto' | 'en' | 'hi' | 'bn';
  quietHours: {
    enabled: boolean;
    startTime: string; // e.g. "22:00"
    endTime: string;   // e.g. "07:00"
    quietReplyMessage?: string;
  };
  allowedContacts?: string[]; // e.g. ["Mom", "Boss", "Team"]
  maxRepliesPerHour: number;
  aiDisclosure: boolean; // whether to include subtle indicator
}

export interface IncomingMessagePayload {
  messageId: string;
  senderName: string;
  senderContact?: string;
  channel: 'chat' | 'sms' | 'whatsapp' | 'email';
  content: string;
  receivedAt: string;
  contextHistory?: Array<{ sender: string; content: string; timestamp: string }>;
}

export interface AutoReplyEvaluation {
  messageId: string;
  suggestedReply: string;
  requiresHumanApproval: boolean;
  approvalReason?: string;
  detectedLanguage: string;
  detectedUrgency: 'low' | 'medium' | 'high' | 'urgent';
  detectedTone: string;
  isQuietHours: boolean;
  status: 'draft_ready' | 'auto_sent' | 'pending_approval' | 'suppressed';
  confidence: number;
  evaluatedAt: string;
}

export class AutoReplyManager {
  private static replyCountTracker: Map<string, { count: number; resetAt: number }> = new Map();

  /**
   * Check if current time falls in quiet hours
   */
  public static isWithinQuietHours(startTime: string, endTime: string): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (startTotal <= endTotal) {
      return currentMinutes >= startTotal && currentMinutes <= endTotal;
    } else {
      // Overnight (e.g. 22:00 to 07:00)
      return currentMinutes >= startTotal || currentMinutes <= endTotal;
    }
  }

  /**
   * Evaluate an incoming message and generate a natural human-like auto-reply draft or execution
   */
  public static async evaluateAndGenerateReply(
    payload: IncomingMessagePayload,
    rule: AutoReplyRule
  ): Promise<AutoReplyEvaluation> {
    const now = new Date().toISOString();

    // 1. Rate Limiting Check
    const trackerKey = `${payload.channel}:${payload.senderContact || payload.senderName}`;
    const nowMs = Date.now();
    let tracker = this.replyCountTracker.get(trackerKey);

    if (!tracker || tracker.resetAt < nowMs) {
      tracker = { count: 0, resetAt: nowMs + 3600000 };
      this.replyCountTracker.set(trackerKey, tracker);
    }

    if (tracker.count >= rule.maxRepliesPerHour) {
      return {
        messageId: payload.messageId,
        suggestedReply: '',
        requiresHumanApproval: true,
        approvalReason: `Rate limit of ${rule.maxRepliesPerHour} replies/hour reached for this contact.`,
        detectedLanguage: 'English',
        detectedUrgency: 'low',
        detectedTone: 'neutral',
        isQuietHours: false,
        status: 'suppressed',
        confidence: 0.9,
        evaluatedAt: now
      };
    }

    // 2. Quiet Hours Check
    const inQuietHours = rule.quietHours.enabled && this.isWithinQuietHours(rule.quietHours.startTime, rule.quietHours.endTime);
    if (inQuietHours && rule.quietHours.quietReplyMessage) {
      return {
        messageId: payload.messageId,
        suggestedReply: rule.quietHours.quietReplyMessage,
        requiresHumanApproval: rule.mode === 'draft_review',
        approvalReason: 'Message received during configured Quiet Hours.',
        detectedLanguage: 'English',
        detectedUrgency: 'low',
        detectedTone: 'quiet',
        isQuietHours: true,
        status: rule.mode === 'auto_send_trusted' ? 'auto_sent' : 'draft_ready',
        confidence: 0.98,
        evaluatedAt: now
      };
    }

    // 3. Prompt Gemini for natural human-like reply synthesis & safety evaluation
    const historyText = (payload.contextHistory || [])
      .map(h => `${h.sender}: "${h.content}"`)
      .join('\n');

    const evaluationPrompt = `You are Alya Assistant's Intelligent Auto-Reply Engine.
Your task is to analyze an incoming message received on behalf of the user, evaluate its urgency/sensitivity, and compose a natural, high-quality, human-like response.

## INCOMING MESSAGE:
- Sender: ${payload.senderName} (${payload.senderContact || 'Unknown'})
- Channel: ${payload.channel}
- Message Text: "${payload.content}"
- Previous Context:
${historyText || '(No previous messages)'}

## CONFIGURATION:
- Preferred Tone: ${rule.tone}
- Language: ${rule.language}
- Mode: ${rule.mode}

## GUIDELINES FOR HUMAN-LIKE AUTO-REPLY:
1. Speak warmly, naturally, and concisely (1-2 sentences).
2. Avoid robotic phrasing, corporate jargon, or artificial AI disclaimers ("I am an AI", "As an AI model").
3. Support Bengali (বাংলা), Hindi, Banglish, Hinglish, and English naturally, mirroring the sender's language.
4. SENSITIVITY DETECTION:
   - If the message involves financial transactions, password requests, medical emergencies, high-stakes promises, or urgent life events, mark requiresHumanApproval = true with an explicit reason.
   - For casual greetings, scheduling inquiries, availability checks, or status updates, compose a helpful, courteous reply.
5. NEVER fabricate the user's private physical location, promises, or personal commitments.

Return ONLY valid JSON in this exact structure:
{
  "suggestedReply": "The text of the reply",
  "requiresHumanApproval": false,
  "approvalReason": "Reason if approval is required, otherwise empty string",
  "detectedLanguage": "English | Bengali | Hindi | Banglish | Hinglish",
  "detectedUrgency": "low | medium" | "high" | "urgent",
  "detectedTone": "casual | professional | urgent | friendly",
  "confidence": 0.95
}`;

    try {
      const geminiRes = await geminiService.generateText({
        contents: [{ role: 'user', parts: [{ text: evaluationPrompt }] }],
        temperature: 0.4
      });

      const cleanJson = geminiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      let finalReply = parsed.suggestedReply || 'Thanks for reaching out! I will get back to you shortly.';
      if (rule.aiDisclosure) {
        finalReply += ' (Auto-reply via Alya Assistant)';
      }

      tracker.count++;

      const isAutoSent = rule.mode === 'auto_send_trusted' && !parsed.requiresHumanApproval && !inQuietHours;

      return {
        messageId: payload.messageId,
        suggestedReply: finalReply,
        requiresHumanApproval: parsed.requiresHumanApproval || rule.mode === 'draft_review',
        approvalReason: parsed.approvalReason || (rule.mode === 'draft_review' ? 'Draft review mode enabled.' : undefined),
        detectedLanguage: parsed.detectedLanguage || 'English',
        detectedUrgency: parsed.detectedUrgency || 'low',
        detectedTone: parsed.detectedTone || rule.tone,
        isQuietHours: inQuietHours,
        status: isAutoSent ? 'auto_sent' : 'draft_ready',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
        evaluatedAt: now
      };
    } catch (err: any) {
      console.warn('[AutoReplyManager] AI generation fallback:', err?.message || err);
      // Fallback
      return {
        messageId: payload.messageId,
        suggestedReply: `Hi ${payload.senderName}, thanks for your message! I've received it and will follow up with you as soon as possible.`,
        requiresHumanApproval: true,
        approvalReason: 'AI generation fallback used; human confirmation recommended.',
        detectedLanguage: 'English',
        detectedUrgency: 'low',
        detectedTone: rule.tone,
        isQuietHours: inQuietHours,
        status: 'draft_ready',
        confidence: 0.85,
        evaluatedAt: now
      };
    }
  }
}
