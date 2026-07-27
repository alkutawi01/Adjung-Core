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

  // Dua ukuran eksplisit dan bukan multicol CSS (multicol berpecah dalam kotak berhad tinggi
  // akan melukis limpahannya ATAS perenggan seterusnya). Ukuran KIRI diisi dahulu sampai
  // kapasiti baris sebenarnya — diukur dari kotak hidup — dan cuma bakinya mengalir ke kanan.
  const FADE = 28; // jalur pudar di kaki kotak badan; jangan sekali-kali isi teks ke dalamnya
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const probeRef = React.useRef<HTMLDivElement>(null);
  const [split, setSplit] = React.useState<number | null>(null);
  const [overflowing, setOverflowing] = React.useState(false);

  const paraHTML = React.useCallback((s: string) => String(s).split(/\n{2,}/).filter(Boolean)
    .map((p, i) => '<p style="margin:' + (i === 0 ? '0' : '0.9em 0 0') + '">' + p.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] as string)) + '</p>').join(''), []);

  React.useLayoutEffect(() => {
    const box = bodyRef.current, probe = probeRef.current;
    const text = String(body || '').trim();
    if (!box || !probe || !text) { setSplit(null); return; }
    const capacity = box.clientHeight - FADE;
    probe.style.width = Math.floor(box.clientWidth / 2 - 20) + 'px';
    probe.innerHTML = paraHTML(text);
    if (probe.scrollHeight <= capacity) { setSplit(text.length); setOverflowing(false); return; }
    // carian binari untuk awalan terpanjang yang masih muat dalam ukuran kiri
    let lo = 0, hi = text.length, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      probe.innerHTML = paraHTML(text.slice(0, mid));
      if (probe.scrollHeight <= capacity) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    const space = text.lastIndexOf(' ', best);
    const cut = space > text.length * 0.2 ? space : best;
    setSplit(cut);
    // ukuran kanan ada kapasiti sama; apa-apa selepas dua ukuran penuh memang perlu menatal
    probe.innerHTML = paraHTML(text.slice(cut));
    setOverflowing(probe.scrollHeight > capacity);
    probe.innerHTML = '';
  }, [body, paraHTML]);

  const text = String(body || '').trim();
  const measures = split == null ? [text, ''] : [text.slice(0, split).trim(), text.slice(split).trim()];

  // Had tajuk ialah 168 aksara (MENEGAK). Saiz menurun mengikut panjang supaya blok tajuk
  // menduduki ukuran yang sama sama ada tajuk 40 aksara atau 168 aksara penuh.
  const n = String(title || '').length;
  const titleSize =
    n <= 60 ? 'clamp(26px, 3.8vh, 44px)' :
    n <= 100 ? 'clamp(23px, 3.2vh, 37px)' :
    n <= 140 ? 'clamp(21px, 2.7vh, 31px)' :
      'clamp(19px, 2.3vh, 27px)';

  const rule: React.CSSProperties = { border: 0, borderTop: '1px solid var(--border-default)', margin: 0, width: '100%' };
  const micro: React.CSSProperties = {
    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-10)', textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-editorial)', color: 'var(--stone-400)', fontWeight: 'var(--weight-semibold)' as any,
  };
  const placeholder: React.CSSProperties = {
    ...micro, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    color: 'var(--stone-300)', border: '1px dashed var(--border-default)', fontWeight: 'var(--weight-medium)' as any,
  };
  const arrow = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute', top: '50%', [side]: 'clamp(8px, 1.6vw, 26px)', transform: 'translateY(-50%)',
    background: 'none', border: 0, padding: '14px', cursor: 'pointer', lineHeight: 1,
    color: 'var(--stone-300)', fontSize: 'clamp(15px, 1.3vw, 20px)', fontFamily: 'var(--font-serif)',
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
          borderBottom: '1px solid var(--border-strong)',
        }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-20)', color: 'var(--color-adjung-maroon)' }}>{wordmark}</span>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Tutup" style={{
              appearance: 'none', background: 'transparent', border: '1px solid var(--border-strong)',
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
              {icon && <span aria-hidden="true" style={{ display: 'inline-flex', lineHeight: 1, color: 'var(--color-adjung-maroon)' }}>{icon}</span>}
              {icon && label && <span style={{ width: '1px', height: '11px', background: 'var(--border-strong)' }} />}
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
                fontFamily: 'var(--font-serif)', fontSize: 'var(--text-14, 14px)', fontWeight: 300,
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
                background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-9)', color: 'var(--color-adjung-maroon)', paddingTop: '3px' }}>{String(i + 1).padStart(2, '0')}</span>
                      <a href={item.url || '#'} style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-14, 14px)', lineHeight: 'var(--leading-snug)', color: 'var(--text-heading)' }}>{item.title}</a>
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
                <span style={{ fontFamily: 'var(--font-signature)', fontSize: 'var(--text-30)', lineHeight: 1, color: 'var(--color-adjung-maroon)', marginTop: '2px' }}>{editorName}</span>
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, overflow: 'hidden', background: 'var(--surface-page)', color: 'var(--text-body)' }}>
      {backdropImage && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, backgroundImage: 'url(' + backdropImage + ')',
          backgroundSize: 'cover', backgroundPosition: 'center', opacity: backdropOpacity, pointerEvents: 'none',
        }} />
      )}

      <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: 'clamp(10px, 1.6vh, 18px) 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 'min(86%, 1220px)', maxHeight: '100%', boxSizing: 'border-box',
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

          {/* BADAN HALAMAN — ditengahkan antara masthead dan kolofon, tak pernah diregang */}
          <div style={{ flex: '0 1 auto', minHeight: 0, display: 'flex', alignItems: 'stretch', overflow: 'hidden', padding: 'clamp(16px, 3.6vh, 40px) 0 clamp(18px, 4vh, 44px)' }}>
            <div style={{ width: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', columnGap: 'clamp(24px, 3.2vw, 52px)', alignItems: 'start' }}>

              {/* KIRI — tajuk, huraian pendek, huraian panjang */}
              <div style={{ gridColumn: '1 / span 8', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ flex: '0 0 auto', margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 'var(--weight-regular)' as any, fontSize: titleSize, lineHeight: 1.18, letterSpacing: 'var(--tracking-tight)', color: 'var(--text-heading)', textWrap: 'pretty' }}>{title}</h1>

                {/* huraian pendek — had 429 aksara, satu ukuran lebar */}
                <p style={{ flex: '0 0 auto', margin: 'clamp(14px, 2.6vh, 26px) 0 0', fontFamily: 'var(--font-serif)', fontSize: 'var(--text-15, 15px)', fontWeight: 'var(--weight-light)' as any, lineHeight: 1.65, color: 'var(--stone-700)', textWrap: 'pretty' }}>{brief}</p>

                <hr style={{ ...rule, flex: '0 0 auto', margin: 'clamp(14px, 2.6vh, 28px) 0' }} />

                {/* huraian panjang — had 600 aksara, dua ukuran; menatal cuma kalau dilebihi. */}
                {/* Penatalan ada pada PEMBALUT; multicol di dalamnya kekal tinggi semula jadi,
                    jadi limpahan berlaku menegak dan boleh ditatal, bukan tumpah ke lajur ghaib. */}
                <div ref={bodyRef} style={{ flex: '0 1 auto', minHeight: 0, maxHeight: 'clamp(150px, 32vh, 280px)', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', maskImage: overflowing ? 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)' : 'none', WebkitMaskImage: overflowing ? 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)' : 'none' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 'clamp(22px, 2.6vw, 40px)',
                    fontFamily: 'var(--font-serif)', fontSize: 'var(--text-13)', fontWeight: 'var(--weight-light)' as any,
                    lineHeight: 1.8, color: 'var(--stone-600)', textWrap: 'pretty',
                  }}>
                    <div ref={probeRef} aria-hidden="true" style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', left: '-9999px', top: 0, fontFamily: 'var(--font-serif)', fontSize: 'var(--text-13)', fontWeight: 'var(--weight-light)' as any, lineHeight: 1.8 }} />
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

              {/* KANAN — grafik, kandungan berkaitan, nota */}
              <div style={{ gridColumn: '9 / span 4', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2.2vh, 22px)', overflow: 'hidden' }}>
                <figure style={{ margin: 0, flex: '0 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    width: '100%', aspectRatio: '4 / 3', flex: '0 1 auto', minHeight: 0, maxHeight: '32vh',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    ...(visual ? null : placeholder),
                  }}>
                    {visual || 'Ruang grafik'}
                  </div>
                  <figcaption style={{ ...micro, marginTop: '10px', textAlign: 'center', fontWeight: 'var(--weight-medium)' as any }}>{visualCaption || 'Lampiran visual'}</figcaption>
                </figure>

                <div style={{ flex: '0 0 auto' }}>
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

                <p style={{ flex: '0 0 auto', margin: 0, paddingLeft: '12px', borderLeft: '2px solid var(--color-Adjung-maroon)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', lineHeight: 1.6, color: note ? 'var(--stone-600)' : 'var(--stone-300)' }}>
                  <span style={{ color: 'var(--color-Adjung-maroon)', fontWeight: 'var(--weight-semibold)' as any }}>Nota — </span>{note || 'Tiada nota editor.'}
                </p>
              </div>
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
              <span style={{ textAlign: 'right', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-signature)', fontSize: 'var(--text-30)', color: 'var(--color-Adjung-maroon)' }}>{editorName || '—'}</span>
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

      {onPrev && <button type="button" aria-label="Kandungan sebelum" onClick={onPrev} style={arrow('left')}>◀</button>}
      {onNext && <button type="button" aria-label="Kandungan seterusnya" onClick={onNext} style={arrow('right')}>▶</button>}
    </div>
  );
};
