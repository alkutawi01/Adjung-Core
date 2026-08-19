import React from 'react';
import { safeParseInline } from '../../utils';

/**
 * MODUL PETIKAN — paparan awam (Fasa 5).
 *
 * Dua bentuk paparan, SATU sumber data:
 *   - `PetikanMargin`  — desktop lebar (>=1536px) sahaja. Marginalia terapung di margin kiri
 *                        bawah, bertukar apabila pembaca menatal, bukan mengikut pemasa.
 *   - `PetikanStatik`  — skrin sempit. SATU petikan tetap di atas footer, tiada putaran langsung.
 *
 * Keputusan Izzat yang dikunci dan TIDAK boleh diubah tanpa arahan baharu:
 *   1. Petikan BUKAN carousel/pemasa. Ia bertukar SEMATA-MATA mengikut tatalan pembaca — kalau
 *      pembaca duduk diam membaca, petikan kekal.
 *   1b. DUA ARAH (dikemas kini 2026-08-19, selepas ujian langsung pengeluaran — reka bentuk asal
 *      "900px + tunggu pembaca berhenti" terasa terlalu perlahan/tak responsif). Kini: menatal ke
 *      BAWAH beberapa baris memajukan ke petikan seterusnya; menatal ke ATAS beberapa baris
 *      KEMBALI ke petikan sebelum ini — pusingan boleh diterbalikkan sepenuhnya, bukan sehala.
 *   2. Skrin sempit STATIK. Bukan versi kecil marginalia yang berputar — gaya berbeza sepenuhnya.
 *   3. Ketua Editor boleh mematikan keseluruhan ciri. Kalau `aktif` palsu, modul ini tidak
 *      merender apa-apa langsung (gerbang sebenar ada di pelayan, lihat petikanRoutes.js).
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

/** Cache peringkat modul. `PetikanMargin` dan `PetikanStatik` kedua-duanya dipasang serentak
 *  (dibezakan CSS mengikut lebar skrin, bukan dipasang bersyarat), jadi tanpa cache ini
 *  setiap muatan halaman menghantar DUA permintaan identik untuk data yang sama. */
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

/** Petikan panjang tidak boleh dipotong (falsafah teras 1 — teks editorial tidak dipangkas
 *  secara mekanikal), jadi saiz font mengecil sedikit untuk petikan panjang supaya blok margin
 *  kekal munasabah tingginya. Had 400 aksara dikuatkuasakan semasa import, jadi ini menangani
 *  julat 250-400 sahaja. */
function saizTeksMargin(panjang: number) {
  if (panjang > 260) return 'text-[12px] leading-[1.55]';
  if (panjang > 160) return 'text-[13px] leading-[1.6]';
  return 'text-[14px] leading-[1.65]';
}

const Atribusi: React.FC<{ p: PetikanAwam; kelas: string }> = ({ p, kelas }) => (
  <div className={kelas}>
    <span className="font-semibold">{p.pengarang}</span>
    {/* Nama karya condong — konvensyen tipografi standard untuk judul buku/karya, bukan hiasan. */}
    {p.karya && <span> · <em>{p.karya}</em></span>}
    {p.rujukan && <span> · {p.rujukan}</span>}
  </div>
);

/** Label sumber terjemahan. Pembaca melihat Bahasa Melayu sahaja (keputusan Izzat), jadi apabila
 *  petikan berasal daripada kitab Arab atau buku Inggeris, itu MESTI dinyatakan — kata-kata yang
 *  dibaca ialah terjemahan, bukan kata-kata asal pengarang.
 *
 *  Dipaparkan sebagai metadata sekunder, BUKAN sebahagian petikan: lebih kecil, lebih pudar, dan
 *  di luar tanda petik. Teks label dikira di pelayan (labelTerjemahan, PetikanConfig.js) supaya
 *  peraturan "tiada label untuk sumber Melayu" hidup di satu tempat sahaja. */
const LabelTerjemahan: React.FC<{ p: PetikanAwam; kelas: string }> = ({ p, kelas }) => {
  if (!p.labelTerjemahan) return null;
  return <div className={kelas}>{p.labelTerjemahan}</div>;
};

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
// PetikanMargin — desktop lebar, terapung, bertukar mengikut tatalan
// ---------------------------------------------------------------------------

