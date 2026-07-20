import { GoogleGenAI } from '@google/genai';
import AIProvider from './AIProvider.js';

// Gemini occasionally appends stray trailing content after an otherwise-complete, valid JSON
// object/array (observed: a duplicate closing "]}" tacked on after the real structure already
// closed). Rather than fail the whole generation, scan from the first { or [ and track bracket
// depth to find exactly where the FIRST complete structure balances back to zero, and parse only
// that substring — ignoring whatever garbage follows.
function extractBalancedJson(text) {
  const start = text.search(/[{[]/);
  if (start === -1) return null;

  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

class GeminiProvider extends AIProvider {
  async generate(promptText, systemInstructions = '', searchTools = null) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not set.');
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const config = {
      responseMimeType: 'application/json'
    };

    if (systemInstructions) {
      config.systemInstruction = systemInstructions;
    }

    if (searchTools && Array.isArray(searchTools) && searchTools.length > 0) {
      config.tools = searchTools;
    }

    const modelToUse = this.modelName || 'gemini-3.5-flash';
    console.log(`[Gemini API Call]`);
    console.log(`- Request Reason: Generating content for editorial slot`);
    console.log(`- Resolved Model Name: ${modelToUse}`);
    if (!this.modelName) {
      console.log(`- Fallback Triggered: Model name was not provided. Falling back to default model: gemini-3.5-flash`);
    }

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: promptText,
      config
    });

    const text = response.text.trim();
    let parsedJson = null;
    let cleanText = text;
    try {
      // Clean markdown blocks if present
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7);
      }
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.slice(0, -3);
      }
      cleanText = cleanText.trim();
      
      // Strip search grounding citation footnotes like [1], [1.1], [1.1.2], etc.
      cleanText = cleanText.replace(/\[\d+(?:\.\d+)*\]/g, '');
      
      // Remove trailing commas before closing braces/brackets
      cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');
      
      try {
        parsedJson = JSON.parse(cleanText);
      } catch (firstErr) {
        // Direct parse failed — likely trailing garbage after a complete, valid structure.
        // Try extracting just the first balanced {...} or [...] before giving up entirely.
        const balanced = extractBalancedJson(cleanText);
        if (!balanced) throw firstErr;
        parsedJson = JSON.parse(balanced);
        console.warn('[Gemini API] Response had trailing garbage after valid JSON — recovered via balanced-bracket extraction.');
      }
    } catch (e) {
      throw new Error(`Failed to parse Gemini response as JSON: ${cleanText} (Original: ${text})`);
    }

    let promptTokens = 0;
    let completionTokens = 0;
    let thoughtsTokens = 0;
    if (response.usageMetadata) {
      promptTokens = response.usageMetadata.promptTokenCount || 0;
      // "Thinking"-capable models (this one included) generate an internal reasoning pass that is
      // NOT part of candidatesTokenCount but IS billed at the same output rate — silently missing
      // this understated real cost by a wide margin. Fold it into completionTokens so every cost
      // calculation downstream (here and in EditorialPipeline/ai_usage_logs) is billing-accurate.
      thoughtsTokens = response.usageMetadata.thoughtsTokenCount || 0;
      completionTokens = (response.usageMetadata.candidatesTokenCount || 0) + thoughtsTokens;
    }

    // Real, verifiable citation URLs from Google Search grounding (when searchTools was passed).
    // These are what Gemini actually retrieved and read — unlike the "source_url" field the model
    // writes into the JSON body, which is free-text generation and can still be hallucinated even
    // when grounding is active. Prefer these over the model's self-reported URL wherever possible.
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingUrls = groundingChunks
      .map(chunk => chunk.web?.uri)
      .filter(Boolean);

    console.log(`[Gemini API Usage]`);
    console.log(`- Prompt Tokens: ${promptTokens}`);
    console.log(`- Completion Tokens: ${completionTokens}${thoughtsTokens > 0 ? ` (includes ${thoughtsTokens} thinking tokens)` : ''}`);
    if (groundingUrls.length > 0) {
      console.log(`- Grounding URLs found: ${groundingUrls.length}`);
    }

    return {
      text,
      parsedJson,
      promptTokens,
      completionTokens,
      groundingUrls
    };
  }
}

export default GeminiProvider;
