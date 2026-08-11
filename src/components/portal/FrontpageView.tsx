import React, { useState, useEffect, useRef, useLayoutEffect, useContext, createContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { User, Entry, SystemSettings } from '../../types';
import { BRAND, LOGO_SIZE } from '../../config/brand';
import { parseInlineFormatting, isArabicText, parseInTheNews, getDeskAccentColor, parseWorldClockHolidays, safeParseInline, setGlosSelariAktif, setTypographyRulesAktif } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X, Lock, Search } from 'lucide-react';
import { ToastContainer, ToastMessage } from '../common/Toast';
import { renderMarkdownRingkas } from '../../lib/markdownRingkas';
import { penggalSukuKata } from '../../../core/editorial/PemenggalSukuKata.js';
import { TypographyRenderer, TypographyRule } from '../editorial/TypographyRenderer';
import { TypographyPreview } from '../editorial/TypographyPreview';
import { WorldClockStrip } from './WorldClockStrip';
import { BarCard } from './cards/BarCard';
import { BarCardExpandedPanel } from './cards/BarCardExpandedPanel';
import { KompakCardTeks } from './cards/KompakCardTeks';
import { Tooltip } from '../common/Tooltip';
import { FocusView } from './FocusView';
import { BidangIcon } from '../common/BidangIcon';
import { trackView } from '../../utils/trackView';

// safeParseInline (gloss/pemenggalan/autocondong bagi teks kad + Focus View) dipindah ke
// utils.tsx (2026-08-02, Fasa 8) — FocusView.tsx kini import terus fungsi SAMA (dulu tak
// diformat langsung), jadi ia perlu hidup di tempat yang kedua-dua fail boleh sampai tanpa
// import bulat (FrontpageView.tsx sendiri import FocusView.tsx). Bendera dalam-modul
// (glosSelariAktif/typographyRulesAktif) turut dipindah bersama — diselaraskan di sini via
// setGlosSelariAktif()/setTypographyRulesAktif() dalam useEffect (lihat berhampiran
// systemSettings/adjungTypographyRules di bawah).

// Saiz fon overlay skrin PENUH Ticker (2026-08-02) — `showNewsOverlay`, bila marquee Ticker
// diklik. BUKAN Focus View kad biasa (dua overlay berlainan, tak sama tetapan). Sebelum ni
// berkod keras (text-3xl md:text-5xl / text-lg md:text-xl), tiada tetapan admin langsung.
// Kunci pratetap ('S'/'M'/'L'/'XL'), BUKAN kelas Tailwind terus daripada DB — kelas Tailwind
// mesti hadir literal dalam source untuk JIT kompil betul, jadi peta ni satu-satunya tempat
// kelas sebenar ditulis. Lalai 'L'/'M' padan kelakuan sedia ada tepat (tiada perubahan
// kelakuan sehingga Ketua Editor sunting di Tetapan → Operasi).
export const TICKER_OVERLAY_TITLE_SIZE_CLASS: Record<string, string> = {
  S: 'text-2xl md:text-3xl',
  M: 'text-3xl md:text-4xl',
  L: 'text-3xl md:text-5xl',
  XL: 'text-4xl md:text-6xl',
};
// Huraian dikecilkan lagi (2026-08-05, permintaan Izzat — "boleh kecilkan lagi tak?", pusingan
// kedua selepas 16/18/20 masih besar) — nilai px eksplisit (bukan skala Tailwind text-base/lg/xl
// relatif) supaya tiga peringkat S/M/L konsisten tepat di telefon, tanpa bergantung pada tema
// Tailwind yang boleh berubah.
export const TICKER_OVERLAY_BRIEF_SIZE_CLASS: Record<string, string> = {
  S: 'text-[13px] md:text-[15px]',
  M: 'text-[14px] md:text-[16px]',
  L: 'text-[15px] md:text-[18px]',
};

const SESSION_SEED = Math.random();

const getHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

interface FrontpageViewProps {
  entries: Entry[];
  users: User[];
  systemSettings: SystemSettings;
  setSelectedEntry: (entry: Entry | null) => void;
  setSelectedAuthorId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  currentUser?: User | null;
  // Peranan Editorium (Ketua Editor / Editor), diangkat naik dari App.tsx — berasingan
  // daripada currentUser di atas (yang memang dead-code/KIV, lihat canCurate). Guna khusus
  // untuk kunci medan Bidang di Tetapan Slot kepada Ketua Editor sahaja.
  // undefined = belum log masuk (tiada sesi). Peraturan keras baharu (2026-07-29): tiada log
  // masuk = tiada akses edit langsung, termasuk butang "Edit Kandungan" di bawah.
  currentEditoriumRole?: 'KETUA_EDITOR' | 'EDITOR';
  // Identiti akaun yang LOG MASUK sebenar — cuma dihantar bila currentEditoriumRole ===
  // 'KETUA_EDITOR' DAN pengesahan sebenar berjaya. Dipaparkan sebagai tandatangan editor di
  // Focus View (kolofon bawah).
  currentEditoriumName?: string;
  currentEditoriumContact?: string;
  // Buka borang log masuk (dikongsi dengan Editorium, dimiliki App.tsx). `onSuccess` pilihan
  // dipanggil lepas log masuk berjaya (di sini: terus aktifkan mod edit).
  onRequestEditLogin?: (onSuccess?: () => void) => void;
  onLogout?: () => void;
  inTheNewsGoogleDocText?: string;
  worldClockHolidaysGoogleDocText?: string;
  // Pautan mendalam per-kandungan (Fasa 9, 2026-08-05) — kod pendek daripada URL
  // /:bidangSlug/kandungan/:kodPendek (App.tsx). Bila dibekalkan, Focus View kandungan berkenaan
  // dibuka automatik semasa mount (satu kali sahaja, lihat useEffect di bawah) — supaya pautan
  // dikongsi (RSS/sitemap/media sosial) benar-benar bawa pembaca terus ke kandungan tu, bukan
  // muka depan kosong. Kod tak sah (404) — tiada apa berlaku, pembaca lihat muka depan biasa.
  deepLinkKodPendek?: string;
}

export function HoverWords({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const words = text.split(/(\s+)/);
  return (
    <span className={className}>
      {words.map((w, idx) => {
        if (/\s+/.test(w)) return w;
        const isMaroon = className?.includes('text-Adjung-maroon') || className?.includes('text-[#7B2737]') || className?.includes('text-[#802334]');
        const hoverClass = isMaroon
          ? 'hover:text-stone-900 transition-colors duration-150 cursor-default'
          : 'hover:text-Adjung-maroon transition-colors duration-150 cursor-default';

        let content: React.ReactNode = w;
        if (/^\*\*(.+)\*\*$/.test(w) || /^__(.+)__$/.test(w)) {
          const inner = w.replace(/^\*\*|__|\*\*|__$/g, '');
          content = <strong className="font-bold text-[#111111]">{inner}</strong>;
        } else if (/^\*(.+)\*$/.test(w) || /^_(.+)_$/.test(w)) {
          const inner = w.replace(/^[*_]|[*_]$/g, '');
          content = <em className="italic">{inner}</em>;
        }

        return (
          <span key={idx} className={hoverClass}>
            {content}
          </span>
        );
      })}
    </span>
  );
}

export const formatBentoDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Tarikh siaran (bila kandungan disimpan ke Adjung) — DD.MM.YY, ditunjuk di bucu kad, sengaja
// berbeza format daripada tarikh sumber (formatBentoDate) supaya kedua-dua tarikh tidak keliru.
export const formatSiaranDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
};

// Tarikh sumber/asal dipaparkan PERSIS seperti ditaip (cth "1980", "20 Julai 2026") — tidak
// dihurai semula sebagai Date, supaya tarikh separa/tahun sahaja (rujukan lama/tesis) tidak
// hilang atau jadi "Invalid Date". "Tidak dinyatakan"/kosong terus disembunyikan.
//
// KECUALI corak ISO yyyy-mm-dd (2026-08-07, pepijat PRODUCTION sebenar Izzat — kad RTM papar
// "2026-08-07" mentah, bukan "7 Ogo 2026") — medan "Tarikh sumber" di SlotManagerModal.tsx kini
// <input type="date">, jadi nilai BAHARU sentiasa ISO, bukan lagi teks bebas macam sebelum ni.
// Fungsi ni dipakai di ~30 tempat merentasi SEMUA kad bento (bukan cuma Focus View, yang sudah
// dibetulkan berasingan di formatTarikhSumberPanjang) — tanpa pengecualian ni, SETIAP kad yang
// tarikh sumbernya diisi guna kalendar baharu akan papar ISO mentah selama-lamanya.
export const getDisplayDate = (raw?: string): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'tidak dinyatakan') return '';
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return trimmed;
};

const MALAY_MONTHS = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
];

// Focus View sahaja: tarikh sumber gaya Melayu panjang ("29 Julai 26") bukan format mentah biasa.
// Terima DUA corak: ISO yyyy-mm-dd (2026-08-07, medan "Tarikh sumber" di SlotManagerModal.tsx kini
// <input type="date">, jadi ni format SEBENAR nilai baharu) dan DD.MM.YY legasi (kandungan lama
// ditaip sebelum pemetik kalendar wujud). Tak padan mana-mana (teks bebas lama lain) — jatuh balik
// ke getDisplayDate() tidak disentuh, ikut falsafah sama: jangan hilangkan/rosakkan tarikh separa.
const formatTarikhSumberPanjang = (raw?: string): string => {
  const trimmed = getDisplayDate(raw);
  if (!trimmed) return '';
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    const monthName = MALAY_MONTHS[parseInt(mm, 10) - 1];
    return monthName ? `${parseInt(dd, 10)} ${monthName} ${yyyy}` : trimmed;
  }
  const legasi = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!legasi) return trimmed;
  const [, dd, mm, yy] = legasi;
  const monthName = MALAY_MONTHS[parseInt(mm, 10) - 1];
  if (!monthName) return trimmed;
  return `${parseInt(dd, 10)} ${monthName} ${yy}`;
};

// Label kad awam: "Bidang | Topik". Kandungan lama tanpa Topik papar Bidang sahaja (tiada backfill).
// Format sebenar datang dari eyebrowLabel() di GeometryConfig.js — sumber yang SAMA digunakan oleh
// validateBidangTopik() semasa simpan (had aksara eyebrow). EyebrowKad (bawah) render desk/topik
// sebagai DUA segmen boleh klik berasingan (2026-08-07, ciri cari), jadi ia tak panggil
// eyebrowLabel() untuk paparan lagi (perlukan bahagian berasingan bagi setiap zon klik) — tapi
// nilai mentah setiap segmen tetap terus dari `item.desk`/`item.topik`, pemisah " | " tulisan
// literal yang sama seperti yang eyebrowLabel() sendiri guna, bukan logik format baharu.
// eyebrowLabel() kekal SUMBER TUNGGAL untuk had aksara/pengesahan simpan — tak disentuh.

// ---------------------------------------------------------------------------------------------
// EYEBROW KAD: IKON MENGGANTIKAN NAMA BIDANG — PERCUBAAN
//
// Tukar suis ini kepada false untuk kembali kepada label teks penuh ("MALAYSIANA | Percubaan").
// Satu tempat, satu baris — sengaja, kerana ini percubaan reka bentuk dan bukan keputusan muktamad.
//
// Yang ditukar: nama Bidang digantikan glif Bidang; Topik kekal sebagai teks. Kalau kandungan tiada
// Topik, nama Bidang dipapar seperti biasa — kalau tidak eyebrow jadi ikon berseorangan tanpa
// sebarang perkataan, dan pembaca langsung tiada petunjuk.
//
// Ikon mewarisi currentColor, jadi ia mengambil warna Bidang daripada deskStyle secara automatik.
const EYEBROW_GUNA_IKON = true;

// Ikon eyebrow untuk kandungan PEMEGANG TEMPAT (2026-08-10). Semua placeholder menerangkan Adjung
// Brief itu sendiri, jadi memakai ikon Bidang sebenar (Malaysiana/Sains/Ekonomi dsb) akan memberi
// konteks PALSU kepada dataset. Sebaliknya guna simbol rasmi Adjung — segi empat tegak nisbah 1:2,
// sudut 0px, Sistem Identiti Visual Adjung v1.0, sama seperti public/adjung-symbol.svg.
//
// fill="currentColor" (BUKAN #802334 seperti fail asal): supaya ikon mewarisi warna daripada
// deskStyle PERSIS seperti ikon Bidang sebenar. Tujuan dataset ini ialah menguji mekanisme ikon
// production, bukan memperkenalkan warna khas placeholder — kalau warna ikon Bidang berubah
// kemudian, placeholder ikut secara automatik tanpa perlu dikecualikan.
//
// Markup ni PEMALAR SUMBER, bukan input pengguna, jadi ia tidak melalui sanitizeSvgIcon di server
// (yang menapis SVG dimuat naik ke DB). Jangan jadikan laluan ni titik masuk SVG dinamik.
const IKON_PLACEHOLDER_ADJUNG = {
  icon: null,
  iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"><rect width="40" height="80" fill="currentColor"/></svg>',
};

export const EyebrowKad: React.FC<{
  item: { desk?: string; topik?: string };
  bidang?: { icon: string | null; iconSvg: string | null };
  saiz?: number;
  /** Cari Bidang/Topik (2026-08-07, permintaan Izzat — "boleh ke kalau klik topik automatik akan
   *  search topik tu di kotak search", disahkan "dua2 la kot" untuk Bidang SEKALI). Dipanggil
   *  dengan nilai mentah (desk ATAU topik) bila salah satu segmen diklik; `undefined` = eyebrow
   *  papar sahaja, tiada kesan klik (jatuh balik selamat untuk pemanggil yang belum sambung
   *  carian). */
  onCari?: (nilai: string) => void;
}> = ({ item, bidang, saiz = 11, onCari }) => {
  const desk = (item.desk || '').trim();
  const topik = (item.topik || '').trim();
  const bolehGunaIkon = EYEBROW_GUNA_IKON && !!bidang && !!topik;

  // Setiap segmen boleh klik SENDIRI (desk dan topik berasingan) — stopPropagation elak klik
  // turut membuka kad/Focus View (eyebrow bersarang dalam kad yang sendiri boleh diklik).
  // role="button"+tabIndex+onKeyDown: segmen ni span, bukan <button>, supaya kekal padan
  // struktur eyebrow sedia ada (flex-item tunggal, lihat nota "blockify" di bawah) — tapi tetap
  // boleh dicapai papan kekunci.
  const propsKlik = (nilai: string) => onCari && nilai ? {
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onCari(nilai); },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onCari(nilai); }
    },
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `Cari "${nilai}"`,
    style: { cursor: 'pointer' },
  } : {};

  // Struktur SATU bentuk untuk kedua-dua kes (ada ikon / tiada ikon) supaya CSS telefon boleh
  // susun semula tanpa perlu tahu kes mana — desktop kekal baris sebaris (ikon + topik
  // bersebelahan, slot ikon kosong disembunyikan supaya rupa lama tak berubah langsung),
  // telefon tindan menegak (ikon atas, topik bawah) dengan slot ikon SENTIASA mengambil ruang
  // walau kosong (permintaan Izzat: "yang belum ada ikon, reservekan ruang untuk icon") supaya
  // baris topik semua kad sejajar sama tinggi.
  //
  // Tiada pemisah "|" apabila ikon dipakai: pemisah wujud untuk memisahkan DUA perkataan. Ikon
  // dan perkataan sudah terpisah secara visual, jadi "|" cuma bunyi bising. Pemisah " | " di
  // bawah (bila TIADA ikon, dua segmen teks) sengaja ditulis terus di sini — ia CUMA rentetan
  // pemisah paparan, bukan pengiraan had aksara (itu kekal tunggal di eyebrowLabel()/
  // GeometryConfig.js, tak disentuh); nilai sebenar SETIAP segmen (desk/topik) tetap mentah
  // terus dari `item`, tiada logik format baharu ditulis semula di sini. */}
  return (
    <span className="eyebrow-kad" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span
        className="eyebrow-ikon"
        style={{ display: 'inline-flex', alignItems: 'center', width: saiz, height: saiz, flexShrink: 0, ...(bolehGunaIkon ? propsKlik(desk).style : {}) }}
        {...(bolehGunaIkon ? propsKlik(desk) : {})}
      >
        {bolehGunaIkon && (
          <BidangIcon
            iconName={bidang!.icon}
            iconSvg={bidang!.iconSvg}
            color="currentColor"
            variant="bare"
            size={saiz}
            title={desk || undefined}
          />
        )}
      </span>
      {/* `eyebrow-topik` anak TERUS bekas flex (`eyebrow-kad`, display:inline-flex) — CSS
          "blockify" flex-item menjadikannya SATU kotak blok untuk susun atur, bukan inline
          biasa, jadi teknik garis-bawah-tumbuh (index.css) yang perlukan inline SEBENAR
          (hormati lebar setiap baris teks berbalut) mesti kena pada span DALAMAN
          `eyebrow-topik-teks` — bukan `eyebrow-topik` sendiri (2026-08-05, dibetulkan selepas
          garis nampak melintasi lebar penuh kotak, bukan lebar perkataan). Dua span
          `eyebrow-topik-teks` (desk+topik) kekal DALAM `eyebrow-topik` yang sama apabila tiada
          ikon — masih anak-anak tak-terus flex, jadi animasi garis-bawah tumbuh kekal terpakai
          pada kedua-duanya (2026-08-07). */}
      <span className="eyebrow-topik">
        {bolehGunaIkon ? (
          <span className="eyebrow-topik-teks" {...propsKlik(topik)}>{topik}</span>
        ) : (
          <>
            <span className="eyebrow-topik-teks" {...propsKlik(desk)}>{desk}</span>
            {topik && <>{' | '}<span className="eyebrow-topik-teks" {...propsKlik(topik)}>{topik}</span></>}
          </>
        )}
      </span>
      {/* Nama Bidang kekal untuk pembaca skrin: ikon sahaja tidak membawa maksud tanpa dilihat. */}
      {bolehGunaIkon && <span className="sr-only">{desk}</span>}
    </span>
  );
};

export const BentoInner: React.FC<{ itemKey: string; className?: string; aiProvider?: string; children: React.ReactNode }> = ({ itemKey, className = '', aiProvider, children }) => {
  // JARING KECEMASAN LIMPAHAN (2026-07-31, permintaan pemilik projek).
  //
  // Pertahanan utama kekal di peringkat SIMPAN — validateContentBudget() menolak kandungan yang
  // tak muat, dan had tiernya diukur pada kad sebenar. Ini lapisan terakhir sahaja: kalau sesuatu
  // tetap melimpah (fon belum dimuat turun sepenuhnya, pindaan had terlalu longgar, kandungan
  // lama sebelum had diketatkan), teks tidak dibiarkan terkeluar merosakkan susun atur bento.
  //
  // Ia TIDAK mengubah kandungan tersimpan dan TIDAK memotong teks secara mekanikal — ia cuma
  // mengelip paparan dan menandakan ada teks tersembunyi. Limpahan dikesan dengan UKURAN sebenar
  // (scrollHeight lawan clientHeight), bukan diteka daripada kiraan aksara.
  //
  // KEPUTUSAN PEMILIK PROJEK (2026-07-31): pada kelompok yang barisan gridnya bersaiz AUTO, kad
  // membesar sedikit mengikut kandungan dan bukannya mengelip — jaring ni tidak menyala di situ.
  // Itu DITERIMA sebagai kes khas untuk limpahan yang tak sengaja. JANGAN "baiki" dengan mengunci
  // max-height per-tier: kad yang mengembang sedikit lebih baik daripada ayat editor yang hilang.
  const rujukKotak = useRef<HTMLDivElement | null>(null);
  const [terlimpah, setTerlimpah] = useState(false);

  useLayoutEffect(() => {
    const el = rujukKotak.current;
    if (!el) return;
    // Ambang 8px, bukan 1px: pembundaran susun atur kerap menghasilkan lebihan 1-3px pada kad
    // yang sebenarnya elok. Limpahan SEBENAR bermakna sekurang-kurangnya satu baris teks tambahan
    // (~18px ke atas), jadi ambang ini menapis positif palsu tanpa terlepas limpahan sebenar.
    const semak = () => setTerlimpah(el.scrollHeight > el.clientHeight + 8);
    semak();
    const pemerhati = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(semak) : null;
    pemerhati?.observe(el);
    window.addEventListener('resize', semak);
    // Fon web (Source Serif 4, index.css:1) dimuat guna display:swap — teks boleh reflow SELEPAS
    // pengukuran awal di atas siap. ResizeObserver cuma perhati saiz KOTAK elemen, bukan reflow
    // kandungan dalaman, jadi limpahan akibat font swap lewat tak pernah diukur semula tanpa ni.
    let dibatal = false;
    document.fonts?.ready?.then(() => { if (!dibatal) semak(); });
    return () => { dibatal = true; pemerhati?.disconnect(); window.removeEventListener('resize', semak); };
  }, [itemKey, children]);

  let providerName = aiProvider;
  if (providerName) {
    if (providerName.startsWith('Google ')) providerName = providerName.replace('Google ', '');
    if (providerName.includes(' (')) providerName = providerName.split(' (')[0];
  }
  return (
    <div
      ref={rujukKotak}
      data-bento-inner=""
      className={`w-full flex-1 min-h-0 relative flex flex-col justify-between overflow-hidden${terlimpah ? ' kad-limpah' : ''}`}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={itemKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, position: 'absolute' }}
          transition={{ duration: 1.0, ease: 'easeInOut' }}
          className={`w-full h-full flex-1 flex flex-col ${className}`}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      {providerName && (
        <span className="absolute bottom-0 right-0 font-mono text-[8px] opacity-40 pointer-events-none select-none">
          {providerName}
        </span>
      )}
    </div>
  );
};



// Jenis animasi transisi carousel (Fasa 7, 2026-08-04) — dibekalkan oleh FrontpageView sekali di
// peringkat atas (satu fetch /api/system/slot-am-settings), dibaca di sini via Context supaya
// TIDAK perlu ubah 30 tapak panggilan CarouselStableBlock sedia ada satu-satu (struktur JSX
// renderItem/carousel projek ni sangat fragile — lihat nota Fasa 7/CLAUDE.md — Context elak
// sentuh struktur tu langsung). Lalai 'pudar' (kelakuan sedia ada) kalau Provider tiada.
// Giliran logo Adjung/penaja dalam panel transisi (2026-08-05, permintaan Izzat: "penaja mungkin
// lebih daripada satu, jadi semua ni boleh dilaraskan oleh Ketua Editor") — GANTIKAN logoPenaja
// (satu logo manual GLOBAL, Fasa 7) dengan giliran automatik antara logo Adjung dan penaja SEBENAR
// (jadual `sponsors`, medan tayangSemasaTransisi). `jenis: 'adjung'` = papar wordmark Adjung
// (LogoTransisiAdjung di bawah, bukan imej — sama sebab macam LoadingScreen: logo PNG marun-atas-
// putih tak boleh dibaca atas panel gelap).
interface LogoTransisi {
  jenis: 'adjung' | 'penaja' | 'tiada';
  logoUrl?: string;
  nama?: string;
}
interface TetapanAnimasiCarousel {
  jenisAnimasi: string;
  arahAnimasi: string;
  warnaPanelTransisi: string;
  ambilLogoTransisi: (mod?: string) => LogoTransisi;
  // Arah PER-SLOT (2026-08-05, permintaan Izzat: "boleh ke nak pilih arah tertentu utk slot
  // tertentu sahaja?") — override slots_config.arahOverride (kini ditetapkan di Senarai Slot,
  // lihat nota jenisAnimasiUntukSlot di bawah utk sebab pertukaran lokasi) MENGATASI arahAnimasi
  // global untuk slot tu sahaja. slotIndexStr datang terus dari atribut DOM `data-slot`
  // (rentetan) — lihat kadPenuhStabil di CarouselStableBlock.
  arahUntukSlot: (slotIndexStr: string | null | undefined) => string;
  // Jenis animasi PER-SLOT (2026-08-07, permintaan Izzat: "benarkan ketua editor tetapkan
  // animasi... berlainan utk setiap slot, cth slot 1 guna animasi A, slot 2 guna animasi B1")
  // — override slots_config.jenisAnimasiOverride, ditetapkan di Senarai Slot → Tetapan Kad
  // (BUKAN Tetapan Am Slot — permintaan eksplisit Izzat supaya tetapan per-slot dan tetapan am
  // tak bercampur). '' = guna jenisAnimasi global (lalai/fallback) di atas.
  jenisAnimasiUntukSlot: (slotIndexStr: string | null | undefined) => string;
  // Togol aktif/nyahaktif global (2026-08-07, permintaan Izzat: "Tetapan Am hanya utk
  // mengaktifkan/menyahaktifkan pilihan animasi") — bila false, SEMUA slot paksa "pudar"
  // (kelakuan asal tanpa panel) tak kira pilihan jenis per-slot/global.
  animasiAktif: boolean;
  // Kelajuan (2026-08-07, permintaan Izzat: "tetapan am seperti kelajuan") — pendarab tempoh
  // animasi, 1 = lalai. Terpakai pada Colophon/Sapuan Lajur (masukMasa/tahanMasa) dan Gerak
  // Susun (tempoh gerak) sama rata.
  kelajuanAnimasi: number;
  // Tiga penyelesai PER-SLOT tambahan (2026-08-07, Pelan 03 — arahan Izzat: "saya nak frontpage
  // tidak membosankan", warna/kelajuan/logo boleh berbeza setiap slot). Cermin corak
  // arahUntukSlot/jenisAnimasiUntukSlot di atas: '' dalam slots_config = ikut tetapan am.
  warnaPanelUntukSlot: (slotIndexStr: string | null | undefined) => string;
  kelajuanUntukSlot: (slotIndexStr: string | null | undefined) => number;
  // 'adjung' | 'penaja' | 'tiada' | '' ('' = ikut giliran am nisbahPenajaTransisi).
  logoModeUntukSlot: (slotIndexStr: string | null | undefined) => string;
}
const LALAI_TETAPAN_ANIMASI: TetapanAnimasiCarousel = {
  jenisAnimasi: 'colophon',
  arahAnimasi: 'kanan',
  warnaPanelTransisi: '#802334',
  ambilLogoTransisi: () => ({ jenis: 'adjung' }),
  arahUntukSlot: () => 'kanan',
  jenisAnimasiUntukSlot: () => 'colophon',
  animasiAktif: true,
  kelajuanAnimasi: 1,
  warnaPanelUntukSlot: () => '#802334',
  kelajuanUntukSlot: () => 1,
  logoModeUntukSlot: () => '',
};
const JenisAnimasiContext = createContext<TetapanAnimasiCarousel>(LALAI_TETAPAN_ANIMASI);

// Wordmark Adjung untuk panel transisi (2026-08-05) — versi ringkas struktur/nisbah SAMA seperti
// LoadingScreen.tsx (yang dah dibetulkan 2026-08-05 supaya sepadan lockup rasmi), diskalakan lebih
// kecil untuk muat dalam panel carousel (bukan skrin penuh). Teks (bukan imej PNG) atas sebab sama
// — logo rasmi marun-atas-putih tak boleh dibaca atas panel gelap.
const LogoTransisiAdjung: React.FC = () => (
  <div className="flex flex-col items-center justify-center select-none">
    <span className="font-serif font-normal tracking-tight text-2xl text-[#FDFDFD]">{BRAND.logoText}</span>
    <div className="flex items-center justify-center gap-1.5 mt-1">
      <div className="h-px bg-[#FDFDFD]/40 w-4" />
      <span className="font-sans text-[7px] tracking-[0.25em] font-semibold text-[#FDFDFD]/70 uppercase">{BRAND.subLabel}</span>
      <div className="h-px bg-[#FDFDFD]/40 w-4" />
    </div>
  </div>
);

// Vektor arah panel Colophon/Sapuan Lajur (2026-08-05, permintaan Izzat) — panel MASUK dari arah
// dipilih, KELUAR ke arah BERTENTANGAN (sapuan semula jadi). `songsangArah` bagi Sapuan Lajur arah
// LAWAN drpd `arahAnimasi` sebenar supaya dua jenis animasi ni kekal kelihatan berbeza antara satu
// sama lain (bukan Colophon perlahan) — sepadan kelakuan asal (dahulu arah dikunci kod, bukan
// tetapan; sekarang boleh tetap, tapi hubungan bertentangan dikekalkan).
const VEKTOR_ARAH: Record<string, { masuk: string; keluar: string }> = {
  kanan: { masuk: 'translateX(100%)', keluar: 'translateX(-100%)' },
  kiri: { masuk: 'translateX(-100%)', keluar: 'translateX(100%)' },
  atas: { masuk: 'translateY(-100%)', keluar: 'translateY(100%)' },
  bawah: { masuk: 'translateY(100%)', keluar: 'translateY(-100%)' },
};
const SONGSANG_ARAH: Record<string, string> = { kanan: 'kiri', kiri: 'kanan', atas: 'bawah', bawah: 'atas' };
const vektorArahOverlay = (arah: string, songsang: boolean) => {
  const arahSebenar = songsang ? (SONGSANG_ARAH[arah] || 'kiri') : arah;
  const v = VEKTOR_ARAH[arahSebenar] || VEKTOR_ARAH.kanan;
  return { '--transisi-masuk': v.masuk, '--transisi-keluar': v.keluar } as React.CSSProperties;
};

