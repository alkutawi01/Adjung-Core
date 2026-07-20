import AIProvider from './AIProvider.js';

class ClaudeProvider extends AIProvider {
  async generate(promptText, systemInstructions = '', searchTools = null) {
    if (!this.apiKey) {
      throw new Error('Claude API key is not set.');
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.modelName || 'claude-3-5-sonnet-latest',
        max_tokens: 1000,
        system: systemInstructions || undefined,
        messages: [{ role: 'user', content: promptText + '\nSila jawab dalam format JSON sahaja.' }]
      })
    });

    if (!res.ok) {
      throw new Error(`Claude API returned status ${res.status}`);
    }

    const data = await res.json();
    const text = data.content[0].text.trim();
    let parsedJson = null;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      throw new Error(`Failed to parse Claude response as JSON: ${text}`);
    }

    const promptTokens = data.usage?.input_tokens || 0;
    const completionTokens = data.usage?.output_tokens || 0;

    return {
      text,
      parsedJson,
      promptTokens,
      completionTokens,
      // Claude has no live web-search/grounding tool wired up here, so it has no way to verify
      // any URL it writes — every source_url from Claude is generated from training data alone.
      groundingUrls: []
    };
  }
}

export default ClaudeProvider;
