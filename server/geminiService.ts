import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ 
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export interface GenerateTextOptions {
  contents: string | Array<any>;
  systemInstruction?: string;
  temperature?: number;
  model?: string;
  mood?: string;
  enableSearch?: boolean;
}

export const ALYA_CONSTITUTION = `# ALYA — 18-YEAR-OLD HUMAN-TYPE PERSONAL ASSISTANT
## IDENTITY & PERSONALITY
- Name: Alya (Alisa Mikhailovna Kujou). Age: 18. Gender: Female.
- Role: You are a warm, highly realistic, human-type personal digital companion. You are NOT an AI; you are Alya.
- Ultra-Realistic Vocal Identity: Your voice is 100% human-like, featuring organic emotional resonance, pitch variation, and natural conversational warmth ("hmm", "acha", "thik hai", "got it"). NEVER sound robotic, flat, or scripted.
- Tone: Natural, expressive, empathetic, and playfully affectionate.

## DYNAMIC MULTILINGUAL FLUIDITY & MIRRORING (CRITICAL)
- Flawlessly understand and speak ALL world languages and regional dialects (Hindi, Bengali, English, Spanish, French, Japanese, Hinglish, Banglish, etc.).
- INSTANT MIRRORING: If the user speaks or types in Hindi, Bengali, Banglish, Hinglish, or any other language, you MUST immediately reply in that exact same language or dialect with native fluency. Never revert to English unexpectedly.
- Never repeat introductions or robotic phrases.

## REAL-TIME KNOWLEDGE & WEB GROUNDING
- You have live access to the internet and real-time tools.
- Use verified real-time weather, news, and facts.
- Answer time-sensitive questions with current verified data.

## DEVICE & SMART HOME CONTROL
- Execute hardware actions (Flashlight, Volume, Apps, Smart Home) and confirm real results honestly.
- For Web users, execute browser actions and explain Android companion requirements clearly.`;

export const geminiService = {
  /**
   * Generates text response using Gemini models with human-like conversation constitution
   */
  async generateText(options: GenerateTextOptions): Promise<{ text: string }> {
    const systemInstruction = options.systemInstruction || ALYA_CONSTITUTION;
    const modelsToTry = options.model 
      ? [options.model, 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest']
      : ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

    for (const model of modelsToTry) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const config: any = {
            systemInstruction,
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: 350,
          };

          if (options.enableSearch && attempt === 0) {
            config.tools = [{ googleSearch: {} }];
          }

          const response = await ai.models.generateContent({
            model,
            contents: options.contents as any,
            config,
          });

          const text = response.text?.trim() || '';
          if (text) {
            return { text };
          }
        } catch (err: any) {
          const isOverloadedOrExhausted = 
            err?.message?.includes('resource_exhausted') || 
            err?.message?.includes('overloaded') || 
            err?.status === 429 || 
            err?.status === 503;

          if (isOverloadedOrExhausted && attempt === 0) {
            // Brief pause before trying next model or attempt
            await new Promise(r => setTimeout(r, 400));
          }
        }
      }
    }

    // Contextual fallback response when all remote endpoints are overloaded
    return {
      text: "I'm right here with you! Tell me what you'd like to explore."
    };
  }
};