// Locks a carousel card's height to whatever its longest rotating item actually needs — without
// ever truncating anything. All items are stacked in the same grid cell (visibility:hidden still
// takes up layout space, unlike display:none), so the browser's own layout engine computes the
// container height as the max of every item's natural height. This recalculates automatically on
// every reflow (window resize, breakpoint change, font load) with zero JS measurement/resize
// listeners needed — the same mechanism transparently gives each breakpoint its own correct max,
// since text wraps differently at different widths.
const CarouselStableBlock: React.FC<{
  items: any[];
  activeIndex: number;
  renderItem: (item: any) => React.ReactNode;
  onNavigate?: (direction: 1 | -1) => void;
}> = ({ items, activeIndex, renderItem, onNavigate }) => {
  const { jenisAnimasi, warnaPanelTransisi, ambilLogoTransisi, arahUntukSlot, jenisAnimasiUntukSlot, animasiAktif, kelajuanAnimasi, warnaPanelUntukSlot, kelajuanUntukSlot, logoModeUntukSlot } = useContext(JenisAnimasiContext);
  // Logo dipetik SEKALI setiap kali transisi bermula (bukan setiap render) — kalau dipanggil
  // ambilLogoTransisi() terus dalam JSX, ia maju giliran pada SETIAP render (banyak kali sepanjang
  // 1.3s/1.6s animasi), bukan sekali setiap pertukaran kandungan.
  const [logoTransisiSemasa, setLogoTransisiSemasa] = useState<LogoTransisi>({ jenis: 'adjung' });
  const list = items && items.length > 0 ? items : [{}];
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Rujukan bekas SENDIRI (kawasan tajuk+huraian sahaja) — dipakai untuk cari kad PENUH sebenar
  // (data-slot terdekat, dilukis oleh pemanggil di LUAR komponen ni sepenuhnya, lihat 30 tapak
  // panggilan CarouselStableBlock) supaya overlay animasi liputi SELURUH kad (border/badge/
  // footer sumber sekali), bukan cuma kawasan kecil tajuk+huraian dalaman.
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Sasaran Portal STABIL (2026-08-04) — ditemui SEKALI semasa lekap (bukan cuma semasa animasi
  // macam `portalTarget` overlay di bawah), dipakai untuk navigasi (anak panah + dot). Izzat
  // tangkap dua kali: anak panah "terpotong" (terhad dalam kawasan teks kecil) dan dot "duduk
  // di tengah-tengah kad" (bukan di footer) — sebab kedua-dua tadinya diletak relatif kepada
  // bekas KECIL ni sendiri, bukan kad PENUH. Portal ke kad penuh (data-slot terdekat) betulkan
  // kedua-duanya sekali gus.
  const [kadPenuhStabil, setKadPenuhStabil] = useState<HTMLElement | null>(null);
  // Callback ref (BUKAN useEffect(fn, [])) — kad ni SATU instance React yang sama merentasi
  // pertukaran data (cth carousel mula-mula 1 item [pulang awal, TIADA <div ref>], lepas tu
  // data tiba jadi >1 item [<div ref> baru muncul]). useEffect(fn, []) cuma jalan SEKALI pada
  // commit PERTAMA — kalau commit pertama tu laluan 1-item (containerRef tak pernah melekap),
  // kadPenuhStabil terperangkap `null` SELAMANYA walaupun carousel sebenar muncul kemudian
  // (punca sebenar butang/dot terus tak muncul, Izzat tangkap 2026-08-04). Callback ref jalan
  // SETIAP kali elemen benar-benar melekap/tanggal — tiada masalah pemasaan macam ni.
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    if (!el) return;
    const kad = (el.closest('[data-slot]') as HTMLElement | null) || el;
    if (getComputedStyle(kad).position === 'static') {
      kad.style.position = 'relative';
    }
    // Ruang tempahan untuk titik carousel (2026-08-08, pepijat Izzat) — titik dot dilukis via
    // Portal terus ke kad PENUH ni sendiri dengan `position:absolute bottom-1.5` (di bawah,
    // bukan sebahagian aliran biasa — sengaja, lihat nota Portal di atas), supaya ia sentiasa
    // duduk di footer kad tak kira berapa banyak kandungan lain dalam kad. Tapi sebab tu jugak
    // ia TAK PERNAH mengambil ruang sendiri: kad hero yang mengembang penuh (tajuk+huraian
    // panjang, tepat sehingga tepi bawah kotak yang dikira daripada TEKS sahaja) biarkan baris
    // teks terakhir rapat/bertindih dengan titik carousel — tiada margin dikira untuknya. Padding
    // bawah tetap di sini (bukan ubah struktur carousel yang fragile) tempah ruang kekal untuk
    // titik, jadi kad sentiasa ada jurang minimum tak kira panjang kandungan.
    if (list.length > 1 && onNavigate && !kad.dataset.ruangDot) {
      kad.dataset.ruangDot = '1';
      const pbSediaAda = getComputedStyle(kad).paddingBottom;
      kad.style.paddingBottom = `calc(${pbSediaAda} + 14px)`;
    }
    setKadPenuhStabil(kad);
  }, [list.length, onNavigate]);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  // Leret (swipe) tangan — hanya bertindak balas leret yang cukup mendatar (elak konflik dengan
  // skrol menegak biasa halaman) dan cukup jauh (elak leret tak sengaja yang kecil).
  const sentuhMula = useRef<{ x: number; y: number } | null>(null);
  const kendaliSentuhMula = (e: React.TouchEvent) => {
    const t = e.touches[0];
    sentuhMula.current = { x: t.clientX, y: t.clientY };
  };
  const kendaliSentuhTamat = (e: React.TouchEvent) => {
    if (!sentuhMula.current || !onNavigate) return;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - sentuhMula.current.x;
    const deltaY = t.clientY - sentuhMula.current.y;
    sentuhMula.current = null;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 45) {
      onNavigate(deltaX < 0 ? 1 : -1);
    }
  };
  // Content fingerprint (not the array reference, which can churn on every poll even when the
  // underlying text hasn't changed) — only remeasure when what's actually rendered could differ.
  const contentKey = list.map((it) => `${it.title || ''}|${it.brief || ''}|${it.topik || ''}`).join(' ');

  // CSS Grid's "stack everything in one cell, size to the tallest" trick (col-start-1/row-start-1
  // + opacity toggle) is the ideal way to do this declaratively, but empirically the grid track's
  // auto-size recalculation is unreliable while an opacity CSS transition is actively running on
  // the stacked children — verified live: all N stacked items intermittently report the SAME
  // wrong height in sync with each other, then correct themselves, with no change in viewport
  // width or content. Measuring each item's natural height in JS and pinning min-height explicitly
  // sidesteps that browser-timing quirk entirely instead of depending on implicit grid sizing.
  //
  // A single measurement pass isn't enough either: for flex-row card layouts (source-as-side-column
  // cards), the content column's available width can still be settling (flex-basis negotiation
  // against the sibling source column) at the moment this effect first runs, so text can measure
  // as wrapping into fewer lines than it will once layout truly settles — under-measuring the real
  // max. A ResizeObserver on every stacked item catches that (and font loads, and window resizes)
  // generically, and the max only ever grows, never shrinks, once observed — it never "forgets" a
  // real max height it already saw.
  useLayoutEffect(() => {
    if (list.length <= 1) return;
    let maxSeen = 0;
    const recompute = () => {
      const heights = itemRefs.current.map((el) => (el ? el.scrollHeight : 0));
      const max = Math.max(0, ...heights);
      if (max > maxSeen) {
        maxSeen = max;
        setMaxHeight(max);
      }
    };
    recompute();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => recompute()) : null;
    itemRefs.current.forEach((el) => { if (el && observer) observer.observe(el); });

    return () => {
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, list.length]);

  // Jenis animasi transisi bukan-pudar (Colophon/Sapuan Lajur) — `visualIndex` SENGAJA lag di
  // belakang `activeIndex` sehingga overlay tutup penuh stage, supaya pertukaran opacity kad
  // sebenar (yang jadi asas kunci tinggi di atas) berlaku semasa tersembunyi, tak pernah kelihatan
  // sebagai potongan mendadak. 'pudar' (lalai) terus guna activeIndex macam sedia ada — tiada
  // overlay, tiada lag, kelakuan asal 100% tak berubah.
  const [visualIndex, setVisualIndex] = useState(activeIndex);
  // BOOLEAN sahaja (2026-08-04, kemas kini kedua — bukan lagi 'masuk'/'keluar' dua fasa) —
  // elemen overlay yang SAMA kekal dari mula ke akhir animasi (satu @keyframes berterusan,
  // lihat src/index.css), langsung tiada tukar className/remount di tengah jalan yang boleh
  // bawa risiko kelip walaupun dgn `key` paksa React (percubaan pertama masih kelip).
  const [overlayAktif, setOverlayAktif] = useState(false);
  // Sasaran Portal — KAD PENUH (data-slot terdekat), bukan snapshot koordinat. Overlay dirender
  // TERUS di dalam elemen kad sebenar ni (position:absolute inset-0 terhadapnya), jadi ia
  // bergerak SAMA dengan kad secara automatik kalau kad tu anjak (cth carousel lain berdekatan
  // ubah tinggi serentak semasa auto-putar) — position:fixed + koordinat snapshot (percubaan
  // pertama) "terapung" berasingan bila ini berlaku sebab koordinat viewport dibeku sekali sahaja
  // (ditangkap Izzat 2026-08-04: "bukan animasi transisi, kotak yang bergerak").
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const prevActiveIndexRef = useRef(activeIndex);
  const overlayTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Gerak Susun (2026-08-07) — indeks kandungan LAMA (utk panel kiri/kanan regangan bergerak,
  // lihat JSX di bawah) dan fasa gerakan (diam = kedudukan mula tanpa transition CSS, gerak =
  // dianimasikan ke kedudukan akhir). Dua state berasingan drpd visualIndex/overlayAktif sedia
  // ada sebab mekanismenya lain sama sekali — Gerak Susun tak sembunyi-lalu-tukar di sebalik
  // panel pejal macam Colophon/Sapuan Lajur, ia render KEDUA-DUA kandungan lama+baharu serentak
  // bersebelahan dan gerakkan seluruh regangan.
  const [indeksLamaGerak, setIndeksLamaGerak] = useState(activeIndex);
  const [fasaGerak, setFasaGerak] = useState<'diam' | 'gerak'>('diam');
  // Padding kad SEBENAR (2026-08-07, pepijat Izzat tangkap: "kedudukan topik menyentuh sempadan
  // kad" semasa Gerak Susun) — renderItem() TIADA padding sendiri langsung; ia bergantung
  // SEPENUHNYA pada padding bekas induk (p-4/md:p-6, berbeza-beza tiap 30 tapak panggilan kad).
  // Overlay Gerak Susun guna `position:absolute inset-0` pada kadPenuhStabil — inset-0 diukur
  // dari KOTAK PADDING induk (ikut spesifikasi CSS untuk anak posisi mutlak), bukan kotak
  // kandungan, jadi ia SENYAP mengabaikan padding tu terus, kandungan terpampang rata dgn
  // sempadan kad. Diukur SEKALI setiap kali overlay bermula (bukan setiap render — padding tak
  // berubah dalam satu transisi) dan dipakai sebagai gaya inline pada DUA panel kandungan (bukan
  // panel logo tengah, yang sengaja rata-tepi dgn logo dipusatkan).
  const [padGerak, setPadGerak] = useState({ top: 0, right: 0, bottom: 0, left: 0 });

  useEffect(() => {
    if (activeIndex === prevActiveIndexRef.current) return;
    const indeksSebelum = prevActiveIndexRef.current;
    prevActiveIndexRef.current = activeIndex;
    overlayTimersRef.current.forEach(clearTimeout);
    overlayTimersRef.current = [];

    // Jenis animasi EFEKTIF slot ni — override per-slot (Senarai Slot → Tetapan Kad) MENGATASI
    // jenis global, tapi togol `animasiAktif` (Tetapan Am Slot) MENGATASI kedua-duanya: bila
    // dinyahaktifkan, SEMUA slot paksa 'pudar' (kelakuan asal tanpa panel), tak kira pilihan
    // lain (2026-08-07, permintaan Izzat eksplisit).
    const kadUntukJenis = (containerRef.current?.closest('[data-slot]') as HTMLElement | null) || containerRef.current;
    const jenisEfektif = animasiAktif ? jenisAnimasiUntukSlot(kadUntukJenis?.getAttribute('data-slot')) : 'pudar';
    // Kelajuan/warna/logo EFEKTIF slot ni (Pelan 03) — sama corak seperti jenisEfektif di atas.
    const kelajuanEfektif = kelajuanUntukSlot(kadUntukJenis?.getAttribute('data-slot'));

    if (jenisEfektif === 'gerak_susun') {
      const prefersReduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        setVisualIndex(activeIndex);
        setOverlayAktif(false);
        return;
      }
      const kadPenuh = kadUntukJenis;
      let overflowAsal: string | null = null;
      if (kadPenuh) {
        if (getComputedStyle(kadPenuh).position === 'static') kadPenuh.style.position = 'relative';
        overflowAsal = kadPenuh.style.overflow || '';
        kadPenuh.style.overflow = 'hidden';
        const gayaKad = getComputedStyle(kadPenuh);
        setPadGerak({
          top: parseFloat(gayaKad.paddingTop) || 0,
          right: parseFloat(gayaKad.paddingRight) || 0,
          bottom: parseFloat(gayaKad.paddingBottom) || 0,
          left: parseFloat(gayaKad.paddingLeft) || 0,
        });
      }
      setPortalTarget(kadPenuh);
      setLogoTransisiSemasa(ambilLogoTransisi(logoModeUntukSlot(kadUntukJenis?.getAttribute('data-slot'))));
      setIndeksLamaGerak(indeksSebelum);
      // visualIndex dikemas kini SERTA-MERTA (bukan lag macam Colophon/Sapuan Lajur) — senarai
      // bertindan di bawah TERSEMBUNYI di sebalik regangan Gerak Susun sepanjang overlayAktif,
      // jadi tiada risiko kelihatan bertukar mendadak; lebih awal ia dikemas kini, lebih lancar
      // ia sudah "betul" sebaik regangan selesai & overlay hilang.
      setVisualIndex(activeIndex);
      setFasaGerak('diam');
      setOverlayAktif(true);
      const tempohGerak = Math.round(900 * kelajuanEfektif);
      // rAF (bukan setTimeout 0) — jamin browser dah render kedudukan MULA (fasaGerak='diam',
      // tiada transition) SATU bingkai penuh dulu sebelum tukar ke 'gerak' (transition aktif),
      // supaya peralihan CSS benar-benar animasi drpd kedudukan mula, bukan terus lompat.
      const rafId = requestAnimationFrame(() => {
        overlayTimersRef.current.push(setTimeout(() => setFasaGerak('gerak'), 20));
      });
      overlayTimersRef.current.push(setTimeout(() => {
        setOverlayAktif(false);
        setFasaGerak('diam');
        if (kadPenuh) kadPenuh.style.overflow = overflowAsal || '';
      }, tempohGerak + 20));
      return () => cancelAnimationFrame(rafId);
    }

    const prefersReduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const overlayBerkenaan = (jenisEfektif === 'colophon' || jenisEfektif === 'sapuan_lajur') && !prefersReduced;

    if (!overlayBerkenaan) {
      setVisualIndex(activeIndex);
      setOverlayAktif(false);
      return;
    }

    const kadPenuh = kadUntukJenis;
    // Jamin bekas kedudukan (position:relative) untuk overlay absolute — sifat aditif sahaja,
    // TIDAK diubah kalau kad tu sudah `relative` (kebanyakan sedia ada), tak jejas apa-apa lain.
    let overflowAsal: string | null = null;
    if (kadPenuh) {
      if (getComputedStyle(kadPenuh).position === 'static') {
        kadPenuh.style.position = 'relative';
      }
      // "Stage" overflow:hidden (spesifikasi asal design_handoff_carousel_transitions) — TANPA
      // ini, panel yang sedang bergerak keluar-masuk (translateX 100%/-100%) kelihatan MELIMPAH
      // ke kad JIRAN semasa transit (Izzat tangkap: "kad tu boleh nampak bergerak dari kad lain
      // ke kad lain"). Disimpan/dipulih (bukan tulis-ganti kekal) — sesetengah kad mungkin
      // pentingkan overflow:visible untuk kesan lain (cth hover:scale), walaupun tak ditemui
      // dalam audit semasa.
      overflowAsal = kadPenuh.style.overflow || '';
      kadPenuh.style.overflow = 'hidden';
    }
    setPortalTarget(kadPenuh);
    setLogoTransisiSemasa(ambilLogoTransisi(logoModeUntukSlot(kadUntukJenis?.getAttribute('data-slot'))));

    // Tempoh SATU keyframe berterusan (masuk -> TAHAN 500ms -> keluar) — masukMasa ialah TITIK
    // bila panel BARU tutup penuh (kedudukan translate(0,0), lihat peratusan @keyframes di
    // src/index.css — MESTI sepadan nombor ni, jangan ubah salah satu tanpa yang lain). Kandungan
    // SEBENAR ditukar pada saat ni (tersembunyi di sebalik panel yang tertutup penuh); panel
    // sendiri (className/elemen) tak disentuh langsung. jumlahMasa = masukMasa + tahanMasa(500) +
    // keluarMasa(=masukMasa) — sepadan animation-duration 1.3s (Colophon) / 1.6s (Sapuan Lajur).
    const masukMasa = Math.round((jenisEfektif === 'sapuan_lajur' ? 550 : 400) * kelajuanEfektif);
    const tahanMasa = Math.round(500 * kelajuanEfektif);
    const jumlahMasa = masukMasa * 2 + tahanMasa;
    setOverlayAktif(true);
    overlayTimersRef.current.push(setTimeout(() => {
      setVisualIndex(activeIndex);
    }, masukMasa));
    overlayTimersRef.current.push(setTimeout(() => {
      setOverlayAktif(false);
      if (kadPenuh) kadPenuh.style.overflow = overflowAsal || '';
    }, jumlahMasa));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, jenisAnimasi, animasiAktif, kelajuanAnimasi]);

  useEffect(() => () => { overlayTimersRef.current.forEach(clearTimeout); }, []);

  if (list.length <= 1) {
    return <>{renderItem(list[0] || {})}</>;
  }
  // Arah PANEL slot ni — override per-slot (Tetapan Am Slot, senarai berasingan) MENGATASI arah
  // global bila ada. `kadPenuhStabil` (bukan `portalTarget`) sengaja dipakai — ia stabil sejak
  // lekap pertama (lihat setContainerRef di atas), tak `null` sekejap semasa antara transisi macam
  // `portalTarget` (yang hanya wujud SEMASA overlayAktif).
  const arahEfektif = arahUntukSlot(kadPenuhStabil?.getAttribute('data-slot'));
  // Jenis animasi EFEKTIF utk RENDER (cermin pengiraan sama dlm useEffect di atas, dikira semula
  // di sini sebab render dan effect ialah dua konteks berasingan) — togol animasiAktif MENGATASI
  // pilihan per-slot/global.
  const jenisEfektifRender = animasiAktif ? jenisAnimasiUntukSlot(kadPenuhStabil?.getAttribute('data-slot')) : 'pudar';
  // Warna panel & kelajuan EFEKTIF slot ni (Pelan 03) — cermin jenisEfektifRender di atas.
  const kelajuanEfektifRender = kelajuanUntukSlot(kadPenuhStabil?.getAttribute('data-slot'));
  const warnaPanelEfektif = warnaPanelUntukSlot(kadPenuhStabil?.getAttribute('data-slot'));
  const tempohColophonMs = Math.round((jenisEfektifRender === 'sapuan_lajur' ? 550 : 400) * 2 * kelajuanEfektifRender + 500 * kelajuanEfektifRender);
  // Gerak Susun aktif — senarai bertindan (crossfade) tersembunyi (opacity 0) sepanjang tempoh
  // ni, regangan 3-panel (JSX di bawah) yang kelihatan sebaliknya.
  const gerakAktif = jenisEfektifRender === 'gerak_susun' && overlayAktif;
  const tempohGerakMs = Math.round(900 * kelajuanEfektifRender);
  return (
    // data-carousel-stable: penanda supaya CSS telefon boleh melucutkan kunci tinggi ini. Kunci
    // itu diukur pada lebar semasa dan tidak pernah mengecil semula, jadi tinggi desktop (dengan
    // huraian) tidak boleh dibiarkan terbawa ke kad telefon yang bertajuk sahaja.
    <div
      ref={setContainerRef}
      className="grid relative group/carousel"
      data-carousel-stable=""
      style={{ minHeight: maxHeight }}
      onTouchStart={onNavigate ? kendaliSentuhMula : undefined}
      onTouchEnd={onNavigate ? kendaliSentuhTamat : undefined}
    >
      {/* Navigasi carousel (2026-08-04, kemas kini Izzat, dua pusingan pembetulan) — dirender
          via Portal TERUS ke kad PENUH (kadPenuhStabil, bukan bekas kecil teks ni sendiri):
          pusingan pertama letak butang/dot relatif kepada bekas KECIL, jadi anak panah
          "terpotong" (terhad dalam kawasan teks) dan dot "duduk di tengah-tengah kad" (bukan
          footer) — Portal ke kad penuh betulkan kedua-duanya sekali gus, sama teknik macam
          overlay animasi transisi di atas.
          - Anak panah: desktop sahaja (md:), di tepi KIRI/KANAN kad penuh (bukan bertindih
            teks), sorok lalai & dedah bila kad (bukan bekas kecil) di-hover — group tanpa nama
            sepadan `group` sedia ada pada setiap 30 tapak panggilan kad.
          - Telefon: anak panah DIBUANG terus — leret jari sudah cukup.
          - Dot: warna GELAP (bukan putih — kad ni latar cerah, putih tak kelihatan), di footer
            kad penuh (bawah sekali), kedua-dua saiz skrin. */}
      {onNavigate && kadPenuhStabil && createPortal(
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Ikon sahaja, tiada pill/bulatan (2026-08-05, pusingan kedua permintaan Izzat — pill
              putih masih "kurang lawa"). Diposisi di TENGAH jidar kad (padding kad, bukan tepi
              mutlak) — kad carousel hampir semua guna md:p-6 (24px, satu kad hero sahaja
              md:p-8), ikon lebar 16px, jadi tengah jidar = (24-16)/2 = 4px drpd tepi kad
              (left-1/right-1). TIADA kelas warna eksplisit sengaja — Portal render terus ke
              dalam kadPenuhStabil (kad sebenar), yang ada `color: finalTextColor` inline
              (getCardTheme di atas, sudah kira kontras gelap/cerah setiap kad individu); ikon
              lucide default stroke=currentColor, jadi ia WARIS warna tajuk/huraian kad tu
              secara automatik — kontras terjamin tanpa perlu logik tema berasingan di sini. */}
          <button
            type="button"
            aria-label="Kandungan sebelum"
            onClick={(e) => { e.stopPropagation(); onNavigate(-1); }}
            className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 items-center justify-center p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            aria-label="Kandungan seterusnya"
            onClick={(e) => { e.stopPropagation(); onNavigate(1); }}
            className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 items-center justify-center p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
          </button>
          {/* Dot — visual sahaja (tak boleh diklik terus; onNavigate cuma sokong langkah
              relatif ±1, bukan lompat terus — cukup papar "berapa banyak / yang mana
              sekarang", tak perlu prop baharu merentasi 30 tapak panggilan sedia ada). */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
            {list.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`rounded-full transition-all duration-300 ${i === activeIndex ? 'w-3 h-1.5 bg-[#802334]' : 'w-1.5 h-1.5 bg-stone-300'}`}
              />
            ))}
          </div>
        </div>,
        kadPenuhStabil
      )}
      {list.map((it, i) => {
        // 'pudar' pakai activeIndex terus (crossfade serentak, kelakuan asal); jenis lain pakai
        // visualIndex yang lag di sebalik overlay (lihat useEffect di atas). Gerak Susun turut
        // guna visualIndex (dikemas kini serta-merta, bukan lag — lihat nota di useEffect), tapi
        // senarai bertindan ni tersembunyi sepanjang overlayAktif (opacity 0, lihat gerakAktif).
        const indexDipaparkan = jenisEfektifRender !== 'pudar' ? visualIndex : activeIndex;
        return (
        <div
          key={i}
          ref={(el) => { itemRefs.current[i] = el; }}
          className="col-start-1 row-start-1 min-w-0"
          style={{
            // alignSelf: 'start' stops the grid's default stretch-to-fill-track behavior --
            // without it, once minHeight is applied to the parent every stacked child gets
            // stretched to match it, so re-measuring scrollHeight afterwards just reads back
            // the stretched size instead of the item's true natural content height, masking
            // any real variance on every subsequent measurement.
            alignSelf: 'start',
            opacity: gerakAktif ? 0 : (i === indexDipaparkan ? 1 : 0),
            transition: overlayAktif ? 'none' : 'opacity 1s ease-in-out',
            pointerEvents: i === indexDipaparkan ? 'auto' : 'none',
          }}
          aria-hidden={i === indexDipaparkan ? undefined : true}
        >
          {renderItem(it)}
        </div>
        );
      })}
      {/* Overlay animasi transisi (Colophon/Sapuan Lajur) — lihat nota @keyframes di
          src/index.css. Dirender via Portal TERUS di dalam kad PENUH (data-slot terdekat),
          position:absolute inset-0 terhadapnya — bergerak SAMA dengan kad secara automatik,
          tiada snapshot koordinat yang boleh jadi basi (lihat nota `portalTarget` di atas).
          Logo bergilir Adjung/penaja (2026-08-05, tetapan `nisbahPenajaTransisi`) — dipetik
          SEKALI setiap transisi (logoTransisiSemasa, lihat useEffect di atas), bukan setiap
          render. */}
      {overlayAktif && portalTarget && jenisEfektifRender === 'colophon' && createPortal(
        <div
          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none carousel-colophon-penuh"
          style={{ backgroundColor: warnaPanelEfektif, animationDuration: `${tempohColophonMs}ms`, ...vektorArahOverlay(arahEfektif, false) }}
          aria-hidden="true"
        >
          {logoTransisiSemasa.jenis === 'tiada' ? null : logoTransisiSemasa.jenis === 'adjung'
            ? <LogoTransisiAdjung />
            : <img src={logoTransisiSemasa.logoUrl} alt={logoTransisiSemasa.nama || ''} className="max-w-[45%] max-h-[45%] object-contain opacity-95" />}
        </div>,
        portalTarget
      )}
      {overlayAktif && portalTarget && jenisEfektifRender === 'sapuan_lajur' && createPortal(
        <div
          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none carousel-sapuan-penuh"
          style={{ backgroundColor: warnaPanelEfektif, animationDuration: `${tempohColophonMs}ms`, ...vektorArahOverlay(arahEfektif, true) }}
          aria-hidden="true"
        >
          {logoTransisiSemasa.jenis === 'tiada' ? null : logoTransisiSemasa.jenis === 'adjung'
            ? <LogoTransisiAdjung />
            : <img src={logoTransisiSemasa.logoUrl} alt={logoTransisiSemasa.nama || ''} className="max-w-[40%] max-h-[40%] object-contain opacity-95" />}
        </div>,
        portalTarget
      )}
      {/* Gerak Susun (2026-08-07, permintaan Izzat) — BERBEZA drpd Colophon/Sapuan Lajur di atas:
          kandungan SEBENAR bergerak, bukan panel menutup+tukar senyap di sebalik. Regangan
          3-panel [kandungan lama][logo][kandungan baharu] (kiri-ke-kanan dlm DOM, dicerminkan
          ikut arah), lebar 300% keseluruhan, digerakkan translateX satu hayunan berterusan.
          Kandungan lama/baharu ialah PANGGILAN SEMULA renderItem() dgn data item sebenar (bukan
          snapshot DOM/imej) — pendekatan paling mudah & tepat drpd cuba tangkap rupa visual
          sedia ada. */}
      {overlayAktif && portalTarget && jenisEfektifRender === 'gerak_susun' && createPortal(
        <div className="absolute inset-0 z-40 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="flex h-full"
            style={{
              width: '300%',
              transform: (() => {
                const kanan = arahEfektif !== 'kiri';
                if (fasaGerak === 'gerak') return kanan ? 'translateX(-66.6667%)' : 'translateX(0%)';
                return kanan ? 'translateX(0%)' : 'translateX(-66.6667%)';
              })(),
              transition: fasaGerak === 'gerak' ? `transform ${tempohGerakMs}ms cubic-bezier(0.65, 0, 0.35, 1)` : 'none',
            }}
          >
            {arahEfektif === 'kiri' ? (
              <>
                <div className="w-1/3 h-full shrink-0 overflow-hidden" style={{ padding: `${padGerak.top}px ${padGerak.right}px ${padGerak.bottom}px ${padGerak.left}px` }}>{renderItem(list[activeIndex] || {})}</div>
                <div className="w-1/3 h-full shrink-0 flex items-center justify-center" style={{ backgroundColor: warnaPanelEfektif }}>
                  {logoTransisiSemasa.jenis === 'tiada' ? null : logoTransisiSemasa.jenis === 'adjung'
                    ? <LogoTransisiAdjung />
                    : <img src={logoTransisiSemasa.logoUrl} alt={logoTransisiSemasa.nama || ''} className="max-w-[45%] max-h-[45%] object-contain opacity-95" />}
                </div>
                <div className="w-1/3 h-full shrink-0 overflow-hidden" style={{ padding: `${padGerak.top}px ${padGerak.right}px ${padGerak.bottom}px ${padGerak.left}px` }}>{renderItem(list[indeksLamaGerak] || {})}</div>
              </>
            ) : (
              <>
                <div className="w-1/3 h-full shrink-0 overflow-hidden" style={{ padding: `${padGerak.top}px ${padGerak.right}px ${padGerak.bottom}px ${padGerak.left}px` }}>{renderItem(list[indeksLamaGerak] || {})}</div>
                <div className="w-1/3 h-full shrink-0 flex items-center justify-center" style={{ backgroundColor: warnaPanelEfektif }}>
                  {logoTransisiSemasa.jenis === 'tiada' ? null : logoTransisiSemasa.jenis === 'adjung'
                    ? <LogoTransisiAdjung />
                    : <img src={logoTransisiSemasa.logoUrl} alt={logoTransisiSemasa.nama || ''} className="max-w-[45%] max-h-[45%] object-contain opacity-95" />}
                </div>
                <div className="w-1/3 h-full shrink-0 overflow-hidden" style={{ padding: `${padGerak.top}px ${padGerak.right}px ${padGerak.bottom}px ${padGerak.left}px` }}>{renderItem(list[activeIndex] || {})}</div>
              </>
            )}
          </div>
        </div>,
        portalTarget
      )}
    </div>
  );
};

