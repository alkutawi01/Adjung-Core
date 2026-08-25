// IndexNow (2026-08-25, arahan Izzat "selesaikan SEO utk brief") — protokol notifikasi enjin
// carian (Bing, Yandex, Seznam, Naver; Google TIDAK menyokongnya — untuk Google, sitemap +
// Search Console sahaja jalannya). Satu POST ke api.indexnow.org disebarkan ke semua enjin
// peserta. Kunci pengesahan dihidangkan sebagai fail statik public/<KUNCI>.txt (spesifikasi
// indexnow.org: enjin semak fail itu untuk sahkan kita memiliki domain).
//
// Strategi: hantar SEMUA URL sitemap sekali sehari (job berjadual di server.js, sebelah
// runSemakanTakAktif). Spesifikasi membenarkan sehingga 10,000 URL sepos dan penghantaran
// semula URL sama tidak dihukum — jauh lebih ringkas dan kalis-gagal daripada mengesan
// "URL baharu sahaja" (yang perlu keadaan kekal dan mudah tercicir selepas restart pelayan).

const HOS = 'brief.adjung.com';
const KUNCI = '9d3d7f1d51f6dc46913e05d7e2522b97';

/** Kutip semua URL awam daripada sitemap sendiri, kemudian POST ke IndexNow. */
export async function hantarIndexNow() {
  try {
    const resSitemap = await fetch(`https://${HOS}/sitemap.xml`);
    if (!resSitemap.ok) throw new Error(`sitemap ${resSitemap.status}`);
    const xml = await resSitemap.text();
    const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, 10000);
    if (urlList.length === 0) return;

    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOS,
        key: KUNCI,
        keyLocation: `https://${HOS}/${KUNCI}.txt`,
        urlList,
      }),
    });
    // 200/202 = diterima. Kod lain direkodkan sahaja — SEO bukan laluan kritikal, kegagalan
    // tidak boleh sekali-kali menjejaskan pelayan utama.
    if (res.status !== 200 && res.status !== 202) {
      console.warn(`IndexNow: respons ${res.status} untuk ${urlList.length} URL`);
    } else {
      console.log(`IndexNow: ${urlList.length} URL dihantar (${res.status})`);
    }
  } catch (err) {
    console.warn('IndexNow gagal:', err?.message);
  }
}
