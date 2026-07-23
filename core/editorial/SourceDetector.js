// core/editorial/SourceDetector.js
// Auto-detects Source Type ('web' | 'print' | 'audio' | 'video') from URL patterns and text content heuristics.

export function detectSourceType(url = '', text = '') {
  const urlLower = (url || '').toLowerCase();
  const textLower = (text || '').toLowerCase();

  // 1. Video detection
  const videoUrlPatterns = ['youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com', 'dailymotion.com', 'fb.watch', '.mp4', '.webm', '.mkv'];
  if (videoUrlPatterns.some(p => urlLower.includes(p))) {
    return 'video';
  }
  const videoKeywords = ['video', 'tonton', 'klip', 'sinematik', 'siaran langsung', 'rekod visual', 'filem'];
  if (videoKeywords.some(k => textLower.includes(k))) {
    return 'video';
  }

  // 2. Audio detection
  const audioUrlPatterns = ['spotify.com', 'soundcloud.com', 'apple.com/podcast', 'anchor.fm', 'podcasts.google', '.mp3', '.m4a', '.wav', '.aac'];
  if (audioUrlPatterns.some(p => urlLower.includes(p))) {
    return 'audio';
  }
  const audioKeywords = ['audio', 'dengar', 'podcast', 'rekod suara', 'temubual radio', 'lagu', 'bunyi'];
  if (audioKeywords.some(k => textLower.includes(k))) {
    return 'audio';
  }

  // 3. Print Material detection (Bahan Bercetak)
  const printUrlPatterns = ['.pdf', 'doi.org', 'jstor.org', 'books.google', 'archive.org', 'researchgate.net', 'academia.edu'];
  if (printUrlPatterns.some(p => urlLower.includes(p))) {
    return 'print';
  }
  const printKeywords = ['buku', 'jurnal', 'naskhah', 'majalah', 'risalah', 'monograf', 'cetakan', 'penerbitan', 'arkib bercetak'];
  if (printKeywords.some(k => textLower.includes(k))) {
    return 'print';
  }

  // Default fallback: Web
  return 'web';
}
