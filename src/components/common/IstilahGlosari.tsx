import React from 'react';
import { Tooltip } from './Tooltip';
import { resolveDefinisiGlosari as resolveDefinisiGlosariTulen } from '../../../core/editorial/GlosariResolusi.js';

// Glosari sebagai tooltip hover pada kandungan sebenar (2026-08-07, permintaan Izzat: "apa kata
// jadikan glosari ni sebagai glosari untuk makna perkataan2 dalam kandungan sebenar yg bila user
// hover, akan keluar makna pada tooltip?"). Sebelum ni Glosari (jadual `glosari_istilah`, guna
// semula di sini — medan `istilah`/`maksud` sahaja, `elakkan` kekal untuk tujuan asal ia di
// Editorium: bentuk yang patut dielakkan editor) ialah rujukan PASIF sepenuhnya — dibaca manusia
// di Editorium sahaja, tak pernah menyentuh apa pembaca nampak. Ciri ni yang PERTAMA menjadikan
// Glosari berkesan kepada pembaca sebenar.
//
// Keputusan Izzat (2026-08-07): kali PERTAMA sahaja per artikel (bukan setiap kemunculan), skop
// tajuk+huraian+huraian panjang, padanan TAK case-sensitive, gaya garis putus-putus halus (bukan
// warna menjerit — sepadan tipografi tenang Adjung).
//
// Glosari Berasaskan Bidang — Sense (2026-08-16, arahan Izzat, seni bina disahkan
// docs/glossary-architecture-proposal.md v3) — satu istilah kini boleh ada BANYAK Sense (makna
// khusus mengikut Bidang kandungan tempat ia muncul), bukan lagi SATU `maksud` sejagat sahaja.
// Resolusi berlaku di SINI (client), bukan pelayan — pelayan (glosariRoutes.js) cuma hantar
// peta PENUH sekali (senses + Bidang setiap istilah), setiap artikel resolve sendiri ikut
// Bidangnya semasa render (Bidang berbeza setiap artikel, peta sama untuk semua).

export interface BidangSense {
  id: string;
  name: string;
  slug: string;
}

export interface SenseGlosari {
  id: string;
  definisi: string;
  amSense: boolean;
  bidang: BidangSense[];
}

export interface EntriGlosari {
  istilah: string;
  maksud: string;
  senses?: SenseGlosari[];
}

/** Hasil resolusi SATU istilah bagi SATU Bidang konteks tertentu. `namaBidang` bukan-null HANYA
 *  bila `definisi` datang daripada Sense KHUSUS Bidang (peraturan muktamad Izzat) — Sense am
 *  dan `maksud` fallback KEDUA-DUANYA `namaBidang: null` (tiada label dipaparkan). */
export interface HasilResolusiGlosari {
  definisi: string;
  namaBidang: string | null;
}

const hurufBesarAwal = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Resolusi konteks MUKTAMAD (docs/glossary-architecture-proposal.md v3, Seksyen 3) —
 * Sense khusus sepadan Bidang > Sense am > `maksud` lama > tiada tooltip. Pembalut BERTAIP
 * sahaja — logik SEBENAR (tulen, JS biasa, diuji berasingan tests/glosariResolusi.test.js)
 * hidup di core/editorial/GlosariResolusi.js, corak SAMA seperti ContentBudget.js/
 * GeometryConfig.js diimport terus oleh SlotManagerModal.tsx — elak dua salinan logik boleh
 * terpesong (pelayan tiada guna fungsi ni, tapi kod client MESTI satu sumber sahaja).
 */
export function resolveDefinisiGlosari(
  entri: EntriGlosari,
  bidangKonteks: string | null | undefined
): HasilResolusiGlosari | null {
  return resolveDefinisiGlosariTulen(entri, bidangKonteks);
}

/** Peta carian pantas: kunci huruf kecil -> entri asal. Entri disertakan jika ADA sekurang-
 *  kurangnya SATU sumber definisi (maksud lama ATAU >=1 Sense) — resolusi SEBENAR (Sense khusus
 *  sepadan Bidang tertentu, atau tiada langsung) ditentukan kemudian per-artikel oleh
 *  resolveDefinisiGlosari(), bukan di sini. */
export function binaPetaGlosari(entri: EntriGlosari[]): Map<string, EntriGlosari> {
  const peta = new Map<string, EntriGlosari>();
  for (const e of entri) {
    if (!e.istilah?.trim()) continue;
    const adaMaksud = !!e.maksud?.trim();
    const adaSense = Array.isArray(e.senses) && e.senses.length > 0;
    if (!adaMaksud && !adaSense) continue;
    peta.set(e.istilah.trim().toLowerCase(), e);
  }
  return peta;
}

const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

/** Serpihan hasil pisahan — `entri`/`resolusi` hadir HANYA pada serpihan yang perlu dibalut
 *  tooltip (kemunculan pertama istilah tu YANG ADA definisi sah bagi Bidang konteks semasa,
 *  dalam pemanggilan `sudahDitanda` yang sama). */
interface Serpihan {
  teks: string;
  entri: EntriGlosari | null;
  resolusi: HasilResolusiGlosari | null;
}

