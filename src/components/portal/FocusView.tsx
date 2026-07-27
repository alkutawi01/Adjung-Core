import React from 'react';

// ============================================================================
// SHELL SEMENTARA — REKA BENTUK BELUM MUKTAMAD
//
// Ini port terus daripada `components/focus/FocusView.jsx` dalam projek
// "Adjung Brief Design System" (Claude Design). Ia diletak di sini SEMATA-MATA
// supaya logik Focus View (mod navigasi, kocok, pencetus klik pada 33 kad)
// boleh disahkan secara visual sekarang.
//
// Bila reka bentuk baharu daripada Claude Design siap, GANTI KANDUNGAN FAIL INI
// SAHAJA. Antara muka `FocusViewProps` di bawah sepadan dengan `FocusView.d.ts`
// sistem reka bentuk tu, jadi tiada logik di FrontpageView.tsx perlu disentuh.
//
// Token warna (--focus-ground dll.) ada di src/index.css.
// ============================================================================

export interface FocusRelatedItem {
  title: string;
  url?: string;
}

/** Mod navigasi chevron: ikut urutan dalam slot sama, atau rawak merentas semua slot. */
export type FocusMode = 'urutan' | 'rawak';

export interface FocusViewProps {
  wordmark?: string;
  /** Glif Bidang, dipapar sebelum label "Bidang Topik". */
  icon?: React.ReactNode;
  desk?: string;
  topik?: string;
  title: string;
  /** Huraian ringkas — huraian kad itu sendiri. */
  brief?: string;
  /** Huraian panjang — teks badan; baris baharu dikekalkan. */
  body?: string;
  /** Lampiran visual: nod SVG/PNG, ditengahkan di lajur kanan. (Medan belum wujud.) */
  visual?: React.ReactNode;
  /** Kandungan yang berkaitan. (Medan belum wujud.) */
  related?: Array<FocusRelatedItem | string>;
  /** Nota editor, dipapar sebagai slip krim. (Medan belum wujud.) */
  note?: string;
  source?: string;
  sourceUrl?: string;
  editorName?: string;
  /** URL editor tanpa protokol, cth "izzatanas.adjung.com". (Medan belum wujud.) */
  editorUrl?: string;
  /** Lapisan kedua pilihan atas latar pejal — samar, luminosity-blended. */
  backdropImage?: string;
  backdropOpacity?: number;
  mode?: FocusMode;
  onModeChange?: (mode: FocusMode) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onClose?: () => void;
}

const chromeButton: React.CSSProperties = {
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
};

