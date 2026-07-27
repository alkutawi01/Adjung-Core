import React from 'react';
import { usePhoneViewport } from '../../hooks/usePhoneViewport';

// ============================================================================
// FOCUS VIEW — permukaan bacaan skrin penuh yang dibuka bila kad bento diklik.
//
// Port terus daripada `components/focus/FocusView.jsx` dalam projek "Adjung Brief
// Design System" (Claude Design), ditambah penaipan TypeScript. Latar krim, marun
// sebagai satu-satunya aksen: perbendaharaan visual frontpage pada skala bacaan.
//
// Empat belas elemen, setiap satu ada tempat tetap. HANYA huraian panjang boleh
// menatal; yang lain mesti muat dalam bingkai. Grafik dan Kandungan berkaitan ialah
// kandungan PILIHAN — ruangnya sentiasa dikhaskan supaya komposisi tak beralih bila
// ia tiada.
//
// Ukuran disaiz mengikut had aksara sebenar (GeometryConfig, kes terburuk MENEGAK):
// tajuk 168, huraian pendek 429, huraian panjang 600. Menatal ialah jaring
// keselamatan, bukan keadaan biasa.
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
  /** Glif Bidang, dipapar sebelum label "Bidang · Topik". */
  icon?: React.ReactNode;
  desk?: string;
  topik?: string;
  title: string;
  /** Huraian pendek — had 429 aksara, satu ukuran lebar. */
  brief?: string;
  /** Huraian panjang — satu-satunya kawasan yang menatal; baris baharu dikekalkan,
   *  mengalir dalam dua ukuran. */
  body?: string;
  /** Grafik: nod imej, ilustrasi atau carta. Kandungan pilihan; ruangnya sentiasa dikhaskan. */
  visual?: React.ReactNode;
  visualCaption?: string;
  /** Kandungan berkaitan. Kandungan pilihan; ruangnya sentiasa dikhaskan. */
  related?: Array<FocusRelatedItem | string>;
  /** Nota editor. Sentiasa dirender; papar pemegang tempat senyap bila kosong. */
  note?: string;
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
  wordmark = 'Adjung', icon, desk, topik, title, brief, body,
  visual, visualCaption, related = [], note,
  source, sourceUrl, sourceDate, publishedDate,
  editorName, editorContact, backdropImage, backdropOpacity = 0.06,
  onPrev, onNext, onClose,
}) => {
  const label = [desk, topik].filter(Boolean).join(' · ');
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
  const placeholder: React.CSSProperties = {
    ...micro, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    color: 'var(--stone-300)', border: '1px dashed var(--border-default)', fontWeight: 'var(--weight-medium)' as any,
  };
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
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Tutup" style={{
              appearance: 'none', background: 'transparent', border: '1px solid var(--stone-300)',
              borderRadius: '999px', color: 'var(--stone-600)', fontFamily: 'var(--font-sans)',
              fontSize: '11px', letterSpacing: 'var(--tracking-wide)', minWidth: '44px', minHeight: '44px',
              padding: '0 14px', cursor: 'pointer',
            }}>Tutup</button>
          )}
        </div>

        {/* Badan yang menatal */}
        <div style={{
          position: 'relative', flex: '1 1 auto', minHeight: 0, overflowY: 'auto',
          padding: '20px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px',
        }}>
          {(icon || label) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {icon && <span aria-hidden="true" style={{ display: 'inline-flex', lineHeight: 1, color: 'var(--color-Adjung-maroon)' }}>{icon}</span>}
              {icon && label && <span style={{ width: '1px', height: '11px', background: 'var(--stone-300)' }} />}
              {label && (
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-editorial)', color: 'var(--stone-500)',
                }}>{label}</span>
              )}
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', ...micro, color: 'var(--color-Adjung-maroon)', fontWeight: 'var(--weight-bold)' as any, whiteSpace: 'nowrap' }}>
                {icon && <span aria-hidden="true" style={{ display: 'inline-flex', lineHeight: 1 }}>{icon}</span>}
                {label}
              </span>
              <span style={{ ...micro, justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: '16px', whiteSpace: 'nowrap' }}>
                <span>Siaran <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)', color: 'var(--stone-600)' }}>{publishedDate || '—'}</span></span>
                {onClose && <button type="button" onClick={onClose} style={{ ...micro, color: 'var(--color-Adjung-maroon)', background: 'none', border: 0, padding: 0, cursor: 'pointer', borderBottom: '1px solid var(--maroon-a25)' }}>Tutup</button>}
              </span>
            </div>
            <hr style={rule} />
          </div>

          {/* HALAMAN — dua jalur berkongsi satu grid 12 kolum.
              Band A: tajuk + huraian pendek (1-8) di sebelah grafik (9-12), yang ditengahkan
              terhadap jalur itu, jadi garis tengah plat jatuh pada garis tengah blok tajuk +
              huraian pendek secara BINAAN — tiada pengukuran, tiada hanyutan.
              Band B: huraian panjang (1-8) di sebelah kandungan berkaitan + nota (9-12).

              Lantai 350px Band A dikira daripada kes terburuk sebenar: tajuk 168 aksara pada 27px
              lebih kurang 4 baris, campur huraian pendek 429 aksara pada 15px/1.65 lebih kurang
              166px, campur garis dan margin. Jalur tetap hanya selamat kalau ia DIJAMIN muat. */}
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: 'minmax(350px, auto) minmax(170px, 1fr)', columnGap: 'clamp(24px, 3.2vw, 52px)', overflow: 'hidden', padding: 'clamp(14px, 2.8vh, 30px) 0 clamp(14px, 2.8vh, 32px)' }}>

            {/* BAND A KIRI — tajuk + huraian pendek */}
            <div style={{ gridColumn: '1 / span 8', gridRow: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 'var(--weight-regular)' as any, fontSize: titleSize, lineHeight: 1.18, letterSpacing: 'var(--tracking-tight)', color: 'var(--text-heading)', textWrap: 'pretty' }}>{title}</h1>

              {/* huraian pendek — had 429 aksara, satu ukuran lebar di bawah tajuk */}
              <p style={{ margin: 'clamp(14px, 2.6vh, 26px) 0 clamp(14px, 2.6vh, 28px)', fontFamily: 'var(--font-serif)', fontSize: 'var(--text-15)', fontWeight: 'var(--weight-light)' as any, lineHeight: 1.65, color: 'var(--stone-700)', textWrap: 'pretty' }}>{brief}</p>

              {/* marginTop auto: garis penutup melekat di kaki jalur, jadi ia jatuh pada baris
                  yang sama pada setiap kandungan */}
              <hr style={{ ...rule, marginTop: 'auto' }} />
            </div>

            {/* BAND A KANAN — grafik, ditengahkan terhadap blok tajuk + huraian pendek */}
            <figure style={{ gridColumn: '9 / span 4', gridRow: 1, minWidth: 0, minHeight: 0, margin: 0, alignSelf: 'center', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{
                width: '100%', aspectRatio: '4 / 3', minHeight: 0, maxHeight: 'clamp(180px, 25vh, 240px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                ...(visual ? null : placeholder),
              }}>
                {plate || 'Ruang grafik'}
              </div>
              <figcaption style={{ ...micro, marginTop: '10px', textAlign: 'center', fontWeight: 'var(--weight-medium)' as any }}>{visualCaption || 'Lampiran visual'}</figcaption>
            </figure>

            {/* BAND B KIRI — huraian panjang, satu-satunya kawasan yang menatal */}
            <div style={{ gridColumn: '1 / span 8', gridRow: 2, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 'clamp(14px, 2.6vh, 28px)' }}>
              {/* Penatalan ada pada PEMBALUT; dua ukuran di dalamnya kekal tinggi semula jadi,
                  jadi limpahan berlaku menegak dan boleh ditatal, bukan tumpah ke lajur ghaib.
                  Jangan sekali-kali guna multicol CSS dalam kotak berhad tinggi — serpihannya
                  melukis DI ATAS perenggan seterusnya. */}
              <div ref={bodyRef} style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', ...bodyFade }}>
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
              </div>
            </div>

            {/* BAND B KANAN — kandungan berkaitan, nota.
                Kandungan berkaitan memegang trek anjal dan menatal di dalamnya; nota memegang trek
                auto, jadi ia tidak boleh disingkirkan. Jangan guna justify-content: flex-end dengan
                overflow: hidden di sini — limpahan ditolak keluar dari ATAS dan tajuk "Kandungan
                berkaitan" lenyap senyap-senyap. */}
            <div style={{ gridColumn: '9 / span 4', gridRow: 2, minWidth: 0, minHeight: 0, display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', gap: 'clamp(10px, 1.8vh, 18px)', paddingTop: 'clamp(14px, 2.6vh, 28px)' }}>
              <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
                <span style={{ ...micro, display: 'block', marginBottom: '6px' }}>Kandungan berkaitan</span>
                {related.length > 0 ? (
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
                ) : (
                  <div style={{ ...placeholder, minHeight: '56px' }}>Tiada kandungan berkaitan</div>
                )}
              </div>

              <p title={note || undefined} style={{ margin: 0, paddingLeft: '12px', borderLeft: '2px solid var(--color-Adjung-maroon)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', lineHeight: 1.6, color: note ? 'var(--stone-600)' : 'var(--stone-300)', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }}>
                <span style={{ color: 'var(--color-Adjung-maroon)', fontWeight: 'var(--weight-semibold)' as any }}>Nota — </span>{notaText || 'Tiada nota editor.'}
              </p>
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
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'var(--font-signature)', fontSize: 'var(--text-30)', color: 'var(--color-Adjung-maroon)' }}>{editorName || '—'}</span>
                <a
                  href={editorContact && editorContact.includes('@') ? 'mailto:' + editorContact : (editorContact ? 'https://' + editorContact : '#')}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...micro, color: 'var(--stone-500)', textTransform: 'none', letterSpacing: 'var(--tracking-wide)', fontWeight: 'var(--weight-regular)' as any }}
                >
                  {editorContact}
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>

      {onPrev && <button type="button" aria-label="Kandungan sebelum" onClick={onPrev} style={arrow('left', hovered === 'prev')} {...navProps('prev')}>◀</button>}
      {onNext && <button type="button" aria-label="Kandungan seterusnya" onClick={onNext} style={arrow('right', hovered === 'next')} {...navProps('next')}>▶</button>}
    </div>
  );
};
