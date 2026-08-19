import React from 'react';
import { safeParseInline } from '../../utils';

/**
 * MODUL PETIKAN — paparan awam (Fasa 5).
 *
 * SATU bentuk paparan sahaja (`PetikanBar`) untuk SEMUA saiz skrin (2026-08-19, GANTIKAN reka
 * bentuk "dua bentuk" asal — lihat sejarah di bawah). Arahan terus Izzat: "letakkan petikan tu
 * di atas footer mcm versi telefon dan skrin sempit" — blok di atas footer, dipusatkan, gaya
 * PetikanStatik lama, kini terpakai pada SEMUA lebar skrin, bukan cuma skrin sempit.
 *
 * Keputusan Izzat yang dikunci dan TIDAK boleh diubah tanpa arahan baharu:
 *   1. PEMASA AUTOMATIK. Petikan bertukar setiap `TEMPOH_PUTARAN_MS` (setInterval), TIDAK KIRA
 *      tatalan pembaca — dijeda hanya oleh hover/fokus (`kunciTuding`) dan Focus View terbuka
 *      (`beku`). (Arahan terus Izzat, sesi sama: "jangan buat pertukaran berdasarkan scroll!
 *      menyusahkan guna scroll.")
 *   2. Ketua Editor boleh mematikan keseluruhan ciri. Kalau `aktif` palsu, modul ini tidak
 *      merender apa-apa langsung (gerbang sebenar ada di pelayan, lihat petikanRoutes.js).
 *
 *   SEJARAH (untuk konteks, bukan rujukan semasa — SEMUA berlaku dalam SATU hari, 19/8/2026):
 *     (a) Reka bentuk ASAL pagi: "Petikan BUKAN carousel/pemasa... bertukar SEMATA-MATA mengikut
 *         tatalan", dua bentuk berasingan (marginalia terapung desktop >=1536px vs blok statik
 *         skrin sempit, TIADA putaran pada versi statik).
 *     (b) Tengahari: tatalan dikemas kini jadi dua-hala (900px -> 1800px, beberapa pelarasan).
 *     (c) Petang: (a)+(b) DITERBALIKKAN — tukar kepada pemasa automatik (arahan "jangan scroll").
 *     (d) Lewat petang: DUA BENTUK digabung jadi SATU — kedudukan marginalia terapung dibuang
 *         sepenuhnya, gaya blok-atas-footer (dahulu khusus skrin sempit) kini sejagat.
 *   Sengaja dibiarkan dalam komen supaya jelas ni PERUBAHAN SEDAR berperingkat, bukan kekeliruan
 *   — jangan pulangkan ke reka bentuk lama (marginalia terapung/dua bentuk/tatalan) tanpa arahan
 *   Izzat yang baharu.
 *
 * Modul ini SENGAJA gagal senyap. Petikan ialah ciri SAMPINGAN — kalau ia gagal (rangkaian mati,
 * data rosak, kolam kosong), pembaca patut nampak halaman biasa tanpa petikan, BUKAN halaman
 * rosak. Tiada pengecualian dilemparkan ke atas daripada fail ini.
 */

export interface PetikanAwam {
  id: string;
  teks: string;
  pengarang: string;
  karya: string;
  rujukan: string;
  kategori: string | null;
  labelTerjemahan: string;
  pautanBuku: string;
  labelPautan: string;
}

// ---------------------------------------------------------------------------
// Sumber data — SATU permintaan rangkaian untuk KEDUA-DUA bentuk paparan.
// ---------------------------------------------------------------------------

/** Cache peringkat modul — kekal walaupun kini SATU komponen sahaja (bukan dua serentak seperti
 *  reka bentuk lama), sebab StrictMode/HMR pembangunan boleh pasang semula komponen berkali-kali;
 *  cache elak permintaan berulang tanpa perlu. */
let kolamJanji: Promise<{ aktif: boolean; petikan: PetikanAwam[] }> | null = null;

function ambilKolam() {
  if (!kolamJanji) {
    kolamJanji = fetch('/api/public/petikan')
      .then((r) => (r.ok ? r.json() : { aktif: false, petikan: [] }))
      .then((d) => ({
        aktif: d?.aktif === true,
        petikan: Array.isArray(d?.petikan) ? (d.petikan as PetikanAwam[]) : [],
      }))
      .catch(() => ({ aktif: false, petikan: [] as PetikanAwam[] }));
  }
  return kolamJanji;
}

function useKolamPetikan() {
  const [kolam, setKolam] = React.useState<PetikanAwam[]>([]);
  const [aktif, setAktif] = React.useState(false);

  React.useEffect(() => {
    let hidup = true;
    ambilKolam().then((d) => {
      if (!hidup) return;
      setAktif(d.aktif);
      setKolam(d.petikan);
    });
    return () => { hidup = false; };
  }, []);

  return { kolam, aktif };
}