export const FocusView: React.FC<FocusViewProps> = ({
  wordmark = 'Adjung', icon, desk, topik, title, brief, body,
  visual, related = [], note, source, sourceUrl,
  editorName, editorUrl, backdropImage, backdropOpacity = 0.22,
  mode, onModeChange, onPrev, onNext, onClose,
}) => {
  const label = [desk, topik].filter(Boolean).join(' ');

  const arrow = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    top: '50%',
    [side]: 'clamp(12px, 2.2vw, 34px)',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 0,
    padding: '12px',
    cursor: 'pointer',
    lineHeight: 0,
    color: 'rgba(253,253,253,0.30)',
    fontSize: 'clamp(18px, 1.8vw, 26px)',
    fontFamily: 'var(--font-serif)',
    transition: 'color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200, overflow: 'hidden',
        background: 'var(--focus-ground)', color: 'var(--focus-ink)',
      }}
    >
      {backdropImage && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, backgroundImage: `url(${backdropImage})`,
            backgroundSize: 'cover', backgroundPosition: 'center', opacity: backdropOpacity,
            mixBlendMode: 'luminosity', pointerEvents: 'none',
          }}
        />
      )}

      <div
        style={{
          position: 'relative', height: '100%', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column',
          width: 'min(88%, 1320px)', margin: '0 auto',
          paddingTop: 'clamp(20px, 4.5vh, 48px)', paddingBottom: 'clamp(20px, 5vh, 56px)',
        }}
      >
        <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--focus-ink)', letterSpacing: '-0.015em' }}>
            {wordmark}
          </span>
        </div>

        <div
          style={{
            flex: 1, minHeight: 0, display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)', columnGap: 'clamp(24px, 3.4vw, 56px)',
            paddingTop: 'clamp(20px, 5vh, 56px)',
          }}
        >
          {/* KIRI — bidang, tajuk, huraian ringkas, huraian panjang, sumber */}
          <div style={{ gridColumn: '1 / span 6', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div
              style={{
                flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none',
                display: 'flex', flexDirection: 'column',
                maskImage: 'linear-gradient(to bottom, #000 calc(100% - 40px), transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 40px), transparent)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '10px', color: 'var(--focus-accent)',
                  fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.15em',
                }}
              >
                {icon && <span aria-hidden="true" style={{ display: 'inline-flex', lineHeight: 1 }}>{icon}</span>}
                {label}
              </span>

              <h1
                style={{
                  flex: '0 0 auto', margin: 'clamp(16px, 3vh, 32px) 0 0', fontFamily: 'var(--font-serif)',
                  fontWeight: 400, fontSize: 'clamp(26px, 4.4vh, 50px)', lineHeight: 1.16,
                  letterSpacing: '-0.015em', color: 'var(--focus-ink)', textWrap: 'pretty',
                }}
              >
                {title}
              </h1>

              {brief && (
                <p
                  style={{
                    flex: '0 0 auto', margin: 'clamp(16px, 3vh, 32px) 0 0', fontFamily: 'var(--font-sans)',
                    fontSize: '14px', fontWeight: 300, lineHeight: 1.8, color: 'var(--focus-ink-soft)', textWrap: 'pretty',
                  }}
                >
                  {brief}
                </p>
              )}

              {body && (
                <div
                  style={{
                    flex: '0 0 auto', margin: 'clamp(20px, 4vh, 44px) 0 0', fontFamily: 'var(--font-sans)',
                    fontSize: '12px', fontWeight: 300, lineHeight: 1.9, color: 'var(--focus-ink-muted)',
                    whiteSpace: 'pre-line', textWrap: 'pretty',
                  }}
                >
                  {body}
                </div>
              )}
            </div>

            {source && (
              <div
                style={{
                  flex: '0 0 auto', paddingTop: 'clamp(16px, 3vh, 32px)', fontFamily: 'var(--font-sans)',
                  fontSize: '11px', color: 'var(--focus-ink-faint)', lineHeight: 1.7,
                }}
              >
                <div>Sumber:</div>
                <a
                  href={sourceUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--focus-ink-faint)', wordBreak: 'break-all' }}
                >
                  {source}
                </a>
              </div>
            )}
          </div>

          {/* KANAN — lampiran visual, kandungan berkaitan, nota, tandatangan editor */}
          <div style={{ gridColumn: '8 / span 5', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
              {visual}
            </div>

            {related.length > 0 && (
              <ul
                style={{
                  listStyle: 'none', margin: 'clamp(20px, 4vh, 44px) 0 0', padding: 0,
                  display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.8vh, 18px)',
                }}
              >
                {related.map((r, i) => {
                  const item: FocusRelatedItem = typeof r === 'string' ? { title: r } : r;
                  return (
                    <li key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: 'var(--color-Adjung-maroon)', flex: '0 0 auto', marginTop: '7px',
                        }}
                      />
                      <a
                        href={item.url || '#'}
                        style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', lineHeight: 1.4, color: 'var(--focus-ink)' }}
                      >
                        {item.title}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}

            <div
              style={{
                marginTop: 'auto', paddingTop: 'clamp(20px, 4vh, 44px)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '32px',
              }}
            >
              {note ? (
                <span
                  style={{
                    background: 'var(--color-Adjung-cream)', color: '#1C1917', fontFamily: 'var(--font-sans)',
                    fontSize: '12px', lineHeight: 1.6, padding: '8px 12px', maxWidth: '30em',
                  }}
                >
                  <strong style={{ fontWeight: 600 }}>Nota:</strong> {note}
                </span>
              ) : (
                <span />
              )}
              {editorName && (
                <span style={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-signature)', fontSize: '30px', color: 'var(--focus-ink)' }}>
                    {editorName}
                  </span>
                  {editorUrl && (
                    <a
                      href={`https://${editorUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--focus-ink-muted)' }}
                    >
                      {editorUrl}
                    </a>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Suis mod navigasi — kiri atas, mencerminkan "Tutup" di kanan atas. Ia mengawal
          chevron, jadi ia chrome dan bukan kandungan; letak dalam lajur akan kacau susun atur. */}
      {onModeChange && (
        <div
          style={{
            position: 'absolute', top: 'clamp(20px, 4.5vh, 48px)', left: 'clamp(24px, 6vw, 88px)',
            display: 'inline-flex', alignItems: 'center', gap: '10px',
          }}
        >
          {(['urutan', 'rawak'] as FocusMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              aria-pressed={mode === m}
              style={{
                ...chromeButton,
                color: mode === m ? 'var(--focus-accent)' : 'var(--focus-ink-faint)',
              }}
            >
              {m === 'urutan' ? 'Ikut Urutan' : 'Rawak'}
            </button>
          ))}
        </div>
      )}

      {onPrev && (
        <button type="button" aria-label="Kandungan sebelum" onClick={onPrev} style={arrow('left')}>
          &#9664;
        </button>
      )}
      {onNext && (
        <button type="button" aria-label="Kandungan seterusnya" onClick={onNext} style={arrow('right')}>
          &#9654;
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            ...chromeButton,
            position: 'absolute', top: 'clamp(20px, 4.5vh, 48px)', right: 'clamp(24px, 6vw, 88px)',
            color: 'var(--focus-ink-muted)',
          }}
        >
          Tutup
        </button>
      )}
    </div>
  );
};
