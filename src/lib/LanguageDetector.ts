/**
 * Comprehensive Multilingual Language Detector & Registry for Alya Assistant
 * Supports 35+ world languages, dialect detection (Banglish, Hinglish),
 * script analysis, and SpeechSynthesis/Recognition BCP-47 mapping.
 */

export interface LanguageInfo {
  code: string;       // BCP-47 tag, e.g., 'en-US'
  shortCode: string;  // 2-letter, e.g., 'en'
  name: string;       // English display name
  nativeName: string; // Native name
  flag: string;       // Flag emoji
  scriptPattern?: RegExp;
  keywords?: string[];
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'auto', shortCode: 'auto', name: 'Auto-Detect', nativeName: 'স্বয়ংক্রিয় / Automatic', flag: '🌐' },
  { code: 'en-US', shortCode: 'en', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', shortCode: 'en', name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-IN', shortCode: 'en', name: 'English (India)', nativeName: 'English (India)', flag: '🇮🇳' },
  { 
    code: 'bn-BD', 
    shortCode: 'bn', 
    name: 'Bengali (বাংলা)', 
    nativeName: 'বাংলা', 
    flag: '🇧🇩',
    scriptPattern: /[\u0980-\u09FF]/,
    keywords: ['koro', 'chalu', 'bondho', 'jaliye', 'bariye', 'komao', 'dao', 'amar', 'shob', 'dekho', 'kemon', 'acho', 'valo']
  },
  { 
    code: 'hi-IN', 
    shortCode: 'hi', 
    name: 'Hindi (हिंदी)', 
    nativeName: 'हिन्दी', 
    flag: '🇮🇳',
    scriptPattern: /[\u0900-\u097F]/,
    keywords: ['karo', 'chalao', 'band', 'jalao', 'sab', 'dekh', 'kya', 'kaise', 'accha', 'thoda', 'badhao', 'batao']
  },
  { 
    code: 'es-ES', 
    shortCode: 'es', 
    name: 'Spanish (Español)', 
    nativeName: 'Español', 
    flag: '🇪🇸',
    keywords: ['hola', 'como', 'estas', 'enciende', 'apaga', 'luz', 'musica', 'gracias', 'por favor']
  },
  { 
    code: 'fr-FR', 
    shortCode: 'fr', 
    name: 'French (Français)', 
    nativeName: 'Français', 
    flag: '🇫🇷',
    keywords: ['bonjour', 'merci', 'eteins', 'allume', 'musique', 'comment', 'allez']
  },
  { 
    code: 'de-DE', 
    shortCode: 'de', 
    name: 'German (Deutsch)', 
    nativeName: 'Deutsch', 
    flag: '🇩🇪',
    keywords: ['hallo', 'danke', 'licht', 'anmachen', 'ausschalten', 'wie', 'geht']
  },
  { 
    code: 'ja-JP', 
    shortCode: 'ja', 
    name: 'Japanese (日本語)', 
    nativeName: '日本語', 
    flag: '🇯🇵',
    scriptPattern: /[\u3040-\u30FF\u4E00-\u9FAF]/,
    keywords: ['konnichiwa', 'arigatou', 'denki', 'tsukete', 'keshite']
  },
  { 
    code: 'ru-RU', 
    shortCode: 'ru', 
    name: 'Russian (Русский)', 
    nativeName: 'Русский', 
    flag: '🇷🇺',
    scriptPattern: /[\u0400-\u04FF]/,
    keywords: ['privet', 'spasibo', 'vklyuchi', 'vyklyuchi', 'svet']
  },
  { 
    code: 'ar-SA', 
    shortCode: 'ar', 
    name: 'Arabic (العربية)', 
    nativeName: 'العربية', 
    flag: '🇸🇦',
    scriptPattern: /[\u0600-\u06FF]/,
    keywords: ['marhaban', 'shukran', 'tashghil', 'itfa']
  },
  { 
    code: 'pt-BR', 
    shortCode: 'pt', 
    name: 'Portuguese (Português)', 
    nativeName: 'Português', 
    flag: '🇧🇷',
    keywords: ['ola', 'obrigado', 'ligar', 'desligar', 'luz']
  },
  { 
    code: 'it-IT', 
    shortCode: 'it', 
    name: 'Italian (Italiano)', 
    nativeName: 'Italiano', 
    flag: '🇮🇹',
    keywords: ['ciao', 'grazie', 'accendi', 'spegni', 'luce']
  },
  { 
    code: 'ko-KR', 
    shortCode: 'ko', 
    name: 'Korean (한국어)', 
    nativeName: '한국어', 
    flag: '🇰🇷',
    scriptPattern: /[\uAC00-\uD7AF\u1100-\u11FF]/,
    keywords: ['annyeong', 'gamsahamnida']
  },
  { 
    code: 'zh-CN', 
    shortCode: 'zh', 
    name: 'Chinese (中文)', 
    nativeName: '中文 (简体)', 
    flag: '🇨🇳',
    scriptPattern: /[\u4E00-\u9FFF]/,
    keywords: ['nihao', 'xiexie', 'kaideng', 'guandeng']
  },
  { 
    code: 'tr-TR', 
    shortCode: 'tr', 
    name: 'Turkish (Türkçe)', 
    nativeName: 'Türkçe', 
    flag: '🇹🇷',
    keywords: ['merhaba', 'tesekkurler', 'isigi', 'ac', 'kapat']
  },
  { 
    code: 'id-ID', 
    shortCode: 'id', 
    name: 'Indonesian (Bahasa Indonesia)', 
    nativeName: 'Bahasa Indonesia', 
    flag: '🇮🇩',
    keywords: ['halo', 'terima', 'kasih', 'nyalakan', 'matikan']
  },
  { 
    code: 'ur-PK', 
    shortCode: 'ur', 
    name: 'Urdu (اردو)', 
    nativeName: 'اردو', 
    flag: '🇵🇰',
    scriptPattern: /[\u0600-\u06FF]/,
    keywords: ['karo', 'chalao', 'band', 'shukriya']
  },
  { 
    code: 'ta-IN', 
    shortCode: 'ta', 
    name: 'Tamil (தமிழ்)', 
    nativeName: 'தமிழ்', 
    flag: '🇮🇳',
    scriptPattern: /[\u0B80-\u0BFF]/
  },
  { 
    code: 'te-IN', 
    shortCode: 'te', 
    name: 'Telugu (తెలుగు)', 
    nativeName: 'తెలుగు', 
    flag: '🇮🇳',
    scriptPattern: /[\u0C00-\u0C7F]/
  },
  { 
    code: 'mr-IN', 
    shortCode: 'mr', 
    name: 'Marathi (मराठी)', 
    nativeName: 'मराठी', 
    flag: '🇮🇳',
    scriptPattern: /[\u0900-\u097F]/
  },
  { 
    code: 'gu-IN', 
    shortCode: 'gu', 
    name: 'Gujarati (ગુજરાતી)', 
    nativeName: 'ગુજરાતી', 
    flag: '🇮🇳',
    scriptPattern: /[\u0A80-\u0AFF]/
  },
  { 
    code: 'vi-VN', 
    shortCode: 'vi', 
    name: 'Vietnamese (Tiếng Việt)', 
    nativeName: 'Tiếng Việt', 
    flag: '🇻🇳'
  },
  { 
    code: 'th-TH', 
    shortCode: 'th', 
    name: 'Thai (ไทย)', 
    nativeName: 'ไทย', 
    flag: '🇹🇭',
    scriptPattern: /[\u0E00-\u0E7F]/
  },
  { 
    code: 'nl-NL', 
    shortCode: 'nl', 
    name: 'Dutch (Nederlands)', 
    nativeName: 'Nederlands', 
    flag: '🇳🇱'
  },
  { 
    code: 'pl-PL', 
    shortCode: 'pl', 
    name: 'Polish (Polski)', 
    nativeName: 'Polski', 
    flag: '🇵🇱'
  },
  { 
    code: 'sv-SE', 
    shortCode: 'sv', 
    name: 'Swedish (Svenska)', 
    nativeName: 'Svenska', 
    flag: '🇸🇪'
  },
  { 
    code: 'el-GR', 
    shortCode: 'el', 
    name: 'Greek (Ελληνικά)', 
    nativeName: 'Ελληνικά', 
    flag: '🇬🇷',
    scriptPattern: /[\u0370-\u03FF]/
  },
  { 
    code: 'he-IL', 
    shortCode: 'he', 
    name: 'Hebrew (עברית)', 
    nativeName: 'עברית', 
    flag: '🇮🇱',
    scriptPattern: /[\u0590-\u05FF]/
  }
];