/**
 * Pisahkan teks kepada serpihan biasa + serpihan istilah glosari (sempadan perkataan, tak
 * case-sensitive). `sudahDitanda` ialah Set kongsi merentasi SEMUA panggilan bagi SATU artikel
 * (tajuk + setiap perenggan huraian) — kekalkan rujukan Set YANG SAMA supaya "kali pertama sahaja"
 * benar-benar dikira sepanjang keseluruhan artikel, bukan reset setiap perenggan.
 *
 * `bidangKonteks` (2026-08-16) — nama Bidang kandungan SEMASA (artikel/kad yang sedang
 * dirender), diperlukan untuk resolusi Sense. Istilah yang TIADA definisi sah bagi Bidang ni
 * (semua Sense khusus tak sepadan, tiada Sense am, tiada maksud lama) dilangkau SEPENUHNYA
 * (bukan ditanda "sudah dilihat" — walau jarang berkesan sebab bidangKonteks tetap sepanjang
 * SATU artikel, konsisten dgn semantik "kali pertama YANG BOLEH papar tooltip").
 */
export function pisahkanGlosari(
  teks: string,
  peta: Map<string, EntriGlosari>,
  sudahDitanda: Set<string>,
  bidangKonteks: string | null | undefined
): Serpihan[] {
  if (!teks || peta.size === 0) return [{ teks, entri: null, resolusi: null }];

  // Susun istilah PANJANG dahulu — elak "Bidang Ilmu" terpotong oleh padanan separa "Bidang".
  const istilahTersusun = [...peta.keys()].sort((a, b) => b.length - a.length);
  const corak = istilahTersusun.map((i) => i.replace(ESCAPE_REGEX, '\\$&')).join('|');
  const regex = new RegExp(`\\b(${corak})\\b`, 'giu');

  const hasil: Serpihan[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(teks)) !== null) {
    if (match.index > lastIndex) {
      hasil.push({ teks: teks.slice(lastIndex, match.index), entri: null, resolusi: null });
    }
    const kunci = match[0].toLowerCase();
    const entri = peta.get(kunci) || null;
    const resolusi = entri ? resolveDefinisiGlosari(entri, bidangKonteks) : null;
    if (entri && resolusi && !sudahDitanda.has(kunci)) {
      sudahDitanda.add(kunci);
      hasil.push({ teks: match[0], entri, resolusi });
    } else {
      hasil.push({ teks: match[0], entri: null, resolusi: null });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < teks.length) hasil.push({ teks: teks.slice(lastIndex), entri: null, resolusi: null });
  return hasil;
}

/** Bungkusan visual satu istilah bertanda — garis putus-putus halus, warna teks TAK berubah
 *  (keputusan Izzat: gaya halus, bukan menjerit). `cursor-help` + Tooltip sedia ada projek
 *  (sokong hover DAN fokus papan kekunci). Format tooltip MUKTAMAD (Izzat, docs v3 Seksyen 7):
 *  "{Istilah}: (Bidang) {definisi}" bila Sense KHUSUS diguna, "{Istilah}: {definisi}" selainnya
 *  (Sense am / maksud lama — TIADA label Bidang). */
export const IstilahGlosariSpan: React.FC<{ teks: string; istilah: string; resolusi: HasilResolusiGlosari }> = ({ teks, istilah, resolusi }) => {
  const namaTerkawal = hurufBesarAwal(istilah.trim());
  const isiTooltip = resolusi.namaBidang
    ? `${namaTerkawal}: (${resolusi.namaBidang}) ${resolusi.definisi}`
    : `${namaTerkawal}: ${resolusi.definisi}`;
  return (
    <Tooltip text={isiTooltip}>
      <span
        className="cursor-help border-b border-dotted border-current/50"
        style={{ color: 'inherit' }}
      >
        {teks}
      </span>
    </Tooltip>
  );
};

/** Render satu keping teks (tajuk ATAU satu perenggan huraian) dengan istilah glosari dibalut.
 *  `bidangKonteks` — nama Bidang kandungan semasa (Seksyen 3, docs v3), diperlukan untuk
 *  resolusi Sense; `null`/`undefined`/kosong selamat (Ticker, dsb.) — terus fallback.
 *  `renderTeksBiasa` pilihan — hantar `safeParseInline` untuk perenggan huraian (supaya nota
 *  kaki/petikan/autocondong sedia ada kekal terpakai pada bahagian bukan-istilah); biar default
 *  (teks mentah) untuk tajuk, yang memang dipaparkan mentah di FocusView.tsx sedia ada. */
export function renderDenganGlosari(
  teks: string,
  peta: Map<string, EntriGlosari>,
  sudahDitanda: Set<string>,
  bidangKonteks: string | null | undefined,
  renderTeksBiasa: (t: string) => React.ReactNode = (t) => t
): React.ReactNode {
  const serpihan = pisahkanGlosari(teks, peta, sudahDitanda, bidangKonteks);
  if (serpihan.length === 1 && !serpihan[0].entri) return renderTeksBiasa(teks);
  return serpihan.map((s, i) =>
    s.entri && s.resolusi
      ? <IstilahGlosariSpan key={i} teks={s.teks} istilah={s.entri.istilah} resolusi={s.resolusi} />
      : <React.Fragment key={i}>{renderTeksBiasa(s.teks)}</React.Fragment>
  );
}