// Freezes an element's height at its last-measured value from BEFORE `isLocked` became true --
// used so the 2 cards sharing a BAR cluster's grid row stay pixel-static while that cluster's
// accordion is open, without needing to know/hardcode what their "normal" (grid-stretched) height
// is. While isLocked is false, keeps measuring on every render + window resize (so the frozen
// value is always the real, current, un-expanded size); once isLocked flips true, stops
// re-measuring and applies that last value as an explicit inline height, overriding the grid's
// stretch-driven growth from the now-taller BAR cluster cell. Same "measure and pin" approach as
// CarouselStableBlock above, applied to a different problem (freeze on interaction vs. pick a max
// across carousel items).
function useCollapsedHeightLock(isLocked: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [naturalHeight, setNaturalHeight] = useState<number | undefined>(undefined);
  // No dependency array: re-measure after EVERY render while unlocked, so the frozen value is
  // always the size right up to the moment it locks — not a stale snapshot from whenever isLocked
  // last flipped to false (which could predate later content/data/font changes).
  useLayoutEffect(() => {
    if (isLocked || !ref.current) return;
    const h = ref.current.getBoundingClientRect().height;
    setNaturalHeight((prev) => (prev !== h ? h : prev));
  });
  useEffect(() => {
    if (isLocked) return;
    const onResize = () => {
      if (ref.current) setNaturalHeight(ref.current.getBoundingClientRect().height);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isLocked]);
  const lockStyle = isLocked && naturalHeight ? { height: `${naturalHeight}px` } : undefined;
  return { ref, lockStyle };
}

let BENTO_FALLBACKS: any[] = [];


const isColorDark = (hexColor: string | undefined): boolean => {
  if (!hexColor || hexColor === 'transparent') return false;
  const lightColors = ['#faf7f0', '#faf8f3', '#fdfdfd', '#ffffff', '#faf7f0'];
  if (lightColors.includes(hexColor.toLowerCase())) return false;
  const hex = hexColor.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq < 128;
  }
  return true;
};

