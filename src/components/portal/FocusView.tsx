import React from 'react';
import { X } from 'lucide-react';
import { usePhoneViewport } from '../../hooks/usePhoneViewport';
import { eyebrowLabel } from '../../../core/editorial/GeometryConfig.js';

// ============================================================================
// FOCUS VIEW — permukaan bacaan skrin penuh yang dibuka bila kad bento diklik.
//
// Port terus daripada `components/focus/FocusView.jsx` dalam projek "Adjung Brief
// Design System" (Claude Design), ditambah penaipan TypeScript. Latar krim, marun
// sebagai satu-satunya aksen: perbendaharaan visual frontpage pada skala bacaan.
//
// Dibina daripada handoff "Adjung Brief — Focus View", dengan dua penyimpangan yang
// diputuskan pemilik projek selepas melihatnya berjalan dengan kandungan sebenar:
//
//  1. TAJUK sahaja yang statik. Huraian pendek dan huraian panjang menatal bersama
//     sebagai satu aliran. Handoff mengunci tajuk + huraian pendek sebagai jalur tetap
//     setinggi minimum 350px; diukur pada kandungan sebenar, 189px daripadanya (54%)
//     lompang. Lihat nota panjang di kawasan BADAN.
//
//  2. Bahagian PILIHAN yang kosong tidak dirender langsung. Handoff mengkhaskan
//     ruangnya dengan pemegang tempat bergaris putus supaya komposisi tak beralih —
//     tetapi Grafik, Kandungan berkaitan, Nota dan nama editor belum ada sumber data
//     langsung, jadi pemegang tempat itu muncul pada SETIAP kandungan. Lihat nota
//     "MENGKHASKAN RUANG BUKAN MENGUMUMKAN KETIADAAN".
//
// Ukuran disaiz mengikut had aksara sebenar (GeometryConfig, kes terburuk MENEGAK):
// tajuk 168, huraian pendek 429, huraian panjang 600.
//
// Token warna/taip (--surface-page, --stone-*, --text-13 dll.) ada di src/index.css.
// ============================================================================

// Benar selagi kandungan elemen lebih tinggi daripada kotaknya. Memerhati elemen itu DAN tetingkap,
// jadi jalur pudar muncul dan hilang mengikut susun atur sebenar, bukan tekaan kiraan aksara.
//
// Ini menggantikan ujian `text.length > 600` yang pernah dipakai: kiraan aksara meninggalkan
// kawasan yang benar-benar terpotong tanpa sebarang jalur pudar. Ukur kotak, jangan agak.
function useOverflowFade(): [React.RefObject<HTMLDivElement | null>, React.CSSProperties] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [over, setOver] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setOver(el.scrollHeight - el.clientHeight > 2);
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    if (ro) { ro.observe(el); if (el.firstElementChild) ro.observe(el.firstElementChild); }
    window.addEventListener('resize', read);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', read); };
  });
  const fade = over ? 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)' : 'none';
  return [ref, { maskImage: fade, WebkitMaskImage: fade }];
}

/** Had nota — tiga baris pada 11px/1.6 dalam kolum luar. */
export const NOTA_MAX = 180;

function trimNota(note?: string): string {
  const t = String(note || '').trim();
  if (t.length <= NOTA_MAX) return t;
  const cut = t.lastIndexOf(' ', NOTA_MAX);
  return t.slice(0, cut > NOTA_MAX * 0.6 ? cut : NOTA_MAX).trim() + '…';
}

export interface FocusRelatedItem {
  title: string;
  url?: string;
}

