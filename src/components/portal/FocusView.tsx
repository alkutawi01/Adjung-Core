import React from 'react';
import { Check, ChevronDown, ChevronUp, Facebook, Link2, ListOrdered, MessageCircle, Pause, Play, Shuffle, Twitter, X } from 'lucide-react';
import { usePhoneViewport } from '../../hooks/usePhoneViewport';
import { safeParseInline } from '../../utils';
import { eyebrowLabel } from '../../../core/editorial/GeometryConfig.js';
import { terapFocusSeo, buangSemulaFocusSeo } from '../../utils/seoMeta';
import { binaPetaGlosari, renderDenganGlosari, type EntriGlosari } from '../common/IstilahGlosari';
import { Tooltip } from '../common/Tooltip';

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

/** Susut-jika-perlu tajuk desktop (2026-08-07, permintaan Izzat). Percubaan pertama (muat-ke-
 *  kotak, cari fon TERBESAR yang isi tinggi lajur) DIBUANG selepas verifikasi visual — Izzat
 *  betul menolaknya: tajuk pendek jadi 64px "gedabak" manakala tajuk lain kekal ~26px, konsisten
 *  fon merentasi kandungan JAUH lebih penting drpd mengisi ruang kosong bawah tajuk. Baris
 *  kosong di bawah tajuk pendek BUKAN pepijat — ia natural bila tajuk & huraian bersebelahan tapi
 *  panjang berbeza.
 *
 *  Kembali ke tangga saiz TETAP ikut kiraan aksara (`baseSizePx`, dikira pemanggil) — sama
 *  fon utk semua tajuk sepanjang yang sama, konsisten. Hook ni HANYA susut (tak pernah besarkan)
 *  drpd `baseSizePx`, dan HANYA bila satu perkataan tunggal terlalu panjang utk muat lebar lajur
 *  (`scrollWidth>clientWidth`) — kes jarang, bukan tingkah laku biasa. Elak menceroboh lajur
 *  huraian sebelah TANPA sengkang/potong tengah perkataan (wordBreak:'normal' di h1 jamin
 *  perkataan tak pernah patah tengah — cuma limpah, yang hook ni cegah dgn susutkan fon). */
