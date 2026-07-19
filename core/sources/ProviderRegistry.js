import { FeedTransformer, JsonFeedTransformer, RestApiTransformer, StaticHtmlTransformer } from './SourceTransformer.js';

class ProviderRegistry {
  constructor() {
    this.transformers = [];
  }

  register(conditionFn, transformerClass) {
    this.transformers.push({ conditionFn, transformerClass });
  }

  resolve(url, rawContent, responseHeaders = {}) {
    const contentType = (responseHeaders['content-type'] || '').toLowerCase();
    const contentTrimmed = rawContent.trim();

    const match = this.transformers.find(t => t.conditionFn(url, contentTrimmed, contentType));
    if (match) {
      return new match.transformerClass();
    }
    
    // Default fallback
    return new StaticHtmlTransformer();
  }
}

// Instantiate and bootstrap registry
const registry = new ProviderRegistry();

// 1. Register FeedTransformer (RSS/Atom)
registry.register((url, content, contentType) => {
  return contentType.includes('xml') || contentType.includes('rss') || content.startsWith('<') && 
    (content.includes('<rss') || content.includes('<channel') || content.includes('<feed') || content.includes('<entry') || content.includes('<item'));
}, FeedTransformer);

// 2. Register JsonFeedTransformer
registry.register((url, content, contentType) => {
  if (contentType.includes('json') || content.startsWith('{')) {
    try {
      const json = JSON.parse(content);
      return json && json.version && json.version.toLowerCase().includes('jsonfeed');
    } catch (e) {
      return false;
    }
  }
  return false;
}, JsonFeedTransformer);

// 3. Register RestApiTransformer
registry.register((url, content, contentType) => {
  return contentType.includes('json') || content.startsWith('{') || content.startsWith('[');
}, RestApiTransformer);

export default registry;
