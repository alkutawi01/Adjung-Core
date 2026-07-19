import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Entry, SystemSettings } from '../../types';
import { BRAND } from '../../config/brand';
import { parseInlineFormatting, isArabicText, parseInTheNews, getDeskAccentColor, parseWorldClockHolidays } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Info, ChevronLeft, ChevronRight, X, RotateCcw, Check, AlertCircle } from 'lucide-react';

interface ClockTime {
  timeStr: string;
  isHoliday: boolean;
  holidayName: string;
  isWeekend: boolean;
}

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
    '08/31': "National Day (Merdeka)",
    '09/16': "Malaysia Day",
    '09/25': "Maulidur Rasul",
    '11/08': "Deepavali",
    '12/25': "Christmas Day"
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
        const isMaroon = className?.includes('text-adjung-maroon') || className?.includes('text-[#7B2737]') || className?.includes('text-[#802334]');
        const hoverClass = isMaroon 
          ? 'hover:text-stone-900 transition-colors duration-150 cursor-default' 
          : 'hover:text-adjung-maroon transition-colors duration-150 cursor-default';
        return (
          <span key={idx} className={hoverClass}>
            {w}
          </span>
        );
      })}
    </span>
  );
}

const BentoInner: React.FC<{ itemKey: string; className?: string; aiProvider?: string; children: React.ReactNode }> = ({ itemKey, className = '', aiProvider, children }) => {
  let providerName = aiProvider;
  if (providerName) {
    if (providerName.startsWith('Google ')) providerName = providerName.replace('Google ', '');
    if (providerName.includes(' (')) providerName = providerName.split(' (')[0];
  }
  return (
    <div key={itemKey} className={`animate-bento-fade-in w-full h-full flex flex-col justify-between relative ${className}`}>
      {children}
      {providerName && (
        <span className="absolute bottom-0 right-0 font-mono text-[8px] opacity-40 pointer-events-none select-none">
          {providerName}
        </span>
      )}
    </div>
  );
};



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
      color: finalIsDark ? '#E9D8A6' : '#802334'
    },
    titleStyle: {
      color: finalTextColor
    },
    briefStyle: {
      color: finalIsDark ? 'rgba(253, 253, 253, 0.95)' : '#57534e'
    },
    sourceStyle: {
      color: finalIsDark ? '#d6d3d1' : '#78716c',
      borderColor: finalIsDark ? 'rgba(253, 253, 253, 0.2)' : '#e7e5e4'
    }
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
  // 1. World Clock State
  const [times, setTimes] = useState<(ClockTime | null)[]>([null, null, null, null, null]);

  // In The News digest overlay state
  const [showNewsOverlay, setShowNewsOverlay] = useState(false);
  const [activeOverlayIndex, setActiveOverlayIndex] = useState(0);
  const [activeFrontpageIndex, setActiveFrontpageIndex] = useState(0);



  const [parsedNewsItems, setParsedNewsItems] = useState<any[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<'ms' | 'zh' | 'ar' | 'en'>('ms');
  const [enabledLanguages, setEnabledLanguages] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/translation/configs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEnabledLanguages(data.filter((d: any) => d.isEnabled === 1));
        }
      })
      .catch(err => console.error('Failed to load enabled languages:', err));
  }, []);

  useEffect(() => {
    fetch(`/api/system/layout/active?lang=${activeLanguage}&t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        setParsedNewsItems(data);
      })
      .catch(err => console.error('Failed to load active bento layout:', err));
  }, [systemSettings.inTheNewsText, activeLanguage]);

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
    const fallbacks = [
      {
        desk: 'SLOT 0: LEBAR PENUH',
        title: 'Had Tajuk Slot Lebar Penuh: Boleh Memuatkan Sehingga 115 Aksara Serta Wrap Dua Baris Secara Kemas',
        brief: 'Kapasiti maksimum ringkasan slot lebar penuh ialah 240 aksara untuk memenuhkan 2 baris di desktop secara optimum. Had saiz ini mengekalkan reka letak bento kelihatan padat, seimbang, dan sangat profesional tanpa sebarang elipsis.',
        source: 'SLOT_0_LEBAR',
        url: '#',
        rawIndex: -1
      },
      {
        desk: 'SLOT 1: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_1_TEGAK',
        url: '#',
        rawIndex: -2
      },
      {
        desk: 'SLOT 2: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_2_LINTAS',
        url: '#',
        rawIndex: -3
      },
      {
        desk: 'SLOT 3: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_3_KOTAK',
        url: '#',
        rawIndex: -4
      },
      {
        desk: 'SLOT 4: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_4_KOMPAK',
        url: '#',
        rawIndex: -5
      },
      {
        desk: 'SLOT 5: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_5_KOMPAK',
        url: '#',
        rawIndex: -6
      },
      {
        desk: 'SLOT 6: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_6_LINTAS',
        url: '#',
        rawIndex: -7
      },
      {
        desk: 'BAR 7',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_7_BAR',
        url: '#',
        rawIndex: -8
      },
      {
        desk: 'BAR 8',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_8_BAR',
        url: '#',
        rawIndex: -9
      },
      {
        desk: 'BAR 9',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_9_BAR',
        url: '#',
        rawIndex: -10
      },
      {
        desk: 'BAR 10',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_10_BAR',
        url: '#',
        rawIndex: -11
      },
      {
        desk: 'SLOT 11: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_11_KOTAK',
        url: '#',
        rawIndex: -12
      },
      {
        desk: 'SLOT 12: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_12_TEGAK',
        url: '#',
        rawIndex: -13
      },
      {
        desk: 'SLOT 13: SEPARUH',
        title: 'Had Tajuk Separuh Melintang: Maksimum 85 Aksara',
        brief: 'Had ringkasan kad separuh melintang ialah 110 aksara untuk dua baris penuh tanpa elipsis.',
        source: 'SLOT_13_HALF',
        url: '#',
        rawIndex: -14
      },
      {
        desk: 'SLOT 14: SEPARUH',
        title: 'Had Tajuk Separuh Melintang: Maksimum 85 Aksara',
        brief: 'Had ringkasan kad separuh melintang ialah 110 aksara untuk dua baris penuh tanpa elipsis.',
        source: 'SLOT_14_HALF',
        url: '#',
        rawIndex: -15
      },
      {
        desk: 'SLOT 15: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_15_TEGAK',
        url: '#',
        rawIndex: -16
      },
      {
        desk: 'SLOT 16: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_16_KOTAK',
        url: '#',
        rawIndex: -17
      },
      {
        desk: 'SLOT 17: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_17_KOMPAK',
        url: '#',
        rawIndex: -18
      },
      {
        desk: 'SLOT 18: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_18_KOMPAK',
        url: '#',
        rawIndex: -19
      },
      {
        desk: 'SLOT 19: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_19_LINTAS',
        url: '#',
        rawIndex: -20
      },
      {
        desk: 'SLOT 20: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_20_LINTAS',
        url: '#',
        rawIndex: -21
      },
      {
        desk: 'BAR 21',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_21_BAR',
        url: '#',
        rawIndex: -22
      },
      {
        desk: 'BAR 22',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_22_BAR',
        url: '#',
        rawIndex: -23
      },
      {
        desk: 'BAR 23',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_23_BAR',
        url: '#',
        rawIndex: -24
      },
      {
        desk: 'BAR 24',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_24_BAR',
        url: '#',
        rawIndex: -25
      },
      {
        desk: 'SLOT 25: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_25_KOTAK',
        url: '#',
        rawIndex: -26
      },
      {
        desk: 'SLOT 26: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_26_TEGAK',
        url: '#',
        rawIndex: -27
      },
      {
        desk: 'SLOT 27: SEPARUH',
        title: 'Had Tajuk Separuh Melintang: Maksimum 85 Aksara',
        brief: 'Had ringkasan kad separuh melintang ialah 110 aksara untuk dua baris penuh tanpa elipsis.',
        source: 'SLOT_27_HALF',
        url: '#',
        rawIndex: -28
      },
      {
        desk: 'SLOT 28: SEPARUH',
        title: 'Had Tajuk Separuh Melintang: Maksimum 85 Aksara',
        brief: 'Had ringkasan kad separuh melintang ialah 110 aksara untuk dua baris penuh tanpa elipsis.',
        source: 'SLOT_28_HALF',
        url: '#',
        rawIndex: -29
      },
      {
        desk: 'SLOT 29: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_29_TEGAK',
        url: '#',
        rawIndex: -30
      },
      {
        desk: 'SLOT 30: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_30_KOTAK',
        url: '#',
        rawIndex: -31
      },
      {
        desk: 'SLOT 31: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_31_KOMPAK',
        url: '#',
        rawIndex: -32
      },
      {
        desk: 'SLOT 32: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_32_KOMPAK',
        url: '#',
        rawIndex: -33
      },
      {
        desk: 'SLOT 33: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_33_LINTAS',
        url: '#',
        rawIndex: -34
      },
      {
        desk: 'SLOT 34: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_34_LINTAS',
        url: '#',
        rawIndex: -35
      },
      {
        desk: 'SLOT 35: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_35_KOTAK',
        url: '#',
        rawIndex: -36
      },
      {
        desk: 'SLOT 36: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_36_KOTAK',
        url: '#',
        rawIndex: -37
      },
      {
        desk: 'SLOT 37: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_37_TEGAK',
        url: '#',
        rawIndex: -38
      }
    ];

    BENTO_FALLBACKS = fallbacks;

    const result: any[] = [];
    for (let i = 0; i < 38; i++) {
      const customItem = list.find(item => item.rawIndex === i + 1);
      const fallbackItem = { ...fallbacks[i] };
      
      if (fallbackItem.desk) {
        fallbackItem.desk = fallbackItem.desk
          .replace(/SLOT (\d+)/g, (match, p1) => `SLOT ${parseInt(p1) + 1}`)
          .replace(/BAR (\d+)/g, (match, p1) => `BAR ${parseInt(p1) + 1}`);
      }

      if (customItem) {
        let finalDesk = customItem.desk || '';
        if (!finalDesk || finalDesk.trim().startsWith('SLOT ') || finalDesk.trim().startsWith('BAR ')) {
          finalDesk = 'Berita';
        }
        result.push({
          ...customItem,
          desk: finalDesk,
          brief: customItem.brief !== undefined ? customItem.brief : fallbackItem.brief,
          source: customItem.source || fallbackItem.source,
          url: customItem.url || fallbackItem.url || '#',
          rawIndex: customItem.rawIndex !== undefined ? customItem.rawIndex : fallbackItem.rawIndex
        });
      } else {
        result.push(fallbackItem);
      }
    }

    return result;
  }, [parsedNewsItems]);

  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const bentoNewsItems = React.useMemo(() => {
    return rawBentoNewsItems.map((item, idx) => {
      if (!item || !item.titleB) return item;
      const offset = item.offset || 0;
      // Kitaran pertukaran setiap 10 saat, dianjakkan oleh offset
      const isShowingB = Math.floor((currentTimeSeconds + offset) / 10) % 2 === 1;
      if (isShowingB) {
        return {
          ...item,
          desk: item.deskB || item.desk,
          title: item.titleB,
          brief: item.briefB || '',
          source: item.sourceB || '',
          url: item.urlB || '#',
          isNewsB: true
        };
      }
      return {
        ...item,
        isNewsB: false
      };
    });
  }, [rawBentoNewsItems, currentTimeSeconds]);



  const activeNewsItem = bentoNewsItems[activeFrontpageIndex % bentoNewsItems.length];
  const overlayItem = bentoNewsItems[activeOverlayIndex % bentoNewsItems.length];

  // Frontpage news preview rotation (10 seconds)
  useEffect(() => {
    if (bentoNewsItems.length <= 1) return;
    const interval = setInterval(() => {
      setActiveFrontpageIndex((prev) => (prev + 1) % bentoNewsItems.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [bentoNewsItems.length]);

  // Fullscreen overlay news rotation (10 seconds)
  useEffect(() => {
    if (!showNewsOverlay || bentoNewsItems.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveOverlayIndex((prev) => (prev + 1) % bentoNewsItems.length);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [showNewsOverlay, bentoNewsItems.length]);

  useEffect(() => {
    if (!showNewsOverlay) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewsOverlay(false);
      } else if (e.key === 'ArrowRight' && bentoNewsItems.length > 1) {
        setActiveOverlayIndex((prev) => (prev + 1) % bentoNewsItems.length);
      } else if (e.key === 'ArrowLeft' && bentoNewsItems.length > 1) {
        setActiveOverlayIndex((prev) => (prev - 1 + bentoNewsItems.length) % bentoNewsItems.length);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewsOverlay, bentoNewsItems.length]);

  const handleNextNewsItem = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (bentoNewsItems.length <= 1) return;
    setActiveOverlayIndex((prev) => (prev + 1) % bentoNewsItems.length);
  };

  const handlePrevNewsItem = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (bentoNewsItems.length <= 1) return;
    setActiveOverlayIndex((prev) => (prev - 1 + bentoNewsItems.length) % bentoNewsItems.length);
  };

  useEffect(() => {
    const cities = [
      { name: 'New York', tz: 'America/New_York' },
      { name: 'London', tz: 'Europe/London' },
      { name: 'Mecca', tz: 'Asia/Riyadh' }, // Mecca is in Riyadh timezone (UTC+3)
      { name: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur' },
      { name: 'Tokyo', tz: 'Asia/Tokyo' }
    ];

    const updateTime = () => {
      const newTimes = cities.map(c => {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: c.tz,
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          const parts = formatter.formatToParts(new Date());
          const obj: any = {};
          parts.forEach(p => { obj[p.type] = p.value; });

          let dateStr = `${obj.day}/${obj.month}/${obj.year}`;
          if (c.name === 'New York') {
            dateStr = `${obj.month}/${obj.day}/${obj.year}`;
          } else if (c.name === 'Tokyo') {
            dateStr = `${obj.year}/${obj.month}/${obj.day}`;
          } else if (c.name === 'Mecca') {
            try {
              const hijriFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
                timeZone: c.tz,
                year: '2-digit',
                month: '2-digit',
                day: '2-digit'
              });
              const hParts = hijriFormatter.formatToParts(new Date());
              const hObj: any = {};
              hParts.forEach(p => { hObj[p.type] = p.value; });
              dateStr = `${hObj.day}/${hObj.month}/${hObj.year}`;
            } catch (err) {
              console.error(err);
            }
          }

          // Parse custom holidays
          const { items: customHolidaysText } = parseWorldClockHolidays(systemSettings.worldClockHolidaysText || '');
          const { items: customHolidaysGoogle } = parseWorldClockHolidays(worldClockHolidaysGoogleDocText || '');
          const allCustomHolidays = [...customHolidaysText, ...customHolidaysGoogle];

          // Find match for this city and dateStr
          const customMatch = allCustomHolidays.find(h => 
            h.city.toLowerCase() === c.name.toLowerCase() && 
            h.dateStr === dateStr
          );

          let isHoliday = false;
          let holidayName = '';
          let isWeekend = false;

          const day = obj.weekday.toUpperCase();

          if (customMatch) {
            if (customMatch.status === 'Holiday') {
              isHoliday = true;
              holidayName = customMatch.holidayName || 'Public Holiday';
              isWeekend = c.name === 'Mecca'
                ? (day === 'FRI' || day === 'SAT')
                : (day === 'SAT' || day === 'SUN');
            } else if (customMatch.status === 'Weekend') {
              isWeekend = true;
            } else if (customMatch.status === 'Working') {
              isWeekend = false;
              isHoliday = false;
            }
          } else {
            // Default pre-seeded logic
            const gregKey = `${obj.month}/${obj.day}`;
            const cityHolidays = HOLIDAYS_2026[c.name] || {};
            holidayName = cityHolidays[gregKey] || '';
            isHoliday = !!holidayName;

            isWeekend = c.name === 'Mecca'
              ? (day === 'FRI' || day === 'SAT')
              : (day === 'SAT' || day === 'SUN');
          }

          const timeStr = `${dateStr} · ${day} · ${obj.hour}:${obj.minute}`;

          return {
            timeStr,
            isHoliday,
            holidayName,
            isWeekend
          };
        } catch (e) {
          return null;
        }
      });
      setTimes(newTimes);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [systemSettings.worldClockHolidaysText, worldClockHolidaysGoogleDocText]);

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

  return (
    <div className="bg-transparent text-[#1F1F1F] font-serif w-full min-h-screen px-4 md:px-8 py-12 select-none animate-fade-in">

      <div className="max-w-5xl mx-auto">
        
        {/* Wordmark Hero */}
        <section className="text-center pt-8 pb-6 animate-fade-in">
          <motion.h1 
            animate={{
              color: ['#1F1F1F', '#802334', '#1F1F1F']
            }}
            transition={{
              duration: 15,
              ease: 'easeInOut',
              repeat: Infinity
            }}
            className="font-serif font-light tracking-tight text-6xl md:text-7xl"
          >
            <HoverWords text={BRAND.logoText} />
          </motion.h1>
          <p className="font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#555555] mt-3">
            <HoverWords text={BRAND.tagline} />
          </p>
        </section>

        <hr className="rule border-t border-stone-300 my-3" />

        {/* World Clock Strip */}
        <div className="py-2.5 flex justify-center items-center overflow-x-auto gap-10 px-1 text-center" id="world-clock">
          {[
            { city: 'New York', tz: 'America/New_York' },
            { city: 'London', tz: 'Europe/London' },
            { city: 'Mecca', tz: 'Asia/Riyadh' },
            { city: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur' },
            { city: 'Tokyo', tz: 'Asia/Tokyo' }
          ].map((c, i) => {
            const timeData = times[i];
            let cityColor = 'text-[#555555]';
            let isHoliday = false;
            let isWeekend = false;
            let holidayName = '';

            if (timeData) {
              isHoliday = timeData.isHoliday;
              isWeekend = timeData.isWeekend;
              holidayName = timeData.holidayName;

              if (isHoliday) {
                cityColor = 'text-[#1F1F1F] font-bold border-b border-dashed border-[#1F1F1F]/40';
              } else if (isWeekend) {
                cityColor = 'text-stone-400 font-light';
              } else {
                cityColor = 'text-[#7B2737] font-semibold';
              }
            }

            return (
              <div key={c.city} className="flex-shrink-0 group relative">
                <p className={`font-sans text-[9px] tracking-editorial uppercase mb-0.5 inline-block select-none transition-colors duration-200 ${cityColor} ${isHoliday ? 'cursor-help' : ''}`}>
                  {c.city}
                </p>
                {isHoliday && holidayName && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#1F1F1F] text-[#FDFDFD] text-[9px] font-sans py-1 px-2.5 rounded shadow-lg whitespace-nowrap z-50 animate-fade-in pointer-events-none tracking-normal">
                    {holidayName}
                  </div>
                )}
                <p className="font-serif text-xs md:text-sm text-[#1F1F1F] font-light min-w-[140px]">
                  {timeData ? timeData.timeStr : 'Loading...'}
                </p>
              </div>
            );
          })}
        </div>

        <hr className="rule border-t border-stone-300 my-3" />

        {/* Bento Grid News Layout */}
        <section className="my-8" id="bento-news-grid">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <h2 className="font-serif font-semibold text-lg md:text-xl tracking-wide text-[#802334] uppercase">
                In The News
              </h2>
              <Link
                to="/settings"
                className="flex items-center gap-1.5 px-3 py-1 bg-[#802334]/5 hover:bg-[#802334]/10 border border-[#802334]/20 hover:border-[#802334]/30 text-[#802334] rounded text-[10px] md:text-xs font-serif font-medium tracking-wide uppercase transition-all"
                title="Manage all 37 slots"
              >
                <Settings size={12} />
                <span>Urus 37 Slot</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {enabledLanguages.length > 0 && (
                <div className="flex items-center gap-1 bg-stone-100 p-0.5 border border-stone-200 rounded text-xs select-none">
                  <button
                    onClick={() => setActiveLanguage('ms')}
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
                      onClick={() => setActiveLanguage(lang.languageCode)}
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
              <div className="font-mono text-[9px] uppercase tracking-widest text-stone-400">
                {bentoNewsItems.length} curated briefs
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            
            {/* ROW 1: Full horizontal (Index 0) */}
            {bentoNewsItems[0] && (
              <div 
                className="col-span-1 md:col-span-6 p-6 md:p-8 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => { setActiveOverlayIndex(0); setShowNewsOverlay(true); }}
               style={getCardTheme(bentoNewsItems[0], 'transparent').cardStyle} >
                <BentoInner itemKey={bentoNewsItems[0].title} className="md:flex-row md:items-center justify-between gap-6" aiProvider={bentoNewsItems[0].aiProvider}>
                  <div className="space-y-2 max-w-3xl">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[0]).deskStyle}>{bentoNewsItems[0].desk}
                    </div>
                    <h3 className="font-serif text-2xl md:text-3xl leading-tight font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[0].title}
                    </h3>
                    <p className="font-serif text-sm md:text-base text-stone-100/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[0]).briefStyle}>{bentoNewsItems[0].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[10px] tracking-editorial uppercase text-stone-300 border-l border-stone-400/30 pl-4 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[0]).sourceStyle}>{bentoNewsItems[0].source}
                  </div>
                </BentoInner>
              </div>
            )}

            {/* ROW 2 & 3: Vertical, Horizontal, Square, 2 Compact (Indices 1 to 5) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Column: Vertical (Index 1) */}
              {bentoNewsItems[1] && (
                <div 
                  className="md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full"
                  onClick={() => { setActiveOverlayIndex(1); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[1], 'transparent').cardStyle} >
                  <BentoInner itemKey={bentoNewsItems[1].title} aiProvider={bentoNewsItems[1].aiProvider}>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[1]).deskStyle}>{bentoNewsItems[1].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[1].title}
                      </h3>
                    </div>
                    <div>
                      <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light mb-4 " style={getCardTheme(bentoNewsItems[1]).briefStyle}>{bentoNewsItems[1].brief}
                      </p>
                      <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[1]).sourceStyle}>{bentoNewsItems[1].source}
                      </div>
                    </div>
                  </BentoInner>
                </div>
              )}

              {/* Right/Top: Horizontal (Index 2) */}
              {bentoNewsItems[2] && (
                <div 
                  className="md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(2); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[2], 'transparent').cardStyle} >
                  <BentoInner itemKey={bentoNewsItems[2].title} className="md:flex-row md:items-center justify-between gap-4" aiProvider={bentoNewsItems[2].aiProvider}>
                    <div className="space-y-2 flex-1">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[2]).deskStyle}>{bentoNewsItems[2].desk}
                      </div>
                      <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                        {bentoNewsItems[2].title}
                      </h3>
                      <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[2]).briefStyle}>{bentoNewsItems[2].brief}
                      </p>
                    </div>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[2]).sourceStyle}>{bentoNewsItems[2].source}
                    </div>
                  </BentoInner>
                </div>
              )}

              {/* Right/Bottom-Left: Square (Index 3) */}
              {bentoNewsItems[3] && (
                <div 
                  className="md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full"
                  onClick={() => { setActiveOverlayIndex(3); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[3], 'transparent').cardStyle} >
                  <BentoInner itemKey={bentoNewsItems[3].title} aiProvider={bentoNewsItems[3].aiProvider}>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[3]).deskStyle}>{bentoNewsItems[3].desk}
                      </div>
                      <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                        {bentoNewsItems[3].title}
                      </h3>
                    </div>
                    <div>
                      <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[3]).briefStyle}>{bentoNewsItems[3].brief}
                      </p>
                      <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[3]).sourceStyle}>{bentoNewsItems[3].source}
                      </div>
                    </div>
                  </BentoInner>
                </div>
              )}

              {/* Right/Bottom-Right: Two Stacked Compacts (Indices 4 & 5) */}
              <div className="md:col-span-2 flex flex-col gap-4">
                {bentoNewsItems[4] && (
                  <div 
                    className="p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1"
                    onClick={() => { setActiveOverlayIndex(4); setShowNewsOverlay(true); }}
                   style={getCardTheme(bentoNewsItems[4], 'transparent').cardStyle} >
                    <BentoInner itemKey={bentoNewsItems[4].title} aiProvider={bentoNewsItems[4].aiProvider}>
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[4]).deskStyle}>{bentoNewsItems[4].desk}
                        </div>
                        <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                          {bentoNewsItems[4].title}
                        </h3>
                      </div>
                      <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[4]).sourceStyle}>{bentoNewsItems[4].source}
                      </div>
                    </BentoInner>
                  </div>
                )}
                {bentoNewsItems[5] && (
                  <div 
                    className="p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1"
                    onClick={() => { setActiveOverlayIndex(5); setShowNewsOverlay(true); }}
                   style={getCardTheme(bentoNewsItems[5], 'transparent').cardStyle} >
                    <BentoInner itemKey={bentoNewsItems[5].title} aiProvider={bentoNewsItems[5].aiProvider}>
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[5]).deskStyle}>{bentoNewsItems[5].desk}
                        </div>
                        <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                          {bentoNewsItems[5].title}
                        </h3>
                      </div>
                      <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[5]).sourceStyle}>{bentoNewsItems[5].source}
                      </div>
                    </BentoInner>
                  </div>
                )}
              </div>

            </div>

            {/* ROW 4 & 5: Horizontal, Vertical, Bars, Square (Indices 6 to 12) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 animate-fade-in">
              
              {/* Left Top: Horizontal (Index 6) */}
              {bentoNewsItems[6] && (
                <div 
                  className="md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(6); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[6], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[6]).deskStyle}>{bentoNewsItems[6].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[6].title}
                    </h3>
                    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[6]).briefStyle}>{bentoNewsItems[6].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[6]).sourceStyle}>{bentoNewsItems[6].source}
                  </div>
                
                  {bentoNewsItems[6].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[6].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Column: Vertical (Index 12) */}
              {bentoNewsItems[12] && (
                <div 
                  className="md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full"
                  onClick={() => { setActiveOverlayIndex(12); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[12], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[12]).deskStyle}>{bentoNewsItems[12].desk}
                    </div>
                    <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                      {bentoNewsItems[12].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light mb-4 " style={getCardTheme(bentoNewsItems[12]).briefStyle}>{bentoNewsItems[12].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[12]).sourceStyle}>{bentoNewsItems[12].source}
                    </div>
                  </div>
                
                  {bentoNewsItems[12].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[12].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Left Bottom Left: 4 Stacked Bars (Indices 7, 8, 9, 10) */}
              <div className="md:col-span-2 flex flex-col gap-2">
                {[7, 8, 9, 10].map((idx) => {
                  const barItem = bentoNewsItems[idx];
                  if (!barItem) return null;
                  return (
                    <div 
                      key={idx}
                      className="px-4 py-2.5 rounded-md shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex justify-between items-center min-h-[42px]"
                      onClick={() => { setActiveOverlayIndex(idx); setShowNewsOverlay(true); }}
                      style={getCardTheme(barItem, 'transparent').cardStyle}
                    >
                      <div className="font-serif text-xs leading-normal hover:text-stone-300 transition-colors  flex-1 pr-4">
                        {barItem.desk && <span className="font-mono text-[8px] uppercase tracking-wider text-amber-200 mr-2">[{barItem.desk}]</span>}
                        {barItem.title}
                      </div>
                      <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 flex-shrink-0">
                        {barItem.source}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Left Bottom Right: Square (Index 11) */}
              {bentoNewsItems[11] && (
                <div 
                  className="md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full"
                  onClick={() => { setActiveOverlayIndex(11); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[11], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[11]).deskStyle}>{bentoNewsItems[11].desk}
                    </div>
                    <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[11].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[11]).briefStyle}>{bentoNewsItems[11].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[11]).sourceStyle}>{bentoNewsItems[11].source}
                    </div>
                  </div>
                
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
                  className="col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(13); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[13], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[13]).deskStyle}>{bentoNewsItems[13].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors ">
                      {bentoNewsItems[13].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[13]).briefStyle}>{bentoNewsItems[13].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[13]).sourceStyle}>{bentoNewsItems[13].source}
                    </div>
                  </div>
                
                  {bentoNewsItems[13].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[13].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {bentoNewsItems[14] && (
                <div 
                  className="col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(14); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[14], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold" style={getCardTheme(bentoNewsItems[14]).deskStyle}>{bentoNewsItems[14].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[14].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[14]).briefStyle}>{bentoNewsItems[14].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[14]).sourceStyle}>{bentoNewsItems[14].source}
                    </div>
                  </div>
                
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
                  className="md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full"
                  onClick={() => { setActiveOverlayIndex(15); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[15], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[15]).deskStyle}>{bentoNewsItems[15].desk}
                    </div>
                    <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                      {bentoNewsItems[15].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light mb-4 " style={getCardTheme(bentoNewsItems[15]).briefStyle}>{bentoNewsItems[15].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[15]).sourceStyle}>{bentoNewsItems[15].source}
                    </div>
                  </div>
                
                  {bentoNewsItems[15].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[15].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Square (Index 16) */}
              {bentoNewsItems[16] && (
                <div 
                  className="md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full"
                  onClick={() => { setActiveOverlayIndex(16); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[16], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[16]).deskStyle}>{bentoNewsItems[16].desk}
                    </div>
                    <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[16].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[16]).briefStyle}>{bentoNewsItems[16].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[16]).sourceStyle}>{bentoNewsItems[16].source}
                    </div>
                  </div>
                
                  {bentoNewsItems[16].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[16].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Two Stacked Compacts (Indices 17 & 18) */}
              <div className="md:col-span-2 flex flex-col gap-4">
                {bentoNewsItems[17] && (
                  <div 
                    className="p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1"
                    onClick={() => { setActiveOverlayIndex(17); setShowNewsOverlay(true); }}
                   style={getCardTheme(bentoNewsItems[17], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[17]).deskStyle}>{bentoNewsItems[17].desk}
                      </div>
                      <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[17].title}
                      </h3>
                    </div>
                    <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[17]).sourceStyle}>{bentoNewsItems[17].source}
                    </div>
                  
                  {bentoNewsItems[17].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[17].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
                {bentoNewsItems[18] && (
                  <div 
                    className="p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1"
                    onClick={() => { setActiveOverlayIndex(18); setShowNewsOverlay(true); }}
                   style={getCardTheme(bentoNewsItems[18], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[18]).deskStyle}>{bentoNewsItems[18].desk}
                      </div>
                      <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[18].title}
                      </h3>
                    </div>
                    <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[18]).sourceStyle}>{bentoNewsItems[18].source}
                    </div>
                  
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
                  className="md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(19); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[19], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[19]).deskStyle}>{bentoNewsItems[19].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[19].title}
                    </h3>
                    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[19]).briefStyle}>{bentoNewsItems[19].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[19]).sourceStyle}>{bentoNewsItems[19].source}
                  </div>
                
                  {bentoNewsItems[19].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[19].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 9 & 10: Horizontal, 4 Stacked Bars, Square, Vertical (Indices 20 to 26) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Top: Horizontal spanning across Col 1-4 (Index 20) */}
              {bentoNewsItems[20] && (
                <div 
                  className="md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(20); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[20], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[20]).deskStyle}>{bentoNewsItems[20].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[20].title}
                    </h3>
                    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[20]).briefStyle}>{bentoNewsItems[20].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[20]).sourceStyle}>{bentoNewsItems[20].source}
                  </div>
                
                  {bentoNewsItems[20].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[20].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Column: Vertical (Index 26) */}
              {bentoNewsItems[26] && (
                <div 
                  className="md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full"
                  onClick={() => { setActiveOverlayIndex(26); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[26], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[26]).deskStyle}>{bentoNewsItems[26].desk}
                    </div>
                    <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                      {bentoNewsItems[26].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light mb-4 " style={getCardTheme(bentoNewsItems[26]).briefStyle}>{bentoNewsItems[26].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[26]).sourceStyle}>{bentoNewsItems[26].source}
                    </div>
                  </div>
                
                  {bentoNewsItems[26].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[26].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Left Bottom Left: 4 Stacked Bars (Indices 21, 22, 23, 24) */}
              <div className="md:col-span-2 flex flex-col gap-2">
                {[21, 22, 23, 24].map((idx) => {
                  const barItem = bentoNewsItems[idx];
                  if (!barItem) return null;
                  return (
                    <div 
                      key={idx}
                      className="px-4 py-2.5 rounded-md shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex justify-between items-center min-h-[42px]"
                      onClick={() => { setActiveOverlayIndex(idx); setShowNewsOverlay(true); }}
                      style={getCardTheme(barItem, 'transparent').cardStyle}
                    >
                      <div className="font-serif text-xs leading-normal hover:text-stone-300 transition-colors  flex-1 pr-4">
                        {barItem.desk && <span className="font-mono text-[8px] uppercase tracking-wider text-amber-200 mr-2">[{barItem.desk}]</span>}
                        {barItem.title}
                      </div>
                      <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 flex-shrink-0">
                        {barItem.source}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Left Bottom Right: Square (Index 25) */}
              {bentoNewsItems[25] && (
                <div 
                  className="md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full"
                  onClick={() => { setActiveOverlayIndex(25); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[25], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[25]).deskStyle}>{bentoNewsItems[25].desk}
                    </div>
                    <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[25].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[25]).briefStyle}>{bentoNewsItems[25].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[25]).sourceStyle}>{bentoNewsItems[25].source}
                    </div>
                  </div>
                
                  {bentoNewsItems[25].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[25].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 11: Two Half Horizontals Side-By-Side (Indices 27 & 28) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {bentoNewsItems[27] && (
                <div 
                  className="col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(27); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[27], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[27]).deskStyle}>{bentoNewsItems[27].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors ">
                      {bentoNewsItems[27].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[27]).briefStyle}>{bentoNewsItems[27].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[27]).sourceStyle}>{bentoNewsItems[27].source}
                    </div>
                  </div>
                
                  {bentoNewsItems[27].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[27].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {bentoNewsItems[28] && (
                <div 
                  className="col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(28); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[28], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold" style={getCardTheme(bentoNewsItems[28]).deskStyle}>{bentoNewsItems[28].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[28].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[28]).briefStyle}>{bentoNewsItems[28].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[28]).sourceStyle}>{bentoNewsItems[28].source}
                    </div>
                  </div>
                
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
                  className="md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full"
                  onClick={() => { setActiveOverlayIndex(29); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[29], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[29]).deskStyle}>{bentoNewsItems[29].desk}
                    </div>
                    <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                      {bentoNewsItems[29].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light mb-4 " style={getCardTheme(bentoNewsItems[29]).briefStyle}>{bentoNewsItems[29].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[29]).sourceStyle}>{bentoNewsItems[29].source}
                    </div>
                  </div>
                
                  {bentoNewsItems[29].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[29].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Square (Index 30) */}
              {bentoNewsItems[30] && (
                <div 
                  className="md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full"
                  onClick={() => { setActiveOverlayIndex(30); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[30], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[30]).deskStyle}>{bentoNewsItems[30].desk}
                    </div>
                    <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[30].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[30]).briefStyle}>{bentoNewsItems[30].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[30]).sourceStyle}>{bentoNewsItems[30].source}
                    </div>
                  </div>
                
                  {bentoNewsItems[30].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[30].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Two Stacked Compacts (Indices 31 & 32) */}
              <div className="md:col-span-2 flex flex-col gap-4">
                {bentoNewsItems[31] && (
                  <div 
                    className="p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1"
                    onClick={() => { setActiveOverlayIndex(31); setShowNewsOverlay(true); }}
                   style={getCardTheme(bentoNewsItems[31], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[31]).deskStyle}>{bentoNewsItems[31].desk}
                      </div>
                      <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[31].title}
                      </h3>
                    </div>
                    <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[31]).sourceStyle}>{bentoNewsItems[31].source}
                    </div>
                  
                  {bentoNewsItems[31].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[31].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
                {bentoNewsItems[32] && (
                  <div 
                    className="p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1"
                    onClick={() => { setActiveOverlayIndex(32); setShowNewsOverlay(true); }}
                   style={getCardTheme(bentoNewsItems[32], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[32]).deskStyle}>{bentoNewsItems[32].desk}
                      </div>
                      <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[32].title}
                      </h3>
                    </div>
                    <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[32]).sourceStyle}>{bentoNewsItems[32].source}
                    </div>
                  
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
                  className="md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(33); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[33], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[33]).deskStyle}>{bentoNewsItems[33].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[33].title}
                    </h3>
                    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[33]).briefStyle}>{bentoNewsItems[33].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[33]).sourceStyle}>{bentoNewsItems[33].source}
                  </div>
                
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
                  className="md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px]"
                  onClick={() => { setActiveOverlayIndex(34); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[34], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[34]).deskStyle}>{bentoNewsItems[34].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[34].title}
                    </h3>
                    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[34]).briefStyle}>{bentoNewsItems[34].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[34]).sourceStyle}>{bentoNewsItems[34].source}
                  </div>
                
                  {bentoNewsItems[34].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[34].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Column: Vertical (Index 37) */}
              {bentoNewsItems[37] && (
                <div 
                  className="md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full"
                  onClick={() => { setActiveOverlayIndex(37); setShowNewsOverlay(true); }}
                 style={getCardTheme(bentoNewsItems[37], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[37]).deskStyle}>{bentoNewsItems[37].desk}
                    </div>
                    <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                      {bentoNewsItems[37].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light mb-4 " style={getCardTheme(bentoNewsItems[37]).briefStyle}>{bentoNewsItems[37].brief}
                    </p>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[37]).sourceStyle}>{bentoNewsItems[37].source}
                    </div>
                  </div>
                
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
                    className="p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
                    onClick={() => { setActiveOverlayIndex(35); setShowNewsOverlay(true); }}
                   style={getCardTheme(bentoNewsItems[35], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[35]).deskStyle}>{bentoNewsItems[35].desk}
                      </div>
                      <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                        {bentoNewsItems[35].title}
                      </h3>
                    </div>
                    <div>
                      <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[35]).briefStyle}>{bentoNewsItems[35].brief}
                      </p>
                      <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[35]).sourceStyle}>{bentoNewsItems[35].source}
                      </div>
                    </div>
                  
                  {bentoNewsItems[35].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[35].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}

                {bentoNewsItems[36] && (
                  <div 
                    className="p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
                    onClick={() => { setActiveOverlayIndex(36); setShowNewsOverlay(true); }}
                   style={getCardTheme(bentoNewsItems[36], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[36]).deskStyle}>{bentoNewsItems[36].desk}
                      </div>
                      <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[36].title}
                      </h3>
                    </div>
                    <div>
                      <p className="font-serif text-xs text-stone-300/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[36]).briefStyle}>{bentoNewsItems[36].brief}
                      </p>
                      <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[36]).sourceStyle}>{bentoNewsItems[36].source}
                      </div>
                    </div>
                  
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

        <hr className="rule border-t border-stone-300 my-3" />

      </div>

      {/* Full-screen Reading Display Overlay */}
      {showNewsOverlay && overlayItem && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-lg transition-all duration-300 animate-fade-in p-6 select-none"
          onClick={() => setShowNewsOverlay(false)}
        >
          {/* Top Centered Logo */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 font-serif text-lg font-semibold tracking-wider text-[#802334] select-none">
            {BRAND.logoText}
          </div>

          {/* Top Right Instructions */}
          <div className="absolute top-6 right-6 font-mono text-[8px] uppercase tracking-widest text-stone-400 select-none">
            ESC or Click to close
          </div>

          {/* Left Arrow */}
          {bentoNewsItems.length > 1 && (
            <button 
              type="button"
              onClick={handlePrevNewsItem}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-3 text-stone-400 hover:text-adjung-maroon transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
              title="Previous News (Left Arrow)"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Right Arrow */}
          {bentoNewsItems.length > 1 && (
            <button 
              type="button"
              onClick={handleNextNewsItem}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-3 text-stone-400 hover:text-adjung-maroon transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
              title="Next News (Right Arrow)"
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
                  className="font-mono text-xs uppercase tracking-widest font-extrabold"
                  style={{ color: getDeskAccentColor(overlayItem.desk) }}
                >
                  {overlayItem.desk}
                </div>

                {/* Large Serif Title */}
                <h1 className="font-serif text-3xl md:text-5xl text-stone-900 leading-tight tracking-tight font-medium px-4">
                  {overlayItem.title}
                </h1>

                {/* Brief body */}
                <p className="font-serif text-lg md:text-xl text-stone-600 leading-relaxed max-w-xl mx-auto px-4 font-light">
                  {overlayItem.brief}
                </p>

                {/* Read Original button */}
                <div className="pt-4 select-none">
                  <a 
                    href={overlayItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-adjung-maroon hover:bg-[#631c28] text-white px-6 py-2.5 rounded font-mono text-[10px] uppercase tracking-wider transition shadow-sm"
                  >
                    Read Original →
                  </a>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

            {/* Navigation Dots */}
            {bentoNewsItems.length > 1 && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-1.5 select-none max-w-xs md:max-w-3xl px-4">
                {Array.from({ length: Math.min(38, bentoNewsItems.length) }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveOverlayIndex(idx);
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      idx === (activeOverlayIndex % bentoNewsItems.length) 
                        ? 'bg-adjung-maroon w-4' 
                        : 'bg-stone-300 hover:bg-stone-400'
                    }`}
                  />
                ))}
              </div>
            )}
        </div>
      )}



    </div>
  );
};