export interface FocusViewProps {
  /** Logo Adjung, di kiri jalur masthead. */
  wordmark?: string;
  /** Glif Bidang. DITERIMA tetapi tidak dirender: memaparkan ikon bersebelahan perkataan yang ikon
   *  itu wakili adalah berlebihan, dan pemilik projek memilih untuk mengekalkan perkataan — ia
   *  memberitahu pembaca Bidang apa tanpa perlu mengenali 25 simbol dahulu.
   *
   *  Prop ini dikekalkan supaya pemanggil (FrontpageView) tidak perlu diubah, dan supaya keputusan
   *  ini boleh dipatah balik dengan satu suntingan kalau ikon khas menggantikan ikon lucide generik
   *  nanti. Ikon Bidang masih dipakai seperti biasa di Taksonomi Editorium. */
  icon?: React.ReactNode;
  desk?: string;
  topik?: string;
  /** Warna Bidang (CategoryRegistry.color). Eyebrow kad guna warna ini, jadi Focus View mesti guna
   *  yang sama — kandungan yang sama tidak sepatutnya bertukar warna identiti apabila dibuka.
   *  Jatuh balik ke marun Adjung kalau Bidang tiada warna. */
  deskColor?: string;
  title: string;
  /** Huraian panjang — SATU-SATUNYA badan kandungan (huraian pendek dibuang 2026-07-29, tidak
   *  lagi diterima sebagai prop). Mengalir dalam satu lajur, menatal dalam kotaknya sendiri —
   *  satu-satunya bahagian Focus View yang menatal. */
  body?: string;
  /** Grafik: nod imej, ilustrasi atau carta. Pilihan; tidak dirender langsung bila tiada. */
  visual?: React.ReactNode;
  visualCaption?: string;
  /** Kandungan berkaitan. Pilihan; tidak dirender langsung bila tiada. */
  related?: Array<FocusRelatedItem | string>;
  /** Nota editor. Pilihan; dipotong pada NOTA_MAX aksara, tidak dirender bila tiada. */
  note?: string;
  /** Markup SVG plat ilustrasi Bidang (sudah disanitize + disahkan ikut spec di server).
   *  Dipapar HANYA apabila kolum kanan tiada grafik, tiada kandungan berkaitan dan tiada nota —
   *  ia mengalah kepada kandungan sebenar, sentiasa. */
  illustrationSvg?: string | null;
  /** Sumber (nama atau teks URL), dipapar di kolofon. */
  source?: string;
  sourceUrl?: string;
  /** Tarikh sumber — tarikh bahan asal, dipapar di sebelah Sumber. */
  sourceDate?: string;
  /** Tarikh siaran — tarikh penyiaran Adjung, dipapar sebaris dengan eyebrow atas tajuk. */
  publishedDate?: string;
  editorName?: string;
  /** E-mel atau laman editor; alamat yang mengandungi "@" dipaut sebagai mailto. */
  editorContact?: string;
  /** Lapisan kedua pilihan yang sangat samar atas latar pejal. */
  backdropImage?: string;
  backdropOpacity?: number;
  /** Mod navigasi RAWAK (2026-07-29): `onPrev` UNDUR sejarah dilawati (bukan rawak baharu),
   *  `onNext` lompat ke sasaran rawak merentasi SELURUH laman. `undefined` (bukan dilumpuhkan)
   *  bila tiada sejarah/sasaran — anak panah tidak dirender langsung, ikut pola render-hanya-
   *  bila-ada-isi fail ni. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Tajuk kandungan sebelum/selepas, dipapar kecil di sebelah anak panah atas/bawah. Tiada kesan
   *  kalau `onPrev`/`onNext` sepadan tiada. */
  prevPreviewTitle?: string;
  nextPreviewTitle?: string;
  onClose?: () => void;
}