function useShrinkTitleToFit(
  h1Ref: React.RefObject<HTMLElement | null>,
  baseSizePx: number,
  minPx: number,
  deps: React.DependencyList,
): void {
  React.useLayoutEffect(() => {
    const h1 = h1Ref.current;
    if (!h1) return;
    const muatkan = () => {
      let s = baseSizePx;
      h1.style.fontSize = `${s}px`;
      while (s > minPx && h1.scrollWidth > h1.clientWidth + 1) {
        s -= 1;
        h1.style.fontSize = `${s}px`;
      }
    };
    muatkan();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(muatkan) : null;
    if (ro) ro.observe(h1);
    window.addEventListener('resize', muatkan);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', muatkan); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Had nota lalai — tiga baris pada 11px/1.6 dalam kolum luar. Boleh diselaraskan Ketua Editor
 *  (system_settings.focusViewNotaMaxAksara, Tetapan → Operasi) — nilai ni kekal sebagai LALAI
 *  sahaja (dipakai bila tetapan belum disunting), bukan had tegar. */
export const NOTA_MAX = 180;

function trimNota(note: string | undefined, max: number): string {
  const t = String(note || '').trim();
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(' ', max);
  return t.slice(0, cut > max * 0.6 ? cut : max).trim() + '…';
}

export interface FocusRelatedItem {
  title: string;
  url?: string;
}

/** Ikon bulat "Kongsi" (2026-08-05, Fasa 11 — perkongsian sosial) — WhatsApp/Facebook/X/Salin
 *  pautan. Dikongsi antara helaian telefon dan kolofon desktop (dua tapak render berlainan,
 *  komponen sama supaya gaya/kelakuan sentiasa sepadan). Corak ikon bulat sepadan butang
 *  navigasi kaki sedia ada (round pill, border stone-300, boxShadow lembut).
 *  `title`/`url` mesti sudah SEDIA (pemanggil semak `shareUrl` sebelum render). */
function KongsiButtons({ title, url, disalinBerjaya, onSalin }: { title: string; url: string; disalinBerjaya: boolean; onSalin: () => void }) {
  const btnStyle: React.CSSProperties = {
    appearance: 'none', background: 'var(--surface-page)', border: '1px solid var(--stone-300)',
    borderRadius: '999px', color: 'var(--stone-500)', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px',
    padding: 0, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textDecoration: 'none',
  };
  const teks = encodeURIComponent(title);
  const laluan = encodeURIComponent(url);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <Tooltip text="WhatsApp">
        <a href={`https://wa.me/?text=${teks}%20${laluan}`} target="_blank" rel="noopener noreferrer" aria-label="Kongsi di WhatsApp" className="fv-pill-btn" style={btnStyle}>
          <MessageCircle size={13} strokeWidth={1.75} />
        </a>
      </Tooltip>
      <Tooltip text="Facebook">
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${laluan}`} target="_blank" rel="noopener noreferrer" aria-label="Kongsi di Facebook" className="fv-pill-btn" style={btnStyle}>
          <Facebook size={13} strokeWidth={1.75} />
        </a>
      </Tooltip>
      <Tooltip text="X (Twitter)">
        <a href={`https://twitter.com/intent/tweet?text=${teks}&url=${laluan}`} target="_blank" rel="noopener noreferrer" aria-label="Kongsi di X" className="fv-pill-btn" style={btnStyle}>
          <Twitter size={13} strokeWidth={1.75} />
        </a>
      </Tooltip>
      <Tooltip text="Salin pautan">
        <button type="button" onClick={onSalin} aria-label="Salin pautan" className="fv-pill-btn" style={btnStyle}>
          {disalinBerjaya ? <Check size={13} strokeWidth={1.75} /> : <Link2 size={13} strokeWidth={1.75} />}
        </button>
      </Tooltip>
    </span>
  );
}

/** Senarai Sumber (kolofon desktop) — pemisah "|" HANYA antara dua sumber pada BARIS SAMA
 *  (2026-08-17, Izzat: "kalau dah wrap tak perlulah guna | utk memisahkan... ada mekanisme
 *  ke nak buat?"). Bekas `flexWrap:'wrap'` sendiri tak dedahkan sama ada dua anak bersebelahan
 *  benar-benar di baris sama atau dah patah baris — mesti diukur SEBENAR di DOM (teknik sama
 *  CarouselStableBlock/FooterHeightLock: ukur dulu via `useLayoutEffect`, papar ikut hasil
 *  ukuran sebenar, bukan teka). `offsetTop` setiap unit sumber dibandingkan dgn unit
 *  sebelumnya — sama offsetTop = baris sama (papar "|"), berbeza = baru patah baris (sorok).
 *  Anggapan lalai (render pertama, sebelum ukuran sedia) ialah SEMUA sama baris — elak
 *  "|" berkelip masuk lepas ukuran, biasanya memang muat sebaris pada kebanyakan kandungan. */
function SenaraiSumberDesktop({ sources, sourceDate }: { sources: { name: string; url?: string; date?: string }[]; sourceDate?: string }) {
  const refs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const [samaBarisDgnSebelum, setSamaBarisDgnSebelum] = React.useState<boolean[]>(() => sources.map(() => true));

  React.useLayoutEffect(() => {
    const kira = () => {
      const tops = refs.current.map((el) => el?.offsetTop ?? 0);
      setSamaBarisDgnSebelum(tops.map((t, i) => i === 0 || t === tops[i - 1]));
    };
    kira();
    const pemerhati = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(kira) : null;
    refs.current.forEach((el) => { if (el && pemerhati) pemerhati.observe(el); });
    return () => pemerhati?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length, sources.map((s) => s.name).join('|')]);

  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', columnGap: '10px', rowGap: '2px' }}>
      {sources.map((s, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap' }}>
          {i > 0 && samaBarisDgnSebelum[i] && <span style={{ color: 'var(--stone-300)', marginRight: '10px' }}>|</span>}
          <span ref={(el) => { refs.current[i] = el; }} style={{ display: 'inline-flex', alignItems: 'baseline', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', color: 'var(--stone-500)' }}>
            <a href={s.url || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--stone-500)' }}>{s.name || '—'}</a>
            {(s.date || (i === 0 && sourceDate)) && <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)' }}> · {s.date || sourceDate}</span>}
          </span>
        </span>
      ))}
    </span>
  );
}

export interface FocusViewProps {
  /** Logo Adjung, di kiri jalur masthead. */
  wordmark?: string;
  /** Glif Bidang. Dahulu (2026-08-07) DITERIMA tetapi TIDAK dirender langsung — ikon kekal
   *  bersebelahan perkataan dianggap berlebihan, kekalkan perkataan sahaja. Keputusan tu KEKAL
   *  untuk paparan STATIK — ikon masih tak pernah kekal selamanya di sini. Susulan 2026-08-17
   *  (Izzat, "mula2 ikon+topik, kemudian bidang keluar daripada ikon tu gantikan ikon"): ikon
   *  kini muncul SEBENTAR sebagai animasi masuk eyebrow sahaja (lihat `eyebrowNodes` dlm
   *  komponen), pudar+mengecut lalu digantikan perkataan Bidang selepas ~550ms — bukan
   *  pembalikan keputusan asal, cuma lapisan animasi baharu di atasnya. */
  icon?: React.ReactNode;
  desk?: string;
  topik?: string;
  /** Cari Bidang/Topik (2026-08-07, permintaan Izzat — konsisten dengan kad bento: "topik di full
   *  view pun perlu ada microanimasi mcm di frontpage dan perlu ke search jgk, utk keselarasan").
   *  Dipanggil dengan nilai mentah (desk ATAU topik) bila salah satu segmen eyebrow diklik.
   *  Pemanggil (FrontpageView) tutup Focus View dahulu sebelum isi kotak carian — lihat
   *  cariDariEyebrow di sana. `undefined` = eyebrow papar sahaja, tiada kesan klik. */
  onCariEyebrow?: (nilai: string) => void;
  /** Warna Bidang (CategoryRegistry.color). Eyebrow kad guna warna ini, jadi Focus View mesti guna
   *  yang sama — kandungan yang sama tidak sepatutnya bertukar warna identiti apabila dibuka.
   *  Jatuh balik ke marun Adjung kalau Bidang tiada warna. */
  deskColor?: string;
  /** Tajuk PLAIN — dikekalkan sebagai string (bukan ReactNode) sebab titleSize (di bawah)
   *  mengira PANJANG AKSARA tajuk untuk tentukan saiz fon responsif; ReactNode tiada panjang
   *  aksara bermakna. Guna `titleRendered` di bawah untuk hantar versi diformat (autocondong/
   *  gloss/pemenggalan) — jatuh balik ke `title` mentah kalau tiada. */
  title: string;
  /** Tajuk versi diformat (autocondong/gloss/pemenggalan, Fasa 8) — pilihan. Kosong = papar
   *  `title` mentah macam sebelum ni (keserasian ke belakang). */
  titleRendered?: React.ReactNode;
  /** Huraian panjang — SATU-SATUNYA badan kandungan (huraian pendek dibuang 2026-07-29, tidak
   *  lagi diterima sebagai prop). Mengalir dalam satu lajur, menatal dalam kotaknya sendiri —
   *  satu-satunya bahagian Focus View yang menatal. Diformat (autocondong/gloss/pemenggalan)
   *  per-perenggan di tapak render (Fasa 8) — `body` sendiri KEKAL string untuk pembahagian
   *  perenggan (`text.split`) terus berfungsi. */
  body?: string;
  /** Grafik: nod imej, ilustrasi atau carta. Pilihan; tidak dirender langsung bila tiada. */
  visual?: React.ReactNode;
  visualCaption?: string;
  /** Kandungan berkaitan. Pilihan; tidak dirender langsung bila tiada. */
  related?: Array<FocusRelatedItem | string>;
  /** Nota editor. Pilihan; dipotong pada `notaMaxAksara` (lalai NOTA_MAX) aksara, tidak dirender
   *  bila tiada. */
  note?: string;
  /** Had pemotongan nota editor, aksara. Pilihan — jatuh balik ke NOTA_MAX (180) kalau tiada
   *  (keserasian ke belakang, dan kalau pemanggil tak sambung system_settings.
   *  focusViewNotaMaxAksara langsung). */
  notaMaxAksara?: number;
  /** Sumber (nama atau teks URL), dipapar di kolofon. Jatuh balik/keserasian ke belakang bila
   *  `sources` (di bawah) tiada — kandungan lama sebelum ciri sumber berbilang wujud. */
  source?: string;
  sourceUrl?: string;
  /** Sumber berbilang (2026-08-05, permintaan Izzat) — kad papar label generik "Editorial
   *  Adjung" bila >1 (ruang terhad, lihat FrontpageView.tsx), tapi Focus View (ruang lebih)
   *  SENARAIKAN SEMUA sumber di sini, sama ada satu atau lebih. Bila dibekalkan (panjang > 0),
   *  MENGATASI `source`/`sourceUrl` tunggal di atas untuk paparan kolofon. `date` per-sumber
   *  (2026-08-15, permintaan Izzat — sumber berbeza boleh diterbitkan pada tarikh berbeza,
   *  Focus View catat SEMUA, bukan satu tarikh dikongsi). */
  sources?: { name: string; url?: string; date?: string }[];
  /** Tarikh sumber — tarikh bahan asal, dipapar di sebelah Sumber. Jatuh balik/keserasian ke
   *  belakang bila `sources[].date` (di atas) tiada — kandungan lama sebelum tarikh per-sumber
   *  wujud, atau kes sumber tunggal legasi (`source`/`sourceUrl`). */
  sourceDate?: string;
  /** Tarikh siaran — tarikh penyiaran Adjung, dipapar sebaris dengan eyebrow atas tajuk. */
  publishedDate?: string;
  /** Nama editor kandungan INI (2026-08-16, permintaan Izzat) — attribute `editorName` per-
   *  kandungan (dicap semasa Terbit, lihat contentRoutes.js), BUKAN identiti Ketua Editor semasa
   *  log masuk (konsep berasingan yang sengaja tak disambung, lihat nota "MENGKHASKAN RUANG"
   *  di bawah). Dipapar di lajur "Editor" bar kolofon desktop, sebelah Sumber/Kongsi. Pilihan —
   *  tidak dirender bila tiada (kandungan lama tanpa editorName tercatat). */
  editorName?: string;
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
  /** Saiz fon Focus View (2026-08-04, Tetapan Am Slot — satu tetapan GLOBAL, bukan per-Bidang/
   *  tier, permintaan Izzat). titleSizeScale darab tangga responsif sedia ada (1 = kelakuan asal
   *  tak berubah); bodySizePx nilai literal px (15 = kelakuan asal tak berubah). */
  titleSizeScale?: number;
  bodySizePx?: number;
  /** Mod navigasi "Seterusnya" (2026-08-05, permintaan Izzat) — 'rawak' (lalai) merentasi laman
   *  elak Bidang sama berturut-turut; 'turutan' ikut susunan slot (Hero dulu). Butang tukar mod
   *  di masthead cuma dirender bila `onToggleNavMode` dibekalkan (sama corak render-hanya-bila-
   *  ada-isi fail ni). */
  navMode?: 'rawak' | 'turutan';
  onToggleNavMode?: () => void;
  /** ID objek editorial kandungan (2026-08-05, Fasa 11 — perkongsian sosial). Bila dibekalkan
   *  (kandungan diterbitkan sebenar, bukan draf), Focus View minta kod URL pendek kanonikal
   *  (GET /api/system/content/:objectId/url-kod) untuk butang Kongsi + meta URL kanonikal
   *  (sebelum ni jatuh balik ke window.location.href — lihat nota terapFocusSeo di bawah).
   *  Draf tak-diterbitkan tiada objectId sebenar — butang Kongsi tak dirender langsung. */
  objectId?: string;
  /** Tempoh tatal automatik, saat (2026-08-13, Tetapan Am — keputusan Izzat kekalkan model
   *  tempoh TETAP, boleh dilaraskan Ketua Editor/Pentadbir, bukan skala ikut panjang artikel).
   *  Jatuh balik ke AUTOSCROLL_DEFAULT_SEC (14) kalau tiada (keserasian ke belakang, dan kalau
   *  pemanggil tak sambung system_settings.focusViewAutoAdvanceSec langsung). */
  autoAdvanceSec?: number;
}

export const FocusView: React.FC<FocusViewProps> = ({
  wordmark = 'Adjung', icon, desk, topik, onCariEyebrow, deskColor, title, titleRendered, body,
  visual, visualCaption, related = [], note, notaMaxAksara = NOTA_MAX, autoAdvanceSec,
  source, sourceUrl, sources = [], sourceDate, publishedDate, editorName,
  backdropImage, backdropOpacity = 0.06,
  onPrev, onNext, prevPreviewTitle, nextPreviewTitle, onClose,
  titleSizeScale = 1, bodySizePx = 15,
  navMode = 'rawak', onToggleNavMode,
  objectId,
}) => {
  // Format label datang daripada eyebrowLabel() di GeometryConfig — sumber SAMA yang dipakai kad
  // bento dan pengesahan simpan. Sebelum ini fail ini ada takrifannya sendiri (' · '), jadi Focus
  // View memapar "MALAYSIANA · Percubaan" sementara kad memapar "MALAYSIANA | Percubaan" untuk
  // kandungan yang sama. CLAUDE.md melarang menulis semula format ini secara khusus: kalau ia
  // bercabang, had aksara mengesahkan string yang berlainan daripada yang benar-benar dirender.
  const label = eyebrowLabel(desk, topik);
  const warnaEyebrow = deskColor || 'var(--color-Adjung-maroon)';
  const isPhone = usePhoneViewport();

  // Segmen Bidang/Topik boleh klik berasingan + microanimasi garis-bawah tumbuh (2026-08-07,
  // permintaan Izzat — "topik di full view pun perlu ada microanimasi mcm di frontpage dan perlu
  // ke search jgk, utk keselarasan"). `.eyebrow-topik-teks` ialah kelas ANIMASI sedia ada daripada
  // kad bento (index.css) — dikongsi terus di sini, BUKAN disalin, supaya kedua-dua permukaan
  // sentiasa nampak sama. Nilai mentah setiap segmen terus dari `desk`/`topik` (prop), pemisah
  // " | " literal sama seperti eyebrowLabel() guna — `label` di atas KEKAL sumber pengesahan/
  // gate render ("ada isi ke tidak"), cuma tak dipakai lagi untuk PAPARAN teks (perlukan bahagian
  // berasingan bagi setiap zon klik).
  const eyebrowKlikProps = (nilai: string): React.HTMLAttributes<HTMLSpanElement> => {
    if (!onCariEyebrow || !nilai) return {};
    return {
      onClick: (e) => { e.stopPropagation(); onCariEyebrow(nilai); },
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCariEyebrow(nilai); } },
      role: 'button',
      tabIndex: 0,
      'aria-label': `Cari "${nilai}"`,
      style: { cursor: 'pointer' },
    };
  };
  // Animasi ikon->Bidang (2026-08-17, Izzat: "mula2 ikon+topik, kemudian bidang keluar
  // daripada ikon tu gantikan ikon") — SAHAJA bila ikon SEDIA (bidang+topik kedua-duanya
  // wujud, sama syarat `bolehGunaIkon` EyebrowKad kad bento). `icon` prop sedia lama, dahulu
  // sengaja diterima tapi TAK DIRENDER (lihat nota jenis FocusViewProps di atas — keputusan
  // Izzat 2026-08-07 "ikon berlebihan, kekalkan perkataan") — ni BUKAN pembalikan keputusan
  // tu, cuma ikon kini muncul SEBENTAR sebagai animasi masuk sebelum Bidang, bukan kekal
  // selamanya macam kad bento.
  // Pembetulan susulan (2026-08-17, Izzat: "salah awak buat tu. nama bidang keluar dari icon.
  // keluar dari arah kiri ke kanan, dan ia akan engsot topik sekali gus") — `fv-eyebrow-bidang-
  // keluar` guna teknik wipe-reveal (max-width, lihat index.css) bukan opacity semata, supaya
  // Topik betul-betul "diengsot" oleh perubahan lebar kotak SEBENAR dlm aliran dokumen, bukan
  // cuma pudar di tempat.
  const eyebrowNodes: React.ReactNode = (() => {
    const d = (desk || '').trim();
    const t = (topik || '').trim();
    if (!d) return <span className="eyebrow-topik-teks" {...eyebrowKlikProps(t)}>{t}</span>;
    if (!t) return <span className="eyebrow-topik-teks" {...eyebrowKlikProps(d)}>{d}</span>;
    if (icon) {
      return (
        <>
          <span className="fv-eyebrow-ikon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
          <span className="fv-eyebrow-bidang-keluar eyebrow-topik-teks" {...eyebrowKlikProps(d)}>{d}</span>
          <span className="fv-eyebrow-pemisah-masuk" aria-hidden="true">{' | '}</span>
          <span className="eyebrow-topik-teks" {...eyebrowKlikProps(t)}>{t}</span>
        </>
      );
    }
    return (
      <>
        <span className="eyebrow-topik-teks" {...eyebrowKlikProps(d)}>{d}</span>
        {' | '}
        <span className="eyebrow-topik-teks" {...eyebrowKlikProps(t)}>{t}</span>
      </>
    );
  })();

  // Glosari sebagai tooltip hover (2026-08-07, permintaan Izzat) — lihat
  // src/components/common/IstilahGlosari.tsx untuk penjelasan penuh. Dimuat SEKALI setiap Focus
  // View dibuka (bukan setiap artikel — /api/system/glosari sama untuk semua artikel, senarai
  // biasanya kecil, cache dalam-komponen cukup). `sudahDitandaRef` reset setiap kali ARTIKEL
  // bertukar (kunci `objectId`, sandaran `title` kalau objectId tiada) supaya "kali pertama
  // sahaja" dikira SEPANJANG SATU artikel (tajuk + semua perenggan), bukan berterusan merentasi
  // artikel berlainan semasa navigasi sebelum/seterus.
  const [petaGlosari, setPetaGlosari] = React.useState<Map<string, EntriGlosari>>(new Map());
  React.useEffect(() => {
    let dibatal = false;
    fetch('/api/system/glosari')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!dibatal && Array.isArray(data)) setPetaGlosari(binaPetaGlosari(data)); })
      .catch(() => { /* glosari cuma penambahbaikan bacaan — kegagalan tak menghalang artikel */ });
    return () => { dibatal = true; };
  }, []);
  // Kunci scroll halaman di belakang semasa Focus View terbuka (2026-08-05, permintaan Izzat —
  // "sepatutnya hanya boleh scroll Focus View"). Focus View sendiri `position: fixed` (bukan
  // sebahagian aliran dokumen), jadi ia TAK menghalang halaman induk di belakang menatal — badan
  // kekal boleh tatal (nampak "menerawang" di belakang panel tetap). Mount/unmount komponen ni
  // SEPADAN TEPAT dengan buka/tutup Focus View (FrontpageView cuma render bila `focusLoc` wujud),
  // jadi kunci/lepas kunci di sini betul-betul di tempat yang sepatutnya — tiada plumbing tambahan
  // di FrontpageView.tsx. Simpan overflow SEDIA ADA (bukan andaikan '') supaya dipulihkan tepat.
  React.useEffect(() => {
    // Kunci KEDUA-DUA <html> dan <body> — sesetengah pelayar (terutama telefon) letak scroll
    // sebenar pada documentElement (<html>), bukan <body>; kunci body sahaja tak cukup, ditemui
    // semasa ujian browser (window.scrollTo masih berjaya menatal walaupun body overflow:hidden).
    const asalBody = document.body.style.overflow;
    const asalHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = asalBody;
      document.documentElement.style.overflow = asalHtml;
    };
  }, []);

  // Animasi transisi antara kandungan (2026-08-05, permintaan Izzat) — panel maroon "kad tengah"
  // (sepadan bahasa visual Colophon carousel bento sedia ada) lalu ATAS-BAWAH (bukan kiri-kanan)
  // apabila kandungan bertukar, sama ada navigasi manual (Sebelum/Seterusnya) atau tatal automatik.
  // Kandungan sebenar (title/body/dll) sudah bertukar serta-merta melalui prop React seperti biasa
  // — panel cuma perlu MENUTUP PENUH skrin seketika (fasa "tahan" di tengah keyframe, bukan cuma
  // satu bingkai sekelip) supaya pertukaran itu tak kelihatan berlaku mengejut di sebalik panel.
  // TIADA animasi pada mount pertama (firstRender ref) — hanya pada pertukaran SELEPAS itu.
  const firstFocusRender = React.useRef(true);
  const [tunjukTransisi, setTunjukTransisi] = React.useState(false);
  React.useEffect(() => {
    if (firstFocusRender.current) { firstFocusRender.current = false; return; }
    setTunjukTransisi(true);
    const t = setTimeout(() => setTunjukTransisi(false), 900);
    return () => clearTimeout(t);
  }, [title]);

  // Tatal automatik Focus View (2026-08-04, permintaan Izzat) — lompat sendiri ke kandungan
  // seterusnya (rawak merentasi Bidang, ditentukan oleh `onNext` yang FrontpageView bekalkan)
  // supaya pembaca tak perlu klik tiap kali. Hanya aktif bila ada sasaran seterusnya (`onNext`
  // wujud) — di kandungan terakhir (satu-satunya lokasi di laman), butang/tatal automatik tak
  // dirender langsung, sama macam anak panah sedia ada. Boleh dijeda oleh pembaca (butang Auto);
  // keadaan main/jeda kekal sepanjang sesi Focus View dibuka (komponen sama, bukan remount setiap
  // navigasi), tak reset ke "main" semula pada tiap kandungan.
  // Tempoh boleh laras Ketua Editor/Pentadbir (2026-08-13, Tetapan Am) — `autoAdvanceSec` prop
  // datang dari system_settings.focusViewAutoAdvanceSec (FrontpageView.tsx). Jatuh balik ke 14
  // saat kalau prop tiada (keserasian ke belakang).
  const AUTOSCROLL_MS = (autoAdvanceSec && autoAdvanceSec > 0 ? autoAdvanceSec : 14) * 1000;
  const [autoPlay, setAutoPlay] = React.useState(true);
  // Baki masa jeda (2026-08-16, permintaan Izzat — "tekan space, saya tak nak kiraan detik tu
  // direset... tekan space sekali lagi, progress bar kembali bergerak") — SEBELUM ni toggle
  // autoPlay off/on cuma clear+setTimeout PENUH (AUTOSCROLL_MS) semula, jadi jeda-sambung nampak
  // macam mula dari kosong balik, bukan sambung dari tempat ditinggalkan. Kini jejak baki masa
  // eksplisit: bila jeda (cleanup effect di bawah bila autoPlay jadi false), kira baki (AUTOSCROLL_MS
  // tolak masa berlalu) dan simpan; bila sambung, guna baki tu (bukan AUTOSCROLL_MS penuh).
  const bakiMsRef = React.useRef(AUTOSCROLL_MS);
  const mulaMasaRef = React.useRef(Date.now());
  React.useEffect(() => {
    // Kandungan bertukar (title baharu, auto ATAU navigasi manual) — mula semula PENUH, bukan
    // sambung baki kandungan LAMA (effect ni jalan SEBELUM effect pemasa di bawah bila title
    // berubah, urutan deklarasi React).
    bakiMsRef.current = AUTOSCROLL_MS;
  }, [title, AUTOSCROLL_MS]);
  React.useEffect(() => {
    if (!autoPlay || !onNext) return;
    mulaMasaRef.current = Date.now();
    const t = setTimeout(onNext, bakiMsRef.current);
    return () => {
      clearTimeout(t);
      // Simpan baki HANYA bila effect ni dibersih sebab autoPlay bertukar false (jeda) — bila
      // sebabnya title bertukar, effect atas dah reset bakiMsRef ke penuh; overwrite di sini
      // (dgn pengiraan drpd title LAMA) tak apa sebab effect atas akan timpa balik ke penuh
      // lepas ni ikut urutan deklarasi, nilai sini cuma sekejap.
      bakiMsRef.current = Math.max(0, bakiMsRef.current - (Date.now() - mulaMasaRef.current));
    };
  }, [autoPlay, onNext, title]);

  // Kekunci Space jeda/main tatal automatik (2026-08-13, permintaan Izzat — "benarkan pembaca
  // guna keyboard, contohnya tekan butang space untuk pause-kan masa"). Diabaikan bila fokus
  // sedang pada medan boleh taip (input/textarea/contenteditable — cth kotak carian eyebrow)
  // supaya Space tak dipintas daripada kegunaan biasanya (taip ruang). preventDefault elak
  // Space skrol badan Focus View (kelakuan lalai pelayar bagi Space di luar medan taip).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.code !== 'Space') return;
      const sasaran = e.target as HTMLElement | null;
      const tag = sasaran?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || sasaran?.isContentEditable) return;
      e.preventDefault();
      setAutoPlay((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Leret (swipe) untuk navigasi Focus View telefon (2026-08-05, permintaan Izzat — "user boleh
  // swap je di skrin"). MENDATAR (kiri/kanan) sengaja, BUKAN menegak — badan Focus View sendiri
  // menatal MENEGAK (huraian panjang), jadi leret menegak mesti kekal untuk tatal biasa; leret
  // mendatar bebas dipakai sebab tiada tatal mendatar dalam Focus View. Ambang 60px + nisbah
  // mendatar:menegak > 1.5 elak leret menatal tak sengaja tercetus sebagai navigasi.
  const sentuhMulaRef = React.useRef<{ x: number; y: number } | null>(null);
  const kendaliSentuhMula = (e: React.TouchEvent) => {
    const t = e.touches[0];
    sentuhMulaRef.current = { x: t.clientX, y: t.clientY };
  };
  const kendaliSentuhTamat = (e: React.TouchEvent) => {
    const mula = sentuhMulaRef.current;
    sentuhMulaRef.current = null;
    if (!mula) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - mula.x;
    const dy = t.clientY - mula.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) { onNext && onNext(); } else { onPrev && onPrev(); }
  };

  // Huraian panjang render satu lajur, perenggan berturutan — TIADA lagi pembahagian dua-ukuran
  // (2026-07-29, sejak huraian pendek dibuang: pembahagian tu sedia ada khusus untuk imbang ruang
  // bacaan apabila huraian pendek+panjang berkongsi jalur yang sama; dengan huraian pendek tiada,
  // satu lajur lurus lebih ringkas dan padan reka bentuk rujukan pemilik projek).
  const text = String(body || '').trim();
  // \n{2,} -> \n+ (2026-08-16, permintaan Izzat — "sepatutnya enter akan membina perenggan
  // baharu") — SEBELUM ni perenggan baharu perlu BARIS KOSONG (Enter DUA kali) sebab huraian
  // panjang tersimpan mentah drpd apa editor taip (SATU Enter = SATU \n). Editor lazimnya tekan
  // Enter SEKALI sahaja antara perenggan (jangkaan biasa borang teks), jadi \n{2,} (perlukan 2+
  // newline berturutan) tak pernah padan — teks kekal SATU perenggan, \n tunggal collapse jadi
  // ruang oleh CSS (elemen <p> ni tiada white-space:pre-wrap). \n+ (SATU atau lebih newline)
  // jadikan SETIAP baris editor taip perenggannya sendiri, sepadan jangkaan biasa.
  const paragraphs = React.useMemo(
    () => text.split(/\n+/).filter(Boolean),
    [text]
  );

  // Susun atur mudah alih DAN desktop WUJUD SERENTAK dalam DOM (disorok/ditunjuk ikut CSS
  // responsif, bukan syarat JS, disahkan ketiadaan `isPhone ?` bersyarat langsung dalam fail ni)
  // — maka DUA pengiraan berasingan (bukan satu dikongsi). Set "sudah ditanda" dicipta SEGAR di
  // dalam setiap useMemo (bukan useRef berterusan) supaya pengiraan kekal TULEN — React StrictMode
  // panggil badan komponen DUA KALI setiap render; kalau Set dikongsi/berterusan merentasi
  // panggilan, panggilan pertama (dibuang) "habiskan" istilah sebelum panggilan kedua (yang
  // sebenarnya di-commit ke DOM) sempat menanda — disahkan pepijat sebenar semasa ujian browser
  // (istilah "Warisan" langsung tak bertanda pada skrin, walaupun peta glosari + teks kedua-duanya
  // betul).
  // `desk` (2026-08-16, Glosari Berasaskan Bidang) — Bidang KANDUNGAN semasa, dihantar terus ke
  // renderDenganGlosari() untuk resolusi Sense (docs/glossary-architecture-proposal.md v3,
  // Seksyen 3). `desk` sudah wujud sebagai prop komponen ni (destructured atas) — tiada data
  // baharu diperlukan, cuma disalur ke fungsi render yang sedia ada.
  const glosariMudahAlih = React.useMemo(() => {
    const sudahDitanda = new Set<string>();
    return {
      tajuk: renderDenganGlosari(title, petaGlosari, sudahDitanda, desk),
      perenggan: paragraphs.map((p) => renderDenganGlosari(p, petaGlosari, sudahDitanda, desk, safeParseInline)),
    };
  }, [title, paragraphs, petaGlosari, desk]);
  const glosariDesktop = React.useMemo(() => {
    const sudahDitanda = new Set<string>();
    return {
      tajuk: renderDenganGlosari(title, petaGlosari, sudahDitanda, desk),
      perenggan: paragraphs.map((p) => renderDenganGlosari(p, petaGlosari, sudahDitanda, desk, safeParseInline)),
    };
  }, [title, paragraphs, petaGlosari, desk]);

  const [bodyRef, bodyFade] = useOverflowFade();

  // Nota melebihi hadnya dipotong di sempadan perkataan; teks penuh kekal dalam atribut `title`,
  // dan amaran konsol menamakan lebihannya supaya editor memendekkannya di Editorium.
  const notaText = trimNota(note, notaMaxAksara);
  React.useEffect(() => {
    const n = String(note || '').trim().length;
    if (n > notaMaxAksara) console.warn(`FocusView: nota ${n}/${notaMaxAksara} aksara — pendekkan nota di Editorium.`);
  }, [note, notaMaxAksara]);

  // URL kandungan sebenar (2026-08-05, Fasa 11 — perkongsian sosial) — minta kod pendek
  // kanonikal bila `objectId` wujud (kandungan diterbitkan). Ini SAMBUNGKAN jurang yang
  // dicatat di Fasa 9 ("meta URL kanonikal untuk kandungan dibuka SECARA INTERAKTIF masih
  // guna window.location.href") — kini terapFocusSeo() di bawah dapat `url` sebenar bila ada.
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    setShareUrl(null);
    if (!objectId || objectId === 'manual') return;
    let dibatal = false;
    fetch(`/api/system/content/${encodeURIComponent(objectId)}/url-kod`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (dibatal || !data || !data.laluan) return;
        setShareUrl(`${window.location.origin}${data.laluan}`);
      })
      .catch(() => {});
    return () => { dibatal = true; };
  }, [objectId]);

  // Salin pautan (2026-08-05, Fasa 11) — maklum balas ikon bertukar sekejap kepada tanda betul.
  const [disalinBerjaya, setDisalinBerjaya] = React.useState(false);
  const salinPautan = React.useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setDisalinBerjaya(true);
      setTimeout(() => setDisalinBerjaya(false), 2000);
    }).catch(() => {});
  }, [shareUrl]);

  // SEO dinamik (Fasa 9) — kemas kini tajuk/meta description/OG/Twitter/JSON-LD NewsArticle
  // di <head> bila Focus View dibuka, pulihkan meta lalai laman bila ditutup/tukar kandungan.
  // Client-side sahaja (SPA tanpa SSR) — lihat nota panjang di src/utils/seoMeta.ts. `url`
  // guna `shareUrl` sebenar bila sudah tersedia (Fasa 11), jatuh balik ke window.location.href
  // (kelakuan asal Fasa 9) sementara/bila tiada.
  React.useEffect(() => {
    terapFocusSeo({
      title: String(title || ''),
      description: text || String(title || ''),
      publishedDate,
      desk,
      url: shareUrl || undefined,
    });
    return () => { buangSemulaFocusSeo(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, text, publishedDate, desk, shareUrl]);

  // Had tajuk ialah 168 aksara (MENEGAK). Saiz menurun mengikut kiraan aksara supaya blok tajuk
  // menduduki ukuran yang sama sama ada tajuk 40 aksara atau 168 aksara penuh.
  //
  // TETAP dalam px, TIADA terma viewport. Versi clamp(..., vh, ...) terdahulu memapar tajuk 168
  // aksara pada 20.7px dan bukan 27px, kerana 2.3vh pada tinggi 900px ialah 20.7px — clamp itu
  // memilih nilai tengah, bukan nilai maksimum. Jangan perkenalkan semula terma vh di sini.
  //
  // Tangga 44/37/31/27 (2026-07-29) ditentukur utk lajur tajuk LEBAR PENUH (min(64%,900px),
  // susun atur satu-lajur lama). Susun atur dua-lajur (2026-08-07) sempitkan lajur tajuk kepada
  // ~5/12 lebar helaian (~40%) — tangga diskalakan ÷1.28 (34/29/24/21) supaya perkataan tunggal
  // biasa muat dalam lebar lajur baharu. (Percubaan "muat-ke-kotak" — fon automatik BESAR utk
  // tajuk pendek, isi ruang menegak — dicuba & DITOLAK Izzat selepas verifikasi visual: fon jadi
  // tak konsisten merentasi kandungan, "ada yg besar gedabak, ada yg kecil sangat". Konsisten
  // lebih penting drpd isi ruang kosong bawah tajuk pendek — itu bukan pepijat.)
  const n = String(title || '').length;
  const titleSizeAsas = n <= 60 ? 34 : n <= 100 ? 29 : n <= 140 ? 24 : 21;
  const titleSize = `${Math.round(titleSizeAsas * titleSizeScale)}px`;
  const bodySize = `${bodySizePx}px`;

  // Susut tambahan (lihat useShrinkTitleToFit di atas) — jaring keselamatan utk kes jarang
  // perkataan tunggal superpanjang yang tak muat walau dah pada tangga terkecil; hanya BERKESAN
  // pada susun atur desktop (lajur tajuk sempit tetap).
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  useShrinkTitleToFit(titleRef, titleSizeAsas * titleSizeScale, 15, [title, titleSizeAsas, titleSizeScale]);

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
  //
  // Nav penjuru terapung (chevron/anak panah bucu skrin) DIBUANG SEPENUHNYA 2026-07-29 —
  // permintaan pemilik projek selepas ia jadi lebihan: preview Sebelum/Selepas di kandungan
  // utama (guna prevPreviewTitle/nextPreviewTitle terus, klik untuk navigasi) sudah cukup
  // sebagai sasaran klik + isyarat visual, tiada keperluan salinan kedua di penjuru.

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

  // Panel transisi "kad tengah" (lihat nota tunjukTransisi di atas) — sepadan telefon & desktop,
  // jadi ditakrif SEKALI, disuntik dalam kedua-dua cawangan `return` di bawah.
  const transitionOverlay = tunjukTransisi && (
    <div
      // Awalan pada kunci (2026-08-07) — panel transisi ni dan bar autoscroll di bawah ialah
      // ADIK-BERADIK dalam induk yang sama, dan kedua-duanya dahulu guna `key={title}` sahaja.
      // React mengadu "two children with the same key" dan amaran itu bukan kosmetik: dua anak
      // berkongsi kunci boleh diduplikasi/ditinggalkan semasa kemas kini. Kunci kekal berubah
      // ikut `title` (itu tujuannya — paksa remount supaya animasi bermula semula setiap kali
      // kandungan bertukar), cuma diruang-namakan supaya unik antara adik-beradik.
      key={`transisi-${title}`}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 250, pointerEvents: 'none',
        background: 'var(--color-Adjung-maroon)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'focusViewTransitionPanel 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      }}
    >
      {/* 26px -> 32px (2026-08-16, permintaan Izzat). Nombor terus (bukan LOGO_SIZE, brand.ts) —
          fail ni guna inline style di seluruh tempat (bukan className Tailwind macam LOGO_SIZE
          eksport), dan 32px tak sepadan tepat mana-mana 4 peringkat sedia ada (mini 18px / gate
          30px-36px). Sistem LOGO_SIZE sendiri wujud sebab masalah ni (setiap skrin pilih saiz
          sendiri, lihat nota brand.ts) — panel transisi penuh-skrin ni (konteks "gate" dari segi
          penonjolan, tapi "mini" dari segi lockup satu-baris) tak muat kemas dalam mana-mana
          peringkat sedia ada. Kalau lebih tempat perlukan ~32px penuh-skrin macam ni, patut jadi
          peringkat ke-5 LOGO_SIZE eksplisit, bukan nombor bersendirian macam ni. */}
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', letterSpacing: 'var(--tracking-tight)', color: '#FDFDFD' }}>
        {wordmark}
      </span>
    </div>
  );

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
      minHeight: '56px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
      alignItems: 'flex-start', justifyContent: 'center', gap: '3px', padding: '8px 14px',
      textAlign: 'left',
    };

    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'var(--surface-page)',
          color: 'var(--text-body)', display: 'flex', flexDirection: 'column',
          // Bendera userSelect (2026-08-05) — FrontpageView.tsx punya bekas induk terkunci
          // `select-none` (Tailwind) di peringkat halaman PENUH (elak teks kad tak sengaja
          // terpilih semasa klik/leret carousel) — Focus View DILAHIRKAN bersarang dalam pokok
          // DOM tu (bukan Portal), jadi warisi sekatan tu turut sekali walhal ni permukaan
          // BACAAN, bukan kad. Ditulis-ganti eksplisit di sini supaya pembaca boleh salin teks.
          userSelect: 'text', WebkitUserSelect: 'text',
          // touchAction:pan-y (2026-08-12, Izzat lapor drpd telefon sebenar + audit ChatGPT) —
          // userSelect:text di atas + leret mendatar next/prev (onTouchStart/onTouchEnd bawah)
          // pada permukaan yang SAMA buat Safari iOS kadang tafsir leret menegak perlahan sbg
          // gesture PILIH TEKS drpd tatal biasa. pan-y beritahu browser leret menegak ialah
          // tatal-native (serah terus kpd Safari), bukan gesture aplikasi utk dirampas — tekan
          // lama (long-press) utk salin teks kekal berfungsi spt biasa, cuma leret licin je diperbetulkan.
          touchAction: 'pan-y',
        }}
        onTouchStart={kendaliSentuhMula}
        onTouchEnd={kendaliSentuhTamat}
      >
        {transitionOverlay}
        {backdropImage && (
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0, backgroundImage: 'url(' + backdropImage + ')',
            backgroundSize: 'cover', backgroundPosition: 'center', opacity: backdropOpacity, pointerEvents: 'none',
          }} />
        )}

        {/* Jalur atas — logo DI TENGAH (2026-08-05, permintaan Izzat), grid 3-lajur macam desktop
            supaya logo betul-betul tengah tanpa terjejas oleh Tutup di sisi. Rawak/Auto dipindah
            keluar dari sini — lihat kawalan terapung di atas footer navigasi di bawah. Tutup kini
            ikon telanjang (bukan pil bulatan) — permintaan Izzat, "butang pangkah tak perlu
            bulatan". */}
        <div style={{
          position: 'relative', flex: '0 0 auto', display: 'grid', gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--stone-300)',
        }}>
          <span />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--color-Adjung-maroon)', justifySelf: 'center' }}>{wordmark}</span>
          {onClose && (
            <button {...closeProps} style={{
              justifySelf: 'end', background: 'none', border: 0, padding: 0, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: '44px', minHeight: '44px', color: 'var(--stone-500)',
            }}>
              <X size={20} strokeWidth={1.75} />
            </button>
          )}
        </div>
        {onNext && (
          // Kekal mounted walau jeda (2026-08-16, permintaan Izzat) — SEBELUM ni bar ni tersembunyi
          // sepenuhnya bila autoPlay=false (unmount, hilang kedudukan animasi), lalu remount dari
          // kosong bila sambung. animationPlayState:'paused' bekukan animasi CSS TEPAT di kedudukan
          // semasa (kelakuan asli pelayar), 'running' sambung dari situ — tiada jejak masa manual
          // diperlukan utk bahagian visual ni (jejak masa sebenar utk onNext() di useEffect atas).
          <div key={`bar-${title}`} style={{ height: '2px', flex: '0 0 auto', background: 'var(--stone-200)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--color-Adjung-maroon)', transformOrigin: 'left', animation: `focusAutoScrollBar ${AUTOSCROLL_MS}ms linear forwards`, animationPlayState: autoPlay ? 'running' : 'paused' }} />
          </div>
        )}

        {/* Kepala melekat (2026-08-05, permintaan Izzat — "pastikan tajuk dan tarikh siaran
            melekat di page ketika user menatal huraian panjang") — eyebrow, tajuk dan tarikh
            siaran DI LUAR kotak scroll di bawah (flex 0 0 auto, bukan sebahagian badan yang
            menatal), supaya kekal kelihatan sepanjang pembaca menatal huraian panjang. Tarikh
            siaran TANPA label "Siaran" (permintaan Izzat) — cuma tarikh sahaja. */}
        <div style={{
          // gap 8px->12px (2026-08-12, permintaan Izzat — "spacing ... tak cantik") — Topik/Tajuk/
          // Tarikh ialah TIGA aras maklumat berbeza, 8px seragam buat semuanya nampak satu blok
          // rapat (audit ChatGPT). 12px bukan keputusan muktamad — Izzat sahkan pada telefon
          // sebenar selepas deploy, boleh dilaras lagi.
          flex: '0 0 auto', padding: '20px 16px 14px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          {/* Ikon dahulu TIDAK dirender kekal di sini — kini muncul sebentar sebagai animasi
              masuk sahaja, lihat nota `eyebrowNodes` di atas. `key={title}` (sama corak
              focusAutoScrollBar) paksa remount setiap artikel bertukar supaya animasi replay,
              bukan main sekali sahaja semasa Focus View pertama dibuka. */}
          {label && (
            <span key={`eyebrow-${title}`} style={{
              fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-editorial)', color: warnaEyebrow,
            }}>{eyebrowNodes}</span>
          )}

          {/* `title` mentah sengaja, BUKAN `titleRendered` (2026-08-05, permintaan Izzat — "tak
              perlu hyphenation") — titleRendered sisipkan pemenggalan suku kata (gloss/autocondong)
              yang kelihatan sebagai sengkang lembut di tengah perkataan; pada skrin telefon yang
              sempit, tajuk sudah pun patah baris kerap, jadi sengkang tambahan jadi mengganggu.
              Desktop KEKAL guna titleRendered (ruang lebih lapang, kurang patah baris).
              `fv-tajuk-masuk` + `key={title}` (2026-08-17, Izzat) — pudar+gelongsor masuk,
              replay setiap artikel bertukar. */}
          <h1 key={`tajuk-${title}`} className="fv-tajuk-masuk" style={{
            margin: 0, fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 500,
            lineHeight: 1.18, letterSpacing: 'var(--tracking-tight)', color: 'var(--text-heading)', textWrap: 'pretty',
            textAlign: 'center',
          }}>{glosariMudahAlih.tajuk}</h1>

          {publishedDate && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-11)', letterSpacing: 'var(--tracking-wide)',
              color: 'var(--stone-400)',
            }}>{publishedDate}</span>
          )}
        </div>

        {/* Badan yang menatal — `overscrollBehavior: contain` elak tatal "rantai" ke halaman di
            belakang bila pembaca sampai hujung atas/bawah huraian (bonus kepada kunci
            html/body overflow di atas — dua lapis perlindungan sama konsep).
            overflowX:'hidden' EKSPLISIT (2026-08-12, Izzat lapor drpd telefon sebenar + audit
            ChatGPT) — bila hanya overflowY dinyatakan, kuirk CSS piawai tukar overflowX yang tak
            dinyatakan drpd 'visible' kepada 'auto' SENDIRI (bukan pepijat React/kod ni — sifat
            asas `overflow` shorthand). Gloss interlinear (white-space:nowrap, tiada max-width,
            Tiket B berasingan, belum selesai) kadangkala terjulur lebih lebar drpd kontena ni,
            dan overflowX:auto yang tersalah dedah tu benarkan iOS Safari leret/heret MENDATAR
            seluruh badan bacaan utk "lihat" bahagian terjulur — pembaca boleh heret kandungan ke
            kiri/kanan sehingga ruang kosong terbentuk, persis screenshot Izzat. Ni acceptance
            criterion serta-merta: badan bacaan TAK BOLEH ada scroll mendatar tak kira apa
            kandungan dalamnya — gloss yang terjulur mungkin nampak terpotong buat sementara
            (Tiket B, PoC wrapping/reka bentuk penuh, KIV berasingan), tapi itu diterima sbg
            keadaan sementara, BUKAN penyelesaian akhir gloss. */}
        <div style={{
          position: 'relative', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          overscrollBehavior: 'contain',
          padding: '20px 16px 28px', display: 'flex', flexDirection: 'column', gap: '18px',
        }}>
          {text && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* <hr> pemisah dibuang (2026-08-12, permintaan Izzat) — kepala melekat di atas
                  (baris ~683) sudah ada borderBottom sendiri; hr di sini jadi pemisah BERGANDA
                  serta-merta lepas border tu (audit ChatGPT: "dua pemisah berturut-turut" antara
                  metadata/tajuk dgn kandungan). Border kepala kekal sbg SATU-SATUNYA pemisah. */}
              {/* Margin kiri/kanan tambahan (2026-08-05, permintaan Izzat) — kolum huraian
                  panjang dikecilkan drpd lebar penuh badan (padding 16px sedia ada), sengaja
                  berasingan drpd bahagian lain (Sumber/Nota kekal lebar asal) — huraian panjang
                  paling banyak teks berturutan, lebar penuh skrin telefon sukar dibaca.
                  `fv-huraian-masuk` + `key={title}` (2026-08-17, Izzat) — pudar+gelongsor masuk
                  lepas tajuk (delay lebih panjang, ikut hierarki bidang+topik > tajuk > huraian
                  panjang), replay setiap artikel bertukar. */}
              <div key={`huraian-${title}`} className="fv-huraian-masuk" style={{
                fontFamily: 'var(--font-serif)', fontSize: '14px', fontWeight: 300,
                lineHeight: 1.75, color: 'var(--text-body)', textWrap: 'pretty',
                padding: '0 10px',
              }}>
                {paragraphs.map((para, j) => (
                  <p key={j} style={{ margin: j === 0 ? 0 : '0.9em 0 0' }}>{glosariMudahAlih.perenggan[j]}</p>
                ))}
              </div>
            </div>
          )}

          {/* Tarikh siaran dipindah ke kepala melekat (di atas, bawah tajuk) — lihat nota di sana.
              Tarikh SUMBER (bukan siaran) kekal di sini, di bawah nama Sumber (permintaan Izzat).
              Sumber berbilang (2026-08-05) — Focus View senaraikan SEMUA (`sources`), bukan cuma
              satu (`source`/`sourceUrl`) — ruang lebih drpd kad, tiada sebab hadkan di sini.
              Tarikh PER-sumber (2026-08-15) — setiap sumber papar tarikh SENDIRI terus di bawah
              namanya (bukan satu sourceDate dikongsi semua), sebab sumber berbeza selalunya
              diterbitkan pada tarikh berbeza. `sourceDate` kekal jatuh balik untuk kes sumber
              tunggal legasi (sources[] tiada). */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '6px' }}>
            {sources.length > 0 ? (
              sources.map((s, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <a href={s.url || '#'} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', color: 'var(--stone-500)', lineHeight: 1.5, wordBreak: 'break-all' }}>{s.name || '—'}</a>
                  {s.date && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-9)', letterSpacing: 'var(--tracking-wide)', color: 'var(--stone-400)' }}>{s.date}</span>
                  )}
                </div>
              ))
            ) : (
              <a href={sourceUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', color: 'var(--stone-500)', lineHeight: 1.5, wordBreak: 'break-all' }}>{source || '—'}</a>
            )}
            {sources.length === 0 && sourceDate && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-9)', letterSpacing: 'var(--tracking-wide)', color: 'var(--stone-400)' }}>{sourceDate}</span>
            )}
          </div>

          {/* Kongsi (2026-08-05, Fasa 11 — perkongsian sosial) — hanya dirender bila `shareUrl`
              sedia (kandungan diterbitkan sebenar, kod URL sudah diambil). Ikon bulat sepadan
              corak butang navigasi kaki sedia ada di bawah (round pill, border stone-300). */}
          {shareUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={micro}>Kongsi</span>
              <KongsiButtons title={title} url={shareUrl} disalinBerjaya={disalinBerjaya} onSalin={salinPautan} />
            </div>
          )}

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
            </div>
          )}
        </div>

        {/* Navigasi melekat di kaki — ikon ATAS/BAWAH (2026-08-05, permintaan Izzat: "transisi
            berlaku atas bawah, bukan kiri kanan", jadi ikon nav pun ikut arah sama), + tajuk
            kandungan sebelum/selepas, tanpa label "Sebelum"/"Seterusnya". Rawak/Auto terapung DI
            ATAS jalur ni (permintaan Izzat) — bukan lagi di masthead — supaya logo boleh betul-
            betul di tengah masthead. */}
        {(onPrev || onNext) && (
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            {(onToggleNavMode || onNext) && (
              <div style={{
                position: 'absolute', bottom: '100%', right: '10px', marginBottom: '8px',
                display: 'inline-flex', alignItems: 'center', gap: '6px', zIndex: 5,
              }}>
                {onToggleNavMode && (
                  <Tooltip text={navMode === 'rawak' ? 'Rawak' : 'Turutan'}>
                    <button
                      type="button" onClick={onToggleNavMode}
                      aria-label={navMode === 'rawak' ? 'Tukar ke mod turutan' : 'Tukar ke mod rawak'}
                      className="fv-pill-btn"
                      style={{
                        appearance: 'none', background: 'var(--surface-page)', border: '1px solid var(--stone-300)',
                        borderRadius: '999px', color: 'var(--stone-500)', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center', minWidth: '30px', minHeight: '30px',
                        padding: 0, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      }}
                    >
                      {navMode === 'rawak' ? <Shuffle size={13} strokeWidth={1.75} /> : <ListOrdered size={13} strokeWidth={1.75} />}
                    </button>
                  </Tooltip>
                )}
                {onNext && (
                  <button
                    type="button" onClick={() => setAutoPlay(p => !p)}
                    aria-label={autoPlay ? 'Jeda tatal automatik' : 'Mainkan tatal automatik'}
                    className="fv-pill-btn"
                    style={{
                      appearance: 'none', background: 'var(--surface-page)', border: '1px solid var(--stone-300)',
                      borderRadius: '999px', color: 'var(--stone-500)', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', minWidth: '30px', minHeight: '30px',
                      padding: 0, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    }}
                  >
                    {autoPlay ? <Pause size={13} strokeWidth={1.75} /> : <Play size={13} strokeWidth={1.75} />}
                  </button>
                )}
              </div>
            )}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '1px', background: 'var(--border-default)', borderTop: '1px solid var(--border-default)',
            }}>
              <button type="button" aria-label="Kandungan sebelum" onClick={onPrev} disabled={!onPrev} style={{ ...navBtn, flexDirection: 'row', alignItems: 'center' }}>
                <ChevronUp size={16} strokeWidth={1.75} className="fv-nav-chevron fv-nav-chevron-up" style={{ flex: '0 0 auto' }} />
                {prevPreviewTitle && (
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontSize: '12px', color: 'var(--text-heading)', lineHeight: 1.3,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden',
                  }}>{prevPreviewTitle}</span>
                )}
              </button>
              <button type="button" aria-label="Kandungan seterusnya" onClick={onNext} disabled={!onNext} style={{ ...navBtn, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                {nextPreviewTitle && (
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontSize: '12px', color: 'var(--text-heading)', lineHeight: 1.3,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden',
                  }}>{nextPreviewTitle}</span>
                )}
                <ChevronDown size={16} strokeWidth={1.75} className="fv-nav-chevron fv-nav-chevron-down" style={{ flex: '0 0 auto' }} />
              </button>
            </div>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, overflow: 'hidden', background: 'var(--surface-page)', color: 'var(--text-body)', display: 'flex', flexDirection: 'column', userSelect: 'text', WebkitUserSelect: 'text' }}>
      {transitionOverlay}
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
        <span style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: '14px' }}>
          {/* Label teks "Rawak"/"Turutan"/"Auto" dibuang (2026-08-07, permintaan Izzat — "buang
              label rawak dan auto, kekalkan ikon sahaja") — ikon + title (tooltip hover) +
              aria-label (pembaca skrin) kekal cukup jelas tanpa teks kekal di sisi ikon. */}
          {onToggleNavMode && (
            <Tooltip text={navMode === 'rawak' ? 'Rawak' : 'Turutan'}>
              <button
                type="button" onClick={onToggleNavMode}
                aria-label={navMode === 'rawak' ? 'Tukar ke mod turutan' : 'Tukar ke mod rawak'}
                className="fv-icon-btn"
                style={{
                  display: 'inline-flex', alignItems: 'center', background: 'none', border: 0,
                  padding: 0, cursor: 'pointer', lineHeight: 1, color: 'var(--stone-400)',
                }}
              >
                {navMode === 'rawak' ? <Shuffle size={13} strokeWidth={1.75} /> : <ListOrdered size={13} strokeWidth={1.75} />}
              </button>
            </Tooltip>
          )}
          {onNext && (
            <Tooltip text={autoPlay ? 'Jeda' : 'Auto'}>
              <button
                type="button" onClick={() => setAutoPlay(p => !p)}
                aria-label={autoPlay ? 'Jeda tatal automatik' : 'Mainkan tatal automatik'}
                className="fv-icon-btn"
                style={{
                  display: 'inline-flex', alignItems: 'center', background: 'none', border: 0,
                  padding: 0, cursor: 'pointer', lineHeight: 1, color: 'var(--stone-400)',
                }}
              >
                {autoPlay ? <Pause size={13} strokeWidth={1.75} /> : <Play size={13} strokeWidth={1.75} />}
              </button>
            </Tooltip>
          )}
        </span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-18)', letterSpacing: 'var(--tracking-tight)', color: 'var(--color-Adjung-maroon)', justifySelf: 'center' }}>{wordmark}</span>
        {onClose && (
          <button {...closeProps} className="fv-icon-btn" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            justifySelf: 'end', background: 'none', border: 0, padding: 0, cursor: 'pointer', lineHeight: 1,
            color: closeLit ? 'var(--color-Adjung-maroon)' : 'var(--stone-400)',
            transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <X size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {onNext && (
        // Kekal mounted walau jeda — lihat nota sepadan di susun atur telefon di atas.
        <div key={`bar-${title}`} style={{ height: '2px', flex: '0 0 auto', width: '100%', background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--color-Adjung-maroon)', transformOrigin: 'left', animation: `focusAutoScrollBar ${AUTOSCROLL_MS}ms linear forwards`, animationPlayState: autoPlay ? 'running' : 'paused' }} />
        </div>
      )}
      <hr style={{ ...rule, flex: '0 0 auto' }} />

      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, boxSizing: 'border-box', padding: 'clamp(10px, 1.6vh, 18px) 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Helaian dipersempit (86%→64%, 2026-07-29) — lajur lebar penuh tidak tinggalkan margin
            cukup untuk nav penjuru (preview kandungan sebelum/selepas) duduk selesa tanpa sesak
            dengan kandungan utama. Disahkan terhadap mockup rujukan: helaian ~51-65% lebar
            viewport, margin kiri/kanan cukup luas untuk preview + anak panah. */}
        <div style={{
          width: 'min(74%, 1040px)', height: '100%', maxHeight: '100%', boxSizing: 'border-box',
          display: 'grid', gridTemplateRows: 'minmax(0, 1fr) minmax(140px, auto)',
        }}>

          {/* TAJUK + HURAIAN — dua lajur bersebelahan (2026-08-07, permintaan Izzat eksplisit,
              ikut mockup rujukan: tajuk lajur kiri statik rata kiri, huraian lajur kanan
              menatal). Gantikan susun atur satu-lajur menegak terdahulu (eyebrow/tajuk/huraian
              bertindan menegak, semua dipusatkan). Nisbah lajur ~5:7 (kasar 40/60) padan
              mockup. Sub-pembahagian dua-lajur huraian yang lama (duaLajur, dan jaring
              keselamatan pemusatan lajur tunggal yang menyertainya) turut dibuang — lajur kanan
              di sini sendiri dah cukup sempit (~60% x 74% lebar viewport) utk satu aliran teks
              rata kiri biasa; tak perlu dipecah/dipusatkan lagi. */}
          <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', columnGap: 'clamp(28px, 4vw, 56px)' }}>

            {/* Lajur kiri — eyebrow + tajuk, statik (tak menatal), rata kiri.
                `alignItems:'stretch'` (BUKAN 'flex-start', 2026-08-07) — dengan flex-start, anak
                flex (h1) saiz ikut kandungannya sendiri (fit-content), yang dlm sesetengah
                pelayar/susun atur bersarang grid+flex boleh jadi LEBIH LEBAR drpd trek grid
                (bukan dibalut pada sempadan lajur) — tajuk panjang jadi SATU BARIS melimpah lalu
                dipotong oleh `overflow:'hidden'` (kelihatan macam tajuk terpotong tengah-tengah,
                cth "Editorial Didahulu[kan]"), bukan patah baris macam sepatutnya. `stretch`
                paksa h1 ambil LEBAR PENUH lajur (trek grid tetap), jadi pembalutan teks berlaku
                pada sempadan lajur sebenar. `overflow:'hidden'` dikekalkan sbg jaring keselamatan
                lapisan kedua (permintaan Izzat — "jgn benarkan tajuk...menceroboh kolum milik yg
                lain") utk kes ekstrem satu perkataan tunggal lebih lebar drpd lajur. */}
            <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 'clamp(8px, 1.4vh, 14px)', paddingTop: 'clamp(28px, 5vh, 56px)' }}>
              {label && (
                <span key={`eyebrow-${title}`} style={{ ...micro, color: warnaEyebrow, fontWeight: 'var(--weight-bold)' as any }}>{eyebrowNodes}</span>
              )}
              {/* `title` mentah sengaja, BUKAN `titleRendered` (2026-08-07 — lajur tajuk kini
                  sempit ~40% lebar helaian, sama alasan telefon di atas: titleRendered sisipkan
                  pemenggalan suku kata/sengkang lembut yang jadi kelihatan sebagai "-" di tengah
                  perkataan bila lajur sempit, permintaan Izzat "jgn hypen tajuk". wordBreak/
                  overflowWrap 'normal' (bukan 'break-word') — biar tajuk patah HANYA di sempadan
                  perkataan, tak pernah potong tengah perkataan (cth "Dikem/udiankan"); ada cukup
                  ruang menegak di bawah tajuk utk baris tambahan, jadi tiada sebab paksa patah
                  tengah perkataan. `fv-tajuk-masuk` + `key={title}` (2026-08-17, Izzat) — pudar+
                  gelongsor masuk, replay setiap artikel bertukar (mata bergerak ikut hierarki:
                  bidang+topik > tajuk > huraian panjang). */}
              <h1 key={`tajuk-${title}`} ref={titleRef} className="fv-tajuk-masuk" style={{ margin: 0, minWidth: 0, fontFamily: 'var(--font-serif)', fontWeight: 'var(--weight-regular)' as any, fontSize: titleSize, lineHeight: 1.18, letterSpacing: 'var(--tracking-tight)', color: 'var(--text-heading)', textWrap: 'pretty', textAlign: 'left', hyphens: 'none', WebkitHyphens: 'none', wordBreak: 'normal', overflowWrap: 'normal' }}>{glosariDesktop.tajuk}</h1>
            </div>

            {/* Lajur kanan — huraian panjang, SATU-SATUNYA bahagian Focus View yang menatal. */}
            <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', paddingTop: 'clamp(28px, 5vh, 56px)' }}>
              <div ref={bodyRef} style={{ minHeight: 0, width: '100%', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', scrollbarWidth: 'none', paddingRight: 'clamp(8px, 1vw, 16px)', paddingBottom: 'clamp(16px, 2.6vh, 26px)', ...bodyFade }}>
                {paragraphs.length > 0 && (
                  <div key={`huraian-${title}`} className="fv-huraian-masuk" style={{ fontFamily: 'var(--font-serif)', fontSize: bodySize, fontWeight: 'var(--weight-regular)' as any, lineHeight: 1.75, color: 'var(--stone-600)', textWrap: 'pretty', textAlign: 'left', hyphens: 'none', WebkitHyphens: 'none' }}>
                    {paragraphs.map((para, j) => (
                      <p key={j} style={{ margin: j === 0 ? 0 : '1em 0 0' }}>{glosariDesktop.perenggan[j]}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* IMEJ + KANDUNGAN BERKAITAN — jalur di bawah huraian panjang, dua sub-lajur. Tinggi
              jalur ni minmax(140px, auto) (bukan tinggi tetap 2026-07-29) — SEKURANG-KURANGNYA
              140px dikhaskan supaya sentiasa ada ruang kelihatan untuk grafik/berkaitan walau
              kandungan tu tiada lagi (jawapan kepada "mana ruang utk kandungan berkaitan?"), tapi
              tumbuh melebihi 140px bila kandungan sebenar (2 item berkaitan + nota) perlukan lebih
              — supaya TIADA kotak scroll sendiri di sini. Baris huraian panjang (minmax(0,1fr)) di
              atas yang menyerap sisa ruang dan membawa SATU-SATUNYA kotak scroll di seluruh Focus
              View (permintaan eksplisit pemilik projek). */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 9fr)', columnGap: 'clamp(20px, 2.8vw, 40px)', alignItems: 'center', paddingTop: 'clamp(10px, 1.8vh, 18px)', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            {/* maxWidth 85% dibuang 2026-07-29 — sisa dari zaman "Kandungan Berkaitan"; preview
                Sebelum/Selepas kini sampai ke tepi kanan penuh kolum grid, sejajar tepi kanan
                tajuk/huraian panjang di atas (permintaan pemilik projek). */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.6vh, 16px)' }}>
              {/* Nota Editor DI ATAS preview Sebelum/Selepas (2026-08-07, permintaan Izzat) —
                  dahulu di bawah; susunan bertukar supaya nota (konteks editorial) dibaca dulu
                  sebelum pautan navigasi ke kandungan lain. */}
              {note && (
                <Tooltip text={note}>
                  <p style={{ margin: 0, paddingLeft: '12px', borderLeft: '2px solid var(--color-Adjung-maroon)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', lineHeight: 1.6, color: 'var(--stone-600)' }}>
                    <span style={{ color: 'var(--color-Adjung-maroon)', fontWeight: 'var(--weight-semibold)' as any }}>Nota: </span>{notaText}
                  </p>
                </Tooltip>
              )}

              {(prevPreviewTitle || nextPreviewTitle) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.4vh, 14px)' }}>
                  {prevPreviewTitle && (
                    <button
                      type="button" onClick={onPrev}
                      className="fv-nav-preview fv-nav-prev"
                      style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: '8px', background: 'none', border: 0, padding: 0, margin: 0, textAlign: 'left', cursor: onPrev ? 'pointer' : 'default' }}
                    >
                      <span className="fv-arrow" style={{ ...micro, textTransform: 'none' as any, fontSize: 'var(--text-11)', flex: '0 0 auto' }} aria-hidden="true">▲</span>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-13)', lineHeight: 1.4, color: 'var(--text-heading)' }}>{prevPreviewTitle}</span>
                    </button>
                  )}
                  {nextPreviewTitle && (
                    <button
                      type="button" onClick={onNext}
                      className="fv-nav-preview fv-nav-next"
                      style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: '8px', background: 'none', border: 0, padding: 0, margin: 0, textAlign: 'left', cursor: onNext ? 'pointer' : 'default' }}
                    >
                      <span className="fv-arrow" style={{ ...micro, textTransform: 'none' as any, fontSize: 'var(--text-11)', flex: '0 0 auto' }} aria-hidden="true">▼</span>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-13)', lineHeight: 1.4, color: 'var(--text-heading)' }}>{nextPreviewTitle}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* KOLOFON — sumber + tarikh sumber, editor + hubungan. Merentasi lebar PENUH viewport
          (sama corak macam MASTHEAD), TAPI "Sumber" sendiri dijajarkan dengan tepi kiri TAJUK
          (2026-07-29, permintaan pemilik projek) — bukan tepi kiri viewport. Dicapai dengan
          pembalut dalaman width:min(64%,900px) DIPUSATKAN, formula SAMA seperti helaian bacaan
          di atas, supaya kedua-duanya kekal sejajar pada sebarang lebar skrin tanpa perlu kira
          jidar secara manual. Editor kekal bucu kanan sebenar (posisi mutlak, tidak disentuh).
          `sourceDate` diterima di sini sudah dalam format Melayu panjang ("29 Julai 26") —
          pemanggil yang uruskan format, fail ni cuma papar apa yang diterima. */}
      <hr style={{ ...rule, flex: '0 0 auto' }} />
      <div style={{ position: 'relative', flex: '0 0 auto', width: '100%', boxSizing: 'border-box', padding: 'clamp(10px, 1.8vh, 18px) 0', display: 'flex', justifyContent: 'center' }}>
        {/* alignItems flex-end -> flex-start (2026-08-16) DAN flex -> grid 3-lajur (2026-08-17,
            susulan kritikal Izzat -- "butang kongsi mesti fix di tengah. sumber kalau banyak
            akan diwrap supaya tak kacau butang kongsi"). flex-start (2026-08-16) betulkan paksi
            MENEGAK (Sumber tumbuh ke bawah tanpa tarik Kongsi turun sekali), tapi paksi MENDATAR
            (justify-content:space-between) MASIH rosak -- lebar lajur Sumber SEBENAR berubah
            ikut berapa banyak/panjang sumber (walau dibalut flex-wrap dalamnya), jadi "ruang
            baki" yang space-between agih antara tiga lajur turut berubah, Kongsi (lajur tengah)
            jadi TERGESER kiri/kanan drpd tengah SEBENAR viewport bergantung lebar Sumber semasa
            itu -- disahkan Izzat via dua kandungan sebenar (3 sumber vs 1 sumber, Kongsi jelas
            tak sejajar). Grid 3-lajur (1fr auto 1fr) betulkan ni SEPENUHNYA: lajur tengah (Kongsi)
            lebar ikut kandungannya sahaja dan SENTIASA dipusatkan tepat pada tengah bekas, tak
            kira sebesar mana lajur kiri (Sumber, boleh wrap berbilang baris) atau kanan (Editor)
            membesar -- setiap lajur 1fr terpaksa berkongsi baki ruang SAMA RATA, jadi lajur
            tengah kekal di titik tengah geometri, bukan titik tengah "ruang baki". */}
        <div style={{ width: 'min(74%, 1040px)', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'flex-start', gap: '16px' }}>
          <span style={{ lineHeight: 1.5 }}>
            <span style={micro}>{sources.length > 1 ? 'Sumber-sumber' : 'Sumber'}</span>
            {/* Sumber berbilang (2026-08-05) — senaraikan SEMUA (`sources`), dipisah "|"; jatuh
                balik ke medan tunggal (`source`/`sourceUrl`) bila `sources` tiada (kandungan
                lama). Tarikh PER-sumber (2026-08-15) — SEBELUM NI cuma sumber PERTAMA (i===0)
                papar sourceDate dikongsi, sumber lain terus tiada tarikh langsung; kini setiap
                sumber papar s.date SENDIRI (jatuh balik ke sourceDate kongsi untuk sumber pertama
                sahaja, kandungan lama sebelum tarikh per-sumber wujud).
                Susun atur (2026-08-16, permintaan Izzat — "tak nak terus disusun bertingkat2")
                — SEBELUM NI setiap sumber `display:'block'` (satu per baris menegak, makin
                panjang makin tinggi senarai). Kini inline, dipisah "|", dalam kontena flex-wrap —
                sumber yang tak muat pada baris semasa turun ke baris bawah SEBAGAI SATU UNIT UTUH
                (whiteSpace:'nowrap' pada setiap unit sumber, BUKAN wordBreak:'break-all' macam
                dahulu) — elak "Sumber 2" terbelah jadi "Sumb"/"er 2" merentasi baris.
                Pemisah "|" HANYA antara sumber pada baris SAMA (2026-08-17, Izzat: "kalau dah
                wrap tak perlulah guna | utk memisahkan") — lihat SenaraiSumberDesktop() di atas
                fail ni utk mekanisme ukur offsetTop sebenar. */}
            {sources.length > 0 ? (
              <SenaraiSumberDesktop sources={sources} sourceDate={sourceDate} />
            ) : (
              <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', color: 'var(--stone-500)' }}>
                <a href={sourceUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--stone-500)', wordBreak: 'break-all' }}>{source || '—'}</a>
                {sourceDate && <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)' }}> · {sourceDate}</span>}
              </span>
            )}
          </span>
          {/* Kongsi (2026-08-05, Fasa 11) — sama syarat/komponen macam versi telefon di atas. */}
          {shareUrl && (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
              <span style={micro}>Kongsi</span>
              <KongsiButtons title={title} url={shareUrl} disalinBerjaya={disalinBerjaya} onSalin={salinPautan} />
            </span>
          )}
          {/* Lajur "Editor" (2026-08-16, permintaan Izzat — "seragamkan ketiga2 medan tu... yg
              kanan sepatutnya tulis Editor, nama, dan tarikh siaran") — SEBELUM ni cuma tarikh
              mentah tanpa label langsung, tak seragam dengan lajur Sumber/Kongsi yang
              kedua-duanya ada label kecil di atas kandungan. Kini label "Editor" + nama (bila
              editorName sedia, lihat nota prop) + tarikh siaran, corak sama macam "{nama} · {tarikh}"
              lajur Sumber. Label tetap "Editor" (bukan bersyarat) walaupun editorName tiada,
              supaya lajur ni still ada label seragam dgn 2 lajur lain -- kandungan bawahnya
              (tarikh sahaja) tetap papar. */}
          {publishedDate && (
            <span style={{ lineHeight: 1.5, textAlign: 'right' }}>
              <span style={{ ...micro, display: 'block' }}>Editor</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-11)', color: 'var(--stone-500)', whiteSpace: 'nowrap' }}>
                {editorName && <>{editorName}<span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)' }}> · </span></>}
                <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)' }}>{publishedDate}</span>
              </span>
            </span>
          )}
        </div>
      </div>

    </div>
  );
};
