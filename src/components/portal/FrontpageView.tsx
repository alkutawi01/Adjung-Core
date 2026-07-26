import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Entry, SystemSettings } from '../../types';
import { BRAND } from '../../config/brand';
import { parseInlineFormatting, isArabicText, parseInTheNews, getDeskAccentColor, parseWorldClockHolidays } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Info, ChevronLeft, ChevronRight, X, RotateCcw, Check, AlertCircle, Settings, Sun, CloudSun, CloudRain, CloudLightning, CloudFog, Cloud, Lock, Trash2, Save, Search, PenLine, FlaskConical, Tag, Brain, Ban, PenTool, Building2, Zap, AlertTriangle } from 'lucide-react';
import { ToastContainer, ToastMessage } from '../common/Toast';
import { validateContentBudget } from '../../../core/editorial/ContentBudget.js';
import { TypographyRenderer, TypographyRule } from '../editorial/TypographyRenderer';
import { TypographyPreview } from '../editorial/TypographyPreview';
import { WorldClockStrip } from './WorldClockStrip';
import { TickerManagementModal } from './TickerManagementModal';
import { BarCard } from './cards/BarCard';
import { BarCardExpandedPanel } from './cards/BarCardExpandedPanel';
import { Tooltip } from '../common/Tooltip';

// parseInlineFormatting is designed for hand-authored Note/Essay body text; applying it broadly to
// every carousel item's title/brief (including years of accumulated AI-generated history per slot)
// exposes it to content it was never vetted against. One malformed string (unbalanced markdown,
// unexpected characters) must never take down the whole frontpage — fall back to the plain text.
const safeParseInline = (text: string): React.ReactNode => {
  if (typeof text !== 'string' || text === '') return text;
  try {
    return parseInlineFormatting(text);
  } catch (e) {
    console.warn('parseInlineFormatting failed, falling back to plain text:', e, text);
    return text;
  }
};

interface ClockTime {
  timeStr: string;
  status: 'Holiday' | 'Weekend' | 'SchoolHoliday' | 'Working';
  isHoliday: boolean;
  holidayName: string;
  isWeekend: boolean;
}

const CITY_SETS = [
  // Set 1 (Default)
  [
    { name: 'Kangar', tz: 'Asia/Kuala_Lumpur', stateCode: 'PLS', lat: 6.4414, lon: 100.1986 },
    { name: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur', stateCode: 'KUL', lat: 3.1390, lon: 101.6869 },
    { name: 'Kota Bharu', tz: 'Asia/Kuala_Lumpur', stateCode: 'KTN', lat: 6.1254, lon: 102.2381 },
    { name: 'Johor Bahru', tz: 'Asia/Kuala_Lumpur', stateCode: 'JHR', lat: 1.4927, lon: 103.7414 },
    { name: 'Kota Kinabalu', tz: 'Asia/Kuala_Lumpur', stateCode: 'SBH', lat: 5.9804, lon: 116.0735 }
  ],
  // Set 2
  [
    { name: 'Alor Setar', tz: 'Asia/Kuala_Lumpur', stateCode: 'KDH', lat: 6.1248, lon: 100.3678 },
    { name: 'Shah Alam', tz: 'Asia/Kuala_Lumpur', stateCode: 'SGR', lat: 3.0738, lon: 101.5183 },
    { name: 'Seremban', tz: 'Asia/Kuala_Lumpur', stateCode: 'NSN', lat: 2.7258, lon: 101.9424 },
    { name: 'Kuantan', tz: 'Asia/Kuala_Lumpur', stateCode: 'PHG', lat: 3.8077, lon: 103.3260 },
    { name: 'Labuan', tz: 'Asia/Kuala_Lumpur', stateCode: 'LBN', lat: 5.2831, lon: 115.2308 }
  ],
  // Set 3
  [
    { name: 'George Town', tz: 'Asia/Kuala_Lumpur', stateCode: 'PNG', lat: 5.4164, lon: 100.3327 },
    { name: 'Ipoh', tz: 'Asia/Kuala_Lumpur', stateCode: 'PRK', lat: 4.5975, lon: 101.0901 },
    { name: 'Bandaraya Melaka', tz: 'Asia/Kuala_Lumpur', stateCode: 'MLK', lat: 2.1896, lon: 102.2501 },
    { name: 'Kuala Terengganu', tz: 'Asia/Kuala_Lumpur', stateCode: 'TRG', lat: 5.3302, lon: 103.1408 },
    { name: 'Kuching', tz: 'Asia/Kuala_Lumpur', stateCode: 'SWK', lat: 1.5533, lon: 110.3592 }
  ]
];

const DEFAULT_CITY_WEATHER: Record<string, { temp: number; code: number; label: string }> = {
  'Kangar': { temp: 31, code: 1, label: 'Berawan' },
  'Kuala Lumpur': { temp: 32, code: 2, label: 'Berawan' },
  'Kota Bharu': { temp: 30, code: 61, label: 'Hujan' },
  'Johor Bahru': { temp: 31, code: 2, label: 'Berawan' },
  'Kota Kinabalu': { temp: 31, code: 0, label: 'Cerah' },
  'Alor Setar': { temp: 32, code: 1, label: 'Berawan' },
  'Shah Alam': { temp: 33, code: 2, label: 'Berawan' },
  'Seremban': { temp: 31, code: 1, label: 'Berawan' },
  'Kuantan': { temp: 30, code: 61, label: 'Hujan' },
  'Labuan': { temp: 30, code: 0, label: 'Cerah' },
  'George Town': { temp: 31, code: 1, label: 'Berawan' },
  'Ipoh': { temp: 32, code: 2, label: 'Berawan' },
  'Bandaraya Melaka': { temp: 31, code: 1, label: 'Berawan' },
  'Kuala Terengganu': { temp: 29, code: 61, label: 'Hujan' },
  'Kuching': { temp: 29, code: 2, label: 'Berawan' }
};

const getWeatherDetails = (code: number) => {
  if (code === 0) return { icon: Sun, label: 'Cerah' };
  if (code === 1 || code === 2) return { icon: CloudSun, label: 'Berawan' };
  if (code === 3) return { icon: Cloud, label: 'Redup' };
  if (code === 45 || code === 48) return { icon: CloudFog, label: 'Kabut' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: CloudRain, label: 'Hujan' };
  if ([95, 96, 99].includes(code)) return { icon: CloudLightning, label: 'Ribut Petir' };
  return { icon: CloudSun, label: 'Berawan' };
};

const HOLIDAYS_2026: Record<string, Record<string, string>> = {
  'New York': {
    '01/01': "New Year's Day",
    '01/19': "Martin Luther King Jr. Day",
    '02/16': "Presidents' Day",
    '05/25': "Memorial Day",
    '06/19': "Juneteenth",
    '07/04': "Independence Day",
    '09/07': "Labor Day",
    '10/12': "Columbus Day",
    '11/11': "Veterans Day",
    '11/26': "Thanksgiving",
    '12/25': "Christmas Day"
  },
  'London': {
    '01/01': "New Year's Day",
    '04/03': "Good Friday",
    '04/06': "Easter Monday",
    '05/04': "Early May Bank Holiday",
    '05/25': "Spring Bank Holiday",
    '08/31': "Summer Bank Holiday",
    '12/25': "Christmas Day",
    '12/26': "Boxing Day"
  },
  'Mecca': {
    '02/22': "Saudi Founding Day",
    '03/19': "Eid al-Fitr Holiday",
    '03/20': "Eid al-Fitr Holiday",
    '03/21': "Eid al-Fitr Holiday",
    '03/22': "Eid al-Fitr Holiday",
    '05/26': "Eid al-Adha Holiday",
    '05/27': "Eid al-Adha Holiday",
    '05/28': "Eid al-Adha Holiday",
    '05/29': "Eid al-Adha Holiday",
    '09/23': "Saudi National Day"
  },
  'Kuala Lumpur': {
    '01/01': "New Year's Day",
    '01/29': "Chinese New Year",
    '01/30': "Chinese New Year (Day 2)",
    '02/01': "Federal Territory Day",
    '02/03': "Thaipusam",
    '03/20': "Hari Raya Aidilfitri",
    '03/21': "Hari Raya Aidilfitri (Day 2)",
    '05/01': "Labour Day",
    '05/27': "Hari Raya Aidiladha",
    '05/31': "Wesak Day",
    '06/01': "Yang di-Pertuan Agong's Birthday",
    '07/16': "Awal Muharram",
    '08/31': "Hari Kebangsaan (Merdeka)",
    '09/16': "Hari Malaysia",
    '09/25': "Maulidur Rasul",
    '11/08': "Hari Deepavali",
    '12/25': "Hari Krismas"
  },
  'Kuching': {
    '01/01': "Tahun Baharu",
    '01/29': "Tahun Baharu Cina",
    '01/30': "Tahun Baharu Cina (Hari Kedua)",
    '03/20': "Hari Raya Aidilfitri",
    '03/21': "Hari Raya Aidilfitri (Hari Kedua)",
    '05/01': "Hari Pekerja",
    '05/27': "Hari Raya Aidiladha",
    '05/31': "Hari Wesak",
    '06/01': "Hari Gawai Dayak",
    '06/02': "Hari Gawai Dayak (Hari Kedua)",
    '06/06': "Hari Lahir YdP Agong",
    '07/16': "Awal Muharram",
    '07/22': "Hari Sarawak",
    '08/31': "Hari Kebangsaan",
    '09/16': "Hari Malaysia",
    '09/25': "Maulidur Rasul",
    '10/10': "Hari Lahir TYT Yang di-Pertua Negeri Sarawak",
    '12/25': "Hari Krismas"
  },
  'Kota Kinabalu': {
    '01/01': "Tahun Baharu",
    '01/29': "Tahun Baharu Cina",
    '01/30': "Tahun Baharu Cina (Hari Kedua)",
    '04/03': "Good Friday",
    '03/20': "Hari Raya Aidilfitri",
    '03/21': "Hari Raya Aidilfitri (Hari Kedua)",
    '05/01': "Hari Pekerja",
    '05/27': "Hari Raya Aidiladha",
    '05/30': "Pesta Kaamatan",
    '05/31': "Pesta Kaamatan (Hari Kedua)",
    '06/01': "Hari Lahir YdP Agong",
    '07/16': "Awal Muharram",
    '08/31': "Hari Kebangsaan / Hari Sabah",
    '09/16': "Hari Malaysia",
    '09/25': "Maulidur Rasul",
    '10/03': "Hari Lahir TYT Yang di-Pertua Negeri Sabah",
    '11/08': "Hari Deepavali",
    '12/25': "Hari Krismas"
  },
  'Kota Bharu': {
    '01/29': "Tahun Baharu Cina",
    '03/20': "Hari Raya Aidilfitri",
    '03/21': "Hari Raya Aidilfitri (Hari Kedua)",
    '05/01': "Hari Pekerja",
    '05/27': "Hari Raya Aidiladha",
    '05/28': "Hari Raya Aidiladha (Hari Kedua)",
    '05/31': "Hari Wesak",
    '06/01': "Hari Lahir YdP Agong",
    '07/16': "Awal Muharram",
    '08/31': "Hari Kebangsaan",
    '09/16': "Hari Malaysia",
    '09/25': "Maulidur Rasul",
    '09/29': "Hari Keputeraan Sultan Kelantan",
    '09/30': "Hari Keputeraan Sultan Kelantan (Hari Kedua)",
    '11/08': "Hari Deepavali",
    '12/25': "Hari Krismas"
  },
  'Kangar': {
    '01/01': "Tahun Baharu",
    '01/29': "Tahun Baharu Cina",
    '01/30': "Tahun Baharu Cina (Hari Kedua)",
    '03/20': "Hari Raya Aidilfitri",
    '03/21': "Hari Raya Aidilfitri (Hari Kedua)",
    '05/01': "Hari Pekerja",
    '05/17': "Hari Ulang Tahun Keputeraan Raja Perlis",
    '05/27': "Hari Raya Aidiladha",
    '05/31': "Hari Wesak",
    '06/01': "Hari Lahir YdP Agong",
    '07/16': "Awal Muharram",
    '08/31': "Hari Kebangsaan",
    '09/16': "Hari Malaysia",
    '09/25': "Maulidur Rasul",
    '11/08': "Hari Deepavali",
    '12/25': "Hari Krismas"
  },
  'Tokyo': {
    '01/01': "New Year's Day",
    '01/12': "Coming of Age Day",
    '02/11': "National Foundation Day",
    '02/23': "Emperor's Birthday",
    '03/20': "Vernal Equinox Day",
    '04/29': "Showa Day",
    '05/03': "Constitution Memorial Day",
    '05/04': "Greenery Day",
    '05/05': "Children's Day",
    '07/20': "Marine Day",
    '08/11': "Mountain Day",
    '09/21': "Respect for the Aged Day",
    '09/23': "Autumnal Equinox Day",
    '10/12': "Sports Day",
    '11/03': "Culture Day",
    '11/23': "Labor Thanksgiving Day"
  }
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
  inTheNewsGoogleDocText?: string;
  worldClockHolidaysGoogleDocText?: string;
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

const formatBentoDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Tarikh siaran (bila kandungan disimpan ke Adjung) -- DD.MM.YY, ditunjuk di bucu kad, sengaja
// berbeza format daripada tarikh sumber (formatBentoDate) supaya kedua-dua tarikh tidak keliru.
const formatSiaranDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
};

// Tarikh sumber/asal dipaparkan PERSIS seperti ditaip (cth "1980", "20 Julai 2026") -- tidak
// dihurai semula sebagai Date, supaya tarikh separa/tahun sahaja (rujukan lama/tesis) tidak
// hilang atau jadi "Invalid Date". "Tidak dinyatakan"/kosong terus disembunyikan.
const getDisplayDate = (raw?: string): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'tidak dinyatakan') return '';
  return trimmed;
};

const BentoInner: React.FC<{ itemKey: string; className?: string; aiProvider?: string; children: React.ReactNode }> = ({ itemKey, className = '', aiProvider, children }) => {
  let providerName = aiProvider;
  if (providerName) {
    if (providerName.startsWith('Google ')) providerName = providerName.replace('Google ', '');
    if (providerName.includes(' (')) providerName = providerName.split(' (')[0];
  }
  return (
    <div className="w-full flex-1 min-h-0 relative flex flex-col justify-between">
      <AnimatePresence mode="sync">
        <motion.div
          key={itemKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, position: 'absolute' }}
          transition={{ duration: 1.0, ease: 'easeInOut' }}
          className={`w-full h-full flex flex-col ${className}`}
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
}> = ({ items, activeIndex, renderItem }) => {
  const list = items && items.length > 0 ? items : [{}];
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  // Content fingerprint (not the array reference, which can churn on every poll even when the
  // underlying text hasn't changed) -- only remeasure when what's actually rendered could differ.
  const contentKey = list.map((it) => `${it.title || ''}|${it.brief || ''}`).join(' ');

  // CSS Grid's "stack everything in one cell, size to the tallest" trick (col-start-1/row-start-1
  // + opacity toggle) is the ideal way to do this declaratively, but empirically the grid track's
  // auto-size recalculation is unreliable while an opacity CSS transition is actively running on
  // the stacked children -- verified live: all N stacked items intermittently report the SAME
  // wrong height in sync with each other, then correct themselves, with no change in viewport
  // width or content. Measuring each item's natural height in JS and pinning min-height explicitly
  // sidesteps that browser-timing quirk entirely instead of depending on implicit grid sizing.
  //
  // A single measurement pass isn't enough either: for flex-row card layouts (source-as-side-column
  // cards), the content column's available width can still be settling (flex-basis negotiation
  // against the sibling source column) at the moment this effect first runs, so text can measure
  // as wrapping into fewer lines than it will once layout truly settles -- under-measuring the real
  // max. A ResizeObserver on every stacked item catches that (and font loads, and window resizes)
  // generically, and the max only ever grows, never shrinks, once observed -- it never "forgets" a
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

  if (list.length <= 1) {
    return <>{renderItem(list[0] || {})}</>;
  }
  return (
    <div className="grid" style={{ minHeight: maxHeight }}>
      {list.map((it, i) => (
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
            opacity: i === activeIndex ? 1 : 0,
            transition: 'opacity 1s ease-in-out',
            pointerEvents: i === activeIndex ? 'auto' : 'none',
          }}
          aria-hidden={i === activeIndex ? undefined : true}
        >
          {renderItem(it)}
        </div>
      ))}
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
  // always the size right up to the moment it locks -- not a stale snapshot from whenever isLocked
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