/** Jarak tatalan (px) bagi SATU langkah — lebih kurang beberapa baris teks badan. Direka semula
 *  2026-08-19 (Izzat, ujian langsung pengeluaran): nilai asal 900px + tunggu-berhenti 350ms
 *  terasa terlalu perlahan/tidak responsif — "sepatutnya scroll beberapa line, bertukar". Tiada
 *  tempoh tunggu-berhenti lagi; setiap kali ambang dilepasi, langkah berlaku serta-merta. */
const JARAK_TUKAR_PX = 200;

export const PetikanMargin: React.FC<{ beku?: boolean }> = ({ beku = false }) => {
  const { kolam, aktif } = useKolamPetikan();
  const [indeks, setIndeks] = React.useState(() => bacaSesi().indeks);
  const [ditutup, setDitutup] = React.useState(() => bacaSesi().ditutup);
  const [pudar, setPudar] = React.useState(false);

  /** Tatalan tidak boleh menukar petikan semasa pembaca sedang membacanya. Disimpan sebagai ref
   *  (bukan state) kerana ia dibaca di dalam pengendali tatalan yang tidak dipasang semula. */
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

  // Putaran DUA ARAH mengikut tatalan (2026-08-19, reka bentuk semula — lihat nota atas fail).
  // Menatal ke bawah beberapa baris memajukan; menatal ke atas beberapa baris KEMBALI ke
  // petikan sebelum ini. `terkumpul` boleh bernilai negatif — bukan sekadar "reset ke 0" apabila
  // arah berbalik, supaya tatalan kecil bolak-balik (contoh baca semula satu ayat) tidak
  // terkumpul silang sebagai langkah palsu.
  React.useEffect(() => {
    if (kolam.length < 2 || ditutup) return;

    let terkumpul = 0;
    let yTerakhir = window.scrollY;

    const langkah = (arah: 1 | -1) => {
      if (kunciTuding.current || bekuRef.current) return;
      setPudar(true);
      const tukar = () => {
        setIndeks((sebelum) => {
          const baharu = (sebelum + arah + kolam.length) % kolam.length;
          tulisSesi({ tarikh: new Date().toISOString().slice(0, 10), indeks: baharu, ditutup: false });
          return baharu;
        });
        setPudar(false);
      };
      if (kurangGerak) tukar();
      else setTimeout(tukar, 150);
    };

    const kendali = () => {
      const y = window.scrollY;
      const delta = y - yTerakhir;
      yTerakhir = y;
      terkumpul += delta;
      // `while` (bukan `if`) — satu gerakan tatal besar (cth PageDown) boleh melepasi ambang
      // berkali-kali sekali gus; setiap langkah dikira, bukan cuma satu langkah tunggal.
      while (terkumpul >= JARAK_TUKAR_PX) { terkumpul -= JARAK_TUKAR_PX; langkah(1); }
      while (terkumpul <= -JARAK_TUKAR_PX) { terkumpul += JARAK_TUKAR_PX; langkah(-1); }
    };

    window.addEventListener('scroll', kendali, { passive: true });
    return () => window.removeEventListener('scroll', kendali);
  }, [kolam.length, ditutup, kurangGerak]);

  if (!aktif || kolam.length === 0 || ditutup) return null;

  const p = kolam[Math.min(indeks, kolam.length - 1)];
  if (!p) return null;

  const tutup = () => {
    setDitutup(true);
    tulisSesi({ tarikh: new Date().toISOString().slice(0, 10), indeks, ditutup: true });
  };

  return (
    // `hidden 2xl:block` — 1536px ialah lebar sebenar pertama yang meninggalkan margin kiri
    // cukup luas di luar bekas kandungan 1024px. Di bawah lebar itu, PetikanStatik mengambil alih.
    //
    // KEDUDUKAN (dibetulkan 2026-08-19, laporan Izzat "rapat ke tepi, sepatutnya tengah margin"):
    // `aside` ialah JALUR PENUH margin kiri sebenar — lebar dikira TEPAT sepadan formula
    // `max-w-5xl mx-auto` bekas kandungan (1024px), iaitu `calc((100vw - 1024px) / 2)` — bukan
    // offset piksel tetap dari tepi viewport. Kad sebenar (anak dalam) dipusatkan MELINTANG di
    // dalam jalur itu dengan flex, supaya pada skrin sangat lebar ia terapung di TENGAH ruang
    // kosong, bukan terikat ke tepi kiri viewport.
    <aside
      className="hidden 2xl:block fixed left-0 bottom-10 z-20"
      style={{ width: 'calc((100vw - 1024px) / 2)', display: 'flex', justifyContent: 'center' }}
      aria-label="Petikan pilihan"
    >
      <div
        style={{ width: 'clamp(180px, 12vw, 220px)' }}
        onMouseEnter={() => { kunciTuding.current = true; }}
        onMouseLeave={() => { kunciTuding.current = false; }}
        onFocusCapture={() => { kunciTuding.current = true; }}
        onBlurCapture={() => { kunciTuding.current = false; }}
      >
        <div
          className={`group relative border-l-2 border-stone-300 pl-3 transition-opacity ${
            kurangGerak ? '' : 'duration-200'
          } ${pudar ? 'opacity-0' : 'opacity-100'}`}
        >
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup petikan"
            title="Tutup petikan"
            className="absolute -right-1 -top-5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-stone-400 hover:text-[#802334] text-[15px] leading-none p-1 select-none"
          >
            ×
          </button>

          {/* TEGAK secara lalai (arahan Izzat, 19/8/2026) — petikan dibezakan daripada teks
              sekeliling oleh garis tepi kiri dan kedudukan marginalianya, bukan oleh gaya huruf.
              `safeParseInline` (bukan teks mentah) supaya penanda `*kata pinjaman*` yang Arahan
              AI kini wajibkan (peraturan 21, PetikanConfig.js — istilah asing belum mantap dalam
              Teks Melayu) benar-benar dipaparkan condong — TANPA ini, pembaca nampak asterisk
              literal. Ini PENEGASAN SEBENAR (istilah asing), bukan gaya "puitis" seluruh petikan. */}
          <p className={`font-serif text-stone-600 ${saizTeksMargin(p.teks.length)}`}>
            {safeParseInline(p.teks)}
          </p>
          {/* Tipografi label diselaraskan dengan token sistem reka bentuk sebenar (2026-08-19,
              laporan Izzat "gaya sangat jauh drpd sistem design Adjung Brief") — footer/utiliti
              di FrontpageView.tsx guna `font-mono uppercase tracking-widest font-bold` + aksen
              maroon `#802334` di seluruh laman; modul ni dahulu guna `font-sans tracking-wider`
              tanpa font-bold dan hover kelabu generik, terpesong daripada corak sedia ada. */}
          <LabelTerjemahan p={p} kelas="mt-2 font-mono text-[9px] uppercase tracking-widest font-bold text-stone-400" />
          <Atribusi p={p} kelas="mt-1 font-sans text-[10px] uppercase tracking-wider font-bold text-stone-500" />
          <PautanBuku p={p} kelas="mt-1.5 inline-block font-sans text-[10px] font-semibold text-stone-500 underline underline-offset-2 hover:text-[#802334] transition-colors" />
        </div>
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------------
// PetikanStatik — skrin sempit, satu petikan tetap di atas footer
// ---------------------------------------------------------------------------

export const PetikanStatik: React.FC = () => {
  const { kolam, aktif } = useKolamPetikan();
  if (!aktif || kolam.length === 0) return null;

  // Petikan PERTAMA kolam hari itu, sentiasa. Pada skrin sempit ini bukan marginalia yang
  // menemani pembacaan — ia satu blok penutup, jadi ia tidak bertukar langsung dalam satu
  // lawatan (keputusan Izzat: "skrin sempit statik").
  const p = kolam[0];

  return (
    <section
      className="2xl:hidden w-full max-w-5xl mx-auto mt-12 px-1"
      aria-label="Petikan pilihan"
    >
      <div className="border-t border-stone-200 pt-8 text-center">
        {/* TEGAK — lihat nota di PetikanMargin. Di sini pembezanya ialah garis atas, penengahan
            dan ruang lapang di sekelilingnya. safeParseInline supaya kata pinjaman *dicondongkan* */}
        <p className="font-serif text-stone-700 text-[17px] leading-[1.7] max-w-2xl mx-auto">
          {safeParseInline(p.teks)}
        </p>
        <LabelTerjemahan p={p} kelas="mt-3 font-mono text-[9px] uppercase tracking-widest font-bold text-stone-400" />
        <Atribusi p={p} kelas="mt-1.5 font-sans text-[11px] uppercase tracking-wider font-bold text-stone-500" />
        <PautanBuku p={p} kelas="mt-2 inline-block font-sans text-[11px] font-semibold text-stone-500 underline underline-offset-2 hover:text-[#802334] transition-colors" />
      </div>
    </section>
  );
};