// ---------------------------------------------------------------------------
// Keadaan sesi — indeks dikekalkan merentasi navigasi dalam lawatan yang sama.
// ---------------------------------------------------------------------------

const KUNCI_SESI = 'adjung_petikan_sesi';

interface KeadaanSesi { tarikh: string; indeks: number; ditutup: boolean }

function bacaSesi(): KeadaanSesi {
  try {
    const mentah = sessionStorage.getItem(KUNCI_SESI);
    if (!mentah) return { tarikh: '', indeks: 0, ditutup: false };
    const d = JSON.parse(mentah);
    return {
      tarikh: typeof d?.tarikh === 'string' ? d.tarikh : '',
      indeks: Number.isInteger(d?.indeks) ? d.indeks : 0,
      ditutup: d?.ditutup === true,
    };
  } catch {
    // sessionStorage boleh melempar dalam mod peribadi sesetengah pelayar.
    return { tarikh: '', indeks: 0, ditutup: false };
  }
}

function tulisSesi(k: KeadaanSesi) {
  try { sessionStorage.setItem(KUNCI_SESI, JSON.stringify(k)); } catch { /* abaikan */ }
}

// ---------------------------------------------------------------------------
// Persembahan dikongsi
// ---------------------------------------------------------------------------

/** Hierarki warna (2026-08-19, laporan Izzat: "tukar semua petikan jadi warna hitam kecuali nama
 *  pengarang, kekalkan warna maroon"). Maroon kini eksklusif untuk NAMA PENGARANG — satu-satunya
 *  elemen yang perlu "menonjol" pada pandangan pertama untuk pembaca kenal pasti sumber; karya
 *  dan rujukan ialah metadata SOKONGAN, jadi kekal warna teks biasa (stone-600), bukan maroon. */
const Atribusi: React.FC<{ p: PetikanAwam; kelas: string }> = ({ p, kelas }) => (
  <div className={`${kelas} text-stone-600`}>
    <span className="font-semibold text-[#802334]">{p.pengarang}</span>
    {/* Nama karya condong — konvensyen tipografi standard untuk judul buku/karya, bukan hiasan. */}
    {p.karya && <span> · <em>{p.karya}</em></span>}
    {p.rujukan && <span> · {p.rujukan}</span>}
  </div>
);

// Label "Diterjemahkan daripada bahasa X" DIBUANG daripada paparan pembaca (2026-08-19, Izzat:
// "saya syorkan awak buang terus label ... sbb dlm amalan malaysia, terjemahan dianggap sama
// dengan teks asal") — keputusan editorial eksplisit, ganti keputusan asal "label WAJIB" yang
// dicatat sesi lepas. Data `labelTerjemahan` KEKAL dihantar API (PetikanConfig.js/petikanRoutes.js
// tidak disentuh) — cuma TIDAK dirender di sini. Status terjemahan tetap dijejaki & disahkan
// secara editorial (PetikanConsole.tsx, Semakan/Koleksi), cuma tidak lagi didedahkan kepada
// pembaca sebagai label berasingan pada petikan.

const PautanBuku: React.FC<{ p: PetikanAwam; kelas: string }> = ({ p, kelas }) => {
  if (!p.pautanBuku) return null;
  return (
    <a
      href={p.pautanBuku}
      target="_blank"
      rel="noopener noreferrer"
      className={kelas}
    >
      {p.labelPautan || 'Lihat buku'}
    </a>
  );
};

// ---------------------------------------------------------------------------
// PetikanBar — blok tunggal di atas footer, SEMUA saiz skrin, putaran berpemasa
// ---------------------------------------------------------------------------

/** Tempoh (ms) SATU petikan dipaparkan sebelum bertukar automatik. Sejarah: pertukaran asalnya
 *  dipacu TATALAN (scroll) — beberapa pelarasan jarak (900 -> 200 -> 380 -> 1800px) dibuat dalam
 *  sesi yang sama sebelum keputusan diTUKAR SEPENUHNYA (2026-08-19, arahan terus Izzat: "jangan
 *  buat pertukaran berdasarkan scroll... menyusahkan guna scroll"). Mekanisme kini PEMASA, bukan
 *  tatalan — keputusan terkunci #1 lama ("Petikan BUKAN carousel/pemasa") DIGANTIKAN arahan
 *  eksplisit ni, bukan diabaikan senyap. 10 saat ialah anggaran munasabah untuk marginalia dibaca
 *  selesa tanpa terasa terlalu pantas/perlahan — laras nilai ni kalau Izzat rasa perlu selepas
 *  lihat sendiri di pengeluaran. */
const TEMPOH_PUTARAN_MS = 10000;

