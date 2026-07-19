import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Entry, SystemSettings } from '../../types';
import { BRAND } from '../../config/brand';
import { parseInlineFormatting, isArabicText, parseInTheNews, getDeskAccentColor, parseWorldClockHolidays } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Info, ChevronLeft, ChevronRight, X, RotateCcw, Check, AlertCircle } from 'lucide-react';

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

const formatBentoDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

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
    },
    finalIsDark
  };
};
const padToLimit = (text: string, maxLen: number): string => {
  if (!text) return '';
  if (text.length >= maxLen) return text.substring(0, maxLen);
  const words = " kerjasama digital ekonomi pembangunan malaysia madani berkembang pesat untuk kemakmuran bersama rakyat negara wawasan lestari aman harmoni".split(" ");
  let result = text;
  let wordIdx = 0;
  while (result.length < maxLen) {
    const nextWord = words[wordIdx % words.length];
    if ((result + " " + nextWord).length > maxLen) {
      break;
    }
    result += " " + nextWord;
    wordIdx++;
  }
  return result;
};

const getLimitsForIndex = (idx: number) => {
  if (idx === 0) return { maxTitle: 115, maxBrief: 350 };
  if ([1, 12, 15, 26, 29, 37].includes(idx)) return { maxTitle: 72, maxBrief: 480 };
  if ([2, 6, 19, 20, 33, 34].includes(idx)) return { maxTitle: 110, maxBrief: 280 };
  if ([3, 11, 16, 25, 30, 35, 36].includes(idx)) return { maxTitle: 85, maxBrief: 200 };
  if ([4, 5, 17, 18, 31, 32].includes(idx)) return { maxTitle: 75, maxBrief: 0 };
  if ([7, 8, 9, 10, 21, 22, 23, 24].includes(idx)) return { maxTitle: 40, maxBrief: 0 };
  return { maxTitle: 70, maxBrief: 100 };
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

  const [parsedNewsItems, setParsedNewsItems] = useState<any[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<'ms' | 'zh' | 'ar' | 'en'>('ms');
  const [enabledLanguages, setEnabledLanguages] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [slotsConfig, setSlotsConfig] = useState<any[]>([]);
  const [formConfig, setFormConfig] = useState<any | null>(null);
  const [isSavingSlot, setIsSavingSlot] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [aiProviders, setAiProviders] = useState<any[]>([]);

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
  }, []);

  useEffect(() => {
    fetch(`/api/system/layout/active?lang=${activeLanguage}&t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        setParsedNewsItems(data);
      })
      .catch(err => console.error('Failed to load active bento layout:', err));
    loadSlotsConfig();
  }, [systemSettings.inTheNewsText, activeLanguage, refreshKey]);

  const handleCardClick = (idx: number) => {
    if (!isEditMode) return;
    const config = slotsConfig.find(s => s.slotIndex === idx);
    const item = bentoNewsItems[idx];
    const limits = getLimitsForIndex(idx);

    const isBarSlot = [7, 8, 9, 10, 21, 22, 23, 24].includes(idx);

    let manualSummaryText = config?.manualSummary || '';
    if (!manualSummaryText.includes('Tajuk:') && !manualSummaryText.includes('Event:')) {
      const itemsList = item?.items || [];
      if (isBarSlot) {
        if (itemsList.length > 0) {
          manualSummaryText = itemsList.map((itm: any) => {
            return `Tarikh: (contoh: 19-26 Julai 26) ${itm.source || ''}\nEvent: (had ${limits.maxTitle} aksara) ${itm.title || ''}\nURL: ${itm.url || ''}`;
          }).join('\n\n____\n\n');
        } else {
          const title = config?.manualTitle || item?.title || '';
          const source = config?.manualSource || item?.source || '';
          const url = config?.manualUrl || item?.url || '#';
          
          manualSummaryText = `Tarikh: (contoh: 19-26 Julai 26) ${source}
Event: (had ${limits.maxTitle} aksara) ${title}
URL: ${url}`;
        }
      } else {
        if (itemsList.length > 0) {
          manualSummaryText = itemsList.map((itm: any) => {
            return `Tajuk: (had ${limits.maxTitle} aksara) ${itm.title || ''}\nHuraian: ${limits.maxBrief > 0 ? `(had ${limits.maxBrief} aksara) ` : ''}${itm.brief || ''}\nKategori: ${itm.desk || ''}\nTarikh: ${itm.publishedAt || ''}\nSumber: ${itm.source || ''}\nURL: ${itm.url || ''}`;
          }).join('\n\n____\n\n');
        } else {
          const title = config?.manualTitle || item?.title || '';
          const brief = config?.manualSummary || item?.brief || '';
          const desk = config?.manualDesk || item?.desk || '';
          const source = config?.manualSource || item?.source || '';
          const url = config?.manualUrl || item?.url || '#';
          const date = item?.publishedAt || '';
          
          manualSummaryText = `Tajuk: (had ${limits.maxTitle} aksara) ${title}
Huraian: ${limits.maxBrief > 0 ? `(had ${limits.maxBrief} aksara) ${brief}` : ''}
Kategori: ${desk}
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
      refreshRate: config?.refreshRate || 'Daily',
      allowedContentTypes: config?.allowedContentTypes || '',
      priority: config?.priority || 'Medium',
      expiresAt: config?.expiresAt || '',
      bgColor: config?.bgColor || 'transparent',
      borderColor: config?.borderColor || '',
      textColor: config?.textColor || '#1F1F1F',
      manualTitle: config?.manualTitle || item?.title || '',
      manualSummary: manualSummaryText,
      manualSource: config?.manualSource || item?.source || '',
      manualUrl: config?.manualUrl || item?.url || '#',
      manualImageUrl: config?.manualImageUrl || item?.imageUrl || '',
      manualDesk: config?.manualDesk || item?.desk || '',
      activeObjectId: config?.activeObjectId || '',
      searchStrategy: config?.searchStrategy || 'Structured Sources Only',
      carouselInterval: config?.carouselInterval || 10,
      carouselDelay: config?.carouselDelay || 0,
      generationLimit: config?.generationLimit || 1
    });
    setEditingSlotIndex(idx);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formConfig) return;
    setIsSavingSlot(true);
    try {
      const response = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formConfig)
      });
      const data = await response.json();
      if (data.success) {
        setRefreshKey(prev => prev + 1);
        setEditingSlotIndex(null);
        setFormConfig(null);
      } else {
        alert('Gagal menyimpan slot: ' + (data.error || ''));
      }
    } catch (err: any) {
      console.error(err);
      alert('Ralat menyimpan slot: ' + (err.message || ''));
    } finally {
      setIsSavingSlot(false);
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
      const limits = getLimitsForIndex(i);
      
      if (fallbackItem.desk) {
        fallbackItem.desk = fallbackItem.desk
          .replace(/SLOT (\d+)/g, (match, p1) => `SLOT ${parseInt(p1) + 1}`)
          .replace(/BAR (\d+)/g, (match, p1) => `BAR ${parseInt(p1) + 1}`);
      }

      let itemToPush: any;
      if (customItem) {
        let finalDesk = customItem.desk || '';
        if (!finalDesk || finalDesk.trim().startsWith('SLOT ') || finalDesk.trim().startsWith('BAR ')) {
          finalDesk = 'Berita';
        }
        itemToPush = {
          ...customItem,
          desk: finalDesk,
          title: customItem.title || fallbackItem.title,
          brief: customItem.brief !== undefined ? customItem.brief : fallbackItem.brief,
          source: customItem.source || fallbackItem.source,
          url: customItem.url || fallbackItem.url || '#',
          rawIndex: customItem.rawIndex !== undefined ? customItem.rawIndex : fallbackItem.rawIndex
        };
      } else {
        itemToPush = { ...fallbackItem };
      }

      if (itemToPush.title) {
        itemToPush.title = padToLimit(itemToPush.title, limits.maxTitle);
      }
      if (itemToPush.brief && limits.maxBrief > 0) {
        itemToPush.brief = padToLimit(itemToPush.brief, limits.maxBrief);
      }

      if ([7, 8, 9, 10, 21, 22, 23, 24].includes(i)) {
        itemToPush.source = itemToPush.source || '19 Jul 2026';
        if (itemToPush.source.length > 25) {
          itemToPush.source = itemToPush.source.substring(0, 25);
        }
      }
      itemToPush.index = i;
      result.push(itemToPush);
    }

    return result;
  }, [parsedNewsItems]);

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

      const limits = getLimitsForIndex(actualSlotIdx);
      if (resolvedItem.title) {
        resolvedItem.title = padToLimit(resolvedItem.title, limits.maxTitle);
      }
      if (resolvedItem.brief && limits.maxBrief > 0) {
        resolvedItem.brief = padToLimit(resolvedItem.brief, limits.maxBrief);
      }

      if ([7, 8, 9, 10, 21, 22, 23, 24].includes(actualSlotIdx)) {
        resolvedItem.source = resolvedItem.source || '19 Jul 2026';
        if (resolvedItem.source.length > 25) {
          resolvedItem.source = resolvedItem.source.substring(0, 25);
        }
      }

      return resolvedItem;
    });
  }, [rawBentoNewsItems, carouselIndices]);



  const activeNewsItem = bentoNewsItems[0];






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
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all border font-sans cursor-pointer ${
                  isEditMode
                    ? 'bg-[#802334] text-white border-[#802334] shadow-sm font-semibold'
                    : 'bg-white text-stone-600 border-stone-300 hover:text-[#802334] hover:border-[#802334]'
                }`}
              >
                <Info size={12} className={isEditMode ? "animate-pulse" : ""} />
                {isEditMode ? 'Tutup Edit' : 'Edit Kandungan'}
              </button>
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
                  onClick={() => handleCardClick(0)}
                  className={`col-span-1 md:col-span-6 p-6 md:p-8 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
               style={getCardTheme(bentoNewsItems[0], 'transparent').cardStyle} >
                <BentoInner itemKey={bentoNewsItems[0].title} className="md:flex-row md:items-center justify-between gap-6" aiProvider={bentoNewsItems[0].aiProvider}>
                  <div className="space-y-2 max-w-3xl">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[0]).deskStyle}>{bentoNewsItems[0].desk}
                    </div>
                    <h3 className="font-serif text-2xl md:text-3xl leading-tight font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[0].title}
                    </h3>
                    <p className="font-serif text-xs text-stone-100/90 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[0]).briefStyle}>{bentoNewsItems[0].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[10px] tracking-editorial uppercase text-stone-300 border-l border-stone-400/30 pl-4 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-1" style={getCardTheme(bentoNewsItems[0]).sourceStyle}>
                    <span>{bentoNewsItems[0].source}</span>
                    {formatBentoDate(bentoNewsItems[0].publishedAt) && <span className="opacity-70 normal-case font-mono text-[9px]">{formatBentoDate(bentoNewsItems[0].publishedAt)}</span>}
                  </div>
                </BentoInner>
              </div>
            )}

            {/* ROW 2 & 3: Vertical, Horizontal, Square, 2 Compact (Indices 1 to 5) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Column: Vertical (Index 1) */}
              {bentoNewsItems[1] && (
                <div 
                  onClick={() => handleCardClick(1)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[1], 'transparent').cardStyle} >
                  <BentoInner itemKey={bentoNewsItems[1].title} aiProvider={bentoNewsItems[1].aiProvider}>
                    <div className="space-y-4">
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[1]).deskStyle}>{bentoNewsItems[1].desk}
                        </div>
                        <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                          {bentoNewsItems[1].title}
                        </h3>
                      </div>
                      <p className="font-serif text-xs text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[1]).briefStyle}>{bentoNewsItems[1].brief}
                      </p>
                    </div>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5" style={getCardTheme(bentoNewsItems[1]).sourceStyle}>
                      <span>{bentoNewsItems[1].source}</span>
                      {formatBentoDate(bentoNewsItems[1].publishedAt) && <span className="opacity-60 normal-case font-mono text-[8px]">{formatBentoDate(bentoNewsItems[1].publishedAt)}</span>}
                    </div>
                  </BentoInner>
                </div>
              )}

              {/* Right/Top: Horizontal (Index 2) */}
              {bentoNewsItems[2] && (
                <div 
                  onClick={() => handleCardClick(2)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[2], 'transparent').cardStyle} >
                  <BentoInner itemKey={bentoNewsItems[2].title} className="md:flex-row md:items-center justify-between gap-4" aiProvider={bentoNewsItems[2].aiProvider}>
                    <div className="space-y-2 flex-1">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[2]).deskStyle}>{bentoNewsItems[2].desk}
                      </div>
                      <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                        {bentoNewsItems[2].title}
                      </h3>
                      <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[2]).briefStyle}>{bentoNewsItems[2].brief}
                      </p>
                    </div>
                    <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[2]).sourceStyle}>
                      <span>{bentoNewsItems[2].source}</span>
                      {formatBentoDate(bentoNewsItems[2].publishedAt) && <span className="opacity-60 normal-case font-mono text-[8px]">{formatBentoDate(bentoNewsItems[2].publishedAt)}</span>}
                    </div>
                  </BentoInner>
                </div>
              )}

              {/* Right/Bottom-Left: Square (Index 3) */}
              {bentoNewsItems[3] && (
                <div 
                  onClick={() => handleCardClick(3)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                      <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5" style={getCardTheme(bentoNewsItems[3]).sourceStyle}>
                        <span>{bentoNewsItems[3].source}</span>
                        {formatBentoDate(bentoNewsItems[3].publishedAt) && <span className="opacity-60 normal-case font-mono text-[8px]">{formatBentoDate(bentoNewsItems[3].publishedAt)}</span>}
                      </div>
                    </div>
                  </BentoInner>
                </div>
              )}

              {/* Right/Bottom-Right: Two Stacked Compacts (Indices 4 & 5) */}
              <div className="md:col-span-2 flex flex-col gap-4">
                {bentoNewsItems[4] && (
                <div 
                  onClick={() => handleCardClick(4)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[4], 'transparent').cardStyle} >
                    <BentoInner itemKey={bentoNewsItems[4].title} aiProvider={bentoNewsItems[4].aiProvider}>
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[4]).deskStyle}>{bentoNewsItems[4].desk}
                        </div>
                        <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                          {bentoNewsItems[4].title}
                        </h3>
                      </div>
                      <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2 flex flex-col gap-0.5" style={getCardTheme(bentoNewsItems[4]).sourceStyle}>
                        <span>{bentoNewsItems[4].source}</span>
                        {formatBentoDate(bentoNewsItems[4].publishedAt) && <span className="opacity-60 normal-case font-mono text-[7px]">{formatBentoDate(bentoNewsItems[4].publishedAt)}</span>}
                      </div>
                    </BentoInner>
                  </div>
                )}
                {bentoNewsItems[5] && (
                <div 
                  onClick={() => handleCardClick(5)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[5], 'transparent').cardStyle} >
                    <BentoInner itemKey={bentoNewsItems[5].title} aiProvider={bentoNewsItems[5].aiProvider}>
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[5]).deskStyle}>{bentoNewsItems[5].desk}
                        </div>
                        <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                          {bentoNewsItems[5].title}
                        </h3>
                      </div>
                      <div className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2 flex flex-col gap-0.5" style={getCardTheme(bentoNewsItems[5]).sourceStyle}>
                        <span>{bentoNewsItems[5].source}</span>
                        {formatBentoDate(bentoNewsItems[5].publishedAt) && <span className="opacity-60 normal-case font-mono text-[7px]">{formatBentoDate(bentoNewsItems[5].publishedAt)}</span>}
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
                  onClick={() => handleCardClick(6)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(12)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[12], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[12]).deskStyle}>{bentoNewsItems[12].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[12].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[12]).briefStyle}>{bentoNewsItems[12].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[12]).sourceStyle}>{bentoNewsItems[12].source}
                  </div>
                
                  {bentoNewsItems[12].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[12].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              <div className="md:col-span-2 flex flex-col gap-2 h-full">
                {[7, 8, 9, 10].map((idx) => {
                  const barItem = bentoNewsItems[idx];
                  if (!barItem) return null;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleCardClick(idx)} className={`px-4 py-2 rounded-md flex justify-between items-center flex-1 min-h-[38px] group hover:brightness-110 transition-all duration-200 ${isEditMode ? 'ring-2 ring-dashed ring-[#E9D8A6] cursor-pointer' : ''}`}
                      style={{ backgroundColor: '#802334' }}
                    >
                      {/* Tarikh Event */}
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold flex-shrink-0 pr-3 border-r border-white/20">
                        {barItem.source || '—'}
                      </div>
                      {/* Nama Event */}
                      <div className="font-serif text-xs text-white leading-snug flex-1 pl-3 group-hover:text-[#E9D8A6] transition-colors">
                        {barItem.title}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Left Bottom Right: Square (Index 11) */}
              {bentoNewsItems[11] && (
                <div 
                  onClick={() => handleCardClick(11)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(13)}
                  className={`col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(14)}
                  className={`col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(15)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[15], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[15]).deskStyle}>{bentoNewsItems[15].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[15].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[15]).briefStyle}>{bentoNewsItems[15].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[15]).sourceStyle}>{bentoNewsItems[15].source}
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
                  onClick={() => handleCardClick(16)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(17)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(18)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(19)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
              
              {/* Left Column: Vertical (Index 26) */}
              {bentoNewsItems[26] && (
                <div 
                  onClick={() => handleCardClick(26)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[26], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[26]).deskStyle}>{bentoNewsItems[26].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[26].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[26]).briefStyle}>{bentoNewsItems[26].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[26]).sourceStyle}>{bentoNewsItems[26].source}
                  </div>
                
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
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[20], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[20]).deskStyle}>{bentoNewsItems[20].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[20].title}
                    </h3>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[20]).briefStyle}>{bentoNewsItems[20].brief}
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

              {/* Right Bottom Left: Square (Index 25) */}
              {bentoNewsItems[25] && (
                <div 
                  onClick={() => handleCardClick(25)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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

              <div className="md:col-span-2 flex flex-col gap-2 h-full">
                {[21, 22, 23, 24].map((idx) => {
                  const barItem = bentoNewsItems[idx];
                  if (!barItem) return null;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleCardClick(idx)} className={`px-4 py-2 rounded-md flex justify-between items-center flex-1 min-h-[38px] group hover:brightness-110 transition-all duration-200 ${isEditMode ? 'ring-2 ring-dashed ring-[#E9D8A6] cursor-pointer' : ''}`}
                      style={{ backgroundColor: '#802334' }}
                    >
                      {/* Tarikh Event */}
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold flex-shrink-0 pr-3 border-r border-white/20">
                        {barItem.source || '—'}
                      </div>
                      {/* Nama Event */}
                      <div className="font-serif text-xs text-white leading-snug flex-1 pl-3 group-hover:text-[#E9D8A6] transition-colors">
                        {barItem.title}
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
                  className={`col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(28)}
                  className={`col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(29)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[29], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[29]).deskStyle}>{bentoNewsItems[29].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[29].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[29]).briefStyle}>{bentoNewsItems[29].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[29]).sourceStyle}>{bentoNewsItems[29].source}
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
                  onClick={() => handleCardClick(30)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(31)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(32)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(33)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(34)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(37)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[37], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[37]).deskStyle}>{bentoNewsItems[37].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[37].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[37]).briefStyle}>{bentoNewsItems[37].brief}
                    </p>
                  </div>
                  <div className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[37]).sourceStyle}>{bentoNewsItems[37].source}
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
                  onClick={() => handleCardClick(35)}
                  className={`p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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
                  onClick={() => handleCardClick(36)}
                  className={`p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
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

      {/* Pop-up Modal Penyuntingan Slot Bento */}
      {editingSlotIndex !== null && formConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg border border-stone-200 max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-fade-in">
            <header className="px-6 py-4 border-b border-stone-150 flex justify-between items-center bg-stone-50">
              <div>
                <h3 className="font-serif text-xs md:text-sm font-bold text-[#802334] uppercase tracking-wide">
                  Urus Slot {editingSlotIndex + 1}: {bentoNewsItems[editingSlotIndex]?.desk || 'Umum'}
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
                }}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </header>
            
            <form onSubmit={handleSaveSlot} className="p-6 flex flex-col gap-4">
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

                {/* MODUS MANUAL */}
                {formConfig.contentMode === 'Manual' && (
                  <>
                    <div className="flex flex-col gap-1 col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kandungan Manual (Ikuti Format Template)</label>
                        <span className="text-[8px] text-[#802334] font-sans font-bold">Had aksara dinyatakan di bawah</span>
                      </div>
                      <textarea
                        value={formConfig.manualSummary}
                        onChange={(e) => setFormConfig({ ...formConfig, manualSummary: e.target.value })}
                        rows={12}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs leading-relaxed"
                      />
                      <p className="text-[9px] text-[#802334] font-sans font-bold leading-normal mt-1">
                        * Nota: Jika ingin meletakkan 2 atau lebih kandungan berita untuk bertukar secara animasi (carousel/slide), pisahkan setiap blok berita dengan garisan pemisah empat underscores (____).
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Gambar Latar Belakang (URL / Fail)</label>
                      <input
                        type="text"
                        value={formConfig.manualImageUrl}
                        onChange={(e) => setFormConfig({ ...formConfig, manualImageUrl: e.target.value })}
                        placeholder="/uploads/... atau URL luar"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
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
                      <input
                        type="text"
                        readOnly
                        value={formConfig.model || 'Pilih pembekal di atas'}
                        className="w-full px-3 py-2 border border-stone-200 rounded bg-stone-50 text-stone-500 font-mono text-xs cursor-not-allowed"
                      />
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
                        placeholder="https://feeds.feedburner.com/... atau URL portal berita"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Arahan Khusus Penjanaan (Prompt Teks)</label>
                      <textarea
                        value={formConfig.promptText}
                        onChange={(e) => setFormConfig({ ...formConfig, promptText: e.target.value })}
                        placeholder="Contoh: Fokus kepada berita geopolitik Asia Tenggara..."
                        rows={4}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Allowed Content Types</label>
                      <input
                        type="text"
                        value={formConfig.allowedContentTypes}
                        onChange={(e) => setFormConfig({ ...formConfig, allowedContentTypes: e.target.value })}
                        placeholder="Brief, Essay, dll."
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kadar Segar Semula (refreshRate)</label>
                      <select
                        value={formConfig.refreshRate}
                        onChange={(e) => setFormConfig({ ...formConfig, refreshRate: e.target.value })}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      >
                        <option value="Hourly">Setiap Jam (Hourly)</option>
                        <option value="Daily">Setiap Hari (Daily)</option>
                        <option value="Weekly">Setiap Minggu (Weekly)</option>
                      </select>
                    </div>

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
                  </>
                )}

                {/* GAYA / STYLES (DITUNJUKKAN KEDUA-DUA MOD) */}
                <div className="border-t border-stone-150 col-span-2 my-2 pt-2">
                  <h4 className="font-sans text-[10px] font-bold text-[#802334] uppercase tracking-wider">Konfigurasi Reka Bentuk & Animasi</h4>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Warna Latar (bgColor)</label>
                  <input
                    type="text"
                    value={formConfig.bgColor}
                    onChange={(e) => setFormConfig({ ...formConfig, bgColor: e.target.value })}
                    placeholder="transparent, #ffffff, #802334..."
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Warna Teks (textColor)</label>
                  <input
                    type="text"
                    value={formConfig.textColor}
                    onChange={(e) => setFormConfig({ ...formConfig, textColor: e.target.value })}
                    placeholder="#1F1F1F, #FDFDFD..."
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                  />
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

              </div>
              
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-stone-150">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSlotIndex(null);
                    setFormConfig(null);
                  }}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs font-semibold cursor-pointer transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSlot}
                  className="px-5 py-2 bg-[#802334] hover:bg-[#6c1d2c] text-white rounded text-xs font-semibold cursor-pointer shadow-sm transition-all disabled:opacity-50"
                >
                  {isSavingSlot ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
