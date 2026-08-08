import { fetchSelamat, RalatUrlTakSelamat } from '../utils/urlSafety.js';

class SourceFetcher {
  static async fetchRaw(url, customHeaders = {}, timeoutMs = 8000) {
    if (!url) {
      return { rawContent: '', responseHeaders: {}, status: 400 };
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Sekatan SSRF + pelencongan (2026-08-08, audit keselamatan) — url ni datang daripada
      // senarai rujukan sumber yang editor taip sendiri (Tulis Kandungan → Arahan AI →
      // Rujukan), jadi setiap URL dalam rantaian (termasuk sasaran redirect) MESTI disahkan
      // sebelum pelayan mengambilnya. Lihat core/utils/urlSafety.js.
      const response = await fetchSelamat(url, {
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
      if (error instanceof RalatUrlTakSelamat) {
        return { rawContent: '', responseHeaders: {}, status: 400, ralatKeselamatan: error.message };
      }
      throw error;
    }
  }
}

export default SourceFetcher;