/** Transisi DUA FASA (2026-08-19, susulan video sebenar Izzat: "pertukaran terlalu mendadak...
 *  state lama hilang dan state baharu terasa muncul sebagai penggantian kandungan"). Fade tunggal
 *  (opacity sahaja, satu tempoh) tak cukup kalau TIMING salah — teks lama & baharu masih terasa
 *  "swap" kalau tukar berlaku terlalu awal/lewat berbanding fade. Urutan MESTI tepat:
 *
 *    opacity 1 --(fade-KELUAR ${TEMPOH_FADE_KELUAR_MS}ms)--> opacity 0
 *             --(jeda KOSONG ${TEMPOH_JEDA_MS}ms, kandungan ditukar SEMASA fasa ni)-->
 *             opacity 0 --(fade-MASUK ${TEMPOH_FADE_MASUK_MS}ms)--> opacity 1
 *
 *  Jumlah ~920ms — lambat berbanding fade tunggal terdahulu (420ms), tetapi kerana TIADA
 *  pergerakan spatial (translate/scale/height — lihat nota className di bawah, SEMUA dibuang),
 *  ia tetap terasa tenang, bukan perlahan. Dua tempoh BERBEZA (350 keluar vs 450 masuk) sengaja
 *  tidak simetri — fade-masuk sedikit lebih perlahan supaya kemunculan tidak "terkejut". */
const TEMPOH_FADE_KELUAR_MS = 350;
const TEMPOH_JEDA_MS = 120;
const TEMPOH_FADE_MASUK_MS = 450;

