import React from 'react';

/**
 * MODUL PETIKAN — paparan awam (Fasa 5).
 *
 * Dua bentuk paparan, SATU sumber data:
 *   - `PetikanMargin`  — desktop lebar (>=1536px) sahaja. Marginalia terapung di margin kiri
 *                        bawah, bertukar apabila pembaca menatal, bukan mengikut pemasa.
 *   - `PetikanStatik`  — skrin sempit. SATU petikan tetap di atas footer, tiada putaran langsung.
 *
 * Keputusan Izzat yang dikunci dan TIDAK boleh diubah tanpa arahan baharu:
 *   1. Petikan BUKAN carousel. Ia bertukar hanya apabila pembaca menatal ke bawah dengan jarak
 *      bermakna — kalau pembaca duduk diam membaca, petikan kekal.
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
    {p.karya && <span> · {p.karya}</span>}
    {p.rujukan && <span> · {p.rujukan}</span>}
  </div>
);

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

/** Jarak tatalan ke bawah (px) yang perlu dikumpul sebelum petikan bertukar. Sengaja BESAR —
 *  pembaca yang menatal perlahan membaca kad patut lihat petikan yang SAMA, bukan teks yang
 *  bertukar-tukar di ekor mata. */
const JARAK_TUKAR_PX = 900;
/** Tempoh berhenti menatal sebelum pertukaran benar-benar berlaku. Menukar teks di tengah-tengah
 *  tatalan laju menghasilkan kesan berkelip; tunggu pembaca berhenti dahulu. */
const TEMPOH_REHAT_MS = 350;

export const PetikanMargin: React.FC<{ beku?: boolean }> = ({ beku = false }) => {
  const { kolam, aktif } = useKolamPetikan();
  const [indeks, setIndeks] = React.useState(() => bacaSesi().indeks);
  const [ditutup, setDitutup] = React.useState(() => bacaSesi().ditutup);
  const [kelihatan, setKelihatan] = React.useState(false);
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

  // Muncul hanya SELEPAS kad HERO dilepasi — margin di sebelah HERO ialah ruang bernafas reka
  // bentuk masthead, bukan tempat meletakkan teks tambahan.
  React.useEffect(() => {
    if (kolam.length === 0 || ditutup) return;

    const kiraAmbang = () => {
      const hero = document.querySelector('[data-slot="0"]');
      if (!hero) return 600;
      const kotak = hero.getBoundingClientRect();
      return window.scrollY + kotak.bottom;
    };

    let ambang = kiraAmbang();
    const semak = () => setKelihatan(window.scrollY > ambang);
    const kiraSemula = () => { ambang = kiraAmbang(); semak(); };

    semak();
    window.addEventListener('scroll', semak, { passive: true });
    window.addEventListener('resize', kiraSemula);
    return () => {
      window.removeEventListener('scroll', semak);
      window.removeEventListener('resize', kiraSemula);
    };
  }, [kolam.length, ditutup]);

  // Putaran mengikut tatalan.
  React.useEffect(() => {
    if (kolam.length < 2 || ditutup) return;

    let terkumpul = 0;
    let yTerakhir = window.scrollY;
    let pemasaRehat: ReturnType<typeof setTimeout> | null = null;

    const majukan = () => {
      // Semakan dibuat pada saat pertukaran, bukan semasa mengumpul — pembaca yang menuding
      // pada blok SELEPAS menatal tetap terlindung, dan jarak yang dikumpul tidak hilang.
      if (kunciTuding.current || bekuRef.current) return;
      terkumpul = 0;
      setPudar(true);
      const tukar = () => {
        setIndeks((sebelum) => {
          const baharu = (sebelum + 1) % kolam.length;
          tulisSesi({ tarikh: new Date().toISOString().slice(0, 10), indeks: baharu, ditutup: false });
          return baharu;
        });
        setPudar(false);
      };
      if (kurangGerak) tukar();
      else setTimeout(tukar, 200);
    };

    const kendali = () => {
      const y = window.scrollY;
      const delta = y - yTerakhir;
      yTerakhir = y;
      // Tatalan ke ATAS tidak pernah menukar petikan dan tidak mengurangkan jarak terkumpul —
      // pembaca yang naik semula untuk membaca semula sesuatu tidak sedang meminta petikan baharu.
      if (delta > 0) terkumpul += delta;
      if (terkumpul < JARAK_TUKAR_PX) return;
      if (pemasaRehat) clearTimeout(pemasaRehat);
      pemasaRehat = setTimeout(majukan, TEMPOH_REHAT_MS);
    };

    window.addEventListener('scroll', kendali, { passive: true });
    return () => {
      window.removeEventListener('scroll', kendali);
      if (pemasaRehat) clearTimeout(pemasaRehat);
    };
  }, [kolam.length, ditutup, kurangGerak]);

  if (!aktif || kolam.length === 0 || ditutup) return null;

  const p = kolam[Math.min(indeks, kolam.length - 1)];
  if (!p) return null;

  const tutup = () => {
    setDitutup(true);
    tulisSesi({ tarikh: new Date().toISOString().slice(0, 10), indeks, ditutup: true });
  };

  return (
    <aside
      // `hidden 2xl:block` — 1536px ialah lebar sebenar pertama yang meninggalkan margin kiri
      // cukup luas di luar bekas kandungan 1024px (disahkan dengan audit susun atur, bukan
      // dianggar). Di bawah lebar itu, PetikanStatik yang mengambil alih.
      className={`hidden 2xl:block fixed left-6 bottom-10 z-20 transition-opacity duration-500 ${
        kelihatan ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ width: 'clamp(180px, 12vw, 220px)' }}
      aria-label="Petikan pilihan"
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
          className="absolute -left-1 -top-5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-stone-400 hover:text-stone-700 text-[15px] leading-none p-1 select-none"
        >
          ×
        </button>

        <p className={`font-serif italic text-stone-600 ${saizTeksMargin(p.teks.length)}`}>
          {p.teks}
        </p>
        <Atribusi p={p} kelas="mt-2 font-sans text-[10px] uppercase tracking-wider text-stone-500 not-italic" />
        <PautanBuku p={p} kelas="mt-1.5 inline-block font-sans text-[10px] text-stone-500 underline underline-offset-2 hover:text-stone-800" />
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
        <p className="font-serif italic text-stone-700 text-[17px] leading-[1.7] max-w-2xl mx-auto">
          {p.teks}
        </p>
        <Atribusi p={p} kelas="mt-3 font-sans text-[11px] uppercase tracking-wider text-stone-500" />
        <PautanBuku p={p} kelas="mt-2 inline-block font-sans text-[11px] text-stone-500 underline underline-offset-2 hover:text-stone-800" />
      </div>
    </section>
  );
};
