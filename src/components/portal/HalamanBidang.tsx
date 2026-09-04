import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { BRAND, LOGO_SIZE } from '../../config/brand';
import { safeParseInline } from '../../utils';
import { getDisplayDate, formatSiaranDate, sumberAdjungSendiri, EditPensil } from './FrontpageView';
import { FocusView } from './FocusView';
import BriefNavigator, { type NavigatorField } from './BriefNavigator';
import { BidangIcon } from '../common/BidangIcon';
import { TidakDijumpai } from './TidakDijumpai';

// Format tarikh SIARAN (publishedDate = er.createdAt, ISO timestamp PENUH dgn masa cth
// "2026-08-25T10:59:23.289Z") konsisten "D Bulan Pendek YYYY" — pembetulan asal (2026-09-02,
// dapatan bug-hunt) sebab getDisplayDate() (direka utk Tarikh Sumber bebas-teks) tak pernah
// pulangkan kosong utk corak timestamp penuh ni, punca `||` fallback ke formatSiaranDate mati.
// SUSULAN (sama hari, Izzat marah tangkapan skrin /bidang/geografi — organisasi lama papar
// "13 Jan 1888"/"1 Jan 1885"): senarai ni dahulu SUSUN & PAPAR guna `originalDate` (Tarikh
// Sumber, cth tarikh PENUBUHAN organisasi) jatuh balik createdAt — server (bidangRoutes.js)
// kini hantar `publishedDate` SAHAJA (Tarikh Siaran Adjung sebenar), `originalDate` (Tarikh
// Sumber) kekal wujud tapi HANYA untuk Focus View (sourceDate), tak lagi untuk senarai ni.
const formatTarikhArtikel = (raw?: string): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Baris meta artikel — SATU baris mendatar, bukan bertingkat (2026-09-02, Izzat: "ni kenapa
// susun bertingkat mcm ni? sumber dan tarikh sumber tak boleh letak kat belah kanan ke?").
// Susunan asal (tambahan awal hari ni) letak Tarikh Siaran pada satu baris dan Sumber+Tarikh
// Sumber pada baris SENDIRI di bawahnya — dua baris meta bertindan buat setiap entri, senarai
// nampak sesak dan tinggi tanpa perlu.
//
// Reka bentuk: SATU baris, dua hujung — tarikh siaran di KIRI (konteks kronologi utama senarai
// ni), sumber + tarikh sumber di KANAN (provenance, sepadan corak kad frontpage sebenar yang
// letak lajur sumber di tepi kanan kad). `justify-between` + `flex-wrap`: pada skrin sempit
// (telefon) blok kanan turun ke baris bawah SEBAGAI SATU UNIT UTUH, bukan berpecah tengah-tengah
// — corak sama macam lajur sumber kad bento (FrontpageView.tsx).
//
// Lencana "Arkib" (2026-09-02) — papar bila `status === 'archived'`, supaya kandungan yang
// diputar keluar giliran carousel (bukan dipadam) kekal boleh dikenal pasti sebagai "Koleksi
// Terdahulu" yang bukan lagi aktif di frontpage. Sempat dibuang sekali hari yang sama selepas
// insiden Wikipedia (lihat nota di bidangRoutes.js) — dipulihkan selepas 48 kandungan bersumber
// Wikipedia dipadam KEKAL daripada DB. Jangan buang lencana ni lagi sebagai cara "fix" kandungan
// bermasalah; padam kandungan itu sendiri (DELETE /api/system/content/:id) sebaliknya.
//
// sembunyikanTarikhSumber ikut corak SAMA PERSIS kad sebenar (sumberAdjungSendiri(),
// FrontpageView.tsx) — kandungan "Editorial Adjung" tak papar dua tarikh berlebihan (Tarikh
// Siaran kiri + Tarikh Sumber kanan yang sama). Tiada pautan (sourceUrl kosong ATAU sentinel
// '#', lihat pembetulan FocusView.tsx IkonDiakses hari ni) papar teks biasa, bukan `<a>`.
const BarisMeta: React.FC<{
  publishedDate: string;
  source: string;
  sourceUrl: string;
  originalDate: string;
  status?: string;
}> = ({ publishedDate, source, sourceUrl, originalDate, status }) => {
  const tarikhSumber = source && !sumberAdjungSendiri(source) ? getDisplayDate(originalDate) : '';
  const adaPautan = !!sourceUrl && sourceUrl !== '#';
  const sumberTeks = (
    <>
      {source}
      {tarikhSumber && <span className="text-stone-300"> · {tarikhSumber}</span>}
    </>
  );
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mt-2 font-mono text-[10px] text-stone-400">
      <span className="flex items-baseline gap-2">
        {publishedDate && formatTarikhArtikel(publishedDate)}
        {status === 'archived' && (
          <span className="uppercase tracking-widest text-stone-300 border border-stone-200 rounded-full px-1.5 py-0.5">
            Arkib
          </span>
        )}
      </span>
      {source && (
        <span className="uppercase tracking-widest text-stone-400">
          {adaPautan ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-Adjung-maroon transition-colors"
            >
              {sumberTeks}
            </a>
          ) : sumberTeks}
        </span>
      )}
    </div>
  );
};

