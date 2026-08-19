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

/** Saiz teks TETAP untuk kesemua petikan margin (2026-08-19, laporan Izzat "saiz font tak
 *  seragam"). Sebelum ni saiz mengecil ikut panjang teks — nampak tekal untuk SATU petikan,
 *  tetapi apabila putaran bertukar antara petikan pendek dan panjang, saiz font turut melompat
 *  setiap kali, menjadikan pengalaman keseluruhan tidak seragam. Petikan panjang kini dibiar
 *  membalut lebih banyak baris (kotak margin tidak dikunci tinggi), bukan mengecilkan huruf. */
const SAIZ_TEKS_MARGIN = 'text-[13px] leading-[1.6]';

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
// PetikanMargin — desktop lebar, terapung, bertukar mengikut tatalan
// ---------------------------------------------------------------------------

/** Jarak tatalan (px) bagi SATU langkah. Sejarah pelarasan sama hari (2026-08-19): 900 -> 200
 *  (terlalu pantas) -> 380 (terasa OK secara berasingan, tetapi video sebenar dedah ia masih
 *  terlalu KERAP untuk marginalia — setiap pertukaran, walau dihaluskan, tetap peristiwa visual
 *  di tepi mata; kalau kerap sangat, petikan "berubah daripada suasana editorial kepada
 *  carousel", kata ChatGPT selepas tonton rakaman sebenar).
 *
 *  PELARASAN KETIGA — 380 -> 1800. Sasaran BUKAN "berapa kerap boleh bertukar", tetapi "berapa
 *  banyak petikan pembaca biasa nampak dalam SATU lawatan" — dianggarkan 4-6 pertukaran sepanjang
 *  frontpage 38 slot (~9,000px tatalan sebenar) = kira-kira setiap 1,700-1,800px. Ini BERBEZA
 *  daripada saiz kolam harian (12, PetikanConfig.js `pilihDanSusunKolam`) — 12 ialah bekalan
 *  pengagihan, bukan jumlah yang wajib dilihat setiap lawatan; pembaca yang scroll sangat panjang
 *  tetap boleh capai lebih, tiada had buatan. */
const JARAK_TUKAR_PX = 1800;

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

