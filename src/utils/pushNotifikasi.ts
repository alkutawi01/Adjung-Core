// Notifikasi tolak pembaca (2026-10-25) — sisi pelayar. Lihat core/push/PushService.js untuk
// rasional dan peraturan hantaran. Fail ini TIDAK mendaftar apa-apa secara automatik: service worker
// hanya didaftar bila pembaca menekan "Aktifkan" (atau sudah pernah mengaktifkan dahulu).

export type StatusPush =
  | 'memeriksa'
  | 'tidak-disokong'      // pelayar tiada Push API sama sekali
  | 'ios-perlu-pasang'    // iPhone/iPad: perlu "Tambah ke Skrin Utama" dahulu (had Apple)
  | 'dimatikan-pelayan'   // editor memadam suis notifikasi
  | 'disekat'             // pembaca telah menyekat notifikasi dalam tetapan pelayar
  | 'belum'               // boleh diaktifkan
  | 'aktif';

const SW_URL = '/sw.js';

const adaIos = () => {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};
const sudahDipasang = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

const sokongPush = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function kunciKeBait(base64Url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const mentah = atob(base64);
  return Uint8Array.from(mentah, (c) => c.charCodeAt(0));
}

async function ambilKunci(): Promise<{ kunci: string; aktif: boolean } | null> {
  try {
    const r = await fetch('/api/public/push/kunci');
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function daftarSw(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function dapatkanStatus(): Promise<StatusPush> {
  if (!sokongPush()) return adaIos() && !sudahDipasang() ? 'ios-perlu-pasang' : 'tidak-disokong';
  const k = await ambilKunci();
  if (!k) return 'tidak-disokong';
  if (Notification.permission === 'denied') return 'disekat';
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const langganan = await reg?.pushManager.getSubscription();
    if (langganan && Notification.permission === 'granted') return 'aktif';
  } catch { /* abaikan, jatuh ke bawah */ }
  return k.aktif ? 'belum' : 'dimatikan-pelayan';
}

// Ralat daripada pelayan kita (sudah dalam Bahasa Melayu) — dipaparkan terus. Ralat lain (pelayar,
// rangkaian, perkhidmatan tolak) mesej asalnya Inggeris/teknikal, jadi diganti mesej umum.
class RalatPelayanKita extends Error {}

async function hantarKePelayan(langganan: PushSubscription) {
  const json = langganan.toJSON();
  const r = await fetch('/api/public/push/langgan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new RalatPelayanKita(b.error || 'Gagal mendaftar notifikasi.');
  }
}

export async function aktifkanNotifikasi(): Promise<{ ok: boolean; ralat?: string }> {
  try {
    if (!sokongPush()) return { ok: false, ralat: 'Pelayar ini tidak menyokong notifikasi.' };
    const k = await ambilKunci();
    if (!k?.kunci) return { ok: false, ralat: 'Notifikasi tidak tersedia buat masa ini.' };
    const izin = await Notification.requestPermission();
    if (izin !== 'granted') return { ok: false, ralat: 'Notifikasi tidak dibenarkan.' };
    const reg = await daftarSw();
    let langganan = await reg.pushManager.getSubscription();
    if (!langganan) {
      langganan = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: kunciKeBait(k.kunci) as BufferSource,
      });
    }
    await hantarKePelayan(langganan);
    return { ok: true };
  } catch (err: any) {
    if (err instanceof RalatPelayanKita) return { ok: false, ralat: err.message };
    if (err?.name === 'NotAllowedError') return { ok: false, ralat: 'Pelayar tidak membenarkan notifikasi untuk laman ini.' };
    return { ok: false, ralat: 'Notifikasi tidak dapat diaktifkan pada pelayar ini. Cuba lagi sebentar lagi.' };
  }
}

export async function matikanNotifikasi(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const langganan = await reg?.pushManager.getSubscription();
    if (langganan) {
      const endpoint = langganan.endpoint;
      await langganan.unsubscribe();
      await fetch('/api/public/push/henti', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  } catch { /* senyap: pembaca sudah tidak melanggan di pelayar */ }
}

/** Selepas pembaca pernah mengaktifkan: segarkan langganan ke pelayan (kunci boleh berubah). */
export async function segerakkanJikaAktif(): Promise<void> {
  try {
    if (!sokongPush() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const langganan = await reg?.pushManager.getSubscription();
    if (langganan) await hantarKePelayan(langganan);
  } catch { /* senyap */ }
}
