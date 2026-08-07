import React from 'react';
import { Tooltip } from './Tooltip';

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

export interface EntriGlosari {
  istilah: string;
  maksud: string;
}

/** Peta carian pantas: kunci huruf kecil -> entri asal (untuk papar maksud + kekalkan kes asal
 *  teks artikel semasa dipaparkan — istilah SENDIRI tak diubah, cuma dibalut). Entri tanpa
 *  `maksud` (kosong) dilangkau terus — tiada gunanya jadi tooltip tanpa kandungan. */
export function binaPetaGlosari(entri: EntriGlosari[]): Map<string, EntriGlosari> {
  const peta = new Map<string, EntriGlosari>();
  for (const e of entri) {
    if (!e.istilah?.trim() || !e.maksud?.trim()) continue;
    peta.set(e.istilah.trim().toLowerCase(), e);
  }
  return peta;
}

const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

/** Serpihan hasil pisahan — `entri` hadir HANYA pada serpihan yang perlu dibalut tooltip
 *  (kemunculan pertama istilah tu dalam pemanggilan `sudahDitanda` yang sama). */
interface Serpihan {
  teks: string;
  entri: EntriGlosari | null;
}

/**
 * Pisahkan teks kepada serpihan biasa + serpihan istilah glosari (sempadan perkataan, tak
 * case-sensitive). `sudahDitanda` ialah Set kongsi merentasi SEMUA panggilan bagi SATU artikel
 * (tajuk + setiap perenggan huraian) — kekalkan rujukan Set YANG SAMA supaya "kali pertama sahaja"
 * benar-benar dikira sepanjang keseluruhan artikel, bukan reset setiap perenggan.
 */
export function pisahkanGlosari(
  teks: string,
  peta: Map<string, EntriGlosari>,
  sudahDitanda: Set<string>
): Serpihan[] {
  if (!teks || peta.size === 0) return [{ teks, entri: null }];

  // Susun istilah PANJANG dahulu — elak "Bidang Ilmu" terpotong oleh padanan separa "Bidang".
  const istilahTersusun = [...peta.keys()].sort((a, b) => b.length - a.length);
  const corak = istilahTersusun.map((i) => i.replace(ESCAPE_REGEX, '\\$&')).join('|');
  const regex = new RegExp(`\\b(${corak})\\b`, 'giu');

  const hasil: Serpihan[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(teks)) !== null) {
    if (match.index > lastIndex) {
      hasil.push({ teks: teks.slice(lastIndex, match.index), entri: null });
    }
    const kunci = match[0].toLowerCase();
    const entri = peta.get(kunci) || null;
    if (entri && !sudahDitanda.has(kunci)) {
      sudahDitanda.add(kunci);
      hasil.push({ teks: match[0], entri });
    } else {
      hasil.push({ teks: match[0], entri: null });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < teks.length) hasil.push({ teks: teks.slice(lastIndex), entri: null });
  return hasil;
}

/** Bungkusan visual satu istilah bertanda — garis putus-putus halus, warna teks TAK berubah
 *  (keputusan Izzat: gaya halus, bukan menjerit). `cursor-help` + Tooltip sedia ada projek
 *  (sokong hover DAN fokus papan kekunci). */
export const IstilahGlosariSpan: React.FC<{ teks: string; entri: EntriGlosari }> = ({ teks, entri }) => (
  <Tooltip text={entri.maksud}>
    <span
      className="cursor-help border-b border-dotted border-current/50"
      style={{ color: 'inherit' }}
    >
      {teks}
    </span>
  </Tooltip>
);

/** Render satu keping teks (tajuk ATAU satu perenggan huraian) dengan istilah glosari dibalut.
 *  `renderTeksBiasa` pilihan — hantar `safeParseInline` untuk perenggan huraian (supaya nota
 *  kaki/petikan/autocondong sedia ada kekal terpakai pada bahagian bukan-istilah); biar default
 *  (teks mentah) untuk tajuk, yang memang dipaparkan mentah di FocusView.tsx sedia ada. */
export function renderDenganGlosari(
  teks: string,
  peta: Map<string, EntriGlosari>,
  sudahDitanda: Set<string>,
  renderTeksBiasa: (t: string) => React.ReactNode = (t) => t
): React.ReactNode {
  const serpihan = pisahkanGlosari(teks, peta, sudahDitanda);
  if (serpihan.length === 1 && !serpihan[0].entri) return renderTeksBiasa(teks);
  return serpihan.map((s, i) =>
    s.entri
      ? <IstilahGlosariSpan key={i} teks={s.teks} entri={s.entri} />
      : <React.Fragment key={i}>{renderTeksBiasa(s.teks)}</React.Fragment>
  );
}
