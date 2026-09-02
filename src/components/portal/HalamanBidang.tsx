import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { BRAND, LOGO_SIZE } from '../../config/brand';
import { safeParseInline } from '../../utils';
import { getDisplayDate, formatSiaranDate } from './FrontpageView';
import { FocusView } from './FocusView';
import { BidangIcon } from '../common/BidangIcon';
import { TidakDijumpai } from './TidakDijumpai';

// effectiveDate (server, bidangRoutes.js) ialah SAMA ADA originalDate tulen editor (ISO
// yyyy-mm-dd, tarikh sahaja) ATAU jatuh balik er.createdAt (ISO timestamp PENUH dgn masa,
// "2026-08-25T10:59:23.289Z") bila artikel tiada Tarikh Sumber — DUA bentuk berbeza, bukan
// medan "Tarikh Sumber" bebas-teks yang getDisplayDate() direka untuknya (yang SENGAJA tak
// hurai apa-apa selain corak yyyy-mm-dd tepat, supaya tarikh separa/teks lama macam "1980"
// tak rosak). Bila corak tak padan (kes timestamp penuh ni), getDisplayDate pulangkan STRING
// MENTAH (bukan kosong) — jadi `getDisplayDate(x) || formatSiaranDate(x)` di bawah TAK PERNAH
// jatuh ke formatSiaranDate, sebab hasil pertama tu sentiasa "truthy" walau ISO mentah.
// Kesan sebenar (dilaporkan Izzat, tangkapan skrin /bidang/geografi): artikel dgn Tarikh
// Sumber diisi papar betul "21 Ogo 2026", artikel yang jatuh balik createdAt papar mentah
// "2026-08-25T10:59:23.289Z". Dibetulkan dgn formatter khusus fail ni — kedua-dua corak
// (tarikh sahaja & timestamp penuh) sah dihurai terus oleh `new Date()`, jadi cukup SATU
// laluan format konsisten "D Bulan Pendek YYYY" tanpa cabang.
const formatTarikhArtikel = (raw?: string): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Halaman Bidang (/bidang/:slug, spesifikasi MUKTAMAD 2026-09-01, disahkan Izzat; disemak
// 2026-09-02) — lajur TUNGGAL, center-aligned, TIADA sidebar kanan, TIADA gambar langsung
// (keputusan Izzat, override cadangan ChatGPT), TIADA seksyen Hero berasingan. Dua seksyen:
// TERKINI (10 artikel terbaharu, TIADA pagination) dan "Koleksi Terdahulu" (baki artikel, label
// PAPARAN sahaja — JANGAN guna perkataan "Arkib" sebagai NAMA SEKSYEN, sebab konflik dengan
// status='archived' DB; label "Arkib" PER-ITEM di bawah tak sama isu, ia rujuk status kandungan
// ITU SENDIRI, bukan nama seksyen).
//
// Definisi kandungan awam: server (core/routes/bidangRoutes.js) kuatkuasakan status IN
// ('approved','archived') + MAX(version) per objectId (AMARAN WAJIB CLAUDE.md) — Izzat sahkan
// 2026-09-02 kandungan diarkibkan MEMANG patut kekal kelihatan di sini (Halaman Bidang ialah
// arkib rasmi awam Bidang tu, bukan cuma senarai hidup semasa). Halaman ni cuma paparkan apa
// yang pelayan pulangkan, tiada tapisan tambahan di sini.
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
  status: string;
  title: string;
  summary: string;
  desk: string;
  topik: string;
  briefLong: string;
  source: string;
  sourceUrl: string;
  editorName: string;
  image: string;
  originalDate: string;
  publishedDate: string;
  effectiveDate: string;
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

  const bukaArtikel = (objectId: string) => setFocusObjectId(objectId);
  const tutupArtikel = () => setFocusObjectId(null);

  // Navigasi turutan (2026-09-01, spesifikasi Halaman Bidang) — merentasi SEMUA artikel
  // dipaparkan (TERKINI + Koleksi Terdahulu SETAKAT halaman koleksi yang sudah dimuat), bukan
  // cuma halaman semasa. Di hujung senarai, prop tak dihantar (undefined) — FocusView sendiri
  // sorok anak panah bila `onPrev`/`onNext` tiada, ikut kontrak sedia ada.
  const keArtikelSeterusnya = focusIndex >= 0 && focusIndex < gabungan.length - 1
    ? () => setFocusObjectId(gabungan[focusIndex + 1].objectId)
    : undefined;
  const keArtikelSebelum = focusIndex > 0
    ? () => setFocusObjectId(gabungan[focusIndex - 1].objectId)
    : undefined;

  if (status === '404') return <TidakDijumpai />;

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-serif text-[#1F1F1F]">
      <header className="w-full max-w-2xl mx-auto px-6 pt-8 flex items-center justify-between">
        <Link
          to="/"
          className={`font-serif ${LOGO_SIZE.header} text-[#802334] tracking-tight hover:opacity-80 transition-opacity`}
        >
          {BRAND.logoText}
        </Link>
        <Link
          to="/"
          className="font-sans text-[10px] uppercase tracking-widest text-stone-500 hover:text-Adjung-maroon transition-colors"
        >
          Laman Utama
        </Link>
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
                    <li key={a.objectId} className={idx === 0 ? 'py-5' : 'py-4'}>
                      <button
                        type="button"
                        onClick={() => bukaArtikel(a.objectId)}
                        className="w-full text-left group"
                      >
                        {a.topik && (
                          <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-Adjung-maroon mb-1.5">
                            {a.topik}
                          </div>
                        )}
                        <div
                          className={`font-serif leading-snug text-[#1F1F1F] group-hover:text-Adjung-maroon transition-colors ${
                            idx === 0 ? 'text-[22px] md:text-[26px] font-semibold' : 'text-[17px] md:text-[19px] font-medium'
                          }`}
                        >
                          {safeParseInline(a.title)}
                        </div>
                        {a.summary && idx === 0 && (
                          <p className="font-sans text-[13px] text-stone-500 mt-2 leading-relaxed max-w-[640px]">
                            {safeParseInline(a.summary)}
                          </p>
                        )}
                        {a.effectiveDate && (
                          <div className="font-mono text-[10px] text-stone-400 mt-1.5">
                            {formatTarikhArtikel(a.effectiveDate)}
                            {a.status === 'archived' && <span className="ml-1.5 text-stone-300">· Arkib</span>}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Koleksi Terdahulu — label PAPARAN sahaja (bukan "Arkib"). Disorok sepenuhnya
                kalau jumlah keseluruhan <=10 (semua sudah muat dalam TERKINI). */}
            {totalKeseluruhan > PER_PAGE && (
              <section className="mt-12">
                <div className="flex items-center justify-center gap-3 mb-6">
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
                        <li key={a.objectId} className="py-4">
                          <button type="button" onClick={() => bukaArtikel(a.objectId)} className="w-full text-left group">
                            {a.topik && (
                              <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-Adjung-maroon mb-1.5">
                                {a.topik}
                              </div>
                            )}
                            <div className="font-serif text-[16px] md:text-[17px] font-medium leading-snug text-[#1F1F1F] group-hover:text-Adjung-maroon transition-colors">
                              {safeParseInline(a.title)}
                            </div>
                            {a.effectiveDate && (
                              <div className="font-mono text-[10px] text-stone-400 mt-1.5">
                                {formatTarikhArtikel(a.effectiveDate)}
                                {a.status === 'archived' && <span className="ml-1.5 text-stone-300">· Arkib</span>}
                              </div>
                            )}
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
          note={undefined}
          source={focusItem.source}
          sourceUrl={focusItem.sourceUrl}
          objectId={focusItem.objectId}
          sourceDate={getDisplayDate(focusItem.originalDate)}
          publishedDate={formatSiaranDate(focusItem.publishedDate)}
          editorName={focusItem.editorName}
          onPrev={keArtikelSebelum}
          onNext={keArtikelSeterusnya}
          prevPreviewTitle={focusIndex > 0 ? gabungan[focusIndex - 1].title : undefined}
          nextPreviewTitle={(focusIndex >= 0 && focusIndex < gabungan.length - 1) ? gabungan[focusIndex + 1].title : undefined}
          onClose={tutupArtikel}
          navMode="turutan"
          startPaused={true}
        />
      )}
    </div>
  );
}
