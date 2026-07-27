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
  /** Huraian pendek — had 429 aksara, satu ukuran lebar. */
  brief?: string;
  /** Huraian panjang — mengalir dalam dua ukuran, menatal bersama huraian pendek. */
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
  /** Tarikh siaran — tarikh penyiaran Adjung, dipapar di jalur masthead. */
  publishedDate?: string;
  editorName?: string;
  /** E-mel atau laman editor; alamat yang mengandungi "@" dipaut sebagai mailto. */
  editorContact?: string;
  /** Lapisan kedua pilihan yang sangat samar atas latar pejal. */
  backdropImage?: string;
  backdropOpacity?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onClose?: () => void;
}

export const FocusView: React.FC<FocusViewProps> = ({
  wordmark = 'Adjung', icon, desk, topik, deskColor, title, brief, body,
  visual, visualCaption, related = [], note, illustrationSvg,
  source, sourceUrl, sourceDate, publishedDate,
  editorName, editorContact, backdropImage, backdropOpacity = 0.06,
  onPrev, onNext, onClose,
}) => {
  // Format label datang daripada eyebrowLabel() di GeometryConfig — sumber SAMA yang dipakai kad
  // bento dan pengesahan simpan. Sebelum ini fail ini ada takrifannya sendiri (' · '), jadi Focus
  // View memapar "MALAYSIANA · Percubaan" sementara kad memapar "MALAYSIANA | Percubaan" untuk
  // kandungan yang sama. CLAUDE.md melarang menulis semula format ini secara khusus: kalau ia
  // bercabang, had aksara mengesahkan string yang berlainan daripada yang benar-benar dirender.
  const label = eyebrowLabel(desk, topik);
  const warnaEyebrow = deskColor || 'var(--color-Adjung-maroon)';
  const isPhone = usePhoneViewport();

  // Huraian panjang dibahagi kepada dua ukuran secara DETERMINISTIK — tiada pengukuran, tiada
  // layout effect, tiada state. Versi terdahulu menjalankan carian binari terhadap kotak hidup
  // yang diisinya sendiri; gelung ukur-lalu-laras begitu tidak dijamin menumpu. Ukuran KIRI
  // mengambil bahagian lebih besar supaya ia terbaca sebagai diisi dahulu; titik potong dialihkan
  // ke sempadan perenggan apabila ada satu berhampiran tengah, jika tidak ke sempadan perkataan
  // terdekat.
  const text = String(body || '').trim();
  const measures = React.useMemo(() => {
    if (!text) return ['', ''];
    const target = Math.ceil(text.length * 0.55);
    let cut = -1;
    const paras: number[] = [];
    for (let i = text.indexOf('\n\n'); i > -1; i = text.indexOf('\n\n', i + 1)) paras.push(i);
    for (const p of paras) {
      if (Math.abs(p - target) < text.length * 0.22 && (cut < 0 || Math.abs(p - target) < Math.abs(cut - target))) cut = p;
    }
    if (cut < 0) { const w = text.lastIndexOf(' ', target); cut = w > text.length * 0.25 ? w : target; }
    return [text.slice(0, cut).trim(), text.slice(cut).trim()];
  }, [text]);

  const [bodyRef, bodyFade] = useOverflowFade();

  // Plat ilustrasi Bidang menutup kolum kanan HANYA apabila kolum itu benar-benar kosong. Ia
  // mengalah kepada kandungan sebenar tanpa kecuali: satu grafik, satu kandungan berkaitan atau
  // satu nota sudah cukup untuk menyingkirkannya.
  //
  // Ia identiti Bidang, bukan kandungan — jadi ia tidak mendakwa apa-apa tentang rencana itu, dan
  // ia tidak mengumumkan ketiadaan seperti pemegang tempat bergaris putus yang dibuang dahulu.
  const kananKosong = !visual && related.length === 0 && !note;
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
  // Chevron menyala marun pada hover DAN pada fokus papan kekunci — kedua-duanya, bukan hover
  // sahaja. Nilai motion ditulis terus (150ms, cubic-bezier(0.4,0,0.2,1)) kerana --duration-fast
  // dan --ease-standard tidak wujud dalam src/index.css; ia token projek Claude Design sahaja.
  const arrow = (side: 'left' | 'right', on: boolean): React.CSSProperties => ({
    position: 'absolute', top: '50%', [side]: 'clamp(8px, 1.6vw, 26px)', transform: 'translateY(-50%)',
    background: 'none', border: 0, padding: '14px', cursor: 'pointer', lineHeight: 1,
    color: on ? 'var(--color-Adjung-maroon)' : 'var(--stone-300)',
    fontSize: 'clamp(15px, 1.3vw, 20px)', fontFamily: 'var(--font-serif)',
    transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  });
  const [hovered, setHovered] = React.useState<'prev' | 'next' | null>(null);
  const navProps = (key: 'prev' | 'next') => ({
    onMouseEnter: () => setHovered(key), onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(key), onBlur: () => setHovered(null),
  });

  // Papan kekunci: Esc menutup, anak panah melangkah — sama seperti overlay berita frontpage, yang
  // sudah pun berkelakuan begini. Handoff tidak menyebut papan kekunci langsung, jadi ini mengisi
  // jurang dan bukan menyimpang daripada kontrak.
  //
  // Sebelum ini Esc TIDAK berbuat apa-apa dalam Focus View, sedangkan ia menutup setiap overlay
  // lain dalam aplikasi ini (overlay berita, modal editor slot, halaman footer) — pembaca yang
  // sudah biasa dengan kelakuan itu akan tertahan di sini.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') onPrev?.();
      else if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

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

          {brief && (
            <p style={{
              margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'var(--text-15, 15px)', fontWeight: 300,
              lineHeight: 'var(--leading-relaxed)', color: 'var(--stone-600)', textWrap: 'pretty',
            }}>{brief}</p>
          )}

          {text && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <hr style={{ ...rule, borderTopColor: 'var(--border-subtle)' }} />
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '14px', fontWeight: 300,
                lineHeight: 1.75, color: 'var(--text-body)', textWrap: 'pretty',
              }}>
                {text.split(/\n{2,}/).filter(Boolean).map((para, j) => (
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
  // SUSUN ATUR DESKTOP — direka pada 1440x900, dikunci oleh handoff "Adjung Brief — Focus View".
  //
  // Empat belas elemen, setiap satu ada tempat tetap. Komposisi ini TETAP: Band A tidak pernah
  // menatal, dan ruang bagi Grafik serta Kandungan berkaitan sentiasa dikhaskan walaupun kosong,
  // supaya susunan tidak beralih antara satu kandungan dengan kandungan lain.
  //
  // Huraian panjang ialah SATU-SATUNYA kawasan yang menatal.
  // ==========================================================================================
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, overflowX: 'hidden', overflowY: 'auto', background: 'var(--surface-page)', color: 'var(--text-body)' }}>
      {backdropImage && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, backgroundImage: 'url(' + backdropImage + ')',
          backgroundSize: 'cover', backgroundPosition: 'center', opacity: backdropOpacity, pointerEvents: 'none',
        }} />
      )}

      {/* minHeight 100% pada pembalut + minHeight 710px pada helaian: pada 1440x900 helaian
          memenuhi skrin dan halaman tidak menatal. Di bawah 710px yang diperlukan komposisi,
          HALAMAN yang menatal — tiada jalur dibenarkan mengerat kandungannya sebagai ganti. */}
      <div style={{ position: 'relative', minHeight: '100%', boxSizing: 'border-box', padding: 'clamp(10px, 1.6vh, 18px) 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 'min(86%, 1220px)', height: '100%', minHeight: '710px', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column',
        }}>

          {/* MASTHEAD — logo · bidang + topik · tarikh siaran */}
          <div style={{ flex: '0 0 auto' }}>
            <hr style={rule} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '10px 0' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-18)', letterSpacing: 'var(--tracking-tight)', color: 'var(--color-Adjung-maroon)' }}>{wordmark}</span>
              {/* Glif Bidang sengaja TIDAK dirender di sini — lihat nota `icon` dalam FocusViewProps. */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', ...micro, color: warnaEyebrow, fontWeight: 'var(--weight-bold)' as any, whiteSpace: 'nowrap' }}>
                {label}
              </span>
              <span style={{ ...micro, justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: '16px', whiteSpace: 'nowrap' }}>
                <span>Siaran <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)', color: 'var(--stone-600)' }}>{publishedDate || '—'}</span></span>
                {onClose && (
                  <button {...closeProps} style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 0, padding: 0, cursor: 'pointer', lineHeight: 1,
                    color: closeLit ? 'var(--color-Adjung-maroon)' : 'var(--stone-400)',
                    transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}>
                    <X size={16} strokeWidth={1.75} />
                  </button>
                )}
              </span>
            </div>
            <hr style={rule} />
          </div>

          {/* BADAN — dua kolum. Kiri: tajuk STATIK di atas satu kawasan menatal yang membawa
              huraian pendek DAN huraian panjang. Kanan: grafik ditengahkan terhadap ruang bacaan,
              dengan kandungan berkaitan dan nota berlabuh di bawahnya.

              MENGAPA HANYA TAJUK YANG STATIK

              Handoff asal mengunci Band A (tajuk + huraian pendek) sebagai jalur tetap setinggi
              minimum 350px, dikira daripada kes terburuk: huraian pendek 429 aksara mesti muat
              tanpa menatal. Huraian sebenar jauh lebih pendek daripada had itu, jadi lantai itu
              mengkhaskan ruang yang hampir selalu kosong — diukur pada 1440x900, 189px daripada
              350px itu lompang, iaitu 54% jalur.

              Membiarkan huraian pendek menatal bersama huraian panjang membuang lompang itu, dan
              sekali gus membuang satu kelas risiko yang handoff itu sendiri namakan (kekangan
              hard-won #2): jalur tetap hanya selamat kalau ia DIJAMIN muat, dan menyembunyikan
              limpahan pada jalur yang tidak mampu memuatkan kandungannya menukar keratan yang
              kelihatan menjadi keratan senyap. Kalau tiada jalur tetap yang boleh terlalu penuh,
              risiko itu lenyap.

              Ia juga menepati logik rekaan itu sendiri: saiz tajuk melangkah 44/37/31/27 mengikut
              kiraan aksara supaya blok tajuk menduduki ukuran yang sama sama ada tajuk 40 aksara
              atau 168 aksara penuh. Jadi jalur yang mengandungi TAJUK SAHAJA memang hampir tetap
              tingginya secara semula jadi — tepat sifat yang diperlukan sebuah bahagian statik. */}
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', columnGap: 'clamp(24px, 3.2vw, 52px)', overflow: 'hidden', padding: 'clamp(14px, 2.8vh, 30px) 0 clamp(14px, 2.8vh, 32px)' }}>

            {/* KIRI — tajuk statik, kemudian huraian pendek + panjang menatal bersama */}
            <div style={{ gridColumn: '1 / span 8', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ flex: '0 0 auto', margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 'var(--weight-regular)' as any, fontSize: titleSize, lineHeight: 1.18, letterSpacing: 'var(--tracking-tight)', color: 'var(--text-heading)', textWrap: 'pretty' }}>{title}</h1>

              {/* Garis ini menandakan sempadan antara bahagian statik dan bahagian menatal */}
              <hr style={{ ...rule, flex: '0 0 auto', margin: 'clamp(14px, 2.6vh, 26px) 0 0' }} />

              {/* Penatalan ada pada PEMBALUT; dua ukuran huraian panjang di dalamnya kekal tinggi
                  semula jadi, jadi limpahan berlaku menegak dan boleh ditatal, bukan tumpah ke
                  lajur ghaib. Jangan sekali-kali guna multicol CSS dalam kotak berhad tinggi —
                  serpihannya melukis DI ATAS perenggan seterusnya. */}
              <div ref={bodyRef} style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', paddingTop: 'clamp(14px, 2.6vh, 26px)', ...bodyFade }}>
                {brief && (
                  <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'var(--text-15)', fontWeight: 'var(--weight-light)' as any, lineHeight: 1.65, color: 'var(--stone-700)', textWrap: 'pretty' }}>{brief}</p>
                )}

                {brief && text && <hr style={{ ...rule, margin: 'clamp(14px, 2.6vh, 28px) 0' }} />}

                {text && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 'clamp(22px, 2.6vw, 40px)',
                    fontFamily: 'var(--font-serif)', fontSize: 'var(--text-13)', fontWeight: 'var(--weight-light)' as any,
                    lineHeight: 1.8, color: 'var(--stone-600)', textWrap: 'pretty',
                  }}>
                    {measures.map((m, i) => (
                      <div key={i} style={{
                        minWidth: 0,
                        paddingLeft: i === 1 ? 'clamp(22px, 2.6vw, 40px)' : 0,
                        marginLeft: i === 1 ? 'calc(-1 * clamp(22px, 2.6vw, 40px))' : 0,
                        borderLeft: i === 1 && m ? '1px solid var(--border-subtle)' : 'none',
                      }}>
                        {m.split(/\n{2,}/).filter(Boolean).map((para, j) => (
                          <p key={j} style={{ margin: j === 0 ? 0 : '0.9em 0 0' }}>{para}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* KANAN — grafik ditengahkan terhadap ruang bacaan (margin auto atas dan bawah),
                kandungan berkaitan dan nota berlabuh di bawahnya. Semuanya statik: hanya kolum
                kiri yang menatal. */}
            <div style={{ gridColumn: '9 / span 4', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.8vh, 18px)', overflow: 'hidden' }}>
              {/* Plat ilustrasi Bidang — lihat `showIllustration`. Markup ditapis ketat di server
                  (SVG_ALLOWED_TAGS/ATTR + spec viewBox 256x256) sebelum sampai ke DB. `color`
                  menetapkan marun, dan spec mewajibkan currentColor, jadi plat sentiasa mengikut
                  warna portal. aria-hidden: ia hiasan identiti, bukan kandungan yang perlu dibaca
                  pembaca skrin. */}
              {showIllustration && (
                <div
                  aria-hidden="true"
                  className="bidang-illustration"
                  style={{
                    margin: 'auto 0', flex: '0 0 auto', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-Adjung-maroon)', opacity: 0.9, pointerEvents: 'none',
                  }}
                  dangerouslySetInnerHTML={{ __html: illustrationSvg as string }}
                />
              )}

              {visual && (
                <figure style={{ margin: 'auto 0', flex: '0 0 auto', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{
                    width: '100%', aspectRatio: '4 / 3', minHeight: 0, maxHeight: 'clamp(180px, 25vh, 240px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {plate}
                  </div>
                  {visualCaption && (
                    <figcaption style={{ ...micro, marginTop: '10px', textAlign: 'center', fontWeight: 'var(--weight-medium)' as any }}>{visualCaption}</figcaption>
                  )}
                </figure>
              )}

              {related.length > 0 && (
                <div style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
                  <span style={{ ...micro, display: 'block', marginBottom: '6px' }}>Kandungan berkaitan</span>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {related.slice(0, 2).map((r, i) => {
                      const item: FocusRelatedItem = typeof r === 'string' ? { title: r } : r;
                      return (
                        <li key={i} style={{ display: 'flex', gap: '12px', padding: '9px 0', borderTop: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-9)', color: 'var(--color-Adjung-maroon)', paddingTop: '3px' }}>{String(i + 1).padStart(2, '0')}</span>
                          <a href={item.url || '#'} style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-13)', lineHeight: 1.4, color: 'var(--text-heading)' }}>{item.title}</a>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {note && (
                <p title={note} style={{ flex: '0 0 auto', margin: 0, paddingLeft: '12px', borderLeft: '2px solid var(--color-Adjung-maroon)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', lineHeight: 1.6, color: 'var(--stone-600)', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }}>
                  <span style={{ color: 'var(--color-Adjung-maroon)', fontWeight: 'var(--weight-semibold)' as any }}>Nota — </span>{notaText}
                </p>
              )}
            </div>
          </div>

          {/* KOLOFON — sumber + tarikh sumber · editor + hubungan */}
          <div style={{ flex: '0 0 auto' }}>
            <hr style={rule} />
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '32px', paddingTop: '12px' }}>
              <span style={{ maxWidth: '62%', lineHeight: 1.5 }}>
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
          </div>
        </div>
      </div>

      {onPrev && <button type="button" aria-label="Kandungan sebelum" onClick={onPrev} style={arrow('left', hovered === 'prev')} {...navProps('prev')}>◀</button>}
      {onNext && <button type="button" aria-label="Kandungan seterusnya" onClick={onNext} style={arrow('right', hovered === 'next')} {...navProps('next')}>▶</button>}
    </div>
  );
};