export const FocusView: React.FC<FocusViewProps> = ({
  wordmark = 'Adjung', icon, desk, topik, deskColor, title, body,
  visual, visualCaption, related = [], note, illustrationSvg,
  source, sourceUrl, sourceDate, publishedDate,
  editorName, editorContact, backdropImage, backdropOpacity = 0.06,
  onPrev, onNext, prevPreviewTitle, nextPreviewTitle, onClose,
}) => {
  // Format label datang daripada eyebrowLabel() di GeometryConfig — sumber SAMA yang dipakai kad
  // bento dan pengesahan simpan. Sebelum ini fail ini ada takrifannya sendiri (' · '), jadi Focus
  // View memapar "MALAYSIANA · Percubaan" sementara kad memapar "MALAYSIANA | Percubaan" untuk
  // kandungan yang sama. CLAUDE.md melarang menulis semula format ini secara khusus: kalau ia
  // bercabang, had aksara mengesahkan string yang berlainan daripada yang benar-benar dirender.
  const label = eyebrowLabel(desk, topik);
  const warnaEyebrow = deskColor || 'var(--color-Adjung-maroon)';
  const isPhone = usePhoneViewport();

  // Huraian panjang render satu lajur, perenggan berturutan — TIADA lagi pembahagian dua-ukuran
  // (2026-07-29, sejak huraian pendek dibuang: pembahagian tu sedia ada khusus untuk imbang ruang
  // bacaan apabila huraian pendek+panjang berkongsi jalur yang sama; dengan huraian pendek tiada,
  // satu lajur lurus lebih ringkas dan padan reka bentuk rujukan pemilik projek).
  const text = String(body || '').trim();
  const paragraphs = React.useMemo(
    () => text.split(/\n{2,}/).filter(Boolean),
    [text]
  );

  const [bodyRef, bodyFade] = useOverflowFade();

  // Plat ilustrasi Bidang menutup kolum kanan HANYA apabila kolum itu benar-benar kosong. Ia
  // mengalah kepada kandungan sebenar tanpa kecuali: satu grafik, satu preview Sebelum/Selepas
  // atau satu nota sudah cukup untuk menyingkirkannya. (2026-07-29: "kandungan berkaitan"
  // dibuang daripada semakan ni — digantikan preview Sebelum/Selepas di susun atur desktop.)
  //
  // Ia identiti Bidang, bukan kandungan — jadi ia tidak mendakwa apa-apa tentang rencana itu, dan
  // ia tidak mengumumkan ketiadaan seperti pemegang tempat bergaris putus yang dibuang dahulu.
  const kananKosong = !visual && !note && !prevPreviewTitle && !nextPreviewTitle;
  const showIllustration = kananKosong && !!illustrationSvg;

  // Nota melebihi hadnya dipotong di sempadan perkataan; teks penuh kekal dalam atribut `title`,
  // dan amaran konsol menamakan lebihannya supaya editor memendekkannya di Editorium.
  const notaText = trimNota(note);
  React.useEffect(() => {
    const n = String(note || '').trim().length;
    if (n > NOTA_MAX) console.warn(`FocusView: nota ${n}/${NOTA_MAX} aksara — pendekkan nota di Editorium.`);
  }, [note]);

  // Had tajuk ialah 168 aksara (MENEGAK). Saiz menurun mengikut kiraan aksara supaya blok tajuk
  // menduduki ukuran yang sama sama ada tajuk 40 aksara atau 168 aksara penuh.
  //
  // TETAP dalam px, TIADA terma viewport. Versi clamp(..., vh, ...) terdahulu memapar tajuk 168
  // aksara pada 20.7px dan bukan 27px, kerana 2.3vh pada tinggi 900px ialah 20.7px — clamp itu
  // memilih nilai tengah, bukan nilai maksimum. Jangan perkenalkan semula terma vh di sini.
  const n = String(title || '').length;
  const titleSize = n <= 60 ? '44px' : n <= 100 ? '37px' : n <= 140 ? '31px' : '27px';

  // Karya seni DIMUATKAN, tidak pernah dipangkas: kekang nod yang dihantar itu sendiri, kerana
  // kotak plat cuma mengerat. Anak bukan-elemen (teks, fragmen) lalu tanpa disentuh.
  const plate = React.isValidElement(visual)
    ? React.cloneElement(visual as React.ReactElement<any>, {
        style: {
          maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto',
          objectFit: 'contain', display: 'block',
          ...((visual as React.ReactElement<any>).props.style || {}),
        },
      })
    : visual;

  const rule: React.CSSProperties = { border: 0, borderTop: '1px solid var(--border-default)', margin: 0, width: '100%' };
  const micro: React.CSSProperties = {
    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-10)', textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-editorial)', color: 'var(--stone-400)', fontWeight: 'var(--weight-semibold)' as any,
  };
  // MENGKHASKAN RUANG BUKAN MENGUMUMKAN KETIADAAN
  //
  // Handoff menetapkan bahagian pilihan yang kosong memapar pemegang tempat bergaris putus —
  // "Ruang grafik", "Tiada kandungan berkaitan", "Tiada nota editor." — supaya komposisi tidak
  // pernah beralih semasa melangkah antara kandungan dengan Sebelum/Seterusnya.
  //
  // Alasan itu bergantung pada satu andaian: medan tersebut kadang-kadang berisi. Ia tidak.
  // FrontpageView memanggil FocusView tanpa prop `visual`, `visualCaption`, `related`, `note`,
  // `editorName` atau `editorContact` langsung — medan itu belum ada sumber data. Jadi pemegang
  // tempat tersebut muncul pada SETIAP kandungan, 100% masa, dan seluruh kolum kanan permukaan
  // bacaan awam menjadi pengumuman ketiadaan. Tiada apa yang boleh beralih apabila tiada apa yang
  // pernah ada.
  //
  // Keputusan pemilik projek: label dan kandungan dirender hanya apabila ada isi. RUANG masih
  // dikhaskan — trek grid 9/span 4 kekal, jadi ukuran bacaan di kolum 1-8 tidak pernah berubah
  // lebar. Yang dibuang cuma kotak putus-putus dan teks "Tiada ...".
  //
  // Apabila medan itu disambungkan kepada sumber data nanti, jaminan tanpa-reflow handoff boleh
  // dihidupkan semula per medan dengan memulangkan pemegang tempat ini.
  // Nav penjuru menyala marun pada hover DAN pada fokus papan kekunci — kedua-duanya, bukan hover
  // sahaja (kekal daripada versi chevron kiri/kanan terdahulu). Nilai motion ditulis terus (150ms,
  // cubic-bezier(0.4,0,0.2,1)) kerana --duration-fast dan --ease-standard tidak wujud dalam
  // src/index.css; ia token projek Claude Design sahaja.
  //
  // Terapung penjuru (2026-07-29, gantikan chevron sisi mendatar lama): atas-kiri "sebelum",
  // bawah-kanan "seterusnya" — padan susun atur mockup rujukan. Lebar dihadkan supaya preview
  // tajuk panjang tidak melimpah ke tengah skrin.
  // Jarak dari bucu skrin dinaikkan ke 16% (bukan clamp(14-28px)) 2026-07-29 — nombor asal
  // terlalu dekat bucu, preview jadi sesak dengan masthead (atas) dan kolofon (bawah). Padan
  // mockup rujukan: preview "sebelum" sejajar kasar dengan zon eyebrow/tajuk, "seterusnya"
  // sejajar kasar dengan zon imej/berkaitan — bukan melekat di bucu mutlak.
  const cornerNav = (corner: 'top-left' | 'bottom-right', on: boolean): React.CSSProperties => ({
    position: 'absolute',
    ...(corner === 'top-left'
      ? { top: '16%', left: 'clamp(14px, 2.4vw, 28px)', alignItems: 'flex-start' as const }
      : { bottom: '16%', right: 'clamp(14px, 2.4vw, 28px)', alignItems: 'flex-end' as const }),
    display: 'flex', flexDirection: 'column' as const, gap: '4px',
    maxWidth: 'clamp(130px, 16vw, 240px)',
    background: 'none', border: 0, padding: '6px', margin: 0, cursor: 'pointer',
    color: on ? 'var(--color-Adjung-maroon)' : 'var(--stone-400)',
    // Samar secara lalai (permintaan pemilik projek 2026-07-29) — cuma nampak jelas bila
    // hover/fokus, supaya tak bersaing tumpuan dengan kandungan utama.
    opacity: on ? 1 : 0.45,
    transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  });
  const [hovered, setHovered] = React.useState<'prev' | 'next' | null>(null);
  const navProps = (key: 'prev' | 'next') => ({
    onMouseEnter: () => setHovered(key), onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(key), onBlur: () => setHovered(null),
  });

  // Papan kekunci (Esc/ArrowUp/ArrowDown) dikendalikan SATU tempat sahaja: FrontpageView.tsx
  // (pemanggil tunggal fail ni). Versi terdahulu ada listener kedua di sini juga — kedua-dua
  // terpasang serentak sepanjang Focus View terbuka, jadi setiap tekanan kekunci mencetuskan
  // pengendali dua kali (pepijat sedia ada, dibetulkan 2026-07-29 dengan membuang listener ni).

  // Butang tutup: ikon X, sama seperti Toast, Direktori, Indeks, Tetapan dan modal editor slot.
  // Handoff menetapkan perkataan "Tutup" bergaris bawah, tetapi Focus View satu-satunya permukaan
  // dalam aplikasi ini yang berbuat begitu; keputusan pemilik projek ialah ikut aplikasi. Nama
  // Melayu kekal melalui aria-label, corak yang sama dengan Toast.
  //
  // Warna mengikut chevron navigasi dalam komponen yang sama: stone-400 ketika rehat, marun pada
  // hover dan fokus papan kekunci.
  const [closeLit, setCloseLit] = React.useState(false);
  const closeProps = {
    type: 'button' as const,
    onClick: onClose,
    'aria-label': 'Tutup',
    onMouseEnter: () => setCloseLit(true), onMouseLeave: () => setCloseLit(false),
    onFocus: () => setCloseLit(true), onBlur: () => setCloseLit(false),
  };

  // ==========================================================================================
  // SUSUN ATUR TELEFON
  //
  // Susun atur desktop di bawah ialah grid 12 kolum setinggi skrin yang sengaja TIDAK menatal:
  // segala-galanya mesti muat dalam bingkai, dan ruang bagi bahagian pilihan sentiasa dikhaskan
  // supaya komposisi tidak beralih. Kedua-dua sifat itu mustahil pada 390px, jadi telefon dapat
  // pokok tersendiri, bukan versi desktop yang dimampatkan:
  //
  //   - satu kolum yang menatal menegak, bukan grid berbingkai tetap
  //   - bahagian pilihan yang kosong DISEMBUNYIKAN, bukan dikhaskan ruangnya — tiada komposisi
  //     mengufuk untuk dipelihara apabila halaman memang menatal
  //   - navigasi Sebelum/Seterusnya menjadi jalur melekat di kaki (sasaran sentuh 56px) kerana
  //     anak panah tepi desktop terlalu kecil dan terlalu hampir dengan bucu skrin untuk ibu jari
  //
  // Semua medan dan sumber data adalah SAMA seperti desktop — cuma susunannya berbeza.
  // ==========================================================================================
  if (isPhone) {
    const sectionLabel: React.CSSProperties = {
      fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-widest)', color: 'var(--stone-400)',
    };
    const navBtn: React.CSSProperties = {
      appearance: 'none', background: 'var(--surface-page)', border: 0, color: 'var(--stone-600)',
      fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: 'var(--tracking-wide)',
      minHeight: '56px', cursor: 'pointer',
    };

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'var(--surface-page)',
        color: 'var(--text-body)', display: 'flex', flexDirection: 'column',
      }}>
        {backdropImage && (
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0, backgroundImage: 'url(' + backdropImage + ')',
            backgroundSize: 'cover', backgroundPosition: 'center', opacity: backdropOpacity, pointerEvents: 'none',
          }} />
        )}

        {/* Jalur atas — logo dan Tutup */}
        <div style={{
          position: 'relative', flex: '0 0 auto', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px', padding: '10px 16px',
          borderBottom: '1px solid var(--stone-300)',
        }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--color-Adjung-maroon)' }}>{wordmark}</span>
          {/* Sasaran sentuh 44x44 dikekalkan; pil itu kini memegang ikon, bukan perkataan. */}
          {onClose && (
            <button {...closeProps} style={{
              appearance: 'none', background: 'transparent', border: '1px solid var(--stone-300)',
              borderRadius: '999px', color: 'var(--stone-600)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px',
              padding: 0, cursor: 'pointer',
            }}>
              <X size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Badan yang menatal */}
        <div style={{
          position: 'relative', flex: '1 1 auto', minHeight: 0, overflowY: 'auto',
          padding: '20px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px',
        }}>
          {/* Glif Bidang sengaja TIDAK dirender di sini — lihat nota `icon` dalam FocusViewProps. */}
          {label && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-editorial)', color: warnaEyebrow,
              }}>{label}</span>
            </div>
          )}

          <h1 style={{
            margin: 0, fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 500,
            lineHeight: 1.18, letterSpacing: 'var(--tracking-tight)', color: 'var(--text-heading)', textWrap: 'pretty',
          }}>{title}</h1>

          {text && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <hr style={{ ...rule, borderTopColor: 'var(--border-subtle)' }} />
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '14px', fontWeight: 300,
                lineHeight: 1.75, color: 'var(--text-body)', textWrap: 'pretty',
              }}>
                {paragraphs.map((para, j) => (
                  <p key={j} style={{ margin: j === 0 ? 0 : '0.9em 0 0' }}>{para}</p>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={sectionLabel}>Sumber</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', color: 'var(--stone-500)', lineHeight: 1.5 }}>
              <a href={sourceUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--stone-500)', wordBreak: 'break-all' }}>{source || '—'}</a>
              {sourceDate && <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)' }}> · {sourceDate}</span>}
            </span>
            {publishedDate && (
              <span style={{ ...sectionLabel, fontWeight: 400, color: 'var(--stone-400)' }}>
                Siaran <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)' }}>{publishedDate}</span>
              </span>
            )}
          </div>

          {visual && (
            <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={sectionLabel}>Lampiran visual</span>
              <div style={{
                width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                background: 'var(--stone-150)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{visual}</div>
              {visualCaption && <figcaption style={{ ...sectionLabel, fontWeight: 500, color: 'var(--stone-500)' }}>{visualCaption}</figcaption>}
            </figure>
          )}

          {related.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={sectionLabel}>Kandungan berkaitan</span>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {related.slice(0, 2).map((r, i) => {
                  const item: FocusRelatedItem = typeof r === 'string' ? { title: r } : r;
                  return (
                    <li key={i} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-9)', color: 'var(--color-Adjung-maroon)', paddingTop: '3px' }}>{String(i + 1).padStart(2, '0')}</span>
                      <a href={item.url || '#'} style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', lineHeight: 'var(--leading-snug)', color: 'var(--text-heading)' }}>{item.title}</a>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {note && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={sectionLabel}>Nota editor</span>
              <p style={{
                margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'var(--text-13)', fontWeight: 300,
                lineHeight: 'var(--leading-relaxed)', color: 'var(--stone-600)', textWrap: 'pretty',
              }}>{note}</p>
              {editorName && (
                <span style={{ fontFamily: 'var(--font-signature)', fontSize: 'var(--text-30)', lineHeight: 1, color: 'var(--color-Adjung-maroon)', marginTop: '2px' }}>{editorName}</span>
              )}
              {editorContact && (
                <a
                  href={editorContact.includes('@') ? 'mailto:' + editorContact : 'https://' + editorContact}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...sectionLabel, fontWeight: 400, textTransform: 'none', letterSpacing: 'var(--tracking-wide)', color: 'var(--stone-400)' }}
                >{editorContact}</a>
              )}
            </div>
          )}
        </div>

        {/* Navigasi melekat di kaki */}
        {(onPrev || onNext) && (
          <div style={{
            position: 'relative', flex: '0 0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '1px', background: 'var(--border-default)', borderTop: '1px solid var(--border-default)',
          }}>
            <button type="button" aria-label="Kandungan sebelum" onClick={onPrev} disabled={!onPrev} style={navBtn}>‹ Sebelum</button>
            <button type="button" aria-label="Kandungan seterusnya" onClick={onNext} disabled={!onNext} style={navBtn}>Seterusnya ›</button>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================================
  // SUSUN ATUR DESKTOP — dibina semula 2026-07-29 ikut spesifikasi baharu pemilik projek (rujuk
  // mockup "Adjung Brief — Focus View" yang dikemas kini). Grid SATU LAJUR UTAMA menegak
  // (masthead / eyebrow+tarikh / tajuk / huraian panjang / imej+berkaitan / kolofon), gantikan
  // susun atur dua-lajur setinggi-penuh (8/4) terdahulu, sebab huraian pendek dibuang dan grafik
  // kini bawah tajuk+huraian, bukan sebelah.
  //
  // TIADA scroll peringkat halaman — keputusan eksplisit pemilik projek: Focus View kekal dalam
  // SATU skrin (100vh) selalu. Baris huraian panjang (`minmax(0, 1fr)`) SATU-SATUNYA yang boleh
  // menatal (kotak sendiri, overflow-y auto); setiap baris grid lain saiz semula jadi (`auto`)
  // atau tinggi tetap (imej+berkaitan) supaya komposisi tidak beralih antara satu kandungan
  // dengan kandungan lain semasa navigasi.
  // ==========================================================================================
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, overflow: 'hidden', background: 'var(--surface-page)', color: 'var(--text-body)', display: 'flex', flexDirection: 'column' }}>
      {backdropImage && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, backgroundImage: 'url(' + backdropImage + ')',
          backgroundSize: 'cover', backgroundPosition: 'center', opacity: backdropOpacity, pointerEvents: 'none',
        }} />
      )}

      {/* MASTHEAD — merentasi lebar PENUH viewport (bukan dihadkan lebar helaian sempit di bawah).
          Logo DI TENGAH-TENGAH bar ni (bukan kiri) — grid 3-lajur (1fr/auto/1fr) supaya logo
          benar-benar tengah tanpa terjejas oleh kehadiran/ketiadaan butang tutup di sisi (flex
          space-between cuma tolak ke tepi, tak pusatkan). Tutup kekal bucu kanan. Garisan halus
          dikembalikan (2026-07-29, permintaan pemilik projek selepas cuba tanpa garisan). */}
      <hr style={{ ...rule, flex: '0 0 auto' }} />
      <div style={{ flex: '0 0 auto', width: '100%', boxSizing: 'border-box', padding: 'clamp(10px, 1.8vh, 18px) clamp(16px, 3vw, 40px)', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
        <span />
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-18)', letterSpacing: 'var(--tracking-tight)', color: 'var(--color-Adjung-maroon)', justifySelf: 'center' }}>{wordmark}</span>
        {onClose && (
          <button {...closeProps} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            justifySelf: 'end', background: 'none', border: 0, padding: 0, cursor: 'pointer', lineHeight: 1,
            color: closeLit ? 'var(--color-Adjung-maroon)' : 'var(--stone-400)',
            transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <X size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <hr style={{ ...rule, flex: '0 0 auto' }} />

      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, boxSizing: 'border-box', padding: 'clamp(10px, 1.6vh, 18px) 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Helaian dipersempit (86%→64%, 2026-07-29) — lajur lebar penuh tidak tinggalkan margin
            cukup untuk nav penjuru (preview kandungan sebelum/selepas) duduk selesa tanpa sesak
            dengan kandungan utama. Disahkan terhadap mockup rujukan: helaian ~51-65% lebar
            viewport, margin kiri/kanan cukup luas untuk preview + anak panah. */}
        <div style={{
          width: 'min(64%, 900px)', height: '100%', maxHeight: '100%', boxSizing: 'border-box',
          display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr) minmax(140px, auto)',
        }}>

          {/* EYEBROW + TARIKH SIARAN — terus atas tajuk. Tanpa label "Siaran" (dibuang
              2026-07-29); format nombor tarikh siaran tidak berubah, cuma kedudukan/label. Jurang
              atas lebih lapang (2026-07-29, disahkan terhadap mockup rujukan) — versi pertama
              terlalu rapat dengan masthead berbanding rujukan. */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', padding: 'clamp(28px, 5vh, 56px) 0 0' }}>
            {label && (
              <span style={{ ...micro, color: warnaEyebrow, fontWeight: 'var(--weight-bold)' as any, whiteSpace: 'nowrap' }}>{label}</span>
            )}
            {publishedDate && (
              <span style={{ ...micro, fontFamily: 'var(--font-mono)', color: 'var(--stone-500)', letterSpacing: 'var(--tracking-wide)', whiteSpace: 'nowrap' }}>{publishedDate}</span>
            )}
          </div>

          {/* TAJUK — statik, tiada scroll. Saiz melangkah 44/37/31/27 mengikut kiraan aksara. */}
          <h1 style={{ margin: 'clamp(8px, 1.4vh, 14px) 0 0', fontFamily: 'var(--font-serif)', fontWeight: 'var(--weight-regular)' as any, fontSize: titleSize, lineHeight: 1.18, letterSpacing: 'var(--tracking-tight)', color: 'var(--text-heading)', textWrap: 'pretty' }}>{title}</h1>

          {/* HURAIAN PANJANG — SATU-SATUNYA bahagian Focus View yang menatal. Satu lajur,
              perenggan berturutan (pembahagian dua-ukuran lama dibuang bersama huraian pendek). */}
          <div ref={bodyRef} style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', padding: 'clamp(16px, 2.6vh, 26px) 0', ...bodyFade }}>
            {paragraphs.length > 0 && (
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-15)', fontWeight: 'var(--weight-light)' as any, lineHeight: 1.75, color: 'var(--stone-600)', textWrap: 'pretty' }}>
                {paragraphs.map((para, j) => (
                  <p key={j} style={{ margin: j === 0 ? 0 : '1em 0 0' }}>{para}</p>
                ))}
              </div>
            )}
          </div>

          {/* IMEJ + KANDUNGAN BERKAITAN — jalur di bawah huraian panjang, dua sub-lajur. Tinggi
              jalur ni minmax(140px, auto) (bukan tinggi tetap 2026-07-29) — SEKURANG-KURANGNYA
              140px dikhaskan supaya sentiasa ada ruang kelihatan untuk grafik/berkaitan walau
              kandungan tu tiada lagi (jawapan kepada "mana ruang utk kandungan berkaitan?"), tapi
              tumbuh melebihi 140px bila kandungan sebenar (2 item berkaitan + nota) perlukan lebih
              — supaya TIADA kotak scroll sendiri di sini. Baris huraian panjang (minmax(0,1fr)) di
              atas yang menyerap sisa ruang dan membawa SATU-SATUNYA kotak scroll di seluruh Focus
              View (permintaan eksplisit pemilik projek). Plat ilustrasi Bidang — lihat
              `showIllustration` — mengalah kepada grafik/berkaitan/nota sebenar secara automatik,
              tiada perubahan logik. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 9fr)', columnGap: 'clamp(20px, 2.8vw, 40px)', alignItems: 'center', paddingTop: 'clamp(10px, 1.8vh, 18px)', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {showIllustration && (
                <div
                  aria-hidden="true"
                  className="bidang-illustration"
                  style={{ height: '180px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-Adjung-maroon)', opacity: 0.9, pointerEvents: 'none' }}
                  dangerouslySetInnerHTML={{ __html: illustrationSvg as string }}
                />
              )}

              {visual && (
                <figure style={{ margin: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    width: '100%', aspectRatio: '4 / 3', maxHeight: 'clamp(140px, 20vh, 220px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {plate}
                  </div>
                  {visualCaption && (
                    <figcaption style={{ ...micro, marginTop: '10px', textAlign: 'center', fontWeight: 'var(--weight-medium)' as any }}>{visualCaption}</figcaption>
                  )}
                </figure>
              )}
            </div>

            {/* maxWidth 85% (bukan 100% kolum grid) 2026-07-29 — pemilik projek minta kolum
                nota/berkaitan dikecilkan sikit; kolum imej sebelah tidak disentuh.
                "Kandungan berkaitan" DIBUANG 2026-07-29 (permintaan pemilik projek — paparan
                dianggap hodoh, dan medan `related` tiada sumber data sebenar buat masa ni
                lagipun). Digantikan preview kandungan Sebelum/Selepas (mod navigasi rawak) —
                data sama yang dipakai nav penjuru terapung, jadi tiada plumbing baharu. */}
            <div style={{ minWidth: 0, maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.6vh, 16px)' }}>
              {(prevPreviewTitle || nextPreviewTitle) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.4vh, 14px)' }}>
                  {prevPreviewTitle && (
                    <button
                      type="button" onClick={onPrev}
                      style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'none', border: 0, padding: 0, margin: 0, textAlign: 'left', cursor: onPrev ? 'pointer' : 'default' }}
                    >
                      <span style={micro}>Sebelum</span>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-13)', lineHeight: 1.4, color: 'var(--text-heading)' }}>{prevPreviewTitle}</span>
                    </button>
                  )}
                  {nextPreviewTitle && (
                    <button
                      type="button" onClick={onNext}
                      style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'none', border: 0, padding: 0, margin: 0, textAlign: 'left', cursor: onNext ? 'pointer' : 'default' }}
                    >
                      <span style={micro}>Selepas</span>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-13)', lineHeight: 1.4, color: 'var(--text-heading)' }}>{nextPreviewTitle}</span>
                    </button>
                  )}
                </div>
              )}

              {note && (
                <p title={note} style={{ margin: 0, paddingLeft: '12px', borderLeft: '2px solid var(--color-Adjung-maroon)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', lineHeight: 1.6, color: 'var(--stone-600)' }}>
                  <span style={{ color: 'var(--color-Adjung-maroon)', fontWeight: 'var(--weight-semibold)' as any }}>Nota — </span>{notaText}
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* KOLOFON — sumber + tarikh sumber (bucu kiri) · editor + hubungan (bucu kanan). Merentasi
          lebar PENUH viewport, sama corak macam MASTHEAD (2026-07-29) — bukan lagi dihadkan
          lebar helaian bacaan sempit. `sourceDate` diterima di sini sudah dalam format Melayu
          panjang ("29 Julai 26") — pemanggil yang uruskan format, fail ni cuma papar apa yang
          diterima. Garisan halus dikembalikan (permintaan pemilik projek selepas cuba tanpa
          garisan). */}
      <hr style={{ ...rule, flex: '0 0 auto' }} />
      <div style={{ flex: '0 0 auto', width: '100%', boxSizing: 'border-box', padding: 'clamp(10px, 1.8vh, 18px) clamp(16px, 3vw, 40px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '32px' }}>
        <span style={{ maxWidth: '48%', lineHeight: 1.5 }}>
          <span style={micro}>Sumber</span>
          <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', color: 'var(--stone-500)' }}>
            <a href={sourceUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--stone-500)', wordBreak: 'break-all' }}>{source || '—'}</a>
            {sourceDate && <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)' }}> · {sourceDate}</span>}
          </span>
        </span>
        {/* alignItems: flex-end dalam lajur flex — text-align sahaja membiarkan tepi hanyut */}
        {(editorName || editorContact) && (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
            {editorName && (
              <span style={{ fontFamily: 'var(--font-signature)', fontSize: 'var(--text-30)', color: 'var(--color-Adjung-maroon)' }}>{editorName}</span>
            )}
            {editorContact && (
              <a
                href={editorContact.includes('@') ? 'mailto:' + editorContact : 'https://' + editorContact}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...micro, color: 'var(--stone-500)', textTransform: 'none', letterSpacing: 'var(--tracking-wide)', fontWeight: 'var(--weight-regular)' as any }}
              >
                {editorContact}
              </a>
            )}
          </span>
        )}
      </div>

      {/* NAV PENJURU — mod rawak: atas-kiri "sebelum" (undur sejarah), bawah-kanan "seterusnya"
          (lompat rawak). HANYA anak panah, TIADA teks preview di sini lagi (2026-07-29) — preview
          tajuk kini di jalur Sebelum/Selepas dalam kandungan utama, teks di sini jadi berganda
          dengan itu (pemilik projek tunjuk pangkah). Anak panah ni kekal sebagai sasaran klik +
          isyarat visual sahaja. Terapung di penjuru viewport (position:absolute pada pembalut
          fixed terluar, BUKAN di dalam helaian dipusatkan). */}
      {onPrev && (
        <button type="button" aria-label="Kandungan sebelum" onClick={onPrev} style={cornerNav('top-left', hovered === 'prev')} {...navProps('prev')}>
          <span style={{ fontSize: 'clamp(13px, 1.1vw, 16px)', lineHeight: 1 }}>▲</span>
        </button>
      )}
      {onNext && (
        <button type="button" aria-label="Kandungan seterusnya" onClick={onNext} style={cornerNav('bottom-right', hovered === 'next')} {...navProps('next')}>
          <span style={{ fontSize: 'clamp(13px, 1.1vw, 16px)', lineHeight: 1 }}>▼</span>
        </button>
      )}
    </div>
  );
};