export const getCardTheme = (item: any, defaultBg: string = 'transparent') => {
  const bg = item.bgColor || defaultBg;
  const isDark = isColorDark(bg);
  const textColor = item.textColor || (isDark ? '#FDFDFD' : '#1F1F1F');
  const hasImage = !!item.imageUrl;
  
  const finalTextColor = hasImage ? '#FDFDFD' : textColor;
  const finalIsDark = hasImage ? true : isDark;
  
  return {
    cardStyle: {
      backgroundColor: bg,
      borderColor: item.borderColor || (bg === 'transparent' ? '#E5E7EB' : 'transparent'),
      borderWidth: '1px',
      borderStyle: 'solid',
      color: finalTextColor,
      backgroundImage: hasImage ? `linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.8)), url(${item.imageUrl})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      position: 'relative' as const,
    },
    deskStyle: {
      color: finalIsDark ? '#E9D8A6' : '#802334'
    },
    titleStyle: {
      color: finalTextColor
    },
    briefStyle: {
      color: finalIsDark ? 'rgba(253, 253, 253, 0.95)' : '#1F1F1F',
      fontSize: '14px'
    },
    sourceStyle: {
      color: finalIsDark ? '#d6d3d1' : '#78716c',
      borderColor: finalIsDark ? 'rgba(253, 253, 253, 0.2)' : '#e7e5e4'
    },
    finalIsDark
  };
};
const padToLimit = (text: string, maxLen: number): string => {
  return text || '';
};

// Geometry tiers for the 4 card types whose title+brief share a fixed vertical budget (source is
// reserved separately, below, and anchored to the card bottom — see CarouselStableBlock/mt-auto
// work). Computed 2026-07-21 from live-measured card widths/fonts via canvas.measureText on a
// representative Malay news sentence: maxTitleAlone/maxBriefAlone are the character counts that
// would exactly fill the shared budget if given ENTIRELY to one field; ratio = maxBriefAlone /
// maxTitleAlone is how many brief characters one title character "costs" in shared vertical space.
import { tierForSlot as getGeometryTierForIndex, ceilingForSlot, TIER_SLOTS, topikCeilingForSlot } from '../../../core/editorial/GeometryConfig.js';

const getLimitsForIndex = (idx: number, config?: any) => {
  // maxTitle/maxBrief per-slot daripada slots_config SENGAJA DIABAIKAN (2026-07-30). Dua lajur tu
  // salinan lama yang tak pernah dikemas kini (12 slot simpan nilai salah, 20 kosong) — dan lebih
  // buruk, ia dulu MENGATASI nilai tier, jadi pindaan had yang dibuat Ketua Editor di Tier Kad
  // boleh ditelan senyap oleh nombor lapuk satu slot. Had ialah sifat TIER, tidak pernah per-slot
  // (peraturan teras projek). maxBriefLong kekal boleh diubah per-slot — ia medan luar kad,
  // bukan sebahagian bajet ruang kad.
  const customBriefLong = config?.maxBriefLong;

  // maxBriefLong: had aksara "Huraian Panjang" — kandungan tambahan yang tidak dipaparkan pada kad,
  // hanya dalam mod spotlight (belum dibina). Tiada guna untuk Ticker/slot bar (0).
  // Previously a hand-typed if/else chain here had drifted from the canonical values in
  // core/editorial/GeometryConfig.js for 4 of 8 tiers (and disagreed with server.js's own copy on
  // BAR) — now derived live from the single shared source, so it can't drift again.
  const defaults = ceilingForSlot(idx);

  return {
    maxTitle: defaults.maxTitle,
    maxBrief: defaults.maxBrief,
    maxBriefLong: (typeof customBriefLong === 'number' && customBriefLong >= 0) ? customBriefLong : defaults.maxBriefLong
  };
};

export const FrontpageView: React.FC<FrontpageViewProps> = ({
  entries,
  users,
  systemSettings,
  setSelectedEntry,
  setSelectedAuthorId,
  setActiveTab,
  currentUser,
  currentEditoriumRole,
  currentEditoriumName,
  currentEditoriumContact,
  onRequestEditLogin,
  onLogout,
  inTheNewsGoogleDocText = '',
  worldClockHolidaysGoogleDocText = '',
  setIndexSearchQuery,
  deepLinkKodPendek,
}) => {
  const navigate = useNavigate();
  // Susun atur telefon (2026-07-31, permintaan pemilik projek — pusingan KELIMA): struktur
  // SAMA macam desktop (grid 6-lajur), skala bawah ke grid 3-lajur (setiap col-span dibahagi
  // 2) — bukan lagi masonry JS berasingan. Lihat ROW demi ROW di bawah untuk kelas col-span
  // telefon (base, tanpa md:) yang ditambah bersebelahan kelas md:col-span-* desktop sedia
  // ada. Empat percubaan JS masonry sebelum ini (columns, Grid dense, position:absolute
  // custom) semuanya timbulkan pepijat berulang (jurang, footer, transition) — pendekatan
  // ni elak kelas pepijat tu sepenuhnya dengan guna semula MEKANISME CSS Grid desktop terus,
  // bukan cuba tiru kesannya via JS.
  const [parsedNewsItems, setParsedNewsItems] = useState<any[]>([]);
  // Distinguishes "haven't fetched real content yet" from "fetched, and this slot is genuinely
  // unconfigured" — without this, every fresh page load briefly renders the character-limit
  // reference fallback text (SLOT_0_LEBAR, etc.) for all 38 slots, which looks like real news to a
  // visitor for the split second before the actual content arrives and replaces it.
  const [hasLoadedContent, setHasLoadedContent] = useState(false);
  // Every desk/category gets one color, assigned once and reused everywhere it appears (bento
  // cards, Ticker) — backed by CategoryRegistry (server.js + core/category/CategoryRegistry.js),
  // not the old static DESK_ACCENTS list. Keyed lowercase for case-insensitive lookup.
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  // Senarai Bidang tertutup (24 disiplin kurasi Ketua Editor) — sumber dropdown Bidang di
  // Tetapan Slot. Berasingan daripada categoryColors di atas (yang baca SEMUA baris
  // CategoryRegistry, termasuk 93 baris lama tak aktif, untuk warna kad).
  // icon/iconSvg dibawa sekali (bukan hanya name/color) sebab Focus View papar glif Bidang
  // di sebelah label "Bidang Topik" — lihat openFocus() di bawah.
  const [activeBidangList, setActiveBidangList] = useState<{ name: string; color: string; icon: string | null; iconSvg: string | null }[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<'ms' | 'zh' | 'ar' | 'en'>('ms');
  const [enabledLanguages, setEnabledLanguages] = useState<any[]>([]);
  // BAR accordion: which card (by slot index) is expanded, per cluster — independent so opening
  // one cluster's accordion never affects the other.
  const [expandedBarCluster1, setExpandedBarCluster1] = useState<number | null>(null);
  const [expandedBarCluster2, setExpandedBarCluster2] = useState<number | null>(null);
  // Height locks for the 2 cards sharing each BAR cluster's grid row (index 11/12 for cluster 1,
  // 25/26 for cluster 2) — see useCollapsedHeightLock. Locked whenever that cluster's accordion
  // is open, so these cards never move/resize while a card elsewhere in their row expands.
  const bar1SiblingLocks = {
    idx11: useCollapsedHeightLock(expandedBarCluster1 !== null),
    idx12: useCollapsedHeightLock(expandedBarCluster1 !== null),
  };
  const bar2SiblingLocks = {
    idx25: useCollapsedHeightLock(expandedBarCluster2 !== null),
    idx26: useCollapsedHeightLock(expandedBarCluster2 !== null),
  };
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Nyah-duplikasi + had bilangan (2026-08-08, pepijat Izzat: klik beberapa pautan footer yang
  // gagal menimbun 10+ toast SERUPA sehingga menutup separuh skrin). Mesej yang sama TIDAK
  // ditimbun — ulangan cuma menyegarkan yang sedia ada (id baharu = pemasa 3 saat bermula semula),
  // dan paling banyak 3 toast kelihatan serentak tanpa mengira berapa banyak dicetuskan.
  const MAKS_TOAST = 3;
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts((prev) => {
      // Mesej serupa yang MASIH kelihatan diabaikan terus, bukan diganti dengan yang baharu:
      // menggantinya bermakna satu toast keluar sementara satu lagi masuk, jadi pembaca nampak
      // dua salinan bertindih memudar silang (disahkan hidup — opacity 0.18 lawan 0.82) yang
      // kelihatan seperti pepijat paparan. Ia sudah pun terpampang; ulangan tiada apa nak tambah.
      if (prev.some((t) => t.message === message)) return prev;
      const id = Math.random().toString(36).substring(2, 9);
      return [...prev, { id, type, message }].slice(-MAKS_TOAST);
    });
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [articleFontSize, setArticleFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [showScrollToTop, setShowScrollToTop] = useState<boolean>(false);

  // Suis "Aktif di Footer" (2026-08-08, Izzat: "macam mana nak nyahaktifkan Lembaga Editorial dan
  // halaman lain untuk sementara?") — peta {key: aktif} setiap halaman statik footer. Lalai
  // KOSONG (semua nampak) sementara dimuatkan, bukan semua tersembunyi — kegagalan rangkaian
  // sepatutnya papar footer penuh macam biasa, bukan footer kosong.
  const [halamanAktifPeta, setHalamanAktifPeta] = useState<Record<string, boolean>>({});
  const halamanAktif = (key: string) => halamanAktifPeta[key] !== false;
  useEffect(() => {
    fetch('/api/pages-status')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setHalamanAktifPeta(data || {}))
      .catch(() => {});
  }, []);

  // Jejak pengunjung (Fasa 14) — satu kiraan setiap muatan frontpage. Terlepas-pandang, sekali
  // sahaja setiap mount (bukan setiap perubahan state) — sengaja tanpa senarai dependensi lain.
  useEffect(() => {
    trackView('homepage', 'utama');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewsOverlay(false);
        setActiveFooterPageKey(null);
      }
    };
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 400);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const [slotsConfig, setSlotsConfig] = useState<any[]>([]);
  const [activeFooterPageKey, setActiveFooterPageKey] = useState<string | null>(null);
  const [footerPageData, setFooterPageData] = useState<any | null>(null);
  const [isLoadingFooterPage, setIsLoadingLoadingFooterPage] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [apiHolidaysData, setApiHolidaysData] = useState<{ publicHolidays: any[]; schoolHolidays: any[] } | null>(null);

  const [activeOverlayIndex, setActiveOverlayIndex] = useState(0);
  const [activeFrontpageIndex, setActiveFrontpageIndex] = useState(0);
  const [showNewsOverlay, setShowNewsOverlay] = useState(false);

  const { items: parsedNewsItemsA } = parseInTheNews(systemSettings?.inTheNewsText || '');
  const { items: parsedNewsItemsB } = parseInTheNews(inTheNewsGoogleDocText || '');

  const parsedTickerNewsItems = React.useMemo(() => {
    let merged: any[] = [];
    if (parsedNewsItemsA.length === 0) {
      merged = parsedNewsItemsB;
    } else if (parsedNewsItemsB.length === 0) {
      merged = parsedNewsItemsA;
    } else {
      const result: any[] = [];
      let iA = 0;
      let iB = 0;
      while (iA < parsedNewsItemsA.length || iB < parsedNewsItemsB.length) {
        if (iB < parsedNewsItemsB.length) {
          result.push(parsedNewsItemsB[iB++]);
        }
        if (iA < parsedNewsItemsA.length) {
          result.push(parsedNewsItemsA[iA++]);
        }
      }
      merged = result;
    }
    return merged.slice(0, 50).map(item => {
      const displayDesk = (item.desk === 'BELUM DIKELASKAN' || !item.desk) ? 'SEMASA' : item.desk;
      return {
        ...item,
        desk: displayDesk,
        categoryColor: item.categoryColor || categoryColors[displayDesk.toLowerCase()]
      };
    });
  }, [parsedNewsItemsA, parsedNewsItemsB, categoryColors]);

  const activeTickerNewsItem = parsedTickerNewsItems[activeFrontpageIndex];
  const overlayItem = parsedTickerNewsItems[activeOverlayIndex];

  // Frontpage news preview rotation
  useEffect(() => {
    if (parsedTickerNewsItems.length <= 1) return;
    const tickerConfig = slotsConfig.find(s => s.slotIndex === -1);
    const tickerInterval = tickerConfig?.carouselInterval || 10;
    const interval = setInterval(() => {
      setActiveFrontpageIndex((prev) => (prev + 1) % parsedTickerNewsItems.length);
    }, tickerInterval * 1000);
    return () => clearInterval(interval);
  }, [parsedTickerNewsItems.length, slotsConfig]);

  // Fullscreen overlay news rotation
  useEffect(() => {
    if (!showNewsOverlay || parsedTickerNewsItems.length <= 1) return;
    const tickerConfig = slotsConfig.find(s => s.slotIndex === -1);
    const tickerInterval = tickerConfig?.carouselInterval || 10;
    const interval = setInterval(() => {
      setActiveOverlayIndex((prev) => (prev + 1) % parsedTickerNewsItems.length);
    }, tickerInterval * 1000);
    return () => clearInterval(interval);
  }, [showNewsOverlay, parsedTickerNewsItems.length, slotsConfig]);

  useEffect(() => {
    if (!showNewsOverlay) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewsOverlay(false);
      } else if (e.key === 'ArrowRight' && parsedTickerNewsItems.length > 1) {
        setActiveOverlayIndex((prev) => (prev + 1) % parsedTickerNewsItems.length);
      } else if (e.key === 'ArrowLeft' && parsedTickerNewsItems.length > 1) {
        setActiveOverlayIndex((prev) => (prev - 1 + parsedTickerNewsItems.length) % parsedTickerNewsItems.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewsOverlay, parsedTickerNewsItems.length]);

  const handlePrevNewsItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (parsedTickerNewsItems.length > 1) {
      setActiveOverlayIndex((prev) => (prev - 1 + parsedTickerNewsItems.length) % parsedTickerNewsItems.length);
    }
  };

  const handleNextNewsItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (parsedTickerNewsItems.length > 1) {
      setActiveOverlayIndex((prev) => (prev + 1) % parsedTickerNewsItems.length);
    }
  };

  // Leret untuk navigasi overlay Ticker skrin penuh (2026-08-06, permintaan Izzat) — di telefon
  // anak panah kiri/kanan sukar dicapai walaupun kini boleh diklik (ia bertindih teks), jadi leret
  // jari ialah gerak isyarat utama yang dijangka. Ambang/logik SAMA seperti carousel kad bento
  // (kendaliSentuhMula/Tamat di CarouselStableBlock) supaya kelakuan leret konsisten seluruh
  // portal: mesti mendatar (|deltaX| > |deltaY|) dan sekurang-kurangnya 45px, supaya tatal
  // menegak biasa tak tersalah tafsir sebagai navigasi.
  const sentuhOverlayMula = useRef<{ x: number; y: number } | null>(null);
  // Bendera "baru sahaja leret" — bekas overlay ada onClick yang MENUTUP overlay, dan penyemak
  // imbas tetap membangkitkan `click` sintetik selepas `touchend` walaupun jari bergerak jauh.
  // Tanpa bendera ni, setiap leret berjaya akan menukar berita LALU terus menutup overlay.
  const leretBaruBerlaku = useRef(false);
  const kendaliSentuhOverlayMula = (e: React.TouchEvent) => {
    const t = e.touches[0];
    sentuhOverlayMula.current = { x: t.clientX, y: t.clientY };
  };
  const kendaliSentuhOverlayTamat = (e: React.TouchEvent) => {
    if (!sentuhOverlayMula.current || parsedTickerNewsItems.length <= 1) return;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - sentuhOverlayMula.current.x;
    const deltaY = t.clientY - sentuhOverlayMula.current.y;
    sentuhOverlayMula.current = null;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 45) {
      leretBaruBerlaku.current = true;
      // Tamat-masa automatik (bukan cuma tunggu klik seterusnya "guna" bendera ni) — leret
      // SEBENAR di telefon selalunya TAK cetuskan klik-serasi langsung (gerak isyarat leret
      // dianggap tatal, bukan ketukan), jadi bendera boleh tersekat `true` selama-lamanya dan
      // menyekat klik-tutup SAH seterusnya. 400ms cukup luas untuk klik-serasi (kalau ada)
      // tiba, tapi singkat untuk tak jejas ketukan tulen tak berkaitan lepas tu.
      setTimeout(() => { leretBaruBerlaku.current = false; }, 400);
      setActiveOverlayIndex((prev) =>
        deltaX < 0
          ? (prev + 1) % parsedTickerNewsItems.length
          : (prev - 1 + parsedTickerNewsItems.length) % parsedTickerNewsItems.length
      );
    }
  };
  const tutupOverlayJikaBukanLeret = () => {
    if (leretBaruBerlaku.current) {
      leretBaruBerlaku.current = false;
      return;
    }
    setShowNewsOverlay(false);
  };

  // Autocondong (Fasa 8) — senarai peraturan tipografi hidup (dibaca TypographyRenderer/
  // safeParseInline). Pengurusan peraturan (tambah/sunting/buang) kini native di Editorium
  // (Modul Editorial → Autocondong); state+loader di sini KEKAL kerana ia juga sumber data
  // BACA sahaja untuk paparan Ticker/frontpage sebenar (lihat penggunaan TypographyRenderer).
  const [adjungTypographyRules, setAdjungTypographyRules] = useState<TypographyRule[]>([]);
  const loadAdjungTypographyRules = () => {
    fetch('/api/system/adjung-typography-rules')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAdjungTypographyRules(data);
      })
      .catch(err => console.error('Failed to load typography rules:', err));
  };

  // Glos Selari (Fasa 6) — selaraskan bendera dalam-modul yang dibaca safeParseInline setiap
  // kali systemSettings berubah (cth Ketua Editor togol tetapan tanpa muat semula halaman).
  useEffect(() => {
    setGlosSelariAktif(!!systemSettings?.glosSelariEnabled);
  }, [systemSettings?.glosSelariEnabled]);

  // Autocondong (Fasa 8) — selaraskan senarai peraturan dalam-modul yang dibaca safeParseInline
  // setiap kali adjungTypographyRules berubah (muat awal, atau Ketua Editor tambah/sunting/
  // buang peraturan di Editorial → Autocondong tanpa muat semula halaman).
  useEffect(() => {
    setTypographyRulesAktif(adjungTypographyRules);
  }, [adjungTypographyRules]);

  const loadSlotsConfig = () => {
    fetch('/api/system/slots')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSlotsConfig(data);
        }
      })
      .catch(err => console.error('Failed to load slots config:', err));
  };

  useEffect(() => {
    fetch('/api/translation/configs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEnabledLanguages(data.filter((d: any) => d.isEnabled === 1));
        }
      })
      .catch(err => console.error('Failed to load enabled languages:', err));

    fetch('/api/system/clock-holidays')
      .then(res => res.json())
      .then(data => {
        if (data && (data.publicHolidays || data.schoolHolidays)) {
          setApiHolidaysData(data);
        }
      })
      .catch(err => console.error('Failed to load clock holidays:', err));

    fetch('/api/system/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          data.forEach((c: any) => { if (c.name && c.color) map[c.name.toLowerCase()] = c.color; });
          setCategoryColors(map);
        }
      })
      .catch(err => console.error('Failed to load category colors:', err));

    fetch('/api/system/categories/active')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActiveBidangList(data.map((c: any) => ({
            name: c.name,
            color: c.color,
            icon: c.icon ?? null,
            iconSvg: c.iconSvg ?? null,
          })));
        }
      })
      .catch(err => console.error('Failed to load active Bidang list:', err));

    loadAdjungTypographyRules();
  }, []);

  useEffect(() => {
    fetch(`/api/system/layout/active?lang=${activeLanguage}&t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        setParsedNewsItems(data);
      })
      .catch(err => console.error('Failed to load active bento layout:', err))
      .finally(() => setHasLoadedContent(true));
    loadSlotsConfig();
  }, [systemSettings.inTheNewsText, activeLanguage, refreshKey]);

  const handleFooterLinkClick = async (key: string) => {
    setActiveFooterPageKey(key);
    setIsLoadingLoadingFooterPage(true);
    setFooterPageData(null);
    try {
      // "Catatan Ketua Editor" & "Pengumuman" (2026-08-05, permintaan Izzat) — dahulu KEDUA-DUA
      // tarik daripada static_pages (halaman yang tak pernah diisi, sentiasa kosong) walaupun
      // Ketua Editor dah terbitkan Nota berskop awam di Editorium. Nota Ketua Editor kini ada
      // TIGA skop konkrit sepadan tepat 1:1 dengan destinasi Frontpage (lihat
      // core/routes/editorNotesRoutes.js) — dua pautan footer ni tarik terus daripada laluan
      // awam tu (bukan static_pages), guna slot footer sedia ada.
      const TAJUK_HALAMAN_FOOTER: Record<string, string> = {
        about: 'Mengenai Adjung',
        'editorial-board': 'Lembaga Editorial',
        'publishing-policies': 'Dasar Penerbitan',
        'version-history': 'Sejarah Versi',
      };
      const SKOP_FOOTER: Record<string, { skop: string; tajuk: string }> = {
        'editors-notes': { skop: 'catatan_ketua_editor', tajuk: 'Catatan Ketua Editor' },
        notices: { skop: 'pengumuman', tajuk: 'Pengumuman' },
      };
      if (SKOP_FOOTER[key]) {
        const { skop, tajuk } = SKOP_FOOTER[key];
        const res = await fetch(`/api/public/editor-notes?type=${skop}`);
        if (res.ok) {
          const notes = await res.json();
          const content = Array.isArray(notes) && notes.length > 0
            ? notes.map((n: any) => `**${n.tajuk}**\n${n.kandungan}`).join('\n\n')
            : `Tiada ${tajuk.toLowerCase()} aktif buat masa ini.`;
          setFooterPageData({ title: tajuk, content });
        } else {
          addToast('error', `Gagal memuatkan ${tajuk.toLowerCase()}.`);
          setActiveFooterPageKey(null);
        }
        setIsLoadingLoadingFooterPage(false);
        return;
      }
      const res = await fetch(`/api/pages/${key}`);
      if (res.ok) {
        const data = await res.json();
        setFooterPageData(data);
      } else if (res.status === 404) {
        // Halaman belum diisi Ketua Editor (2026-08-08, pepijat Izzat) — BUKAN ralat: pautan
        // footer wujud sejak reka bentuk, kandungannya ditulis kemudian di Editorium → Tetapan →
        // Halaman Awam. Dahulu ni memancarkan toast "Gagal memuatkan kandungan halaman" dan
        // menutup modal terus, jadi pembaca nampak kegagalan sistem sedangkan yang sebenarnya
        // berlaku ialah kandungan belum ditulis. Buka modal macam biasa dengan nota jujur.
        setFooterPageData({
          title: TAJUK_HALAMAN_FOOTER[key] || 'Halaman',
          content: 'Kandungan halaman ini belum diterbitkan lagi.',
        });
      } else {
        addToast('error', 'Gagal memuatkan kandungan halaman.');
        setActiveFooterPageKey(null);
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Gagal memuatkan kandungan halaman.');
      setActiveFooterPageKey(null);
    } finally {
      setIsLoadingLoadingFooterPage(false);
    }
  };

  const newestEssays = React.useMemo(() => {
    const list = [...entries]
      .filter((e) => (e.contentType === 'Essay' || e.contentType === 'Article') && e.status === 'Published')
      .sort((a, b) => new Date(b.publishedDate || b.createdDate).getTime() - new Date(a.publishedDate || a.createdDate).getTime())
      .slice(0, 6)
      .map((entry) => {
        const author = users.find((u) => u.id === entry.authorId);
        const authorName = author?.penName || entry.publisher || 'Elena Vasquez';
        return {
          id: entry.id,
          title: entry.title,
          authorId: entry.authorId,
          authorName,
          fallback: false,
          entryObj: entry
        };
      });
    
    const fallbacks = [
      { id: 'fallback-essay-1', title: 'The Preservation Papers', authorId: null, authorName: 'Elena Vasquez', fallback: true, entryObj: null },
      { id: 'fallback-essay-2', title: 'Letters on Method', authorId: null, authorName: 'Marcus Aurelius', fallback: true, entryObj: null },
      { id: 'fallback-essay-3', title: 'Foundations of Inquiry', authorId: null, authorName: 'John Locke', fallback: true, entryObj: null },
      { id: 'fallback-essay-4', title: 'On the Socratic Practice', authorId: null, authorName: 'Plato', fallback: true, entryObj: null },
      { id: 'fallback-essay-5', title: 'The Consolation of Philosophy', authorId: null, authorName: 'Boethius', fallback: true, entryObj: null },
      { id: 'fallback-essay-6', title: 'The Republic of Science', authorId: null, authorName: 'Michael Polanyi', fallback: true, entryObj: null }
    ];

    const mergedList = [...list];
    while (mergedList.length < 6) {
      const fallbackIdx = mergedList.length;
      mergedList.push(fallbacks[fallbackIdx] || {
        id: `fallback-essay-${fallbackIdx + 1}`,
        title: 'Empty Slot',
        authorId: null,
        authorName: 'Adjung Staff',
        fallback: true,
        entryObj: null
      });
    }
    return mergedList;
  }, [entries, users]);

  const featuredTopics = React.useMemo(() => {
    const tagCounts: Record<string, number> = {};
    entries
      .filter(e => e.status === 'Published')
      .forEach(entry => {
        (entry.tags || []).forEach(tag => {
          if (tag) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        });
      });
    
    const sortedTags = Object.keys(tagCounts)
      .sort((a, b) => tagCounts[b] - tagCounts[a])
      .slice(0, 10);
    
    const fallbacks = ['Philosophy', 'History', 'Science', 'Literature'];
    return sortedTags.length > 0 ? sortedTags : fallbacks;
  }, [entries]);

  const rawBentoNewsItems = React.useMemo(() => {
    const list = [...parsedNewsItems];
    // Kumpulan kandungan pemegang tempat ADJUNG BRIEF (2026-08-10, GEOMETRY-16) — dipaparkan pada
    // mana-mana daripada 38 slot yang belum ada kandungan sebenar, supaya muka depan tidak pernah
    // kosong DAN bakal editor terus nampak apa sistem ni sebenarnya.
    //
    // TIER-AWARE (bukan i%10 rentas semua saiz — pendekatan lama itu memaksa HERO/MENEGAK/STANDARD
    // yang bajetnya besar berkongsi item SAMA dengan SEGI_EMPAT_SMALL/KOMPAK/BAR yang bajetnya jauh
    // lebih kecil, jadi item terpaksa ditulis pendek supaya muat tier terkecil — hasilnya HERO
    // nampak "terlalu kosong" walaupun sah dari segi bajet. Di sini setiap slot memilih daripada
    // kumpulan item yang direka KHUSUS untuk tier saiznya sendiri.) Setiap item padat secara wajar
    // (bukan 100%) untuk tier yang menerimanya — lihat GROUPS di bawah, disahkan skrip berasingan
    // sebelum ditampal di sini. Kandungan ialah fakta sebenar tentang Adjung Brief (Panduan/
    // Perlembagaan), bukan artikel berita rekaan.
    const ABOUT_ADJUNG_GROUPS: Record<string, Array<{ desk: string; topik: string; title: string; brief: string; briefLong: string }>> = {
      HERO: [
        { desk: 'Adjung Brief', topik: 'Identiti', title: 'Portal Kandungan Editorial Bergaya Majalah', brief: 'Berita, ilmu dan kebudayaan disusun dalam kad bersaiz berbeza di muka depan, diisi secara manual oleh editor atau ditarik daripada suapan RSS bagi jalur berita semasa.', briefLong: 'Adjung Brief ialah portal kandungan berbahasa Melayu yang mempersembahkan bahan editorial dalam susunan kad bersaiz berbeza di muka depan, bukan senarai menegak seperti kebanyakan portal berita biasa. Setiap kad mempunyai ruang fizikal tetap mengikut bentuknya, manakala kandungan disusun mengikut pertimbangan editorial. Kandungan editorial diisi oleh editor, manakala Jalur Berita Semasa menarik tajuk terkini daripada suapan RSS sumber luar. Yang dipaparkan sekarang ialah kandungan pemegang tempat, muncul pada ruang yang belum diisi kandungan sebenar.' },
      ],
      MENEGAK: [
        { desk: 'Bidang', topik: 'Pengelasan', title: 'Setiap Slot Dikhususkan untuk Satu Bidang pada Satu-satu Masa', brief: 'Semua kandungan dalam slot itu, termasuk item bergilir, mesti berada dalam Bidang sama; Topik pula bebas berbeza asalkan masih kekal dalam Bidang tersebut, dan diisi oleh editor semasa menulis kandungan.', briefLong: 'Bidang ialah kategori yang ditetapkan pada sesuatu slot, contohnya Ekonomi atau Kebudayaan. Editor tidak memilih Bidang setiap kali menulis kerana Bidang slot telah ditetapkan terlebih dahulu. Topik pula medan bebas bagi setiap kandungan dan boleh berbeza-beza dalam slot yang sama, asalkan masih berada dalam Bidang tersebut. Label pada kad memaparkan Bidang diikuti Topik. Ketua Editor boleh menukar Bidang sesuatu slot; kandungan sedia ada yang tidak lagi sepadan akan diarkibkan automatik, manakala kandungan baharu terus mengikut Bidang yang dikemas kini.' },
        { desk: 'Paparan', topik: 'Tiga Pengalaman', title: 'Frontpage, Ticker dan Focus View Ialah Tiga Pengalaman Membaca', brief: 'Muka depan mengimbas pelbagai bidang sekali pandang, jalur berita bergerak untuk perkembangan pantas, manakala Focus View memaparkan huraian penuh sesuatu kandungan bersama lampiran visual jika ada, dibuka apabila kandungan diklik.', briefLong: 'Muka depan memaparkan susunan kad bento yang membolehkan pembaca mengimbas pelbagai bidang sekali pandang. Jalur Berita Semasa di bahagian atas pula bergerak memaparkan tajuk terkini daripada suapan luar, sesuai untuk perkembangan yang cepat berubah. Focus View ialah paparan penuh skrin yang dibuka apabila sesuatu kandungan diklik, dan di situlah huraian panjang dipaparkan sepenuhnya bersama lampiran visual jika ada. Ketiga-tiganya menyampaikan bahan yang sama daripada sudut berlainan mengikut cara pembaca mahu membacanya.' },
        { desk: 'Editorial', topik: 'Semakan', title: 'Kandungan Melalui Semakan Sebelum Tersiar kepada Pembaca', brief: 'Editor yang belum mempunyai kebenaran terbit menghantar kandungan untuk diluluskan Ketua Editor atau Penolong; kandungan yang ditolak dipulangkan sebagai draf, bukan hilang, dan boleh dihantar semula selepas disunting.', briefLong: 'Kandungan yang dihantar oleh editor tidak semestinya terus tersiar. Jika editor mempunyai kebenaran terbit dan kandungan itu belum pernah ditolak, ia boleh terus menjadi Aktif. Jika tidak, ia mendarat sebagai Menunggu Semakan untuk keputusan Ketua Editor atau Penolong. Sekiranya ruang dalam slot sudah penuh, kandungan yang telah lulus akan menunggu sebagai Menunggu Slot Kosong dan naik taraf secara automatik apabila ruang terbuka. Kandungan yang ditolak tidak hilang, sebaliknya dipulangkan sebagai draf yang boleh disunting semula dan dihantar kembali oleh editor berkenaan.' },
      ],
      STANDARD: [
        { desk: 'Kandungan', topik: 'Bajet Ruang', title: 'Tajuk dan Huraian Berkongsi Satu Bajet Ruang Kad', brief: 'Tajuk panjang berpasangan huraian pendek boleh muat, begitu juga sebaliknya, tetapi kedua-duanya panjang serentak akan disekat semasa disimpan.', briefLong: 'Tajuk dan huraian sesebuah kad tidak mempunyai dua had berasingan, sebaliknya berkongsi satu bajet ruang yang sama. Ini bermakna tajuk panjang berpasangan dengan huraian pendek boleh muat, begitu juga sebaliknya, tetapi kedua-duanya panjang serentak tidak akan diterima. Semasa menulis, penunjuk bajet memaparkan peratusan ruang yang telah digunakan dan bertukar warna apabila menghampiri atau melepasi had. Apabila bajet dilepasi, penerbitan disekat sehingga salah satu medan dipendekkan oleh editor sendiri, bukan dipendekkan secara automatik oleh sistem.' },
        { desk: 'Kandungan', topik: 'Status', title: 'Kandungan Bergerak Antara Aktif, Menunggu dan Arkib', brief: 'Kandungan terbitan boleh dipadam oleh Ketua Editor atau Penolong, tetapi masuk Tong Sampah dahulu, bukan terus hilang.', briefLong: 'Setiap kandungan yang telah diterbitkan berada dalam salah satu status: Aktif jika sedang dipaparkan pada slotnya, atau Arkib jika telah digantikan oleh kandungan lebih baharu tetapi rekodnya masih disimpan. Hanya Ketua Editor atau Penolong Ketua Editor boleh memadam kandungan yang pernah diterbitkan; tindakan pertama memindahkannya ke Tong Sampah. Kandungan dalam Tong Sampah boleh dipulihkan sehingga dipadam kekal, sama ada melalui tindakan manual kedua atau secara automatik selepas 30 hari. Draf yang belum pernah diterbitkan berbeza sifatnya dan boleh dipadam terus oleh penulisnya sendiri.' },
        { desk: 'Editorium', topik: 'Peranan', title: 'Tiga Peranan Mengendalikan Bilik Editorial', brief: 'Editor mencipta dan menerbitkan kandungan sendiri, manakala Penolong Ketua Editor dan Ketua Editor mempunyai kuasa menyunting, meluluskan dan menolak kandungan.', briefLong: 'Bilik Editorial mempunyai tiga peranan yang terlibat secara langsung dalam pengurusan kandungan. Editor mencipta dan menerbitkan kandungan sendiri. Penolong Ketua Editor dan Ketua Editor boleh menyunting, meluluskan dan menolak kandungan semua editor. Ketua Editor turut mengurus Bidang bagi setiap slot dan Nota Ketua Editor. Pentadbir pula mengurus Direktori, Tetapan, Matriks Kebenaran Peranan dan Log Sistem, di luar aliran kerja editorial.' },
      ],
      SEGI_EMPAT_MEDIUM: [
        { desk: 'Editorial', topik: 'Sumber', title: 'Setiap Kandungan Menyatakan Sumbernya', brief: 'Nama sumber, pautan dan tarikh asal dipaparkan pada kad.', briefLong: 'Setiap kandungan yang diterbitkan membawa maklumat sumbernya. Nama sumber, pautan rujukan dan tarikh asal (jika ada) dipaparkan pada kad dan Focus View, bukan sekadar hiasan pada paparan. Jenis sumber turut direkodkan tetapi buat masa ini kekal maklumat dalaman, tidak dipaparkan kepada pembaca. Nama editor yang menerbitkan turut dicatat secara berasingan daripada kaedah kandungan itu dicipta, supaya jelas siapa bertanggungjawab dan bagaimana bahan itu masuk ke dalam sistem. Kandungan lama yang wujud sebelum medan ini diperkenalkan dipaparkan seadanya tanpa nama direka.' },
        { desk: 'Kandungan', topik: 'Menunggu Slot', title: 'Kandungan Lulus Boleh Menunggu Giliran Slot', brief: 'Naik taraf automatik sebaik ruang slot terbuka.', briefLong: 'Setiap slot pada muka depan hanya boleh memaparkan bilangan kandungan aktif yang terhad pada satu masa. Apabila kandungan baharu diluluskan tetapi slot sasarannya sudah penuh, ia tidak hilang atau ditolak, sebaliknya menunggu dengan status Menunggu Slot Kosong. Sebaik salah satu kandungan aktif dalam slot itu digantikan atau tamat tempoh, kandungan yang menunggu naik taraf secara automatik tanpa perlu tindakan tambahan daripada editor. Susunan giliran mengikut masa kelulusan, memastikan kandungan yang lebih dahulu lulus turut lebih dahulu tersiar.' },
        { desk: 'Paparan', topik: 'Kestabilan', title: 'Kad Bergilir Tidak Berubah Tinggi Semasa Bertukar', brief: 'Tinggi kad dikunci ikut item tertinggi.', briefLong: 'Sesetengah kad memaparkan lebih daripada satu kandungan secara bergilir dalam satu slot yang sama. Untuk kad sebegini, tinggi kad dikunci mengikut item tertinggi dalam senarai, diukur sebenar daripada kandungan yang dipaparkan, bukan anggaran tetap. Ini memastikan pertukaran antara kandungan tidak menyebabkan kad berubah saiz secara tiba-tiba, yang boleh membuat muka depan kelihatan bergerak-gerak semasa dibaca. Mekanisme ini hanya aktif apabila slot memang mempunyai lebih daripada satu kandungan; slot dengan satu kandungan bergantung sepenuhnya kepada semakan bajet ruang semasa disimpan.' },
      ],
      SEGI_EMPAT_SMALL: [
        { desk: 'Susun Atur', topik: 'Slot dan Tier', title: 'Tiga Puluh Lapan Slot, Lapan Tier Kad', brief: 'Setiap tier ada saiz tetap.', briefLong: 'Muka depan Adjung Brief disusun daripada tiga puluh lapan slot, dan setiap slot tergolong dalam salah satu daripada lapan tier bentuk kad. Tier menentukan saiz fizikal kad, dan daripada saiz itulah had ruang kandungan diperoleh. Kad besar memberi ruang lebih lapang berbanding kad padat yang hanya memaparkan tajuk. Peraturan penting di sini ialah semua slot dalam tier yang sama dilayan sama rata: sebarang had atau pembetulan dikenakan pada peringkat tier, tidak pernah pada satu slot secara berasingan.' },
        { desk: 'Kandungan', topik: 'Had Aksara', title: 'Had Aksara Disemak Semasa Simpan', brief: 'Disemak sebelum jadi rekod.', briefLong: 'Had aksara bagi tajuk dan huraian berbeza mengikut tier kad kerana ia diperoleh daripada saiz fizikal kad yang sebenar, bukan angka yang ditetapkan secara sewenang-wenangnya. Semakan dilakukan pada peringkat simpan, iaitu sebelum kandungan menjadi rekod, dan berlaku pada setiap laluan penyimpanan tanpa pengecualian. Jika kandungan tidak muat, sistem menolak simpanan dan menyatakan sebabnya supaya editor boleh memendekkan sendiri bahagian yang perlu. Sistem tidak sekali-kali memotong tulisan editor secara automatik.' },
        { desk: 'Peraturan', topik: 'Padam vs Arkib', title: 'Padam Terbitan Lalui Tong Sampah', brief: 'Boleh dipulihkan sebelum kekal.', briefLong: 'Arkib dan Tong Sampah membawa maksud berbeza. Arkib ialah keadaan sejarah penerbitan — kandungan yang pernah Aktif tetapi telah digantikan, rekodnya kekal disimpan. Tong Sampah pula laluan pemadaman: hanya Ketua Editor atau Penolong Ketua Editor boleh menghantar kandungan terbitan atau Arkib ke situ. Kandungan dalam Tong Sampah boleh dipulihkan kembali ke status asalnya sehingga ia dipadam kekal, sama ada dipadam semula secara manual atau dipadam automatik selepas 30 hari berlalu. Editor biasa tidak mempunyai kuasa memadam kandungan yang pernah diterbitkan.' },
      ],
      KOMPAK: [
        { desk: 'Editorium', topik: 'Draf Saya', title: 'Draf Saya Menyimpan Kandungan Sebelum Dihantar', brief: 'Simpan dahulu.', briefLong: 'Draf Saya menyimpan kandungan sebelum dihantar untuk semakan. Editor boleh menulis, menyimpan dan menyunting semula draf pada bila-bila masa sebelum menghantarnya. Apabila kandungan yang dihantar ditolak, ia tidak hilang — ia dipulangkan sebagai draf supaya boleh disunting semula dan dihantar sekali lagi. Draf dikenal pasti sebagai milik seseorang penulis melalui tanda "Penulis:" pada teksnya. Apabila draf akhirnya diterbitkan, ia bertukar menjadi kandungan sebenar lengkap dengan Bidang, Topik dan sejarah versi.' },
        { desk: 'Paparan', topik: 'Label Kad', title: 'Label Kad Memaparkan Bidang Diikuti Topik', brief: 'Warisi Bidang.', briefLong: 'Setiap kad pada muka depan memaparkan label ringkas di bahagian atas, disusun sebagai Bidang diikuti Topik, dipisahkan dengan tanda garis kecil apabila kedua-duanya wujud. Kandungan lama yang wujud sebelum medan Topik diperkenalkan hanya memaparkan Bidang sahaja, tanpa cuba mengagak atau mengisi Topik yang tiada. Warna label mengikuti warna Bidang induknya, supaya kandungan daripada Bidang yang sama kelihatan konsisten walaupun Topiknya berbeza-beza antara satu kad dengan yang lain di seluruh muka depan.' },
        { desk: 'Kandungan', topik: 'Medan', title: 'Setiap Kandungan Menggunakan Set Medan yang Sama', brief: 'Satu borang.', briefLong: 'Tidak kira Bidang atau tier kadnya, setiap kandungan editorial membawa set medan yang sama: tajuk, huraian, huraian panjang, sumber, pautan dan Topik. Editor mengisi medan ini melalui borang yang sama di Editorium, tidak kira sekecil mana kad yang akan memaparkannya. Sesetengah medan tidak dipaparkan pada kad tertentu kerana ruangnya terhad, tetapi ia tetap disimpan dan boleh dibaca sepenuhnya dalam Focus View. Keseragaman medan ini membolehkan sistem menyemak bajet ruang dan memaparkan kandungan secara konsisten merentasi lapan tier kad.' },
      ],
      BAR: [
        { desk: 'Prinsip', topik: 'Penerbitan', title: 'Kad Tidak Boleh Melimpah, Tiada Pengecualian', brief: '', briefLong: 'Prinsip paling asas dalam Adjung Brief ialah kandungan mesti muat dalam ruang kad yang disediakan. Peraturan ini dikuatkuasakan semasa penyimpanan, bukan diselesaikan kemudian dengan memotong paparan. Sebabnya mudah: tulisan editorial ialah tulisan sebenar, dan memotongnya secara mekanikal bermakna sebahagian maksud hilang tanpa disedari sesiapa. Oleh itu sistem memilih untuk menolak dan menyatakan sebab, supaya keputusan memendekkan dibuat oleh manusia yang memahami kandungan itu, bukan oleh peraturan susun atur.' },
        { desk: 'Berita Semasa', topik: 'Ticker', title: 'Ticker Dikecualikan Daripada Peraturan Bidang', brief: '', briefLong: 'Jalur Berita Semasa di bahagian atas muka depan memaparkan tajuk terkini yang ditarik daripada suapan RSS sumber berita luar, berbeza daripada kad bento yang diisi oleh editor. Kerana sumbernya pelbagai dan istilah desk antara portal berita tidak seragam, jalur ini tidak memaparkan Bidang seperti kad lain. Ia juga dikecualikan daripada peraturan Bidang dan Topik yang terpakai pada slot biasa. Tajuk dipaparkan bergilir supaya pembaca dapat mengimbas perkembangan terkini tanpa meninggalkan muka depan.' },
        { desk: 'Susun Atur', topik: 'Tier Sama Rata', title: 'Semua Slot dalam Tier yang Sama Dilayan Sama Rata', brief: '', briefLong: 'Semua slot yang tergolong dalam tier geometri yang sama wajib dilayan dengan peraturan yang serupa sepenuhnya. Apabila sesuatu had aksara atau pembetulan reka bentuk ditetapkan untuk satu tier, peraturan yang sama digunakan pada semua slot dalam tier tersebut, tidak pernah pada satu slot sahaja secara berasingan. Ini memastikan dua kad bertier sama sentiasa mempunyai keupayaan dan tingkah laku yang setara, tidak kira di mana kedudukannya pada muka depan. Editor boleh yakin had ruang sesuatu tier terpakai sama rata pada setiap slot yang tergolong di dalamnya.' },
        { desk: 'Kandungan', topik: 'Warna Topik', title: 'Warna Topik Mewarisi Warna Bidang Induknya', brief: '', briefLong: 'Topik ialah medan bebas had yang boleh berbeza-beza bagi setiap kandungan, tetapi ia tidak mempunyai warna sendiri. Sebaliknya, warna yang dipaparkan pada label Topik sentiasa mewarisi warna Bidang induk yang mengunci slot berkenaan. Reka bentuk ini memastikan kandungan daripada Bidang yang sama kelihatan konsisten dari segi warna walaupun Topiknya berlainan antara satu kandungan dengan yang lain, dan mengelakkan keperluan menetapkan warna berasingan bagi setiap kombinasi Topik yang mungkin wujud pada masa hadapan.' },
      ],
    };
    // Diterbitkan daripada TIER_SLOTS (2026-08-06, audit tier) — dahulu senarai ini ditaip
    // tangan. Nilainya memang betul, tapi kalau satu slot bertukar tier di GeometryConfig.js,
    // salinan tangan tertinggal SENYAP dan kad mula papar huraian yang sepatutnya tiada.
    const NO_BRIEF_SLOTS = new Set([...TIER_SLOTS.KOMPAK, ...TIER_SLOTS.BAR]);

    const fallbacks = Array.from({ length: 38 }, (_, i) => {
      const tier = getGeometryTierForIndex(i) || 'STANDARD';
      const group = ABOUT_ADJUNG_GROUPS[tier] || ABOUT_ADJUNG_GROUPS.STANDARD;
      // Kedudukan slot INI dalam senarai slot tier-nya sendiri (bukan i mentah) — supaya beberapa
      // item dalam kumpulan tier bergilir merentasi slot-slot tier itu, bukan semuanya guna item
      // pertama sahaja.
      const posInTier = (TIER_SLOTS[tier] || []).indexOf(i);
      const item = group[(posInTier < 0 ? i : posInTier) % group.length];
      return {
        desk: item.desk,
        topik: item.topik,
        title: item.title,
        brief: NO_BRIEF_SLOTS.has(i) ? '' : item.brief,
        // briefLong hanya dipapar dalam Focus View (bukan pada kad) — disertakan supaya laluan
        // penuh placeholder -> Focus View turut diuji, bukan separuh sistem sahaja.
        briefLong: item.briefLong,
        source: 'Adjung Brief',
        url: '',
        rawIndex: -(i + 1)
      };
    });


    BENTO_FALLBACKS = fallbacks;

    const result: any[] = [];
    for (let i = 0; i < 38; i++) {
      const customItem = list.find(item => item.rawIndex === i + 1);
      const fallbackItem = { ...fallbacks[i] };
      const limits = getLimitsForIndex(i, customItem);
      
      if (fallbackItem.desk) {
        fallbackItem.desk = fallbackItem.desk
          .replace(/SLOT (\d+)/g, (match, p1) => `SLOT ${parseInt(p1) + 1}`)
          .replace(/BAR (\d+)/g, (match, p1) => `BAR ${parseInt(p1) + 1}`);
      }

      // A Manual-mode slot with no configured content still returns ONE item from the server (title
      // empty, desk defaulted to 'general') rather than nothing — so `customItem` alone isn't enough
      // to tell "genuinely no content" apart from "has real content". Without this check, that empty
      // shell's desk ('general') would leak through while only the title fell back to the About
      // Adjung placeholder, mixing an unrelated label with unrelated title/brief text.
      const hasRealContent = !!(customItem && customItem.title);

      let itemToPush: any;
      if (hasRealContent) {
        let finalDesk = customItem.desk || '';
        if (!finalDesk || finalDesk.trim().startsWith('SLOT ') || finalDesk.trim().startsWith('BAR ')) {
          finalDesk = 'Kandungan';
        }
        itemToPush = {
          ...customItem,
          desk: finalDesk,
          title: customItem.title,
          brief: customItem.brief !== undefined ? customItem.brief : fallbackItem.brief,
          source: customItem.source || fallbackItem.source,
          url: customItem.url || fallbackItem.url || '#',
          rawIndex: customItem.rawIndex !== undefined ? customItem.rawIndex : fallbackItem.rawIndex
        };
      } else if (!hasLoadedContent) {
        // Real content hasn't arrived from the server yet — show a neutral blank placeholder
        // instead of the character-limit reference text, so it doesn't briefly read as real news.
        itemToPush = { desk: '', title: '', brief: '', source: '', url: '#', rawIndex: fallbackItem.rawIndex, isLoadingPlaceholder: true };
      } else {
        itemToPush = { ...fallbackItem };
      }

      if (itemToPush.title) {
        itemToPush.title = padToLimit(itemToPush.title, limits.maxTitle);
      }
      if (itemToPush.brief && limits.maxBrief > 0) {
        itemToPush.brief = padToLimit(itemToPush.brief, limits.maxBrief);
      }

      if (TIER_SLOTS.BAR.includes(i)) {
        itemToPush.source = itemToPush.source || '19 Jul 2026';
        if (itemToPush.source.length > 25) {
          itemToPush.source = itemToPush.source.substring(0, 25);
        }
      }
      // Sumber berbilang (2026-08-05, permintaan Izzat) — kad terhad ruang, tak boleh senaraikan
      // semua sumber. Bila kandungan ada LEBIH DARIPADA SATU sumber, kad papar label generik
      // "Editorial Adjung" (bukan nama sumber pertama sahaja — itu mengelirukan, seolah cuma
      // satu sumber dipakai). Focus View (ruang lebih) papar senarai PENUH — lihat
      // `itemToPush.sources` dihantar terus (bukan diubah) untuk kegunaan Focus View di bawah.
      // DUA tempat: `itemToPush.source` sendiri (label statik kad — banyak tapak render baca
      // terus daripada objek slot peringkat atas ni, BUKAN per-item carousel) DAN setiap
      // `itemToPush.items[j].source` (slot carousel berbilang kandungan — setiap item boleh ada
      // bilangan sumber BERBEZA, jadi mesti disemak satu-satu, bukan warisi keputusan item
      // pertama). Tanpa baris kedua ni, kandungan carousel BUKAN item pertama slot yang ada >1
      // sumber tak pernah dapat label "Editorial Adjung" walaupun betul patut.
      if (Array.isArray(itemToPush.sources) && itemToPush.sources.length > 1) {
        itemToPush.source = 'Editorial Adjung';
      }
      if (Array.isArray(itemToPush.items)) {
        itemToPush.items = itemToPush.items.map((it: any) => (
          Array.isArray(it.sources) && it.sources.length > 1 ? { ...it, source: 'Editorial Adjung' } : it
        ));
      }
      if (itemToPush.desk === 'BELUM DIKELASKAN') {
        itemToPush.desk = 'SEMASA';
      }
      if (itemToPush.desk && !itemToPush.categoryColor) {
        itemToPush.categoryColor = categoryColors[itemToPush.desk.toLowerCase()];
      }
      itemToPush.index = i;
      // Slot Bar tanpa kandungan acara sebenar TIDAK guna fallback fakta abstrak ABOUT_ADJUNG_GROUPS
      // (label/lencana "Terbuka" tu direka utk kad berita generik, mengelirukan pada kad acara --
      // sebab asal S1 ditarik balik). undefined di sini diisi balik oleh barEmptyItem semasa render
      // (Tarikh=hari ini, Penganjur=Adjung Brief, Tajuk=Belum Ada Acara, keputusan Izzat 2026-08-11)
      // -- kluster/label kekal SENTIASA papar, cuma kandungan kad yg berbeza.
      result.push(TIER_SLOTS.BAR.includes(i) && !hasRealContent ? undefined : itemToPush);
    }

    return result;
  }, [parsedNewsItems, hasLoadedContent, categoryColors]);

  const [carouselIndices, setCarouselIndices] = useState<{[key: number]: number}>({});

  // Navigasi manual (klik anak panah / leret) untuk kad carousel — permintaan Izzat 2026-08-02:
  // pembaca tak patut perlu tunggu putaran automatik untuk lihat kandungan seterusnya. Guna
  // wraparound SAMA seperti timer automatik di bawah (moden % items.length) supaya kelakuan
  // konsisten; timer automatik itu sendiri TIDAK direset/diberhentikan oleh navigasi manual — ia
  // terus berjalan ikut jadual sedia ada (paling ringkas & selamat, tak sentuh seni bina timer).
  const majuKarusel = React.useCallback((slotIdx: number, items: any[], arah: 1 | -1) => {
    if (!items || items.length <= 1) return;
    setCarouselIndices(prev => {
      const semasa = prev[slotIdx] || 0;
      const seterus = (semasa + arah + items.length) % items.length;
      return { ...prev, [slotIdx]: seterus };
    });
  }, []);

  // Tetapan Am Slot (Editorium → Slot → Tetapan Am). Lalai `true` supaya kelakuan sedia ada kekal
  // sekiranya panggilan gagal — bukan senyap-senyap tukar kepada "sentiasa mula di kandungan 1".
  const [mulaIkutMasa, setMulaIkutMasa] = useState(true);
  // Jenis animasi transisi carousel (Fasa 7, 2026-08-04) — tetapan Am Slot, terpakai pada SEMUA
  // carousel bento sekali gus. Lalai 'pudar' (opacity fade sedia ada) supaya kelakuan tak berubah
  // sekiranya panggilan gagal.
  const [tetapanAnimasiMentah, setTetapanAnimasiMentah] = useState({
    jenisAnimasi: 'colophon', arahAnimasi: 'kanan', warnaPanelTransisi: '#802334', nisbahPenajaTransisi: 0,
    animasiAktif: true, kelajuanAnimasi: 1,
  });
  // Saiz fon Focus View (2026-08-04, permintaan Izzat) — SATU tetapan GLOBAL, bukan per-Bidang/tier.
  // Lalai 1 / 15px sepadan kelakuan sedia ada sekiranya panggilan gagal.
  const [tetapanFontFocusView, setTetapanFontFocusView] = useState({ titleSizeScale: 1, bodySizePx: 15 });
  useEffect(() => {
    fetch('/api/system/slot-am-settings')
      .then(r => r.json())
      .then(d => {
        if (d && d.mulaIkutMasa !== undefined) setMulaIkutMasa(!!d.mulaIkutMasa);
        if (d) {
          setTetapanAnimasiMentah({
            jenisAnimasi: d.jenisAnimasi || 'colophon',
            arahAnimasi: d.arahAnimasi || 'kanan',
            warnaPanelTransisi: d.warnaPanelTransisi || '#802334',
            nisbahPenajaTransisi: Number(d.nisbahPenajaTransisi) || 0,
            animasiAktif: d.animasiAktif !== 0,
            kelajuanAnimasi: Number(d.kelajuanAnimasi) || 1,
          });
          setTetapanFontFocusView({
            titleSizeScale: Number(d.focusViewTitleScale) || 1,
            bodySizePx: Number(d.focusViewBodySize) || 15,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Penaja bulan semasa (2026-08-05, Fasa 12) — footer papar "Portal ini disokong oleh:" HANYA
  // bila ada penaja utk bulan ni (keadaan kosong jujur — sembunyi terus, bukan baris kosong).
  // Boleh berbilang penaja serentak (keputusan Izzat); klik mana-mana bahagian baris ni bawa ke
  // /penaja (senarai PENUH, bukan terus ke laman penaja masing-masing). `tayangSemasaTransisi`
  // (2026-08-05) menentukan penaja mana LAYAK muncul dalam giliran panel transisi — lihat
  // ambilLogoTransisi di bawah.
  const [penajaSemasa, setPenajaSemasa] = useState<{ id: string; nama: string; logoUrl: string; tayangSemasaTransisi?: boolean }[]>([]);
  React.useEffect(() => {
    let dibatal = false;
    fetch('/api/public/sponsors/semasa')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!dibatal) setPenajaSemasa(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { dibatal = true; };
  }, []);

  // Giliran logo Adjung/penaja (2026-08-05) — dua ref kekal antara panggilan (BUKAN state — tak
  // perlu re-render bila giliran maju, cuma perlu nilai TERKINI setiap kali dipanggil):
  // `putaranRef` kira setiap giliran (Adjung ATAU penaja), `indeksPenajaRef` kira giliran PENAJA
  // sahaja supaya round-robin penaja terus maju merentasi kitaran (bukan reset setiap kitaran).
  const putaranTransisiRef = useRef(0);
  const indeksPenajaTransisiRef = useRef(0);
  const penajaLayakTransisi = React.useMemo(
    () => penajaSemasa.filter((p: any) => p.tayangSemasaTransisi),
    [penajaSemasa]
  );
  // `mod` (2026-08-07, Pelan 03) — pilihan logo PER-SLOT mengatasi giliran am:
  //   'adjung' logo Adjung sahaja · 'penaja' penaja sahaja (jatuh balik Adjung bila tiada penaja
  //   layak, supaya panel TIDAK PERNAH kosong) · 'tiada' tanpa logo · '' ikut giliran am di bawah.
  const ambilLogoTransisi = React.useCallback((mod?: string): LogoTransisi => {
    if (mod === 'tiada') return { jenis: 'tiada' };
    if (mod === 'adjung') return { jenis: 'adjung' };
    if (mod === 'penaja') {
      if (penajaLayakTransisi.length === 0) return { jenis: 'adjung' };
      const p = penajaLayakTransisi[indeksPenajaTransisiRef.current % penajaLayakTransisi.length];
      indeksPenajaTransisiRef.current += 1;
      return { jenis: 'penaja', logoUrl: p.logoUrl, nama: p.nama };
    }
    const nisbah = tetapanAnimasiMentah.nisbahPenajaTransisi;
    if (nisbah <= 0 || penajaLayakTransisi.length === 0) return { jenis: 'adjung' };
    const kitaran = nisbah + 1;
    const posisi = putaranTransisiRef.current % kitaran;
    putaranTransisiRef.current += 1;
    if (posisi === 0) return { jenis: 'adjung' };
    const p = penajaLayakTransisi[indeksPenajaTransisiRef.current % penajaLayakTransisi.length];
    indeksPenajaTransisiRef.current += 1;
    return { jenis: 'penaja', logoUrl: p.logoUrl, nama: p.nama };
  }, [tetapanAnimasiMentah.nisbahPenajaTransisi, penajaLayakTransisi]);

  // Arah animasi PER-SLOT (2026-08-05, permintaan Izzat: "boleh ke nak pilih arah tertentu utk
  // slot tertentu sahaja?") — dibina drpd `slotsConfig` (GET /api/system/slots) yang sudah dimuat
  // untuk keperluan lain, bukan fetch berasingan. Peta dikunci RENTETAN (bukan nombor) sebab
  // dibaca semula guna atribut DOM `data-slot` (juga rentetan) di CarouselStableBlock.
  const arahOverridePerSlot = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of slotsConfig) {
      if (s && s.arahOverride && ['kanan', 'kiri', 'atas', 'bawah'].includes(s.arahOverride)) {
        m[String(s.slotIndex)] = s.arahOverride;
      }
    }
    return m;
  }, [slotsConfig]);
  const arahUntukSlot = React.useCallback(
    (slotIndexStr: string | null | undefined): string =>
      (slotIndexStr != null && arahOverridePerSlot[slotIndexStr]) || tetapanAnimasiMentah.arahAnimasi,
    [arahOverridePerSlot, tetapanAnimasiMentah.arahAnimasi]
  );

  // Jenis animasi PER-SLOT (2026-08-07, permintaan Izzat) — cermin arahOverridePerSlot/
  // arahUntukSlot di atas, tapi baca slots_config.jenisAnimasiOverride (ditetapkan di Senarai
  // Slot → Tetapan Kad, BUKAN Tetapan Am Slot).
  const jenisAnimasiOverridePerSlot = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of slotsConfig) {
      if (s && s.jenisAnimasiOverride && ['pudar', 'colophon', 'sapuan_lajur', 'gerak_susun'].includes(s.jenisAnimasiOverride)) {
        m[String(s.slotIndex)] = s.jenisAnimasiOverride;
      }
    }
    return m;
  }, [slotsConfig]);
  const jenisAnimasiUntukSlot = React.useCallback(
    (slotIndexStr: string | null | undefined): string =>
      (slotIndexStr != null && jenisAnimasiOverridePerSlot[slotIndexStr]) || tetapanAnimasiMentah.jenisAnimasi,
    [jenisAnimasiOverridePerSlot, tetapanAnimasiMentah.jenisAnimasi]
  );

  // Warna panel / kelajuan / logo PER-SLOT (2026-08-07, Pelan 03 — arahan Izzat: "saya nak
  // frontpage tidak membosankan"). Ketiga-tiganya cermin corak arahOverridePerSlot di atas:
  // baca slots_config, '' bermakna ikut tetapan am. Peta dikunci RENTETAN sebab dibaca semula
  // daripada atribut DOM `data-slot`.
  const warnaPanelPerSlot = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of slotsConfig) {
      // Hanya terima hex 6-digit — nilai rosak diabaikan supaya panel tak jadi lutsinar/hitam.
      if (s && typeof s.warnaPanelOverride === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.warnaPanelOverride)) {
        m[String(s.slotIndex)] = s.warnaPanelOverride;
      }
    }
    return m;
  }, [slotsConfig]);
  const warnaPanelUntukSlot = React.useCallback(
    (slotIndexStr: string | null | undefined): string =>
      (slotIndexStr != null && warnaPanelPerSlot[slotIndexStr]) || tetapanAnimasiMentah.warnaPanelTransisi,
    [warnaPanelPerSlot, tetapanAnimasiMentah.warnaPanelTransisi]
  );

  const kelajuanPerSlot = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of slotsConfig) {
      const n = Number(s?.kelajuanOverride);
      // Julat waras sahaja (0.25x–4x) — nilai luar julat/kosong jatuh ke tetapan am.
      if (Number.isFinite(n) && n >= 0.25 && n <= 4) m[String(s.slotIndex)] = n;
    }
    return m;
  }, [slotsConfig]);
  const kelajuanUntukSlot = React.useCallback(
    (slotIndexStr: string | null | undefined): number =>
      (slotIndexStr != null && kelajuanPerSlot[slotIndexStr]) || tetapanAnimasiMentah.kelajuanAnimasi,
    [kelajuanPerSlot, tetapanAnimasiMentah.kelajuanAnimasi]
  );

  const logoModePerSlot = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of slotsConfig) {
      if (s && ['adjung', 'penaja', 'tiada'].includes(s.logoTransisiMode)) {
        m[String(s.slotIndex)] = s.logoTransisiMode;
      }
    }
    return m;
  }, [slotsConfig]);
  const logoModeUntukSlot = React.useCallback(
    (slotIndexStr: string | null | undefined): string =>
      (slotIndexStr != null && logoModePerSlot[slotIndexStr]) || '',
    [logoModePerSlot]
  );

  const tetapanAnimasi = React.useMemo<TetapanAnimasiCarousel>(
    () => ({
      ...tetapanAnimasiMentah, ambilLogoTransisi, arahUntukSlot, jenisAnimasiUntukSlot,
      warnaPanelUntukSlot, kelajuanUntukSlot, logoModeUntukSlot,
    }),
    [tetapanAnimasiMentah, ambilLogoTransisi, arahUntukSlot, jenisAnimasiUntukSlot,
     warnaPanelUntukSlot, kelajuanUntukSlot, logoModeUntukSlot]
  );

  useEffect(() => {
    const activeTimers: { timeoutId?: any; intervalId?: any }[] = [];

    rawBentoNewsItems.forEach((slotItem) => {
      if (!slotItem) return;
      const actualSlotIdx = slotItem.rawIndex > 0 ? slotItem.rawIndex - 1 : slotItem.index;
      
      const items = slotItem.items || [];
      if (items.length <= 1) return;

      const initialDelaySecs = slotItem.carouselDelay || 0;
      const intervalSecs = slotItem.carouselInterval || 10;

      // Treat the carousel as running continuously since the epoch, rather than always restarting
      // at item 0 on every page load — otherwise every visitor sees the exact same first item, which
      // gets stale fast when a slot has 10+ items. Different visits at different times land on
      // whichever item "would be showing" right now; visits within the same interval window still see
      // the same item, which is consistent rather than random. Only set once per slot per mount — this
      // effect can re-run when rawBentoNewsItems recomputes, and must not reset an in-progress rotation.
      // Boleh dimatikan (2026-07-30) — Editorium → Slot → Tetapan Am, "Mula carousel ikut masa
      // akses". Bila dimatikan, setiap lawatan bermula pada kandungan pertama.
      setCarouselIndices(prev => {
        if (prev[actualSlotIdx] !== undefined) return prev;
        const timeBasedStart = mulaIkutMasa
          ? Math.floor(Date.now() / 1000 / intervalSecs) % items.length
          : 0;
        return { ...prev, [actualSlotIdx]: timeBasedStart };
      });

      const timerRef: { timeoutId?: any; intervalId?: any } = {};
      activeTimers.push(timerRef);

      if (initialDelaySecs > 0) {
        timerRef.timeoutId = setTimeout(() => {
          setCarouselIndices(prev => {
            const currentIdx = prev[actualSlotIdx] || 0;
            const nextIdx = (currentIdx + 1) % items.length;
            return { ...prev, [actualSlotIdx]: nextIdx };
          });

          timerRef.intervalId = setInterval(() => {
            setCarouselIndices(prev => {
              const currentIdx = prev[actualSlotIdx] || 0;
              const nextIdx = (currentIdx + 1) % items.length;
              return { ...prev, [actualSlotIdx]: nextIdx };
            });
          }, intervalSecs * 1000);
        }, initialDelaySecs * 1000);
      } else {
        timerRef.intervalId = setInterval(() => {
          setCarouselIndices(prev => {
            const currentIdx = prev[actualSlotIdx] || 0;
            const nextIdx = (currentIdx + 1) % items.length;
            return { ...prev, [actualSlotIdx]: nextIdx };
          });
        }, intervalSecs * 1000);
      }
    });

    return () => {
      activeTimers.forEach(t => {
        if (t.timeoutId) clearTimeout(t.timeoutId);
        if (t.intervalId) clearInterval(t.intervalId);
      });
    };
  }, [rawBentoNewsItems, mulaIkutMasa]);

  const bentoNewsItems = React.useMemo(() => {
    return rawBentoNewsItems.map((item) => {
      if (!item) return item;
      const actualSlotIdx = item.rawIndex > 0 ? item.rawIndex - 1 : item.index;
      const itemsList = item.items || [];
      
      let resolvedItem;
      if (itemsList.length <= 1) {
        resolvedItem = { ...item };
      } else {
        const activeIdx = carouselIndices[actualSlotIdx] || 0;
        const activeItem = itemsList[activeIdx] || itemsList[0] || item;
        resolvedItem = {
          ...item,
          ...activeItem,
          isCarouselActive: true,
          carouselIndex: activeIdx
        };
      }

      const limits = getLimitsForIndex(actualSlotIdx, resolvedItem);
      const originalTitle = resolvedItem.title || '';
      const originalBrief = resolvedItem.brief || '';
      // penggalSukuKata() disisipkan DI SINI — satu titik pusat yang melindungi SEMUA pengguna
      // `item.title`/`item.brief` (termasuk BarCard) sekali gus. Ia mesti berjalan SEBELUM
      // parseInlineFormatting, kerana selepas itu nilainya bukan lagi rentetan tetapi elemen
      // React — dan penggalSukuKata memulangkan bukan-rentetan tanpa diubah, jadi memanggilnya
      // selepas ini akan gagal SENYAP (inilah yang berlaku pada percubaan pertama: kad Bar
      // langsung tiada sempang sedangkan modulnya berfungsi sempurna dalam ujian).
      // `titleString`/`briefString` di bawah kekal teks MENTAH tanpa soft hyphen — Focus View
      // dan borang penyuntingan bergantung padanya.
      if (resolvedItem.title) {
        resolvedItem.title = parseInlineFormatting(penggalSukuKata(padToLimit(resolvedItem.title, limits.maxTitle)));
      }
      if (resolvedItem.brief && limits.maxBrief > 0) {
        resolvedItem.brief = parseInlineFormatting(penggalSukuKata(padToLimit(resolvedItem.brief, limits.maxBrief)));
      }
      resolvedItem.titleString = originalTitle;
      resolvedItem.briefString = originalBrief;

      if (TIER_SLOTS.BAR.includes(actualSlotIdx)) {
        resolvedItem.source = resolvedItem.source || '19 Jul 2026';
        if (resolvedItem.source.length > 25) {
          resolvedItem.source = resolvedItem.source.substring(0, 25);
        }
      }

      return resolvedItem;
    });
  }, [rawBentoNewsItems, carouselIndices]);




  const activeNewsItem = bentoNewsItems[0];

  // Slot Bar tanpa acara sebenar — kad papar TETAP (bentuk BarCard biasa, bukan disorok/neutral),
  // dgn Tarikh=hari ini, Penganjur="Adjung Brief", Tajuk="Belum Ada Acara" (keputusan Izzat
  // 2026-08-11, satu kad per slot kosong — gantikan pendekatan sorok kluster S1 yg ditarik balik).
  const barEmptyItem = {
    title: 'Belum Ada Acara',
    organizer: 'Adjung Brief',
    originalDate: new Date().toISOString().slice(0, 10),
  };

  // ==========================================================================
  // FOCUS VIEW — logik sahaja. Persembahan ada di src/components/portal/FocusView.tsx
  // (satu fail, boleh diganti bulat-bulat bila reka bentuk baharu siap).
  //
  // Dibuka bila pengguna klik TAJUK atau HURAIAN pada kad. Dikecualikan: tier BAR
  // (ada panel Penerangan sendiri) dan Ticker (ada paparan penuh sendiri).
  // ==========================================================================

  /** Satu kedudukan kandungan: slot mana, item ke berapa dalam carousel slot tu. */
  type FocusLoc = { slotIndex: number; itemIndex: number };

  const [focusLoc, setFocusLoc] = useState<FocusLoc | null>(null);
  // Imej Focus View rosak TAK boleh ditayang automatik (2026-08-07, permintaan Izzat eksplisit)
  // — dahulu <img> mentah tanpa onError, jadi URL patah/404 papar ikon "imej rosak" pelayar terus
  // dalam Focus View. Set URL diketahui rosak: sekali gagal,
  // dikekalkan sepanjang sesi supaya tak cuba muat semula fail sama berulang kali navigasi
  // carousel. Kandungan yang imejnya SAH terus ditayang seperti biasa, tak terjejas.
  const [imejFocusViewRosak, setImejFocusViewRosak] = useState<Set<string>>(new Set());
  /** Tindanan lokasi dilawati (mod navigasi rawak) — entri terakhir ialah `focusLoc` semasa.
   *  "Sebelum" ialah UNDUR sejarah ni, BUKAN lompat rawak baharu — padan corak "Rawak" Wikipedia +
   *  butang undur pelayar, bukan carousel dua-hala. */
  const [focusHistory, setFocusHistory] = useState<FocusLoc[]>([]);
  /** Sasaran "seterusnya" rawak, DIGULUNG SEBELUM diklik (bukan pada saat klik) — supaya teks
   *  preview di sebelah anak panah bawah sepadan TEPAT dengan destinasi sebenar bila ditekan. */
  const [nextRandomLoc, setNextRandomLoc] = useState<FocusLoc | null>(null);
  /** Mod navigasi "Seterusnya" Focus View (2026-08-05, permintaan Izzat — "ada butang utk pilih
   *  turutan atau rawak"). 'rawak' (lalai, sedia ada) = merentasi laman elak Bidang sama berturut;
   *  'turutan' = ikut susunan slot (Hero dulu, kemudian slot 2, 3, ...), guna urutan focusAllLocations
   *  sedia ada (sudah tersusun ikut slotIndex→itemIndex). Ditukar butang di Focus View sendiri (kedua
   *  telefon & desktop), kekal sepanjang sesi (tak reset tiap navigasi/buka semula). */
  const [focusNavMode, setFocusNavMode] = useState<'rawak' | 'turutan'>('rawak');

  /** Senarai item bagi satu slot — carousel penuh, atau slot itu sendiri kalau tunggal. */
  const focusItemsForSlot = React.useCallback((slotIndex: number): any[] => {
    const slot = bentoNewsItems[slotIndex];
    if (!slot) return [];
    return slot.items && slot.items.length > 0 ? slot.items : [slot];
  }, [bentoNewsItems]);

  /** Semua kedudukan yang layak masuk Focus View (BAR & Ticker dikecualikan). */
  const focusAllLocations = React.useMemo<FocusLoc[]>(() => {
    const out: FocusLoc[] = [];
    bentoNewsItems.forEach((slot: any, slotIndex: number) => {
      if (!slot) return;
      if (getGeometryTierForIndex(slotIndex) === 'BAR') return;
      const list = slot.items && slot.items.length > 0 ? slot.items : [slot];
      list.forEach((_: any, itemIndex: number) => out.push({ slotIndex, itemIndex }));
    });
    return out;
  }, [bentoNewsItems]);

  // Buka ikut RUJUKAN item, bukan nombor slot. Sengaja: pencetus klik ada di 33 tempat dalam
  // fail ni, dan kalau setiap satu kena taip nombor slot sendiri, satu salah taip = kad buka
  // kandungan slot lain — jenis pepijat senyap yang paling susah dikesan. Cara ni buat semua
  // 33 suntingan jadi teks yang sama betul: onClick={focusClick(it)}.
  const openFocus = (item: any) => {
    if (!item) return;
    const loc = focusAllLocations.find(
      l => focusItemsForSlot(l.slotIndex)[l.itemIndex] === item
    );
    if (loc) { setFocusLoc(loc); setFocusHistory([loc]); }
  };

  /** Pengendali klik untuk tajuk/huraian pada kad. */
  const focusClick = (item: any) => (e: React.MouseEvent) => {
    e.stopPropagation();
    openFocus(item);
  };

  const closeFocus = () => setFocusLoc(null);

  // Pautan mendalam per-kandungan (Fasa 9, 2026-08-05) — bila pembaca mendarat terus di
  // /:bidangSlug/kandungan/:kodPendek (App.tsx hantar kod tu sebagai `deepLinkKodPendek`), buka
  // Focus View kandungan berkenaan automatik SEKALI sahaja bila data slot dah sedia
  // (`focusAllLocations.length > 0` — bukan setiap kali bentoNewsItems recompute, carousel
  // automatik buat ni kerap, lihat nota `sudahBuka` di bawah). Kod tak sah (404 API) — senyap,
  // pembaca lihat muka depan biasa (bukan ralat menakutkan untuk pautan lama/rosak).
  const sudahBukaDeepLink = React.useRef(false);
  React.useEffect(() => {
    if (!deepLinkKodPendek || sudahBukaDeepLink.current || focusAllLocations.length === 0) return;
    sudahBukaDeepLink.current = true;
    fetch(`/api/system/content/by-kod/${encodeURIComponent(deepLinkKodPendek)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return;
        const loc = focusAllLocations.find(l => l.slotIndex === data.slotIndex) || null;
        if (loc) { setFocusLoc(loc); setFocusHistory([loc]); }
      })
      .catch(() => {});
  }, [deepLinkKodPendek, focusAllLocations]);

  // Carian pengunjung (2026-08-05, Fasa 11 — keputusan Izzat: carian ringkas tajuk/topik).
  // Debounce 300ms elak hentam server setiap ketukan kekunci; had 2 aksara minimum sepadan
  // gerbang server (core/routes/searchRoutes.js). Hasil sentiasa kandungan TERBIT sahaja
  // (approved) — draf/pending tak boleh dicecah pembaca.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  // Ikon-sahaja -> slide buka kotak (2026-08-05, permintaan Izzat — kotak tetap lama "kurang
  // lawa"/makan ruang masthead sentiasa). `searchExpanded` kawal LEBAR (ikon sempit vs kotak
  // penuh); dropdown keputusan (`searchOpen`) hanya bermakna bila kotak pun terbuka.
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchBoxRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    let dibatal = false;
    const t = setTimeout(() => {
      fetch(`/api/system/search?q=${encodeURIComponent(q)}`)
        .then(r => (r.ok ? r.json() : { results: [] }))
        .then(data => { if (!dibatal) setSearchResults(data.results || []); })
        .catch(() => { if (!dibatal) setSearchResults([]); });
    }, 300);
    return () => { dibatal = true; clearTimeout(t); };
  }, [searchQuery]);

  const tutupCarian = React.useCallback(() => {
    setSearchOpen(false);
    setSearchExpanded(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) tutupCarian();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') tutupCarian(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [tutupCarian]);

  const bukaCarian = () => {
    setSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  /** Klik segmen Bidang/Topik pada eyebrow kad ATAU Focus View (2026-08-07, permintaan Izzat —
   *  "boleh ke kalau klik topik automatik akan search topik tu di kotak search", + "dua2 la kot"
   *  untuk Bidang sekali) — isi kotak carian dengan nilai yang diklik terus dan buka kotak.
   *  Kalau dipanggil dari DALAM Focus View (klik eyebrow artikel semasa dibaca), tutup Focus View
   *  dahulu supaya keputusan carian di frontpage kelihatan serta-merta di belakangnya, bukan
   *  tersembunyi di sebalik lapisan skrin penuh Focus View. */
  const cariDariEyebrow = (nilai: string) => {
    closeFocus();
    setSearchQuery(nilai);
    setSearchExpanded(true);
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 60);
  };

  /** Buka Focus View terus daripada keputusan carian — sama corak "usaha terbaik" seperti
   *  pautan mendalam (`by-kod`) di atas: itemIndex sentiasa 0, cukup baik memandangkan
   *  kebanyakan slot satu kandungan sahaja (lihat nota articleUrlRoutes.js). */
  const openSearchResult = (slotIndex: number) => {
    const loc = focusAllLocations.find(l => l.slotIndex === slotIndex);
    if (loc) { setFocusLoc(loc); setFocusHistory([loc]); }
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setSearchExpanded(false);
  };

  // Gulung SATU sasaran rawak baharu setiap kali focusLoc berubah (buka baharu ATAU navigasi) —
  // bukan pada saat klik — supaya preview tajuk anak panah bawah sepadan destinasi sebenar.
  // Elak sasaran = kedudukan semasa bila > 1 pilihan wujud (loop cuma ulang sekali, senarai ni
  // biasanya puluhan item, peluang perlu ulang sangat rendah).
  //
  // SENGAJA cuma `focusLoc` dalam dependency — BUKAN `focusAllLocations` juga. bentoNewsItems (dan
  // jadi focusAllLocations) recompute setiap kitaran carousel automatik (carouselIndices berubah),
  // jadi kalau focusAllLocations turut jadi dependency, effect ni tercetus semula setiap kitaran
  // (rujukan array baharu tiap kali) → setState → render semula → gelung tanpa henti, apl blank
  // (pepijat sebenar ditemui semasa ujian browser 2026-07-29). focusAllLocations dibaca via
  // closure (nilai render SEMASA bila effect tercetus daripada focusLoc berubah) — cukup, sebab
  // kita cuma perlu senarai calon SEMASA navigasi berlaku, bukan pantau perubahannya berterusan.
  useEffect(() => {
    if (!focusLoc || focusAllLocations.length === 0) { setNextRandomLoc(null); return; }
    if (focusAllLocations.length === 1) { setNextRandomLoc(null); return; }

    if (focusNavMode === 'turutan') {
      // Ikut susunan focusAllLocations sedia ada (slotIndex→itemIndex menaik, Hero dulu) — bukan
      // rawak. Cari kedudukan semasa dalam senarai, ambil seterusnya, gulung semula ke awal di hujung.
      const semasaIdx = focusAllLocations.findIndex(
        l => l.slotIndex === focusLoc.slotIndex && l.itemIndex === focusLoc.itemIndex
      );
      const seterusnyaIdx = semasaIdx === -1 ? 0 : (semasaIdx + 1) % focusAllLocations.length;
      setNextRandomLoc(focusAllLocations[seterusnyaIdx]);
      return;
    }

    const bidangSemasa = (focusItemsForSlot(focusLoc.slotIndex)[focusLoc.itemIndex]?.desk || '').toLowerCase();
    // Elak calon SAMA dgn kandungan SEBELUM ni (2026-08-07 — pepijat ditemui Izzat: pratonton
    // "Sebelum" dan "Seterusnya" kadang papar TAJUK SAMA). Punca: sasaran rawak cuma elak
    // lokasi SEMASA (focusLoc), tak elak lokasi SEBELUM (focusHistory[length-2]) — jadi bila
    // nasib buruk, sasaran rawak boleh terpilih balik ke tempat pembaca baru datang dari,
    // buat "Seterusnya" kelihatan macam "Sebelum" (dua pratonton sama). `sebelumLoc` di bawah
    // turut dielakkan sama macam focusLoc sendiri.
    const sebelumLoc = focusHistory.length >= 2 ? focusHistory[focusHistory.length - 2] : null;
    const samaLoc = (a: FocusLoc, b: FocusLoc | null) => !!b && a.slotIndex === b.slotIndex && a.itemIndex === b.itemIndex;
    // Elak Bidang SAMA berturut-turut (2026-08-04, permintaan Izzat — "supaya pembaca tak
    // tertumpu pada slot/Bidang yg sama sahaja") — cuba dapatkan calon Bidang BERBEZA dulu
    // (sehingga 20 percubaan, cukup untuk peluang tinggi walaupun senarai kecil/tak seimbang);
    // gagal (cth semua kandungan satu Bidang sahaja), jatuh balik ke rawak biasa (mana-mana
    // lokasi lain) — lebih baik ulang Bidang sekali-sekala drpd macet tanpa sasaran langsung.
    let candidate: FocusLoc | null = null;
    for (let cubaan = 0; cubaan < 20; cubaan++) {
      const c = focusAllLocations[Math.floor(Math.random() * focusAllLocations.length)];
      if (samaLoc(c, focusLoc) || samaLoc(c, sebelumLoc)) continue;
      const bidangCalon = (focusItemsForSlot(c.slotIndex)[c.itemIndex]?.desk || '').toLowerCase();
      if (bidangCalon !== bidangSemasa) { candidate = c; break; }
    }
    if (!candidate) {
      // focusAllLocations.length <= 2 bermakna mustahil elak focusLoc DAN sebelumLoc serentak
      // (tiada calon ketiga wujud) — jatuh balik terima calon yg sama dgn sebelumLoc drpd macet
      // tanpa sasaran "Seterusnya" langsung (masih elak focusLoc, keperluan asas).
      const bolehElakDua = focusAllLocations.length > 2;
      do {
        candidate = focusAllLocations[Math.floor(Math.random() * focusAllLocations.length)];
      } while (samaLoc(candidate, focusLoc) || (bolehElakDua && samaLoc(candidate, sebelumLoc)));
    }
    setNextRandomLoc(candidate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLoc, focusNavMode]);

  /** Lompat ke sasaran rawak pra-gulung (`nextRandomLoc`), tolak kedudukan semasa ke sejarah. */
  const focusNext = React.useCallback(() => {
    if (!nextRandomLoc) return;
    setFocusHistory(h => [...h, nextRandomLoc]);
    setFocusLoc(nextRandomLoc);
  }, [nextRandomLoc]);

  /** Sasaran "Sebelum" mod TURUTAN (2026-08-05, permintaan Izzat — "anggap ni loop... kandungan
   *  sebelumnya adalah kandungan terakhir"). Mod turutan ada susunan tetap (focusAllLocations),
   *  jadi "sebelum" dikira TERUS drpd kedudukan semasa (gulung ke penghujung senarai di
   *  permulaan) — BUKAN daripada sejarah dilawati. Ini bermakna kandungan PERTAMA dibuka pun
   *  terus ada "Sebelum" yang sah (kandungan terakhir dalam susunan), bukan kosong/dilumpuhkan.
   *  Mod RAWAK kekal guna sejarah dilawati (di bawah) — rawak tiada susunan tetap, jadi "sebelum"
   *  yang bermakna hanya "tempat saya datang dari", bukan gelung. */
  const prevTurutanLoc = React.useMemo<FocusLoc | null>(() => {
    if (focusNavMode !== 'turutan' || !focusLoc || focusAllLocations.length <= 1) return null;
    const idx = focusAllLocations.findIndex(
      l => l.slotIndex === focusLoc.slotIndex && l.itemIndex === focusLoc.itemIndex
    );
    if (idx === -1) return null;
    return focusAllLocations[(idx - 1 + focusAllLocations.length) % focusAllLocations.length];
  }, [focusNavMode, focusLoc, focusAllLocations]);

  /** Undur satu langkah — mod turutan gulung ke penghujung senarai (loop), mod rawak undur
   *  sejarah dilawati (BUKAN lompat rawak baharu). No-op kalau tiada sasaran/sejarah. */
  const focusPrev = React.useCallback(() => {
    if (focusNavMode === 'turutan') {
      if (!prevTurutanLoc) return;
      setFocusLoc(prevTurutanLoc);
      return;
    }
    setFocusHistory(h => {
      if (h.length <= 1) return h;
      const next = h.slice(0, -1);
      setFocusLoc(next[next.length - 1]);
      return next;
    });
  }, [focusNavMode, prevTurutanLoc]);

  // Kekunci: Esc tutup, atas/bawah gerak (mod rawak) — sama seperti paparan penuh Ticker.
  useEffect(() => {
    if (!focusLoc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFocus();
      else if (e.key === 'ArrowDown') focusNext();
      else if (e.key === 'ArrowUp') focusPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusLoc, focusNext, focusPrev]);

  /** Item mentah yang sedang dipapar, atau null. */
  const focusItem = React.useMemo(() => {
    if (!focusLoc) return null;
    return focusItemsForSlot(focusLoc.slotIndex)[focusLoc.itemIndex] || null;
  }, [focusLoc, focusItemsForSlot]);

  // Jejak pengunjung (Fasa 14) — satu kiraan setiap pembukaan Focus View, ikut nombor slot
  // (bukan id kandungan individu — item carousel dalam slot yang sama dikira sebagai satu
  // sasaran populariti "Slot N", cukup untuk "kandungan paling diminati" tanpa perlu edarkan id
  // objek editorial ke FocusView.tsx). Terlepas-pandang, sejajar corak SEO dinamik Fasa 9 di
  // FocusView.tsx (terapFocusSeo).
  React.useEffect(() => {
    if (focusLoc && focusItem) trackView('slot', focusLoc.slotIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLoc, focusItem]);

  // bentoNewsItems memarse title/brief jadi elemen React untuk dirender pada kad;
  // .titleString/.briefString simpan teks mentah. Focus View mahu yang mentah.
  const asPlainText = (v: any): string => (typeof v === 'string' ? v : '');

  // Cegah kata terakhir tajuk Focus View tersadai bersendirian di baris sendiri (2026-08-07,
  // Izzat perasan: "'like' bersendirian di baris bawah" — nampak janggal). `text-wrap: pretty`
  // pada h1 (FocusView.tsx) sudah cuba imbangkan baris terbalut, tapi disahkan HIDUP ia masih
  // membiarkan satu perkataan pendek keseorangan bila tajuk kebetulan patah begitu. Penyelesaian
  // tipografi piawai: tukar RUANG SEBELUM perkataan TERAKHIR kepada ruang tak-boleh-pecah
  // (U+00A0) — dua perkataan terakhir sentiasa kekal sebaris, tak kira di mana baris sebenarnya
  // patah. Diterapkan pada STRING mentah di sini (bukan dalam FocusView.tsx sendiri) supaya turut
  // menular ke `titleRendered` (dihantar melalui safeParseInline di bawah) MAHUPUN `title` mentah
  // (laluan telefon guna terus, lihat nota "tak perlu hyphenation" di FocusView.tsx) — satu
  // pembetulan, dua laluan render.
  const cegahKataYatimAkhir = (teks: string): string => {
    if (!teks) return teks;
    const kata = teks.trim().split(/\s+/);
    if (kata.length < 2) return teks;
    return kata.slice(0, -1).join(' ') + ' ' + kata[kata.length - 1];
  };

  /** Tajuk kandungan SEBELUM (sejarah) dan SETERUSNYA (sasaran rawak pra-gulung), untuk preview
   *  di sebelah anak panah atas/bawah Focus View. MESTI selepas `asPlainText` (bukan sebelum) —
   *  useMemo panggil callback SEGERA semasa render semasa, jadi rujuk `const` yang belum sampai
   *  baris ikrarnya lagi (asPlainText di bawah ni) kena ReferenceError zon-mati-sementara (TDZ),
   *  bukan ralat kompil — tsc tak kesan ini sebab ia rujukan dalam closure, bukan guna terus.
   *  Ditemui semasa ujian browser 2026-07-29 (skrin kosong, "Cannot access 'asPlainText' before
   *  initialization"). */
  const focusPrevTitle = React.useMemo(() => {
    const loc = focusNavMode === 'turutan'
      ? prevTurutanLoc
      : (focusHistory.length < 2 ? null : focusHistory[focusHistory.length - 2]);
    if (!loc) return undefined;
    const it = focusItemsForSlot(loc.slotIndex)[loc.itemIndex];
    return it ? (asPlainText(it.titleString) || asPlainText(it.title)) : undefined;
  }, [focusNavMode, prevTurutanLoc, focusHistory, focusItemsForSlot]);

  const focusNextTitle = React.useMemo(() => {
    if (!nextRandomLoc) return undefined;
    const it = focusItemsForSlot(nextRandomLoc.slotIndex)[nextRandomLoc.itemIndex];
    return it ? (asPlainText(it.titleString) || asPlainText(it.title)) : undefined;
  }, [nextRandomLoc, focusItemsForSlot]);
  // Peta nama Bidang (huruf kecil) -> rekod Bidang, untuk eyebrow kad mendapatkan glifnya tanpa
  // mencari senarai penuh 30 kali setiap render.
  const bidangByName = React.useMemo(() => {
    const m: Record<string, { icon: string | null; iconSvg: string | null }> = {};
    for (const b of activeBidangList) m[b.name.toLowerCase()] = { icon: b.icon, iconSvg: b.iconSvg };
    return m;
  }, [activeBidangList]);
  // Kandungan pemegang tempat (rawIndex negatif — lihat pembina `fallbacks`) SENTIASA memakai
  // simbol Adjung, walaupun nama desknya kebetulan sepadan dengan satu Bidang sebenar dalam DB.
  // Sengaja: kandungan tentang Adjung Brief tidak sepatutnya memakai ikon bidang yang tidak
  // berkaitan. Kandungan editorial SEBENAR tidak disentuh — ia terus guna Bidang DB masing-masing.
  const bidangUntuk = (item: any) =>
    (item?.rawIndex < 0) ? IKON_PLACEHOLDER_ADJUNG : bidangByName[(item?.desk || '').toLowerCase()];

  const focusBidang = focusItem
    ? activeBidangList.find(b => b.name.toLowerCase() === (focusItem.desk || '').toLowerCase())
    : undefined;






  // Blok era mockDb dibuang (2026-08-07, Tier 3.3 audit inventori) — dahulu di sini juga
  // `getInitials`/`estimateReadingTime` (pembantu untuk "Elena Vasquez"/anggaran masa bacaan
  // blok mockDb di bawah), kedua-duanya turut sifar rujukan lain selepas blok itu dibuang.
  // Yang tinggal:
  // activeFeatured/featuredAuthorName/featuredAuthorSig/dbEditorNote/tickerIndex/notices/
  // fallbackTicker/tickerItems/canCurate/noticeBoardText, kesemuanya dikira daripada prop
  // `entries` (skema `Entry[]` lama, BUKAN `editorial_objects`/`editorial_revisions` yang
  // sistem sebenar pakai sekarang). Disahkan MATI: `GET /api/db-state` sentiasa pulangkan
  // `entries: []` kod keras (core/routes/dbStateRoutes.js) — tatasusunan kosong tapi TRUTHY
  // dalam JS, jadi `entries` di App.tsx sentiasa `[]`, tak pernah fallback ke data palsu
  // mockDb.ts pun. Kesan sebenar: `activeFeatured` sentiasa jatuh ke objek statik "Elena
  // Vasquez"/"Alexandria" berkod keras, `notices`/`tickerItems`/`canCurate`/`noticeBoardText`
  // sentiasa kosong/lalai — DAN tiada satu pun daripada nilai ni pernah dirujuk dalam JSX di
  // bawah (disahkan grep sifar rujukan selain deklarasi sendiri). `setInterval` 4 saat yang
  // tak pernah nampak kesan pun turut terbuang bersama.

  return (
    // JenisAnimasiContext.Provider (Fasa 7, 2026-08-04) — bekalkan jenisAnimasi (Tetapan Am Slot)
    // kepada SEMUA 30 CarouselStableBlock bersarang tanpa perlu ubah tapak panggilan masing-masing.
    <JenisAnimasiContext.Provider value={tetapanAnimasi}>
    <div className="bg-transparent text-[#1F1F1F] font-serif w-full min-h-screen flex flex-col px-4 md:px-8 pt-4 select-none animate-fade-in">

      <div className="max-w-5xl mx-auto w-full flex-1">

        {/* Jalur utiliti editorial — bucu kanan masthead, sejajar logo. Dikemas (2026-07-29,
            permintaan pemilik projek) — frontpage TIADA butang editorial langsung lagi (Edit
            Kandungan/Tulis Kandungan/Log Keluar semua dibuang dari sini), cuma SATU pautan ke
            Editorium. Tulis Kandungan (useSlotEditor.ts), Ticker (useTickerEditor.ts), dan Bar
            (useSlotEditor.ts + BarSlotManagerModal.tsx) kini render TERUS di Editorium sendiri —
            tiada lagi navigasi/parameter URL merentas laman untuk mana-mana. Sistem suntingan
            dalaman lama (isEditMode/editingSlotIndex/formConfig/handleCardClick/
            TickerManagementModal/SlotManagerModal/borang BAR terbenam) dibuang sepenuhnya
            (2026-08-02) — sudah mati sejak `?openTicker=1` (laluan terakhir yang masih boleh set
            isEditMode=true) dibuang. */}
        <div className="flex justify-between items-center pt-2 gap-3">
          {/* Carian pengunjung (2026-08-05, Fasa 11, reka bentuk disemak semula selepas maklum
              balas Izzat "kotak tetap kurang lawa") — ikon SAHAJA lalai, klik slide-buka kotak
              ke KANAN drpd ikon (bukan overlay/modal — ikon kekal jangkar kiri masthead, kotak
              tumbuh drpd situ). Satu bekas bermorf (bukan ikon+kotak berasingan) — lebar bekas
              sendiri yang beranimasi (w-7 -> w-[220px]), input pudar masuk serentak, elak dua
              elemen background berlanggar semasa peralihan. Tutup (Escape/klik luar/pilih
              keputusan) kosongkan carian sekali, bukan sekadar sorok kotak — bukaan seterusnya
              sentiasa mula bersih. */}
          <div ref={searchBoxRef} className="relative shrink-0">
            <div
              onClick={() => { if (!searchExpanded) bukaCarian(); }}
              className={`flex items-center gap-1.5 py-1 rounded border bg-white transition-all duration-300 ease-in-out overflow-hidden ${
                searchExpanded
                  ? 'w-[220px] px-2.5 border-stone-300 focus-within:border-[#802334] cursor-text'
                  : 'w-7 px-0 justify-center border-transparent hover:border-stone-300 cursor-pointer'
              }`}
            >
              <Search size={searchExpanded ? 12 : 14} className="text-stone-400 shrink-0 transition-all duration-300" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                placeholder="Cari kandungan"
                tabIndex={searchExpanded ? 0 : -1}
                className={`min-w-0 bg-transparent outline-none font-sans text-xs text-stone-700 placeholder:text-stone-400 transition-opacity duration-200 ${
                  searchExpanded ? 'w-full opacity-100 delay-150' : 'w-0 opacity-0'
                }`}
              />
            </div>
            {searchExpanded && searchOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 top-full mt-1 w-full min-w-[280px] bg-white border border-stone-300 rounded shadow-lg z-30 max-h-[320px] overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-2.5 font-sans text-xs text-stone-400">Tiada kandungan dijumpai.</div>
                ) : (
                  <ol className="list-none m-0 p-0">
                    {searchResults.map((r) => (
                      <li key={r.objectId} className="border-b border-stone-150 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => openSearchResult(r.slotIndex)}
                          className="w-full text-left px-3 py-2.5 hover:bg-stone-50 cursor-pointer"
                        >
                          <div className="font-mono text-[9px] uppercase tracking-wide text-[#802334]">{r.topik || r.desk}</div>
                          <div className="font-serif text-sm text-stone-800 leading-snug">{r.title}</div>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>

          {/* Belum log masuk: butang ni buka borang log masuk TERUS di atas frontpage (modal),
              bukan bawa ke skrin pagar "log masuk diperlukan" di Editorium — dulu pengguna kena
              klik "Log Masuk" DUA kali untuk sampai borang yang sama. Lepas berjaya, barulah
              masuk Editorium. Skrin pagar tu kekal untuk sesiapa yang taip /editorium terus.
              Sudah log masuk: pautan biasa ke Editorium. */}
          <button
            onClick={() => {
              if (currentEditoriumRole) {
                navigate('/editorium');
                return;
              }
              onRequestEditLogin?.(() => navigate('/editorium'));
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all border font-sans cursor-pointer bg-white text-stone-600 border-stone-300 hover:text-[#802334] hover:border-[#802334] shrink-0"
          >
            <Lock size={12} /> {currentEditoriumRole ? 'Editorium' : 'Log Masuk'}
          </button>
        </div>

        {/* Wordmark Hero */}
        <section className="text-center pt-2 pb-6 animate-fade-in">
          <h1 className={`font-serif font-normal tracking-tight ${LOGO_SIZE.hero} text-[#802334]`}>
            <HoverWords text={BRAND.logoText} />
          </h1>
          <div className="flex items-center justify-center gap-3 mt-[8px] mb-1 max-w-xs mx-auto">
            <div className="h-[1px] bg-[#b4b4b4] w-12 md:w-16"></div>
            <span className="font-sans text-[11px] md:text-xs tracking-[0.25em] font-semibold text-[#b4b4b4] uppercase">{BRAND.subLabel}</span>
            <div className="h-[1px] bg-[#b4b4b4] w-12 md:w-16"></div>
          </div>
          <p className="font-sans text-[9px] md:text-[11px] tracking-editorial uppercase text-[#555555] mt-2">
            <HoverWords text={BRAND.tagline} />
          </p>
        </section>

        <hr className="rule border-t border-stone-300 my-3" />

        {/* World Clock Strip (Isolated High-Performance Component) */}
        <WorldClockStrip 
          systemSettings={systemSettings} 
          worldClockHolidaysGoogleDocText={worldClockHolidaysGoogleDocText}
          apiHolidaysData={apiHolidaysData}
        />

        <hr className="rule border-t border-stone-300 my-3" />

        {/* Landing Page quiet news panel */}
        <div
          onClick={() => {
            if (parsedTickerNewsItems.length > 0) {
              setActiveOverlayIndex(activeFrontpageIndex);
              setShowNewsOverlay(true);
            }
          }}
          className="py-1 px-0 bg-transparent hover:opacity-90 transition duration-300 cursor-pointer text-left group relative flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          {/* LEFT: TICKER SCROLLER ITEM */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {activeTickerNewsItem ? (
              <div className="select-text py-1 flex items-center overflow-hidden flex-1 gap-2.5">
                {/* Label "BERITA SEMASA" dua baris di TELEFON SAHAJA (2026-08-05, permintaan
                    Izzat, dikemas kini — pusingan pertama guna md:768 sepadan tablet turut
                    kena, dibetulkan ke sm:640 supaya tablet kekal satu baris seperti desktop,
                    cuma telefon sebenar dapat susunan dua baris). Susun menegak + rata KANAN
                    (items-end) — baris "BERITA" lebih pendek drpd "SEMASA" jadi tepi kanan
                    kedua-dua baris sejajar rapat dengan tajuk ticker di sebelah, bukan
                    tergantung rata kiri dengan jurang di sebelah kanan "BERITA". */}
                <strong
                  className="font-sans text-[11px] sm:text-xs uppercase tracking-wider font-bold shrink-0 text-[#802334] leading-[1.15] flex flex-col items-end sm:block sm:leading-normal"
                >
                  <span className="sm:hidden">BERITA</span>
                  <span className="sm:hidden">SEMASA</span>
                  <span className="hidden sm:inline"><HoverWords text="BERITA SEMASA" /></span>
                </strong>
                <AnimatePresence mode="wait">
                  <motion.h4
                    key={activeFrontpageIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    className="font-serif text-[#1F1F1F] text-[14px] md:text-lg leading-snug tracking-tight font-medium flex items-center min-h-[2lh] flex-1 min-w-0 md:items-baseline md:min-h-0 md:truncate"
                  >
                    {/* Telefon: tajuk ticker membalut kepada DUA baris (line-clamp-2) — pada lebar
                        telefon satu baris hampir sentiasa terpotong. Desktop kekal satu baris
                        terpotong (md:truncate) seperti asal.

                        min-h-[2lh] + items-center pada <h4> di atas MENSTABILKAN halaman: tajuk
                        ticker berputar, jadi tanpa tinggi tetap baris ini mengecut/mengembang
                        setiap kali tajuk bertukar antara satu dan dua baris — dan SEMUA kandungan
                        di bawahnya teranjak naik turun. Unit `lh` = tinggi baris elemen itu
                        sendiri, jadi ruang dua baris kekal betul walaupun saiz fon atau leading
                        diubah kemudian (tidak seperti nilai px tetap yang akan senyap tersasar).

                        Tinggi tetap itu diletak pada <h4> (bukan pada <span> ini) supaya teks
                        boleh DITENGAHKAN dalam ruang dua baris tersebut. Dengan begitu tajuk
                        satu baris duduk sebaris dengan label "BERITA SEMASA", dan tajuk dua baris
                        mengapitnya di tengah — kalau tinggi diletak pada span, teks satu baris
                        akan melekat di ATAS kotak dan label nampak tersasar ke bawah. */}
                    <span className="line-clamp-2 md:truncate"><TypographyRenderer text={activeTickerNewsItem.title} rules={adjungTypographyRules} scope="title" /></span>
                  </motion.h4>
                </AnimatePresence>
              </div>
            ) : (
              <p className="font-serif italic text-stone-400 text-xs py-1 select-none">Tiada berita semasa buat masa ini.</p>
            )}
          </div>

          {/* RIGHT: CONTROLS & LANGUAGE TOGGLES */}
          {/* Baris kawalan ini KOSONG pada telefon apabila tiada bahasa didayakan: satu-satunya
              kandungan lainnya ("Baca Paparan Penuh") sudah `hidden md:inline`. Div kosong itu
              tinggi 0px, TETAPI bekas induk ialah flex-col dengan gap-3 — jadi `gap` 12px masih
              dikenakan di bawah ticker, menjadikan baris ticker tersasar ke atas antara dua
              garisan (diukur: jurang atas 17px lawan bawah 28px). Disembunyikan sepenuhnya bila
              tiada apa-apa untuk dipapar supaya gap hantu itu hilang.

              Ambang `md` (bukan `sm`) SENGAJA disamakan dengan `md:flex-row` bekas induk di atas
              (2026-08-02, laporan pemilik projek) — susunan bertukar sebaris cuma pada `md`
              (768px), jadi kalau label ni nampak lebih awal (`sm`, 640px) ia akan jatuh ke baris
              BAWAH ticker dalam julat tablet (640-767px) sebelum bekas induk sempat jadi flex-row.
              Dua ambang mesti sentiasa sepadan. */}
          <div className={`items-center gap-3 shrink-0 self-end md:self-auto ${enabledLanguages.length > 0 ? 'flex' : 'hidden md:flex'}`}>
            {parsedTickerNewsItems.length > 0 && (
              <span className="font-mono text-[8px] uppercase tracking-wider text-stone-400 group-hover:text-[#802334] transition duration-200 mr-1 hidden md:inline">
                &bull; Baca Paparan Penuh
              </span>
            )}
            {enabledLanguages.length > 0 && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 bg-stone-100 p-0.5 border border-stone-200 rounded text-xs select-none"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveLanguage('ms');
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-all cursor-pointer ${
                    activeLanguage === 'ms' 
                      ? 'bg-[#802334] text-white font-bold' 
                      : 'text-stone-500 hover:text-[#802334]'
                  }`}
                >
                  MS
                </button>
                {enabledLanguages.map((lang) => (
                  <button
                    key={lang.languageCode}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLanguage(lang.languageCode);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-all cursor-pointer ${
                      activeLanguage === lang.languageCode
                        ? 'bg-[#802334] text-white font-bold' 
                        : 'text-stone-500 hover:text-[#802334]'
                    }`}
                  >
                    {lang.languageCode}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <hr className="rule border-t border-stone-300 my-3" />

        {/* Susun atur "jadual" — TELEFON SAHAJA (permintaan Izzat, lukisan tangan: semua kad,
            TERMASUK HERO, bersambung terus dengan garisan hitam, macam jadual/spreadsheet — bukan
            kad terapung berjurang/bersudut bulat). Jurang antara baris (space-y-3) DAN antara kad
            dalam satu baris (.telefon-row gap) dikosongkan; setiap kad diberi sempadan hitam 1px
            + sudut tajam — sempadan kad bersebelahan bersentuhan terus jadi satu garisan jadual.
            !important wajib: kelas Tailwind (rounded-lg) & gaya inline getCardTheme() (borderColor
            per-kandungan) kedua-duanya perlu ditewaskan untuk sudut tajam + sempadan hitam seragam. */}
        <style>{`
          /* DESKTOP (lalai) — soft hyphen DIMATIKAN sepenuhnya. Pemenggal suku kata menyisip
             U+00AD ke dalam teks untuk KESEMUA saiz skrin (ia dikira sekali di peringkat data,
             bukan per-breakpoint), tetapi desktop tidak sepatutnya berubah langsung. Peraturan
             hyphens:none mengarahkan pelayar MENGABAIKAN setiap soft hyphen — jadi tiada sempang
             dan pembalutan baris desktop kekal sama seperti sebelum pemenggal ini wujud.
             Disahkan hidup: tanpa peraturan ni, desktop mula memaparkan "Wari-san", "memba-ca",
             "Pem-bungkusan" — perubahan yang tidak diminta. */
          #bento-news-grid [data-slot] h3,
          #bento-news-grid [data-slot] h4,
          #bento-news-grid [data-slot] p {
            hyphens: none;
            -webkit-hyphens: none;
          }

          /* DESKTOP (lalai, di luar media query) — eyebrow kekal SATU baris seperti asal:
             ikon + topik bersebelahan. Slot ikon yang KOSONG (kandungan tanpa ikon Bidang)
             disembunyikan sepenuhnya supaya tiada ruang terpelawa & tiada gap tertinggal —
             rupa desktop 100% sama seperti sebelum penstrukturan semula EyebrowKad. */
          #bento-news-grid .eyebrow-ikon:empty {
            display: none !important;
          }

          @media (max-width: 767px) {
            /* TELEFON — hidupkan semula soft hyphen. Nilai manual bermakna: pecah HANYA pada titik
               yang kita tetapkan sendiri (U+00AD daripada PemenggalSukuKata.js), tidak pernah
               meneka sendiri. Inilah yang menukar pemecahan buruk di tengah perkataan
               ("Didahulukan"/"n") kepada sempang yang betul ("Didahulu-"/"kan") pada lajur
               sempit. Tidak bergantung pada kamus hyphenation pelayar — yang diuji TIADA. */
            #bento-news-grid [data-slot] h3,
            #bento-news-grid [data-slot] h4,
            #bento-news-grid [data-slot] p {
              hyphens: manual;
              -webkit-hyphens: manual;
            }

            /* TELEFON — eyebrow ditindan menegak (permintaan Izzat): baris ATAS ikon (kiri) +
               tarikh (kanan, .tarikh-siaran-badge yang sedia ada diposisi mutlak di sudut
               atas-kanan kad), baris BAWAH barulah topik. Slot ikon SENTIASA ambil ruang walau
               kosong supaya baris topik semua kad sejajar sama tinggi. */
            #bento-news-grid .eyebrow-kad {
              flex-direction: column;
              /* !important WAJIB: EyebrowKad tetapkan alignItems:'center' terus sebagai gaya
                 INLINE (perlu untuk susunan sebaris desktop — ikon & teks bertengah menegak).
                 Gaya inline menewaskan mana-mana peraturan luar tanpa !important, jadi tanpa ni
                 ikon akan bertengah MELINTANG dalam lajur (Izzat tangkap: "align icon ke kiri,
                 bukan ke tengah") sebab paksi silang bertukar apabila flex-direction jadi column. */
              align-items: flex-start !important;
              gap: 4px;
            }
            #bento-news-grid .eyebrow-ikon:empty {
              display: inline-flex !important;
            }
            /* Tarikh diselaraskan dengan BARIS IKON: lencana tarikh diposisi mutlak guna kelas
               Tailwind top-6/right-6 (24px) atau top-8/right-8 (32px, HERO) yang dipilih untuk
               padding LAMA (24px/32px). Padding telefon kini 16px (p-4), jadi tanpa pembetulan
               ni lencana terapung 8-16px lebih rendah daripada ikon — bukan sebaris seperti
               dikehendaki (ikon kiri, tarikh kanan pada baris yang SAMA). */
            #bento-news-grid .tarikh-siaran-badge {
              top: 16px !important;
              right: 16px !important;
            }

            /* Grid TUNGGAL merentasi HERO + kesemua slot — jamin garisan sejajar sepenuhnya
               (lihat nota "Jadual telefon TUNGGAL" di atas). Tepi KANAN + BAWAH jadual
               keseluruhan ditutup di sini, bukan oleh kad individu. */
            #bento-news-grid .telefon-table {
              gap: 0 !important;
              border-right: 1px solid transparent;
              border-bottom: 1px solid transparent;
            }
            /* Border-collapse tanpa <table> sebenar: setiap kad lukis sempadan ATAS+KIRI SAHAJA
               (bukan kesemua 4 sisi) — sempadan ANTARA dua kad jadi SATU garisan (dilukis oleh
               kad "pemilik" sisi bawah/kanan sahaja), bukan dua garisan 1px bertindih jadi tebal
               2px (Izzat tangkap: "table hanya pakai 1 garisan"). Tepi KANAN + BAWAH jadual
               keseluruhan ditutup oleh bekas luar (.mb-4 utk HERO, .space-y-3 utk baki baris) di
               atas, bukan oleh kad individu. */
            #bento-news-grid [data-slot] {
              border-width: 1px 0 0 1px !important;
              border-style: solid !important;
              border-color: transparent !important;
              border-radius: 0 !important;
              background-color: #fff !important;
            }
            /* Bekas kluster Bar (justify-between, jurang dalaman berbeza daripada gap grid) —
               tampal putih supaya tiada jurang telus menembusi latar apa-apa di belakangnya. */
            #bento-news-grid [data-bar-cluster] {
              background-color: #fff !important;
            }
            /* ===== TINGGI KAD AUTOMATIK IKUT KANDUNGAN (telefon) — 2026-08-10, GEOMETRY-13 =====
               MASALAH ASAL: teks kad (huraian/sumber) terpotong pada telefon, dan setiap kali ia
               berlaku kami terpaksa "meneka" nilai min-height baharu (180 -> 210 -> 220 -> 240 ...).
               Itu tak pernah boleh betul selamanya: skrin lebih sempit (cth Android 360px lawan
               iPhone 375px) membalut teks kepada lebih banyak baris, jadi nombor tetap yang cukup
               pada satu peranti gagal pada peranti lain. Kalau saiz fon atau had aksara berubah
               kemudian, kitaran teka-nombor tu berulang semula.

               PUNCA SEBENAR: tinggi kad DIARAHKAN DARI ATAS, bukan tumbuh daripada kandungan:
                 baris grid (tinggi = kad tertinggi, cth MENEGAK row-span-2)
                   -> [data-slot] h-full (height:100%)  = ambil tinggi baris
                     -> (pasangan KOMPAK) flex-1        = bahagi tinggi tu 50/50
                       -> BentoInner min-h-0 + overflow-hidden = kandungan berlebih DIKELIP
               Sebab BentoInner min-h-0 membunuh sumbangan min-content, kandungan tak pernah dapat
               "menolak" kad jadi lebih tinggi — ia hanya dipotong senyap.

               PENYELESAIAN: pada telefon SAHAJA, lepaskan dua kekangan tu supaya tinggi mengalir
               daripada KANDUNGAN ke atas. Grid CSS kemudian membesarkan baris secara automatik,
               dan kad jiran (yang masih h-full pada desktop) meregang mengikutnya — jadi tiada
               jurang kosong terhasil. Disahkan empirik: 38/38 kad, 0 limpahan, pada lebar
               320/360/414px, termasuk ujian tekanan dengan teks sengaja dipanjangkan berkali ganda.

               CAROUSEL kekal stabil: CarouselStableBlock sudah mengunci minHeight kepada item
               TERTINGGI dalam senarai (diukur JS, hanya membesar tak pernah mengecut), jadi
               putaran kandungan A->B tidak mengubah tinggi. Malah peraturan ni yang membolehkan
               kunci tu berkuat kuasa — sebelum ni kad enggan membesar walaupun ruang sudah
               ditempah dengan betul.

               Desktop (>=768px) TIDAK disentuh langsung — geometri bento asal kekal. */
            #bento-news-grid [data-slot] {
              height: auto !important;
            }
            #bento-news-grid [data-bento-inner] {
              min-height: auto !important;
            }
            /* Pasangan KOMPAK (dua kad bertindan dalam satu lajur) perlukan satu langkah tambahan:
               kad-kadnya guna kelas flex-1, iaitu flex: 1 1 0%. Basis 0% bermakna saiz asasnya
               SIFAR dan tinggi datang SEPENUHNYA daripada membahagi tinggi lajur 50/50 — jadi
               height:auto di atas diabaikan begitu sahaja, dan kad yang tajuknya panjang tetap
               dipotong (disahkan pada iPhone 428px: limpah 10px, sumber terkeluar). Tukar kepada
               basis auto supaya saiz asas = tinggi KANDUNGAN sebenar; flex-grow:1 masih dikekalkan
               jadi kad tetap meregang mengisi baki ruang lajur (jurang bawah kekal 0), cuma kini
               dua kad boleh berbeza tinggi mengikut kandungan masing-masing. */
            #bento-news-grid [data-kompak-pair] [data-slot] {
              flex: 1 0 auto !important;
            }
            /* Huraian 12px seragam pada telefon (permintaan Izzat) — !important wajib:
               getCardTheme().briefStyle tetapkan fontSize:14px terus sebagai gaya INLINE pada
               setiap <p> huraian, gaya inline menewaskan kelas Tailwind (termasuk text-[12px])
               tanpa !important, tak kira spesifikasi. Tajuk (h3) tiada gaya inline setaraf, jadi
               kelas text-[13-16px] terus berkesan tanpa keperluan sama. */
            #bento-news-grid [data-slot] p {
              font-size: 12px !important;
            }
          }
        `}</style>

        {/* Bento Grid News Layout */}
        <section className="my-8" id="bento-news-grid">

          {/* Jadual telefon TUNGGAL (2026-07-31, pusingan KEENAM): HERO + kesemua 8 blok ROW kini
              SATU grid CSS berterusan pada telefon (grid-cols-3), supaya garisan jadual sejajar
              merentasi SELURUH halaman, bukan 8 jadual berasingan bertindan (Izzat tangkap garisan
              tak sejajar antara blok). Desktop tak berubah langsung — setiap blok ROW kekal
              "md:grid md:grid-cols-6" sendiri (kelas "contents" pada telefon larutkan blok tu ke
              dalam grid tunggal induk, "block" pada desktop pulihkan susunan asal bertindan). */}
          <div className="telefon-table grid grid-cols-6 md:block">
            {/* ROW 1: Full horizontal (Index 0) — HERO, kini SEBAHAGIAN grid tunggal (col-span-3
                penuh lebar), bukan bekas berasingan lagi. */}
            {bentoNewsItems[0] && (
                <div
                  data-slot={0}
                  // min-h-[180px] (2026-08-08, audit "kad tak boleh overflow" — Hero ialah SATU-
                  // SATUNYA slot antara 30 yang tiada min-h reservasi; setiap tier lain sudah ada
                  // — lihat CarouselStableBlock, gerbang `list.length > 1` cuma kunci tinggi
                  // ANTARA item carousel, bukan lantai minimum, jadi Hero satu-item boleh anjak
                  // tinggi tanpa min-h sendiri). Nilai sama dengan STANDARD/SEGI_EMPAT_SMALL
                  // (tier bersebelahan sedia ada), bukan diagak — diukur natural ~188px semasa
                  // ujian.
                  className={`col-span-6 md:col-span-6 p-4 md:p-8 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full group md:mb-4`}
               style={getCardTheme(bentoNewsItems[0], 'transparent').cardStyle} >
                <BentoInner itemKey="0" className="md:flex-row md:items-center justify-between gap-6" aiProvider={bentoNewsItems[0].aiProvider}>
                  <div className="space-y-2 max-w-3xl">
                    <CarouselStableBlock
                      items={bentoNewsItems[0].items && bentoNewsItems[0].items.length > 0 ? bentoNewsItems[0].items : [bentoNewsItems[0]]}
                      activeIndex={bentoNewsItems[0].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(0, bentoNewsItems[0].items && bentoNewsItems[0].items.length > 0 ? bentoNewsItems[0].items : [bentoNewsItems[0]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[0]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div>
                          <h3 className="font-serif text-[16px] md:text-3xl leading-tight font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-100/90 leading-relaxed font-normal mt-3" style={getCardTheme(bentoNewsItems[0]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[0].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[10px] tracking-editorial uppercase text-stone-300 border-t pt-2 md:border-t-0 md:border-l md:pt-0 border-stone-400/30 md:pl-4 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-1" style={getCardTheme(bentoNewsItems[0]).sourceStyle}>
                    <span>{bentoNewsItems[0].source}</span>
                    {(getDisplayDate(bentoNewsItems[0].originalDate) || formatBentoDate(bentoNewsItems[0].publishedAt)) && <span className="opacity-70 normal-case font-mono text-[7px] md:text-[9px]">{(getDisplayDate(bentoNewsItems[0].originalDate) || formatBentoDate(bentoNewsItems[0].publishedAt))}</span>}
                  </a>
                </BentoInner><span className="absolute top-8 right-8 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[0].publishedAt)}</span>
              </div>
            )}

            {/* ROW 2 & 3: Vertical, Horizontal, Square, 2 Compact (Indices 1 to 5) */}
            <div className="telefon-row contents md:grid md:grid-cols-6 md:gap-4 md:mb-4">

              {/* Left Column: Vertical (Index 1) */}
              {bentoNewsItems[1] && (
                <div
                  data-slot={1}
                  className={`col-span-2 row-span-2 md:col-span-2 md:row-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full group`}
                 style={getCardTheme(bentoNewsItems[1], 'transparent').cardStyle} >
                  <BentoInner itemKey="1" className="gap-3" aiProvider={bentoNewsItems[1].aiProvider}>
                    <div className="space-y-4">
                      <CarouselStableBlock
                        items={bentoNewsItems[1].items && bentoNewsItems[1].items.length > 0 ? bentoNewsItems[1].items : [bentoNewsItems[1]]}
                        activeIndex={bentoNewsItems[1].carouselIndex || 0}
                        onNavigate={(dir) => majuKarusel(1, bentoNewsItems[1].items && bentoNewsItems[1].items.length > 0 ? bentoNewsItems[1].items : [bentoNewsItems[1]], dir)}
                        renderItem={(it) => (
                          <>
                            <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[1]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div>
                            <h3 className="font-serif text-[14px] md:text-2xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                            <p className="font-serif text-xs text-stone-100/95 leading-relaxed font-normal mt-3" style={getCardTheme(bentoNewsItems[1]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                          </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[1].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[1]).sourceStyle}>
                      <span>{bentoNewsItems[1].source}</span>
                      {(getDisplayDate(bentoNewsItems[1].originalDate) || formatBentoDate(bentoNewsItems[1].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[1].originalDate) || formatBentoDate(bentoNewsItems[1].publishedAt))}</span>}
                    </a>
                  </BentoInner><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[1].publishedAt)}</span>
                </div>
              )}

              {/* Right/Top: Horizontal (Index 2) */}
              {bentoNewsItems[2] && (
                <div
                  data-slot={2}
                  className={`col-span-4 md:col-span-4 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden group`}
                 style={getCardTheme(bentoNewsItems[2], 'transparent').cardStyle} >
                  <BentoInner itemKey="2" className="md:flex-row md:items-center justify-between gap-4" aiProvider={bentoNewsItems[2].aiProvider}>
                    <div className="flex-1">
                      <CarouselStableBlock
                        items={bentoNewsItems[2].items && bentoNewsItems[2].items.length > 0 ? bentoNewsItems[2].items : [bentoNewsItems[2]]}
                        activeIndex={bentoNewsItems[2].carouselIndex || 0}
                        onNavigate={(dir) => majuKarusel(2, bentoNewsItems[2].items && bentoNewsItems[2].items.length > 0 ? bentoNewsItems[2].items : [bentoNewsItems[2]], dir)}
                        renderItem={(it) => (
                          <>
                            <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[2]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div>
                            <h3 className="font-serif text-[15px] md:text-xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200 mt-2" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                            <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[2]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                          </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[2].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 border-t pt-2 md:border-t-0 md:pt-0 md:pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[2]).sourceStyle}>
                      <span>{bentoNewsItems[2].source}</span>
                      {(getDisplayDate(bentoNewsItems[2].originalDate) || formatBentoDate(bentoNewsItems[2].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[2].originalDate) || formatBentoDate(bentoNewsItems[2].publishedAt))}</span>}
                    </a>
                  </BentoInner><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[2].publishedAt)}</span>
                </div>
              )}

              {/* Right/Bottom-Left: Square (Index 3) */}
              {bentoNewsItems[3] && (
                <div
                  data-slot={3}
                  className={`col-span-2 md:col-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full group`}
                 style={getCardTheme(bentoNewsItems[3], 'transparent').cardStyle} >
                  <BentoInner itemKey="3" className="gap-3" aiProvider={bentoNewsItems[3].aiProvider}>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[3]).deskStyle}>{<EyebrowKad item={bentoNewsItems[3]} bidang={bidangUntuk(bentoNewsItems[3])} onCari={cariDariEyebrow} />}</div>
                      <CarouselStableBlock
                        items={bentoNewsItems[3].items && bentoNewsItems[3].items.length > 0 ? bentoNewsItems[3].items : [bentoNewsItems[3]]}
                        activeIndex={bentoNewsItems[3].carouselIndex || 0}
                        onNavigate={(dir) => majuKarusel(3, bentoNewsItems[3].items && bentoNewsItems[3].items.length > 0 ? bentoNewsItems[3].items : [bentoNewsItems[3]], dir)}
                        renderItem={(it) => (
                          <>
                            <h3 className="font-serif text-[14px] md:text-lg leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                            <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[3]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                          </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[3].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[3]).sourceStyle}>
                      <span>{bentoNewsItems[3].source}</span>
                      {(getDisplayDate(bentoNewsItems[3].originalDate) || formatBentoDate(bentoNewsItems[3].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[3].originalDate) || formatBentoDate(bentoNewsItems[3].publishedAt))}</span>}
                    </a>
                  </BentoInner><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[3].publishedAt)}</span>
                </div>
              )}

              {/* Right/Bottom-Right: Two Stacked Compacts (Indices 4 & 5) */}
              {/* Pasangan KOMPAK: bertindan menegak pada desktop, dua kolum bersebelahan pada
                  telefon (rujuk PHONE_TIER_BOX.KOMPAK — nisbah 1:1 berpasangan). */}
              <div data-kompak-pair className="col-span-2 flex flex-col md:col-span-2 md:flex md:flex-col md:gap-4 h-full">
                {bentoNewsItems[4] && (
                <div 
                  data-slot={4}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col min-h-[120px] flex-1 group`} 
                   style={getCardTheme(bentoNewsItems[4], 'transparent').cardStyle} >
                    <BentoInner itemKey="4" className="gap-3" aiProvider={bentoNewsItems[4].aiProvider}>
                      <div>
                        <div className="font-mono text-[9px] md:text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[4]).deskStyle}>{<EyebrowKad item={bentoNewsItems[4]} bidang={bidangUntuk(bentoNewsItems[4])} onCari={cariDariEyebrow} />}</div>
                        <CarouselStableBlock
                          items={bentoNewsItems[4].items && bentoNewsItems[4].items.length > 0 ? bentoNewsItems[4].items : [bentoNewsItems[4]]}
                          activeIndex={bentoNewsItems[4].carouselIndex || 0}
                          onNavigate={(dir) => majuKarusel(4, bentoNewsItems[4].items && bentoNewsItems[4].items.length > 0 ? bentoNewsItems[4].items : [bentoNewsItems[4]], dir)}
                          renderItem={(it) => (
                            <KompakCardTeks
                              title={it.title}
                              brief={it.brief}
                              briefStyle={getCardTheme(bentoNewsItems[4]).briefStyle}
                              onClickTajuk={focusClick(it)}
                              onClickHuraian={focusClick(it)}
                            />
                          )}
                        />
                      </div>
                      <a href={bentoNewsItems[4].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[4]).sourceStyle}>
                        <span>{bentoNewsItems[4].source}</span>
                        {(getDisplayDate(bentoNewsItems[4].originalDate) || formatBentoDate(bentoNewsItems[4].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[7px]">{(getDisplayDate(bentoNewsItems[4].originalDate) || formatBentoDate(bentoNewsItems[4].publishedAt))}</span>}
                      </a>
                    </BentoInner><span className="absolute top-4 right-4 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[4].publishedAt)}</span>
                  </div>
                )}
                {bentoNewsItems[5] && (
                <div 
                  data-slot={5}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col min-h-[120px] flex-1 group`} 
                   style={getCardTheme(bentoNewsItems[5], 'transparent').cardStyle} >
                    <BentoInner itemKey="5" className="gap-3" aiProvider={bentoNewsItems[5].aiProvider}>
                      <div>
                        <div className="font-mono text-[9px] md:text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[5]).deskStyle}>{<EyebrowKad item={bentoNewsItems[5]} bidang={bidangUntuk(bentoNewsItems[5])} onCari={cariDariEyebrow} />}</div>
                        <CarouselStableBlock
                          items={bentoNewsItems[5].items && bentoNewsItems[5].items.length > 0 ? bentoNewsItems[5].items : [bentoNewsItems[5]]}
                          activeIndex={bentoNewsItems[5].carouselIndex || 0}
                          onNavigate={(dir) => majuKarusel(5, bentoNewsItems[5].items && bentoNewsItems[5].items.length > 0 ? bentoNewsItems[5].items : [bentoNewsItems[5]], dir)}
                          renderItem={(it) => (
                            <KompakCardTeks
                              title={it.title}
                              brief={it.brief}
                              briefStyle={getCardTheme(bentoNewsItems[5]).briefStyle}
                              onClickTajuk={focusClick(it)}
                              onClickHuraian={focusClick(it)}
                            />
                          )}
                        />
                      </div>
                      <a href={bentoNewsItems[5].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[5]).sourceStyle}>
                        <span>{bentoNewsItems[5].source}</span>
                        {(getDisplayDate(bentoNewsItems[5].originalDate) || formatBentoDate(bentoNewsItems[5].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[7px]">{(getDisplayDate(bentoNewsItems[5].originalDate) || formatBentoDate(bentoNewsItems[5].publishedAt))}</span>}
                      </a>
                    </BentoInner><span className="absolute top-4 right-4 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[5].publishedAt)}</span>
                  </div>
                )}
              </div>

            </div>

            {/* ROW 4 & 5: Horizontal, Vertical, Bars, Square (Indices 6 to 12) */}
            <div className="telefon-row contents md:grid md:grid-cols-6 md:gap-4 md:animate-fade-in md:mb-4">

              {/* Left Top: Horizontal (Index 6) */}
              {bentoNewsItems[6] && (
                <div
                  data-slot={6}
                  className={`col-span-4 md:col-span-4 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 min-h-[180px] h-full overflow-hidden group`}
                 style={getCardTheme(bentoNewsItems[6], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[6].items && bentoNewsItems[6].items.length > 0 ? bentoNewsItems[6].items : [bentoNewsItems[6]]}
                      activeIndex={bentoNewsItems[6].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(6, bentoNewsItems[6].items && bentoNewsItems[6].items.length > 0 ? bentoNewsItems[6].items : [bentoNewsItems[6]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[6]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[6].publishedAt)}</span>
                          <h3 className="font-serif text-[15px] md:text-xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200 mt-2" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[6]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[6].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 border-t pt-2 md:border-t-0 md:pt-0 md:pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[6]).sourceStyle}>
                    <span>{bentoNewsItems[6].source}</span>
                    {(getDisplayDate(bentoNewsItems[6].originalDate) || formatBentoDate(bentoNewsItems[6].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[6].originalDate) || formatBentoDate(bentoNewsItems[6].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[6].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[6].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Column: Vertical (Index 12) */}
              {bentoNewsItems[12] && (
                <div
                  data-slot={12}
                  ref={bar1SiblingLocks.idx12.ref}
                  className={`col-span-2 row-span-2 md:col-span-2 md:row-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full group`}
                 style={{ ...getCardTheme(bentoNewsItems[12], 'transparent').cardStyle, ...bar1SiblingLocks.idx12.lockStyle }} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[12].items && bentoNewsItems[12].items.length > 0 ? bentoNewsItems[12].items : [bentoNewsItems[12]]}
                      activeIndex={bentoNewsItems[12].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(12, bentoNewsItems[12].items && bentoNewsItems[12].items.length > 0 ? bentoNewsItems[12].items : [bentoNewsItems[12]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[12]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[12].publishedAt)}</span>
                          <h3 className="font-serif text-[14px] md:text-2xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-3" style={getCardTheme(bentoNewsItems[12]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[12].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[12]).sourceStyle}>
                    <span>{bentoNewsItems[12].source}</span>
                    {(getDisplayDate(bentoNewsItems[12].originalDate) || formatBentoDate(bentoNewsItems[12].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[12].originalDate) || formatBentoDate(bentoNewsItems[12].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[12].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[12].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              <div className="col-span-2 flex flex-col h-full md:col-span-2 md:relative md:flex md:flex-col md:justify-between md:gap-2" data-bar-cluster="">
                <div className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 -translate-x-full items-center justify-center pointer-events-none select-none">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold [writing-mode:vertical-lr] rotate-180 whitespace-nowrap">
                    PROGRAM-PROGRAM BERMANFAAT
                  </span>
                </div>
                {TIER_SLOTS.BAR.slice(0, 4).map((idx) => {
                  const barItem = bentoNewsItems[idx] || barEmptyItem;
                  const isExpanded = expandedBarCluster1 === idx;
                  return (
                    <div key={idx} data-slot={idx} className="flex-1 md:flex-none flex flex-col">
                      <BarCard
                        item={barItem}
                        onClick={() => {
                          setExpandedBarCluster1((prev) => (prev === idx ? null : idx));
                        }}
                      />
                      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] mt-1.5' : 'grid-rows-[0fr] mt-0'}`}>
                        <div className="overflow-hidden">
                          <BarCardExpandedPanel item={barItem} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Left Bottom Right: Square (Index 11) */}
              {bentoNewsItems[11] && (
                <div
                  data-slot={11}
                  ref={bar1SiblingLocks.idx11.ref}
                  className={`col-span-2 md:col-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full group`}
                 style={{ ...getCardTheme(bentoNewsItems[11], 'transparent').cardStyle, ...bar1SiblingLocks.idx11.lockStyle }} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[11]).deskStyle}>{<EyebrowKad item={bentoNewsItems[11]} bidang={bidangUntuk(bentoNewsItems[11])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[11].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[11].items && bentoNewsItems[11].items.length > 0 ? bentoNewsItems[11].items : [bentoNewsItems[11]]}
                      activeIndex={bentoNewsItems[11].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(11, bentoNewsItems[11].items && bentoNewsItems[11].items.length > 0 ? bentoNewsItems[11].items : [bentoNewsItems[11]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-lg leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[11]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[11].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[11]).sourceStyle}>
                      <span>{bentoNewsItems[11].source}</span>
                      {(getDisplayDate(bentoNewsItems[11].originalDate) || formatBentoDate(bentoNewsItems[11].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[11].originalDate) || formatBentoDate(bentoNewsItems[11].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[11].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[11].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 6: Two Half Horizontals Side-By-Side (Indices 13 & 14) */}
            {/* Pasangan SEGI_EMPAT_MEDIUM — col-span-3 desktop (separuh drpd 6) tak boleh
                dibahagi genap dalam grid 3-lajur (1.5), jadi baris ni guna grid 2-lajur SENDIRI
                supaya pasangan kekal 50/50 tepat, macam desktop. */}
            <div className="telefon-row contents md:grid md:grid-cols-6 md:gap-4 md:mb-4">
              {bentoNewsItems[13] && (
                <div 
                  data-slot={13}
                  className={`col-span-3 md:col-span-3 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden group`} 
                 style={getCardTheme(bentoNewsItems[13], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[13]).deskStyle}>{<EyebrowKad item={bentoNewsItems[13]} bidang={bidangUntuk(bentoNewsItems[13])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[13].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[13].items && bentoNewsItems[13].items.length > 0 ? bentoNewsItems[13].items : [bentoNewsItems[13]]}
                      activeIndex={bentoNewsItems[13].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(13, bentoNewsItems[13].items && bentoNewsItems[13].items.length > 0 ? bentoNewsItems[13].items : [bentoNewsItems[13]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[13]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[13].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[13]).sourceStyle}>
                      <span>{bentoNewsItems[13].source}</span>
                      {(getDisplayDate(bentoNewsItems[13].originalDate) || formatBentoDate(bentoNewsItems[13].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[13].originalDate) || formatBentoDate(bentoNewsItems[13].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[13].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[13].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {bentoNewsItems[14] && (
                <div 
                  data-slot={14}
                  className={`col-span-3 md:col-span-3 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden group`} 
                 style={getCardTheme(bentoNewsItems[14], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold" style={getCardTheme(bentoNewsItems[14]).deskStyle}>{<EyebrowKad item={bentoNewsItems[14]} bidang={bidangUntuk(bentoNewsItems[14])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[14].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[14].items && bentoNewsItems[14].items.length > 0 ? bentoNewsItems[14].items : [bentoNewsItems[14]]}
                      activeIndex={bentoNewsItems[14].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(14, bentoNewsItems[14].items && bentoNewsItems[14].items.length > 0 ? bentoNewsItems[14].items : [bentoNewsItems[14]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[14]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[14].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[14]).sourceStyle}>
                      <span>{bentoNewsItems[14].source}</span>
                      {(getDisplayDate(bentoNewsItems[14].originalDate) || formatBentoDate(bentoNewsItems[14].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[14].originalDate) || formatBentoDate(bentoNewsItems[14].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[14].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[14].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}
            </div>

            {/* ROW 7 & 8: Vertical, Square, Stacked Compacts, Horizontal (Indices 15 to 19) */}
            {/* Masonry telefon (2026-07-31): bekas ini "lut sinar" (contents) pada telefon supaya
                kad di dalamnya mengalir terus ke bekas columns-2 induk (lihat #bento-news-grid),
                bukan terperangkap dalam kumpulan blok desktop asal. Desktop (md:) kekal grid
                6-lajur seperti biasa, tidak tersentuh. */}
            <div className="telefon-row contents md:grid md:grid-cols-6 md:gap-4 md:mb-4">

              {/* Left Column: Vertical (Index 15) */}
              {bentoNewsItems[15] && (
                <div
                  data-slot={15}
                  className={`col-span-2 row-span-2 md:col-span-2 md:row-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full`}
                 style={getCardTheme(bentoNewsItems[15], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[15].items && bentoNewsItems[15].items.length > 0 ? bentoNewsItems[15].items : [bentoNewsItems[15]]}
                      activeIndex={bentoNewsItems[15].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(15, bentoNewsItems[15].items && bentoNewsItems[15].items.length > 0 ? bentoNewsItems[15].items : [bentoNewsItems[15]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[15]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[15].publishedAt)}</span>
                          <h3 className="font-serif text-[14px] md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-3" style={getCardTheme(bentoNewsItems[15]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[15].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[15]).sourceStyle}>
                    <span>{bentoNewsItems[15].source}</span>
                    {(getDisplayDate(bentoNewsItems[15].originalDate) || formatBentoDate(bentoNewsItems[15].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[15].originalDate) || formatBentoDate(bentoNewsItems[15].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[15].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[15].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Square (Index 16) */}
              {bentoNewsItems[16] && (
                <div 
                  data-slot={16}
                  className={`col-span-2 md:col-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full`}
                 style={getCardTheme(bentoNewsItems[16], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[16]).deskStyle}>{<EyebrowKad item={bentoNewsItems[16]} bidang={bidangUntuk(bentoNewsItems[16])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[16].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[16].items && bentoNewsItems[16].items.length > 0 ? bentoNewsItems[16].items : [bentoNewsItems[16]]}
                      activeIndex={bentoNewsItems[16].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(16, bentoNewsItems[16].items && bentoNewsItems[16].items.length > 0 ? bentoNewsItems[16].items : [bentoNewsItems[16]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[16]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[16].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[16]).sourceStyle}>
                      <span>{bentoNewsItems[16].source}</span>
                      {(getDisplayDate(bentoNewsItems[16].originalDate) || formatBentoDate(bentoNewsItems[16].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[16].originalDate) || formatBentoDate(bentoNewsItems[16].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[16].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[16].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Two Stacked Compacts (Indices 17 & 18) */}
              {/* Pasangan KOMPAK: bertindan menegak pada desktop, dua kolum bersebelahan pada
                  telefon (rujuk PHONE_TIER_BOX.KOMPAK — nisbah 1:1 berpasangan). */}
              <div data-kompak-pair className="col-span-2 flex flex-col md:col-span-2 md:flex md:flex-col md:gap-4 h-full">
                {bentoNewsItems[17] && (
                <div 
                  data-slot={17}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col min-h-[120px] flex-1`} 
                   style={getCardTheme(bentoNewsItems[17], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] md:text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[17]).deskStyle}>{<EyebrowKad item={bentoNewsItems[17]} bidang={bidangUntuk(bentoNewsItems[17])} onCari={cariDariEyebrow} />}</div><span className="absolute top-4 right-4 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[17].publishedAt)}</span>
                      <CarouselStableBlock
                        items={bentoNewsItems[17].items && bentoNewsItems[17].items.length > 0 ? bentoNewsItems[17].items : [bentoNewsItems[17]]}
                        activeIndex={bentoNewsItems[17].carouselIndex || 0}
                        onNavigate={(dir) => majuKarusel(17, bentoNewsItems[17].items && bentoNewsItems[17].items.length > 0 ? bentoNewsItems[17].items : [bentoNewsItems[17]], dir)}
                        renderItem={(it) => (
                          <>
                              <h3 className="font-serif text-[14px] md:text-sm font-medium leading-snug hover:text-stone-300 transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                              <p className="hidden md:block font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[17]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                            </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[17].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[17]).sourceStyle}>
                      <span>{bentoNewsItems[17].source}</span>
                      {(getDisplayDate(bentoNewsItems[17].originalDate) || formatBentoDate(bentoNewsItems[17].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[7px]">{(getDisplayDate(bentoNewsItems[17].originalDate) || formatBentoDate(bentoNewsItems[17].publishedAt))}</span>}
                    </a>
                  
                  {bentoNewsItems[17].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[17].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
                {bentoNewsItems[18] && (
                <div 
                  data-slot={18}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col min-h-[120px] flex-1`} 
                   style={getCardTheme(bentoNewsItems[18], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] md:text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[18]).deskStyle}>{<EyebrowKad item={bentoNewsItems[18]} bidang={bidangUntuk(bentoNewsItems[18])} onCari={cariDariEyebrow} />}</div><span className="absolute top-4 right-4 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[18].publishedAt)}</span>
                      <CarouselStableBlock
                        items={bentoNewsItems[18].items && bentoNewsItems[18].items.length > 0 ? bentoNewsItems[18].items : [bentoNewsItems[18]]}
                        activeIndex={bentoNewsItems[18].carouselIndex || 0}
                        onNavigate={(dir) => majuKarusel(18, bentoNewsItems[18].items && bentoNewsItems[18].items.length > 0 ? bentoNewsItems[18].items : [bentoNewsItems[18]], dir)}
                        renderItem={(it) => (
                          <>
                              <h3 className="font-serif text-[14px] md:text-sm font-medium leading-snug hover:text-stone-300 transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                              <p className="hidden md:block font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[18]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                            </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[18].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[18]).sourceStyle}>
                      <span>{bentoNewsItems[18].source}</span>
                      {(getDisplayDate(bentoNewsItems[18].originalDate) || formatBentoDate(bentoNewsItems[18].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[7px]">{(getDisplayDate(bentoNewsItems[18].originalDate) || formatBentoDate(bentoNewsItems[18].publishedAt))}</span>}
                    </a>
                  
                  {bentoNewsItems[18].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[18].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
              </div>

              {/* Bottom Horizontal spanning across Col 3-6 (Index 19) */}
              {bentoNewsItems[19] && (
                <div 
                  data-slot={19}
                  className={`col-span-4 md:col-span-4 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 min-h-[180px] h-full overflow-hidden`}
                 style={getCardTheme(bentoNewsItems[19], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[19].items && bentoNewsItems[19].items.length > 0 ? bentoNewsItems[19].items : [bentoNewsItems[19]]}
                      activeIndex={bentoNewsItems[19].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(19, bentoNewsItems[19].items && bentoNewsItems[19].items.length > 0 ? bentoNewsItems[19].items : [bentoNewsItems[19]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[19]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[19].publishedAt)}</span>
                          <h3 className="font-serif text-[15px] md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors mt-2" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[19]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[19].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 border-t pt-2 md:border-t-0 md:pt-0 md:pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[19]).sourceStyle}>
                    <span>{bentoNewsItems[19].source}</span>
                    {(getDisplayDate(bentoNewsItems[19].originalDate) || formatBentoDate(bentoNewsItems[19].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[19].originalDate) || formatBentoDate(bentoNewsItems[19].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[19].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[19].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 9 & 10: Horizontal, 4 Stacked Bars, Square, Vertical (Indices 20 to 26) */}
            {/* Masonry telefon (2026-07-31): bekas ini "lut sinar" (contents) pada telefon supaya
                kad di dalamnya mengalir terus ke bekas columns-2 induk (lihat #bento-news-grid),
                bukan terperangkap dalam kumpulan blok desktop asal. Desktop (md:) kekal grid
                6-lajur seperti biasa, tidak tersentuh. */}
            <div className="telefon-row contents md:grid md:grid-cols-6 md:gap-4 md:mb-4">

              {/* Left Column: Vertical (Index 26) */}
              {bentoNewsItems[26] && (
                <div
                  data-slot={26}
                  ref={bar2SiblingLocks.idx26.ref}
                  className={`col-span-2 row-span-2 md:col-span-2 md:row-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full`}
                 style={{ ...getCardTheme(bentoNewsItems[26], 'transparent').cardStyle, ...bar2SiblingLocks.idx26.lockStyle }} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[26].items && bentoNewsItems[26].items.length > 0 ? bentoNewsItems[26].items : [bentoNewsItems[26]]}
                      activeIndex={bentoNewsItems[26].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(26, bentoNewsItems[26].items && bentoNewsItems[26].items.length > 0 ? bentoNewsItems[26].items : [bentoNewsItems[26]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[26]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[26].publishedAt)}</span>
                          <h3 className="font-serif text-[14px] md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-3" style={getCardTheme(bentoNewsItems[26]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[26].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[26]).sourceStyle}>
                    <span>{bentoNewsItems[26].source}</span>
                    {(getDisplayDate(bentoNewsItems[26].originalDate) || formatBentoDate(bentoNewsItems[26].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[26].originalDate) || formatBentoDate(bentoNewsItems[26].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[26].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[26].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Top: Horizontal spanning across Col 3-6 (Index 20) */}
              {bentoNewsItems[20] && (
                <div 
                  data-slot={20}
                  className={`col-span-4 md:col-span-4 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 min-h-[180px] h-full overflow-hidden`}
                 style={getCardTheme(bentoNewsItems[20], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[20].items && bentoNewsItems[20].items.length > 0 ? bentoNewsItems[20].items : [bentoNewsItems[20]]}
                      activeIndex={bentoNewsItems[20].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(20, bentoNewsItems[20].items && bentoNewsItems[20].items.length > 0 ? bentoNewsItems[20].items : [bentoNewsItems[20]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[20]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[20].publishedAt)}</span>
                          <h3 className="font-serif text-[15px] md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors mt-2" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[20]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[20].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 border-t pt-2 md:border-t-0 md:pt-0 md:pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[20]).sourceStyle}>
                    <span>{bentoNewsItems[20].source}</span>
                    {(getDisplayDate(bentoNewsItems[20].originalDate) || formatBentoDate(bentoNewsItems[20].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[20].originalDate) || formatBentoDate(bentoNewsItems[20].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[20].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[20].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Bottom Left: Square (Index 25) */}
              {bentoNewsItems[25] && (
                <div
                  data-slot={25}
                  ref={bar2SiblingLocks.idx25.ref}
                  className={`col-span-2 md:col-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full`}
                 style={{ ...getCardTheme(bentoNewsItems[25], 'transparent').cardStyle, ...bar2SiblingLocks.idx25.lockStyle }} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[25]).deskStyle}>{<EyebrowKad item={bentoNewsItems[25]} bidang={bidangUntuk(bentoNewsItems[25])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[25].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[25].items && bentoNewsItems[25].items.length > 0 ? bentoNewsItems[25].items : [bentoNewsItems[25]]}
                      activeIndex={bentoNewsItems[25].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(25, bentoNewsItems[25].items && bentoNewsItems[25].items.length > 0 ? bentoNewsItems[25].items : [bentoNewsItems[25]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[25]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[25].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[25]).sourceStyle}>
                      <span>{bentoNewsItems[25].source}</span>
                      {(getDisplayDate(bentoNewsItems[25].originalDate) || formatBentoDate(bentoNewsItems[25].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[25].originalDate) || formatBentoDate(bentoNewsItems[25].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[25].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[25].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              <div className="col-span-2 flex flex-col h-full md:col-span-2 md:relative md:flex md:flex-col md:justify-between md:gap-2" data-bar-cluster="">
                <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 translate-x-full items-center justify-center pointer-events-none select-none">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold [writing-mode:vertical-lr] rotate-0 whitespace-nowrap">
                    PROGRAM-PROGRAM BERMANFAAT
                  </span>
                </div>
                {TIER_SLOTS.BAR.slice(4).map((idx) => {
                  const barItem = bentoNewsItems[idx] || barEmptyItem;
                  const isExpanded = expandedBarCluster2 === idx;
                  return (
                    <div key={idx} data-slot={idx} className="flex-1 md:flex-none flex flex-col">
                      <BarCard
                        item={barItem}
                        onClick={() => {
                          setExpandedBarCluster2((prev) => (prev === idx ? null : idx));
                        }}
                      />
                      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] mt-1.5' : 'grid-rows-[0fr] mt-0'}`}>
                        <div className="overflow-hidden">
                          <BarCardExpandedPanel item={barItem} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* ROW 11: Two Half Horizontals Side-By-Side (Indices 27 & 28) */}
            {/* Pasangan SEGI_EMPAT_MEDIUM — grid 2-lajur sendiri (lihat nota ROW 6). */}
            <div className="telefon-row contents md:grid md:grid-cols-6 md:gap-4 md:mb-4">
              {bentoNewsItems[27] && (
                <div 
                  data-slot={27}
                  className={`col-span-3 md:col-span-3 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden`} 
                 style={getCardTheme(bentoNewsItems[27], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[27]).deskStyle}>{<EyebrowKad item={bentoNewsItems[27]} bidang={bidangUntuk(bentoNewsItems[27])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[27].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[27].items && bentoNewsItems[27].items.length > 0 ? bentoNewsItems[27].items : [bentoNewsItems[27]]}
                      activeIndex={bentoNewsItems[27].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(27, bentoNewsItems[27].items && bentoNewsItems[27].items.length > 0 ? bentoNewsItems[27].items : [bentoNewsItems[27]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[27]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[27].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[27]).sourceStyle}>
                      <span>{bentoNewsItems[27].source}</span>
                      {(getDisplayDate(bentoNewsItems[27].originalDate) || formatBentoDate(bentoNewsItems[27].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[27].originalDate) || formatBentoDate(bentoNewsItems[27].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[27].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[27].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {bentoNewsItems[28] && (
                <div 
                  data-slot={28}
                  className={`col-span-3 md:col-span-3 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden`} 
                 style={getCardTheme(bentoNewsItems[28], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold" style={getCardTheme(bentoNewsItems[28]).deskStyle}>{<EyebrowKad item={bentoNewsItems[28]} bidang={bidangUntuk(bentoNewsItems[28])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[28].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[28].items && bentoNewsItems[28].items.length > 0 ? bentoNewsItems[28].items : [bentoNewsItems[28]]}
                      activeIndex={bentoNewsItems[28].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(28, bentoNewsItems[28].items && bentoNewsItems[28].items.length > 0 ? bentoNewsItems[28].items : [bentoNewsItems[28]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-xl leading-snug font-medium hover:text-[#F5EBE6] transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[28]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[28].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[28]).sourceStyle}>
                      <span>{bentoNewsItems[28].source}</span>
                      {(getDisplayDate(bentoNewsItems[28].originalDate) || formatBentoDate(bentoNewsItems[28].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[28].originalDate) || formatBentoDate(bentoNewsItems[28].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[28].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[28].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}
            </div>

            {/* ROW 12 & 13: Vertical, Square, Stacked Compacts, Horizontal (Indices 29 to 33) */}
            {/* Masonry telefon (2026-07-31): bekas ini "lut sinar" (contents) pada telefon supaya
                kad di dalamnya mengalir terus ke bekas columns-2 induk (lihat #bento-news-grid),
                bukan terperangkap dalam kumpulan blok desktop asal. Desktop (md:) kekal grid
                6-lajur seperti biasa, tidak tersentuh. */}
            <div className="telefon-row contents md:grid md:grid-cols-6 md:gap-4 md:mb-4">

              {/* Left Column: Vertical (Index 29) */}
              {bentoNewsItems[29] && (
                <div
                  data-slot={29}
                  className={`col-span-2 row-span-2 md:col-span-2 md:row-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full`}
                 style={getCardTheme(bentoNewsItems[29], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[29].items && bentoNewsItems[29].items.length > 0 ? bentoNewsItems[29].items : [bentoNewsItems[29]]}
                      activeIndex={bentoNewsItems[29].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(29, bentoNewsItems[29].items && bentoNewsItems[29].items.length > 0 ? bentoNewsItems[29].items : [bentoNewsItems[29]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[29]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[29].publishedAt)}</span>
                          <h3 className="font-serif text-[14px] md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-3" style={getCardTheme(bentoNewsItems[29]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[29].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[29]).sourceStyle}>
                    <span>{bentoNewsItems[29].source}</span>
                    {(getDisplayDate(bentoNewsItems[29].originalDate) || formatBentoDate(bentoNewsItems[29].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[29].originalDate) || formatBentoDate(bentoNewsItems[29].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[29].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[29].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Square (Index 30) */}
              {bentoNewsItems[30] && (
                <div 
                  data-slot={30}
                  className={`col-span-2 md:col-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full`}
                 style={getCardTheme(bentoNewsItems[30], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[30]).deskStyle}>{<EyebrowKad item={bentoNewsItems[30]} bidang={bidangUntuk(bentoNewsItems[30])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[30].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[30].items && bentoNewsItems[30].items.length > 0 ? bentoNewsItems[30].items : [bentoNewsItems[30]]}
                      activeIndex={bentoNewsItems[30].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(30, bentoNewsItems[30].items && bentoNewsItems[30].items.length > 0 ? bentoNewsItems[30].items : [bentoNewsItems[30]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[30]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[30].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[30]).sourceStyle}>
                      <span>{bentoNewsItems[30].source}</span>
                      {(getDisplayDate(bentoNewsItems[30].originalDate) || formatBentoDate(bentoNewsItems[30].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[30].originalDate) || formatBentoDate(bentoNewsItems[30].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[30].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[30].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Two Stacked Compacts (Indices 31 & 32) */}
              {/* Pasangan KOMPAK: bertindan menegak pada desktop, dua kolum bersebelahan pada
                  telefon (rujuk PHONE_TIER_BOX.KOMPAK — nisbah 1:1 berpasangan). */}
              <div data-kompak-pair className="col-span-2 flex flex-col md:col-span-2 md:flex md:flex-col md:gap-4 h-full">
                {bentoNewsItems[31] && (
                <div 
                  data-slot={31}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col min-h-[120px] flex-1`} 
                   style={getCardTheme(bentoNewsItems[31], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] md:text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[31]).deskStyle}>{<EyebrowKad item={bentoNewsItems[31]} bidang={bidangUntuk(bentoNewsItems[31])} onCari={cariDariEyebrow} />}</div><span className="absolute top-4 right-4 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[31].publishedAt)}</span>
                      <CarouselStableBlock
                        items={bentoNewsItems[31].items && bentoNewsItems[31].items.length > 0 ? bentoNewsItems[31].items : [bentoNewsItems[31]]}
                        activeIndex={bentoNewsItems[31].carouselIndex || 0}
                        onNavigate={(dir) => majuKarusel(31, bentoNewsItems[31].items && bentoNewsItems[31].items.length > 0 ? bentoNewsItems[31].items : [bentoNewsItems[31]], dir)}
                        renderItem={(it) => (
                          <>
                              <h3 className="font-serif text-[14px] md:text-sm font-medium leading-snug hover:text-stone-300 transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                              <p className="hidden md:block font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[31]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                            </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[31].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[31]).sourceStyle}>
                      <span>{bentoNewsItems[31].source}</span>
                      {(getDisplayDate(bentoNewsItems[31].originalDate) || formatBentoDate(bentoNewsItems[31].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[7px]">{(getDisplayDate(bentoNewsItems[31].originalDate) || formatBentoDate(bentoNewsItems[31].publishedAt))}</span>}
                    </a>
                  
                  {bentoNewsItems[31].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[31].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
                {bentoNewsItems[32] && (
                <div 
                  data-slot={32}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col min-h-[120px] flex-1`} 
                   style={getCardTheme(bentoNewsItems[32], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] md:text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[32]).deskStyle}>{<EyebrowKad item={bentoNewsItems[32]} bidang={bidangUntuk(bentoNewsItems[32])} onCari={cariDariEyebrow} />}</div><span className="absolute top-4 right-4 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[32].publishedAt)}</span>
                      <CarouselStableBlock
                        items={bentoNewsItems[32].items && bentoNewsItems[32].items.length > 0 ? bentoNewsItems[32].items : [bentoNewsItems[32]]}
                        activeIndex={bentoNewsItems[32].carouselIndex || 0}
                        onNavigate={(dir) => majuKarusel(32, bentoNewsItems[32].items && bentoNewsItems[32].items.length > 0 ? bentoNewsItems[32].items : [bentoNewsItems[32]], dir)}
                        renderItem={(it) => (
                          <>
                              <h3 className="font-serif text-[14px] md:text-sm font-medium leading-snug hover:text-stone-300 transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                              <p className="hidden md:block font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[32]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                            </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[32].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[32]).sourceStyle}>
                      <span>{bentoNewsItems[32].source}</span>
                      {(getDisplayDate(bentoNewsItems[32].originalDate) || formatBentoDate(bentoNewsItems[32].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[7px]">{(getDisplayDate(bentoNewsItems[32].originalDate) || formatBentoDate(bentoNewsItems[32].publishedAt))}</span>}
                    </a>
                  
                  {bentoNewsItems[32].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[32].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
              </div>

              {/* Bottom Horizontal spanning across Col 3-6 (Index 33) */}
              {bentoNewsItems[33] && (
                <div 
                  data-slot={33}
                  className={`col-span-4 md:col-span-4 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 min-h-[180px] h-full overflow-hidden`}
                 style={getCardTheme(bentoNewsItems[33], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[33].items && bentoNewsItems[33].items.length > 0 ? bentoNewsItems[33].items : [bentoNewsItems[33]]}
                      activeIndex={bentoNewsItems[33].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(33, bentoNewsItems[33].items && bentoNewsItems[33].items.length > 0 ? bentoNewsItems[33].items : [bentoNewsItems[33]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[33]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[33].publishedAt)}</span>
                          <h3 className="font-serif text-[15px] md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors mt-2" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[33]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[33].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 border-t pt-2 md:border-t-0 md:pt-0 md:pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[33]).sourceStyle}>
                    <span>{bentoNewsItems[33].source}</span>
                    {(getDisplayDate(bentoNewsItems[33].originalDate) || formatBentoDate(bentoNewsItems[33].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[33].originalDate) || formatBentoDate(bentoNewsItems[33].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[33].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[33].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 14 & 15: Horizontal, Two Half-Horizontals, Vertical (Indices 34 to 37) */}
            {/* Masonry telefon (2026-07-31): bekas ini "lut sinar" (contents) pada telefon supaya
                kad di dalamnya mengalir terus ke bekas columns-2 induk (lihat #bento-news-grid),
                bukan terperangkap dalam kumpulan blok desktop asal. Desktop (md:) kekal grid
                6-lajur seperti biasa, tidak tersentuh. */}
            <div className="telefon-row contents md:grid md:grid-cols-6 md:gap-4">

              {/* Left Top: Horizontal spanning across Col 1-4 (Index 34) */}
              {bentoNewsItems[34] && (
                <div
                  data-slot={34}
                  className={`col-span-4 md:col-span-4 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 min-h-[180px] h-full overflow-hidden`}
                 style={getCardTheme(bentoNewsItems[34], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[34].items && bentoNewsItems[34].items.length > 0 ? bentoNewsItems[34].items : [bentoNewsItems[34]]}
                      activeIndex={bentoNewsItems[34].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(34, bentoNewsItems[34].items && bentoNewsItems[34].items.length > 0 ? bentoNewsItems[34].items : [bentoNewsItems[34]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[34]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[34].publishedAt)}</span>
                          <h3 className="font-serif text-[15px] md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors mt-2" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[34]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[34].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300 border-t pt-2 md:border-t-0 md:pt-0 md:pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[34]).sourceStyle}>
                    <span>{bentoNewsItems[34].source}</span>
                    {(getDisplayDate(bentoNewsItems[34].originalDate) || formatBentoDate(bentoNewsItems[34].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[34].originalDate) || formatBentoDate(bentoNewsItems[34].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[34].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[34].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Column: Vertical (Index 37) */}
              {bentoNewsItems[37] && (
                <div 
                  data-slot={37}
                  className={`col-span-2 row-span-2 md:col-span-2 md:row-span-2 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full`}
                 style={getCardTheme(bentoNewsItems[37], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[37].items && bentoNewsItems[37].items.length > 0 ? bentoNewsItems[37].items : [bentoNewsItems[37]]}
                      activeIndex={bentoNewsItems[37].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(37, bentoNewsItems[37].items && bentoNewsItems[37].items.length > 0 ? bentoNewsItems[37].items : [bentoNewsItems[37]], dir)}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[37]).deskStyle}>{<EyebrowKad item={it} bidang={bidangUntuk(it)} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[37].publishedAt)}</span>
                          <h3 className="font-serif text-[14px] md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors" onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-3" style={getCardTheme(bentoNewsItems[37]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[37].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[37]).sourceStyle}>
                    <span>{bentoNewsItems[37].source}</span>
                    {(getDisplayDate(bentoNewsItems[37].originalDate) || formatBentoDate(bentoNewsItems[37].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[37].originalDate) || formatBentoDate(bentoNewsItems[37].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[37].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[37].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Left Bottom: Two Side-by-Side elements in Col 1-4 */}
              <div className="telefon-row contents md:col-span-4 md:grid md:grid-cols-2 md:gap-4">
                {bentoNewsItems[35] && (
                <div
                  data-slot={35}
                  className={`col-span-2 md:col-span-1 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden`}
                   style={getCardTheme(bentoNewsItems[35], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[35]).deskStyle}>{<EyebrowKad item={bentoNewsItems[35]} bidang={bidangUntuk(bentoNewsItems[35])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[35].publishedAt)}</span>
                      <CarouselStableBlock
                      items={bentoNewsItems[35].items && bentoNewsItems[35].items.length > 0 ? bentoNewsItems[35].items : [bentoNewsItems[35]]}
                      activeIndex={bentoNewsItems[35].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(35, bentoNewsItems[35].items && bentoNewsItems[35].items.length > 0 ? bentoNewsItems[35].items : [bentoNewsItems[35]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[35]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                      <a href={bentoNewsItems[35].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[35]).sourceStyle}>
                        <span>{bentoNewsItems[35].source}</span>
                        {(getDisplayDate(bentoNewsItems[35].originalDate) || formatBentoDate(bentoNewsItems[35].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[35].originalDate) || formatBentoDate(bentoNewsItems[35].publishedAt))}</span>}
                      </a>

                  
                  {bentoNewsItems[35].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[35].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}

                {bentoNewsItems[36] && (
                <div 
                  data-slot={36}
                  className={`col-span-2 md:col-span-1 p-4 md:p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden`}
                   style={getCardTheme(bentoNewsItems[36], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[36]).deskStyle}>{<EyebrowKad item={bentoNewsItems[36]} bidang={bidangUntuk(bentoNewsItems[36])} onCari={cariDariEyebrow} />}</div><span className="absolute top-6 right-6 tarikh-siaran-badge font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[36].publishedAt)}</span>
                      <CarouselStableBlock
                      items={bentoNewsItems[36].items && bentoNewsItems[36].items.length > 0 ? bentoNewsItems[36].items : [bentoNewsItems[36]]}
                      activeIndex={bentoNewsItems[36].carouselIndex || 0}
                      onNavigate={(dir) => majuKarusel(36, bentoNewsItems[36].items && bentoNewsItems[36].items.length > 0 ? bentoNewsItems[36].items : [bentoNewsItems[36]], dir)}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-[14px] md:text-lg leading-snug font-medium hover:text-stone-300 transition-colors " onClick={focusClick(it)}>{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-300/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[36]).briefStyle} onClick={focusClick(it)}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                      <a href={bentoNewsItems[36].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-sans text-[7px] md:text-[9px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[36]).sourceStyle}>
                        <span>{bentoNewsItems[36].source}</span>
                        {(getDisplayDate(bentoNewsItems[36].originalDate) || formatBentoDate(bentoNewsItems[36].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px] md:text-[8px]">{(getDisplayDate(bentoNewsItems[36].originalDate) || formatBentoDate(bentoNewsItems[36].publishedAt))}</span>}
                      </a>

                  
                  {bentoNewsItems[36].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[36].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
              </div>

            </div>

          </div>
        </section>
      </div>

      {/* Footer Reka Bentuk Premium */}
      <footer className="w-full max-w-5xl mx-auto mt-12 pt-10 pb-6 border-t border-stone-200">
          {/* Susun atur footer (2026-08-05, permintaan Izzat) — DUA kolum pautan sahaja (dahulu
              tiga: Institusi/Adjung/Am terpisah tanpa sebab jelas). Institusi kini gabung modal
              "Adjung" lama (Mengenai Adjung, Lembaga Editorial) + modal "Institusi" lama (Catatan
              Ketua Editor, Dasar Penerbitan, Pengumuman, Sejarah Versi) — enam pautan modal dalam
              SATU kolum. Maklumat ialah laluan halaman sebenar (bukan modal): Hubungi + tiga
              halaman polisi berasingan (Polisi Privasi/Terma Penggunaan/Penafian, dipecah drpd
              "Polisi & Penafian" tunggal lama). "Tentang" (laluan /tentang lama) sengaja tak
              dipaut lagi di sini — "Mengenai Adjung" (modal) sekarang satu-satunya pautan
              pengenalan, laluan /tentang sendiri kekal wujud (tak dipadam), cuma tak diiklankan
              di footer. */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-8 px-4">
            {/* Logo / Kiri — merentasi KEDUA-DUA kolum di telefon/tablet (2026-08-05, permintaan
                Izzat: "utk tablet dan telefon, jadikan dua kolum") supaya Institusi & Maklumat
                duduk BERSEBELAHAN sebagai dua kolum tu, bukan logo tersorong sekali jadi kolum
                pertama drpd tiga. Desktop (md:) kembali 1 drpd 3 kolum macam asal. */}
            <div className="col-span-2 md:col-span-1 flex flex-col justify-start gap-3">
              {/* Simbol Adjung rasmi (segi empat tegak, nisbah 1:2, Sistem Identiti Visual Adjung
                  v1.0) di sebelah wordmark (2026-08-07, permintaan Izzat) — public/adjung-symbol.svg,
                  sama asset yang dipakai favicon.svg. aria-hidden: dekoratif sahaja, "Adjung" teks
                  di sisinya sudah bawa maksud penuh untuk pembaca skrin. */}
              <div className="flex items-center gap-2.5">
                <img src="/adjung-symbol.svg" alt="" aria-hidden="true" className="h-7 w-auto shrink-0" />
                <h2 className="font-serif text-3xl font-normal text-[#802334] tracking-tight">Adjung</h2>
              </div>
              {/* Penaja bulan semasa (Fasa 12) — sembunyi terus bila tiada penaja bulan ni,
                  bukan baris kosong. Klik bawa ke /penaja (senarai penuh), bukan terus ke laman
                  penaja individu — sepadan permintaan Izzat. */}
              {penajaSemasa.length > 0 && (
                <Link to="/penaja" className="flex flex-col gap-1.5 group">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold group-hover:text-[#802334] transition-colors">
                    Portal ini disokong oleh:
                  </span>
                  <span className="flex flex-wrap items-center gap-2.5">
                    {penajaSemasa.map((p) => (
                      p.logoUrl ? (
                        <Tooltip key={p.id} text={p.nama}>
                          <img src={p.logoUrl} alt={p.nama} className="h-5 object-contain grayscale group-hover:grayscale-0 transition-all" />
                        </Tooltip>
                      ) : (
                        <span key={p.id} className="font-sans text-xs font-semibold text-stone-600 group-hover:text-[#802334] transition-colors">{p.nama}</span>
                      )
                    ))}
                  </span>
                </Link>
              )}
            </div>

            {/* Kolum INSTITUSI */}
            <div className="flex flex-col gap-2.5">
              <h3 className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">Institusi</h3>
              <ul className="flex flex-col gap-1.5 font-sans text-xs text-stone-600 font-semibold flex-start">
                {halamanAktif('about') && <li className="flex"><button onClick={() => handleFooterLinkClick('about')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Mengenai Adjung</button></li>}
                {halamanAktif('editorial-board') && <li className="flex"><button onClick={() => handleFooterLinkClick('editorial-board')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Lembaga Editorial</button></li>}
                <li className="flex"><button onClick={() => handleFooterLinkClick('editors-notes')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Catatan Ketua Editor</button></li>
                {halamanAktif('publishing-policies') && <li className="flex"><button onClick={() => handleFooterLinkClick('publishing-policies')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Dasar Penerbitan</button></li>}
                <li className="flex"><button onClick={() => handleFooterLinkClick('notices')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Pengumuman</button></li>
                {halamanAktif('version-history') && <li className="flex"><button onClick={() => handleFooterLinkClick('version-history')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Sejarah Versi</button></li>}
              </ul>
            </div>

            {/* Kolum MAKLUMAT — halaman awam sebenar (laluan berasingan, bukan modal) */}
            <div className="flex flex-col gap-2.5">
              <h3 className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">Maklumat</h3>
              <ul className="flex flex-col gap-1.5 font-sans text-xs text-stone-600 font-semibold flex-start">
                {halamanAktif('hubungi') && <li className="flex"><Link to="/hubungi" className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Hubungi</Link></li>}
                {halamanAktif('polisi-privasi') && <li className="flex"><Link to="/polisi-privasi" className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Polisi Privasi</Link></li>}
                {halamanAktif('terma-penggunaan') && <li className="flex"><Link to="/terma-penggunaan" className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Terma Penggunaan</Link></li>}
                {halamanAktif('penafian') && <li className="flex"><Link to="/penafian" className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Penafian</Link></li>}
              </ul>
            </div>
          </div>

          <div className="pt-6 text-center">
            <p className="font-mono text-[9px] tracking-widest text-stone-400 uppercase font-bold">
              {BRAND.copyright}
            </p>
          </div>
        </footer>


      {/* Pop-up Modal Halaman Footer (Tentang/Sidang Ed/dll) */}
      {activeFooterPageKey && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#FDFDFD] rounded-lg border border-stone-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl animate-fade-in">
            <header className="px-6 py-5 border-b border-stone-200 flex justify-between items-center bg-stone-50/50">
              <div>
                {/* Semua pautan modal footer kini SATU kolum "Institusi" (2026-08-05) — dulu
                    terbahagi "Institusi"/"Adjung", tiada lagi cabang kedua diperlukan. */}
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#8E8B82] font-bold">
                  Institusi
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#802334] tracking-tight mt-0.5">
                  {footerPageData?.title || 'Kandungan'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveFooterPageKey(null);
                  setFooterPageData(null);
                }}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </header>

            {(
              <div className="p-6 flex flex-col justify-between flex-grow">
                <div className="font-serif text-sm leading-relaxed text-stone-700 whitespace-pre-wrap flex-grow flex flex-col gap-3">
                  {footerPageData?.content ? (
                    // Renderer ad-hoc lama di sini cuma faham **tebal** dan senarai — langsung tak
                    // kenal "# "/"## " tajuk atau "---" garis pemisah, jadi kandungan yang ditulis
                    // guna sintaks tu (semua halaman static_pages, ditulis di Tetapan > Halaman
                    // Awam) terpapar sebagai teks mentah (2026-08-08, pepijat Izzat — tangkapan
                    // skrin "# Mengenai Adjung" terpampang literal). Gantikan dengan
                    // renderMarkdownRingkas SAMA yang HalamanStatik.tsx & pratonton Tetapan sudah
                    // guna — satu penghurai, bukan tiga versi berlainan boleh terpesong.
                    renderMarkdownRingkas(footerPageData.content, { kelasPerenggan: 'mb-1' })
                  ) : (
                    <div className="py-10 text-center text-stone-400 font-sans text-xs animate-pulse">
                      Memuatkan kandungan…
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-stone-150">
                  <span className="font-sans text-[9px] text-stone-400">
                    {footerPageData?.updatedAt && `Kemas Kini Terakhir: ${new Date(footerPageData.updatedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFooterPageKey(null);
                        setFooterPageData(null);
                      }}
                      className="px-5 py-2 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-screen Reading Display Overlay */}
      {/* FOCUS VIEW — paparan penuh kandungan kad. Huraian PENDEK sengaja tidak dihantar (dan
          tidak lagi diterima sebagai prop) sejak 2026-07-29 — hanya huraian panjang dipapar,
          keputusan pemilik projek. `note` dan `visual` (medan "Imej" Urus Slot, dimuat naik ke
          /api/media/upload — lihat SlotManagerModal.tsx) dihantar. `visual` expects nod React
          (bukan URL mentah), jadi item.image dibalut jadi <img> di sini; kotak "Lampiran visual"
          FocusView.tsx sendiri yang uruskan saiz (objectFit contain, 4:3). `related` masih sengaja
          tidak dihantar (tiada punca data lagi).

          `editorName`/`editorContact` (2026-07-29): identiti EDITORIUM semasa yang log masuk
          sebenar (`currentEditoriumName`/`currentEditoriumContact`, dari App.tsx selepas
          pengesahan /api/auth/login), BUKAN atribusi per-kandungan — operasi ni satu-Ketua-Editor
          (Izzat), jadi tandatangan editor global memadai buat masa ini. Kosong/undefined bila
          tiada sesiapa log masuk sebagai Ketua Editor (pelawat awam) — kolofon render pemegang
          tempat, bukan nama palsu.

          Navigasi (`onPrev`/`onNext`/`prevPreviewTitle`/`nextPreviewTitle`) mod RAWAK sejak
          2026-07-29: `onNext` lompat ke `nextRandomLoc` pra-gulung (merentasi SELURUH laman, guna
          `focusAllLocations`, bukan dalam satu slot sahaja lagi), `onPrev` UNDUR `focusHistory`
          (sejarah dilawati) bukan rawak baharu — corak sama "Rawak" Wikipedia + butang undur.
          Keduanya `undefined` (bukan chevron dilumpuhkan) bila tiada sasaran/sejarah, ikut pola
          render-hanya-bila-ada-isi FocusView.tsx sedia ada.

          `backdropImage` juga sengaja tidak dihantar. `item.imageUrl` ialah imej LATAR KAD
          (imej hiasan yang menggantikan seluruh paparan kad bento) — satu imej per SLOT,
          dikongsi oleh semua kandungan dalam kad yang sama, dan cirinya masih KIV. Lampiran
          visual Focus View (`item.image`) pula berbeza bagi SETIAP kandungan — dua medan
          berlainan, jangan pinjam salah satu untuk yang lain. */}
      {focusLoc && focusItem && (
        <FocusView
          icon={focusBidang ? (
            <BidangIcon
              iconName={focusBidang.icon}
              iconSvg={focusBidang.iconSvg}
              color="currentColor"
              variant="bare"
              size={13}
            />
          ) : undefined}
          desk={focusItem.desk}
          topik={focusItem.topik}
          onCariEyebrow={cariDariEyebrow}
          deskColor={undefined}
          title={cegahKataYatimAkhir(asPlainText(focusItem.titleString) || asPlainText(focusItem.title))}
          titleRendered={safeParseInline(cegahKataYatimAkhir(asPlainText(focusItem.titleString) || asPlainText(focusItem.title)))}
          body={asPlainText(focusItem.briefLong)}
          visual={(focusItem.image && !imejFocusViewRosak.has(focusItem.image)) ? (
            <img
              src={focusItem.image}
              alt={asPlainText(focusItem.titleString) || asPlainText(focusItem.title) || ''}
              onError={(e) => {
                // Sorok SERTA-MERTA (sebelum React sempat re-render) supaya ikon "imej rosak"
                // pelayar tak pernah terpapar walau sesaat, kemudian tandakan rosak supaya
                // FocusView tidak lagi cuba merendernya.
                e.currentTarget.style.display = 'none';
                const url = focusItem.image!;
                setImejFocusViewRosak((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
              }}
            />
          ) : undefined}
          note={focusItem.note}
          notaMaxAksara={systemSettings?.focusViewNotaMaxAksara}
          source={focusItem.source}
          sourceUrl={focusItem.url}
          sources={Array.isArray(focusItem.sources) ? focusItem.sources : undefined}
          objectId={focusItem.objectId}
          sourceDate={formatTarikhSumberPanjang(focusItem.originalDate)}
          publishedDate={formatSiaranDate(focusItem.publishedAt)}
          onPrev={(focusNavMode === 'turutan' ? !!prevTurutanLoc : focusHistory.length > 1) ? focusPrev : undefined}
          onNext={nextRandomLoc ? focusNext : undefined}
          prevPreviewTitle={focusPrevTitle}
          nextPreviewTitle={focusNextTitle}
          onClose={closeFocus}
          titleSizeScale={tetapanFontFocusView.titleSizeScale}
          bodySizePx={tetapanFontFocusView.bodySizePx}
          navMode={focusNavMode}
          onToggleNavMode={() => setFocusNavMode(m => m === 'rawak' ? 'turutan' : 'rawak')}
        />
      )}

      {showNewsOverlay && overlayItem && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/48 backdrop-blur-xl transition-all duration-300 animate-fade-in p-6 select-none"
          onClick={tutupOverlayJikaBukanLeret}
          onTouchStart={kendaliSentuhOverlayMula}
          onTouchEnd={kendaliSentuhOverlayTamat}
        >
          {/* Top Centered Logo */}
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 font-serif ${LOGO_SIZE.mini} font-semibold tracking-wider text-[#802334] select-none`}>
            {BRAND.logoText}
          </div>

          {/* Top Right Instructions — teks "ESC atau Klik" hanya bermakna di desktop (kekunci ESC
              wujud, ruang lapang di sisi logo). Di telefon ia berlanggar dgn logo tengah (skrin
              sempit) DAN tiada makna sebab tiada kekunci ESC — gantikan dgn butang X yang jelas
              (permintaan Izzat 2026-08-05, screenshot tunjuk label bertindih logo). */}
          <div className="absolute top-6 right-6 hidden md:block font-mono text-[8px] uppercase tracking-widest text-stone-400 select-none">
            ESC atau Klik untuk Tutup
          </div>
          <button
            type="button"
            onClick={() => setShowNewsOverlay(false)}
            aria-label="Tutup"
            className="absolute top-3 right-3 md:hidden inline-flex items-center justify-center w-11 h-11 text-stone-400 hover:text-[#802334] transition cursor-pointer select-none"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>

          {/* Left Arrow */}
          {parsedTickerNewsItems.length > 1 && (
            <button
              type="button"
              aria-label="Berita sebelum"
              onClick={handlePrevNewsItem}
              /* z-10 (2026-08-06, pembetulan audit) — WAJIB. Blok bacaan tengah di bawah ni
                 `w-full` + `relative`: di telefon ia merentangi SELURUH lebar skrin dan, kerana
                 ia datang KEMUDIAN dalam DOM dengan konteks penyusunannya sendiri, ia dicat DI
                 ATAS anak panah ni — jadi anak panah kelihatan tetapi ketukan tak pernah sampai
                 (disahkan: document.elementFromPoint di tengah butang pulangkan blok teks, bukan
                 butang). Di desktop `max-w-2xl` meninggalkan ruang di tepi jadi masalah ni tak
                 pernah kelihatan. */
              className="absolute left-6 top-1/2 -translate-y-1/2 z-10 p-3 text-stone-400 hover:text-[#802334] transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Right Arrow */}
          {parsedTickerNewsItems.length > 1 && (
            <button
              type="button"
              aria-label="Berita seterusnya"
              onClick={handleNextNewsItem}
              /* z-10 — lihat nota anak panah kiri di atas (sebab sama). */
              className="absolute right-6 top-1/2 -translate-y-1/2 z-10 p-3 text-stone-400 hover:text-[#802334] transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Main Centered Reading block */}
          <div className="max-w-2xl w-full text-center relative px-4" onClick={(e) => e.stopPropagation()}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeOverlayIndex}
                initial={{ opacity: 0, y: 15, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.995 }}
                transition={{ duration: 0.45, ease: 'easeInOut' }}
                className="space-y-6 flex flex-col items-center justify-center w-full"
              >
                {/* Accent colored Desk label */}
                <div 
                  className="font-mono text-xs uppercase tracking-widest font-extrabold text-[#802334]"
                >
                  BERITA SEMASA
                </div>

                {/* Large Serif Title */}
                <h1 className={`font-serif ${TICKER_OVERLAY_TITLE_SIZE_CLASS[systemSettings?.tickerOverlayTitleSize || 'L'] || TICKER_OVERLAY_TITLE_SIZE_CLASS.L} text-stone-900 leading-tight tracking-tight font-medium px-4`}>
                  {overlayItem.title}
                </h1>

                {/* Brief body */}
                {overlayItem.brief && (
                  <p className={`font-serif ${TICKER_OVERLAY_BRIEF_SIZE_CLASS[systemSettings?.tickerOverlayBriefSize || 'M'] || TICKER_OVERLAY_BRIEF_SIZE_CLASS.M} text-stone-600 leading-relaxed max-w-xl mx-auto px-4 font-light`}>
                    {overlayItem.brief}
                  </p>
                )}

                {/* Source Metadata */}
                {overlayItem.source && (
                  <div className="font-sans text-xs text-stone-800 font-semibold tracking-wide pt-1">
                    {overlayItem.source}
                  </div>
                )}

                {/* Read Original button */}
                <div className="pt-4 select-none flex items-center justify-center gap-3">
                  {overlayItem.url && (
                    <a 
                      href={overlayItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-[#802334] hover:bg-[#631c28] text-white px-6 py-2.5 rounded font-mono text-[10px] uppercase tracking-wider transition shadow-sm"
                    >
                      Pautan Sumber &rarr;
                    </a>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Dots */}
          {parsedTickerNewsItems.length > 1 && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex justify-center gap-2 select-none">
              {Array.from({ length: Math.min(10, parsedTickerNewsItems.length) }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveOverlayIndex(idx);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    idx === (activeOverlayIndex % 10) 
                      ? 'bg-[#802334] w-4' 
                      : 'bg-stone-300 hover:bg-stone-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {showScrollToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 p-3 bg-[#802334] text-white rounded-full shadow-xl hover:bg-[#601824] transition-all duration-300 flex items-center justify-center group"
          aria-label="Kembali ke atas"
        >
          <ChevronLeft className="w-5 h-5 rotate-90 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
    </JenisAnimasiContext.Provider>
  );
};
