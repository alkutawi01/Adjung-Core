class SourceFetcher {
  static async fetchRaw(url, customHeaders = {}, timeoutMs = 8000) {
    if (!url) {
      return { rawContent: '', responseHeaders: {}, status: 400 };
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: customHeaders,
        signal: controller.signal
      });

      clearTimeout(id);

      const rawContent = await response.text();
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      return {
        rawContent,
        responseHeaders,
        status: response.status
      };
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }
}

export default SourceFetcher;
