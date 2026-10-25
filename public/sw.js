// Service worker Adjung Brief — HANYA untuk notifikasi tolak (2026-10-25). Sengaja TIDAK menyimpan
// cache fail apa-apa dan TIDAK memintas fetch: laman kekal berkelakuan seperti sebelum ini, dan
// versi baharu terus kelihatan selepas deploy tanpa risiko "kandungan lapuk tersangkut".
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  const title = String(d.title || 'Adjung Brief').slice(0, 120);
  event.waitUntil(self.registration.showNotification(title, {
    body: String(d.body || '').slice(0, 300),
    icon: '/icons/ikon-192.png',
    badge: '/icons/lencana-96.png',
    tag: d.tag || 'adjung-berita',
    lang: 'ms',
    data: { url: typeof d.url === 'string' ? d.url : '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Hanya laluan dalam laman sendiri (bermula "/" tetapi bukan "//") — payload tak boleh membawa
  // pembaca ke domain lain.
  const mentah = (event.notification.data && event.notification.data.url) || '/';
  const sasaran = /^\/(?!\/)/.test(mentah) ? mentah : '/';
  event.waitUntil((async () => {
    const tetingkap = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const t of tetingkap) {
      if (new URL(t.url).origin === self.location.origin && 'navigate' in t) {
        await t.navigate(sasaran).catch(() => {});
        return t.focus();
      }
    }
    return self.clients.openWindow(sasaran);
  })());
});
