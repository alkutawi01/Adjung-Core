import { sahkanUrlSelamatUntukFetch } from '../utils/urlSafety.js';

class SourceFetcher {
  static async fetchRaw(url, customHeaders = {}, timeoutMs = 8000) {
    if (!url) {
      return { rawContent: '', responseHeaders: {}, status: 400 };
    }

    // Sekatan SSRF (2026-08-08, audit keselamatan) — url ni datang daripada senarai rujukan
    // sumber yang editor taip sendiri (Tulis Kandungan → Arahan AI → Rujukan), jadi ia MESTI
    // disahkan sebelum pelayan cuba mengambilnya sendiri. Lihat core/utils/urlSafety.js.
    const semakan = await sahkanUrlSelamatUntukFetch(url);
    if (!semakan.selamat) {
      return { rawContent: '', responseHeaders: {}, status: 400, ralatKeselamatan: semakan.sebab };
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