// Halaman Bidang (/bidang/:slug, spesifikasi MUKTAMAD 2026-09-01, disahkan Izzat; disemak
// 2026-09-02) — lajur TUNGGAL, center-aligned, TIADA sidebar kanan, TIADA gambar langsung
// (keputusan Izzat, override cadangan ChatGPT), TIADA seksyen Hero berasingan. Dua seksyen:
// TERKINI (10 artikel terbaharu, TIADA pagination) dan "Koleksi Terdahulu" (baki artikel, label
// PAPARAN sahaja — JANGAN guna perkataan "Arkib" sebagai NAMA SEKSYEN, sebab konflik dengan
// status='archived' DB).
//
// Definisi kandungan awam: server (core/routes/bidangRoutes.js) kuatkuasakan status IN
// ('approved','archived') + MAX(version) per objectId (AMARAN WAJIB CLAUDE.md). Halaman ni cuma
// paparkan apa yang pelayan pulangkan, tiada tapisan tambahan di sini. Lihat nota insiden
// Wikipedia di bidangRoutes.js — puncanya ialah kandungan bermasalah itu sendiri, bukan ciri
// paparan arkib ni; kandungan tu sudah dipadam KEKAL, bukan disembunyikan dengan menyekat status.
//
// Koleksi Terdahulu — "lihat lagi" (2026-09-02, Izzat: "takyah ke halaman lain, masih sambung
// dlm halaman sama, mcm endless scroll") gantikan pagination bernombor [1][2][3] asal. Kelompok
// 20/klik (KOLEKSI_BATCH), TAMBAH ke senarai sedia ada (bukan GANTI) — `koleksi` mengumpul
// merentasi berbilang klik "Lihat 20 Lagi" sepanjang lawatan Bidang ni, reset kosong hanya bila
// `slug` bertukar. `koleksiDimuat` jejak BILANGAN item Koleksi Terdahulu sudah dimuat (bukan
// nombor "halaman") — dihantar sebagai param `offset` eksplisit (offset = PER_PAGE + koleksiDimuat)
// ke server sebab saiz kelompok Koleksi (20) BERBEZA drpd saiz TERKINI (10), jadi aritmetik
// page*perPage seragam tak boleh dipakai untuk kira sambungan yang betul.

const PER_PAGE = 10;
const KOLEKSI_BATCH = 20;

type Artikel = {
  objectId: string;
  slotIndex: number;
  title: string;
  summary: string;
  desk: string;
  topik: string;
  briefLong: string;
  source: string;
  sourceUrl: string;
  // Sumber berbilang (dapatan bug-hunt 2026-09-03) — bidangRoutes.js kini hantar sourcesJson
  // artikel diurai; `source`/`sourceUrl` di atas KEKAL fallback legasi (entri pertama) untuk
  // kandungan lama yang tiada medan ni. Lihat nota di FocusView `sources` prop di bawah.
  sources: { name: string; url?: string; date?: string }[];
  editorName: string;
  image: string;
  status: string;
  originalDate: string;
  publishedDate: string;
};

type BidangMeta = { name: string; slug: string; description: string };

