/**
 * Intent Engine for Alya Assistant
 * Processes natural language input across all supported languages (English, Bengali, 
 * Banglish, Hindi, Hinglish, Spanish, French, German, Russian, Japanese, etc.),
 * extracts rooms/parameters/actions, handles multi-command splitting,
 * and links with CapabilityRegistry for execution preparation.
 */

import { capabilityRegistry, CapabilityDefinition } from './CapabilityRegistry';
import { LanguageDetector, LanguageInfo } from './LanguageDetector';

export type IntentCategory = 'device_control' | 'device_query' | 'media_control' | 'system_command' | 'general_chat';

export interface ParsedIntent {
  rawText: string;
  intent: IntentCategory;
  confidence: number;
  language: string;
  languageInfo: LanguageInfo;
  capability?: CapabilityDefinition;
  extractedParams: Record<string, any>;
  validationResult?: { valid: boolean; error?: string };
  subIntents?: ParsedIntent[];
  contextReferenced?: boolean;
}

export class IntentEngine {
  private static instance: IntentEngine | null = null;
  private lastActiveRoom: string = 'Bedroom';
  private lastActiveDeviceType: string = 'light';

  private constructor() {}

  public static getInstance(): IntentEngine {
    if (!IntentEngine.instance) {
      IntentEngine.instance = new IntentEngine();
    }
    return IntentEngine.instance;
  }

  /**
   * Main entry point: Process raw input and resolve to executable capabilities
   */
  public processInput(text: string): ParsedIntent {
    const rawText = text.trim();
    if (!rawText) {
      const defaultLang = LanguageDetector.detectLanguage('');
      return {
        rawText,
        intent: 'general_chat',
        confidence: 0,
        language: 'English',
        languageInfo: defaultLang,
        extractedParams: {}
      };
    }

    const languageInfo = LanguageDetector.detectLanguage(rawText);

    // 1. Multi-command handling ("Turn on living room light AND fan, set AC to 24")
    const sentences = this.splitMultiCommands(rawText);
    if (sentences.length > 1) {
      const subIntents = sentences.map(s => this.processSingleIntent(s, languageInfo));
      return {
        rawText,
        intent: 'device_control',
        confidence: 0.95,
        language: languageInfo.name,
        languageInfo,
        extractedParams: {},
        subIntents
      };
    }

    return this.processSingleIntent(rawText, languageInfo);
  }

