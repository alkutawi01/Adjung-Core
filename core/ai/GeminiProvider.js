import { GoogleGenAI } from '@google/genai';
import AIProvider from './AIProvider.js';

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

    const response = await ai.models.generateContent({
      model: this.modelName || 'gemini-3.5-flash',
      contents: promptText,
      config
    });

    const text = response.text.trim();
    let parsedJson = null;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      throw new Error(`Failed to parse Gemini response as JSON: ${text}`);
    }

    let promptTokens = 0;
    let completionTokens = 0;
    if (response.usageMetadata) {
      promptTokens = response.usageMetadata.promptTokenCount || 0;
      completionTokens = response.usageMetadata.candidatesTokenCount || 0;
    }

    return {
      text,
      parsedJson,
      promptTokens,
      completionTokens
    };
  }
}

export default GeminiProvider;