export const PetikanBar: React.FC<{ beku?: boolean }> = ({ beku = false }) => {
  const { kolam, aktif } = useKolamPetikan();
  const [indeks, setIndeks] = React.useState(() => bacaSesi().indeks);
  const [ditutup, setDitutup] = React.useState(() => bacaSesi().ditutup);
  const [pudar, setPudar] = React.useState(false);
  // Tempoh transisi SEMASA — berbeza ikut fasa (350ms fade-keluar vs 450ms fade-masuk, lihat
  // nota TEMPOH_FADE_KELUAR_MS di atas). Dikawal via inline style (bukan kelas Tailwind statik)
  // supaya satu elemen boleh bertukar tempoh mengikut arah tanpa dua salinan className.
  const [tempohTransisiMs, setTempohTransisiMs] = React.useState(TEMPOH_FADE_KELUAR_MS);

  /** Pembaca sedang tuding/fokus tak patut ditukar bawah dia. Disimpan sebagai ref (bukan state)
   *  kerana dibaca dalam pemasa yang tidak dipasang semula setiap render. */
  const kunciTuding = React.useRef(false);
  const bekuRef = React.useRef(beku);
  bekuRef.current = beku;

  const kurangGerak = React.useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    []
  );

  // Indeks tersimpan hanya sah untuk kolam HARI YANG SAMA. Kolam esok panjangnya boleh berbeza,
  // jadi indeks lama boleh terkeluar julat atau menunjuk petikan yang tiada kaitan.
  React.useEffect(() => {
    if (kolam.length === 0) return;
    const sesi = bacaSesi();
    const hariIni = new Date().toISOString().slice(0, 10);
    if (sesi.tarikh !== hariIni) {
      setIndeks(0);
      tulisSesi({ tarikh: hariIni, indeks: 0, ditutup: sesi.ditutup });
    } else if (sesi.indeks >= kolam.length) {
      setIndeks(0);
      tulisSesi({ ...sesi, indeks: 0 });
    }
  }, [kolam.length]);

  // Putaran automatik berpemasa (2026-08-19, arahan terus Izzat: "jangan buat pertukaran
  // berdasarkan scroll... menyusahkan guna scroll"). Sentiasa MAJU sahaja.
  React.useEffect(() => {
    if (kolam.length < 2 || ditutup) return;

    // Transisi DUA FASA (2026-08-19, susulan video sebenar — lihat nota TEMPOH_FADE_KELUAR_MS di
    // atas fail). Urutan MESTI tepat: fade-keluar penuh -> tukar kandungan SEMASA tak kelihatan
    // (opacity 0) -> jeda kosong -> fade-masuk. `kurangGerak` langkau kesemua fasa, tukar terus.
    const tukarIndeks = () => {
      setIndeks((sebelum) => {
        const baharu = (sebelum + 1) % kolam.length;
        tulisSesi({ tarikh: new Date().toISOString().slice(0, 10), indeks: baharu, ditutup: false });
        return baharu;
      });
    };

    const langkah = () => {
      if (kunciTuding.current || bekuRef.current) return;
      if (kurangGerak) { tukarIndeks(); return; }

      setTempohTransisiMs(TEMPOH_FADE_KELUAR_MS);
      setPudar(true); // fade-KELUAR bermula — teks LAMA masih dipaparkan sepanjang fasa ni
      setTimeout(() => {
        // opacity 0 PENUH sekarang — selamat tukar kandungan, mata tidak nampak langsung.
        tukarIndeks();
        setTimeout(() => {
          // jeda kosong selesai — mula fade-MASUK dengan tempoh berlainan (lebih perlahan).
          setTempohTransisiMs(TEMPOH_FADE_MASUK_MS);
          setPudar(false);
        }, TEMPOH_JEDA_MS);
      }, TEMPOH_FADE_KELUAR_MS);
    };

    const pemasa = setInterval(langkah, TEMPOH_PUTARAN_MS);
    return () => clearInterval(pemasa);
  }, [kolam.length, ditutup, kurangGerak]);

  if (!aktif || kolam.length === 0 || ditutup) return null;

  const p = kolam[Math.min(indeks, kolam.length - 1)];
  if (!p) return null;

  const tutup = () => {
    setDitutup(true);
    tulisSesi({ tarikh: new Date().toISOString().slice(0, 10), indeks, ditutup: true });
  };

  return (
    // KEDUDUKAN (2026-08-19, arahan terus Izzat: "letakkan petikan tu di atas footer mcm versi
    // telefon dan skrin sempit") — blok DIPUSATKAN di atas footer, SEMUA saiz skrin (tiada lagi
    // `2xl:hidden`/`hidden 2xl:flex` — bekas dua reka bentuk berasingan digabung jadi satu; lihat
    // sejarah penuh di komen kepala fail). Gaya (garis atas, penengahan, ruang lapang) diwarisi
    // terus daripada bekas PetikanStatik (khusus skrin sempit dahulu), kini sejagat.
    <section
      className="w-full max-w-5xl mx-auto mt-6 px-1"
      aria-label="Petikan pilihan"
    >
      <div
        className="relative border-t border-stone-200 pt-6 text-center"
        onMouseEnter={() => { kunciTuding.current = true; }}
        onMouseLeave={() => { kunciTuding.current = false; }}
        onFocusCapture={() => { kunciTuding.current = true; }}
        onBlurCapture={() => { kunciTuding.current = false; }}
      >
        <button
          type="button"
          onClick={tutup}
          aria-label="Tutup petikan"
          title="Tutup petikan"
          className="absolute right-1 top-3 text-stone-300 hover:text-[#802334] text-[15px] leading-none p-1 transition-colors select-none"
        >
          ×
        </button>

        {/* Transisi DUA FASA (2026-08-19, susulan video sebenar — lihat nota TEMPOH_FADE_KELUAR_MS
            di atas fail). `translate-y` TIDAK PERNAH digunakan (arahan eksplisit: "Jangan gunakan
            slide/translate... Itu akan menjadikannya widget/carousel") — OPACITY SAHAJA. Tempoh
            dikawal via `tempohTransisiMs` (inline style) supaya fade-keluar (350ms) dan fade-masuk
            (450ms) boleh berbeza tanpa dua salinan className. */}
        <div
          className={`transition-opacity ease-in-out ${pudar ? 'opacity-0' : 'opacity-100'}`}
          style={{ transitionDuration: kurangGerak ? '0ms' : `${tempohTransisiMs}ms` }}
        >
          {/* TEGAK secara lalai (arahan Izzat, 19/8/2026) — petikan dibezakan daripada teks
              sekeliling oleh tanda petik + kedudukan/gaya blok, bukan oleh gaya huruf. Saiz 12px
              (bukan 17px asal) — 17px melampaui saiz kandungan editorial sekeliling (~13-16px),
              menjadikan petikan sampingan kelihatan lebih penting drpd berita sebenar (laporan
              Izzat, versi telefon — kini terpakai sejagat sebab reka bentuk digabung). */}
          <p className="font-serif text-stone-900 text-[12px] leading-[1.7] max-w-2xl mx-auto">
            <span aria-hidden="true" className="text-[#802334] text-2xl leading-none align-[-4px]">&ldquo;</span>
            {safeParseInline(p.teks)}
            <span aria-hidden="true" className="text-[#802334]/60">&rdquo;</span>
          </p>
          {/* Hierarki (2026-08-19, laporan Izzat): petikan hitam ialah elemen UTAMA, metadata di
              bawah dikecilkan supaya jelas SEKUNDER. Maroon eksklusif nama pengarang (Atribusi).
              Label terjemahan DIBUANG (keputusan Izzat berasingan, lihat Atribusi/komen atas). */}
          <Atribusi p={p} kelas="mt-3 font-sans text-[11px] tracking-wide" />
          <PautanBuku p={p} kelas="mt-2 inline-block font-sans text-[10px] font-semibold text-[#802334]/80 underline underline-offset-2 hover:text-[#802334] transition-colors" />
        </div>
      </div>
    </section>
  );
};