  /**
   * Single command parser and CapabilityRegistry linker
   */
  private processSingleIntent(text: string, languageInfo: LanguageInfo): ParsedIntent {
    const lower = text.toLowerCase();
    const room = this.detectRoom(lower);
    const isQuery = lower.includes('is my') || lower.includes('status') || lower.includes('koto') || 
                    lower.includes('ki on') || lower.includes('check') || lower.includes('estado') || 
                    lower.includes('statut') || lower.includes('kaisa hai');

    // Contextual pronoun resolution ("it", "that light", "same device", "এটার ব্রাইটনেস ৫০% করো", "bájalo")
    let contextReferenced = false;
    let targetRoom = room;

    if (!room && (lower.includes('it') || lower.includes('that') || lower.includes('same') || 
                  lower.includes('etar') || lower.includes('oita') || lower.includes('আবার') ||
                  lower.includes('isko') || lower.includes('wahi') || lower.includes('eso'))) {
      targetRoom = this.lastActiveRoom;
      contextReferenced = true;
    }

    // Match capability from CapabilityRegistry
    const capability = capabilityRegistry.findCapabilityForIntent(text);

    if (!capability) {
      return {
        rawText: text,
        intent: 'general_chat',
        confidence: 0.5,
        language: languageInfo.name,
        languageInfo,
        extractedParams: {}
      };
    }

    const intentCategory: IntentCategory = isQuery ? 'device_query' : 'device_control';
    const extractedParams: Record<string, any> = { room: targetRoom || 'Bedroom' };

    // Extract action & parameters based on capability category
    if (capability.category === 'light') {
      const isOff = lower.includes('off') || lower.includes('bondho') || lower.includes('band') || 
                    lower.includes('apaga') || lower.includes('eteins') || lower.includes('ausschalten');
      const brightMatch = lower.match(/(\d{1,3})\s*(%|percent)/) || lower.match(/brightness\s*(\d{1,3})/);
      
      if (brightMatch) {
        extractedParams.action = 'set_brightness';
        extractedParams.brightness = Math.min(100, Math.max(0, parseInt(brightMatch[1])));
      } else if (isOff) {
        extractedParams.action = 'turn_off';
      } else {
        extractedParams.action = 'turn_on';
      }

      if (lower.includes('warm')) extractedParams.color = 'Warm White';
      else if (lower.includes('daylight')) extractedParams.color = 'Daylight';
      else if (lower.includes('cool')) extractedParams.color = 'Cool White';
      else if (lower.includes('blue') || lower.includes('neel') || lower.includes('neela')) extractedParams.color = 'Blue';

      this.lastActiveRoom = extractedParams.room;
      this.lastActiveDeviceType = 'light';
    } else if (capability.category === 'fan') {
      const isOff = lower.includes('off') || lower.includes('bondho') || lower.includes('band');
      const speedMatch = lower.match(/(speed|level|ta|pe|e|velocidad)\s*([1-5])/) || lower.match(/\b([1-5])\b/);

      if (speedMatch && !isOff) {
        extractedParams.action = 'set_speed';
        extractedParams.speed = Math.min(5, Math.max(1, parseInt(speedMatch[2] || speedMatch[1])));
      } else if (isOff) {
        extractedParams.action = 'turn_off';
      } else {
        extractedParams.action = 'turn_on';
      }

      this.lastActiveRoom = extractedParams.room;
      this.lastActiveDeviceType = 'fan';
    } else if (capability.category === 'ac') {
      const isOff = lower.includes('off') || lower.includes('bondho') || lower.includes('band');
      const tempMatch = lower.match(/(\d{2})\s*(degree|degrees|c|°c)?/) || lower.match(/to\s*(\d{2})/);

      if (tempMatch && !isOff) {
        extractedParams.action = 'set_temperature';
        extractedParams.temperature = Math.min(30, Math.max(16, parseInt(tempMatch[1])));
        extractedParams.mode = 'cool';
      } else if (isOff) {
        extractedParams.action = 'turn_off';
      } else {
        extractedParams.action = 'turn_on';
      }

      this.lastActiveRoom = extractedParams.room;
      this.lastActiveDeviceType = 'ac';
    } else if (capability.category === 'tv') {
      const isOff = lower.includes('off') || lower.includes('bondho') || lower.includes('band');
      const volMatch = lower.match(/volume\s*(\d{1,3})/);

      if (volMatch) {
        extractedParams.action = 'set_volume';
        extractedParams.volume = Math.min(100, Math.max(0, parseInt(volMatch[1])));
      } else if (isOff) {
        extractedParams.action = 'turn_off';
      } else {
        extractedParams.action = 'turn_on';
      }
    } else if (capability.category === 'plug') {
      const isOff = lower.includes('off') || lower.includes('bondho') || lower.includes('band');
      extractedParams.action = isOff ? 'turn_off' : 'turn_on';
    } else if (capability.category === 'room') {
      const isOff = lower.includes('off') || lower.includes('bondho') || lower.includes('band');
      extractedParams.action = isOff ? 'turn_off' : 'turn_on';
      extractedParams.targetType = 'all';
    } else if (capability.category === 'weather') {
      const inMatch = lower.match(/(in|at|for|near|de|en)\s+([a-zA-Z\s]+)/);
      if (inMatch && !['here', 'me', 'my area', 'my location', 'aqui', 'ici'].includes(inMatch[2].trim())) {
        extractedParams.location = inMatch[2].trim();
      }
    } else if (capability.category === 'news') {
      const nearMatch = lower.match(/(in|near|about|for|sobre|sur)\s+([a-zA-Z\s]+)/);
      if (nearMatch && !['here', 'me', 'my area', 'my location'].includes(nearMatch[2].trim())) {
        extractedParams.query = nearMatch[2].trim();
      }
    } else if (capability.category === 'android_companion') {
      if (capability.id === 'cap_android_torch') {
        extractedParams.state = !lower.includes('off') && !lower.includes('bondho') && !lower.includes('band');
      } else if (capability.id === 'cap_android_volume') {
        const volMatch = lower.match(/(\d{1,3})/);
        extractedParams.level = volMatch ? Math.min(100, Math.max(0, parseInt(volMatch[1]))) : 50;
      }
    }

    // Validate parameters against Registry schema
    const validationResult = capabilityRegistry.validateParameters(capability.id, extractedParams);

    return {
      rawText: text,
      intent: intentCategory,
      confidence: 0.95,
      language: languageInfo.name,
      languageInfo,
      capability,
      extractedParams,
      validationResult,
      contextReferenced
    };
  }

  /**
   * Helper: Extract target room name across multilingual terms
   */
  private detectRoom(lowerText: string): string | undefined {
    if (lowerText.includes('bedroom') || lowerText.includes('bed room') || lowerText.includes('ঘুমের ঘর') || 
        lowerText.includes('শয়নকক্ষ') || lowerText.includes('dormitorio') || lowerText.includes('chambre')) {
      return 'Bedroom';
    }
    if (lowerText.includes('living room') || lowerText.includes('drawing room') || lowerText.includes('বসার ঘর') || 
        lowerText.includes('sala') || lowerText.includes('salon')) {
      return 'Living Room';
    }
    if (lowerText.includes('kitchen') || lowerText.includes('রান্নাঘর') || lowerText.includes('cocina') || lowerText.includes('cuisine')) {
      return 'Kitchen';
    }
    if (lowerText.includes('bathroom') || lowerText.includes('washroom') || lowerText.includes('বাথরুম') || lowerText.includes('baño') || lowerText.includes('salle de bain')) {
      return 'Bathroom';
    }
    return undefined;
  }

  /**
   * Helper: Split compound sentences into sub-intents
   */
  private splitMultiCommands(text: string): string[] {
    const delimiters = /[\n,;]|\band\b|\bar\b|\bebam\b|\bor\b|\balso\b|\by\b|\bet\b|\bund\b/i;
    return text
      .split(delimiters)
      .map(s => s.trim())
      .filter(s => s.length > 3);
  }
}

export const intentEngine = IntentEngine.getInstance();