export const PetikanMargin: React.FC<{ beku?: boolean }> = ({ beku = false }) => {
  const { kolam, aktif } = useKolamPetikan();
  const [indeks, setIndeks] = React.useState(() => bacaSesi().indeks);
  const [ditutup, setDitutup] = React.useState(() => bacaSesi().ditutup);
  const [pudar, setPudar] = React.useState(false);
  // Tempoh transisi SEMASA — berbeza ikut fasa (350ms fade-keluar vs 450ms fade-masuk, lihat
  // nota TEMPOH_FADE_KELUAR_MS di atas). Dikawal via inline style (bukan kelas Tailwind statik)
  // supaya satu elemen boleh bertukar tempoh mengikut arah tanpa dua salinan className.
  const [tempohTransisiMs, setTempohTransisiMs] = React.useState(TEMPOH_FADE_KELUAR_MS);

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

    // Transisi DUA FASA (2026-08-19, susulan video sebenar — lihat nota TEMPOH_FADE_KELUAR_MS di
    // atas fail). Urutan MESTI tepat: fade-keluar penuh -> tukar kandungan SEMASA tak kelihatan
    // (opacity 0) -> jeda kosong -> fade-masuk. `kurangGerak` langkau kesemua fasa, tukar terus.
    const tukarIndeks = (arah: 1 | -1) => {
      setIndeks((sebelum) => {
        const baharu = (sebelum + arah + kolam.length) % kolam.length;
        tulisSesi({ tarikh: new Date().toISOString().slice(0, 10), indeks: baharu, ditutup: false });
        return baharu;
      });
    };

    const langkah = (arah: 1 | -1) => {
      if (kunciTuding.current || bekuRef.current) return;
      if (kurangGerak) { tukarIndeks(arah); return; }

      setTempohTransisiMs(TEMPOH_FADE_KELUAR_MS);
      setPudar(true); // fade-KELUAR bermula — teks LAMA masih dipaparkan sepanjang fasa ni
      setTimeout(() => {
        // opacity 0 PENUH sekarang — selamat tukar kandungan, mata tidak nampak langsung.
        tukarIndeks(arah);
        setTimeout(() => {
          // jeda kosong selesai — mula fade-MASUK dengan tempoh berlainan (lebih perlahan).
          setTempohTransisiMs(TEMPOH_FADE_MASUK_MS);
          setPudar(false);
        }, TEMPOH_JEDA_MS);
      }, TEMPOH_FADE_KELUAR_MS);
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
    //
    // PEPIJAT PENGELUARAN KRITIKAL DIBAIKI (2026-08-19, laporan Izzat "kenapa jadi mcm ni?!!!!!" +
    // tangkapan skrin production menunjukkan teks bertindih rambang di tepi kiri): `style={{
    // display: 'flex' }}` INLINE menewaskan kelas Tailwind `hidden` (inline style SENTIASA
    // menewaskan kelas, tidak kira @layer/specificity) — jadi aside ni SENTIASA kelihatan pada
    // SEMUA lebar skrin, bukan cuma ≥1536px seperti disangka. Di bawah 1024px, `calc((100vw -
    // 1024px) / 2)` jadi NEGATIF (lebar CSS tak sah, jatuh ke 0px), tetapi kandungan dalam
    // (clamp 180-220px) tetap cuba dipusatkan dalam kotak 0-lebar tu — melimpah ke tepi kiri
    // viewport, bertindih kandungan utama. Dibetulkan: `display:flex` DIPINDAH ke kelas
    // `2xl:flex` (gantikan `2xl:block`), BUANG dari inline style — cascade `hidden` (lalai)
    // vs `2xl:flex` (≥1536px) kini betul-betul dikawal Tailwind, bukan inline style yang
    // mengatasinya secara senyap.
    <aside
      className="hidden 2xl:flex fixed left-0 bottom-10 z-20"
      style={{ width: 'calc((100vw - 1024px) / 2)', justifyContent: 'center' }}
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
          // Garisan kiri DIBUANG (2026-08-19, laporan Izzat "rasanya tak perlu garisan belah kiri
          // tu") — petikan kini dibezakan SEMATA-MATA oleh tanda petik besar + teks rata kanan,
          // bukan bekas berbingkai. `text-right` (Izzat, "align teks ke sebelah kanan") terpakai
          // pada SELURUH blok (petikan, label, atribusi, pautan) — bukan cuma petikan sendiri.
          //
          // Transisi DUA FASA (2026-08-19, susulan video sebenar — lihat nota TEMPOH_FADE_KELUAR_MS
          // di atas fail). `translate-y` DIBUANG sepenuhnya (arahan eksplisit: "Jangan gunakan
          // slide/translate... Itu akan menjadikannya widget/carousel") — OPACITY SAHAJA, kedudukan
          // tetap sama sepanjang transisi. Tempoh dikawal via `tempohTransisiMs` (inline style,
          // bukan kelas statik) supaya fade-keluar (350ms) dan fade-masuk (450ms) boleh berbeza
          // tanpa dua salinan className. `ease-in-out` (bukan `ease-out`) — arahan eksplisit.
          className={`group relative text-right transition-opacity ease-in-out ${
            pudar ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ transitionDuration: kurangGerak ? '0ms' : `${tempohTransisiMs}ms` }}
        >
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup petikan"
            title="Tutup petikan"
            // Kekal KANAN atas (arahan eksplisit Izzat sebelum ni: "butang pangkah di kanan atas,
            // bukan kiri") — tidak diubah semula walau teks kini rata kanan; dua keputusan ni
            // berasingan.
            className="absolute -right-1 -top-5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-stone-400 hover:text-[#802334] text-[15px] leading-none p-1 select-none"
          >
            ×
          </button>

          {/* TEGAK secara lalai (arahan Izzat, 19/8/2026) — petikan dibezakan daripada teks
              sekeliling oleh tanda petik + kedudukan marginalianya, bukan oleh gaya huruf.
              `safeParseInline` (bukan teks mentah) supaya penanda `*kata pinjaman*` yang Arahan
              AI kini wajibkan (peraturan 21, PetikanConfig.js — istilah asing belum mantap dalam
              Teks Melayu) benar-benar dipaparkan condong — TANPA ini, pembaca nampak asterisk
              literal. Ini PENEGASAN SEBENAR (istilah asing), bukan gaya "puitis" seluruh petikan.
              Saiz TETAP (SAIZ_TEKS_MARGIN) — lihat nota di takrifan pemalar tu. */}
          <p className={`font-serif text-stone-900 ${SAIZ_TEKS_MARGIN}`}>
            <span aria-hidden="true" className="text-[#802334] font-serif text-lg leading-none align-[-2px]">&ldquo;</span>
            {safeParseInline(p.teks)}
            <span aria-hidden="true" className="text-[#802334]/60">&rdquo;</span>
          </p>
          {/* Hierarki (2026-08-19, laporan Izzat): petikan hitam ialah elemen UTAMA (SAIZ_TEKS_MARGIN,
              13px) — metadata di bawah dikecilkan berperingkat supaya jelas SEKUNDER, bukan bersaing
              dengan petikan. Warna kini ditentukan DALAM komponen masing-masing (Atribusi: maroon
              hanya pada nama pengarang) — kelas di sini saiz/susun sahaja. Label terjemahan
              DIBUANG (lihat nota di atas fail). */}
          <Atribusi p={p} kelas="mt-2 font-sans text-[10px] tracking-wide" />
          <PautanBuku p={p} kelas="mt-1.5 inline-block font-sans text-[9px] font-semibold text-[#802334]/80 underline underline-offset-2 hover:text-[#802334] transition-colors" />
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
    // Ruang atas dikecilkan mt-12+pt-8 (80px) -> mt-6+pt-6 (48px) (2026-08-19, laporan Izzat
    // "ruang kosong terlalu luas" — tangkapan skrin nunjuk jurang kosong besar antara baris kad
    // terakhir dan petikan). Garis border-t kekal sebagai pemisah visual; cuma jarak sebelum
    // dan selepas garis tu dipadatkan.
    <section
      className="2xl:hidden w-full max-w-5xl mx-auto mt-6 px-1"
      aria-label="Petikan pilihan"
    >
      <div className="border-t border-stone-200 pt-6 text-center">
        {/* TEGAK — lihat nota di PetikanMargin. Di sini pembezanya ialah garis atas, penengahan
            dan ruang lapang di sekelilingnya. safeParseInline supaya kata pinjaman *dicondongkan*.
            Tanda petik besar maroon — sama rasional "pull quote" seperti PetikanMargin.
            Saiz 17px -> 12px (2026-08-19, laporan Izzat versi telefon: "saiz petikan lebih besar
            drpd saiz kandungan sebenar?!!!!!") — 17px melampaui saiz tajuk/huraian kandungan
            editorial sekeliling (~13-16px), menjadikan petikan sampingan kelihatan lebih penting
            drpd berita sebenar. PetikanMargin (desktop) TIDAK disentuh — arahan ni khusus versi
            telefon (kelas 2xl:hidden), jangan tertukar dengan SAIZ_TEKS_MARGIN 13px di atas. */}
        <p className="font-serif text-stone-900 text-[12px] leading-[1.7] max-w-2xl mx-auto">
          <span aria-hidden="true" className="text-[#802334] text-2xl leading-none align-[-4px]">&ldquo;</span>
          {safeParseInline(p.teks)}
          <span aria-hidden="true" className="text-[#802334]/60">&rdquo;</span>
        </p>
        {/* Selaras dengan PetikanMargin (2026-08-19) — huruf biasa (bukan uppercase); warna kini
            ditentukan DALAM komponen (Atribusi: maroon hanya pengarang); saiz dikecilkan
            berperingkat supaya petikan hitam kekal elemen utama hierarki. Label terjemahan
            DIBUANG (lihat nota di atas fail). */}
        <Atribusi p={p} kelas="mt-3 font-sans text-[11px] tracking-wide" />
        <PautanBuku p={p} kelas="mt-2 inline-block font-sans text-[10px] font-semibold text-[#802334]/80 underline underline-offset-2 hover:text-[#802334] transition-colors" />
      </div>
    </section>
  );
};