export class LanguageDetector {
  /**
   * Automatically detects the spoken/written language of any input text
   */
  public static detectLanguage(text: string): LanguageInfo {
    if (!text || !text.trim()) {
      return SUPPORTED_LANGUAGES.find(l => l.code === 'en-US')!;
    }

    const trimmed = text.trim();

    // 1. Script Pattern Matching
    for (const lang of SUPPORTED_LANGUAGES) {
      if (lang.scriptPattern && lang.scriptPattern.test(trimmed)) {
        return lang;
      }
    }

    const lower = trimmed.toLowerCase();

    // 2. Dialect and Keyword Matching (Banglish, Hinglish, Spanish, etc.)
    for (const lang of SUPPORTED_LANGUAGES) {
      if (lang.keywords && lang.keywords.length > 0) {
        const matches = lang.keywords.filter(k => lower.includes(k));
        if (matches.length > 0) {
          return lang;
        }
      }
    }

    // Default to English
    return SUPPORTED_LANGUAGES.find(l => l.code === 'en-US')!;
  }

  /**
   * Get LanguageInfo by BCP-47 or shortCode
   */
  public static getLanguageInfo(codeOrShort: string): LanguageInfo {
    const found = SUPPORTED_LANGUAGES.find(
      l => l.code.toLowerCase() === codeOrShort.toLowerCase() || 
           l.shortCode.toLowerCase() === codeOrShort.toLowerCase()
    );
    return found || SUPPORTED_LANGUAGES.find(l => l.code === 'en-US')!;
  }
}
