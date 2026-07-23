// Safe JSON parser utility that catches syntax errors gracefully and returns a default fallback.

export function safeJsonParse(jsonString, fallback = {}) {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback;
  }
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.warn('[safeJsonParse] Invalid JSON encountered, returning fallback:', err.message);
    return fallback;
  }
}