const getCardTheme = (item: any, defaultBg: string = 'transparent') => {
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
      color: item.categoryColor || (finalIsDark ? '#E9D8A6' : '#802334')
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

const updateLimitsInText = (text: string, maxTitle: number, maxBrief: number, maxBriefLong?: number) => {
  if (!text) return '';
  let updated = text;
  updated = updated.replace(/Tajuk:\s*\(had\s*\d+\s*aksara\)/gi, `Tajuk: (had ${maxTitle} aksara)`);
  updated = updated.replace(/Huraian panjang:\s*\(had\s*\d+\s*aksara\)/gi, `Huraian panjang: (had ${maxBriefLong ?? 0} aksara)`);
  updated = updated.replace(/Huraian ringkas:\s*\(had\s*\d+\s*aksara\)/gi, `Huraian ringkas: (had ${maxBrief} aksara)`);
  updated = updated.replace(/Huraian:\s*\(had\s*\d+\s*aksara\)/gi, `Huraian: (had ${maxBrief} aksara)`);
  updated = updated.replace(/Event:\s*\(had\s*\d+\s*aksara\)/gi, `Event: (had ${maxTitle} aksara)`);
  return updated;
};

// Geometry tiers for the 4 card types whose title+brief share a fixed vertical budget (source is
// reserved separately, below, and anchored to the card bottom -- see CarouselStableBlock/mt-auto
// work). Computed 2026-07-21 from live-measured card widths/fonts via canvas.measureText on a
// representative Malay news sentence: maxTitleAlone/maxBriefAlone are the character counts that
// would exactly fill the shared budget if given ENTIRELY to one field; ratio = maxBriefAlone /
// maxTitleAlone is how many brief characters one title character "costs" in shared vertical space.
// Used both for the (maxTitle, maxBrief) defaults below and to auto-balance the two fields in
// Mini Editorium (see handleMaxTitleChange/handleMaxBriefChange).
import { GEOMETRY_RATIOS, tierForSlot as getGeometryTierForIndex, ceilingForSlot, TIER_SLOTS } from '../../../core/editorial/GeometryConfig.js';

// Fixed ruleset for the "Salin Templat Prom AI (Lampiran)" button -- unlike Peraturan Am/Tambahan,
// this is not admin-editable per slot; it's the same encyclopedia-style writing discipline every
// time a piece of attached material (URL/PDF) is analyzed and summarized.
const LAMPIRAN_EDITORIAL_RULES = `1. Tulis mengenai kandungan, bukan mengenai bahan asal.
Semua huraian hendaklah menerangkan subjek, fakta, peristiwa, tokoh, konsep atau idea yang dibincangkan.

2. Jangan merujuk kepada bahan asal.
Dilarang menggunakan frasa seperti:
* Artikel ini...
* Video ini...
* Kajian ini...
* Buku ini...
* Laporan ini...
* Dokumentari ini...
* Podcast ini...
* Penulis...
* Pengarang...
* Penyelidik...
* Menurut artikel...
* Menurut video...
* Menurut kajian...

3. Gunakan gaya ensiklopedia atau berita ringkas yang neutral.
Huraian hendaklah boleh dibaca secara berdiri sendiri tanpa pembaca perlu mengetahui sumber asal.

4. Jangan mengulas bahan asal.
Fokus pada isi kandungan, bukan cara kandungan itu dipersembahkan.

5. Jangan menyebut nama sumber dalam huraian, kecuali benar-benar menjadi sebahagian daripada kandungan.

6. Gunakan ayat aktif, padat dan terus kepada isi. Elakkan mukadimah yang tidak membawa maklumat.

Contoh
SALAH
Artikel ini membincangkan lima penemuan arkeologi yang menjelaskan Iliad dan Odyssey.
Video ini menerangkan bagaimana haiwan mengubah sejarah manusia.
Kajian ini menghuraikan perkembangan bahasa Arab.

BETUL
Lima penemuan arkeologi membantu menjelaskan latar sejarah dan perkembangan epik Iliad dan Odyssey, termasuk penemuan di Troy, Pylos dan Olympia.
Kuda, lembu, anjing dan beberapa spesies lain memainkan peranan penting dalam perkembangan tamadun manusia melalui pertanian, pengangkutan, peperangan dan penemuan saintifik.
Perkembangan bahasa Arab dipengaruhi oleh perubahan sosial, politik dan kesusasteraan sejak zaman awal Islam.

Anggap semua medan "Huraian" akan dipaparkan terus kepada pembaca sebagai metadata kandungan dalam pangkalan data digital. Oleh itu, setiap huraian mestilah boleh difahami tanpa perlu merujuk kepada bahan asal.`;

const getLimitsForIndex = (idx: number, config?: any) => {
  const customTitle = config?.maxTitle;
  const customBrief = config?.maxBrief;
  const customBriefLong = config?.maxBriefLong;

  // maxBriefLong: had aksara "Huraian Panjang" -- kandungan tambahan yang tidak dipaparkan pada kad,
  // hanya dalam mod spotlight (belum dibina). Tiada guna untuk Ticker/slot bar (0).
  // Previously a hand-typed if/else chain here had drifted from the canonical values in
  // core/editorial/GeometryConfig.js for 4 of 8 tiers (and disagreed with server.js's own copy on
  // BAR) -- now derived live from the single shared source, so it can't drift again.
  const defaults = ceilingForSlot(idx);

  return {
    maxTitle: (typeof customTitle === 'number' && customTitle > 0) ? customTitle : (config?.manualTitle === undefined && typeof customTitle === 'string' && parseInt(customTitle) > 0 ? parseInt(customTitle) : defaults.maxTitle),
    maxBrief: (typeof customBrief === 'number' && customBrief >= 0) ? customBrief : (config?.manualTitle === undefined && typeof customBrief === 'string' && parseInt(customBrief) >= 0 ? parseInt(customBrief) : defaults.maxBrief),
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
  inTheNewsGoogleDocText = '',
  worldClockHolidaysGoogleDocText = '',
  setIndexSearchQuery,
}) => {
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
  const [activeLanguage, setActiveLanguage] = useState<'ms' | 'zh' | 'ar' | 'en'>('ms');
  const [enabledLanguages, setEnabledLanguages] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  // BAR accordion: which card (by slot index) is expanded, per cluster -- independent so opening
  // one cluster's accordion never affects the other. Only active outside edit mode (edit mode's
  // click behavior on BAR cards is unchanged: it opens the admin slot editor, see handleCardClick).
  const [expandedBarCluster1, setExpandedBarCluster1] = useState<number | null>(null);
  const [expandedBarCluster2, setExpandedBarCluster2] = useState<number | null>(null);
  // Height locks for the 2 cards sharing each BAR cluster's grid row (index 11/12 for cluster 1,
  // 25/26 for cluster 2) -- see useCollapsedHeightLock. Locked whenever that cluster's accordion
  // is open, so these cards never move/resize while a card elsewhere in their row expands.
  const bar1SiblingLocks = {
    idx11: useCollapsedHeightLock(expandedBarCluster1 !== null),
    idx12: useCollapsedHeightLock(expandedBarCluster1 !== null),
  };
  const bar2SiblingLocks = {
    idx25: useCollapsedHeightLock(expandedBarCluster2 !== null),
    idx26: useCollapsedHeightLock(expandedBarCluster2 !== null),
  };
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [activeLogPayload, setActiveLogPayload] = useState<{ type: 'prompt' | 'response'; content: string } | null>(null);
  const [showResetMenu, setShowResetMenu] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };
  const ratioAnchorRef = useRef<{ title: number; brief: number } | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [articleFontSize, setArticleFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [showScrollToTop, setShowScrollToTop] = useState<boolean>(false);
  const [rssStatus, setRssStatus] = useState<any>({ activeSourcesCount: 0, totalFetchedCount: 0, autoLiveCount: 0, pendingReviewCount: 0, lastFetchedAt: '' });
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [isFetchingRss, setIsFetchingRss] = useState<boolean>(false);
  const [newRssName, setNewRssName] = useState<string>('');
  const [newRssUrl, setNewRssUrl] = useState<string>('');
  const [newRssTrust, setNewRssTrust] = useState<number>(90);
  const [newRssCategory, setNewRssCategory] = useState<string>('BERITA UTAMA');
  const [registeredRssSources, setRegisteredRssSources] = useState<any[]>([]);
  const [openScoreAccordionId, setOpenScoreAccordionId] = useState<string | null>(null);

  // Dynamic RSS Editorial Settings State
  const [rssAutoLiveThreshold, setRssAutoLiveThreshold] = useState<number>(80);
  const [rssReviewThreshold, setRssReviewThreshold] = useState<number>(60);
  const [rssPriorityKeywords, setRssPriorityKeywords] = useState<string>('dasar, belanjawan, ekonomi, pendidikan, menteri, kerajaan');
  const [rssBlockedKeywords, setRssBlockedKeywords] = useState<string>('gempar, viral, panas, terbongkar');
  const [rssPriorityBonus, setRssPriorityBonus] = useState<number>(15);
  const [rssBlockedPenalty, setRssBlockedPenalty] = useState<number>(40);
  const [rssMaxNewsAgeHours, setRssMaxNewsAgeHours] = useState<number>(48);

  // Adjung Editorial Text Rules State & Handlers
  const [rssTextRules, setRssTextRules] = useState<any[]>([]);
  const [newRuleName, setNewRuleName] = useState<string>('');
  const [newRuleType, setNewRuleType] = useState<string>('substitute');
  const [newRuleScope, setNewRuleScope] = useState<string>('brief');
  const [newRuleSourceId, setNewRuleSourceId] = useState<string>('global');
  const [newRulePattern, setNewRulePattern] = useState<string>('');
  const [newRuleReplacement, setNewRuleReplacement] = useState<string>('');
  
  // Live Sandbox Tester State
  const [testerRawText, setTesterRawText] = useState<string>('PETALING JAYA &#8211; Seorang wanita hamil terpaksa berdiri lama di dalam tren LRT.');
  const [testerScope, setTesterScope] = useState<string>('brief');
  const [testerSourceId, setTesterSourceId] = useState<string>('global');
  const [testerResult, setTesterResult] = useState<any>(null);

  const loadRssTextRules = () => {
    fetch('/api/system/rss-text-rules')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRssTextRules(data);
      })
      .catch(err => console.error('Failed to load RSS text rules:', err));
  };

  const handleAddRssTextRule = async () => {
    if (!newRuleName.trim()) {
      addToast('error', 'Sila masukkan Nama Peraturan.');
      return;
    }
    try {
      const res = await fetch('/api/system/rss-text-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleName: newRuleName,
          ruleType: newRuleType,
          scope: newRuleScope,
          sourceId: newRuleSourceId === 'global' ? null : newRuleSourceId,
          pattern: newRulePattern,
          replacement: newRuleReplacement,
          enabled: 1,
          orderIndex: (rssTextRules.length + 1) * 10
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Peraturan '${newRuleName}' berjaya ditambah!`);
        setNewRuleName('');
        setNewRulePattern('');
        setNewRuleReplacement('');
        loadRssTextRules();
      } else {
        addToast('error', data.error || 'Gagal menambah peraturan.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const handleToggleRule = async (ruleId: string, currentEnabled: number) => {
    try {
      const res = await fetch(`/api/system/rss-text-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: currentEnabled === 1 ? 0 : 1 })
      });
      const data = await res.json();
      if (data.success) {
        loadRssTextRules();
      } else {
        addToast('error', data.error || 'Gagal mengubah status peraturan.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const handleDeleteRssTextRule = async (ruleId: string, ruleName: string) => {
    try {
      const res = await fetch(`/api/system/rss-text-rules/${ruleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('info', `Peraturan '${ruleName}' telah dibuang.`);
        loadRssTextRules();
      } else {
        addToast('error', data.error || 'Gagal membuang peraturan.');
      }
    } catch (err) {
      addToast('error', 'Gagal membuang peraturan.');
    }
  };

  const handleRunLiveTester = async () => {
    try {
      const res = await fetch('/api/system/rss-text-rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testText: testerRawText,
          scope: testerScope,
          sourceId: testerSourceId === 'global' ? null : testerSourceId
        })
      });
      const data = await res.json();
      if (data.success) {
        setTesterResult(data);
      } else {
        addToast('error', data.error || 'Gagal menjalankan ujian live.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan ujian.');
    }
  };
  // Adjung Desk Rules State & Handlers
  const [adjungDesks, setAdjungDesks] = useState<any[]>([]);
  const [rssDeskRules, setRssDeskRules] = useState<any[]>([]);

  const [newDeskName, setNewDeskName] = useState<string>('');
  const [newDeskDescription, setNewDeskDescription] = useState<string>('');

  const [newRuleDeskId, setNewRuleDeskId] = useState<string>('');
  const [newRuleKeyword, setNewRuleKeyword] = useState<string>('');
  const [newRuleWeight, setNewRuleWeight] = useState<number>(20);
  const [newRuleIsNegative, setNewRuleIsNegative] = useState<boolean>(false);

  // Live Desk Classifier Tester State
  const [deskTestTitle, setDeskTestTitle] = useState<string>('PM Anwar bincang ekonomi ASEAN bersama pemimpin Thailand');
  const [deskTestBrief, setDeskTestBrief] = useState<string>('Perdagangan bilateral dan kerjasama ekonomi serantau dipersetujui.');
  const [deskTestCategory, setDeskTestCategory] = useState<string>('Berita');
  const [deskTestResult, setDeskTestResult] = useState<any>(null);

  const loadAdjungDesks = () => {
    fetch('/api/system/adjung-desks')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAdjungDesks(data);
          if (data.length > 0 && !newRuleDeskId) {
            setNewRuleDeskId(data[0].id);
          }
        }
      })
      .catch(err => console.error('Failed to load Adjung desks:', err));
  };

  // Adjung Typography Rules State & Handlers
  const [adjungTypographyRules, setAdjungTypographyRules] = useState<TypographyRule[]>([]);
  const [newTypoTerm, setNewTypoTerm] = useState<string>('');
  const [newTypoStyle, setNewTypoStyle] = useState<string>('italic');
  const [newTypoCategory, setNewTypoCategory] = useState<string>('foreign_term');
  const [newTypoMatchType, setNewTypoMatchType] = useState<string>('word');
  const [newTypoScope, setNewTypoScope] = useState<string>('all');
  const [newTypoLanguage, setNewTypoLanguage] = useState<string>('ms-MY');
  const [newTypoCaseSensitive, setNewTypoCaseSensitive] = useState<boolean>(false);
  const [newTypoPriority, setNewTypoPriority] = useState<number>(50);
  const [newTypoStatus, setNewTypoStatus] = useState<string>('active');
  const [newTypoExcludeTerms, setNewTypoExcludeTerms] = useState<string>('');

  const loadAdjungTypographyRules = () => {
    fetch('/api/system/adjung-typography-rules')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAdjungTypographyRules(data);
      })
      .catch(err => console.error('Failed to load typography rules:', err));
  };

  const handleAddAdjungTypographyRule = async () => {
    if (!newTypoTerm.trim()) {
      addToast('error', 'Sila masukkan Istilah Tipografi.');
      return;
    }
    try {
      let excludeList: string[] = [];
      if (newTypoExcludeTerms.trim()) {
        excludeList = newTypoExcludeTerms.split(',').map(s => s.trim()).filter(Boolean);
      }
      const res = await fetch('/api/system/adjung-typography-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: newTypoTerm.trim(),
          style: newTypoStyle,
          category: newTypoCategory,
          matchType: newTypoMatchType,
          scope: newTypoScope,
          language: newTypoLanguage,
          caseSensitive: newTypoCaseSensitive,
          priority: Number(newTypoPriority) || 50,
          status: newTypoStatus,
          excludeTerms: excludeList
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Peraturan Tipografi '${newTypoTerm.trim()}' berjaya ditambah!`);
        setNewTypoTerm('');
        setNewTypoExcludeTerms('');
        loadAdjungTypographyRules();
      } else {
        addToast('error', data.error || 'Gagal menambah peraturan tipografi.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const handleToggleAdjungTypographyRuleStatus = async (rule: any) => {
    try {
      const nextStatus = rule.status === 'active' ? 'pending' : 'active';
      const nextEnabled = nextStatus === 'active' ? 1 : 0;
      const res = await fetch(`/api/system/adjung-typography-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, enabled: nextEnabled })
      });
      const data = await res.json();
      if (data.success) {
        addToast('info', `Status '${rule.term}' ditukar kepada '${nextStatus}'.`);
        loadAdjungTypographyRules();
      } else {
        addToast('error', data.error || 'Gagal mengubah status.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const handleDeleteAdjungTypographyRule = async (id: string, term: string) => {
    try {
      const res = await fetch(`/api/system/adjung-typography-rules/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('info', `Peraturan Tipografi '${term}' telah dipadam.`);
        loadAdjungTypographyRules();
      } else {
        addToast('error', data.error || 'Gagal memadam peraturan.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  // Editorial Memory State & Handlers
  const [editorialMemories, setEditorialMemories] = useState<any[]>([]);

  const loadEditorialMemories = () => {
    fetch('/api/system/editorial-memory')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setEditorialMemories(data);
      })
      .catch(err => console.error('Failed to load editorial memories:', err));
  };

  const handlePromoteMemory = async (memoryId: string, deskName: string, phrase: string) => {
    try {
      const res = await fetch('/api/system/editorial-memory/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryId, deskName, phrase })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Memori '${phrase}' disahkan sebagai Peraturan Desk ${deskName}!`);
        loadEditorialMemories();
        loadRssDeskRules();
      } else {
        addToast('error', data.error || 'Gagal mempromosikan cadangan memori.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  // RSS Blocked Categories State & Handlers
  const [rssBlockedCategories, setRssBlockedCategories] = useState<any[]>([]);
  const [newBlockedCategoryName, setNewBlockedCategoryName] = useState<string>('');
  const [blockedQueue, setBlockedQueue] = useState<any[]>([]);

  const loadRssBlockedCategories = () => {
    fetch('/api/system/rss-blocked-categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRssBlockedCategories(data);
      })
      .catch(err => console.error('Failed to load blocked categories:', err));
  };

  const loadBlockedQueue = () => {
    fetch('/api/system/ticker/blocked-queue')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBlockedQueue(data);
      })
      .catch(err => console.error('Failed to load blocked queue:', err));
  };

  const handleAddRssBlockedCategory = async () => {
    if (!newBlockedCategoryName.trim()) {
      addToast('error', 'Sila masukkan nama Kategori yang ingin disekat.');
      return;
    }
    try {
      const res = await fetch('/api/system/rss-blocked-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName: newBlockedCategoryName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Kategori XML '${newBlockedCategoryName.trim()}' berjaya ditambah ke Senarai Sekat!`);
        setNewBlockedCategoryName('');
        loadRssBlockedCategories();
      } else {
        addToast('error', data.error || 'Gagal menambah kategori tersekat.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const handleDeleteRssBlockedCategory = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/system/rss-blocked-categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('info', `Kategori XML '${name}' telah dikeluarkan dari Senarai Sekat.`);
        loadRssBlockedCategories();
      } else {
        addToast('error', data.error || 'Gagal membuang kategori.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const loadRssDeskRules = () => {
    loadEditorialMemories();
    loadRssBlockedCategories();
    loadBlockedQueue();
    loadAdjungTypographyRules();
    fetch('/api/system/rss-desk-rules')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRssDeskRules(data);
      })
      .catch(err => console.error('Failed to load RSS desk rules:', err));
  };

  const handleAddAdjungDesk = async () => {
    if (!newDeskName.trim()) {
      addToast('error', 'Sila masukkan Nama Desk.');
      return;
    }
    try {
      const res = await fetch('/api/system/adjung-desks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deskName: newDeskName,
          description: newDeskDescription,
          displayOrder: (adjungDesks.length + 1) * 10
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Desk '${newDeskName}' berjaya didaftarkan!`);
        setNewDeskName('');
        setNewDeskDescription('');
        loadAdjungDesks();
      } else {
        addToast('error', data.error || 'Gagal mendaftar desk.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const handleDeleteAdjungDesk = async (deskId: string, deskName: string) => {
    try {
      const res = await fetch(`/api/system/adjung-desks/${deskId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('info', `Desk '${deskName}' telah dibuang.`);
        loadAdjungDesks();
        loadRssDeskRules();
      } else {
        addToast('error', data.error || 'Gagal membuang desk.');
      }
    } catch (err) {
      addToast('error', 'Gagal membuang desk.');
    }
  };

  const handleAddRssDeskRule = async () => {
    if (!newRuleDeskId || !newRuleKeyword.trim()) {
      addToast('error', 'Sila pilih Desk dan masukkan Kata Kunci.');
      return;
    }
    try {
      const res = await fetch('/api/system/rss-desk-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deskId: newRuleDeskId,
          keyword: newRuleKeyword,
          weight: newRuleWeight,
          isNegative: newRuleIsNegative ? 1 : 0,
          enabled: 1,
          orderIndex: (rssDeskRules.length + 1) * 10
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Peraturan Kata Kunci '${newRuleKeyword}' berjaya ditambah!`);
        setNewRuleKeyword('');
        loadRssDeskRules();
      } else {
        addToast('error', data.error || 'Gagal menambah peraturan kata kunci.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const handleDeleteRssDeskRule = async (ruleId: string, keyword: string) => {
    try {
      const res = await fetch(`/api/system/rss-desk-rules/${ruleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('info', `Peraturan kata kunci '${keyword}' telah dibuang.`);
        loadRssDeskRules();
      } else {
        addToast('error', data.error || 'Gagal membuang peraturan.');
      }
    } catch (err) {
      addToast('error', 'Gagal membuang peraturan.');
    }
  };

  const handleRunDeskClassifierTest = async () => {
    try {
      const res = await fetch('/api/system/rss-desk-rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testTitle: deskTestTitle,
          testBrief: deskTestBrief,
          testCategory: deskTestCategory
        })
      });
      const data = await res.json();
      if (data.success) {
        setDeskTestResult(data);
      } else {
        addToast('error', data.error || 'Gagal menguji klasifikasi desk.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan ujian klasifikasi.');
    }
  };

  const handleOverrideTickerDesk = async (itemId: string, newDesk: string) => {
    try {
      const res = await fetch(`/api/system/ticker/override-desk/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDesk })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Desk artikel berjaya ditukar kepada '${newDesk}'!`);
        loadReviewQueue();
      } else {
        addToast('error', data.error || 'Gagal mengubah desk artikel.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const loadRssEditorialSettings = () => {
    loadRssTextRules();
    loadAdjungDesks();
    loadRssDeskRules();
    fetch('/api/system/rss-settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.autoLiveThreshold) setRssAutoLiveThreshold(data.autoLiveThreshold);
          if (data.reviewThreshold) setRssReviewThreshold(data.reviewThreshold);
          if (data.priorityKeywords !== undefined) setRssPriorityKeywords(data.priorityKeywords);
          if (data.blockedKeywords !== undefined) setRssBlockedKeywords(data.blockedKeywords);
          if (data.priorityBonus) setRssPriorityBonus(data.priorityBonus);
          if (data.blockedPenalty) setRssBlockedPenalty(data.blockedPenalty);
          if (data.maxNewsAgeHours !== undefined) setRssMaxNewsAgeHours(data.maxNewsAgeHours);
        }
      })
      .catch(err => console.error('Failed to load RSS editorial settings:', err));
  };

  const handleSaveRssEditorialSettings = async () => {
    try {
      const res = await fetch('/api/system/rss-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoLiveThreshold: rssAutoLiveThreshold,
          reviewThreshold: rssReviewThreshold,
          priorityKeywords: rssPriorityKeywords,
          blockedKeywords: rssBlockedKeywords,
          priorityBonus: rssPriorityBonus,
          blockedPenalty: rssBlockedPenalty,
          maxNewsAgeHours: rssMaxNewsAgeHours
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Tetapan & Peraturan Editorial RSS berjaya disimpan!');
      } else {
        addToast('error', data.error || 'Gagal menyimpan tetapan.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const loadRssSources = () => {
    loadRssEditorialSettings();
    fetch('/api/system/rss-sources')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRegisteredRssSources(data);
      })
      .catch(err => console.error('Failed to load RSS sources:', err));
  };

  const handleAddRssSource = async () => {
    if (!newRssName.trim() || !newRssUrl.trim()) {
      addToast('error', 'Sila masukkan Nama Sumber dan URL RSS Feed.');
      return;
    }
    try {
      const res = await fetch('/api/system/rss-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceName: newRssName,
          rssUrl: newRssUrl,
          language: 'ms-MY',
          trustScore: Number(newRssTrust) || 90,
          categoryMapping: newRssCategory,
          enabled: 1
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Sumber RSS '${newRssName}' berjaya didaftarkan!`);
        setNewRssName('');
        setNewRssUrl('');
        loadRssSources();
      } else {
        addToast('error', data.error || 'Gagal mendaftar sumber RSS.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan RSS.');
    }
  };

  const handleDeleteRssSource = async (sourceId: string, sourceName: string) => {
    try {
      const res = await fetch(`/api/system/rss-sources/${sourceId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('info', `Sumber RSS '${sourceName}' telah dibuang.`);
        loadRssSources();
      } else {
        addToast('error', data.error || 'Gagal membuang sumber RSS.');
      }
    } catch (err) {
      addToast('error', 'Gagal membuang sumber RSS.');
    }
  };

  const loadRssStatus = () => {
    fetch('/api/system/ticker/status')
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          setRssStatus(data);
        }
      })
      .catch(err => console.error('Failed to load RSS status:', err));
  };

  const loadReviewQueue = () => {
    fetch('/api/system/ticker/review-queue')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReviewQueue(data);
      })
      .catch(err => console.error('Failed to load review queue:', err));
    loadRssStatus();
  };

  const handleFetchDirectRss = async () => {
    setIsFetchingRss(true);
    try {
      const res = await fetch('/api/system/ticker/fetch-direct', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setRssStatus(data);
        addToast('success', `RSS Direct berjaya diserap! (${data.autoLiveCount} Auto Live, ${data.pendingReviewCount} Menunggu Review)`);
        loadReviewQueue();
      } else {
        addToast('error', data.error || 'Gagal menyerap RSS Direct.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan RSS Direct.');
    } finally {
      setIsFetchingRss(false);
    }
  };

  useEffect(() => {
    if (editingSlotIndex === -1) {
      loadRssSources();
      loadReviewQueue();
      loadRssStatus();
    }
  }, [editingSlotIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewsOverlay(false);
        setActiveFooterPageKey(null);
        setEditingSlotIndex(null);
        setFormConfig(null);
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

  useEffect(() => {
    if (editingSlotIndex === null) {
      setAiLogs([]);
      return;
    }
    fetch(`/api/ai/logs/${editingSlotIndex}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAiLogs(data);
        }
      })
      .catch(err => console.error('Failed to fetch AI logs for slot:', err));
  }, [editingSlotIndex]);

  const isEditingBarSlot = editingSlotIndex !== null && TIER_SLOTS.BAR.includes(editingSlotIndex);
  const [slotsConfig, setSlotsConfig] = useState<any[]>([]);
  const [formConfig, setFormConfig] = useState<any | null>(null);
  const [isSavingSlot, setIsSavingSlot] = useState<boolean>(false);
  const [isExecutingNow, setIsExecutingNow] = useState<boolean>(false);
  const [executingSuccessMessage, setExecutingSuccessMessage] = useState<string>('');
  const [activeFooterPageKey, setActiveFooterPageKey] = useState<string | null>(null);
  const [footerPageData, setFooterPageData] = useState<any | null>(null);
  const [isEditingFooterPage, setIsEditingFooterPage] = useState<boolean>(false);
  const [footerFormTitle, setFooterFormTitle] = useState<string>('');
  const [footerFormContent, setFooterFormContent] = useState<string>('');
  const [isSavingFooterPage, setIsSavingFooterPage] = useState<boolean>(false);
  const [isLoadingFooterPage, setIsLoadingLoadingFooterPage] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [aiProviders, setAiProviders] = useState<any[]>([]);
  const [masterPrompt, setMasterPrompt] = useState<string>('');
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

  useEffect(() => {
    if (systemSettings?.masterPrompt) {
      setMasterPrompt(systemSettings.masterPrompt);
    }
  }, [systemSettings]);

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

    fetch('/api/ai/providers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAiProviders(data.filter((p: any) => p.enabled === 1 || p.enabled === true));
        }
      })
      .catch(err => console.error('Failed to load AI providers:', err));

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

  const handleCardClick = (idx: number) => {
    if (!isEditMode) return;
    // Guard against a race where slotsConfig hasn't finished loading yet: without this, `config`
    // below silently resolves to undefined for every slot, and the modal falls back to synthesizing
    // its "Kandungan Manual" textarea from demo/placeholder content — which looks like real content
    // and can silently overwrite real saved data if the user saves before the real config arrives.
    if (slotsConfig.length === 0) return;
    const config = slotsConfig.find(s => s.slotIndex === idx);
    const limits = getLimitsForIndex(idx, config);

    if (idx === -1) {
      setFormConfig({
        slotIndex: -1,
        contentMode: config?.contentMode || 'Manual',
        providerId: config?.providerId || '',
        model: config?.model || '',
        promptText: config?.promptText || '',
        sourcesList: config?.sourcesList || '',
        refreshRate: (config?.refreshRate === 'Daily' || config?.refreshRate === 'Weekly') ? config.refreshRate : 'Daily',
        allowedContentTypes: config?.allowedContentTypes || '',
        priority: config?.priority || 'High',
        expiresAt: config?.expiresAt || '',
        bgColor: config?.bgColor || 'transparent',
        borderColor: config?.borderColor || '',
        textColor: config?.textColor || '#1F1F1F',
        manualTitle: 'Berita Terkini',
        manualSummary: config?.manualSummary || systemSettings?.inTheNewsText || '',
        manualSource: '',
        manualUrl: '',
        manualImageUrl: '',
        manualDesk: '',
        activeObjectId: '',
        searchStrategy: config?.searchStrategy || 'Structured Sources Only',
        carouselInterval: config?.carouselInterval || 10,
        carouselDelay: config?.carouselDelay || 0,
        generationLimit: config?.generationLimit || 10,
        maxTitle: config?.maxTitle !== undefined && config?.maxTitle !== null ? config.maxTitle : limits.maxTitle,
        maxBrief: config?.maxBrief !== undefined && config?.maxBrief !== null ? config.maxBrief : limits.maxBrief,
        maxBriefLong: config?.maxBriefLong !== undefined && config?.maxBriefLong !== null ? config.maxBriefLong : limits.maxBriefLong,
        masterPrompt: masterPrompt,
        refreshHour: config?.refreshHour || '00:00',
        refreshDay: config?.refreshDay || 'Isnin',
        eventExpiryFilter: '',
        aiPromptTopic: config?.aiPromptTopic || '',
        aiPromptRecency: config?.aiPromptRecency || '1 minggu terkini',
        aiPromptLanguage: config?.aiPromptLanguage || 'Bahasa Melayu',
        aiPromptRegion: config?.aiPromptRegion || 'Global, Malaysia',
        aiPromptSource: config?.aiPromptSource || ''
      });
      setEditingSlotIndex(-1);
      setShowResetMenu(false);
      return;
    }
    const item = bentoNewsItems[idx];

    const isBarSlot = TIER_SLOTS.BAR.includes(idx);

    let manualSummaryText = config?.manualSummary || '';
    
    // Sanitize any legacy dummy texts stored in the database manualSummary. Known-bad legacy
    // placeholder values are cleared to empty, NOT replaced with a different fabricated value --
    // a specific fake source/URL is exactly as misleading as the placeholder it replaces.
    if (manualSummaryText) {
      manualSummaryText = manualSummaryText.replace(/ChatGPT\/Gemini Manual Paste/g, '');
      manualSummaryText = manualSummaryText.replace(/URL:\s*#\s*$/gm, 'URL: ');
      // If date is in ISO format, format it nicely (reformatting a real value, not fabricating one)
      manualSummaryText = manualSummaryText.replace(/Tarikh:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z|\d{4}-\d{2}-\d{2})/g, () => {
        return `Tarikh: ${new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      });
    }

    if (!manualSummaryText.includes('Tajuk:') && !manualSummaryText.includes('Event:')) {
      const itemsList = item?.items || [];
      if (isBarSlot) {
        if (itemsList.length > 0) {
          // itm here comes from the raw (unprocessed) carousel items array, so itm.title is
          // still the original string -- unlike the single-item case below, which reads from
          // the top-level resolved item whose .title has been overwritten with parsed React
          // elements for rendering (see bentoNewsItems useMemo); .titleString holds the raw
          // string there instead.
          manualSummaryText = itemsList.map((itm: any) => {
            const eventDate = itm.originalDate || itm.date || itm.publishedAt || '';
            const organizer = itm.organizer || itm.penganjur || '';
            const location = itm.location || '';
            const access = itm.access || '';
            const penerangan = itm.penerangan || '';
            const url = (itm.url && itm.url !== '#') ? itm.url : '';
            return `Tarikh: ${eventDate}\nEvent: (had ${limits.maxTitle} aksara) ${itm.title || ''}\nPenganjur: ${organizer}\nLokasi: ${location}\nAkses: ${access}\nPenerangan: ${penerangan}\nURL: ${url}`;
          }).join('\n\n____\n\n');
        } else {
          const title = config?.manualTitle || item?.titleString || '';
          const organizer = config?.manualSource || item?.organizer || item?.penganjur || '';
          const location = item?.location || '';
          const access = item?.access || '';
          const penerangan = item?.penerangan || '';
          const eventDate = item?.originalDate || item?.date || item?.publishedAt || '';
          const rawUrl = config?.manualUrl || item?.url || '';
          const url = rawUrl === '#' ? '' : rawUrl;

          manualSummaryText = `Tarikh: ${eventDate}
Event: (had ${limits.maxTitle} aksara) ${title}
Penganjur: ${organizer}
Lokasi: ${location}
Akses: ${access}
Penerangan: ${penerangan}
URL: ${url}`;
        }
      } else {
        if (itemsList.length > 0) {
          // Same note as the BAR branch above: itm.title/itm.brief are raw strings here (from
          // the unprocessed items array), not the parsed-for-render form.
          manualSummaryText = itemsList.map((itm: any, bIdx: number) => {
            const uuid = itm.id || `object-manual-slot${idx}-${Date.now()}-${bIdx}`;
            const url = (itm.url && itm.url !== '#') ? itm.url : '';
            const source = (itm.source && itm.source !== 'ChatGPT/Gemini Manual Paste') ? itm.source : '';
            const cleanDate = itm.originalDate || '';
            const cleanSourceType = itm.sourceType === 'print' ? 'Bahan Bercetak' : itm.sourceType === 'audio' ? 'Audio' : itm.sourceType === 'video' ? 'Video' : (itm.sourceType || '');
            return `UUID: ${uuid}\nTajuk: ${itm.title || ''}\nHuraian ringkas: ${itm.brief || ''}\nHuraian panjang: ${itm.briefLong || ''}\nKategori: ${itm.desk || ''}\nJenis sumber: ${cleanSourceType}\nTarikh: ${cleanDate}\nSumber: ${source}\nURL: ${url}`;
          }).join('\n\n________________________________________\n\n');
        } else {
          const uuid = item?.id || `object-manual-slot${idx}-${Date.now()}-0`;
          const title = config?.manualTitle || item?.titleString || '';
          const brief = config?.manualSummary || item?.briefString || '';
          const briefLong = item?.briefLong || '';
          const desk = config?.manualDesk || item?.desk || '';
          const rawSource = config?.manualSource || item?.source || '';
          const source = rawSource === 'ChatGPT/Gemini Manual Paste' ? '' : rawSource;
          const rawUrl = config?.manualUrl || item?.url || '';
          const url = rawUrl === '#' ? '' : rawUrl;
          const date = item?.originalDate || '';
          const st = item?.sourceType === 'print' ? 'Bahan Bercetak' : item?.sourceType === 'audio' ? 'Audio' : item?.sourceType === 'video' ? 'Video' : (item?.sourceType || '');

          manualSummaryText = `UUID: ${uuid}
Tajuk: ${title}
Huraian ringkas: ${brief}
Huraian panjang: ${briefLong}
Kategori: ${desk}
Jenis sumber: ${st}
Tarikh: ${date}
Sumber: ${source}
URL: ${url}`;
        }
      }
    }

    setFormConfig({
      slotIndex: idx,
      contentMode: config?.contentMode || 'Manual',
      providerId: config?.providerId || '',
      model: config?.model || '',
      promptText: config?.promptText || '',
      sourcesList: config?.sourcesList || '',
      refreshRate: (config?.refreshRate === 'Daily' || config?.refreshRate === 'Weekly') ? config.refreshRate : 'Daily',
      allowedContentTypes: config?.allowedContentTypes || '',
      priority: config?.priority || 'Medium',
      expiresAt: config?.expiresAt || '',
      bgColor: config?.bgColor || 'transparent',
      borderColor: config?.borderColor || '',
      textColor: config?.textColor || '#1F1F1F',
      manualTitle: config?.manualTitle || item?.titleString || '',
      manualSummary: manualSummaryText,
      manualSource: config?.manualSource || item?.source || '',
      manualUrl: config?.manualUrl || item?.url || '#',
      manualImageUrl: config?.manualImageUrl || item?.imageUrl || '',
      manualDesk: config?.manualDesk || item?.desk || '',
      activeObjectId: config?.activeObjectId || '',
      searchStrategy: config?.searchStrategy || 'Structured Sources Only',
      carouselInterval: config?.carouselInterval || 10,
      carouselDelay: config?.carouselDelay || 0,
      generationLimit: config?.generationLimit || 10,
      maxTitle: config?.maxTitle !== undefined && config?.maxTitle !== null ? config.maxTitle : limits.maxTitle,
      maxBrief: config?.maxBrief !== undefined && config?.maxBrief !== null ? config.maxBrief : limits.maxBrief,
      maxBriefLong: config?.maxBriefLong !== undefined && config?.maxBriefLong !== null ? config.maxBriefLong : limits.maxBriefLong,
      masterPrompt: masterPrompt,
      refreshHour: config?.refreshHour || '00:00',
      refreshDay: config?.refreshDay || 'Isnin',
      eventExpiryFilter: config?.eventExpiryFilter || '',
      aiPromptTopic: config?.aiPromptTopic || '',
      aiPromptRecency: config?.aiPromptRecency || '1 minggu terkini',
      aiPromptLanguage: config?.aiPromptLanguage || 'Bahasa Melayu',
      aiPromptRegion: config?.aiPromptRegion || 'Global, Malaysia',
      aiPromptSource: config?.aiPromptSource || ''
    });
    setEditingSlotIndex(idx);
    setShowResetMenu(false);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formConfig) return;
    setIsSavingSlot(true);

    const finalFormConfig = { ...formConfig };
    if (TIER_SLOTS.BAR.includes(formConfig.slotIndex)) {
      finalFormConfig.allowedContentTypes = 'Event';
    }

    try {
      const response = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormConfig)
      });
      const data = await response.json();
      if (data.success) {
        setRefreshKey(prev => prev + 1);
        setEditingSlotIndex(null);
        setFormConfig(null);
        setShowResetMenu(false);
        addToast('success', 'Tetapan slot berjaya disimpan.');
      } else {
        addToast('error', 'Gagal menyimpan slot: ' + (data.error || ''));
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Ralat menyimpan slot: ' + (err.message || ''));
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleRunSlotNow = async () => {
    if (!formConfig) return;
    setIsExecutingNow(true);
    setExecutingSuccessMessage('');
    try {
      // Simpan konfigurasi secara senyap ke pangkalan data terlebih dahulu
      const finalFormConfig = { ...formConfig };
      const saveResponse = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormConfig)
      });
      if (!saveResponse.ok) {
        throw new Error('Gagal menyimpan tetapan semasa sebelum memulakan penjanaan.');
      }

      const response = await fetch('/api/system/slots/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex: formConfig.slotIndex })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setExecutingSuccessMessage('Penjanaan AI berjaya diaktifkan dan dikemas kini!');
        addToast('success', 'Penjanaan AI berjaya dikemas kini!');
        setRefreshKey(prev => prev + 1);
        
        // Re-fetch AI logs after successful run
        fetch(`/api/ai/logs/${formConfig.slotIndex}`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setAiLogs(data);
            }
          })
          .catch(err => console.error('Failed to fetch AI logs for slot:', err));

        setTimeout(() => {
          setExecutingSuccessMessage('');
        }, 5000);
      } else {
        addToast('error', 'Gagal mengaktifkan segera: ' + (data.error || ''));
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Ralat mengaktifkan segera: ' + (err.message || ''));
    } finally {
      setIsExecutingNow(false);
    }
  };

  const handleFooterLinkClick = async (key: string) => {
    setActiveFooterPageKey(key);
    setIsLoadingLoadingFooterPage(true);
    setIsEditingFooterPage(false);
    setFooterPageData(null);
    try {
      const res = await fetch(`/api/pages/${key}`);
      if (res.ok) {
        const data = await res.json();
        setFooterPageData(data);
        setFooterFormTitle(data.title || '');
        setFooterFormContent(data.content || '');
      } else {
        addToast('error', 'Gagal memuatkan kandungan halaman.');
        setActiveFooterPageKey(null);
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Ralat memuatkan kandungan halaman.');
      setActiveFooterPageKey(null);
    } finally {
      setIsLoadingLoadingFooterPage(false);
    }
  };

  const handleSaveFooterPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFooterPageKey) return;
    setIsSavingFooterPage(true);
    try {
      const res = await fetch(`/api/pages/${activeFooterPageKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: footerFormTitle, content: footerFormContent })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFooterPageData({
          key: activeFooterPageKey,
          title: footerFormTitle,
          content: footerFormContent,
          updatedAt: new Date().toISOString()
        });
        setIsEditingFooterPage(false);
        addToast('success', 'Halaman berjaya disimpan.');
      } else {
        addToast('error', 'Gagal menyimpan kandungan: ' + (data.error || ''));
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Ralat menyimpan kandungan: ' + (err.message || ''));
    } finally {
      setIsSavingFooterPage(false);
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
    // Editorial "About Adjung" placeholder pool — shown for any of the 38 slots that has no real
    // content (never configured, or deleted) instead of the old character-limit dev-reference text.
    // Cycled across slots by size category so nothing overflows: BAR/KOMPAK slot types render title
    // only (no brief in their JSX template), and BAR's title cap is a tight 40 chars, so only the
    // items whose title already fits 40 chars are used there.
    const ABOUT_ADJUNG_ITEMS = [
      { title: 'Selamat Datang ke Adjung', brief: 'Adjung ialah platform penerbitan digital yang mengutamakan ilmu, penulisan berkualiti dan pengalaman membaca yang tenang tanpa gangguan metrik populariti.', desk: 'Mengenai Adjung', source: 'Adjung Editorial', url: '/about' },
      { title: "Mengapa Adjung Tidak Memaparkan Bilangan 'Like'", brief: 'Adjung menilai penerbitan berdasarkan nilai ilmu dan mutu penulisan, bukan jumlah reaksi, tontonan atau kadar penglibatan pengguna.', desk: 'Falsafah', source: 'Adjung Editorial', url: '/about/philosophy' },
      { title: 'Setiap Penerbitan Mempunyai Tempatnya', brief: 'Artikel, esei, nota dan karya ilmiah dipersembahkan mengikut susun atur editorial yang konsisten supaya pembacaan kekal jelas dan selesa.', desk: 'Penerbitan', source: 'Adjung Editorial', url: '/about/publication-model' },
      { title: 'Membina Semula Peradaban Bermula dengan Pengetahuan', brief: 'Adjung diwujudkan sebagai ruang menghimpunkan pengetahuan daripada pelbagai bidang untuk pembaca yang menghargai ketepatan, sumber dan konteks.', desk: 'Visi', source: 'Adjung Editorial', url: '/about/vision' },
      { title: 'Editorial Didahulukan, Algoritma Dikemudiankan', brief: 'Susunan kandungan di Adjung ditentukan melalui pertimbangan editorial dan organisasi ilmu, bukan semata-mata oleh algoritma penglibatan.', desk: 'Editorial', source: 'Adjung Editorial', url: '/about/editorial' },
      { title: 'Satu Platform, Pelbagai Bidang Ilmu', brief: 'Daripada sains dan teknologi hingga sejarah, bahasa, agama dan seni, Adjung menghimpunkan penerbitan daripada pelbagai disiplin dalam satu ekosistem.', desk: 'Bidang Ilmu', source: 'Adjung Editorial', url: '/about/domains' },
      { title: 'Direka untuk Pembacaan Jangka Panjang', brief: 'Reka bentuk Adjung menumpukan kepada tipografi, ruang putih dan hierarki visual bagi menyokong pembacaan yang selesa dalam tempoh yang panjang.', desk: 'Reka Bentuk', source: 'Adjung Editorial', url: '/about/design' },
      { title: 'Setiap Penulis Mempunyai Ruang Sendiri', brief: 'Setiap ahli Adjung mempunyai laman peribadi yang menghimpunkan karya, biografi dan identiti penerbitan dalam satu tempat.', desk: 'Keahlian', source: 'Adjung Editorial', url: '/about/membership' },
      { title: 'Pengetahuan Layak Dipersembahkan dengan Baik', brief: 'Adjung percaya bahawa susun atur editorial yang kemas dan tipografi yang teliti membantu pembaca memahami kandungan dengan lebih baik.', desk: 'Tipografi', source: 'Adjung Editorial', url: '/about/typography' },
      { title: 'Masih Tiada Kandungan untuk Bahagian Ini', brief: 'Bahagian ini akan memaparkan penerbitan apabila kandungan tersedia. Sementara itu, teruskan meneroka pelbagai bidang ilmu lain di Adjung.', desk: 'Makluman', source: 'Adjung Editorial', url: '' },
    ];
    // Indices (into ABOUT_ADJUNG_ITEMS) whose title is short enough (<=40 chars) for BAR-type slots.
    const SHORT_TITLE_SAFE = [0, 2, 5, 6, 7, 9];
    const BAR_SLOTS = new Set(TIER_SLOTS.BAR);
    const NO_BRIEF_SLOTS = new Set([4, 5, 17, 18, 31, 32, 7, 8, 9, 10, 21, 22, 23, 24]);

    const fallbacks = Array.from({ length: 38 }, (_, i) => {
      const pool = BAR_SLOTS.has(i) ? SHORT_TITLE_SAFE.map(idx => ABOUT_ADJUNG_ITEMS[idx]) : ABOUT_ADJUNG_ITEMS;
      const item = pool[i % pool.length];
      return {
        desk: item.desk,
        title: item.title,
        brief: NO_BRIEF_SLOTS.has(i) ? '' : item.brief,
        source: item.source,
        url: item.url,
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
      if (itemToPush.desk === 'BELUM DIKELASKAN') {
        itemToPush.desk = 'SEMASA';
      }
      if (itemToPush.desk && !itemToPush.categoryColor) {
        itemToPush.categoryColor = categoryColors[itemToPush.desk.toLowerCase()];
      }
      itemToPush.index = i;
      result.push(itemToPush);
    }

    return result;
  }, [parsedNewsItems, hasLoadedContent, categoryColors]);

  const [carouselIndices, setCarouselIndices] = useState<{[key: number]: number}>({});

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
      setCarouselIndices(prev => {
        if (prev[actualSlotIdx] !== undefined) return prev;
        const timeBasedStart = Math.floor(Date.now() / 1000 / intervalSecs) % items.length;
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
  }, [rawBentoNewsItems]);

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
      if (resolvedItem.title) {
        resolvedItem.title = parseInlineFormatting(padToLimit(resolvedItem.title, limits.maxTitle));
      }
      if (resolvedItem.brief && limits.maxBrief > 0) {
        resolvedItem.brief = parseInlineFormatting(padToLimit(resolvedItem.brief, limits.maxBrief));
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






  // Helper to extract name initials (e.g. "Elena Vasquez" -> "E.V.")
  const getInitials = (name: string): string => {
    if (!name) return '';
    return name
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase())
      .filter(c => /[A-Z]/.test(c))
      .join('.') + '.';
  };

  // Helper to estimate reading duration
  const estimateReadingTime = (content: string): number => {
    if (!content) return 1;
    const words = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  };

  // 2. Curated & Dynamic Content Prep (populated from published database entries)
  const activeFeatured = React.useMemo(() => {
    if (systemSettings.featuredEntryId) {
      const resolved = entries.find(
        (e) => (e.id === systemSettings.featuredEntryId || e.slug === systemSettings.featuredEntryId) && e.status === 'Published'
      );
      if (resolved) return resolved;
    }
    // Fallback: most recent Published Essay or Article
    const newestPublish = [...entries]
      .filter((e) => (e.contentType === 'Essay' || e.contentType === 'Article') && e.status === 'Published')
      .sort((a, b) => new Date(b.publishedDate || b.createdDate).getTime() - new Date(a.publishedDate || a.createdDate).getTime())[0];
    if (newestPublish) return newestPublish;

    // Fallback static entry if nothing else exists
    return {
      id: 'fallback-featured',
      authorId: null,
      publisher: 'Elena Vasquez',
      contentType: 'Essay' as const,
      status: 'Published' as const,
      visibility: 'Public' as const,
      createdDate: new Date(2026, 6, 4).toISOString(),
      updatedDate: new Date(2026, 6, 4).toISOString(),
      publishedDate: new Date(2026, 6, 4).toISOString(),
      title: 'On the Preservation of Human Knowledge in an Age of Impermanence',
      slug: 'preservation-of-human-knowledge',
      tags: ['Philosophy', 'Preservation', 'Institutions'],
      canonicalUrl: 'https://adjung.com/essay/preservation-of-human-knowledge',
      content: `A meditation on why civilizations forget, how libraries burn, and what it means to build institutions that outlast their founders. This essay traces the arc from Alexandria to the digital present, arguing that preservation is not passive but an active, moral commitment.`,
      excerpt: `A meditation on why civilizations forget, how libraries burn, and what it means to build institutions that outlast their founders. This essay traces the arc from Alexandria to the digital present, arguing that preservation is not passive but an active, moral commitment.`,
      url: ''
    };
  }, [entries, systemSettings.featuredEntryId]);

  const featuredAuthorName = React.useMemo(() => {
    if (!activeFeatured.authorId) return activeFeatured.publisher || 'Elena Vasquez';
    const author = users.find((u) => u.id === activeFeatured.authorId);
    return author?.penName || activeFeatured.publisher || 'Elena Vasquez';
  }, [activeFeatured, users]);

  const featuredAuthorSig = React.useMemo(() => {
    return getInitials(featuredAuthorName);
  }, [featuredAuthorName]);

  // Editorial Note Aside (mapped to the newest published Editor's Note entry)
  const dbEditorNote = React.useMemo(() => {
    return [...entries]
      .filter((e) => e.contentType === "Editor's Note" && e.status === 'Published')
      .sort((a, b) => new Date(b.publishedDate || b.createdDate).getTime() - new Date(a.publishedDate || a.createdDate).getTime())[0] || null;
  }, [entries]);

  // News Ticker State & Logic (unaffected)
  const [tickerIndex, setTickerIndex] = useState(0);
  const notices = entries.filter((e) => e.contentType === 'Notice' && e.status === 'Published');
  const fallbackTicker = [
    "New archaeological findings reveal previously unknown trade routes across Central Asia during the 8th century.",
    "Leading institutions establish consortium for digital preservation of endangered linguistic archives.",
    "Study examines long-term effects of historical documentation practices on contemporary scholarship."
  ];
  const tickerItems = notices.length > 0
    ? notices.map(n => `${n.title} - ${n.excerpt || n.content.substring(0, 100)}`)
    : fallbackTicker;

  useEffect(() => {
    if (tickerItems.length <= 1) return;
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerItems.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [tickerItems.length]);

  // Curation permissions
  const canCurate = currentUser && (
    currentUser.role === 'Chief Editor' || 
    currentUser.role === 'Editor' || 
    currentUser.role === 'Admin'
  );

  // Institutional Notice Board
  const noticeBoardText = notices.length > 0
    ? `${notices[0].title}: ${notices[0].excerpt || notices[0].content.substring(0, 150)}`
    : "Adjung will begin accepting applications for the 2027 Fellowship Programme in September. Details will be published in the Directory.";

  const AI_RESET_FIELDS = {
    providerId: '', model: '', promptText: '', sourcesList: '',
    searchStrategy: 'Structured Sources Only', allowedContentTypes: '',
    refreshRate: 'Daily', refreshHour: '00:00', refreshDay: 'Isnin',
    generationLimit: 1, eventExpiryFilter: '',
    aiPromptTopic: '', aiPromptRecency: '1 minggu terkini',
    aiPromptLanguage: 'Bahasa Melayu', aiPromptRegion: 'Global, Malaysia', aiPromptSource: ''
  };

  const MANUAL_RESET_FIELDS = {
    manualSummary: '', manualTitle: '', manualSource: '', manualUrl: '', manualImageUrl: ''
  };

  const handleResetAI = () => {
    if (!formConfig) return;
    if (!window.confirm('Kosongkan semua Tetapan Penjanaan AI untuk slot ini?')) return;
    setFormConfig({ ...formConfig, ...AI_RESET_FIELDS });
    setShowResetMenu(false);
  };

  const handleResetManual = () => {
    if (!formConfig) return;
    if (!window.confirm('Kosongkan Kandungan Manual untuk slot ini?')) return;
    setFormConfig({ ...formConfig, ...MANUAL_RESET_FIELDS });
    setShowResetMenu(false);
  };

  const handleResetAll = () => {
    if (!formConfig) return;
    if (!window.confirm('Kosongkan SEMUA medan untuk slot ini? Tindakan ini tidak boleh dibuat asal selepas anda klik Simpan Perubahan.')) return;
    const limits = getLimitsForIndex(formConfig.slotIndex, null);
    setFormConfig({
      ...formConfig,
      ...AI_RESET_FIELDS,
      ...MANUAL_RESET_FIELDS,
      manualDesk: '',
      maxTitle: limits.maxTitle,
      maxBrief: limits.maxBrief,
      bgColor: 'transparent',
      textColor: '#1F1F1F',
      borderColor: '',
      carouselInterval: 10,
      carouselDelay: 0
    });
    setShowResetMenu(false);
  };

  // Shared "Tetapan Slot" block: Kategori, had aksara, reka bentuk & animasi. Rendered once inside
  // Mod Manual (moved near the top per editorial request) and once for Mod AI Generated (kept at the
  // bottom) — never both at once, since it's the same underlying fields for either mode.
  const renderTetapanSlot = () => {
    if (!formConfig) return null;
    const ADJUNG_COLOR_PRESETS = [
      { label: 'Maroon', value: '#802334' },
      { label: 'Hitam', value: '#1F1F1F' },
      { label: 'Kelabu', value: '#6B7280' },
      { label: 'Putih', value: '#FFFFFF' },
    ];
    const renderSwatchPicker = (fieldKey: string, extraOption?: { label: string; value: string }) => {
      const options = extraOption ? [extraOption, ...ADJUNG_COLOR_PRESETS] : ADJUNG_COLOR_PRESETS;
      const current = formConfig[fieldKey] || '';
      return (
        <div className="flex gap-2 flex-wrap items-center">
          {options.map(opt => {
            const isSelected = current === opt.value;
            const isLight = opt.value === '#FFFFFF' || opt.value === 'transparent' || opt.value === '';
            return (
              <Tooltip key={opt.label} text={opt.label}>
                <button
                  type="button"
                  onClick={() => setFormConfig({ ...formConfig, [fieldKey]: opt.value })}
                  className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${isSelected ? 'border-[#802334] scale-110' : 'border-stone-300'}`}
                  style={{
                    backgroundColor: (opt.value === 'transparent' || opt.value === '') ? '#ffffff' : opt.value,
                    backgroundImage: (opt.value === 'transparent' || opt.value === '') ? 'repeating-conic-gradient(#d6d3d1 0% 25%, #ffffff 0% 50%)' : undefined,
                    backgroundSize: (opt.value === 'transparent' || opt.value === '') ? '8px 8px' : undefined,
                  }}
                >
                  {isSelected && <Check size={14} className={isLight ? 'text-stone-800' : 'text-white'} />}
                </button>
              </Tooltip>
            );
          })}
        </div>
      );
    };
    return (
      <>
        <div className="border-t border-stone-150 col-span-2 my-2 pt-2">
          <h4 className="font-sans text-[10px] font-bold text-[#802334] uppercase tracking-wider">Tetapan Slot</h4>
        </div>

        {editingSlotIndex !== -1 && (
          <div className="flex flex-col gap-1 col-span-2">
            <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Kategori</label>
            <input
              type="text"
              value={formConfig.manualDesk}
              onChange={(e) => setFormConfig({ ...formConfig, manualDesk: e.target.value })}
              placeholder="Contoh: TEKNOLOGI, EKONOMI, SUKAN..."
              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
            />
            <p className="text-[9px] text-stone-500 font-sans mt-0.5">
              Dipaparkan pada tajuk "Urus Slot" di atas dan disegerakkan dengan Semakan Kandungan (Paparan Kad). Juga menyaring penjanaan kandungan AI.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Had Aksara Tajuk (maxTitle)</label>
          <input
            type="number"
            value={formConfig.maxTitle !== undefined && formConfig.maxTitle !== null ? formConfig.maxTitle : ''}
            onFocus={() => {
              ratioAnchorRef.current = { title: formConfig.maxTitle || 0, brief: formConfig.maxBrief || 0 };
            }}
            onChange={(e) => {
              const newMaxTitle = Math.max(0, parseInt(e.target.value) || 0);
              const tier = getGeometryTierForIndex(formConfig.slotIndex);
              const ratio = tier ? GEOMETRY_RATIOS[tier].ratio : null;
              const anchor = ratioAnchorRef.current || { title: formConfig.maxTitle || 0, brief: formConfig.maxBrief || 0 };
              const newMaxBrief = ratio !== null
                ? Math.max(0, Math.round(anchor.brief - (newMaxTitle - anchor.title) * ratio))
                : formConfig.maxBrief;
              setFormConfig({
                ...formConfig,
                maxTitle: newMaxTitle,
                maxBrief: newMaxBrief,
                manualSummary: updateLimitsInText(formConfig.manualSummary, newMaxTitle, newMaxBrief, formConfig.maxBriefLong)
              });
            }}
            placeholder="Contoh: 70"
            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
          />
          {getGeometryTierForIndex(formConfig.slotIndex) && (
            <p className="text-[9px] text-stone-400 font-sans">Tajuk &amp; huraian kad ini kongsi satu bajet ruang tetap — naikkan satu, satu lagi berkurang automatik.</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Had Aksara Huraian (maxBrief)</label>
          <input
            type="number"
            value={formConfig.maxBrief !== undefined && formConfig.maxBrief !== null ? formConfig.maxBrief : ''}
            onFocus={() => {
              ratioAnchorRef.current = { title: formConfig.maxTitle || 0, brief: formConfig.maxBrief || 0 };
            }}
            onChange={(e) => {
              const newMaxBrief = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
              const tier = getGeometryTierForIndex(formConfig.slotIndex);
              const ratio = tier ? GEOMETRY_RATIOS[tier].ratio : null;
              const anchor = ratioAnchorRef.current || { title: formConfig.maxTitle || 0, brief: formConfig.maxBrief || 0 };
              // ratio === 0 means this tier's brief is always empty (e.g. BAR) -- there's no
              // valid title/brief trade-off to compute, so leave maxTitle untouched instead of
              // dividing by zero.
              const newMaxTitle = ratio !== null && ratio !== 0
                ? Math.max(0, Math.round(anchor.title - (newMaxBrief - anchor.brief) / ratio))
                : formConfig.maxTitle;
              setFormConfig({
                ...formConfig,
                maxBrief: newMaxBrief,
                maxTitle: newMaxTitle,
                manualSummary: updateLimitsInText(formConfig.manualSummary, newMaxTitle, newMaxBrief, formConfig.maxBriefLong)
              });
            }}
            placeholder="Contoh: 150 (0 jika tiada)"
            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
          />
        </div>

        {editingSlotIndex !== -1 && !isEditingBarSlot && (
          <div className="flex flex-col gap-1 col-span-2">
            <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Had Aksara Huraian Panjang (maxBriefLong)</label>
            <input
              type="number"
              value={formConfig.maxBriefLong !== undefined && formConfig.maxBriefLong !== null ? formConfig.maxBriefLong : ''}
              onChange={(e) => {
                const newMaxBriefLong = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                setFormConfig({
                  ...formConfig,
                  maxBriefLong: newMaxBriefLong,
                  manualSummary: updateLimitsInText(formConfig.manualSummary, formConfig.maxTitle, formConfig.maxBrief, newMaxBriefLong)
                });
              }}
              placeholder="Contoh: 600 (0 jika tiada)"
              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
            />
            <p className="text-[9px] text-stone-500 font-sans mt-0.5">
              Kandungan tambahan yang tidak dipaparkan pada kad — akan digunakan dalam mod Spotlight (belum dibina). Tiada kaitan dengan had aksara tajuk/huraian di atas.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Warna Latar</label>
          {renderSwatchPicker('bgColor', { label: 'Telus', value: 'transparent' })}
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Warna Teks</label>
          {renderSwatchPicker('textColor')}
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Warna Bingkai</label>
          {renderSwatchPicker('borderColor', { label: 'Auto', value: '' })}
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Selang Masa Carousel (saat)</label>
          <input
            type="number"
            value={formConfig.carouselInterval}
            onChange={(e) => setFormConfig({ ...formConfig, carouselInterval: parseInt(e.target.value) || 10 })}
            placeholder="10"
            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kelewatan Mula Carousel (saat)</label>
          <input
            type="number"
            value={formConfig.carouselDelay}
            onChange={(e) => setFormConfig({ ...formConfig, carouselDelay: parseInt(e.target.value) || 0 })}
            placeholder="0"
            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
          />
        </div>
      </>
    );
  };

  return (
    <div className="bg-transparent text-[#1F1F1F] font-serif w-full min-h-screen px-4 md:px-8 py-12 select-none animate-fade-in">

      <div className="max-w-5xl mx-auto">
        
        {/* Wordmark Hero */}
        <section className="text-center pt-8 pb-6 animate-fade-in">
          <h1 className="font-serif font-normal tracking-tight text-6xl md:text-7xl text-[#802334]">
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
            if (isEditMode) {
              handleCardClick(-1);
            } else if (parsedTickerNewsItems.length > 0) {
              setActiveOverlayIndex(activeFrontpageIndex);
              setShowNewsOverlay(true);
            }
          }}
          className="py-1 px-0 bg-transparent hover:opacity-90 transition duration-300 cursor-pointer text-left group relative flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          {/* LEFT: TICKER SCROLLER ITEM */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isEditMode && (
              <Tooltip text="Urus Ticker Berita Terkini">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(-1);
                  }}
                  className="p-1 text-stone-400 hover:text-[#802334] transition cursor-pointer rounded hover:bg-stone-100 shrink-0"
                >
                  <Settings size={12} />
                </button>
              </Tooltip>
            )}

            {activeTickerNewsItem ? (
              <div className="select-text py-1 flex items-center overflow-hidden flex-1 gap-2.5">
                <strong
                  className="font-sans text-[11px] md:text-xs uppercase tracking-wider font-bold inline-block shrink-0 text-[#802334]"
                >
                  <HoverWords text="BERITA SEMASA" />
                </strong>
                <AnimatePresence mode="wait">
                  <motion.h4
                    key={activeFrontpageIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    className="font-serif text-[#1F1F1F] text-base md:text-lg leading-snug tracking-tight font-medium flex items-baseline truncate flex-1 min-w-0"
                  >
                    <span className="truncate"><TypographyRenderer text={activeTickerNewsItem.title} rules={adjungTypographyRules} scope="title" /></span>
                  </motion.h4>
                </AnimatePresence>
              </div>
            ) : (
              <p className="font-serif italic text-stone-400 text-xs py-1 select-none">No curated news items available.</p>
            )}
          </div>

          {/* RIGHT: CONTROLS & LANGUAGE TOGGLES */}
          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            {parsedTickerNewsItems.length > 0 && (
              <span className="font-mono text-[8px] uppercase tracking-wider text-stone-400 group-hover:text-[#802334] transition duration-200 mr-1 hidden sm:inline">
                &bull; Baca Paparan Penuh
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditMode(!isEditMode);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all border font-sans cursor-pointer ${
                isEditMode
                  ? 'bg-[#802334] text-white border-[#802334] shadow-sm font-semibold'
                  : 'bg-white text-stone-600 border-stone-300 hover:text-[#802334] hover:border-[#802334]'
              }`}
            >
              <Info size={12} className={isEditMode ? "animate-pulse" : ""} />
              {isEditMode ? 'Tutup Edit' : 'Edit Kandungan'}
            </button>
            {isEditMode && (
              <>
                <a
                  href="/editorium"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all border font-sans font-bold cursor-pointer bg-[#802334] text-white border-[#802334] hover:bg-[#601824]"
                >
                  <Building2 className="w-3.5 h-3.5" /> Editorium
                </a>
                <a
                  href="/studio/semakan-kandungan"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all border font-sans cursor-pointer bg-white text-stone-600 border-stone-300 hover:text-[#802334] hover:border-[#802334]"
                >
                  Semakan Kandungan
                </a>
              </>
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

        {/* Bento Grid News Layout */}
        <section className="my-8" id="bento-news-grid">


          <div className="flex flex-col gap-4">
            
            {/* ROW 1: Full horizontal (Index 0) */}
            {bentoNewsItems[0] && (
                <div 
                  onClick={() => handleCardClick(0)}
                  className={`col-span-1 md:col-span-6 p-6 md:p-8 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
               style={getCardTheme(bentoNewsItems[0], 'transparent').cardStyle} >
                <BentoInner itemKey="0" className="md:flex-row md:items-center justify-between gap-6" aiProvider={bentoNewsItems[0].aiProvider}>
                  <div className="space-y-2 max-w-3xl">
                    <CarouselStableBlock
                      items={bentoNewsItems[0].items && bentoNewsItems[0].items.length > 0 ? bentoNewsItems[0].items : [bentoNewsItems[0]]}
                      activeIndex={bentoNewsItems[0].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[0]).deskStyle}>{it.desk}</div>
                          <h3 className="font-serif text-2xl md:text-3xl leading-tight font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-100/90 leading-relaxed font-normal mt-4" style={getCardTheme(bentoNewsItems[0]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[0].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[10px] tracking-editorial uppercase text-stone-300 border-l border-stone-400/30 pl-4 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-1" style={getCardTheme(bentoNewsItems[0]).sourceStyle}>
                    <span>{bentoNewsItems[0].source}</span>
                    {(getDisplayDate(bentoNewsItems[0].originalDate) || formatBentoDate(bentoNewsItems[0].publishedAt)) && <span className="opacity-70 normal-case font-mono text-[9px]">{(getDisplayDate(bentoNewsItems[0].originalDate) || formatBentoDate(bentoNewsItems[0].publishedAt))}</span>}
                  </a>
                </BentoInner><span className="absolute top-8 right-8 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[0].publishedAt)}</span>
              </div>
            )}

            {/* ROW 2 & 3: Vertical, Horizontal, Square, 2 Compact (Indices 1 to 5) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Column: Vertical (Index 1) */}
              {bentoNewsItems[1] && (
                <div 
                  onClick={() => handleCardClick(1)}
                  className={`md:col-span-2 md:row-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[1], 'transparent').cardStyle} >
                  <BentoInner itemKey="1" className="gap-3" aiProvider={bentoNewsItems[1].aiProvider}>
                    <div className="space-y-4">
                      <CarouselStableBlock
                        items={bentoNewsItems[1].items && bentoNewsItems[1].items.length > 0 ? bentoNewsItems[1].items : [bentoNewsItems[1]]}
                        activeIndex={bentoNewsItems[1].carouselIndex || 0}
                        renderItem={(it) => (
                          <>
                            <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[1]).deskStyle}>{it.desk}</div>
                            <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">{safeParseInline(it.title)}</h3>
                            <p className="font-serif text-xs text-stone-100/95 leading-relaxed font-normal mt-4" style={getCardTheme(bentoNewsItems[1]).briefStyle}>{safeParseInline(it.brief)}</p>
                          </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[1].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[1]).sourceStyle}>
                      <span>{bentoNewsItems[1].source}</span>
                      {(getDisplayDate(bentoNewsItems[1].originalDate) || formatBentoDate(bentoNewsItems[1].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[1].originalDate) || formatBentoDate(bentoNewsItems[1].publishedAt))}</span>}
                    </a>
                  </BentoInner><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[1].publishedAt)}</span>
                </div>
              )}

              {/* Right/Top: Horizontal (Index 2) */}
              {bentoNewsItems[2] && (
                <div 
                  onClick={() => handleCardClick(2)}
                  className={`md:col-span-4 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[2], 'transparent').cardStyle} >
                  <BentoInner itemKey="2" className="md:flex-row md:items-center justify-between gap-4" aiProvider={bentoNewsItems[2].aiProvider}>
                    <div className="flex-1">
                      <CarouselStableBlock
                        items={bentoNewsItems[2].items && bentoNewsItems[2].items.length > 0 ? bentoNewsItems[2].items : [bentoNewsItems[2]]}
                        activeIndex={bentoNewsItems[2].carouselIndex || 0}
                        renderItem={(it) => (
                          <>
                            <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[2]).deskStyle}>{it.desk}</div>
                            <h3 className="font-serif text-lg md:text-xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200 mt-2">{safeParseInline(it.title)}</h3>
                            <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[2]).briefStyle}>{safeParseInline(it.brief)}</p>
                          </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[2].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[2]).sourceStyle}>
                      <span>{bentoNewsItems[2].source}</span>
                      {(getDisplayDate(bentoNewsItems[2].originalDate) || formatBentoDate(bentoNewsItems[2].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[2].originalDate) || formatBentoDate(bentoNewsItems[2].publishedAt))}</span>}
                    </a>
                  </BentoInner><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[2].publishedAt)}</span>
                </div>
              )}

              {/* Right/Bottom-Left: Square (Index 3) */}
              {bentoNewsItems[3] && (
                <div 
                  onClick={() => handleCardClick(3)}
                  className={`md:col-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[3], 'transparent').cardStyle} >
                  <BentoInner itemKey="3" className="gap-3" aiProvider={bentoNewsItems[3].aiProvider}>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[3]).deskStyle}>{bentoNewsItems[3].desk}</div>
                      <CarouselStableBlock
                        items={bentoNewsItems[3].items && bentoNewsItems[3].items.length > 0 ? bentoNewsItems[3].items : [bentoNewsItems[3]]}
                        activeIndex={bentoNewsItems[3].carouselIndex || 0}
                        renderItem={(it) => (
                          <>
                            <h3 className="font-serif text-base md:text-lg leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">{safeParseInline(it.title)}</h3>
                            <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[3]).briefStyle}>{safeParseInline(it.brief)}</p>
                          </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[3].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[3]).sourceStyle}>
                      <span>{bentoNewsItems[3].source}</span>
                      {(getDisplayDate(bentoNewsItems[3].originalDate) || formatBentoDate(bentoNewsItems[3].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[3].originalDate) || formatBentoDate(bentoNewsItems[3].publishedAt))}</span>}
                    </a>
                  </BentoInner><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[3].publishedAt)}</span>
                </div>
              )}

              {/* Right/Bottom-Right: Two Stacked Compacts (Indices 4 & 5) */}
              <div className="md:col-span-2 flex flex-col gap-4 h-full">
                {bentoNewsItems[4] && (
                <div 
                  onClick={() => handleCardClick(4)}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col min-h-[120px] flex-1 group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[4], 'transparent').cardStyle} >
                    <BentoInner itemKey="4" className="gap-3" aiProvider={bentoNewsItems[4].aiProvider}>
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[4]).deskStyle}>{bentoNewsItems[4].desk}</div>
                        <CarouselStableBlock
                          items={bentoNewsItems[4].items && bentoNewsItems[4].items.length > 0 ? bentoNewsItems[4].items : [bentoNewsItems[4]]}
                          activeIndex={bentoNewsItems[4].carouselIndex || 0}
                          renderItem={(it) => (
                            <>
                              <h3 className="font-serif text-xs md:text-sm font-medium leading-snug group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">{safeParseInline(it.title)}</h3>
                              <p className="font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[4]).briefStyle}>{safeParseInline(it.brief)}</p>
                            </>
                          )}
                        />
                      </div>
                      <a href={bentoNewsItems[4].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[4]).sourceStyle}>
                        <span>{bentoNewsItems[4].source}</span>
                        {(getDisplayDate(bentoNewsItems[4].originalDate) || formatBentoDate(bentoNewsItems[4].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px]">{(getDisplayDate(bentoNewsItems[4].originalDate) || formatBentoDate(bentoNewsItems[4].publishedAt))}</span>}
                      </a>
                    </BentoInner><span className="absolute top-4 right-4 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[4].publishedAt)}</span>
                  </div>
                )}
                {bentoNewsItems[5] && (
                <div 
                  onClick={() => handleCardClick(5)}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col min-h-[120px] flex-1 group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[5], 'transparent').cardStyle} >
                    <BentoInner itemKey="5" className="gap-3" aiProvider={bentoNewsItems[5].aiProvider}>
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[5]).deskStyle}>{bentoNewsItems[5].desk}</div>
                        <CarouselStableBlock
                          items={bentoNewsItems[5].items && bentoNewsItems[5].items.length > 0 ? bentoNewsItems[5].items : [bentoNewsItems[5]]}
                          activeIndex={bentoNewsItems[5].carouselIndex || 0}
                          renderItem={(it) => (
                            <>
                              <h3 className="font-serif text-xs md:text-sm font-medium leading-snug group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">{safeParseInline(it.title)}</h3>
                              <p className="font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[5]).briefStyle}>{safeParseInline(it.brief)}</p>
                            </>
                          )}
                        />
                      </div>
                      <a href={bentoNewsItems[5].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[5]).sourceStyle}>
                        <span>{bentoNewsItems[5].source}</span>
                        {(getDisplayDate(bentoNewsItems[5].originalDate) || formatBentoDate(bentoNewsItems[5].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px]">{(getDisplayDate(bentoNewsItems[5].originalDate) || formatBentoDate(bentoNewsItems[5].publishedAt))}</span>}
                      </a>
                    </BentoInner><span className="absolute top-4 right-4 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[5].publishedAt)}</span>
                  </div>
                )}
              </div>

            </div>

            {/* ROW 4 & 5: Horizontal, Vertical, Bars, Square (Indices 6 to 12) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 animate-fade-in">

              {/* Left Top: Horizontal (Index 6) */}
              {bentoNewsItems[6] && (
                <div 
                  onClick={() => handleCardClick(6)}
                  className={`md:col-span-4 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[6], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[6].items && bentoNewsItems[6].items.length > 0 ? bentoNewsItems[6].items : [bentoNewsItems[6]]}
                      activeIndex={bentoNewsItems[6].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[6]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[6].publishedAt)}</span>
                          <h3 className="font-serif text-lg md:text-xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200 mt-2">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[6]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[6].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[6]).sourceStyle}>
                    <span>{bentoNewsItems[6].source}</span>
                    {(getDisplayDate(bentoNewsItems[6].originalDate) || formatBentoDate(bentoNewsItems[6].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[6].originalDate) || formatBentoDate(bentoNewsItems[6].publishedAt))}</span>}
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
                  onClick={() => handleCardClick(12)}
                  ref={bar1SiblingLocks.idx12.ref}
                  className={`md:col-span-2 md:row-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`}
                 style={{ ...getCardTheme(bentoNewsItems[12], 'transparent').cardStyle, ...bar1SiblingLocks.idx12.lockStyle }} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[12].items && bentoNewsItems[12].items.length > 0 ? bentoNewsItems[12].items : [bentoNewsItems[12]]}
                      activeIndex={bentoNewsItems[12].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[12]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[12].publishedAt)}</span>
                          <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-4" style={getCardTheme(bentoNewsItems[12]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[12].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[12]).sourceStyle}>
                    <span>{bentoNewsItems[12].source}</span>
                    {(getDisplayDate(bentoNewsItems[12].originalDate) || formatBentoDate(bentoNewsItems[12].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[12].originalDate) || formatBentoDate(bentoNewsItems[12].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[12].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[12].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              <div className="md:col-span-2 relative flex flex-col justify-between gap-2 h-full">
                <div className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 -translate-x-full items-center justify-center pointer-events-none select-none">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold [writing-mode:vertical-lr] rotate-180 whitespace-nowrap">
                    PROGRAM-PROGRAM BERMANFAAT
                  </span>
                </div>
                {[7, 8, 9, 10].map((idx) => {
                  const barItem = bentoNewsItems[idx];
                  if (!barItem) return null;
                  const isExpanded = expandedBarCluster1 === idx;
                  return (
                    <div key={idx}>
                      <BarCard
                        item={barItem}
                        onClick={() => {
                          if (isEditMode) {
                            handleCardClick(idx);
                          } else {
                            setExpandedBarCluster1((prev) => (prev === idx ? null : idx));
                          }
                        }}
                        isEditMode={isEditMode}
                        onEditClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(idx);
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
                  onClick={() => handleCardClick(11)}
                  ref={bar1SiblingLocks.idx11.ref}
                  className={`md:col-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`}
                 style={{ ...getCardTheme(bentoNewsItems[11], 'transparent').cardStyle, ...bar1SiblingLocks.idx11.lockStyle }} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[11]).deskStyle}>{bentoNewsItems[11].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[11].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[11].items && bentoNewsItems[11].items.length > 0 ? bentoNewsItems[11].items : [bentoNewsItems[11]]}
                      activeIndex={bentoNewsItems[11].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-base md:text-lg leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[11]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[11].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[11]).sourceStyle}>
                      <span>{bentoNewsItems[11].source}</span>
                      {(getDisplayDate(bentoNewsItems[11].originalDate) || formatBentoDate(bentoNewsItems[11].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[11].originalDate) || formatBentoDate(bentoNewsItems[11].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[11].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[11].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 6: Two Half Horizontals Side-By-Side (Indices 13 & 14) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {bentoNewsItems[13] && (
                <div 
                  onClick={() => handleCardClick(13)}
                  className={`col-span-1 md:col-span-3 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[13], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[13]).deskStyle}>{bentoNewsItems[13].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[13].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[13].items && bentoNewsItems[13].items.length > 0 ? bentoNewsItems[13].items : [bentoNewsItems[13]]}
                      activeIndex={bentoNewsItems[13].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-lg md:text-xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[13]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[13].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[13]).sourceStyle}>
                      <span>{bentoNewsItems[13].source}</span>
                      {(getDisplayDate(bentoNewsItems[13].originalDate) || formatBentoDate(bentoNewsItems[13].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[13].originalDate) || formatBentoDate(bentoNewsItems[13].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[13].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[13].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {bentoNewsItems[14] && (
                <div 
                  onClick={() => handleCardClick(14)}
                  className={`col-span-1 md:col-span-3 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden group ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[14], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold" style={getCardTheme(bentoNewsItems[14]).deskStyle}>{bentoNewsItems[14].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[14].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[14].items && bentoNewsItems[14].items.length > 0 ? bentoNewsItems[14].items : [bentoNewsItems[14]]}
                      activeIndex={bentoNewsItems[14].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-lg md:text-xl leading-snug font-medium group-hover:text-[#802334] hover:text-[#802334] transition-colors duration-200">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[14]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[14].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[14]).sourceStyle}>
                      <span>{bentoNewsItems[14].source}</span>
                      {(getDisplayDate(bentoNewsItems[14].originalDate) || formatBentoDate(bentoNewsItems[14].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[14].originalDate) || formatBentoDate(bentoNewsItems[14].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[14].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[14].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}
            </div>

            {/* ROW 7 & 8: Vertical, Square, Stacked Compacts, Horizontal (Indices 15 to 19) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Column: Vertical (Index 15) */}
              {bentoNewsItems[15] && (
                <div 
                  onClick={() => handleCardClick(15)}
                  className={`md:col-span-2 md:row-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[15], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[15].items && bentoNewsItems[15].items.length > 0 ? bentoNewsItems[15].items : [bentoNewsItems[15]]}
                      activeIndex={bentoNewsItems[15].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[15]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[15].publishedAt)}</span>
                          <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-4" style={getCardTheme(bentoNewsItems[15]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[15].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[15]).sourceStyle}>
                    <span>{bentoNewsItems[15].source}</span>
                    {(getDisplayDate(bentoNewsItems[15].originalDate) || formatBentoDate(bentoNewsItems[15].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[15].originalDate) || formatBentoDate(bentoNewsItems[15].publishedAt))}</span>}
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
                  onClick={() => handleCardClick(16)}
                  className={`md:col-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[16], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[16]).deskStyle}>{bentoNewsItems[16].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[16].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[16].items && bentoNewsItems[16].items.length > 0 ? bentoNewsItems[16].items : [bentoNewsItems[16]]}
                      activeIndex={bentoNewsItems[16].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[16]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[16].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[16]).sourceStyle}>
                      <span>{bentoNewsItems[16].source}</span>
                      {(getDisplayDate(bentoNewsItems[16].originalDate) || formatBentoDate(bentoNewsItems[16].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[16].originalDate) || formatBentoDate(bentoNewsItems[16].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[16].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[16].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Two Stacked Compacts (Indices 17 & 18) */}
              <div className="md:col-span-2 flex flex-col gap-4 h-full">
                {bentoNewsItems[17] && (
                <div 
                  onClick={() => handleCardClick(17)}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col min-h-[120px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[17], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[17]).deskStyle}>{bentoNewsItems[17].desk}</div><span className="absolute top-4 right-4 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[17].publishedAt)}</span>
                      <CarouselStableBlock
                        items={bentoNewsItems[17].items && bentoNewsItems[17].items.length > 0 ? bentoNewsItems[17].items : [bentoNewsItems[17]]}
                        activeIndex={bentoNewsItems[17].carouselIndex || 0}
                        renderItem={(it) => (
                          <>
                              <h3 className="font-serif text-xs md:text-sm font-medium leading-snug hover:text-stone-300 transition-colors ">{safeParseInline(it.title)}</h3>
                              <p className="font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[17]).briefStyle}>{safeParseInline(it.brief)}</p>
                            </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[17].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[17]).sourceStyle}>
                      <span>{bentoNewsItems[17].source}</span>
                      {(getDisplayDate(bentoNewsItems[17].originalDate) || formatBentoDate(bentoNewsItems[17].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px]">{(getDisplayDate(bentoNewsItems[17].originalDate) || formatBentoDate(bentoNewsItems[17].publishedAt))}</span>}
                    </a>
                  
                  {bentoNewsItems[17].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[17].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
                {bentoNewsItems[18] && (
                <div 
                  onClick={() => handleCardClick(18)}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col min-h-[120px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[18], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[18]).deskStyle}>{bentoNewsItems[18].desk}</div><span className="absolute top-4 right-4 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[18].publishedAt)}</span>
                      <CarouselStableBlock
                        items={bentoNewsItems[18].items && bentoNewsItems[18].items.length > 0 ? bentoNewsItems[18].items : [bentoNewsItems[18]]}
                        activeIndex={bentoNewsItems[18].carouselIndex || 0}
                        renderItem={(it) => (
                          <>
                              <h3 className="font-serif text-xs md:text-sm font-medium leading-snug hover:text-stone-300 transition-colors ">{safeParseInline(it.title)}</h3>
                              <p className="font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[18]).briefStyle}>{safeParseInline(it.brief)}</p>
                            </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[18].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[18]).sourceStyle}>
                      <span>{bentoNewsItems[18].source}</span>
                      {(getDisplayDate(bentoNewsItems[18].originalDate) || formatBentoDate(bentoNewsItems[18].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px]">{(getDisplayDate(bentoNewsItems[18].originalDate) || formatBentoDate(bentoNewsItems[18].publishedAt))}</span>}
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
                  onClick={() => handleCardClick(19)}
                  className={`md:col-span-4 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[19], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[19].items && bentoNewsItems[19].items.length > 0 ? bentoNewsItems[19].items : [bentoNewsItems[19]]}
                      activeIndex={bentoNewsItems[19].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[19]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[19].publishedAt)}</span>
                          <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors mt-2">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[19]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[19].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[19]).sourceStyle}>
                    <span>{bentoNewsItems[19].source}</span>
                    {(getDisplayDate(bentoNewsItems[19].originalDate) || formatBentoDate(bentoNewsItems[19].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[19].originalDate) || formatBentoDate(bentoNewsItems[19].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[19].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[19].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 9 & 10: Horizontal, 4 Stacked Bars, Square, Vertical (Indices 20 to 26) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Column: Vertical (Index 26) */}
              {bentoNewsItems[26] && (
                <div
                  onClick={() => handleCardClick(26)}
                  ref={bar2SiblingLocks.idx26.ref}
                  className={`md:col-span-2 md:row-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`}
                 style={{ ...getCardTheme(bentoNewsItems[26], 'transparent').cardStyle, ...bar2SiblingLocks.idx26.lockStyle }} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[26].items && bentoNewsItems[26].items.length > 0 ? bentoNewsItems[26].items : [bentoNewsItems[26]]}
                      activeIndex={bentoNewsItems[26].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[26]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[26].publishedAt)}</span>
                          <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-4" style={getCardTheme(bentoNewsItems[26]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[26].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[26]).sourceStyle}>
                    <span>{bentoNewsItems[26].source}</span>
                    {(getDisplayDate(bentoNewsItems[26].originalDate) || formatBentoDate(bentoNewsItems[26].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[26].originalDate) || formatBentoDate(bentoNewsItems[26].publishedAt))}</span>}
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
                  onClick={() => handleCardClick(20)}
                  className={`md:col-span-4 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[20], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[20].items && bentoNewsItems[20].items.length > 0 ? bentoNewsItems[20].items : [bentoNewsItems[20]]}
                      activeIndex={bentoNewsItems[20].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[20]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[20].publishedAt)}</span>
                          <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors mt-2">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[20]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[20].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[20]).sourceStyle}>
                    <span>{bentoNewsItems[20].source}</span>
                    {(getDisplayDate(bentoNewsItems[20].originalDate) || formatBentoDate(bentoNewsItems[20].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[20].originalDate) || formatBentoDate(bentoNewsItems[20].publishedAt))}</span>}
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
                  onClick={() => handleCardClick(25)}
                  ref={bar2SiblingLocks.idx25.ref}
                  className={`md:col-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`}
                 style={{ ...getCardTheme(bentoNewsItems[25], 'transparent').cardStyle, ...bar2SiblingLocks.idx25.lockStyle }} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[25]).deskStyle}>{bentoNewsItems[25].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[25].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[25].items && bentoNewsItems[25].items.length > 0 ? bentoNewsItems[25].items : [bentoNewsItems[25]]}
                      activeIndex={bentoNewsItems[25].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[25]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[25].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[25]).sourceStyle}>
                      <span>{bentoNewsItems[25].source}</span>
                      {(getDisplayDate(bentoNewsItems[25].originalDate) || formatBentoDate(bentoNewsItems[25].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[25].originalDate) || formatBentoDate(bentoNewsItems[25].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[25].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[25].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              <div className="md:col-span-2 relative flex flex-col justify-between gap-2 h-full">
                <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 translate-x-full items-center justify-center pointer-events-none select-none">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold [writing-mode:vertical-lr] rotate-0 whitespace-nowrap">
                    PROGRAM-PROGRAM BERMANFAAT
                  </span>
                </div>
                {[21, 22, 23, 24].map((idx) => {
                  const barItem = bentoNewsItems[idx];
                  if (!barItem) return null;
                  const isExpanded = expandedBarCluster2 === idx;
                  return (
                    <div key={idx}>
                      <BarCard
                        item={barItem}
                        onClick={() => {
                          if (isEditMode) {
                            handleCardClick(idx);
                          } else {
                            setExpandedBarCluster2((prev) => (prev === idx ? null : idx));
                          }
                        }}
                        isEditMode={isEditMode}
                        onEditClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(idx);
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
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {bentoNewsItems[27] && (
                <div 
                  onClick={() => handleCardClick(27)}
                  className={`col-span-1 md:col-span-3 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[27], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[27]).deskStyle}>{bentoNewsItems[27].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[27].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[27].items && bentoNewsItems[27].items.length > 0 ? bentoNewsItems[27].items : [bentoNewsItems[27]]}
                      activeIndex={bentoNewsItems[27].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors ">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[27]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[27].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[27]).sourceStyle}>
                      <span>{bentoNewsItems[27].source}</span>
                      {(getDisplayDate(bentoNewsItems[27].originalDate) || formatBentoDate(bentoNewsItems[27].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[27].originalDate) || formatBentoDate(bentoNewsItems[27].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[27].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[27].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {bentoNewsItems[28] && (
                <div 
                  onClick={() => handleCardClick(28)}
                  className={`col-span-1 md:col-span-3 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[28], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold" style={getCardTheme(bentoNewsItems[28]).deskStyle}>{bentoNewsItems[28].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[28].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[28].items && bentoNewsItems[28].items.length > 0 ? bentoNewsItems[28].items : [bentoNewsItems[28]]}
                      activeIndex={bentoNewsItems[28].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[28]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[28].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[28]).sourceStyle}>
                      <span>{bentoNewsItems[28].source}</span>
                      {(getDisplayDate(bentoNewsItems[28].originalDate) || formatBentoDate(bentoNewsItems[28].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[28].originalDate) || formatBentoDate(bentoNewsItems[28].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[28].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[28].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}
            </div>

            {/* ROW 12 & 13: Vertical, Square, Stacked Compacts, Horizontal (Indices 29 to 33) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Column: Vertical (Index 29) */}
              {bentoNewsItems[29] && (
                <div 
                  onClick={() => handleCardClick(29)}
                  className={`md:col-span-2 md:row-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[29], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[29].items && bentoNewsItems[29].items.length > 0 ? bentoNewsItems[29].items : [bentoNewsItems[29]]}
                      activeIndex={bentoNewsItems[29].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[29]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[29].publishedAt)}</span>
                          <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-4" style={getCardTheme(bentoNewsItems[29]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[29].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[29]).sourceStyle}>
                    <span>{bentoNewsItems[29].source}</span>
                    {(getDisplayDate(bentoNewsItems[29].originalDate) || formatBentoDate(bentoNewsItems[29].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[29].originalDate) || formatBentoDate(bentoNewsItems[29].publishedAt))}</span>}
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
                  onClick={() => handleCardClick(30)}
                  className={`md:col-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[30], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[30]).deskStyle}>{bentoNewsItems[30].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[30].publishedAt)}</span>
                    <CarouselStableBlock
                      items={bentoNewsItems[30].items && bentoNewsItems[30].items.length > 0 ? bentoNewsItems[30].items : [bentoNewsItems[30]]}
                      activeIndex={bentoNewsItems[30].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[30]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                    <a href={bentoNewsItems[30].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[30]).sourceStyle}>
                      <span>{bentoNewsItems[30].source}</span>
                      {(getDisplayDate(bentoNewsItems[30].originalDate) || formatBentoDate(bentoNewsItems[30].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[30].originalDate) || formatBentoDate(bentoNewsItems[30].publishedAt))}</span>}
                    </a>

                
                  {bentoNewsItems[30].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[30].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Two Stacked Compacts (Indices 31 & 32) */}
              <div className="md:col-span-2 flex flex-col gap-4 h-full">
                {bentoNewsItems[31] && (
                <div 
                  onClick={() => handleCardClick(31)}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col min-h-[120px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[31], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[31]).deskStyle}>{bentoNewsItems[31].desk}</div><span className="absolute top-4 right-4 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[31].publishedAt)}</span>
                      <CarouselStableBlock
                        items={bentoNewsItems[31].items && bentoNewsItems[31].items.length > 0 ? bentoNewsItems[31].items : [bentoNewsItems[31]]}
                        activeIndex={bentoNewsItems[31].carouselIndex || 0}
                        renderItem={(it) => (
                          <>
                              <h3 className="font-serif text-xs md:text-sm font-medium leading-snug hover:text-stone-300 transition-colors ">{safeParseInline(it.title)}</h3>
                              <p className="font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[31]).briefStyle}>{safeParseInline(it.brief)}</p>
                            </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[31].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[31]).sourceStyle}>
                      <span>{bentoNewsItems[31].source}</span>
                      {(getDisplayDate(bentoNewsItems[31].originalDate) || formatBentoDate(bentoNewsItems[31].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px]">{(getDisplayDate(bentoNewsItems[31].originalDate) || formatBentoDate(bentoNewsItems[31].publishedAt))}</span>}
                    </a>
                  
                  {bentoNewsItems[31].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[31].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
                {bentoNewsItems[32] && (
                <div 
                  onClick={() => handleCardClick(32)}
                  className={`p-4 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col min-h-[120px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[32], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[32]).deskStyle}>{bentoNewsItems[32].desk}</div><span className="absolute top-4 right-4 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[32].publishedAt)}</span>
                      <CarouselStableBlock
                        items={bentoNewsItems[32].items && bentoNewsItems[32].items.length > 0 ? bentoNewsItems[32].items : [bentoNewsItems[32]]}
                        activeIndex={bentoNewsItems[32].carouselIndex || 0}
                        renderItem={(it) => (
                          <>
                              <h3 className="font-serif text-xs md:text-sm font-medium leading-snug hover:text-stone-300 transition-colors ">{safeParseInline(it.title)}</h3>
                              <p className="font-serif text-xs leading-relaxed font-normal mt-1" style={getCardTheme(bentoNewsItems[32]).briefStyle}>{safeParseInline(it.brief)}</p>
                            </>
                        )}
                      />
                    </div>
                    <a href={bentoNewsItems[32].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[32]).sourceStyle}>
                      <span>{bentoNewsItems[32].source}</span>
                      {(getDisplayDate(bentoNewsItems[32].originalDate) || formatBentoDate(bentoNewsItems[32].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[7px]">{(getDisplayDate(bentoNewsItems[32].originalDate) || formatBentoDate(bentoNewsItems[32].publishedAt))}</span>}
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
                  onClick={() => handleCardClick(33)}
                  className={`md:col-span-4 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[33], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[33].items && bentoNewsItems[33].items.length > 0 ? bentoNewsItems[33].items : [bentoNewsItems[33]]}
                      activeIndex={bentoNewsItems[33].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[33]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[33].publishedAt)}</span>
                          <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors mt-2">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[33]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[33].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[33]).sourceStyle}>
                    <span>{bentoNewsItems[33].source}</span>
                    {(getDisplayDate(bentoNewsItems[33].originalDate) || formatBentoDate(bentoNewsItems[33].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[33].originalDate) || formatBentoDate(bentoNewsItems[33].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[33].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[33].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 14 & 15: Horizontal, Two Half-Horizontals, Vertical (Indices 34 to 37) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Top: Horizontal spanning across Col 1-4 (Index 34) */}
              {bentoNewsItems[34] && (
                <div 
                  onClick={() => handleCardClick(34)}
                  className={`md:col-span-4 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[34], 'transparent').cardStyle} >
                  <div className="flex-1">
                    <CarouselStableBlock
                      items={bentoNewsItems[34].items && bentoNewsItems[34].items.length > 0 ? bentoNewsItems[34].items : [bentoNewsItems[34]]}
                      activeIndex={bentoNewsItems[34].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[34]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[34].publishedAt)}</span>
                          <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors mt-2">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[34]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[34].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[34]).sourceStyle}>
                    <span>{bentoNewsItems[34].source}</span>
                    {(getDisplayDate(bentoNewsItems[34].originalDate) || formatBentoDate(bentoNewsItems[34].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[34].originalDate) || formatBentoDate(bentoNewsItems[34].publishedAt))}</span>}
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
                  onClick={() => handleCardClick(37)}
                  className={`md:col-span-2 md:row-span-2 p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[37], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <CarouselStableBlock
                      items={bentoNewsItems[37].items && bentoNewsItems[37].items.length > 0 ? bentoNewsItems[37].items : [bentoNewsItems[37]]}
                      activeIndex={bentoNewsItems[37].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[37]).deskStyle}>{it.desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[37].publishedAt)}</span>
                          <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-normal mt-4" style={getCardTheme(bentoNewsItems[37]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                  <a href={bentoNewsItems[37].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[37]).sourceStyle}>
                    <span>{bentoNewsItems[37].source}</span>
                    {(getDisplayDate(bentoNewsItems[37].originalDate) || formatBentoDate(bentoNewsItems[37].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[37].originalDate) || formatBentoDate(bentoNewsItems[37].publishedAt))}</span>}
                  </a>
                
                  {bentoNewsItems[37].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[37].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Left Bottom: Two Side-by-Side elements in Col 1-4 */}
              <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {bentoNewsItems[35] && (
                <div 
                  onClick={() => handleCardClick(35)}
                  className={`p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[35], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[35]).deskStyle}>{bentoNewsItems[35].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[35].publishedAt)}</span>
                      <CarouselStableBlock
                      items={bentoNewsItems[35].items && bentoNewsItems[35].items.length > 0 ? bentoNewsItems[35].items : [bentoNewsItems[35]]}
                      activeIndex={bentoNewsItems[35].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[35]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                      <a href={bentoNewsItems[35].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[35]).sourceStyle}>
                        <span>{bentoNewsItems[35].source}</span>
                        {(getDisplayDate(bentoNewsItems[35].originalDate) || formatBentoDate(bentoNewsItems[35].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[35].originalDate) || formatBentoDate(bentoNewsItems[35].publishedAt))}</span>}
                      </a>

                  
                  {bentoNewsItems[35].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[35].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}

                {bentoNewsItems[36] && (
                <div 
                  onClick={() => handleCardClick(36)}
                  className={`p-6 relative rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col gap-3 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[36], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[36]).deskStyle}>{bentoNewsItems[36].desk}</div><span className="absolute top-6 right-6 font-mono text-[8px] text-stone-400 opacity-80 pointer-events-none select-none">{formatSiaranDate(bentoNewsItems[36].publishedAt)}</span>
                      <CarouselStableBlock
                      items={bentoNewsItems[36].items && bentoNewsItems[36].items.length > 0 ? bentoNewsItems[36].items : [bentoNewsItems[36]]}
                      activeIndex={bentoNewsItems[36].carouselIndex || 0}
                      renderItem={(it) => (
                        <>
                          <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-stone-300 transition-colors ">{safeParseInline(it.title)}</h3>
                          <p className="font-serif text-xs text-stone-300/90 leading-relaxed font-normal mt-2" style={getCardTheme(bentoNewsItems[36]).briefStyle}>{safeParseInline(it.brief)}</p>
                        </>
                      )}
                    />
                  </div>
                      <a href={bentoNewsItems[36].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10 flex flex-col gap-0.5 mt-auto" style={getCardTheme(bentoNewsItems[36]).sourceStyle}>
                        <span>{bentoNewsItems[36].source}</span>
                        {(getDisplayDate(bentoNewsItems[36].originalDate) || formatBentoDate(bentoNewsItems[36].publishedAt)) && <span className="opacity-60 normal-case font-mono text-[8px]">{(getDisplayDate(bentoNewsItems[36].originalDate) || formatBentoDate(bentoNewsItems[36].publishedAt))}</span>}
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
        {/* Footer Reka Bentuk Premium */}
        <footer className="w-full mt-12 pt-10 pb-6 border-t border-stone-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 px-4">
            {/* Logo / Kiri */}
            <div className="flex flex-col justify-start">
              <h2 className="font-serif text-3xl font-normal text-[#802334] tracking-tight">Adjung</h2>
            </div>
            
            {/* Kolum INSTITUSI */}
            <div className="flex flex-col gap-2.5">
              <h3 className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">Institusi</h3>
              <ul className="flex flex-col gap-1.5 font-sans text-xs text-stone-600 font-semibold flex-start">
                <li className="flex"><button onClick={() => handleFooterLinkClick('editors-notes')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Catatan Editor</button></li>
                <li className="flex"><button onClick={() => handleFooterLinkClick('notices')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Pengumuman</button></li>
                <li className="flex"><button onClick={() => handleFooterLinkClick('publishing-policies')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Dasar Penerbitan</button></li>
                <li className="flex"><button onClick={() => handleFooterLinkClick('version-history')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Sejarah Versi</button></li>
              </ul>
            </div>

            {/* Kolum ADJUNG */}
            <div className="flex flex-col gap-2.5">
              <h3 className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">Adjung</h3>
              <ul className="flex flex-col gap-1.5 font-sans text-xs text-stone-600 font-semibold flex-start">
                <li className="flex"><button onClick={() => handleFooterLinkClick('about')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Mengenai Adjung</button></li>
                <li className="flex"><button onClick={() => handleFooterLinkClick('editorial-board')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Lembaga Editorial</button></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-stone-150 pt-6 text-center">
            <p className="font-mono text-[9px] tracking-widest text-stone-400 uppercase font-bold">
              {BRAND.copyright}
            </p>
          </div>
        </footer>

      </div>

      {/* Pop-up Modal Penyuntingan Ticker (Zero-Lag Isolated Component) */}
      <TickerManagementModal
        isOpen={editingSlotIndex === -1}
        onClose={() => {
          setEditingSlotIndex(null);
          setFormConfig(null);
          setShowResetMenu(false);
        }}
        formConfig={formConfig}
        setFormConfig={setFormConfig}
        slotsConfig={slotsConfig}
        handleSaveSlot={handleSaveSlot}
        registeredRssSources={registeredRssSources}
        loadRssSources={loadRssSources}
        reviewQueue={reviewQueue}
        loadReviewQueue={loadReviewQueue}
        rssStatus={rssStatus}
        adjungDesks={adjungDesks}
        addToast={addToast}
        validateContentBudget={validateContentBudget}
        handleOverrideTickerDesk={handleOverrideTickerDesk}
      />

      {/* Pop-up Modal Penyuntingan Slot Bento */}
      {editingSlotIndex !== null && editingSlotIndex !== -1 && formConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-lg border border-stone-200 max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-fade-in">
            <header className="px-6 py-4 border-b border-stone-150 flex justify-between items-center bg-stone-50">
              <div>
                <h3 className="font-serif text-xs md:text-sm font-bold text-[#802334] uppercase tracking-wide">
                  {`Urus Slot ${editingSlotIndex + 1}: ${formConfig.manualDesk || 'Umum'}`}
                </h3>
                <p className="text-[9px] text-stone-500 font-sans mt-0.5 font-bold uppercase tracking-wider">
                  Ubah kandungan manual, warna, atau mod penjanaan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingSlotIndex(null);
                  setFormConfig(null);
                  setShowResetMenu(false);
                }}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </header>
            
            {/* Slot Summary & Compliance Bar with Live Mode Indicator & Numbered Chips */}
            {(() => {
              const liveSlotConfig = slotsConfig.find((s) => s.slotIndex === editingSlotIndex);
              const liveMode = liveSlotConfig ? (liveSlotConfig.contentMode || 'Manual') : 'Manual';

              const manualBlocks = (formConfig.manualSummary || '')
                .split(/(?:\r?\n){2,}(?=UUID:|Tajuk:|Event:)|____+|----+|====+|___+/i)
                .filter((b: string) => b.trim().length > 0);
              const activeCount = formConfig.contentMode === 'Manual' ? Math.max(1, manualBlocks.length) : (formConfig.generationLimit || 1);
              
              const blockStatusList: { index: number; isValid: boolean; reason?: string; titleSnippet: string }[] = [];
              let passedCount = 0;
              let failedCount = 0;

              if (formConfig.contentMode === 'Manual' && manualBlocks.length > 0) {
                manualBlocks.forEach((block: string, bIdx: number) => {
                  const titleMatch = block.match(/Tajuk:\s*(?:\([^)]*\))?\s*([^\n]+)/i);
                  const briefMatch = block.match(/Huraian ringkas:\s*(?:\([^)]*\))?\s*([^\n]+)/i);
                  const title = titleMatch ? titleMatch[1].trim() : '';
                  const brief = briefMatch ? briefMatch[1].trim() : '';
                  
                  const check = (title || brief) 
                    ? validateContentBudget(editingSlotIndex, title, brief) 
                    : { isValid: true };
                  
                  if (check.isValid) {
                    passedCount++;
                  } else {
                    failedCount++;
                  }

                  blockStatusList.push({
                    index: bIdx + 1,
                    isValid: check.isValid,
                    reason: check.reason,
                    titleSnippet: title ? (title.length > 25 ? title.substring(0, 25) + '...' : title) : `Artikel #${bIdx + 1}`
                  });
                });
              }

              const scrollToBlockInTextarea = (blockIndex: number) => {
                if (editingSlotIndex === -1) {
                  const textarea = document.getElementById('manualSummaryTextarea') as HTMLTextAreaElement;
                  if (textarea) textarea.focus();
                  return;
                }
                const cardElem = document.getElementById(`manual-block-card-${blockIndex}`);
                const textareaElem = document.getElementById(`manual-block-textarea-${blockIndex}`) as HTMLTextAreaElement;
                if (cardElem) {
                  cardElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                if (textareaElem) {
                  textareaElem.focus();
                }
              };

              return (
                <div className="px-6 pt-4 space-y-3">
                  {/* Live Status & Form Status Header - Adjung Design System */}
                  <div className="bg-[#F9F8F6] p-3 rounded border border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-extrabold mr-0.5">
                        MOD LIVE:
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase tracking-widest bg-[#802334] text-white border border-[#601824]">
                        {(liveMode || 'Manual').toUpperCase()}
                      </span>

                      <span className="text-stone-300 mx-1">•</span>

                      <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-extrabold">
                        BORANG:
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest bg-stone-100 text-stone-700 border border-stone-300">
                        {(formConfig.contentMode || 'Manual').toUpperCase()}
                      </span>

                      <span className="font-mono text-[9px] text-stone-700 font-bold px-2 py-0.5 bg-white rounded border border-stone-250 uppercase tracking-wider">
                        {activeCount} ITEM KANDUNGAN
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {failedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#802334]/10 text-[#802334] border border-[#802334]/30 uppercase tracking-wider animate-pulse">
                          <AlertTriangle className="w-3 h-3" /> {failedCount} GAGAL HAD AKSARA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-stone-100 text-stone-800 border border-stone-300 uppercase tracking-wider">
                          <Check className="w-3 h-3" /> 100% MEMATUHI HAD
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Interactive Numbered Content Chips - Adjung Design System */}
                  {formConfig.contentMode === 'Manual' && blockStatusList.length > 0 && (
                    <div className="bg-[#F9F8F6] p-3 rounded border border-stone-200 space-y-2 select-none">
                      <div className="flex justify-between items-center text-[9px] font-mono font-extrabold uppercase text-stone-500 tracking-widest">
                        <span>PILIH MUKA KANDUNGAN (KLIK NOMBOR UNTUK SUNTING):</span>
                        <span>{passedCount}/{blockStatusList.length} LULUS</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {blockStatusList.map((item) => (
                          <Tooltip key={item.index} text={item.reason || `${item.titleSnippet} - Mematuhi Had Aksara`}>
                            <button
                              type="button"
                              onClick={() => scrollToBlockInTextarea(item.index)}
                              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                                item.isValid
                                  ? 'bg-white hover:bg-stone-100 text-stone-800 border-stone-300 hover:border-[#802334]/50'
                                  : 'bg-[#802334]/10 hover:bg-[#802334]/20 text-[#802334] border-[#802334]/40 animate-pulse'
                              }`}
                            >
                              <span className="font-extrabold">#{item.index}</span>
                              <span>{item.isValid ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}</span>
                              <span className="font-sans text-[9px] font-medium truncate max-w-[120px]">{item.titleSnippet}</span>
                            </button>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <form onSubmit={handleSaveSlot} className="p-6 pt-3 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                
                {/* Mod Kandungan */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Mod Kandungan</label>
                  <select
                    value={formConfig.contentMode}
                    onChange={(e) => setFormConfig({ ...formConfig, contentMode: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                  >
                    <option value="Manual">Manual (Kemasukan Sendiri)</option>
                    <option value="AI Generated">AI Generated (Automatik)</option>
                  </select>
                </div>

                {/* MODUS RSS DIRECT */}
                {formConfig.contentMode === 'RSS Direct' && (
                  <div className="col-span-2 space-y-4 pt-2 border-t border-stone-200">
                    <div className="bg-[#F9F8F6] p-4 rounded border border-stone-200 space-y-3">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                          <h4 className="font-mono text-xs font-bold uppercase text-[#802334] tracking-wider">
                            ENJIN PENYERAPAN RSS DIRECT (TANPA API AI)
                          </h4>
                          <p className="font-sans text-[10px] text-stone-500 mt-0.5">
                            Menyerap terus berita RSS/Atom Feed, menapis bahasa ms-MY, dan mengira skor wajaran editorial.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleFetchDirectRss}
                          disabled={isFetchingRss}
                          className="px-4 py-2 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                        >
                          {isFetchingRss ? 'Menyerap RSS...' : <><Zap className="w-3.5 h-3.5" /> Serap RSS Sekarang</>}
                        </button>
                      </div>

                      {/* Display Status 5-Item */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 text-center select-none font-mono">
                        <div className="bg-white p-2.5 rounded border border-stone-200">
                          <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Sumber Aktif</div>
                          <div className="text-sm font-bold text-stone-800">{registeredRssSources.filter(s => s.enabled).length || 1}</div>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-stone-200">
                          <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Item Ditemui</div>
                          <div className="text-sm font-bold text-stone-800">{rssStatus.totalFetchedCount || 0}</div>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-stone-200">
                          <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Auto Live</div>
                          <div className="text-sm font-bold text-emerald-700">{rssStatus.autoLiveCount || 0}</div>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-stone-200">
                          <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Menunggu Review</div>
                          <div className="text-sm font-bold text-amber-700">{rssStatus.pendingReviewCount || reviewQueue.length}</div>
                        </div>
                      </div>
                    </div>

                    {/* Borang Tambah Pautan RSS Feed (RSS Source Registry Form) */}
                    <div className="bg-white p-4 rounded border border-stone-200 space-y-3">
                      <h5 className="font-mono text-xs font-bold uppercase text-[#802334] tracking-wider">
                        + DAFTAR PAUTAN RSS FEED BAHARU
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Nama Sumber (Agensi / Portal)</label>
                          <input
                            type="text"
                            placeholder="cth: Bernama / Utusan Malaysia"
                            value={newRssName}
                            onChange={(e) => setNewRssName(e.target.value)}
                            className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-sans text-xs"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pautan URL RSS / Atom Feed</label>
                          <input
                            type="url"
                            placeholder="https://www.bernama.com/bm/rss/news.php"
                            value={newRssUrl}
                            onChange={(e) => setNewRssUrl(e.target.value)}
                            className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-mono text-xs"
                          />
                        </div>

                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Trust Score (0 - 100)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={newRssTrust}
                            onChange={(e) => setNewRssTrust(Number(e.target.value))}
                            className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleAddRssSource}
                          className="px-4 py-2 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
                        >
                          + Simpan & Daftarkan Pautan RSS
                        </button>
                      </div>

                      {/* Senarai Sumber RSS Berdaftar */}
                      {registeredRssSources.length > 0 && (
                        <div className="pt-3 border-t border-stone-150 space-y-2">
                          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold block">
                            Senarai Sumber RSS Berdaftar ({registeredRssSources.length} Sumber):
                          </label>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {registeredRssSources.map((src) => (
                              <div key={src.id} className="p-2.5 bg-stone-50 rounded border border-stone-200 flex justify-between items-center text-xs font-mono gap-2">
                                <div className="min-w-0 flex-1 truncate">
                                  <span className="font-bold text-stone-800">{src.sourceName}</span>
                                  <span className="text-[10px] text-stone-500 ml-2">Trust: {src.trustScore}/100</span>
                                  <div className="text-[10px] text-stone-400 truncate">{src.rssUrl}</div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold uppercase">
                                    Aktif
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRssSource(src.id, src.sourceName)}
                                    className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded text-[9px] font-bold uppercase cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" /> Buang
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dynamic Editorial Settings Form */}
                      <div className="pt-3 border-t border-stone-200 space-y-3">
                        <h5 className="font-mono text-xs font-bold uppercase text-[#802334] tracking-wider flex items-center gap-1.5">
                          <Settings className="w-3.5 h-3.5" /> TETAPAN & PERATURAN EDITORIAL RSS (DINAMIK / TANPA HARDCODE)
                        </h5>
                        <p className="font-sans text-[11px] text-stone-500 leading-normal">
                          Laras ambang skor automatik, senarai kata kunci keutamaan, dan kata kunci yang disekat mengikut kriteria meja editorial anda.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-wider text-stone-600 font-bold">Ambang Skor Auto Live (Min. Skor)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={rssAutoLiveThreshold}
                              onChange={(e) => setRssAutoLiveThreshold(Number(e.target.value))}
                              className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334]"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-wider text-stone-600 font-bold">Ambang Skor Review Queue (Min. Skor)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={rssReviewThreshold}
                              onChange={(e) => setRssReviewThreshold(Number(e.target.value))}
                              className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334]"
                            />
                          </div>

                          <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">Had Usia Berita (Freshness Filter / Cutoff Usia)</label>
                            <select
                              value={rssMaxNewsAgeHours}
                              onChange={(e) => setRssMaxNewsAgeHours(Number(e.target.value))}
                              className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                            >
                              <option value={24}>24 Jam Terakhir (Berita Hari Ini)</option>
                              <option value={48}>48 Jam Terakhir (Disyorkan - 2 Hari)</option>
                              <option value={72}>72 Jam Terakhir (3 Hari)</option>
                              <option value={168}>7 Hari Terakhir (Seminggu)</option>
                              <option value={0}>Tiada Had (Semua Usia Berita)</option>
                            </select>
                            <span className="text-[9px] text-stone-400">Berita yang lebih lama daripada had ini akan ditapis secara automatik.</span>
                          </div>

                          <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-[9px] uppercase tracking-wider text-stone-600 font-bold">Kata Kunci Keutamaan (+Bonus Skor)</label>
                            <input
                              type="text"
                              placeholder="dasar, belanjawan, ekonomi, pendidikan, menteri, kerajaan"
                              value={rssPriorityKeywords}
                              onChange={(e) => setRssPriorityKeywords(e.target.value)}
                              className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334]"
                            />
                            <span className="text-[9px] text-stone-400">Pisahkan kata kunci dengan koma (cth: dasar, ekonomi, pendidikan).</span>
                          </div>

                          <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-[9px] uppercase tracking-wider text-stone-600 font-bold">Kata Kunci Diharamkan / Sensasi (-Penalti Skor)</label>
                            <input
                              type="text"
                              placeholder="gempar, viral, panas, terbongkar"
                              value={rssBlockedKeywords}
                              onChange={(e) => setRssBlockedKeywords(e.target.value)}
                              className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334]"
                            />
                            <span className="text-[9px] text-stone-400">Berita yang mengandungi kata kunci ini akan ditolak atau dipotong markah.</span>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleSaveRssEditorialSettings}
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-mono font-bold uppercase tracking-wider cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" /> Simpan Tetapan Editorial Dinamik
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Review Queue Table */}
                    <div className="bg-white p-4 rounded border border-stone-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <h5 className="font-mono text-xs font-bold uppercase text-stone-700 tracking-wider">
                          EDITOR REVIEW QUEUE (SKOR 60 - 89)
                        </h5>
                        <button
                          type="button"
                          onClick={loadReviewQueue}
                          className="text-[10px] font-mono uppercase text-[#802334] hover:underline cursor-pointer"
                        >
                          Muat Semula Queue
                        </button>
                      </div>

                      {reviewQueue.length > 0 ? (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                          {reviewQueue.map((item) => {
                            let bd: any = null;
                            try {
                              bd = typeof item.scoreBreakdown === 'string' ? JSON.parse(item.scoreBreakdown) : item.scoreBreakdown;
                            } catch (e) {
                              bd = null;
                            }
                            const isExpanded = openScoreAccordionId === item.id;

                            return (
                              <div key={item.id} className="p-3 bg-[#F9F8F6] rounded border border-stone-200 space-y-2">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                                        Skor {item.score}/100 ({item.decision || 'EDITOR_REVIEW'})
                                      </span>
                                      <span className="font-mono text-[9px] text-stone-500 font-bold uppercase">
                                        {item.source}
                                      </span>
                                      <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-stone-200">
                                        <span className="font-mono text-[9px] font-bold text-stone-500 uppercase">Desk:</span>
                                        <select
                                          value={item.category || 'SEMASA'}
                                          onChange={(e) => handleOverrideTickerDesk(item.id, e.target.value)}
                                          className="font-mono text-[9px] font-bold uppercase text-[#802334] bg-transparent focus:outline-none cursor-pointer"
                                        >
                                          {adjungDesks.map(d => (
                                            <option key={d.id} value={d.deskName}>{d.deskName}</option>
                                          ))}
                                          <option value="SEMASA">SEMASA</option>
                                          <option value="BELUM DIKELASKAN">BELUM DIKELASKAN</option>
                                        </select>
                                      </div>
                                      {item.publishedAt && (
                                        <span className="font-mono text-[9px] text-stone-400">
                                          • {new Date(item.publishedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                      )}
                                    </div>
                                    <h6 className="font-serif text-xs font-bold text-stone-900 leading-snug">
                                      {item.title}
                                    </h6>
                                    {item.formattedBrief && (
                                      <p className="font-sans text-[11px] text-stone-600 leading-relaxed bg-white p-2 rounded border border-stone-150">
                                        {item.formattedBrief}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <div className="flex items-center gap-1">
                                      <a
                                        href={item.originalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-1 text-[9px] font-mono uppercase bg-stone-100 hover:bg-stone-200 text-stone-700 rounded border border-stone-300"
                                      >
                                        Buka Pautan Asal
                                      </a>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          await fetch('/api/system/ticker/review-action', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ itemId: item.id, action: 'approve' })
                                          });
                                          addToast('success', 'Artikel diluluskan ke Ticker Live!');
                                          loadReviewQueue();
                                        }}
                                        className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer shadow-xs inline-flex items-center gap-1"
                                      >
                                        <Check className="w-3 h-3" /> Lulus
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          await fetch('/api/system/ticker/review-action', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ itemId: item.id, action: 'reject' })
                                          });
                                          addToast('info', 'Artikel ditolak.');
                                          loadReviewQueue();
                                        }}
                                        className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer shadow-xs inline-flex items-center gap-1"
                                      >
                                        <X className="w-3 h-3" /> Tolak
                                      </button>
                                    </div>

                                    {/* Toggle Score Accordion Button */}
                                    <button
                                      type="button"
                                      onClick={() => setOpenScoreAccordionId(isExpanded ? null : item.id)}
                                      className="text-[9px] font-mono uppercase text-[#802334] hover:underline cursor-pointer flex items-center gap-1 mt-1"
                                    >
                                      {isExpanded ? '▲ Sembunyi Pecahan Skor' : '▼ Lihat Pecahan Skor'}
                                    </button>
                                  </div>
                                </div>

                                {/* Accordion Breakdown Details */}
                                {isExpanded && bd && (
                                  <div className="pt-2 border-t border-stone-200 grid grid-cols-2 md:grid-cols-5 gap-1.5 font-mono text-[9px] bg-white p-2.5 rounded">
                                    <div>
                                      <span className="text-stone-400 block uppercase">Source Trust</span>
                                      <span className="font-bold text-stone-800">+{bd.sourceTrust || 80}</span>
                                    </div>
                                    <div>
                                      <span className="text-stone-400 block uppercase">Language Match</span>
                                      <span className="font-bold text-emerald-700">+{bd.languageMatch || 10}</span>
                                    </div>
                                    <div>
                                      <span className="text-stone-400 block uppercase">Category Match</span>
                                      <span className="font-bold text-emerald-700">+{bd.categoryMatch || 0}</span>
                                    </div>
                                    <div>
                                      <span className="text-stone-400 block uppercase">Keyword Impact</span>
                                      <span className={`font-bold ${bd.keywordImpact < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                        {bd.keywordImpact >= 0 ? `+${bd.keywordImpact}` : bd.keywordImpact}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-stone-400 block uppercase">Jumlah Skor</span>
                                      <span className="font-bold text-[#802334]">{bd.totalScore || item.score}/100</span>
                                    </div>
                                  </div>
                                )}

                                {/* Desk Classification Audit Breakdown */}
                                {isExpanded && item.deskBreakdown && (() => {
                                  let dbd: any = null;
                                  try {
                                    dbd = typeof item.deskBreakdown === 'string' ? JSON.parse(item.deskBreakdown) : item.deskBreakdown;
                                  } catch (e) {
                                    dbd = null;
                                  }
                                  if (!dbd) return null;
                                  return (
                                    <div className="pt-2 border-t border-stone-200 font-mono text-[9px] bg-stone-900 text-stone-200 p-2.5 rounded space-y-1">
                                      <div className="flex justify-between items-center text-amber-300 font-bold uppercase">
                                        <span className="inline-flex items-center gap-1"><Search className="w-3 h-3" /> EXPLAIN CLASSIFICATION TRACE</span>
                                        <span>Keyakinan: {dbd.confidence} | Margin: +{dbd.margin || 0}</span>
                                      </div>
                                      <p className="text-[#E9D8A6] text-[10px] leading-snug">{dbd.explanation || dbd.reason}</p>
                                      {dbd.resolver && dbd.resolver !== 'STANDARD_WEIGHTED_MATCH' && (
                                        <div className="text-emerald-400 font-bold inline-flex items-center gap-1">
                                          <Zap className="w-3 h-3" /> Resolusi Konflik Domain: {dbd.resolver}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-stone-400 font-sans text-xs">
                          Tiada artikel di dalam Review Queue.
                        </div>
                      )}
                    </div>

                    {/* ✍️ ADJUNG EDITORIAL TEXT RULES PANEL */}
                  <div className="col-span-2 mt-4 p-4 bg-stone-50 border border-stone-250 rounded-lg space-y-4">
                    <div className="flex justify-between items-center border-b border-stone-200 pb-3">
                      <div>
                        <h4 className="font-mono text-xs uppercase font-bold text-[#802334] tracking-wider flex items-center gap-2">
                          <PenLine className="w-3.5 h-3.5" /> Adjung Editorial Text Rules (Pembersihan Teks RSS)
                        </h4>
                        <p className="text-[10px] text-stone-500 font-sans mt-0.5">
                          Kawalan 100% di tangan Ketua Editor. Peraturan SUBSTITUTE, REGEXREPLACE, dan pembersihan dateline tanpa penulisan kod hardcoded.
                        </p>
                      </div>
                      <span className="px-2 py-0.5 bg-stone-200 text-stone-700 font-mono text-[9px] font-bold rounded">
                        {rssTextRules.length} Peraturan Berdaftar
                      </span>
                    </div>

                    {/* Senarai Peraturan Aktif Table */}
                    <div className="overflow-x-auto border border-stone-200 rounded bg-white">
                      <table className="w-full text-left font-sans text-xs">
                        <thead>
                          <tr className="bg-stone-100 border-b border-stone-200 text-[9px] font-mono uppercase text-stone-600 font-bold tracking-wider">
                            <th className="p-2 text-center">Aktif</th>
                            <th className="p-2">Nama Peraturan</th>
                            <th className="p-2">Skop</th>
                            <th className="p-2">Sumber</th>
                            <th className="p-2">Jenis Formula</th>
                            <th className="p-2">Carian (Pattern)</th>
                            <th className="p-2">Gantian</th>
                            <th className="p-2 text-center">Tindakan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rssTextRules.map((rule) => {
                            const isLocked = rule.locked === 1;
                            return (
                              <tr key={rule.id} className="border-b border-stone-150 hover:bg-stone-50 transition-colors">
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={rule.enabled === 1}
                                    onChange={() => handleToggleRule(rule.id, rule.enabled)}
                                    className="cursor-pointer accent-[#802334]"
                                  />
                                </td>
                                <td className="p-2 font-semibold text-stone-800 flex items-center gap-1.5">
                                  {rule.ruleName}
                                  {isLocked && (
                                    <Tooltip text="Peraturan Asas Sistem (Dikunci)">
                                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[8px] font-mono font-bold rounded inline-flex items-center gap-0.5">
                                        <Lock className="w-2.5 h-2.5" /> ASAS
                                      </span>
                                    </Tooltip>
                                  )}
                                </td>
                                <td className="p-2 font-mono text-[10px] uppercase">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    rule.scope === 'all' ? 'bg-purple-100 text-purple-800' : rule.scope === 'title' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                  }`}>
                                    {rule.scope || 'brief'}
                                  </span>
                                </td>
                                <td className="p-2 font-mono text-[10px] text-stone-600">
                                  {rule.sourceId ? rule.sourceId : 'Global'}
                                </td>
                                <td className="p-2 font-mono text-[10px] font-bold text-[#802334]">
                                  {rule.ruleType.toUpperCase()}
                                </td>
                                <Tooltip text={rule.pattern}>
                                  <td className="p-2 font-mono text-[10px] text-stone-600 max-w-[150px] truncate">
                                    {rule.pattern || '-'}
                                  </td>
                                </Tooltip>
                                <Tooltip text={rule.replacement}>
                                  <td className="p-2 font-mono text-[10px] text-stone-600 max-w-[150px] truncate">
                                    {rule.replacement !== undefined && rule.replacement !== '' ? `"${rule.replacement}"` : '(kosong)'}
                                  </td>
                                </Tooltip>
                                <td className="p-2 text-center">
                                  {!isLocked ? (
                                    <Tooltip text="Hapus Peraturan">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRssTextRule(rule.id, rule.ruleName)}
                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-stone-300 text-[10px] select-none">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Borang Tambah Peraturan Baharu */}
                    <div className="p-3 bg-white border border-stone-200 rounded space-y-3">
                      <h5 className="font-mono text-[10px] uppercase font-bold text-[#802334] tracking-wider">
                        + Tambah Peraturan Pembersihan Baharu
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                          <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Nama Peraturan</label>
                          <input
                            type="text"
                            value={newRuleName}
                            onChange={(e) => setNewRuleName(e.target.value)}
                            placeholder="cth: Buang perkataan gempar"
                            className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Jenis Formula</label>
                          <select
                            value={newRuleType}
                            onChange={(e) => setNewRuleType(e.target.value)}
                            className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold"
                          >
                            <option value="substitute">SUBSTITUTE (Ganti Teks Harfiah)</option>
                            <option value="regex">REGEXREPLACE (Ganti Dengan Regex)</option>
                            <option value="strip_dateline">STRIP_DATELINE (Buang Awalan Lokasi/Tarikh)</option>
                            <option value="decode_entities">DECODE_HTML (Nyahkod Entiti Nombor HTML)</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Skop (Scope)</label>
                          <select
                            value={newRuleScope}
                            onChange={(e) => setNewRuleScope(e.target.value)}
                            className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold"
                          >
                            <option value="brief">Brief / Description Sahaja (Disyorkan)</option>
                            <option value="title">Title Sahaja</option>
                            <option value="all">Semua (Title & Brief)</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Sumber RSS Specific</label>
                          <select
                            value={newRuleSourceId}
                            onChange={(e) => setNewRuleSourceId(e.target.value)}
                            className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold"
                          >
                            <option value="global">Global (Semua Sumber RSS)</option>
                            {registeredRssSources.map((src) => (
                              <option key={src.id} value={src.id}>{src.sourceName}</option>
                            ))}
                          </select>
                        </div>
                        {(newRuleType === 'substitute' || newRuleType === 'regex') && (
                          <>
                            <div>
                              <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Teks / Pattern Carian</label>
                              <input
                                type="text"
                                value={newRulePattern}
                                onChange={(e) => setNewRulePattern(e.target.value)}
                                placeholder={newRuleType === 'regex' ? '^[A-Z ]+,' : '&#039;'}
                                className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Teks Gantian (Replacement)</label>
                              <input
                                type="text"
                                value={newRuleReplacement}
                                onChange={(e) => setNewRuleReplacement(e.target.value)}
                                placeholder="Tinggalkan kosong untuk buang"
                                className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-xs"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex justify-end pt-2 border-t border-stone-150">
                        <button
                          type="button"
                          onClick={handleAddRssTextRule}
                          className="px-4 py-1.5 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold cursor-pointer shadow-sm transition-all"
                        >
                          + Tambah Peraturan Teks
                        </button>
                      </div>
                    </div>

                    {/* LIVE SANDBOX TESTER (FORMULA TESTER) */}
                    <div className="p-3 bg-[#1F1F1F] text-stone-100 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <h5 className="font-mono text-xs font-bold text-[#E9D8A6] uppercase tracking-wider flex items-center gap-2">
                          <FlaskConical className="w-3.5 h-3.5" /> Live Sandbox Tester (Preview Hasil Pembersihan)
                        </h5>
                        <button
                          type="button"
                          onClick={handleRunLiveTester}
                          className="px-3 py-1 bg-[#802334] hover:bg-[#a02c42] text-white font-mono text-[10px] uppercase font-bold rounded cursor-pointer transition-all"
                        >
                          ▶ Uji Peraturan Sekarang
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="font-mono text-[9px] uppercase text-stone-400 font-bold">Teks Mentah RSS Untuk Diuji</label>
                          <textarea
                            value={testerRawText}
                            onChange={(e) => setTesterRawText(e.target.value)}
                            rows={3}
                            className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded font-serif text-xs text-stone-200 focus:outline-none focus:border-[#E9D8A6]"
                          />
                        </div>
                        <div>
                          <label className="font-mono text-[9px] uppercase text-[#E9D8A6] font-bold">Preview Hasil Pembersihan (Output)</label>
                          <div className="w-full min-h-[4.5rem] p-2.5 bg-stone-900 border border-stone-700 rounded font-serif text-xs text-green-300 select-text whitespace-pre-wrap">
                            {testerResult ? testerResult.cleanedText : '(Tekan "Uji Peraturan Sekarang" untuk melihat pratonton)'}
                          </div>
                        </div>
                      </div>

                      {/* Transformation Trace Debug Output */}
                      {testerResult && testerResult.trace && testerResult.trace.length > 0 && (
                        <div className="p-2.5 bg-stone-900 border border-stone-800 rounded space-y-1.5 font-mono text-[10px]">
                          <span className="text-amber-400 font-bold uppercase tracking-wider block">
                            Transformation Trace ({testerResult.trace.length} Langkah Berjaya Diguna)
                          </span>
                          {testerResult.trace.map((tr: any) => (
                            <div key={tr.step} className="flex flex-col gap-0.5 border-b border-stone-800 pb-1 text-stone-300">
                              <span className="text-[#E9D8A6] font-bold">
                                [{tr.step}] {tr.ruleName} ({tr.ruleType})
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-[9px]">
                                <span className="text-red-400 truncate">Sebelum: {tr.before}</span>
                                <span className="text-green-400 truncate">Selepas: {tr.after}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 🏷️ ADJUNG DESK CLASSIFICATION ENGINE PANEL */}
                  <div className="col-span-2 mt-4 p-4 bg-stone-50 border border-stone-250 rounded-lg space-y-4">
                    <div className="flex justify-between items-center border-b border-stone-200 pb-3">
                      <div>
                        <h4 className="font-mono text-xs uppercase font-bold text-[#802334] tracking-wider flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5" /> Adjung Desk Classification Engine (Pemberat Kata Kunci & Confidence)
                        </h4>
                        <p className="text-[10px] text-stone-500 font-sans mt-0.5">
                          Mengelaskan berita ke dalam desk jurnal Adjung secara automatik mengikut markah pemberat kata kunci (Weighted Keywords) & skor keyakinan.
                        </p>
                      </div>
                      <div className="flex gap-1.5 font-mono text-[9px] font-bold">
                        <span className="px-2 py-0.5 bg-stone-200 text-stone-700 rounded">
                          {adjungDesks.length} Desk Berdaftar
                        </span>
                        <span className="px-2 py-0.5 bg-[#802334] text-white rounded">
                          {rssDeskRules.length} Kata Kunci Berwajaran
                        </span>
                      </div>
                    </div>

                    {/* 1. JADUAL DESK REGISTRY (adjung_desks) */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h5 className="font-mono text-[10px] uppercase font-bold text-stone-700 tracking-wider">
                          1. Senarai Desk Redaksi Adjung (Desk Registry)
                        </h5>
                      </div>

                      <div className="overflow-x-auto border border-stone-200 rounded bg-white">
                        <table className="w-full text-left font-sans text-xs">
                          <thead>
                            <tr className="bg-stone-100 border-b border-stone-200 text-[9px] font-mono uppercase text-stone-600 font-bold tracking-wider">
                              <th className="p-2">Nama Desk</th>
                              <th className="p-2">Penerangan / Skop Desk</th>
                              <th className="p-2 text-center">Urutan</th>
                              <th className="p-2 text-center">Tindakan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adjungDesks.map((d) => (
                              <tr key={d.id} className="border-b border-stone-150 hover:bg-stone-50 transition-colors">
                                <td className="p-2 font-bold text-[#802334]">
                                  {d.deskName}
                                </td>
                                <td className="p-2 text-stone-600 text-[11px]">
                                  {d.description || '-'}
                                </td>
                                <td className="p-2 text-center font-mono text-[10px] font-semibold text-stone-500">
                                  #{d.displayOrder}
                                </td>
                                <td className="p-2 text-center">
                                  <Tooltip text="Hapus Desk">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAdjungDesk(d.id, d.deskName)}
                                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </Tooltip>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Borang Tambah Desk Baharu */}
                      <div className="p-3 bg-white border border-stone-200 rounded flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[150px]">
                          <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Nama Desk Baharu</label>
                          <input
                            type="text"
                            value={newDeskName}
                            onChange={(e) => setNewDeskName(e.target.value)}
                            placeholder="cth: Agama / Geopolitik"
                            className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold"
                          />
                        </div>
                        <div className="flex-2 min-w-[200px]">
                          <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Penerangan Ringkas</label>
                          <input
                            type="text"
                            value={newDeskDescription}
                            onChange={(e) => setNewDeskDescription(e.target.value)}
                            placeholder="cth: Hal ehwal agama, fikrah, & pemikiran Islam"
                            className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddAdjungDesk}
                          className="px-3 py-1.5 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold cursor-pointer shadow-sm"
                        >
                          + Tambah Desk
                        </button>
                      </div>
                    </div>

                    {/* 2. JADUAL PERATURAN KATA KUNCI BERWAJARAN (rss_desk_rules) */}
                    <div className="space-y-2 pt-2 border-t border-stone-200">
                      <h5 className="font-mono text-[10px] uppercase font-bold text-stone-700 tracking-wider">
                        2. Peraturan Kata Kunci Berwajaran (Weighted Keyword Rules)
                      </h5>

                      <div className="overflow-x-auto border border-stone-200 rounded bg-white max-h-60 overflow-y-auto">
                        <table className="w-full text-left font-sans text-xs">
                          <thead>
                            <tr className="bg-stone-100 border-b border-stone-200 text-[9px] font-mono uppercase text-stone-600 font-bold tracking-wider sticky top-0 bg-stone-100">
                              <th className="p-2">Desk Sasaran</th>
                              <th className="p-2">Kata Kunci Padanan</th>
                              <th className="p-2 text-center">Pemberat (Weight)</th>
                              <th className="p-2 text-center">Jenis Padanan</th>
                              <th className="p-2 text-center">Tindakan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rssDeskRules.map((rule) => {
                              const targetDesk = adjungDesks.find(d => d.id === rule.deskId || d.deskName.toLowerCase() === rule.deskId.toLowerCase());
                              const isNeg = rule.isNegative === 1;
                              return (
                                <tr key={rule.id} className="border-b border-stone-150 hover:bg-stone-50 transition-colors">
                                  <td className="p-2 font-bold text-[#802334]">
                                    {targetDesk ? targetDesk.deskName : rule.deskId}
                                  </td>
                                  <td className="p-2 font-mono text-[11px] font-semibold text-stone-800">
                                    {rule.keyword}
                                  </td>
                                  <td className="p-2 text-center font-mono text-[11px] font-bold">
                                    <span className={isNeg ? 'text-red-600' : 'text-emerald-700'}>
                                      {isNeg ? `-50` : `+${rule.weight}`}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center font-mono text-[10px]">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                      isNeg ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                      {isNeg ? 'NEGATIF (-50)' : 'POSITIF'}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    <Tooltip text="Hapus Peraturan Kata Kunci">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRssDeskRule(rule.id, rule.keyword)}
                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </Tooltip>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Borang Tambah Peraturan Kata Kunci Baharu */}
                      <div className="p-3 bg-white border border-stone-200 rounded grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                        <div>
                          <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Pilih Desk Sasaran</label>
                          <select
                            value={newRuleDeskId}
                            onChange={(e) => setNewRuleDeskId(e.target.value)}
                            className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold"
                          >
                            {adjungDesks.map(d => (
                              <option key={d.id} value={d.id}>{d.deskName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Kata Kunci Padanan</label>
                          <input
                            type="text"
                            value={newRuleKeyword}
                            onChange={(e) => setNewRuleKeyword(e.target.value)}
                            placeholder="cth: ASEAN / ringgit / AI"
                            className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Mata Pemberat (Weight)</label>
                          <input
                            type="number"
                            value={newRuleWeight}
                            onChange={(e) => setNewRuleWeight(Number(e.target.value))}
                            placeholder="15 - 40"
                            className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                          <label className="flex items-center gap-1.5 cursor-pointer font-sans text-xs text-stone-700">
                            <input
                              type="checkbox"
                              checked={newRuleIsNegative}
                              onChange={(e) => setNewRuleIsNegative(e.target.checked)}
                              className="accent-red-600"
                            />
                            Kata Kunci Penolakan (Negatif)
                          </label>
                          <button
                            type="button"
                            onClick={handleAddRssDeskRule}
                            className="ml-auto px-3 py-1.5 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold cursor-pointer shadow-sm"
                          >
                            + Tambah Rule
                          </button>
                        </div>
                      </div>

                      {/* 3. CADANGAN MEMORI EDITORIAL (PASSIVE EDITORIAL MEMORY WITH HUMAN APPROVAL) */}
                      {editorialMemories.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-stone-200">
                          <div className="flex justify-between items-center">
                            <h5 className="font-mono text-[10px] uppercase font-bold text-amber-800 tracking-wider flex items-center gap-1.5">
                              <Brain className="w-3 h-3" /> Cadangan Memori Editorial ({editorialMemories.length} Cadangan Menunggu Kelulusan)
                            </h5>
                            <span className="text-[9px] font-mono text-stone-500">Hasil Override Manual Editor</span>
                          </div>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {editorialMemories.map((mem) => (
                              <div key={mem.id} className="p-2.5 bg-amber-50 rounded border border-amber-200 flex justify-between items-center text-xs font-mono gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-stone-900">"{mem.phraseExtracted}"</span>
                                  <span className="text-[10px] text-amber-800 ml-2">→ Cadangan Desk: <strong>{mem.suggestedDesk}</strong></span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handlePromoteMemory(mem.id, mem.suggestedDesk, mem.phraseExtracted)}
                                  className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer shrink-0 shadow-xs"
                                >
                                  + Jadikan Peraturan Desk
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 4. PENGURUS KATEGORI XML RSS TERSEKAT (DYNAMIC CATEGORY BLOCKLIST MANAGER) */}
                      <div className="space-y-3 pt-3 border-t border-stone-200">
                        <div className="flex justify-between items-center">
                          <h5 className="font-mono text-[10px] uppercase font-bold text-red-800 tracking-wider flex items-center gap-1.5">
                            <Ban className="w-3 h-3" /> Kategori XML RSS Tersekat (Blocked XML Categories - 100% Dinamik)
                          </h5>
                          <span className="text-[9px] font-mono text-stone-500">{rssBlockedCategories.length} Kategori Disekat</span>
                        </div>

                        {/* Chips Kategori Tersekat */}
                        <div className="flex flex-wrap gap-1.5 bg-red-50/50 p-2.5 rounded border border-red-200 min-h-[40px] items-center">
                          {rssBlockedCategories.length === 0 ? (
                            <span className="text-xs text-stone-400 italic">Tiada kategori XML disekat. Semua kategori diserap.</span>
                          ) : (
                            rssBlockedCategories.map(cat => (
                              <span key={cat.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 border border-red-300 text-red-800 rounded-full font-mono text-xs font-bold shadow-2xs">
                                <span>{cat.categoryName}</span>
                                <Tooltip text={`Nyahsekat ${cat.categoryName}`}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRssBlockedCategory(cat.id, cat.categoryName)}
                                    className="ml-1 text-red-600 hover:text-red-900 cursor-pointer font-extrabold"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Tooltip>
                              </span>
                            ))
                          )}
                        </div>

                        {/* Borang Tambah Kategori Sekat Baharu */}
                        <div className="flex gap-2 items-center bg-white p-2 border border-stone-200 rounded">
                          <input
                            type="text"
                            value={newBlockedCategoryName}
                            onChange={(e) => setNewBlockedCategoryName(e.target.value)}
                            placeholder="Taip nama kategori XML untuk disekat (cth: Hiburan / Gaya / Gossip)"
                            className="flex-1 px-3 py-1.5 border border-stone-300 rounded font-mono text-xs"
                          />
                          <button
                            type="button"
                            onClick={handleAddRssBlockedCategory}
                            className="px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white rounded text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs shrink-0"
                          >
                            + Sekat Kategori
                          </button>
                        </div>
                      </div>

                      {/* 5. JEJAK AUDIT BERITA DISEKAT (BLOCKED NEWS VISUAL AUDIT TRAIL) */}
                      {blockedQueue.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-stone-200">
                          <div className="flex justify-between items-center">
                            <h5 className="font-mono text-[10px] uppercase font-bold text-red-900 tracking-wider flex items-center gap-1.5">
                              <Ban className="w-3 h-3" /> Jejak Audit Berita Disekat ({blockedQueue.length} Berita Disekat)
                            </h5>
                            <span className="text-[9px] font-mono text-stone-500 font-bold text-red-700">Ditolak di Pintu Masuk XML</span>
                          </div>

                          <div className="overflow-x-auto border border-red-200 rounded bg-red-50/30 max-h-48 overflow-y-auto">
                            <table className="w-full text-left font-sans text-xs">
                              <thead>
                                <tr className="bg-red-100 border-b border-red-200 text-[9px] font-mono uppercase text-red-900 font-bold tracking-wider sticky top-0">
                                  <th className="p-2">Tajuk Berita</th>
                                  <th className="p-2">Sumber</th>
                                  <th className="p-2 text-center">Tag XML Asal</th>
                                  <th className="p-2 text-center">Status Audit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {blockedQueue.map((item) => (
                                  <tr key={item.id} className="border-b border-red-100 hover:bg-red-100/50 transition-colors">
                                    <Tooltip text={item.title}>
                                      <td className="p-2 font-medium text-stone-900 max-w-xs truncate">
                                        {item.title}
                                      </td>
                                    </Tooltip>
                                    <td className="p-2 text-stone-600 font-mono text-[10px] shrink-0">
                                      {item.source}
                                    </td>
                                    <td className="p-2 text-center font-mono text-[11px] font-bold text-red-800 shrink-0">
                                      <span className="px-2 py-0.5 bg-red-200/80 rounded border border-red-300">{item.category}</span>
                                    </td>
                                    <td className="p-2 text-center font-mono text-[10px] font-bold text-red-700 shrink-0">
                                      <span className="inline-flex items-center justify-center gap-1"><Ban className="w-3 h-3" /> DISEKAT</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. LIVE DESK CLASSIFIER SANDBOX (WITH CONFIDENCE SCORE) */}
                    <div className="p-3 bg-[#1F1F1F] text-stone-100 rounded-lg space-y-3 pt-3 border-t border-stone-700">
                      <div className="flex justify-between items-center">
                        <h5 className="font-mono text-xs font-bold text-[#E9D8A6] uppercase tracking-wider flex items-center gap-2">
                          <FlaskConical className="w-3.5 h-3.5" /> Live Desk Classifier Sandbox (Analisis Skor & Confidence)
                        </h5>
                        <button
                          type="button"
                          onClick={handleRunDeskClassifierTest}
                          className="px-3 py-1 bg-[#802334] hover:bg-[#a02c42] text-white font-mono text-[10px] uppercase font-bold rounded cursor-pointer transition-all"
                        >
                          ▶ Uji Klasifikasi Desk
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div>
                            <label className="font-mono text-[9px] uppercase text-stone-400 font-bold">Tajuk Berita</label>
                            <input
                              type="text"
                              value={deskTestTitle}
                              onChange={(e) => setDeskTestTitle(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded font-serif text-xs text-stone-200"
                            />
                          </div>
                          <div>
                            <label className="font-mono text-[9px] uppercase text-stone-400 font-bold">Huraian / Brief Berita</label>
                            <textarea
                              value={deskTestBrief}
                              onChange={(e) => setDeskTestBrief(e.target.value)}
                              rows={2}
                              className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded font-serif text-xs text-stone-200"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="font-mono text-[9px] uppercase text-[#E9D8A6] font-bold">Cadangan Desk Sistem & Kedudukan Skor</label>
                          <div className="w-full min-h-[5.5rem] p-2.5 bg-stone-900 border border-stone-700 rounded font-mono text-xs text-stone-200 space-y-1.5 select-text">
                            {deskTestResult ? (
                              <>
                                <div className="flex items-center justify-between border-b border-stone-800 pb-1">
                                  <span className="text-emerald-400 font-bold text-sm inline-flex items-center gap-1">
                                    <Check className="w-4 h-4" /> DESK: {deskTestResult.winningDesk.toUpperCase()}
                                  </span>
                                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                                    deskTestResult.confidence === 'HIGH' ? 'bg-green-900 text-green-200' : deskTestResult.confidence === 'MEDIUM' ? 'bg-amber-900 text-amber-200' : 'bg-red-900 text-red-200'
                                  }`}>
                                    Keyakinan: {deskTestResult.confidence} (Skor: {deskTestResult.topScore})
                                  </span>
                                </div>
                                <p className="text-[10px] text-stone-400 italic">
                                  {deskTestResult.reason}
                                </p>
                                {deskTestResult.deskScores && deskTestResult.deskScores.length > 0 && (
                                  <div className="pt-1 flex flex-wrap gap-2 text-[10px]">
                                    {deskTestResult.deskScores.slice(0, 4).map((ds: any, idx: number) => (
                                      <span key={ds.deskName} className={idx === 0 ? 'text-green-300 font-bold' : 'text-stone-400'}>
                                        {ds.deskName} ({ds.score})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-stone-500 text-xs">(Tekan "Uji Klasifikasi Desk" untuk melihat kedudukan skor)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 6. ADJUNG TYPOGRAPHY RULES (v2.1 - GLOBAL EDITORIAL STYLE LAYER) */}
                      <div className="p-3 bg-stone-50/70 border border-stone-200 rounded-lg space-y-3 pt-3">
                        <div className="flex justify-between items-center">
                          <h5 className="font-mono text-xs font-bold text-[#802334] uppercase tracking-wider flex items-center gap-2">
                            <PenTool className="w-3.5 h-3.5" /> Adjung Typography Rules (v2.1 - Lapisan Gaya Penerbitan Global)
                          </h5>
                          <span className="text-[9px] font-mono text-stone-500">{adjungTypographyRules.length} Aturan Tipografi</span>
                        </div>

                        {/* Live Sandbox Preview */}
                        <TypographyPreview rules={adjungTypographyRules} />

                        {/* Jadual Peraturan Tipografi */}
                        <div className="overflow-x-auto border border-stone-200 rounded bg-white max-h-56 overflow-y-auto">
                          <table className="w-full text-left font-sans text-xs">
                            <thead>
                              <tr className="bg-stone-100 border-b border-stone-200 text-[9px] font-mono uppercase text-stone-700 font-bold tracking-wider sticky top-0">
                                <th className="p-2">Istilah</th>
                                <th className="p-2 text-center">Gaya</th>
                                <th className="p-2 text-center">Kategori</th>
                                <th className="p-2 text-center">Keutamaan</th>
                                <th className="p-2 text-center">Status</th>
                                <th className="p-2 text-center">Tindakan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adjungTypographyRules.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="p-4 text-center text-stone-400 font-mono text-xs italic">
                                    Tiada peraturan tipografi didaftarkan.
                                  </td>
                                </tr>
                              ) : (
                                adjungTypographyRules.map((rule) => {
                                  const isPending = rule.status === 'pending';
                                  return (
                                    <tr key={rule.id} className={`border-b border-stone-100 hover:bg-stone-50 transition-colors ${isPending ? 'bg-amber-50/40' : ''}`}>
                                      <td className="p-2 font-mono font-bold text-stone-900">
                                        {rule.term}
                                        {rule.excludeTerms && (
                                          <span className="block text-[9px] text-stone-400 font-normal">
                                            Pengecualian: {rule.excludeTerms}
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2 text-center font-mono text-[10px]">
                                        <span className="px-2 py-0.5 bg-stone-100 border border-stone-300 rounded font-bold uppercase">
                                          {rule.style}
                                        </span>
                                      </td>
                                      <td className="p-2 text-center font-mono text-[10px] text-stone-600">
                                        {rule.category}
                                      </td>
                                      <td className="p-2 text-center font-mono text-[10px] font-bold text-amber-800">
                                        {rule.priority}
                                      </td>
                                      <td className="p-2 text-center shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAdjungTypographyRuleStatus(rule)}
                                          className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase font-bold cursor-pointer border ${
                                            rule.status === 'active'
                                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                              : 'bg-amber-100 text-amber-800 border-amber-300'
                                          }`}
                                        >
                                          {rule.status === 'active' ? '● Aktif' : '⏳ Pending'}
                                        </button>
                                      </td>
                                      <td className="p-2 text-center">
                                        <Tooltip text="Hapus Peraturan">
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteAdjungTypographyRule(rule.id, rule.term)}
                                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </Tooltip>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Borang Tambah Peraturan Tipografi Baharu */}
                        <div className="p-3 bg-white border border-stone-200 rounded space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                            <div>
                              <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Istilah Padanan</label>
                              <input
                                type="text"
                                value={newTypoTerm}
                                onChange={(e) => setNewTypoTerm(e.target.value)}
                                placeholder="cth: scammer / Dewan Rakyat"
                                className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Gaya Tipografi</label>
                              <select
                                value={newTypoStyle}
                                onChange={(e) => setNewTypoStyle(e.target.value)}
                                className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold"
                              >
                                <option value="italic">Italic (Senget)</option>
                                <option value="bold">Bold (Tebal)</option>
                                <option value="small_caps">Small Caps (Huruf Kecil Kapital)</option>
                              </select>
                            </div>
                            <div>
                              <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Jenis Padanan</label>
                              <select
                                value={newTypoMatchType}
                                onChange={(e) => setNewTypoMatchType(e.target.value)}
                                className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold"
                              >
                                <option value="word">Perkataan (Word)</option>
                                <option value="phrase">Frasa Penuh (Phrase)</option>
                                <option value="regex">RegEx Custom</option>
                              </select>
                            </div>
                            <div>
                              <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Keutamaan (Priority)</label>
                              <input
                                type="number"
                                value={newTypoPriority}
                                onChange={(e) => setNewTypoPriority(Number(e.target.value))}
                                className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-xs"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end pt-1">
                            <div>
                              <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Skop Pemformatan</label>
                              <select
                                value={newTypoScope}
                                onChange={(e) => setNewTypoScope(e.target.value)}
                                className="w-full px-2 py-1.5 border border-stone-300 rounded text-xs font-semibold"
                              >
                                <option value="all">Semua Skop (All)</option>
                                <option value="title">Tajuk Sahaja (Title)</option>
                                <option value="brief">Huraian Ringkas (Brief)</option>
                                <option value="body">Kandungan Utama (Body)</option>
                              </select>
                            </div>
                            <div>
                              <label className="font-mono text-[9px] uppercase text-stone-500 font-bold">Frasa Pengecualian (Optional)</label>
                              <input
                                type="text"
                                value={newTypoExcludeTerms}
                                onChange={(e) => setNewTypoExcludeTerms(e.target.value)}
                                placeholder="cth: Startup Malaysia, Startup Studio"
                                className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-xs"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleAddAdjungTypographyRule}
                                className="px-4 py-1.5 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs"
                              >
                                + Simpan Peraturan
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* MODUS MANUAL */}
                {formConfig.contentMode === 'Manual' && (
                  <>
                    {/* MODUS MANUAL BENTO SLOTS (0 - 36) */}
                    {editingSlotIndex !== -1 ? (
                      <div className="flex flex-col gap-4 col-span-2 pt-1">
                        <div className="flex justify-between items-center flex-wrap gap-1">
                          <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">
                            Kandungan Manual Redaksi (Kirim Pukal / Tunggal)
                          </label>
                          <span className="text-[10px] font-mono text-stone-500 font-semibold">
                            * UUID dikunci automatik. Tampal kandungan pukal untuk pemisahan automatik.
                          </span>
                        </div>

                        {(() => {
                          // Parse manualSummary into structured blocks
                          const rawText = formConfig.manualSummary || '';
                          const rawBlocks = rawText.split(/(?:\r?\n){2,}(?=UUID:|Tajuk:|Event:)|____+|----+|====+|___+/i).filter(b => b.trim().length > 0);

                          const parsedList = (rawBlocks.length > 0 ? rawBlocks : [rawText]).map((blk, idx) => {
                            let uuid = '';
                            const uuidMatch = blk.match(/^UUID:\s*([^\r\n]+)/i);
                            if (uuidMatch) {
                              uuid = uuidMatch[1].trim();
                            } else {
                              uuid = `object-manual-slot${editingSlotIndex}-${Date.now()}-${idx}`;
                            }
                            // Clean text by stripping UUID line if present at top
                            const cleanContent = blk.replace(/^UUID:[^\r\n]*\r?\n?/i, '').trim();
                            return { uuid, text: cleanContent };
                          });

                          const updateSummaryFromList = (newList: { uuid: string; text: string }[]) => {
                            const serialized = newList.map(item => `UUID: ${item.uuid}\n${item.text}`).join('\n\n________________________________________\n\n');
                            setFormConfig({ ...formConfig, manualSummary: serialized });
                          };

                          const handleBlockChange = (index: number, val: string) => {
                            // Check if user pasted bulk content into this single block
                            const subBlocks = val.split(/(?:\r?\n){2,}(?=UUID:|Tajuk:|Event:)|____+|----+|====+|___+/i).filter(b => b.trim().length > 0);
                            
                            if (subBlocks.length > 1) {
                              // Bulk paste detected! Auto-split into separate blocks
                              const replacementBlocks = subBlocks.map((sb, sbIdx) => {
                                let sbUuid = '';
                                const m = sb.match(/^UUID:\s*([^\r\n]+)/i);
                                if (m) {
                                  sbUuid = m[1].trim();
                                } else {
                                  sbUuid = `object-manual-slot${editingSlotIndex}-${Date.now()}-${index}-${sbIdx}`;
                                }
                                return { uuid: sbUuid, text: sb.replace(/^UUID:[^\r\n]*\r?\n?/i, '').trim() };
                              });

                              const newList = [...parsedList];
                              newList.splice(index, 1, ...replacementBlocks);
                              updateSummaryFromList(newList);
                            } else {
                              // Regular single block update
                              const newList = [...parsedList];
                              newList[index] = { ...newList[index], text: val };
                              updateSummaryFromList(newList);
                            }
                          };

                          const handleAddBlock = () => {
                            const newUuid = `object-manual-slot${editingSlotIndex}-${Date.now()}-${parsedList.length}`;
                            const template = isEditingBarSlot
                              ? `Tarikh: \nEvent: (had ${formConfig.maxTitle || 95} aksara) \nPenganjur: \nLokasi: \nAkses: \nPenerangan: \nURL: `
                              : `Tajuk: \nHuraian ringkas: \nHuraian panjang: \nKategori: \nJenis sumber: \nTarikh: \nSumber: \nURL: `;
                            const newList = [...parsedList, { uuid: newUuid, text: template }];
                            updateSummaryFromList(newList);
                          };

                          const handleRemoveBlock = (index: number) => {
                            if (parsedList.length <= 1) return;
                            const newList = parsedList.filter((_, i) => i !== index);
                            updateSummaryFromList(newList);
                          };

                          const handleKeyDownItalic = (e: React.KeyboardEvent<HTMLTextAreaElement>, bIndex: number, currentText: string) => {
                            if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
                              e.preventDefault();
                              const textarea = e.currentTarget;
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;

                              if (start !== end) {
                                const selectedText = currentText.substring(start, end);
                                let replacement = '';
                                let newStart = start;
                                let newEnd = end;

                                if (selectedText.startsWith('*') && selectedText.endsWith('*') && selectedText.length >= 2) {
                                  replacement = selectedText.slice(1, -1);
                                  newEnd = start + replacement.length;
                                } else {
                                  replacement = `*${selectedText}*`;
                                  newEnd = start + replacement.length;
                                }

                                const updatedText = currentText.substring(0, start) + replacement + currentText.substring(end);
                                handleBlockChange(bIndex, updatedText);

                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(newStart, newEnd);
                                }, 0);
                              } else {
                                const updatedText = currentText.substring(0, start) + '**' + currentText.substring(end);
                                handleBlockChange(bIndex, updatedText);

                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + 1, start + 1);
                                }, 0);
                              }
                            }
                          };

                          return (
                            <div className="flex flex-col gap-6">
                              {parsedList.map((item, bIndex) => (
                                <div id={`manual-block-card-${bIndex + 1}`} key={item.uuid || bIndex} className="flex flex-col gap-2 p-3 bg-[#F9F8F6] rounded border border-stone-250">
                                  {/* Header Bar dengan Read-only UUID & Butang Padam */}
                                  <div className="flex justify-between items-center bg-stone-100 px-3 py-1.5 rounded border border-stone-200">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <span className="text-[10px] font-mono font-bold text-[#802334] bg-white px-2 py-0.5 rounded border border-stone-300 shadow-2xs shrink-0">
                                        Blok #{bIndex + 1}
                                      </span>
                                      <Tooltip text="UUID Kanonikal (Dikunci oleh Sistem)">
                                        <span className="text-[10px] font-mono font-bold text-stone-600 truncate select-all inline-flex items-center gap-1">
                                          <Lock className="w-3 h-3 shrink-0" /> UUID: <span className="text-stone-900">{item.uuid}</span>
                                        </span>
                                      </Tooltip>
                                    </div>
                                    {parsedList.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveBlock(bIndex)}
                                        className="text-[10px] font-mono text-rose-700 hover:text-rose-900 font-bold px-2 py-0.5 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition cursor-pointer shrink-0 inline-flex items-center gap-1"
                                      >
                                        <Trash2 className="w-3 h-3" /> Hapus Blok
                                      </button>
                                    )}
                                  </div>

                                  <textarea
                                    id={`manual-block-textarea-${bIndex + 1}`}
                                    value={item.text}
                                    onChange={(e) => handleBlockChange(bIndex, e.target.value)}
                                    onKeyDown={(e) => handleKeyDownItalic(e, bIndex, item.text)}
                                    rows={8}
                                    placeholder="Taip atau tampal kandungan di sini... (Ctrl+I untuk italic perkataan)"
                                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs leading-relaxed"
                                  />

                                  {/* Pemisah UI Hujung ke Hujung (bukan markdown) */}
                                  {bIndex < parsedList.length - 1 && (
                                    <div className="pt-3 pb-1">
                                      <hr className="border-t-2 border-dashed border-stone-300" />
                                    </div>
                                  )}
                                </div>
                              ))}

                              {/* Butang Tambah Blok Baharu */}
                              <div className="flex justify-center pt-2">
                                <button
                                  type="button"
                                  onClick={handleAddBlock}
                                  className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-mono text-xs font-bold rounded border border-stone-300 flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                                >
                                  <span>+ Tambah Blok Kandungan Baharu (Carousel / Slide)</span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* MODUS MANUAL TICKER (-1) */
                      <div className="flex flex-col gap-1 col-span-2 pt-1">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kandungan Ticker Manual</label>
                        <textarea
                          id="manualSummaryTextarea"
                          value={formConfig.manualSummary}
                          onChange={(e) => setFormConfig({ ...formConfig, manualSummary: e.target.value })}
                          rows={12}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs leading-relaxed"
                        />
                        <p className="text-[9px] text-[#802334] font-sans font-bold leading-normal mt-1">
                          * Nota: Pisahkan setiap kandungan ticker dengan garisan pemisah tiga sempang (---) di baris baharu.
                        </p>
                      </div>
                    )}



                    {renderTetapanSlot()}

                    {/* Tetapan Penjanaan AI (Prompt Builder) */}
                    <div className="col-span-2 flex flex-col gap-0.5 pt-1 border-t border-stone-150">
                      <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Tetapan Penjanaan AI</label>
                        <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const isBar = TIER_SLOTS.BAR.includes(editingSlotIndex);
                            const count = formConfig.generationLimit || 1;
                            const settingsLines = [];
                            if (formConfig.aiPromptTopic) settingsLines.push(`Topik: ${formConfig.aiPromptTopic}`);
                            settingsLines.push(`Bilangan kandungan: ${count}`);
                            if (formConfig.aiPromptRecency) settingsLines.push(`Had usia kandungan: ${formConfig.aiPromptRecency}`);
                            if (formConfig.aiPromptLanguage) settingsLines.push(`Bahasa: ${formConfig.aiPromptLanguage}`);
                            if (formConfig.aiPromptRegion) settingsLines.push(`Negara/Wilayah: ${formConfig.aiPromptRegion}`);
                            if (formConfig.aiPromptSource) settingsLines.push(`Sumber dicadangkan: ${formConfig.aiPromptSource}`);
                            const settingsBlock = settingsLines.length > 0 ? `${settingsLines.join('\n')}\n\n` : '';
                            const masterPromptBlock = formConfig.masterPrompt ? `Peraturan am (berkuatkuasa untuk semua kandungan): ${formConfig.masterPrompt}\n\n` : '';
                            const extraInstructions = formConfig.promptText ? `\nArahan tambahan (khusus slot ini): ${formConfig.promptText}\n` : '';

                            let textToCopy = '';
                            if (editingSlotIndex === -1) {
                              const tickerMultiNote = count > 1 ? `Jana sejumlah ${count} kandungan berasingan. Pisahkan SETIAP satu dengan garisan pemisah tiga sempang (---) di baris berasingan, seperti contoh di bawah.\n\n` : '';
                              textToCopy = `Sila jana kandungan ringkas terkini di Malaysia bagi segmen Ticker.

${masterPromptBlock}${settingsBlock}${tickerMultiNote}Format output mestilah ditulis tepat seperti format di bawah:

Desk: KATEGORI
Title: [Tajuk kandungan terkini Malaysia di bawah 80 aksara]
Brief: [Huraian pendek tepat satu ayat di bawah 220 aksara]
Source: [Nama Sumber, cth: Sinar Harian/Astro Awani]
Url: [Pautan URL artikel khusus]${count > 1 ? `

---

Desk: KATEGORI
Title: ...` : ''}
${extraInstructions}`;
                            } else if (isBar) {
                              const barMultiNote = count > 1 ? `Jana sejumlah ${count} acara berasingan. Pisahkan SETIAP satu dengan garisan pemisah empat underscore (____) di baris berasingan, seperti contoh di bawah.\n\n` : '';
                              textToCopy = `Sila jana maklumat acara untuk paparan kad ringkas (acara/event) di laman utama.

${masterPromptBlock}${settingsBlock}${barMultiNote}Format output mestilah ditulis tepat seperti format di bawah:

Tarikh: (contoh: 19-26 Julai 2026) [Tarikh acara]
Event: (had ${formConfig.maxTitle || 95} aksara) [Nama acara]
Penganjur: [Akronim penganjur, contoh: PPAS / DBP / PNM / KPM]
Lokasi: [Lokasi acara, contoh: SACC Mall]
Akses: [Terbuka / Tertutup]
Penerangan: [Pilihan -- huraian tambahan acara, tidak dipaparkan pada kad]
URL: [Pautan URL rujukan]${count > 1 ? `

____

Tarikh: (contoh: 19-26 Julai 2026) [Tarikh acara]
Event: (had ${formConfig.maxTitle || 95} aksara) [Nama acara]
Penganjur: [Akronim penganjur, contoh: PPAS / DBP / PNM / KPM]
Lokasi: [Lokasi acara, contoh: SACC Mall]
Akses: [Terbuka / Tertutup]
Penerangan: [Pilihan -- huraian tambahan acara, tidak dipaparkan pada kad]
URL: [Pautan URL rujukan]` : ''}
${extraInstructions}`;
                            } else {
                              const kategori = formConfig.manualDesk || '';
                              const topik = formConfig.aiPromptTopic || '';
                              const hadUsia = formConfig.aiPromptRecency || '';
                              const bahasaSumber = formConfig.aiPromptLanguage || '';
                              const negaraWilayah = formConfig.aiPromptRegion || '';
                              const maxTitleVal = formConfig.maxTitle || 75;
                              const maxBriefVal = formConfig.maxBrief || 0;
                              const maxBriefLongVal = formConfig.maxBriefLong || 0;
                              const peraturanAm = formConfig.masterPrompt || '';
                              const peraturanTambahan = formConfig.promptText || '';

                              const exampleBlock = `Tajuk: [Tajuk kandungan di sini maksimum ${maxTitleVal} aksara]
Huraian ringkas: [Huraian ringkas maksimum ${maxBriefVal} aksara dan tidak lebih dua (2) ayat di sini]
Huraian panjang: [Huraian panjang maksimum ${maxBriefLongVal} aksara]
Topik: [nama topik yang bersesuaian, misalnya: Teknologi Robotik, Sejarah Malaysia]
Tarikh: [Tarikh sebenar penerbitan kandungan, cth: 20 Julai 2026]
Sumber: [Nama sumber, contohnya: CNN, Bernama, Aljazeera]
URL: [Pautan URL sumber rujukan]`;

                              const multiInstruction = count > 1
                                ? `Jika terdapat lebih daripada satu (1) kandungan, pisahkan SETIAP satu dengan garisan pemisah empat underscore (____) di baris berasingan atau dengan pemerengganan berasingan, seperti contoh di bawah.\n\n`
                                : '';

                              textToCopy = `Sila jana kandungan ringkas untuk paparan kad ringkas di laman utama dalam bahasa Melayu berdasarkan ketetapan berikut:
Kategori: ${kategori}
Topik: ${topik}
Bilangan kandungan: ${count}
Had usia kandungan: ${hadUsia}
Bahasa sumber rujukan: ${bahasaSumber}
Negara/Wilayah penerbit sumber rujukan: ${negaraWilayah}
Had aksara: a. Tajuk: tidak lebih ${maxTitleVal} aksara. b. Huraian ringkas: tidak lebih ${maxBriefVal} aksara c. Huraian panjang: tidak lebih ${maxBriefLongVal} aksara
Sila patuhi ketetapan umum berikut:
${peraturanAm}
Sila patuhi juga ketetapan khusus berikut:
${peraturanTambahan}
${multiInstruction}${exampleBlock}${count > 1 ? `

____

${exampleBlock}` : ''}`;
                            }
                            navigator.clipboard.writeText(textToCopy);
                            alert('Templat Prom AI telah disalin ke papan klip!');
                          }}
                          className="px-2 py-1 text-[9px] font-bold text-[#802334] bg-white border border-[#802334] rounded hover:bg-stone-50 transition-colors cursor-pointer shrink-0"
                        >
                          Salin Templat Prom AI
                        </button>
                        {editingSlotIndex !== -1 && !TIER_SLOTS.BAR.includes(editingSlotIndex) && (
                          <button
                            type="button"
                            onClick={() => {
                              const maxTitleVal = formConfig.maxTitle || 75;
                              const maxBriefVal = formConfig.maxBrief || 0;
                              const maxBriefLongVal = formConfig.maxBriefLong || 0;
                              const peraturanAm = formConfig.masterPrompt || '';

                              const textToCopy = `Sila baca dan analisis bahan yang diberikan, kemudian ekstrak kandungan utamanya ke dalam format berikut.

Format output
Tajuk:
[Tajuk kandungan. Maksimum ${maxTitleVal} aksara. Gubah semula menggunakan ayat sendiri. Jangan menyalin tajuk asal bulat-bulat kecuali nama khas.]
Huraian ringkas:
[Huraian maksimum ${maxBriefVal} aksara dan tidak melebihi dua (2) ayat.]
Huraian panjang:
[Huraian maksimum ${maxBriefLongVal} aksara.]
Topik:
[Nama topik yang paling sesuai, contohnya: Teknologi Robotik, Sejarah Malaysia, Kesusasteraan Arab.]
Tarikh:
[Tarikh sebenar penerbitan kandungan dalam format 20 Julai 2026. Jika tiada, tulis "Tidak dinyatakan".]
Sumber:
[Nama organisasi, penerbit, jurnal atau media.]
URL:
[Pautan asal, jika ada.]

Peraturan am
${peraturanAm}

Peraturan editorial
${LAMPIRAN_EDITORIAL_RULES}`;
                              navigator.clipboard.writeText(textToCopy);
                              alert('Templat Prom AI (Lampiran) telah disalin ke papan klip!');
                            }}
                            className="px-2 py-1 text-[9px] font-bold text-[#802334] bg-white border border-[#802334] rounded hover:bg-stone-50 transition-colors cursor-pointer shrink-0"
                          >
                            Salin Templat Prom AI (Lampiran)
                          </button>
                        )}
                        </div>
                      </div>
                      <p className="text-[9px] text-stone-400 font-sans leading-normal">
                        Isi medan di bawah untuk bina templat prom yang lengkap. Salin templat, tampal pada AI luar (ChatGPT/Gemini/Claude), kemudian tampal balik jawapan AI ke kotak "Kandungan Manual" di atas.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Topik</label>
                      <input
                        type="text"
                        value={formConfig.aiPromptTopic}
                        onChange={(e) => setFormConfig({ ...formConfig, aiPromptTopic: e.target.value })}
                        placeholder="cth: Ekonomi, Sukan, Teknologi"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Bilangan Kandungan</label>
                      <input
                        type="number"
                        min={1}
                        value={formConfig.generationLimit}
                        onChange={(e) => setFormConfig({ ...formConfig, generationLimit: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Had Usia Kandungan</label>
                      <input
                        type="text"
                        value={formConfig.aiPromptRecency}
                        onChange={(e) => setFormConfig({ ...formConfig, aiPromptRecency: e.target.value })}
                        placeholder="cth: 24 jam terkini"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Bahasa</label>
                      <input
                        type="text"
                        value={formConfig.aiPromptLanguage}
                        onChange={(e) => setFormConfig({ ...formConfig, aiPromptLanguage: e.target.value })}
                        placeholder="cth: Bahasa Melayu"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Negara / Wilayah</label>
                      <input
                        type="text"
                        value={formConfig.aiPromptRegion}
                        onChange={(e) => setFormConfig({ ...formConfig, aiPromptRegion: e.target.value })}
                        placeholder="cth: Malaysia"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Sumber (cadangan)</label>
                      <input
                        type="text"
                        value={formConfig.aiPromptSource}
                        onChange={(e) => setFormConfig({ ...formConfig, aiPromptSource: e.target.value })}
                        placeholder="cth: Bernama, Astro Awani"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Peraturan Am (Sistem/Global)</label>
                      <textarea
                        value={formConfig.masterPrompt || ''}
                        onChange={(e) => {
                          setFormConfig({ ...formConfig, masterPrompt: e.target.value });
                          setMasterPrompt(e.target.value);
                        }}
                        placeholder="Contoh: Gunakan bahasa Melayu yang baku, elakkan jargon..."
                        rows={3}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs leading-relaxed"
                      />
                      <p className="text-[9px] text-stone-500 font-sans mt-0.5">
                        * Nota: Peraturan am ini berkuatkuasa secara global bagi SEMUA slot (Manual & AI Generated). Kemas kini di sini akan terpakai di mana-mana.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Arahan Tambahan (Khusus Slot Ini Sahaja)</label>
                      <textarea
                        value={formConfig.promptText}
                        onChange={(e) => setFormConfig({ ...formConfig, promptText: e.target.value })}
                        rows={2}
                        placeholder="cth: Utamakan kandungan positif, elakkan isu politik parti"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      />
                    </div>
                  </>
                )}

                {/* MODUS AI GENERATED */}
                {formConfig.contentMode === 'AI Generated' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pembekal AI (AI Provider)</label>
                      <select
                        value={formConfig.providerId}
                        onChange={(e) => {
                          const p = aiProviders.find(prov => prov.id === e.target.value);
                          setFormConfig({ ...formConfig, providerId: e.target.value, model: p ? p.model : '' });
                        }}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      >
                        <option value="">-- Pilih Pembekal --</option>
                        {aiProviders.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Model AI</label>
                      {formConfig.providerId === 'gemini-1' ? (
                        <select
                          value={formConfig.model || 'gemini-3.5-flash'}
                          onChange={(e) => setFormConfig({ ...formConfig, model: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                        >
                          <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                          <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                          <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                          <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                        </select>
                      ) : formConfig.providerId === 'openai-1' ? (
                        <select
                          value={formConfig.model || 'gpt-4o'}
                          onChange={(e) => setFormConfig({ ...formConfig, model: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                        >
                          <option value="gpt-4o">gpt-4o</option>
                          <option value="gpt-4o-mini">gpt-4o-mini</option>
                          <option value="o1-mini">o1-mini</option>
                          <option value="o1-preview">o1-preview</option>
                        </select>
                      ) : formConfig.providerId === 'claude-1' ? (
                        <select
                          value={formConfig.model || 'claude-3-5-sonnet-latest'}
                          onChange={(e) => setFormConfig({ ...formConfig, model: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                        >
                          <option value="claude-3-5-sonnet-latest">claude-3-5-sonnet-latest</option>
                          <option value="claude-3-5-haiku-latest">claude-3-5-haiku-latest</option>
                          <option value="claude-3-opus-20240229">claude-3-opus-20240229</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={formConfig.model || ''}
                          onChange={(e) => setFormConfig({ ...formConfig, model: e.target.value })}
                          placeholder="Pilih pembekal di atas"
                          className="w-full px-3 py-2 border border-stone-300 rounded bg-white text-stone-700 font-mono text-xs focus:outline-none focus:border-[#802334]"
                        />
                      )}
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Peraturan Am (Sistem/Global)</label>
                      <textarea
                        value={formConfig.masterPrompt || ''}
                        onChange={(e) => {
                          setFormConfig({ ...formConfig, masterPrompt: e.target.value });
                          setMasterPrompt(e.target.value);
                        }}
                        placeholder="Contoh: Gunakan bahasa Melayu yang baku, elakkan jargon..."
                        rows={4}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs leading-relaxed"
                      />
                      <p className="text-[9px] text-stone-500 font-sans mt-0.5">
                        * Nota: Peraturan am ini selaras secara global bagi semua slot AI Generated yang lain.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Strategi Pencarian</label>
                      <select
                        value={formConfig.searchStrategy}
                        onChange={(e) => setFormConfig({ ...formConfig, searchStrategy: e.target.value })}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      >
                        <option value="Structured Sources Only">Structured Sources Only (RSS/Atom Feed Sahaja)</option>
                        <option value="Search Only">Search Only (Web Google Search Sahaja)</option>
                        <option value="Structured Sources -> Search Fallback">Structured Sources — Search Fallback (RSS &amp; Search)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pautan Sumber (sourcesList RSS / Web URL)</label>
                      <input
                        type="text"
                        value={formConfig.sourcesList}
                        onChange={(e) => setFormConfig({ ...formConfig, sourcesList: e.target.value })}
                        placeholder="https://feeds.feedburner.com/... atau URL portal/sumber"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                      />
                      <p className="text-[9px] text-stone-500 font-sans mt-0.5">
                        * Nota: Anda boleh memasukkan lebih daripada satu pautan sumber kandungan (RSS Feed atau URL) dengan memisahkannya menggunakan koma (,), jarak (space), atau baris baru.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Arahan Khusus Penjanaan (Prompt Teks)</label>
                      <textarea
                        value={formConfig.promptText}
                        onChange={(e) => setFormConfig({ ...formConfig, promptText: e.target.value })}
                        placeholder={editingSlotIndex === -1 ? "Contoh: Fokus kepada kandungan terkini Malaysia, saringan kesihatan, ekonomi..." : isEditingBarSlot ? "Contoh: Cari dan jana program ilmiah, seminar, atau pesta buku di Selangor." : "Contoh: Fokus kepada kandungan geopolitik Asia Tenggara..."}
                        rows={4}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Allowed Content Types</label>
                      {editingSlotIndex === -1 ? (
                        <input
                          type="text"
                          readOnly
                          value="Ticker"
                          className="w-full px-3 py-2 border border-stone-200 rounded bg-stone-50 text-stone-500 font-mono text-xs cursor-not-allowed font-semibold"
                        />
                      ) : isEditingBarSlot ? (
                        <input
                          type="text"
                          readOnly
                          value="Event"
                          className="w-full px-3 py-2 border border-stone-200 rounded bg-stone-50 text-stone-500 font-mono text-xs cursor-not-allowed font-semibold"
                        />
                      ) : (
                        <input
                          type="text"
                          value={formConfig.allowedContentTypes}
                          onChange={(e) => setFormConfig({ ...formConfig, allowedContentTypes: e.target.value })}
                          placeholder="Brief, Essay, dll."
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                        />
                      )}
                    </div>

                    {isEditingBarSlot && (
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Had Tempoh Masa Acara</label>
                        <select
                          value={formConfig.eventExpiryFilter || ''}
                          onChange={(e) => setFormConfig({ ...formConfig, eventExpiryFilter: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                        >
                          <option value="">Tiada Had (Semua Acara)</option>
                          <option value="Seminggu Sebelum Tamat">Seminggu Sebelum Tamat</option>
                          <option value="Sebulan Sebelum Tamat">Sebulan Sebelum Tamat</option>
                        </select>
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kadar Segar Semula (refreshRate)</label>
                      <select
                        value={formConfig.refreshRate}
                        onChange={(e) => {
                          const newRate = e.target.value;
                          setFormConfig({ 
                            ...formConfig, 
                            refreshRate: newRate,
                            refreshHour: formConfig.refreshHour || '00:00',
                            refreshDay: formConfig.refreshDay || 'Isnin'
                          });
                        }}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                      >
                        <option value="Daily">Setiap Hari (Daily)</option>
                        <option value="Weekly">Setiap Minggu (Weekly)</option>
                      </select>
                    </div>

                    {formConfig.refreshRate === 'Daily' && (
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pilih Waktu/Jam</label>
                        <select
                          value={formConfig.refreshHour || '00:00'}
                          onChange={(e) => setFormConfig({ ...formConfig, refreshHour: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                        >
                          {Array.from({ length: 24 }).map((_, h) => {
                            const hh = h.toString().padStart(2, '0') + ':00';
                            return <option key={hh} value={hh}>{hh}</option>;
                          })}
                        </select>
                      </div>
                    )}

                    {formConfig.refreshRate === 'Weekly' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pilih Hari</label>
                          <select
                            value={formConfig.refreshDay || 'Isnin'}
                            onChange={(e) => setFormConfig({ ...formConfig, refreshDay: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                          >
                            {['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'].map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pilih Waktu/Jam</label>
                          <select
                            value={formConfig.refreshHour || '00:00'}
                            onChange={(e) => setFormConfig({ ...formConfig, refreshHour: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                          >
                            {Array.from({ length: 24 }).map((_, h) => {
                              const hh = h.toString().padStart(2, '0') + ':00';
                              return <option key={hh} value={hh}>{hh}</option>;
                            })}
                          </select>
                        </div>
                      </>
                    )}

                    <div className="flex flex-col gap-1 col-span-2 mt-2 p-3 bg-stone-50 border border-stone-200 rounded">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Tindakan Segera (Trigger AI)</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleRunSlotNow}
                          disabled={isExecutingNow}
                          className={`px-4 py-2 text-xs font-bold text-white rounded transition-colors ${
                            isExecutingNow ? 'bg-stone-400 cursor-not-allowed' : 'bg-[#802334] hover:bg-[#601824]'
                          }`}
                        >
                          {isExecutingNow ? 'Menjalankan Penjanaan AI...' : 'Aktifkan Segera'}
                        </button>
                        {executingSuccessMessage && (
                          <span className="text-[11px] text-green-600 font-sans font-semibold animate-pulse inline-flex items-center gap-1">
                            <Check className="w-3 h-3" /> {executingSuccessMessage}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-stone-500 font-sans mt-1">
                        Butang ini akan mencetuskan penjanaan AI serta-merta untuk slot ini secara manual. Jadual automasi seterusnya akan tetap mengikut waktu yang ditetapkan di atas.
                      </p>
                    </div>

                    {editingSlotIndex === -1 ? (
                      <div className="flex flex-col gap-1 col-span-2">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Jumlah Kandungan Ticker (Ticker Content Limit)</label>
                        <select
                          value={formConfig.generationLimit || 5}
                          onChange={(e) => setFormConfig({ ...formConfig, generationLimit: parseInt(e.target.value) || 5 })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                        >
                          <option value={3}>3 Kandungan</option>
                          <option value={5}>5 Kandungan</option>
                          <option value={8}>8 Kandungan</option>
                          <option value={10}>10 Kandungan</option>
                          <option value={15}>15 Kandungan</option>
                        </select>
                        <p className="text-[9px] text-stone-500 font-sans mt-0.5">
                          Tentukan bilangan baris kandungan terkini Malaysia yang ingin dimasukkan ke dalam Ticker.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 col-span-2">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Jumlah Kandungan Carousel AI (AI Generation Limit)</label>
                        <select
                          value={formConfig.generationLimit || 1}
                          onChange={(e) => setFormConfig({ ...formConfig, generationLimit: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                        >
                          <option value={1}>1 Kandungan (Statik)</option>
                          <option value={2}>2 Kandungan Carousel</option>
                          <option value={3}>3 Kandungan Carousel</option>
                          <option value={4}>4 Kandungan Carousel</option>
                          <option value={5}>5 Kandungan Carousel</option>
                        </select>
                        <p className="text-[9px] text-stone-500 font-sans mt-0.5">
                          Tentukan had maksima kandungan sejarah penjanaan AI terkini yang akan dipaparkan secara berganti-ganti (carousel).
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 col-span-2 mt-4 p-4 bg-stone-50 border border-stone-200 rounded">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-[#802334] font-bold">Sejarah Penjanaan AI (AI Generation History)</label>
                      {aiLogs.length === 0 ? (
                        <p className="text-[10px] text-stone-500 font-sans italic">Tiada rekod log penjanaan AI ditemui untuk slot ini.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-sans text-[11px] border-collapse">
                            <thead>
                              <tr className="border-b border-stone-300 text-stone-500 uppercase font-bold text-[9px] tracking-wider">
                                <th className="pb-2">Tarikh / Waktu</th>
                                <th className="pb-2">Status</th>
                                <th className="pb-2">Model</th>
                                <th className="pb-2 text-right">Kos (USD)</th>
                                <th className="pb-2 text-center">Payload</th>
                              </tr>
                            </thead>
                            <tbody>
                              {aiLogs.map((log) => {
                                const costStr = typeof log.estimatedCost === 'number' ? `$${log.estimatedCost.toFixed(5)}` : '$0.00000';
                                const timeStr = new Date(log.createdAt).toLocaleString('ms-MY', { hour12: false });
                                return (
                                  <tr key={log.id} className="border-b border-stone-200 hover:bg-stone-100 transition-colors">
                                    <td className="py-2 text-stone-600 font-mono text-[10px]">{timeStr}</td>
                                    <td className="py-2">
                                      <span className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold uppercase ${
                                        log.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {log.status}
                                      </span>
                                    </td>
                                    <td className="py-2 text-stone-600 font-mono text-[10px]">{log.modelName}</td>
                                    <td className="py-2 text-right text-stone-600 font-mono text-[10px]">{costStr}</td>
                                    <td className="py-2 text-center">
                                      <div className="flex justify-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setActiveLogPayload({ type: 'prompt', content: log.promptText || 'Tiada prompt direkodkan.' })}
                                          className="px-2 py-1 text-[9px] font-bold text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors cursor-pointer"
                                        >
                                          Prompt
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setActiveLogPayload({ type: 'response', content: log.responseText || 'Tiada respons direkodkan.' })}
                                          className="px-2 py-1 text-[9px] font-bold text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors cursor-pointer"
                                        >
                                          Respons
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {formConfig.contentMode === 'AI Generated' && renderTetapanSlot()}

              </div>
              
              <div className="flex justify-between items-center gap-2 mt-4 pt-4 border-t border-stone-150">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowResetMenu(prev => !prev)}
                    className="px-3 py-2 bg-white hover:bg-stone-50 text-stone-600 border border-stone-300 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw size={12} /> Reset
                  </button>
                  {showResetMenu && (
                    <>
                      <div className="fixed inset-0 z-[1]" onClick={() => setShowResetMenu(false)} />
                      <div className="absolute bottom-full left-0 mb-1 z-[2] w-56 bg-white border border-stone-200 rounded shadow-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={handleResetAll}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer border-b border-stone-100"
                        >
                          Reset Semua
                        </button>
                        <button
                          type="button"
                          onClick={handleResetAI}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer border-b border-stone-100"
                        >
                          Reset Tetapan Penjanaan AI Sahaja
                        </button>
                        <button
                          type="button"
                          onClick={handleResetManual}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                        >
                          Reset Kandungan Manual Sahaja
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSlotIndex(null);
                      setFormConfig(null);
                      setShowResetMenu(false);
                    }}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs font-semibold cursor-pointer transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSlot}
                    className="px-5 py-2 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold cursor-pointer shadow-sm transition-all disabled:opacity-50"
                  >
                    {isSavingSlot ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Modal untuk Melihat Prompt / Respons AI (AI Payload Auditor) */}
      {activeLogPayload && (
        <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-lg border border-stone-250 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in">
            <header className="px-5 py-3 border-b border-stone-150 flex justify-between items-center bg-stone-50">
              <h4 className="font-mono text-xs font-bold text-[#802334] uppercase tracking-wider">
                Paparan {activeLogPayload.type === 'prompt' ? 'Prompt API' : 'Respons Mentah API'}
              </h4>
              <button
                type="button"
                onClick={() => setActiveLogPayload(null)}
                className="text-stone-400 hover:text-stone-600 font-bold font-sans text-xs cursor-pointer"
              >
                Tutup
              </button>
            </header>
            <div className="p-5 overflow-y-auto flex-1 font-mono text-[11px] leading-relaxed bg-stone-900 text-stone-100 select-text whitespace-pre-wrap">
              {activeLogPayload.content}
            </div>
            <footer className="px-5 py-3 border-t border-stone-150 flex justify-between items-center bg-stone-50">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeLogPayload.content);
                  alert('Kandungan disalin ke papan klip!');
                }}
                className="px-3 py-1.5 text-[10px] font-bold text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Salin Kandungan
              </button>
              <button
                type="button"
                onClick={() => setActiveLogPayload(null)}
                className="px-3 py-1.5 text-[10px] font-bold text-white bg-stone-700 rounded hover:bg-stone-850 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Pop-up Modal Halaman Footer (Tentang/Sidang Ed/dll) */}
      {activeFooterPageKey && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#FDFDFD] rounded-lg border border-stone-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl animate-fade-in">
            <header className="px-6 py-5 border-b border-stone-200 flex justify-between items-center bg-stone-50/50">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#8E8B82] font-bold">
                  {['editors-notes', 'notices', 'publishing-policies', 'version-history'].includes(activeFooterPageKey) ? 'Institusi' : 'Adjung'}
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#802334] tracking-tight mt-0.5">
                  {isEditingFooterPage ? 'Sunting Halaman' : (footerPageData?.title || 'Kandungan')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveFooterPageKey(null);
                  setFooterPageData(null);
                  setIsEditingFooterPage(false);
                }}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </header>

            {isEditingFooterPage ? (
              <form onSubmit={handleSaveFooterPage} className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Tajuk Halaman</label>
                  <input
                    type="text"
                    value={footerFormTitle}
                    onChange={(e) => setFooterFormTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kandungan (Teks / Markdown)</label>
                  <textarea
                    value={footerFormContent}
                    onChange={(e) => setFooterFormContent(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs leading-relaxed"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-stone-150">
                  <button
                    type="button"
                    onClick={() => setIsEditingFooterPage(false)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingFooterPage}
                    className="px-5 py-2 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingFooterPage ? 'Menyimpan...' : 'Simpan Kandungan'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 flex flex-col justify-between flex-grow">
                <div className="font-serif text-sm leading-relaxed text-stone-700 whitespace-pre-wrap flex-grow">
                  {footerPageData?.content ? (
                    footerPageData.content.split('\n\n').map((paragraph: string, idx: number) => {
                      if (paragraph.trim().startsWith('*') || paragraph.trim().startsWith('-')) {
                        const items = paragraph.split('\n').map((li: string) => li.replace(/^[\*\-]\s+/, '').trim());
                        return (
                          <ul key={idx} className="list-disc pl-5 my-3 flex flex-col gap-1.5">
                            {items.map((item: string, liIdx: number) => {
                              const parts = item.split(/\*\*([^*]+)\*\*/g);
                              return (
                                <li key={liIdx}>
                                  {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-[#802334] font-bold">{part}</strong> : part)}
                                </li>
                              );
                            })}
                          </ul>
                        );
                      }
                      
                      const parts = paragraph.split(/\*\*([^*]+)\*\*/g);
                      return (
                        <p key={idx} className="mb-4">
                          {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-[#802334] font-bold">{part}</strong> : part)}
                        </p>
                      );
                    })
                  ) : (
                    <div className="py-10 text-center text-stone-400 font-sans text-xs animate-pulse">
                      Memuatkan kandungan...
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-stone-150">
                  <span className="font-sans text-[9px] text-stone-400">
                    {footerPageData?.updatedAt && `Kemas Kini Terakhir: ${new Date(footerPageData.updatedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                  </span>
                  <div className="flex gap-2">
                    {isEditMode && footerPageData && (
                      <button
                        type="button"
                        onClick={() => setIsEditingFooterPage(true)}
                        className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-50 rounded text-xs font-semibold cursor-pointer"
                      >
                        Sunting Halaman
                      </button>
                    )}
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
      {showNewsOverlay && overlayItem && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-2xl transition-all duration-300 animate-fade-in p-6 select-none"
          onClick={() => setShowNewsOverlay(false)}
        >
          {/* Top Centered Logo */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 font-serif text-lg font-semibold tracking-wider text-[#802334] select-none">
            {BRAND.logoText}
          </div>

          {/* Top Right Instructions */}
          <div className="absolute top-6 right-6 font-mono text-[8px] uppercase tracking-widest text-stone-400 select-none">
            ESC atau Klik untuk Tutup
          </div>

          {/* Left Arrow */}
          {parsedTickerNewsItems.length > 1 && (
            <Tooltip text="Berita Sebelum (Anak Panah Kiri)">
              <button
                type="button"
                onClick={handlePrevNewsItem}
                className="absolute left-6 top-1/2 -translate-y-1/2 p-3 text-stone-400 hover:text-[#802334] transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            </Tooltip>
          )}

          {/* Right Arrow */}
          {parsedTickerNewsItems.length > 1 && (
            <Tooltip text="Berita Seterusnya (Anak Panah Kanan)">
              <button
                type="button"
                onClick={handleNextNewsItem}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-3 text-stone-400 hover:text-[#802334] transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </Tooltip>
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
                <h1 className="font-serif text-3xl md:text-5xl text-stone-900 leading-tight tracking-tight font-medium px-4">
                  {overlayItem.title}
                </h1>

                {/* Brief body */}
                {overlayItem.brief && (
                  <p className="font-serif text-lg md:text-xl text-stone-600 leading-relaxed max-w-xl mx-auto px-4 font-light">
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
        <Tooltip text="Kembali Ke Atas">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-40 p-3 bg-[#802334] text-white rounded-full shadow-xl hover:bg-[#601824] transition-all duration-300 flex items-center justify-center group"
            aria-label="Kembali Ke Atas"
          >
            <ChevronLeft className="w-5 h-5 rotate-90 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </Tooltip>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
