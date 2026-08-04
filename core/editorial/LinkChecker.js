// Semakan pautan mati (2026-08-05, Fasa 8b — "Format sumber"). Semak setiap URL sumber UNIK
// (editorial_attribute_values, attributeId 'url') dengan permintaan HEAD (jatuh balik ke GET kalau
// pelayan sasaran tolak HEAD — banyak pelayan berita buat begitu), simpan keputusan dalam
// source_link_checks (satu rekod PER URL, bukan per-kandungan — URL sama dikongsi rentas
// kandungan disemak sekali sahaja).
//
// Skop SENGAJA tak termasuk URL Ticker (system_settings.inTheNewsText, blob teks "---"-berpisah,
// bukan EAV) — kandungan Ticker disegar semula kerap (RSS automatik/manual setiap beberapa jam),
// jadi pautan mati di situ jarang bertahan lama berbanding kandungan kad bento yang boleh kekal
// bulanan. Boleh diperluas nanti kalau perlu.
//
// Jujukan (bukan serentak) sengaja — bilangan URL unik biasanya puluhan sahaja (bukan ribuan),
// dan mengelak ledakan permintaan serentak ke banyak pelayan luar sekali gus.
const HAD_MASA_SETIAP_URL_MS = 8000;
const HAD_KELEWATAN_ANTARA_URL_MS = 150;

const tidur = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function semakSatuUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HAD_MASA_SETIAP_URL_MS);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    // Sesetengah pelayan (terutama CMS berita) tolak HEAD dengan 403/405 walaupun GET berjaya —
    // cuba sekali lagi dengan GET sebelum anggap URL benar-benar mati.
    if (res.status === 403 || res.status === 405) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    return { ok: res.status < 400, httpStatus: res.status, errorMessage: null };
  } catch (err) {
    return { ok: false, httpStatus: null, errorMessage: err.name === 'AbortError' ? 'Tamat masa' : (err.message || 'Ralat rangkaian') };
  } finally {
    clearTimeout(timeout);
  }
}

/** Kumpul semua URL sumber unik daripada editorial_attribute_values, semak satu-satu, simpan
 *  keputusan. Dibalut cuba/tangkap PENUH oleh pemanggil (server.js) — kegagalan semakan TIDAK
 *  sekali-kali rebahkan server, sama corak macam penjadual lain di situ. */
export async function checkAllSourceLinks(dbAll, dbRun) {
  const rows = await dbAll(
    "SELECT DISTINCT valueText AS url FROM editorial_attribute_values WHERE attributeId = 'url' AND valueText IS NOT NULL AND TRIM(valueText) != '' AND valueText != '#'"
  );
  const urls = rows.map((r) => r.url).filter((u) => /^https?:\/\//i.test(u));

  let diperiksa = 0;
  let mati = 0;
  for (const url of urls) {
    const hasil = await semakSatuUrl(url);
    if (!hasil.ok) mati += 1;
    diperiksa += 1;
    await dbRun(
      `INSERT INTO source_link_checks (url, ok, httpStatus, errorMessage, checkedAt)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         ok = excluded.ok, httpStatus = excluded.httpStatus,
         errorMessage = excluded.errorMessage, checkedAt = excluded.checkedAt`,
      [url, hasil.ok ? 1 : 0, hasil.httpStatus, hasil.errorMessage, new Date().toISOString()]
    );
    await tidur(HAD_KELEWATAN_ANTARA_URL_MS);
  }
  return { diperiksa, mati };
}

export default checkAllSourceLinks;