export function HalamanBidang() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = React.useState<'memuat' | 'sedia' | '404'>('memuat');
  const [bidang, setBidang] = React.useState<BidangMeta | null>(null);
  const [ikon, setIkon] = React.useState<{ icon: string | null; iconSvg: string | null; color: string } | null>(null);
  const [terkini, setTerkini] = React.useState<Artikel[]>([]);
  const [koleksi, setKoleksi] = React.useState<Artikel[]>([]);
  const [totalKeseluruhan, setTotalKeseluruhan] = React.useState(0);
  const [memuatKoleksi, setMemuatKoleksi] = React.useState(false);
  const [focusObjectId, setFocusObjectId] = React.useState<string | null>(null);
  // Senarai Bidang untuk sidebar BriefNavigator (2026-09-02, dapatan Izzat: "kenapa takde
  // toggle burger tu semasa berada di halaman bidang? macam mana kalau user nak tengok bidang
  // lain?") — dahulu langsung tak dirender di sini, jadi satu-satunya jalan pindah Bidang ialah
  // klik "Laman Utama" balik ke frontpage dahulu. `totalCount`/`news` diisi kosong sengaja —
  // BriefNavigator (selepas pembuangan mod senarai-berita-dalam-sidebar, 2026-09-01) cuma baca
  // slug/name/icon/iconSvg untuk navigasi terus ke /bidang/{slug}, dua medan lain warisan corak
  // NavigatorField sedia ada (FrontpageView.tsx), tak dirender/digunakan lagi.
  const [sidebarFields, setSidebarFields] = React.useState<NavigatorField[]>([]);

  // Peranan editor log masuk, untuk ikon pensel Sunting pada setiap entri (2026-09-04, Izzat:
  // "kalau editor log masuk, ia akan nampak icon pencil di halaman bidang, yg kalau dia klik, ia
  // akan terus ke Semakan Kandungan dengan UUID kandungan tu ... mcm yg ada skrg di kad slot
  // sekarang"). Halaman ni SELF-CONTAINED (tiada props dari App.tsx, lihat routing <Route
  // path="/bidang/:slug">), jadi kunci storan sesi dibaca TERUS di sini — corak identik App.tsx
  // (AUTH_STORAGE_KEY 'adjung-auth-user', localStorage diutamakan drpd sessionStorage) — bukan
  // salinan bebas, cuma bacaan storan sedia ada yang App.tsx SENDIRI tulis semasa log masuk.
  // `EditPensil` (FrontpageView.tsx, kini dieksport) ialah komponen KONGSI SAMA yang dipakai kad
  // bento — buka tab baharu ke /editorium?tab=kandungan&sub=semakan&itemId={objectId}, auto-isi
  // kotak carian Semakan Kandungan (mekanisme sedia ada, bukan laluan penapis baharu).
  const [currentEditoriumRole, setCurrentEditoriumRole] = React.useState<'KETUA_EDITOR' | 'EDITOR' | undefined>(undefined);
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem('adjung-auth-user') || window.sessionStorage.getItem('adjung-auth-user');
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed && (parsed.role === 'KETUA_EDITOR' || parsed.role === 'EDITOR')) setCurrentEditoriumRole(parsed.role);
    } catch {
      // Storan rosak/tak boleh diurai — ikon pensel kekal sorok, sama seperti pengguna tak log masuk.
    }
  }, []);

  // Muat metadata Bidang + ikon/warna Taksonomi (2026-09-01) — sekali sahaja bila slug berubah.
  React.useEffect(() => {
    let dibatal = false;
    if (!slug) return;
    setStatus('memuat');
    // PEMBETULAN (2026-09-01, dapatan bug-hunt): `koleksi` ialah state komponen ni sendiri,
    // TIDAK reset automatik bila slug bertukar (React Router tak unmount komponen ni antara
    // /bidang/buku dan /bidang/sains, cuma tukar param). Tanpa reset ni, pembaca yang tinggalkan
    // Bidang lain selepas beberapa klik "Lihat Lagi", kemudian klik ke Bidang BAHARU, akan
    // mendarat dengan kandungan Koleksi Terdahulu Bidang LAMA masih terpapar.
    setKoleksi([]);
    Promise.all([
      fetch(`/api/bidang/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch('/api/system/categories/active').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ])
      .then(([meta, kategoriAktif]) => {
        if (dibatal) return;
        setBidang(meta);
        const match = Array.isArray(kategoriAktif)
          ? kategoriAktif.find((c: any) => (c.slug || '').toLowerCase() === meta.slug.toLowerCase())
          : null;
        setIkon(match ? { icon: match.icon ?? null, iconSvg: match.iconSvg ?? null, color: match.color || '#802334' } : null);
        setSidebarFields(Array.isArray(kategoriAktif)
          ? kategoriAktif.map((c: any) => ({
              name: c.name, slug: c.slug, totalCount: 0, news: [],
              icon: c.icon ?? null, iconSvg: c.iconSvg ?? null,
            }))
          : []);
        setStatus('sedia');
      })
      .catch(() => {
        if (!dibatal) setStatus('404');
      });
    return () => { dibatal = true; };
  }, [slug]);

  // Muat artikel TERKINI (10 pertama, halaman 1) sekali bila Bidang sedia.
  React.useEffect(() => {
    if (status !== 'sedia' || !slug) return;
    let dibatal = false;
    fetch(`/api/bidang/${encodeURIComponent(slug)}/artikel?page=1&perPage=${PER_PAGE}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (dibatal || !data) return;
        setTerkini(data.artikel || []);
        setTotalKeseluruhan(data.total || 0);
      })
      .catch(() => {});
    return () => { dibatal = true; };
  }, [status, slug]);

  // Muat kelompok PERTAMA "Koleksi Terdahulu" (item ke-11 dan seterusnya, offset=PER_PAGE)
  // secara automatik sebaik TERKINI siap dimuat. Klik "Lihat Lagi" (lihatLagiKoleksi di bawah)
  // sambung dari sini — kedua-dua guna offset EKSPLISIT (bukan page/perPage seragam) sebab saiz
  // kelompok Koleksi (20) berbeza drpd TERKINI (10).
  React.useEffect(() => {
    if (status !== 'sedia' || !slug) return;
    if (totalKeseluruhan <= PER_PAGE) return;
    let dibatal = false;
    setMemuatKoleksi(true);
    fetch(`/api/bidang/${encodeURIComponent(slug)}/artikel?offset=${PER_PAGE}&perPage=${KOLEKSI_BATCH}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (dibatal || !data) return;
        setKoleksi(data.artikel || []);
      })
      .catch(() => {})
      .finally(() => { if (!dibatal) setMemuatKoleksi(false); });
    return () => { dibatal = true; };
  }, [status, slug, totalKeseluruhan]);

  const lihatLagiKoleksi = () => {
    if (!slug || memuatKoleksi) return;
    const offset = PER_PAGE + koleksi.length;
    setMemuatKoleksi(true);
    fetch(`/api/bidang/${encodeURIComponent(slug)}/artikel?offset=${offset}&perPage=${KOLEKSI_BATCH}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setKoleksi((prev) => [...prev, ...(data.artikel || [])]);
      })
      .catch(() => {})
      .finally(() => setMemuatKoleksi(false));
  };

  const gabungan = React.useMemo(() => [...terkini, ...koleksi], [terkini, koleksi]);
  const focusIndex = focusObjectId ? gabungan.findIndex((a) => a.objectId === focusObjectId) : -1;
  const focusItem = focusIndex >= 0 ? gabungan[focusIndex] : null;

  // Mod navigasi (2026-09-02, dapatan Izzat: "mana hilangnya butang rawak/turutan? sepatutnya
  // masih ada cuma kalau buka focus view dari senarai bidang, maka ia default turutan") — lalai
  // 'turutan' (spesifikasi asal Halaman Bidang, pembacaan ikut susunan senarai), TAPI butang
  // togol kekal dipaparkan supaya pembaca boleh tukar ke 'rawak' bila mahu, sama seperti Focus
  // View di frontpage. `focusHistory` cuma relevan utk mod rawak (undur sejarah dilawati, BUKAN
  // rawak baharu — corak sama FrontpageView.tsx ~baris 3418).
  const [navMode, setNavMode] = React.useState<'rawak' | 'turutan'>('turutan');
  const [focusHistory, setFocusHistory] = React.useState<string[]>([]);

  const bukaArtikel = (objectId: string) => { setFocusObjectId(objectId); setFocusHistory([objectId]); };
  const tutupArtikel = () => setFocusObjectId(null);
  const togolNavMode = () => setNavMode((m) => (m === 'rawak' ? 'turutan' : 'rawak'));

  // Sasaran rawak — dielakkan objectId SEMASA dan objectId SEBELUM (dalam sejarah), sama falsafah
  // "jangan ulang tempat baru datang" macam frontpage, tapi tanpa logik elak-Bidang-sama (skop
  // Halaman Bidang MEMANG satu Bidang sahaja, elak-Bidang-sama tak bermakna di sini). Dikira dari
  // SENARAI DIMUAT SETAKAT INI (gabungan) sahaja — konsisten dgn skop turutan sedia ada, TIDAK
  // fetch tambahan merentasi kandungan yang belum dimuat via "Lihat Lagi".
  const sasaranRawak = React.useMemo(() => {
    if (navMode !== 'rawak' || gabungan.length <= 1) return null;
    const sebelum = focusHistory.length >= 2 ? focusHistory[focusHistory.length - 2] : null;
    const calon = gabungan.filter((a) => a.objectId !== focusObjectId && a.objectId !== sebelum);
    const kolam = calon.length > 0 ? calon : gabungan.filter((a) => a.objectId !== focusObjectId);
    return kolam.length > 0 ? kolam[Math.floor(Math.random() * kolam.length)].objectId : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navMode, focusObjectId, gabungan]);

  // Navigasi turutan (2026-09-01, spesifikasi Halaman Bidang) — merentasi SEMUA artikel
  // dipaparkan (TERKINI + Koleksi Terdahulu SETAKAT halaman koleksi yang sudah dimuat), bukan
  // cuma halaman semasa. Di hujung senarai, prop tak dihantar (undefined) — FocusView sendiri
  // sorok anak panah bila `onPrev`/`onNext` tiada, ikut kontrak sedia ada.
  const keArtikelSeterusnya = navMode === 'rawak'
    ? (sasaranRawak ? () => { setFocusHistory((h) => [...h, sasaranRawak]); setFocusObjectId(sasaranRawak); } : undefined)
    : (focusIndex >= 0 && focusIndex < gabungan.length - 1
        ? () => setFocusObjectId(gabungan[focusIndex + 1].objectId)
        : undefined);
  const keArtikelSebelum = navMode === 'rawak'
    ? (focusHistory.length > 1
        ? () => setFocusHistory((h) => {
            const next = h.slice(0, -1);
            setFocusObjectId(next[next.length - 1]);
            return next;
          })
        : undefined)
    : (focusIndex > 0
        ? () => setFocusObjectId(gabungan[focusIndex - 1].objectId)
        : undefined);

  // Kekunci: Esc tutup, atas/bawah/kiri/kanan gerak — dapatan bug-hunt (2026-09-02, soalan
  // Izzat "boleh navigasi guna keyboard?"). Corak SAMA persis FrontpageView.tsx (~baris 3428) —
  // fungsi tu wiring pendengar keydown di PERINGKAT INDUK (bukan dalam FocusView.tsx sendiri,
  // yang cuma pegang Space play/pause), jadi ia MESTI diulang di sini juga, tak automatik
  // datang sekali dengan komponen FocusView yang dikongsi.
  React.useEffect(() => {
    if (!focusItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutupArtikel();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') keArtikelSeterusnya?.();
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') keArtikelSebelum?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusItem, keArtikelSeterusnya, keArtikelSebelum]);

  // Esc balik Laman Utama bila TIADA artikel terbuka (2026-09-04, soalan Izzat "macam mana nak
  // navigasi dari halaman Bidang ke Laman Utama guna papan kekunci? rasanya takde... patut guna
  // Esc je") — pendengar DI ATAS sengaja hanya aktif bila `focusItem` wujud (tutup artikel balik
  // ke senarai Bidang), jadi Esc semasa hanya MELAYARI senarai (tiada artikel terbuka) tak buat
  // apa-apa. Pendengar KEDUA, berasingan, gerbang terbalik (`if (focusItem) return`) supaya kedua
  // peringkat Esc tak pernah bertindih/bertindak serentak pada kekunci sama — "keluar satu
  // peringkat" konsisten: artikel terbuka → Esc tutup artikel; senarai Bidang → Esc balik Utama.
  React.useEffect(() => {
    if (focusItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusItem, navigate]);

  if (status === '404') return <TidakDijumpai />;

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-serif text-[#1F1F1F]">
      {sidebarFields.length > 0 && (
        <BriefNavigator fields={sidebarFields} currentLoc={null} onOpenNews={() => {}} />
      )}
      {/* Sticky (2026-09-02, dapatan Izzat: "kalau scroll sampai bawah, macam mana nak kembali
          ke frontpage? kena naik atas dulu?") — dahulu header ni cuma di puncak halaman, pembaca
          yang dah scroll jauh (terutama selepas beberapa klik "Lihat 20 Lagi") terpaksa scroll
          balik ke atas semata-mata untuk klik "Laman Utama". `bg-[#FDFDFD]/95 backdrop-blur-sm`
          + `border-b` bila melekat supaya kandungan di bawahnya tak lenyap terus di bawah header. */}
      <header className="sticky top-0 z-40 bg-[#FDFDFD]/95 backdrop-blur-sm border-b border-stone-150 w-full px-6 py-3">
        {/* Grid (2026-09-02, Izzat: "guna grid la... seragam, tempat lain pun guna grid") —
            dahulu flexbox justify-between, tak konsisten dengan corak masthead sedia ada
            (FocusView.tsx ~baris 924, `display: 'grid', gridTemplateColumns: '1fr auto 1fr'`).
            Grid 2-lajur di sini (logo tak perlu ditengahkan macam FocusView, cuma dua hujung). */}
        <div className="max-w-2xl mx-auto grid grid-cols-[1fr_auto] items-center">
          <Link
            to="/"
            className={`font-serif ${LOGO_SIZE.header} text-[#802334] tracking-tight hover:opacity-80 transition-opacity justify-self-start`}
          >
            {BRAND.logoText}
          </Link>
          <Link
            to="/"
            className="font-sans text-[10px] uppercase tracking-widest text-stone-500 hover:text-Adjung-maroon transition-colors justify-self-end"
          >
            Laman Utama
          </Link>
        </div>
      </header>

      {status === 'memuat' || !bidang ? (
        <div className="flex-1 flex items-center justify-center py-32">
          <p className="font-sans text-xs text-stone-400 uppercase tracking-widest">Memuatkan…</p>
        </div>
      ) : (
        <main className="max-w-[1200px] mx-auto px-6 pb-24">
          <div className="max-w-[800px] mx-auto">
            {/* Nama Bidang + deskripsi ringkas — text-only, TIADA gambar/hero (keputusan Izzat). */}
            <section className="text-center pt-8 pb-6">
              {ikon && (ikon.icon || ikon.iconSvg) && (
                <div className="flex justify-center mb-3" style={{ color: ikon.color }}>
                  <BidangIcon iconName={ikon.icon} iconSvg={ikon.iconSvg} color="currentColor" variant="bare" size={28} />
                </div>
              )}
              <h1 className="font-serif font-semibold tracking-tight text-[28px] md:text-[36px] text-[#1F1F1F]">
                {bidang.name}
              </h1>
              {bidang.description && (
                <p className="font-sans text-[15px] md:text-[16px] text-stone-600 leading-relaxed max-w-[600px] mx-auto mt-3">
                  {bidang.description}
                </p>
              )}
            </section>

            <hr className="border-t border-stone-200 my-4" />

            {/* TERKINI — 10 artikel approved terbaharu, TIADA pagination di sini. */}
            {terkini.length === 0 ? (
              <section className="text-center py-20">
                <p className="font-sans text-sm text-stone-500">
                  Belum ada kandungan diterbitkan dalam Bidang ini.
                </p>
              </section>
            ) : (
              <section>
                <p className="font-mono text-[10px] uppercase tracking-widest text-stone-400 mb-4 text-center">
                  Terkini
                </p>
                <ol className="list-none m-0 p-0 divide-y divide-stone-150">
                  {terkini.map((a, idx) => (
                    <li key={a.objectId} className={`relative ${idx === 0 ? 'py-5' : 'py-4'}`}>
                      {/* Ikon Sunting (2026-09-04) — di LUAR <button> pembuka artikel sengaja,
                          bukan nested button (HTML tak benarkan <button> dalam <button>). `li`
                          relative jadi sauh kedudukan `absolute` EditPensil sendiri. */}
                      <EditPensil objectId={a.objectId} role={currentEditoriumRole} posisi="top-1/2 -translate-y-1/2 right-0" />
                      <button
                        type="button"
                        onClick={() => bukaArtikel(a.objectId)}
                        className="w-full text-left group pr-10"
                      >
                        {a.topik && (
                          <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-Adjung-maroon mb-1.5">
                            {a.topik}
                          </div>
                        )}
                        {/* hyphens:none (2026-09-02, Izzat: "bukan ke saya dh cakap hyphenation
                            hanya utk telefon?") — PemenggalSukuKata.js sisip sempang lembut
                            (U+00AD) ke SEMUA teks tanpa mengira saiz skrin (sekali di peringkat
                            data), peraturan hyphens:none untuk DESKTOP sedia ada (FrontpageView.tsx,
                            PetikanModul.tsx, FocusView.tsx) skop `#bento-news-grid`/inline
                            tersendiri — Halaman Bidang dirender di LUAR skop tu, jadi tak pernah
                            dapat perlindungan sama, papar "kilome-ter"/"Antarti-ka" di desktop.
                            Tiada media query mobile di sini (tak macam FrontpageView) sebab
                            lajur senarai ni sudah cukup lebar di semua saiz skrin (bukan kad
                            bento sempit yang perlukan sempang manual) — hyphens:none kekal
                            tanpa syarat, sama corak macam FocusView.tsx (huraian artikel). */}
                        <div
                          className={`font-serif leading-snug text-[#1F1F1F] group-hover:text-Adjung-maroon transition-colors ${
                            idx === 0 ? 'text-[22px] md:text-[26px] font-semibold' : 'text-[17px] md:text-[19px] font-medium'
                          }`}
                          style={{ hyphens: 'none', WebkitHyphens: 'none' }}
                        >
                          {safeParseInline(a.title)}
                        </div>
                        {a.summary && idx === 0 && (
                          <p className="font-sans text-[13px] text-stone-500 mt-2 leading-relaxed max-w-[640px]" style={{ hyphens: 'none', WebkitHyphens: 'none' }}>
                            {safeParseInline(a.summary)}
                          </p>
                        )}
                        <BarisMeta
                          publishedDate={a.publishedDate}
                          source={a.source}
                          sourceUrl={a.sourceUrl}
                          originalDate={a.originalDate}
                          status={a.status}
                        />
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Koleksi Terdahulu — label PAPARAN sahaja (bukan "Arkib"). Disorok sepenuhnya
                kalau jumlah keseluruhan <=10 (semua sudah muat dalam TERKINI). */}
            {totalKeseluruhan > PER_PAGE && (
              <section className="mt-6">
                <div className="flex items-center justify-center gap-3 mb-5">
                  <div className="h-px bg-stone-200 flex-1 max-w-[80px]" />
                  <p className="font-mono text-[10px] uppercase tracking-widest text-stone-400">
                    Koleksi Terdahulu
                  </p>
                  <div className="h-px bg-stone-200 flex-1 max-w-[80px]" />
                </div>

                {koleksi.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <p className="font-sans text-xs text-stone-400">Memuatkan…</p>
                  </div>
                ) : (
                  <>
                    <ol className="list-none m-0 p-0 divide-y divide-stone-150">
                      {koleksi.map((a) => (
                        <li key={a.objectId} className="relative py-4">
                          <EditPensil objectId={a.objectId} role={currentEditoriumRole} posisi="top-1/2 -translate-y-1/2 right-0" />
                          <button type="button" onClick={() => bukaArtikel(a.objectId)} className="w-full text-left group pr-10">
                            {a.topik && (
                              <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-Adjung-maroon mb-1.5">
                                {a.topik}
                              </div>
                            )}
                            <div className="font-serif text-[16px] md:text-[17px] font-medium leading-snug text-[#1F1F1F] group-hover:text-Adjung-maroon transition-colors" style={{ hyphens: 'none', WebkitHyphens: 'none' }}>
                              {safeParseInline(a.title)}
                            </div>
                            <BarisMeta
                              publishedDate={a.publishedDate}
                              source={a.source}
                              sourceUrl={a.sourceUrl}
                              originalDate={a.originalDate}
                              status={a.status}
                            />
                          </button>
                        </li>
                      ))}
                    </ol>

                    {/* "Lihat Lagi" — kumpul terus dalam senarai sedia ada (endless scroll gaya
                        klik), bukan tukar ke halaman baharu. Disorok bila semua item Koleksi
                        Terdahulu (totalKeseluruhan - PER_PAGE) dah dimuat. */}
                    {koleksi.length < totalKeseluruhan - PER_PAGE && (
                      <div className="flex justify-center mt-8">
                        <button
                          type="button"
                          onClick={lihatLagiKoleksi}
                          disabled={memuatKoleksi}
                          className="font-mono text-[11px] uppercase tracking-widest text-stone-500 hover:text-Adjung-maroon border border-stone-300 hover:border-Adjung-maroon rounded-full px-5 py-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                          {memuatKoleksi ? 'Memuatkan…' : `Lihat ${KOLEKSI_BATCH} Lagi`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        </main>
      )}

      {focusItem && (
        <FocusView
          icon={ikon && (ikon.icon || ikon.iconSvg) ? (
            <BidangIcon iconName={ikon.icon} iconSvg={ikon.iconSvg} color="currentColor" variant="bare" size={13} />
          ) : undefined}
          desk={focusItem.desk}
          topik={focusItem.topik}
          deskColor={ikon?.color}
          title={focusItem.title}
          titleRendered={safeParseInline(focusItem.title)}
          body={focusItem.briefLong || focusItem.summary}
          // Grafik (dapatan bug-hunt 2026-09-03) — `image` sedia ada dalam data artikel (dihantar
          // bidangRoutes.js, jenis Artikel di atas) tapi TAK PERNAH disalur ke prop `visual`
          // FocusView di sini, walhal FrontpageView.tsx (laluan biasa) memaparkannya. Kandungan
          // yang ada imej senyap kehilangannya bila dibuka melalui Halaman Bidang. onError
          // sorok terus (corak sama FrontpageView.tsx) — imej rosak tak pernah terpapar ikon
          // pecah pelayar walau sesaat.
          visual={focusItem.image ? (
            <img
              src={focusItem.image}
              alt={focusItem.title || ''}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : undefined}
          note={undefined}
          source={focusItem.source}
          sourceUrl={focusItem.sourceUrl}
          // Sumber berbilang (dapatan bug-hunt 2026-09-03) — sebelum ni prop `sources` TAK PERNAH
          // dihantar di sini, jadi kandungan yang benar-benar ada >1 sumber (ciri sedia ada,
          // dipapar penuh di Focus View biasa/FrontpageView.tsx) senyap kehilangan sumber ke-2/3
          // bila dibuka melalui Halaman Bidang — FocusView jatuh balik ke source/sourceUrl tunggal
          // di atas (entri pertama sahaja) walhal kandungan tu ada lebih. `getDisplayDate` (bukan
          // formatTarikhSumberPanjang FrontpageView.tsx, yang tak dieksport) — sepadan formatter
          // sedia ada fail ni (lihat sourceDate di bawah), bulan singkatan bukan penuh.
          sources={(focusItem.sources || []).length > 0
            ? focusItem.sources.map((s) => ({ ...s, date: getDisplayDate(s.date) }))
            : undefined}
          objectId={focusItem.objectId}
          sourceDate={getDisplayDate(focusItem.originalDate)}
          publishedDate={formatSiaranDate(focusItem.publishedDate)}
          editorName={focusItem.editorName}
          onPrev={keArtikelSebelum}
          onNext={keArtikelSeterusnya}
          prevPreviewTitle={focusIndex > 0 ? gabungan[focusIndex - 1].title : undefined}
          nextPreviewTitle={(focusIndex >= 0 && focusIndex < gabungan.length - 1) ? gabungan[focusIndex + 1].title : undefined}
          onClose={tutupArtikel}
          navMode={navMode}
          onToggleNavMode={togolNavMode}
          startPaused={true}
        />
      )}
    </div>
  );
}
